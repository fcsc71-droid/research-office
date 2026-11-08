#!/usr/bin/env bash
# نسخ احتياطي لقاعدة البيانات والملفات المرفوعة
# الاستخدام: npm run db:backup   (يمكن جدولته عبر cron)
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${DATABASE_URL:?DATABASE_URL غير معرف}"
STORAGE_DIR="${STORAGE_DIR:-./storage}"
BACKUP_DIR="${BACKUP_DIR:-$STORAGE_DIR/backups}"
STAMP="$(date +%Y-%m-%dT%H-%M-%S)"
mkdir -p "$BACKUP_DIR"
DB_URL="${DATABASE_URL%%\?*}"
pg_dump --format=custom --no-owner --file="$BACKUP_DIR/backup-$STAMP.dump" "$DB_URL"
tar -czf "$BACKUP_DIR/files-$STAMP.tar.gz" -C "$STORAGE_DIR" uploads 2>/dev/null || true
# الاحتفاظ بآخر 30 نسخة فقط
ls -1t "$BACKUP_DIR"/backup-*.dump 2>/dev/null | tail -n +31 | xargs -r rm --
ls -1t "$BACKUP_DIR"/files-*.tar.gz 2>/dev/null | tail -n +31 | xargs -r rm --
echo "✔ تم إنشاء النسخة الاحتياطية في $BACKUP_DIR (backup-$STAMP.dump)"
