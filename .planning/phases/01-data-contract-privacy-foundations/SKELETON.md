# Walking Skeleton — Flow (Personal Wellness OS)

**Phase:** 1
**Generated:** 2026-06-13

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

Running `flow init` creates the encrypted SQLCipher store at `data/flow.db`, applies the full Phase-1 DDL, writes one real event row through the connection factory, reads it back, and verifies a pydantic schema round-trip — proving the encrypted-store + versioned-schema foundation works end-to-end before any data flows.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language / runtime | Python 3.12 (via `uv`) | PROJECT mandate (Python + minimal JS); `uv init --app --package --python 3.12` gives src-layout + one-command setup (`uv sync`). RESEARCH verified on sandbox. |
| Data layer | SQLite + SQLCipher via `sqlcipher3-wheels` 0.5.7 | App-level AES-256 encryption at rest incl. WAL/journal sidecars (framework-alignment Learning #2). Wheel installs without compiling; verified Linux x86_64 Py 3.11/3.12. |
| Encryption enforcement | Single `DBConnectionFactory`; `PRAGMA key` is the first statement on every connection | One enforcement point — no caller ever issues `PRAGMA key`. Eliminates the unkeyed-access vector (RESEARCH Pitfall 1). |
| Private namespace | Physically separate `data/private.db` file with its own key (NOT a column flag) | Structural exclusion from export/telemetry by construction (Learning #4). One missing WHERE clause cannot leak the most sensitive data. |
| Secrets | DB keys via `FLOW_DB_KEY` / `FLOW_PRIVATE_DB_KEY` env only; never in `config.yaml`, source, or commits | The key is the entire security of the store. `pydantic-settings` env-prefix isolates secrets from committed config (PRIV-04). |
| Schema validation | `pydantic` 2.13.x models; all stream fields `Optional[T] = None`; `schema_version: Literal[N]` | Validation layer; missing-data honesty (never impute, Learning #11); frozen per-row schema versioning. |
| Config + budgets | `config.yaml` loaded by `pydantic-settings[yaml]`; `BudgetGuard` warns 80% / raises `BudgetError` 100%; usage persisted to `flow.db` `budget_usage` table | Budgets in config, enforced in code (OPS-02 / PRINCIPLES §1 Infrastructure capacity). Model tier in config, never inline (§5). |
| Event IDs | `python-ulid` 3.1.0 (26-char Crockford Base32, time-sortable) | `ORDER BY event_id` == chronological replay order. Locked decision (Learning #3). |
| Deployment target | Local-run command on a systemd-capable always-on Linux box | Local-first; `flow init` is the documented full-stack run command this phase. Scheduled jobs are Phase 2. |
| Directory layout | src-layout `src/flow/{store,schemas}`, `src/flow/config.py`, `src/flow/cli.py`; adapters live under `src/adapters/<provider>.py` (layout reserved, providers Phase 2) | `store/` is the ONLY SQL issuer; one file per external dependency (framework-alignment Architecture gate). |
| Tooling | `pytest` + `ruff` from day one; single lint config + single test runner in `pyproject.toml` | PRINCIPLES §2 Code health (one lint config, one test runner). |

## Stack Touched in Phase 1

- [x] Project scaffold (`uv` project, `pyproject.toml`, `[project.scripts] flow`, `ruff` + `pytest` config)
- [x] Routing — the `flow init` CLI command (Click group) is the one real entry point
- [x] Database — one real write AND one real read through the encrypted factory (`flow init` event round-trip)
- [x] UI — `flow init` interactive element wired to the store layer (CLI is the Phase-1 interface; web UI is Phase 2)
- [x] Deployment — documented one-command local full-stack run: `uv sync` then `uv run flow init`

## Out of Scope (Deferred to Later Slices)

> Anything that is *not* in the skeleton. Be explicit — prevents future phases from re-litigating Phase 1's minimalism.

- Garmin ingestion / sync (Phase 2 — INGEST-01..04); `src/adapters/garmin.py` is layout-reserved only, no implementation
- Readiness computation, the 21-day baseline gate logic, 6:45am delivery (Phase 2 — SIG/DLVR)
- Heartbeat alerting and scheduled jobs (Phase 2 — OPS-01/03)
- Weekly LLM narrative digest and the actual Anthropic call (Phase 3 — DLVR-03); only the budget *config keys* exist now
- Export / delete commands (Phase 5 — PRIV-03); store design must not preclude excluding `private.db` from export
- Web/PWA log UI, ntfy, healthchecks (Phase 2)
- `private.db` is created/keyed and isolation-tested, but no private events are written this phase

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Daily Garmin sync → baseline-gated 6:45am readiness signal → ≤6-tap evening log + disagreement tap → heartbeat-monitored schedule + Sunday digest (soaks 4 weeks)
- Phase 3: Lifestyle-stream logging + pre-registered single-variable experiment engine + weekly LLM narrative
- Phase 4: Private practice-consistency markers + schedule-aware suggestions + disagreement-driven formula tuning
- Phase 5: Verified export/delete + yearly review report
