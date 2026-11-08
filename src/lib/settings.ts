import "server-only";
import { db } from "@/lib/db";

export type SystemSettings = {
  universityName: string;
  officeName: string;
  referencePrefix: string;
  watermarkInExports: boolean;
  watermarkOnDownloads: boolean;
  maxUploadMb: number;
  defaultReviewDays: number;
  deadlineReminderDays: number;
  blindReview: boolean;
  allowResearcherSelfSubmit: boolean;
};

export const DEFAULT_SETTINGS: SystemSettings = {
  universityName: "الجامعة",
  officeName: "مكتب الأبحاث العلمية",
  referencePrefix: "RES",
  watermarkInExports: true,
  watermarkOnDownloads: true,
  maxUploadMb: 20,
  defaultReviewDays: 14,
  deadlineReminderDays: 3,
  blindReview: true,
  allowResearcherSelfSubmit: true,
};

export async function getSettings(): Promise<SystemSettings> {
  const rows = await db.systemSetting.findMany();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  return s as SystemSettings;
}

export async function saveSettings(values: Partial<SystemSettings>) {
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.systemSetting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } }),
    ),
  );
}
