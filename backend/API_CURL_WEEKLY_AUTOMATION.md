# API CURL — Weekly payments automation (OWNER)

## 1) Запуск генерации по всем tenant (OWNER)

```bash
curl -X POST "http://localhost:3001/weekly-payments/admin/generate-all" \
-H "Authorization: Bearer $OWNER_TOKEN" \
-H "Content-Type: application/json" \
-d '{"from":"2026-02-01T00:00:00.000Z","to":"2026-03-01T00:00:00.000Z"}'
```

## 2) Сводка долгов по клиентам (tenant)

```bash
curl -X GET "http://localhost:3001/weekly-payments/debts/summary-by-client?overdueOnly=true" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"
```

## 3) Пример cron на сервере (ежедневно в 00:15 UTC)

```bash
15 0 * * * /usr/bin/curl -s -X POST "http://localhost:3001/weekly-payments/admin/generate-all" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"$(date -u +\%Y-\%m-01T00:00:00.000Z)\",\"to\":\"$(date -u -d '+2 month' +\%Y-\%m-01T00:00:00.000Z)\"}" \
  >/var/log/rbike-weekly-billing.log 2>&1
```

Рекомендация: вынести токен в env/секрет, не хранить в crontab открытым текстом.
