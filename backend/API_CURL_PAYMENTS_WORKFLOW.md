# API CURL — Manual payments workflow

Все endpoint tenant-scoped: нужен `X-Tenant-Id`.

## 1) Список платежей (все)

```bash
curl -X GET "http://localhost:3001/payments" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"
```

## 2) Фильтры

```bash
# только плановые недельные начисления
curl -X GET "http://localhost:3001/payments?status=PLANNED&kind=WEEKLY_RENT" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"

# по клиенту
curl -X GET "http://localhost:3001/payments?clientId=<CLIENT_ID>" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"
```

## 3) Отметить оплату вручную

```bash
curl -X POST "http://localhost:3001/payments/<PAYMENT_ID>/mark-paid" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"
```

## 4) Вернуть платеж в статус PLANNED

```bash
curl -X POST "http://localhost:3001/payments/<PAYMENT_ID>/mark-planned" \
-H "Authorization: Bearer $TOKEN" \
-H "X-Tenant-Id: <TENANT_ID>"
```
