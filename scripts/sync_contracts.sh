#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$DESKTOP_DIR/.." && pwd)"

echo "[contracts] Exporting backend JSON schema..."
if ! python3 "$WORKSPACE_DIR/Agent_Max/tools/schema/export_feature_flags_schema.py"; then
  echo "[contracts] WARNING: Failed to export schema (install backend deps first)." >&2
fi

SCHEMA="$WORKSPACE_DIR/Agent_Max/schemas/json/feature_flags.schema.json"
OUT_TS="$DESKTOP_DIR/src/types/featureFlags.ts"

if [[ -f "$SCHEMA" ]]; then
  echo "[contracts] Generating TypeScript types from JSON schema..."
  python3 "$WORKSPACE_DIR/Agent_Max/tools/schema/jsonschema_to_ts.py" "$SCHEMA" FeatureFlagsResponse "$OUT_TS"
else
  echo "[contracts] WARNING: Schema not found at $SCHEMA. Skipping TS generation." >&2
fi

echo "[contracts] Done."

