# Framework Alignment: flow

**Status:** Planning V1 | **Archetype:** Multi-Stream Feedback
**Target Time-to-Validation:** 24h (first morning signal lands and gets an agree/disagree)
**Coordination archetype:** single-agent — sequential pipeline (pull → compute → deliver); no decomposable parallel work; unified context wins.

-----

## 1. The Loop

|Stage               |What it is for this project                                            |
|--------------------|-----------------------------------------------------------------------|
|**Sense** (input)   |Garmin Connect API nightly payload (HRV, sleep, Body Battery, load) + 6-tap evening log (sauna, perceived readiness)|
|**Decide** (process)|Composite readiness formula (pure function over store; versioned weights in config.yaml)|
|**Act** (output)    |One forced-choice string by 6:45am: `FLOW: GREEN — 4×4 OK / AMBER — Z2-yoga only / RED — rest` + one-line reason|
|**Measure** (impact)|Agree/disagree tap logged to metrics/loop_closure.csv (AOR)            |
|**Improve** (update)|Weekly: disagreement log → weight tuning; formula version annotated on charts|

-----

## 2. Platform Split + Handoff Contract

**Google AI Plus — research & knowledge**
- Inputs it owns: training-science literature, protocol research (Zone 2 / 4×4 sources), Garmin metric documentation.
- Tasks it owns: deep research summaries on recovery science feeding formula design.

**Claude Code (Max 5x) — execution & production**
- Owns: GSD orchestration, Garmin OAuth adapter, store, readiness function, digest delivery, tests.
- Compute boundary: local stateless runs; SQLite at `data/flow.db`; 1 sync/day + on-demand.

**Handoff contract:**
- Gemini output lands as: markdown research memos.
- Delivered to: `/research/inbox/` in the repo (manual copy).
- Claude Code consumes via: reads `/research/inbox/*.md` at plan time only.
- Cadence: on-demand before formula-change planning sessions.

-----

## 3. Architecture Gates

- **Abstraction:** `src/adapters/garmin.py`, `src/adapters/manual_log.py`, `src/adapters/notify.py` — one file per provider.
- **Isolation:** idempotent recompute; state only in `data/flow.db` + git; secrets env-only; private practice namespace in separate DB file.
- **Validation:** golden set = 21 synthetic day-payloads with expected signals before any formula merge; 3-week live baseline before recommendations surface.
- **Capacity:** ≤5 min/run · ≤$0.50 CAD/day LLM (weekly digest only) · warn at 80%.

-----

## 4. Phase 1 Checklist

- [x] Repo initialized with this doc at `docs/framework-alignment.md`
- [ ] `config.yaml` with stream schemas + formula weights v1 + budgets
- [x] `/research/inbox/` created
- [ ] `npx get-shit-done-cc@latest` run in clean environment
- [ ] This doc + SPEC.md + PRINCIPLES.md + OPERATIONS.md fed into `/gsd-plan-phase`
- [ ] Planner feedback noted below → template pruned before next repo

**Planner feedback (fill after first /gsd-plan-phase run):**
- Sections used:
- Sections ignored:
