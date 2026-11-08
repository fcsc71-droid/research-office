import crypto from "node:crypto";
import { config } from "./config.js";

const graph = (p: string) => `https://graph.facebook.com/${config.graphVersion}/${p}`;

async function call(method: "GET" | "POST", p: string, body?: unknown) {
  const url = new URL(graph(p));
  url.searchParams.set("access_token", config.pageAccessToken);
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Graph API ${method} ${p} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

/** التحقق من أن الطلب قادم فعلاً من فيسبوك (توقيع X-Hub-Signature-256) */
export function verifySignature(rawBody: Buffer, header: string | undefined): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", config.appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice(7), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** تقسيم النص لأجزاء لا تتجاوز حد ماسنجر (2000 حرف) */
function chunks(text: string, size = 1900): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size / 2) cut = rest.lastIndexOf(" ", size);
    if (cut < size / 2) cut = size;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

export async function sendMessage(psid: string, text: string) {
  for (const part of chunks(text)) {
    await call("POST", "me/messages", {
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text: part },
    });
  }
}

export async function senderAction(psid: string, action: "typing_on" | "typing_off" | "mark_seen") {
  await call("POST", "me/messages", { recipient: { id: psid }, sender_action: action }).catch(() => {});
}

export async function replyToComment(commentId: string, text: string) {
  await call("POST", `${commentId}/comments`, { message: text });
}

/** رد خاص (رسالة ماسنجر) على صاحب التعليق — مسموح مرة واحدة لكل تعليق خلال 7 أيام */
export async function privateReply(commentId: string, text: string) {
  await call("POST", "me/messages", { recipient: { comment_id: commentId }, message: { text } });
}

export async function getUserFirstName(psid: string): Promise<string | undefined> {
  try {
    const d = await call("GET", `${psid}?fields=first_name,name`);
    return (d.first_name as string) || (d.name as string) || undefined;
  } catch {
    return undefined;
  }
}

export async function getPostText(postId: string): Promise<string | undefined> {
  try {
    const d = await call("GET", `${postId}?fields=message`);
    return (d.message as string) || undefined;
  } catch {
    return undefined;
  }
}
