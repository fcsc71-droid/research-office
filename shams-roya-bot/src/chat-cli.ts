/**
 * تجربة البوت من الطرفية بدون فيسبوك:
 *   npm run chat            ← محادثة ماسنجر
 *   npm run chat -- comment ← محاكاة تعليقات عامة
 * تُحفظ الذاكرة في data/customers/cli-tester.json
 */
import readline from "node:readline/promises";
import { runAgent } from "./agent.js";
import { loadCustomer, saveCustomer, type Channel } from "./store.js";

const channel: Channel = process.argv[2] === "comment" ? "comment" : "messenger";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const id = "cli-tester";

console.log(`🌞 تجربة بوت مركز شمس رؤيا (${channel === "comment" ? "تعليقات" : "ماسنجر"}) — اكتب "خروج" للإنهاء، "نسيان" لمسح الذاكرة\n`);

for (;;) {
  const text = (await rl.question("أنت: ")).trim();
  if (!text) continue;
  if (text === "خروج") break;
  const customer = await loadCustomer(id);
  if (text === "نسيان") {
    await saveCustomer({ ...customer, turns: [], notes: [], name: undefined, pausedUntil: undefined });
    console.log("تم مسح الذاكرة.\n");
    continue;
  }
  const result = await runAgent({ customer, channel, text });
  const now = new Date().toISOString();
  customer.turns.push({ role: "user", text, channel, at: now });
  if (result.reply) customer.turns.push({ role: "assistant", text: result.reply, channel, at: now });
  await saveCustomer(customer);
  console.log(`\nالبوت: ${result.reply ?? "(لا رد)"}`);
  if (result.skipped) console.log("   [تم تجاهل التعليق]");
  if (result.handoffReason) console.log(`   [تحويل لموظف: ${result.handoffReason}]`);
  if (customer.notes.length) console.log(`   [ملاحظات محفوظة: ${customer.notes.join(" | ")}]`);
  console.log();
}
rl.close();
