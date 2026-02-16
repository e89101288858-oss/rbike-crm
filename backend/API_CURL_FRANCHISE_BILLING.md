# API CURL — Franchise Billing (Роялти 5% от выручки)

## База
- API URL: `http://localhost:3001`
- Auth: `Authorization: Bearer <JWT>`

## 1) Отчет OWNER за месяц по всем франчайзи

```bash
curl -X GET "http://localhost:3001/franchise-billing/owner/monthly?month=2026-02" \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

Параметры:
- `month` (опционально): `YYYY-MM` (если не указан — текущий месяц UTC)
- `includeZero` (опционально): `true|false` (по умолчанию `false`)

## 2) Отчет FRANCHISEE за месяц (только свои тенанты)

```bash
curl -X GET "http://localhost:3001/franchise-billing/my/monthly?month=2026-02" \
  -H "Authorization: Bearer $FRANCHISEE_TOKEN"
```

Параметры:
- `month` (опционально): `YYYY-MM`
- `includeZero` (опционально): `true|false`

## Правила расчета
- В выручку входят только платежи `Payment.status = PAID` в выбранном месяце (`paidAt` в UTC диапазоне месяца).
- Роялти к оплате в HQ: `5%` от выручки.
- Валюта отчетов: `RUB`.
