# Framework Alignment: Flow — Personal Wellness OS

**Status:** Planning V1 | **Archetype:** Multi-Stream Feedback
**Target Time-to-Validation:** 48h for the loop's plumbing (sync → log →
next-morning signal); 21 days for signal *quality* (baseline gate — no
recommendation before ≥14 valid days of 21).
**Coordination archetype:** single-agent — justified by: not decomposable
at 1-user scale, the readiness path must be deterministic (LLM appears
only in the weekly digest), and global context (one operator, one store)
fits one agent.

> Default to single-agent. Only go multi-agent if the task is decomposable
> AND a verifier gates all outputs (uncoordinated swarms amplify errors
> ~17x; orchestrated ~4x — arXiv 2512.08296). Flow stays single-agent:
> prior art reviewed in `.planning/research/PRIOR-ART-multiagent-gcp.md`
> shows the multi-agent version of this exact product needed SRE
> guardrails against its own agents.

-----

## 1. The Loop

|Stage               |What it is for this project                               |
|--------------------|----------------------------------------------------------|
|**Sense** (input)   |Daily Garmin Connect pull (HRV status, sleep stages, Body Battery, Training Readiness, stress, activities, resting HR) + ≤6-tap evening log (sauna y/n + duration + HR-recovery note, perceived readiness 1–5, optional note)|
|**Decide** (process)|Versioned pure-function readiness formula over 21-day rolling baselines; degrades gracefully per missing stream, never imputes|
|**Act** (output)    |One-line signal + one suggested emphasis ("green — quality day for 4×4" / "amber — Zone 2 or yoga only"), delivered 6:45am|
|**Measure** (impact)|One-tap "signal felt wrong today" disagreement log + weekly recovery-marker trends (HRV trend, Body Battery overnight refill, sleep consistency)|
|**Improve** (update)|Sunday digest reviews disagreements; formula weights tuned in versioned config (every change annotated on charts); ONE pre-registered single-variable experiment at a time|

-----

## 2. Platform Split + Handoff Contract

**Google AI Plus (Gemini) — research & knowledge**

- Inputs it owns: training-science and recovery literature, Garmin
  data-field documentation, experiment-design background reading
- Tasks it owns: deep research and long-document synthesis feeding
  experiment hypotheses and formula-design decisions

**Claude Code — execution & production**

- Owns: GSD orchestration (`/gsd-plan-phase` → `/gsd-execute-phase` →
  `/gsd-verify-work`), all file writes, schema validation, tests.
- Compute boundary: local stateless runs; SQLite (SQLCipher) under
  `data/`; one scheduled Garmin sync/day + on-demand; LLM calls only for
  the weekly digest.

**Handoff contract:**

- Gemini output lands as: markdown files
- Delivered to: `research/inbox/` in the repo (operator copies manually)
- Claude Code consumes it via: reads `research/inbox/*.md` at plan time;
  never fetches from Drive or the web for operator research
- Cadence: on-demand before planning sessions and before each new
  experiment registration

-----

## 3. Architecture Gates (one line each)

- **Abstraction:** every external service lives in one adapter module —
  `ingest/garmin.py`, `delivery/ntfy.py`, `digest/llm.py`; swapping a
  provider touches exactly one file (Open Wearables later = new adapter
  behind the same ingest interface).
- **Isolation:** idempotent runs (`flow sync`, `flow recompute` safe to
  re-run); durable state only in `data/flow.db` + physically separate
  `data/private.db`; zero secrets in source or logs (env only); derived
  tables rebuilt transactionally, never hand-edited.
- **Validation:** golden test set of 20–30 synthetic days (including
  missing-stream and bad-sync days) before any feature merges; signals
  are pure functions over the store; every score shows inputs +
  freshness; 21-day baseline gate is structural (`n_valid_days ≥ 14`).
  *(Drift-threshold blockers: deferred to Phase 2, once a baseline exists.)*
- **Capacity:** ≤5 min/scheduled job · ≤$2.00 CAD/day across vendors ·
  LLM ≤1 narrative call/week · warn at 80% of any budget, hard-block at
  100% in code (not prompts).

-----

## 4. Codified Learnings (binding for implementation)

From `.planning/research/` (STACK, ARCHITECTURE, FEATURES, PITFALLS,
PRIOR-ART) — these are commitments, not suggestions; deviations need an
ADR:

1. **Garmin access:** community `garminconnect` library with persisted
   auto-refreshing tokens — the official Health API excludes personal
   use (legal entity + fees; Phase 5 question). `garth` is
   deprecated/broken. Single-file adapter contains the blast radius.
2. **Storage:** SQLite + SQLCipher (AES-256 at rest); raw Garmin pulls
   keyed `(stream, metric_date, payload_hash)` for re-pull idempotency.
3. **One events table** for all manual logs: ULID id, `event_type`,
   `occurred_on`, `schema_version`, JSON payload, `supersedes` for
   append-only corrections — all phases, zero migrations.
4. **Private namespace = separate database file** (`data/private.db`),
   not a column flag; excluded from export/telemetry paths by
   construction.
5. **Full idempotent recompute** over incremental state — derived tables
   replaced transactionally each run; correct-by-rebuild at 1-user scale.
6. **Readiness formulas live in a frozen versioned registry**;
   `formula_version` stamped on every score row; trend-chart annotations
   come from version changes.
7. **"Signature to the LLM":** the signals layer computes all
   trends/aggregates deterministically; the weekly digest LLM call
   receives only those compact numbers to narrate — it can never invent
   data it wasn't given.
8. **Scheduling:** systemd timers (`Persistent=true`) + self-hosted
   Healthchecks heartbeat wrapping every job — a silent failure >24h is
   a postmortem, per PRINCIPLES.
9. **Delivery:** ntfy for the 6:45am one-liner; FastAPI + HTMX PWA for
   the 6-tap log (Telegram bot is the documented fallback, with its
   privacy tradeoff noted).
10. **No LLM in the daily decision path, ever.** The morning signal is
    deterministic and replayable; LLM = weekly narration only.
11. **Missing-data honesty:** a missing stream lowers confidence and is
    shown ("sauna log missing") — never imputed.
12. **Logging friction is bottleneck #1:** the kill criterion (>3 min/day
    or 10 skipped days/month) is instrumented from Phase 1 — skipped-log
    analysis is a first-class feedback loop, not an afterthought.

-----

## 5. Phase 1 Checklist

- [x] Repo initialized with this doc at `docs/framework-alignment.md`
- [ ] `config.yaml` created with initial data contracts + budget values
- [x] Handoff directory created (`research/inbox/`)
- [x] GSD installed — **note:** `get-shit-done-cc` is deprecated; the
      trusted package is `@opengsd/get-shit-done-redux` (open-gsd)
- [ ] This doc + SPEC.md + PRINCIPLES.md fed into `/gsd-plan-phase`
- [ ] After planning: note below what the planner ignored → delete it
      from the template before copying to the next repo

**Planner feedback (fill after first /gsd-plan-phase run):**

- Sections used:
- Sections ignored:
