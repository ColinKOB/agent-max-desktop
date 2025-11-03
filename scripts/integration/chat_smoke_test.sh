#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
API_URL="$(grep -E '^VITE_API_URL=' "$ROOT_DIR/.env.production" | sed 's/VITE_API_URL=//')"
API_KEY="$(grep -E '^VITE_API_KEY=' "$ROOT_DIR/.env.production" | sed 's/VITE_API_KEY=//')"

MESSAGE=${1:-"Hello from Agent Max Desktop chat smoke test"}
SESSION_ID=${2:-"desktop_e2e_chat_smoke"}

if [[ -z "$API_URL" || -z "$API_KEY" ]]; then
  echo "❌ Missing API_URL or API_KEY. Ensure .env.production contains VITE_API_URL and VITE_API_KEY." >&2
  exit 1
fi

# Try v2 JSON chat first
PRIMARY_ENDPOINT="$API_URL/api/v2/chat/message"
LEGACY_ENDPOINT="$API_URL/api/chat/message"

TMP_RESP="$(mktemp)"
HTTP_CODE=$(curl -sS -o "$TMP_RESP" -w "%{http_code}" -X POST \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $API_KEY" \
  -d "{\"message\":\"$MESSAGE\",\"session_id\":\"$SESSION_ID\",\"include_context\":true}" \
  "$PRIMARY_ENDPOINT")

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅ v2 chat OK ($PRIMARY_ENDPOINT)" >&2
  cat "$TMP_RESP"
  rm -f "$TMP_RESP"
  exit 0
fi

echo "ℹ️ v2 chat returned $HTTP_CODE, trying legacy: $LEGACY_ENDPOINT" >&2
HTTP_CODE2=$(curl -sS -o "$TMP_RESP" -w "%{http_code}" -X POST \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $API_KEY" \
  -d "{\"message\":\"$MESSAGE\",\"session_id\":\"$SESSION_ID\",\"include_context\":true}" \
  "$LEGACY_ENDPOINT")

if [[ "$HTTP_CODE2" == "200" ]]; then
  echo "✅ legacy chat OK ($LEGACY_ENDPOINT)" >&2
  cat "$TMP_RESP"
  rm -f "$TMP_RESP"
  exit 0
fi

echo "❌ Chat failed. v2 status: $HTTP_CODE, legacy status: $HTTP_CODE2" >&2
cat "$TMP_RESP" >&2 || true
rm -f "$TMP_RESP"
exit 1
