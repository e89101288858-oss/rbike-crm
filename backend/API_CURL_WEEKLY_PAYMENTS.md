# API CURL — Weekly payments & debts

Все endpoint tenant-scoped: нужен заголовок `X-Tenant-Id`.

## 1) Генерация недельных начислений

```bash
curl -X POST "http://localhost:3001/weekly-payments/generate" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>" \
-H "Content-Type: application/json" \
-d '{"from":"2026-02-01T00:00:00.000Z","to":"2026-03-01T00:00:00.000Z"}'
```

Создает `PLANNED` платежи типа `WEEKLY_RENT` на основе активных аренд и `rental.weeklyRateRub`.

## 2) Долги по курьерам (просроченные)

```bash
curl -X GET "http://localhost:3001/weekly-payments/debts?overdueOnly=true" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"
```

## 3) Все плановые долги (включая будущие)

```bash
curl -X GET "http://localhost:3001/weekly-payments/debts?overdueOnly=false" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"
```
