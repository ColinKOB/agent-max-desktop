# Contracts (Desktop)

- Purpose: Hold contract mirrors or schemas that describe backend responses used by the desktop app.
- Source of truth: Backend (`Agent_Max`) models and OpenAPI/JSON Schema.
- Runtime note: Files here are not loaded by the desktop app; they exist for documentation and potential code generation.

## Feature Flags
- `feature_flags.py` is a direct mirror of the backend Pydantic model (reference only).
- Run `npm run contracts:sync` from `agent-max-desktop/` to:
  - Export JSON Schema from the backend model
  - Generate `src/types/featureFlags.ts` consumed by the desktop code
  - Update `docs/contracts/feature_flags.schema.json` for documentation

Notes
- The sync script requires Python with `pydantic` available (per backend requirements). If unavailable, it will reuse the checked-in schema and regenerate TypeScript types from that copy.
  - Source-of-truth stays the backend model; run `pip install -r Agent_Max/requirements.txt` (or activate the existing venv) before syncing to keep the schema fresh.
