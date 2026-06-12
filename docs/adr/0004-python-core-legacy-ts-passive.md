# ADR 0004 — Wellness OS in Python; legacy TypeScript habit tracker goes Passive

- **Decision:** The Flow wellness OS is built fresh under `src/` in Python + SQLite per PRINCIPLES (small core language set, no heavy orchestrators). The pre-existing TS/React/Mongo habit tracker (`backend/`, `frontend/`) is frozen Passive: critical isolated fixes only, no feature work.
- **Context:** SPEC describes a different product than the legacy code; OPERATIONS Rule 3 allows one Active stream; PRINCIPLES mandates Python + minimal JS.
- **Alternatives rejected:** extending the TS app (wrong data model, violates language-set rule), deleting it now (it's deployed and harmless as Passive).
- **Consequence:** new code never imports from `backend/`/`frontend/`; retirement decision deferred to a future ADR once the readiness loop runs.
- **Open question (R2R):** whether the 6-tap evening log reuses the deployed frontend shell or ships as CLI-first — decide in Phase 1 planning.
