# Framework Alignment: Flow — Personal Wellness OS

**Status:** Planning V1 | **Archetype:** Multi-Stream Feedback
**Target Time-to-Validation:** 24h (first morning signal lands and gets an
agree/disagree); signal *quality* gate is separate — 21-day baseline with
≥14 valid days before recommendations carry weight.
**Coordination archetype:** single-agent — sequential pipeline (pull →
compute → deliver); no decomposable parallel work; unified context wins.

> Default to single-agent. Only go multi-agent if the task is decomposable
> AND a verifier gates all outputs (uncoordinated swarms amplify errors
> ~17x; orchestrated ~4x — arXiv 2512.08296). Per OPERATIONS.md Rule 1,
> adversarial two-agent review is scoped to scout only; Flow is single
> agent + output schema + operator veto as the only review layer. Prior
> art reviewed in `.planning/research/PRIOR-ART-multiagent-gcp.md` shows
> the multi-agent version of this exact product needed SRE guardrails
> against its own agents.

-----

## 1. The Loop

|Stage               |What it is for this project                               |
|--------------------|----------------------------------------------------------|
|**Sense** (input)   |Garmin Connect API nightly payload (HRV, sleep stages, Body Battery, Training Readiness, stress, activities, resting HR) + ≤6-tap evening log (sauna y/n + duration + HR-recovery note, perceived readiness 1–5, optional note)|
|**Decide** (process)|Composite readiness formula — pure function over the store; versioned weights in `config.yaml`; 21-day rolling baselines; degrades gracefully per missing stream, never imputes|
|**Act** (output)    |One forced-choice string by 6:45am: `FLOW: GREEN — 4×4 OK / AMBER — Z2-yoga only / RED — rest` + one-line reason (OPERATIONS.md Rule 1)|
|**Measure** (impact)|Agree/disagree tap logged to `metrics/loop_closure.csv` — this is the repo's AOR metric (Rule 4); vetoes append one line to `docs/codex.md`|
|**Improve** (update)|Weekly: disagreement log → weight tuning in versioned config (every change annotated on charts); ONE pre-registered single-variable experiment at a time|

-----

## 2. Platform Split + Handoff Contract

**Google AI Plus (Gemini) — research & knowledge**

- Inputs it owns: training-science literature, protocol research (Zone 2 /
  4×4 sources), Garmin metric documentation.
- Tasks it owns: deep research summaries on recovery science feeding
  formula design and experiment hypotheses.

**Claude Code — execution & production**

- Owns: GSD orchestration (`/gsd-plan-phase` → `/gsd-execute-phase` →
  `/gsd-verify-work`), Garmin OAuth adapter, store, readiness function,
  digest delivery, tests, all file writes.
- Compute boundary: local stateless runs; SQLite (SQLCipher) at
  `data/flow.db`; 1 sync/day + on-demand; LLM calls only for the weekly
  digest.

**Handoff contract:**

- Gemini output lands as: markdown research memos.
- Delivered to: `research/inbox/` in the repo (manual copy).
- Claude Code consumes via: reads `research/inbox/*.md` at plan time only;
  never fetches from Drive or the web for operator research.
- Cadence: on-demand before formula-change planning sessions and before
  each new experiment registration.

-----

## 3. Architecture Gates (one line each)

- **Abstraction:** `src/adapters/garmin.py`, `src/adapters/manual_log.py`,
  `src/adapters/notify.py`, `src/adapters/llm.py` — one file per provider;
  swapping touches exactly one file. (Adapters implement the SPEC's
  Abstraction-layer modules: ingest/garmin, ingest/manual, delivery;
  Open Wearables later = new adapter behind the same interface.)
- **Isolation:** idempotent recompute (`flow sync`, `flow recompute` safe
  to re-run); state only in `data/flow.db` + git; physically separate
  `data/private.db` for the practice namespace; secrets env-only; derived
  tables rebuilt transactionally, never hand-edited.
- **Validation:** golden set = 21 synthetic day-payloads with expected
  signals (including missing-stream and bad-sync days) before any formula
  merge; signals are pure functions over the store; every score shows
  inputs + freshness; 3-week live baseline before recommendations surface
  (`n_valid_days ≥ 14`, structural). *(Drift-threshold blockers: deferred
  to Phase 2, once a baseline exists.)*
- **Capacity:** ≤5 min/run · ≤$0.50 CAD/day LLM (weekly digest only) ·
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
   deprecated/broken. Per-run logins risk 48h+ account-level lockouts;
   the single-file adapter contains the blast radius.
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
   a postmortem, per PRINCIPLES. (No heavy orchestrators — OPERATIONS
   Do-Not-Do #1: plain Python + SQLite + scheduled jobs.)
9. **Delivery:** ntfy for the 6:45am forced-choice one-liner; FastAPI +
   HTMX PWA for the 6-tap log (Telegram bot is the documented fallback,
   with its privacy tradeoff noted).
10. **No LLM in the daily decision path, ever.** The morning signal is
    deterministic and replayable; LLM = weekly narration only.
11. **Missing-data honesty:** a missing stream lowers confidence and is
    shown ("sauna log missing") — never imputed.
12. **Logging friction is bottleneck #1:** the kill criterion (>3 min/day
    or 10 skipped days/month) is instrumented from Phase 1 — skipped-log
    analysis is a first-class feedback loop, not an afterthought.
13. **Loop closure is measured, not assumed:** AOR (% of recommendations
    acted on or vetoed within 48h) logged per Rule 4; AOR < 50% over 2
    weeks = the pipeline is noise → demote or mute.

-----

## 5. Phase 1 Checklist

- [x] Repo initialized with this doc at `docs/framework-alignment.md`
- [ ] `config.yaml` with stream schemas + formula weights v1 + budgets
- [x] `research/inbox/` created
- [x] `metrics/loop_closure.csv` + `docs/codex.md` scaffolded (Rules 1+4)
- [x] GSD installed — **note:** `get-shit-done-cc` is deprecated; the
      trusted package is `@opengsd/get-shit-done-redux` (open-gsd)
- [ ] learning-opportunities plugin installed (OPERATIONS Rule 6 — run
      `/plugin marketplace add https://github.com/DrCatHicks/learning-opportunities.git`
      then `/plugin install learning-opportunities@learning-opportunities`
      from the CLI)
- [ ] This doc + SPEC.md + PRINCIPLES.md + OPERATIONS.md fed into
      `/gsd-plan-phase`
- [ ] After planning: note below what the planner ignored → delete it
      from the template before copying to the next repo

**Planner feedback (fill after first /gsd-plan-phase run):**

- Sections used:
- Sections ignored:
