# API CURL — Active rentals & weekly rate

Все endpoint tenant-scoped: нужен `X-Tenant-Id`.

## 1) Список активных аренд

```bash
curl -X GET "http://localhost:3001/rentals/active" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"
```

## 2) Установить недельную ставку для аренды

```bash
curl -X PATCH "http://localhost:3001/rentals/<RENTAL_ID>/weekly-rate" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>" \
-H "Content-Type: application/json" \
-d '{"weeklyRateRub": 5500}'
```

После этого можно запускать генерацию начислений:

```bash
curl -X POST "http://localhost:3001/weekly-payments/generate" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>" \
-H "Content-Type: application/json" \
-d '{"from":"2026-02-01T00:00:00.000Z","to":"2026-03-01T00:00:00.000Z"}'
```
