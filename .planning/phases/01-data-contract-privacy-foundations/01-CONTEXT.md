# Phase 1: Data Contract & Privacy Foundations - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning
**Source:** PRD Express Path (SPEC.md + docs/framework-alignment.md + OPERATIONS.md + PRINCIPLES.md)

<domain>
## Phase Boundary

Every expensive-to-change decision is made, recorded, and enforced in code
before any data flows: encrypted local storage, versioned stream schemas,
physically separate private namespace, secrets discipline, and budget
guards. Corresponds to SPEC Phase 0 (data contract + privacy ADR). No
Garmin ingestion, no readiness computation, no delivery — those are
Phase 2. This phase may (Walking Skeleton) prove the store end-to-end with
a trivial write/read through the real encrypted database.

</domain>

<decisions>
## Implementation Decisions

### Storage & Encryption
- SQLite + SQLCipher (AES-256 at rest) via `sqlcipher3`/`sqlcipher3-wheels`; app-level encryption, not filesystem-only (framework-alignment Codified Learning #2)
- Main store at `data/flow.db`; spiritual-practice namespace is a physically separate `data/private.db` file, never a column flag (Learning #4)
- `PRAGMA key` must be the first statement on every connection — one connection factory owns this
- Raw Garmin pulls table keyed `(stream, metric_date, payload_hash)` for re-pull idempotency (Learning #2) — schema defined now, populated in Phase 2
- One universal `events` table for all manual logs: ULID id, `event_type`, `occurred_on`, `schema_version`, JSON payload, `supersedes` for append-only corrections (Learning #3)
- Derived tables rebuilt transactionally by idempotent recompute; never hand-edited (Learning #5)
- Encryption verification is testable: opening the DB file without the key yields ciphertext, including WAL/journal sidecars

### Schemas & Validation
- Versioned pydantic schemas for every Phase 1 stream (7 Garmin streams: HRV status, sleep stages, Body Battery, Training Readiness, stress, activities, resting HR + manual-log events) BEFORE any ingestion code (DATA-01)
- Golden set foundation: 21 synthetic day-payloads with expected outcomes (framework-alignment Validation gate) — fixture format established this phase
- Missing-data honesty: schemas must represent absent streams explicitly, never impute (Learning #11)

### Secrets & Privacy
- No secrets in source, commits, or logs; env-only (PRINCIPLES §2 Security; PRIV-04)
- Garmin tokens will persist OUTSIDE the repo in an app-owned data dir with restricted permissions (location decided here, used in Phase 2)
- No third-party analytics anywhere; export path excludes `private.db` by default (PRIV-02)
- PII never logged

### ADRs (DATA-02) — 5-line format per PRINCIPLES §2
- ADR: Garmin access via community `garminconnect` library (official Health API excludes personal use — legal-entity application + license fees; `garth` deprecated/broken; per-run logins risk 48h+ account lockouts)
- ADR: Encryption choice (SQLCipher app-level vs filesystem-only; record the `sqlcipher3-wheels` platform-coverage validation result — flagged MEDIUM confidence in research)
- ADR: Private-namespace isolation design (separate DB file, export/telemetry exclusion by construction)

### Budgets (OPS-02)
- All budgets in `config.yaml`: runtime ceiling per job (≤5 min), API call caps (1 Garmin sync/day + on-demand), LLM spend (≤$0.50 CAD/day, ≤1 narrative call/week)
- Enforced by code-level guards: warn at 80%, hard-block at 100% — in code, not prompts (OPERATIONS Rule 1 spirit; Learning #13 context)
- Model tier assignments live in config, never inline (PRINCIPLES §5)

### Project Layout & Tooling
- Python 3.12+; `uv` for env + deps (one-command setup `uv sync`); pytest + ruff from day one (single lint config, single test runner)
- Adapters pattern: `src/adapters/<provider>.py` — one file per external service (framework-alignment Architecture gate; implemented progressively, layout established now)
- Plain Python + SQLite — no heavy orchestrators (OPERATIONS Do-Not-Do #1)
- New dependencies need an ADR (PRINCIPLES §2)

### Claude's Discretion
- Exact pydantic model organization and naming
- Migration/versioning mechanics for `schema_version`
- Test layout and fixture format details
- Connection-factory API shape
- Whether `config.yaml` loading uses pydantic-settings (research-recommended) or stdlib

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & principles
- `SPEC.md` — vision, hard constraints, SPEC Phase 0 definition, four-layer architecture
- `PRINCIPLES.md` — non-negotiable engineering principles (layers, ADRs, security, budgets)
- `OPERATIONS.md` — portfolio rules (forced-choice outputs, AOR, no heavy orchestrators)
- `docs/framework-alignment.md` — binding implementation commitments (13 codified learnings, architecture gates, capacity budgets)

### Research
- `.planning/research/STACK.md` — library versions and rationale (sqlcipher3, garminconnect)
- `.planning/research/ARCHITECTURE.md` — store schema design, events table, recompute model
- `.planning/research/PITFALLS.md` — Garmin auth fragility, encryption mistakes, silent failures
- `.planning/research/SUMMARY.md` — synthesis + phase flags

</canonical_refs>

<specifics>
## Specific Ideas

- Phase success criterion 1 is operator-verifiable: `file data/flow.db` /
  hexdump shows ciphertext without the key
- The 21-day baseline gate (`n_valid_days ≥ 14`) is Phase 2 logic, but the
  schema fields that make it computable (valid-day flags, freshness
  timestamps) are part of this phase's data contract
- Walking Skeleton slice: one `flow init` + trivial encrypted write/read +
  one passing schema-validation test proves the foundation end-to-end

</specifics>

<deferred>
## Deferred Ideas

- Garmin ingestion implementation (Phase 2 — INGEST-01..04)
- Readiness computation, delivery, heartbeats (Phase 2)
- Export/delete commands (Phase 5 — PRIV-03; but store design must not preclude them)
- Open Wearables adapter (v2)

</deferred>

---

*Phase: 01-data-contract-privacy-foundations*
*Context gathered: 2026-06-11 via PRD Express Path*
