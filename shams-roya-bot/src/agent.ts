import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import type { Channel, CustomerRecord } from "./store.js";

const client = new Anthropic(); // يقرأ ANTHROPIC_API_KEY من البيئة

type Msg = Anthropic.Beta.BetaMessageParam;

// ───────────────────────── تعليمات الوكيل ─────────────────────────
const INSTRUCTIONS = `أنت المساعد الرسمي لصفحة «مركز شمس رؤيا» على فيسبوك. ترد على رسائل ماسنجر وعلى تعليقات المنشورات نيابةً عن فريق المركز.

طريقة عملك:
- اقرأ سجل المحادثة السابقة مع الشخص وملاحظاتك عنه، واستنتج ما يريده فعلاً حتى لو لم يصرّح به، وتابع من حيث توقفتما دون أن تكرر أسئلة سبق أن أجاب عنها.
- اعتمد فقط على «معلومات المركز» أدناه. إن سُئلت عن شيء غير موجود فيها (سعر، موعد، تفاصيل) فلا تخمّن: قل بلطف إنك ستحوّل السؤال لأحد الموظفين واستخدم أداة handoff_to_human.
- إذا ذكر الشخص معلومة مفيدة عن نفسه (اسمه، الخدمة التي تهمه، موعد مناسب له، رقم تواصل أعطاه طوعاً، شكوى سابقة) فاحفظها بأداة save_customer_note حتى تتذكرها لاحقاً.
- حوّل للموظف أيضاً عند: الشكاوى أو الغضب، طلب التحدث مع إنسان، المدفوعات والاسترجاع، أو أي أمر حساس.
- اكتب بالعربية وبنفس لهجة الشخص قدر الإمكان، بأسلوب ودود ومختصر ومهني. لا تستخدم تنسيق Markdown (لا نجوم ولا عناوين) لأن فيسبوك لا يعرضه.
- في ماسنجر: ردود قصيرة (سطرين إلى خمسة أسطر عادةً) واسأل سؤالاً واحداً واضحاً عند الحاجة لمعلومة.
- في التعليقات العامة: رد قصير جداً (جملة أو جملتان)، ولا تطلب ولا تذكر بيانات شخصية علناً؛ ادعُ الشخص للتواصل عبر الرسائل الخاصة للتفاصيل. إن كان التعليق مزعجاً أو إعلاناً أو إساءة أو لا يحتاج رداً (مثل إشارة لصديق فقط) فاستخدم أداة skip_reply ولا تكتب رداً.
- لا تدّعِ أنك إنسان؛ إن سُئلت فأنت المساعد الآلي للمركز.`;

function knowledge(): string {
  try {
    return fs.readFileSync(config.knowledgeFile, "utf8");
  } catch {
    return "(لم تتم إضافة معلومات المركز بعد — حوّل الأسئلة التفصيلية إلى الموظفين)";
  }
}

// ───────────────────────── الأدوات ─────────────────────────
const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "save_customer_note",
    description:
      "احفظ معلومة مستنتجة أو مذكورة عن هذا الشخص لتتذكرها في المحادثات القادمة (مثل اسمه، الخدمة التي تهمه، تفضيلاته، حالة طلبه). لا تحفظ معلومات تافهة أو مكررة.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        note: { type: "string", description: "الملاحظة بجملة قصيرة" },
        name: { type: "string", description: "اسم الشخص إن عرفته، وإلا نص فارغ" },
      },
      required: ["note", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "handoff_to_human",
    description:
      "حوّل المحادثة لموظف بشري من فريق المركز. بعد استدعائها يتوقف البوت عن الرد على هذا الشخص مؤقتاً. اكتب بعدها رسالة قصيرة للشخص تخبره أن أحد الموظفين سيتواصل معه.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "سبب التحويل وملخص الطلب للموظف" },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  {
    name: "skip_reply",
    description:
      "استخدمها فقط في التعليقات العامة عندما لا يستحق التعليق رداً (مزعج، إعلان، إساءة، إشارة لأصدقاء فقط، رموز تعبيرية بلا سؤال).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
      additionalProperties: false,
    },
  },
];

// ───────────────────────── التشغيل ─────────────────────────
export interface AgentInput {
  customer: CustomerRecord;
  channel: Channel;
  text: string;
  displayName?: string;
  /** نص المنشور الذي جاء عليه التعليق (للتعليقات فقط) */
  postText?: string;
}

export interface AgentResult {
  reply: string | null;
  handoffReason?: string;
  skipped?: boolean;
}

function buildHistory(rec: CustomerRecord): Msg[] {
  const turns = rec.turns.slice(-config.historyLimit);
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns.map((t) => ({
    role: t.role,
    content: t.channel === "comment" && t.role === "user" ? `[تعليق عام] ${t.text}` : t.text,
  }));
}

function contextHeader(input: AgentInput): string {
  const { customer, channel } = input;
  const lines = [
    `القناة: ${channel === "messenger" ? "رسالة خاصة في ماسنجر" : "تعليق عام على منشور"}`,
    `الوقت الحالي: ${new Date().toLocaleString("ar", { timeZone: process.env.TZ || "Asia/Baghdad" })}`,
  ];
  const name = customer.name || input.displayName;
  if (name) lines.push(`اسم الشخص: ${name}`);
  if (customer.notes.length) lines.push(`ملاحظاتك المحفوظة عنه:\n- ${customer.notes.join("\n- ")}`);
  if (customer.turns.length === 0) lines.push("هذه أول مرة يتواصل فيها هذا الشخص معنا.");
  if (input.postText) lines.push(`نص المنشور الذي علّق عليه: «${input.postText.slice(0, 1500)}»`);
  return `<سياق>\n${lines.join("\n")}\n</سياق>\n\n`;
}

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: `${INSTRUCTIONS}\n\n# معلومات المركز\n${knowledge()}`, cache_control: { type: "ephemeral" } },
  ];

  const messages: Msg[] = [
    ...buildHistory(input.customer),
    { role: "user", content: contextHeader(input) + input.text },
  ];

  const result: AgentResult = { reply: null };

  for (let i = 0; i < 6; i++) {
    const response = await client.beta.messages.create({
      model: config.model,
      max_tokens: 16000,
      // إن رفض النموذج طلباً لأسباب السلامة يعيد الخادم المحاولة تلقائياً على نموذج بديل
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: config.effort },
      system,
      tools,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { reply: null, handoffReason: "رفض النموذج الرد على هذه الرسالة" };
    }

    // نعيد محتوى الرد كاملاً كما هو (ضروري لسلامة كتل التفكير داخل حلقة الأدوات)
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) result.reply = text;

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const args = (tu.input ?? {}) as Record<string, string>;
      let output = "تم.";
      if (tu.name === "save_customer_note") {
        const note = String(args.note ?? "").trim();
        if (note && !input.customer.notes.includes(note)) input.customer.notes.push(note);
        if (input.customer.notes.length > 30) input.customer.notes = input.customer.notes.slice(-30);
        if (args.name?.trim()) input.customer.name = args.name.trim();
        output = "تم حفظ الملاحظة.";
      } else if (tu.name === "handoff_to_human") {
        result.handoffReason = String(args.reason ?? "");
        output = "تم إبلاغ الفريق. اكتب الآن رسالة قصيرة للشخص.";
      } else if (tu.name === "skip_reply") {
        result.skipped = true;
        output = "لن يتم الرد. لا تكتب شيئاً.";
      } else {
        output = `أداة غير معروفة: ${tu.name}`;
      }
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: output });
    }
    messages.push({ role: "user", content: toolResults });
  }

  if (result.skipped) result.reply = null;
  return result;
}

export function isRetryable(err: unknown): boolean {
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError
  );
}
