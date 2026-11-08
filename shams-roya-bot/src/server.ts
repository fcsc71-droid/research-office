import http from "node:http";
import { assertFacebookConfig, config } from "./config.js";
import * as fb from "./facebook.js";
import { isRetryable, runAgent } from "./agent.js";
import {
  alreadyProcessed,
  isPaused,
  loadCustomer,
  pauseFor,
  saveCustomer,
  withCustomerLock,
  type Channel,
} from "./store.js";

assertFacebookConfig();

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= 2 || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

async function notifyAdmin(text: string) {
  if (!config.adminPsid) return;
  await fb.sendMessage(config.adminPsid, text).catch((e) => log("تعذر إبلاغ المسؤول:", e.message));
}

// ───────────────────────── المعالجة المشتركة ─────────────────────────
interface Incoming {
  customerId: string;
  channel: Channel;
  text: string;
  displayName?: string;
  postText?: string;
  deliver: (reply: string) => Promise<void>;
  link?: string;
}

async function handle(inc: Incoming) {
  await withCustomerLock(inc.customerId, async () => {
    const customer = await loadCustomer(inc.customerId);
    if (inc.displayName && !customer.name) customer.name = inc.displayName;

    if (isPaused(customer)) {
      // موظف بشري يتولى المحادثة: نحفظ الرسالة فقط دون رد
      customer.turns.push({ role: "user", text: inc.text, channel: inc.channel, at: new Date().toISOString() });
      await saveCustomer(customer);
      log(`[${inc.channel}] ${inc.customerId} متوقف مؤقتاً (موظف يتولى المحادثة)`);
      return;
    }

    const result = await withRetry(() =>
      runAgent({ customer, channel: inc.channel, text: inc.text, displayName: inc.displayName, postText: inc.postText }),
    );

    const now = new Date().toISOString();
    customer.turns.push({ role: "user", text: inc.text, channel: inc.channel, at: now });

    if (result.reply) {
      await inc.deliver(result.reply);
      customer.turns.push({ role: "assistant", text: result.reply, channel: inc.channel, at: now });
      log(`[${inc.channel}] ← ${inc.customerId}: ${inc.text.slice(0, 80)} | → ${result.reply.slice(0, 80)}`);
    } else {
      log(`[${inc.channel}] ${inc.customerId}: لا رد (${result.skipped ? "تم التجاهل" : "بدون نص"})`);
    }

    if (result.handoffReason) {
      pauseFor(customer, config.humanPauseHours);
      await notifyAdmin(
        `🔔 تحويل لموظف (${inc.channel === "messenger" ? "ماسنجر" : "تعليق"})\n` +
          `الشخص: ${customer.name ?? inc.customerId}\nالسبب: ${result.handoffReason}\n` +
          `آخر رسالة: ${inc.text}${inc.link ? `\n${inc.link}` : ""}`,
      );
    }
    await saveCustomer(customer);
  });
}

// ───────────────────────── ماسنجر ─────────────────────────
type MessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  message?: { mid: string; text?: string; is_echo?: boolean; app_id?: number; attachments?: { type: string }[] };
  postback?: { mid?: string; title?: string; payload?: string };
};

async function onMessaging(ev: MessagingEvent) {
  // رد يدوي من أحد مشرفي الصفحة → أوقف البوت لهذا الشخص مؤقتاً
  if (ev.message?.is_echo) {
    const fromOurApp = config.appId && String(ev.message.app_id ?? "") === config.appId;
    if (!fromOurApp && config.appId) {
      await withCustomerLock(ev.recipient.id, async () => {
        const c = await loadCustomer(ev.recipient.id);
        pauseFor(c, config.humanPauseHours);
        if (ev.message?.text) c.turns.push({ role: "assistant", text: `(موظف) ${ev.message.text}`, channel: "messenger", at: new Date().toISOString() });
        await saveCustomer(c);
      });
      log(`موظف رد يدوياً على ${ev.recipient.id} — إيقاف البوت ${config.humanPauseHours} ساعة`);
    }
    return;
  }
  if (!config.replyToMessenger) return;

  const psid = ev.sender.id;
  const id = ev.message?.mid ?? ev.postback?.mid ?? `${psid}-${ev.postback?.payload}`;
  if (alreadyProcessed(id)) return;

  let text = ev.message?.text ?? ev.postback?.title ?? ev.postback?.payload;
  if (!text && ev.message?.attachments?.length) {
    text = `[أرسل الشخص مرفقاً من نوع: ${ev.message.attachments.map((a) => a.type).join("، ")}]`;
  }
  if (!text) return;

  await fb.senderAction(psid, "mark_seen");
  await fb.senderAction(psid, "typing_on");
  const name = await fb.getUserFirstName(psid);
  await handle({
    customerId: psid,
    channel: "messenger",
    text,
    displayName: name,
    deliver: (reply) => fb.sendMessage(psid, reply),
  });
}

// ───────────────────────── التعليقات ─────────────────────────
type FeedChange = {
  field: string;
  value: {
    item?: string;
    verb?: string;
    comment_id?: string;
    post_id?: string;
    parent_id?: string;
    message?: string;
    from?: { id: string; name?: string };
  };
};

async function onFeedChange(pageId: string, ch: FeedChange) {
  const v = ch.value;
  if (ch.field !== "feed" || v.item !== "comment" || v.verb !== "add") return;
  if (!config.replyToComments || !v.comment_id || !v.message?.trim()) return;
  if (v.from?.id === pageId) return; // تعليق الصفحة نفسها
  if (alreadyProcessed(v.comment_id)) return;

  const postText = v.post_id ? await fb.getPostText(v.post_id) : undefined;
  const commentId = v.comment_id;

  await handle({
    customerId: v.from?.id ? `fbuser_${v.from.id}` : `comment_${commentId}`,
    channel: "comment",
    text: v.message,
    displayName: v.from?.name,
    postText,
    link: `https://facebook.com/${commentId}`,
    deliver: async (reply) => {
      await fb.replyToComment(commentId, reply);
      if (config.privateReplyToComments) {
        await fb
          .privateReply(commentId, `أهلاً ${v.from?.name ?? ""} 🌞 شكراً لتعليقك على صفحة مركز شمس رؤيا. كيف نقدر نساعدك؟`)
          .catch((e) => log("تعذر الرد الخاص:", e.message));
      }
    },
  });
}

// ───────────────────────── خادم HTTP ─────────────────────────
type WebhookBody = {
  object?: string;
  entry?: { id: string; messaging?: MessagingEvent[]; changes?: FeedChange[] }[];
};

function dispatch(body: WebhookBody) {
  if (body.object !== "page") return;
  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      onMessaging(ev).catch((e) => log("خطأ ماسنجر:", e));
    }
    for (const ch of entry.changes ?? []) {
      onFeedChange(entry.id, ch).catch((e) => log("خطأ تعليق:", e));
    }
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
    return;
  }

  if (url.pathname !== "/webhook") {
    res.writeHead(404).end();
    return;
  }

  // تأكيد الاشتراك من لوحة مطوري ميتا
  if (req.method === "GET") {
    const ok =
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === config.verifyToken;
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get("hub.challenge") ?? "" : "forbidden");
    return;
  }

  if (req.method === "POST") {
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(parts);
      if (!fb.verifySignature(raw, req.headers["x-hub-signature-256"] as string | undefined)) {
        res.writeHead(401).end("bad signature");
        return;
      }
      // نرد على فيسبوك فوراً ثم نعالج في الخلفية
      res.writeHead(200).end("EVENT_RECEIVED");
      try {
        dispatch(JSON.parse(raw.toString("utf8")) as WebhookBody);
      } catch (e) {
        log("JSON غير صالح:", e);
      }
    });
    return;
  }

  res.writeHead(405).end();
});

server.listen(config.port, () => log(`بوت مركز شمس رؤيا يعمل على المنفذ ${config.port} — المسار /webhook`));
