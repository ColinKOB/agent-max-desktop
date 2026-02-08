# Agent Max Desktop — Documentation

> **Last updated:** February 2026 | **Version:** 1.3.5 (v2.0 "Clarity")

## Quick Start

1. **New to the project?** [guides/START_HERE.md](./guides/START_HERE.md)
2. **Installation:** [guides/INSTALLATION.md](./guides/INSTALLATION.md)
3. **Build & deploy:** [guides/DEPLOYMENT_GUIDE.md](./guides/DEPLOYMENT_GUIDE.md)
4. **Architecture overview:** [planning/Codebase_Overview.md](./planning/Codebase_Overview.md)

---

## Guides

| Doc | Purpose |
|-----|---------|
| [START_HERE](./guides/START_HERE.md) | Orientation and quick start |
| [INSTALLATION](./guides/INSTALLATION.md) | Detailed installation steps |
| [BUILD_GUIDE](./guides/BUILD_GUIDE.md) | Building the application |
| [DEPLOYMENT_GUIDE](./guides/DEPLOYMENT_GUIDE.md) | Production deployment |
| [DISTRIBUTION_GUIDE](./guides/DISTRIBUTION_GUIDE.md) | Packaging installers (macOS/Win/Linux) |
| [DISTRIBUTION_EXPLAINED](./guides/DISTRIBUTION_EXPLAINED.md) | Why Docker isn't needed; architecture diagram |
| [DEBUGGING_GUIDE](./guides/DEBUGGING_GUIDE.md) | Electron DevTools, console commands, common errors |
| [FLOATBAR_README](./guides/FLOATBAR_README.md) | FloatBar UI component documentation |
| [GOOGLE_INTEGRATION_GUIDE](./guides/GOOGLE_INTEGRATION_GUIDE.md) | Google OAuth, Gmail, Calendar, Docs, YouTube setup |
| [INTEGRATION_GUIDE](./guides/INTEGRATION_GUIDE.md) | Memory Vault wiring into main app |
| [UI_CUSTOMIZATION_GUIDE](./guides/UI_CUSTOMIZATION_GUIDE.md) | CSS variable customization |
| [COMPONENT_MIGRATION_GUIDE](./guides/COMPONENT_MIGRATION_GUIDE.md) | UI rebrand component migration pattern |
| [QUICK_START_CHECKLIST](./guides/QUICK_START_CHECKLIST.md) | UI rebrand implementation checklist |

---

## Architecture

| Doc | Purpose |
|-----|---------|
| [MEMORY_VAULT_IMPLEMENTATION](./architecture/MEMORY_VAULT_IMPLEMENTATION.md) | SQLite memory vault with encryption, decay, reinforcement |
| [SMART_CACHE_SYSTEM](./architecture/SMART_CACHE_SYSTEM.md) | Frequency-based caching (replaces basic cache) |
| [CACHE_ARCHITECTURE_AND_DEPLOYMENT](./architecture/CACHE_ARCHITECTURE_AND_DEPLOYMENT.md) | Dual-layer cache + deployment options |
| [HYBRID_MODE_SUMMARY](./architecture/HYBRID_MODE_SUMMARY.md) | Conversation/execution mode switching |
| [REAL_TIME_STEP_STREAMING](./architecture/REAL_TIME_STEP_STREAMING.md) | SSE streaming for AI steps |
| [CONVERSATION_SUMMARY_FEATURE](./architecture/CONVERSATION_SUMMARY_FEATURE.md) | 5-word conversation summaries |
| [SECTION3_BACKEND_INTEGRATION_ANALYSIS](./architecture/SECTION3_BACKEND_INTEGRATION_ANALYSIS.md) | Backend integration roadmap (40% complete) |
| [WIRING_FIXES](./architecture/WIRING_FIXES.md) | Memory Vault security hardening (90% complete) |

---

## Design

| Doc | Purpose |
|-----|---------|
| [BRAND_GUIDE](./design/BRAND_GUIDE.md) | Typography, colors, spacing, components, accessibility |
| [GLASS_DESIGN_SYSTEM](./design/GLASS_DESIGN_SYSTEM.md) | Glass morphism philosophy, CSS vars, layer hierarchy, effect reference |
| [CURRENT_UI_UX_STATE](./design/CURRENT_UI_UX_STATE.md) | Production UI baseline (Oct 2025) |
| [UI_REBRAND_SUMMARY](./design/UI_REBRAND_SUMMARY.md) | Light theme transformation roadmap |
| [UI_IMPLEMENTATION_ROADMAP](./design/UI_IMPLEMENTATION_ROADMAP.md) | 10-phase UI implementation plan |
| [UI_IMPROVEMENTS](./design/UI_IMPROVEMENTS.md) | UI improvement history |
| [UX_IMPROVEMENT_PLAN](./design/UX_IMPROVEMENT_PLAN.md) | Active UX roadmap with KPIs |
| [SETTINGS_WINDOW_REDESIGN](./design/SETTINGS_WINDOW_REDESIGN.md) | Standalone settings window architecture |

---

## Planning

| Doc | Purpose |
|-----|---------|
| [Codebase_Overview](./planning/Codebase_Overview.md) | Architectural map of the entire app |
| [Feature_Status](./planning/Feature_Status.md) | Feature matrix — what's done, what's pending |
| [System_Integration](./planning/System_Integration.md) | Desktop-backend integration flows |
| [Backend_Railway_Overview](./planning/Backend_Railway_Overview.md) | FastAPI backend on Railway — config, endpoints, verification |
| [Known_Issues_and_Risks](./planning/Known_Issues_and_Risks.md) | Active risk tracker |
| [CODE_IMPROVEMENT_PLAN](./planning/CODE_IMPROVEMENT_PLAN.md) | Code quality improvement tracker |
| [MEMORY_SPEED_OPTIMIZATION_PLAN](./planning/MEMORY_SPEED_OPTIMIZATION_PLAN.md) | Memory performance optimization |
| [Repo_Structure_Migration_2025-11-10](./planning/Repo_Structure_Migration_2025-11-10.md) | Staged repo restructuring |
| [Legacy_Code_Audit_2025-11-06](./planning/Legacy_Code_Audit_2025-11-06.md) | Dead code identification |
| [PERSONALIZED_ONBOARDING_PLAN](./planning/PERSONALIZED_ONBOARDING_PLAN.md) | Personalized onboarding architecture |
| [FRONTEND_AUTONOMOUS_INTEGRATION_GUIDE](./planning/FRONTEND_AUTONOMOUS_INTEGRATION_GUIDE.md) | Autonomous execution event contract |
| [Thought_Trace_UI](./planning/Thought_Trace_UI.md) | Live reasoning bubble feature |
| [Auth_Onboarding_Update](./planning/Auth_Onboarding_Update.md) | Onboarding flow updates |

**Completed milestones** (reference only):
[Backend_Fixes_Summary](./planning/Backend_Fixes_Summary.md) |
[Backend_Fixes_COMPLETE](./planning/Backend_Fixes_COMPLETE.md) |
[Backend_Fire_Test_Results](./planning/Backend_Fire_Test_Results.md) |
[Autonomous_Streaming_Integration_Complete](./planning/Autonomous_Streaming_Integration_Complete.md) |
[Autonomous_Tool_Execution_Integration_Complete](./planning/Autonomous_Tool_Execution_Integration_Complete.md) |
[Desktop_Side_Execution_IMPLEMENTATION_SUMMARY](./planning/Desktop_Side_Execution_IMPLEMENTATION_SUMMARY.md) |
[Desktop_Autonomous_Endpoint_Fix](./planning/Desktop_Autonomous_Endpoint_Fix.md) |
[Desktop_Pill_Render_Fix_2025-11-11](./planning/Desktop_Pill_Render_Fix_2025-11-11.md) |
[Desktop_Embeddings_and_Credits_Fix_2025-11-09](./planning/Desktop_Embeddings_and_Credits_Fix_2025-11-09.md) |
[Tool_Execution_Quick_Test](./planning/Tool_Execution_Quick_Test.md)

---

## Phases

| Doc | Purpose |
|-----|---------|
| [MASTER_ROADMAP](./phases/MASTER_ROADMAP.md) | Overall project roadmap |
| [PHASE_1_DESIGN_TOKENS](./phases/PHASE_1_DESIGN_TOKENS.md) | Phase 1: Design system |
| [PHASE2_PROGRESS](./phases/PHASE2_PROGRESS.md) | Phase 2: Progress |
| [PHASE3_PLAN](./phases/PHASE3_PLAN.md) | Phase 3: Search & Quick Switcher |
| [PHASE4_OVERVIEW](./phases/PHASE4_OVERVIEW.md) | Phase 4: Overview |
| [DESKTOP_FEATURES_IMPLEMENTED](./phases/DESKTOP_FEATURES_IMPLEMENTED.md) | Desktop features status |
| [DESKTOP_FEATURES_PLAN](./phases/DESKTOP_FEATURES_PLAN.md) | Desktop features planning |
| [NEXT_CATEGORY_UI_UX](./phases/NEXT_CATEGORY_UI_UX.md) | Next UI/UX priorities |

---

## Implementation

| Doc | Purpose |
|-----|---------|
| [IMPLEMENTATION_STATUS](./implementation/IMPLEMENTATION_STATUS.md) | Master status (15/15 Supabase tests passing) |
| [USER_FLOW_IMPLEMENTATION](./implementation/USER_FLOW_IMPLEMENTATION.md) | Full user flow: download to credit usage |
| [HYBRID_MEMORY_IMPLEMENTATION](./implementation/HYBRID_MEMORY_IMPLEMENTATION.md) | Local + Supabase hybrid search |
| [MEMORY_INVENTORY](./implementation/MEMORY_INVENTORY.md) | Complete memory API/localStorage/Supabase map |
| [MEMORY_AND_HISTORY_STATUS](./implementation/MEMORY_AND_HISTORY_STATUS.md) | Memory features status + semantic search details |
| [API_KEYS_STATUS](./implementation/API_KEYS_STATUS.md) | API key configuration reference |
| [SUPABASE_SETUP_STATUS](./implementation/SUPABASE_SETUP_STATUS.md) | Database schema and migration status |
| [EXECUTION_PLAN_INTEGRATION](./implementation/EXECUTION_PLAN_INTEGRATION.md) | Execution plan frontend integration (partial) |
| [STREAMING_FIX_SUMMARY](./implementation/STREAMING_FIX_SUMMARY.md) | Token streaming implementation |
| [SETTINGS_GLASSMORPHISM_UPDATE](./implementation/SETTINGS_GLASSMORPHISM_UPDATE.md) | Settings glass morphism spec + comparison |
| [UNFINISHED_TASKS_REVIEW](./implementation/UNFINISHED_TASKS_REVIEW.md) | Remaining P0 tasks |
| [PROOF_OF_HYBRID_SEARCH_SUPERIORITY](./implementation/PROOF_OF_HYBRID_SEARCH_SUPERIORITY.md) | Search benchmark results |

**Feature-specific:** [EMAIL_APPROVAL_IMPROVEMENTS](./implementation/EMAIL_APPROVAL_IMPROVEMENTS.md) | [SCREENSHOT_PERMISSION_FIX](./implementation/SCREENSHOT_PERMISSION_FIX.md) | [AMBIGUITY_API_ERROR_FIX](./implementation/AMBIGUITY_API_ERROR_FIX.md) | [MEMORY_INTEGRATION_PATCH](./implementation/MEMORY_INTEGRATION_PATCH.md)

**Test checklists:** [MANUAL_TEST_CHECKLIST](./implementation/MANUAL_TEST_CHECKLIST.md) | [PHASE2_MANUAL_TEST_CHECKLIST](./implementation/PHASE2_MANUAL_TEST_CHECKLIST.md) | [MEMORY_TEST_INSTRUCTIONS](./implementation/MEMORY_TEST_INSTRUCTIONS.md) | [CREDIT_DEDUCTION_TEST_GUIDE](./implementation/CREDIT_DEDUCTION_TEST_GUIDE.md) | [STRIPE_INTEGRATION_TEST](./implementation/STRIPE_INTEGRATION_TEST.md) | [TEST_RESULTS](./implementation/TEST_RESULTS.md)

---

## Fixes

| Doc | Issue Resolved |
|-----|----------------|
| [ELECTRON_VIBRANCY_FIX](./fixes/ELECTRON_VIBRANCY_FIX.md) | Vibrancy architecture + related opacity/backdrop fixes |
| [GRAY_BACKGROUND_FIX](./fixes/GRAY_BACKGROUND_FIX.md) | Design token incompatibility with glass |
| [GOOGLE_OAUTH_FIX](./fixes/GOOGLE_OAUTH_FIX.md) | Redirect URI mismatch + success page |
| [CLIENT_SECRET_FIX](./fixes/CLIENT_SECRET_FIX.md) | OAuth token exchange requires client_secret |
| [OAUTH_TOKEN_EXCHANGE_FIX](./fixes/OAUTH_TOKEN_EXCHANGE_FIX.md) | State cleared by auto-reload |
| [GOOGLE_SERVICES_TEST_FIX](./fixes/GOOGLE_SERVICES_TEST_FIX.md) | Corrected API endpoints |
| [GOOGLE_AND_HISTORY_FIX](./fixes/GOOGLE_AND_HISTORY_FIX.md) | Cross-window connection persistence |
| [HISTORY_AND_PERSISTENCE_FIX](./fixes/HISTORY_AND_PERSISTENCE_FIX.md) | Unlimited history storage architecture |
| [PREFERENCE_VALIDATION_FIX](./fixes/PREFERENCE_VALIDATION_FIX.md) | Empty name submission prevention |

---

## Testing

| Doc | Purpose |
|-----|---------|
| [DEEP_TESTING_REPORT](./testing/DEEP_TESTING_REPORT.md) | Comprehensive code review (5 critical bugs found/fixed) |
| [TESTING_STATUS_SUMMARY](./testing/TESTING_STATUS_SUMMARY.md) | Current testing status |
| [VIBRANCY_TEST_MODES](./testing/VIBRANCY_TEST_MODES.md) | Vibrancy mode testing |
| [SHADOW_FIX_TEST_INSTRUCTIONS](./testing/SHADOW_FIX_TEST_INSTRUCTIONS.md) | Shadow fix verification |
| [TRANSPARENCY_FIX_TEST_PLAN](./testing/TRANSPARENCY_FIX_TEST_PLAN.md) | Transparency fix verification |

---

## Project Status & Checklists

| Doc | Purpose |
|-----|---------|
| [PROJECT_SUMMARY](./PROJECT_SUMMARY.md) | Full project overview (endpoints, structure, deps) |
| [IMPLEMENTATION_SUMMARY](./IMPLEMENTATION_SUMMARY.md) | v2.0 UX overhaul: 13 features, 19 telemetry events |
| [INTEGRATION_SUMMARY](./INTEGRATION_SUMMARY.md) | Stop/Continue backend integration |
| [FINAL_STATUS](./FINAL_STATUS.md) | v2.0 completion summary |
| [SESSION_SUMMARY](./SESSION_SUMMARY.md) | Development session record |
| [BETA_READINESS](./BETA_READINESS.md) | Auto-updater, code signing, billing readiness |
| [PRODUCTION_CHECKLIST](./PRODUCTION_CHECKLIST.md) | 10 production hardening items |
| [SHIP_CHECKLIST](./SHIP_CHECKLIST.md) | Pre-deployment v2.0 checklist |
| [VERIFICATION_CHECKLIST](./VERIFICATION_CHECKLIST.md) | Phase 1-2 acceptance criteria |
| [BEST_PRACTICES_AUDIT](./BEST_PRACTICES_AUDIT.md) | Quality audit (85/100) |
| [BEST_PRACTICES_IMPLEMENTATION](./BEST_PRACTICES_IMPLEMENTATION.md) | Quality improvements (85 to 92/100) |
| [RELEASE_NOTES_v2.0](./RELEASE_NOTES_v2.0.md) | Public-facing v2.0 release notes |

---

## Other

| Doc | Purpose |
|-----|---------|
| [MONETIZATION_SETUP](./MONETIZATION_SETUP.md) | Stripe pricing, webhooks, tax setup |
| [SUPABASE_INTEGRATION_GUIDE](./SUPABASE_INTEGRATION_GUIDE.md) | Unified data schema with RLS |
| [CONNECTIVITY_ROADMAP](./CONNECTIVITY_ROADMAP.md) | Frontend-backend connectivity via Railway |
| [TELEMETRY_PIPELINE](./TELEMETRY_PIPELINE.md) | Beta telemetry collection config |
| [AGENT_MAX_INTEGRATION_ANALYSIS](./AGENT_MAX_INTEGRATION_ANALYSIS.md) | Integration gap analysis |
| [CAPABILITY_AUDIT](./CAPABILITY_AUDIT.md) | Advertised vs actual capabilities |
| [CODEBASE_ORGANIZATION_ANALYSIS](./CODEBASE_ORGANIZATION_ANALYSIS.md) | Code org + packaging readiness |
| [SECURITY_AUDIT_REPORT](./SECURITY_AUDIT_REPORT.md) | Security findings |
| [SECURITY_CONFIGURATION_GUIDE](./SECURITY_CONFIGURATION_GUIDE.md) | Security fix implementation guide |
| [QUICK_ANSWERS](./QUICK_ANSWERS.md) | FAQ |
| [QUICK_REFERENCE](./QUICK_REFERENCE.md) | UI rebrand color/token reference |
| [CHANGES_QUICK_REF](./CHANGES_QUICK_REF.md) | Code change quick reference |
| [contracts/README](./contracts/README.md) | Backend response contract schemas |
| [GPT-5-Docs/OpenAI_GPT-5_Pricing_Updated_2025](./GPT-5-Docs/OpenAI_GPT-5_Pricing_Updated_2025.md) | GPT-5 pricing reference |
