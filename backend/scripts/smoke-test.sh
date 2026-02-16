#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3001}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
TENANT_ID="${TENANT_ID:-}"

if [[ -z "$EMAIL" || -z "$PASSWORD" || -z "$TENANT_ID" ]]; then
  echo "Usage: EMAIL=... PASSWORD=... TENANT_ID=... $0"
  exit 1
fi

echo "[1/4] login"
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken')

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "Login failed"
  exit 1
fi

echo "[2/4] bikes"
curl -s -X GET "$API/bikes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: $TENANT_ID" >/dev/null

echo "[3/4] payments"
curl -s -X GET "$API/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: $TENANT_ID" >/dev/null

echo "[4/4] weekly debts"
curl -s -X GET "$API/weekly-payments/debts?overdueOnly=false" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: $TENANT_ID" >/dev/null

echo "Smoke test passed"
