import { getSettings } from "@/lib/settings";
import { runDeadlineReminders } from "@/lib/notify";
import { jsonError } from "@/lib/http";
import { timingSafeEqual } from "node:crypto";

// يُستدعى من مجدول خارجي (cron) لإنشاء تنبيهات اقتراب مواعيد التحكيم
// مثال: curl -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/deadlines
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return jsonError("غير مصرح", 401);
  }
  const settings = await getSettings();
  const count = await runDeadlineReminders(settings.deadlineReminderDays);
  return Response.json({ ok: true, reminders: count });
}
