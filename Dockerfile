# صورة تشغيل النظام (تتضمن Chromium لتصدير PDF العربي)
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NEXT_TELEMETRY_DISABLED=1 \
    STORAGE_DIR=/app/storage

WORKDIR /app

# أدوات PostgreSQL للنسخ الاحتياطي
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --include=dev

# تثبيت Chromium ومكتبات النظام اللازمة له
RUN npx playwright-core install --with-deps chromium

COPY . .
RUN npm run build

EXPOSE 3000
# عند كل تشغيل: تطبيق الـ Migrations ثم التهيئة (لا تكرر البيانات) ثم تشغيل الخادم
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p ${PORT:-3000}"]
