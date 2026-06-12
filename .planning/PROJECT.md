# Flow — Personal Wellness OS

## What This Is

Flow is a phased personal wellness system for a single operator (a hybrid
athlete running Hyrox, RPM, hot yoga, strength, sauna, and structured
mornings). It fuses objective wearable data from a Garmin Forerunner 955
(via the Garmin Connect API) with lightweight manual logging of everything
the watch can't see — sauna sessions, yoga quality, supplements,
tea/nutrition, mood, and spiritual practice — and turns it into one
trustworthy daily readiness signal plus weekly experiments. Its job is
integration and learning loops, not more dashboards.

## Core Value

One reliable 6:45am readiness signal the operator trusts enough to act on
— a noisy signal is worse than none.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Daily Garmin Connect sync (HRV status, sleep stages, Body Battery,
      Training Readiness, stress, activities, resting HR) into an
      append-only store
- [ ] ≤ 6-tap, ≤ 2-minute evening manual log (sauna y/n + duration +
      HR-recovery note, perceived readiness 1–5, optional free note)
- [ ] 3-week baseline period computed before ANY recommendation surfaces
- [ ] 6:45am one-line readiness signal + one suggested emphasis, showing
      its inputs and their freshness
- [ ] Sunday evening weekly digest (trend chart, active experiment status,
      one candidate pattern, next week's single focus)
- [ ] One-tap "signal felt wrong today" disagreement log
- [ ] Pre-registered single-variable weekly experiment engine (ONE active
      experiment at a time)

### Out of Scope

- Diagnosis or medical interpretation — not a medical device; anomalies
  produce a "consider checking with a professional" flag only
- Calorie-precision nutrition tracking — logging friction kills the loop
- Social feeds — personal-first system
- Cloud sync of the private spiritual-practice namespace — extra-private
  by design
- Multi-user features before the Phase 5 gate passes (90 consecutive days
  of personal use + 3 unprompted outside requests)
- Imputation of missing data — missing-data honesty over imputation

## Context

- Source of truth: `SPEC.md` (vision, phases, data streams),
  `PRINCIPLES.md` (non-negotiable engineering principles), and
  `OPERATIONS.md` (portfolio operating rules) in the repo root.
- Flow is the **Current Active** repo in a six-repo portfolio
  (OPERATIONS.md Rule 3, WIP cap = 1); milestone to vacate the slot:
  framework-alignment filled → /gsd-plan-phase → first working readiness
  signal. Operator attention budget is ~5–8 hrs/week across the whole
  portfolio.
- Greenfield: the repo's previous habit-tracker code was removed; only
  git history remains.
- Operator schedule anchors: morning signal needed by 6:45am (before
  Quran class / gym decision); weekly digest Sunday evening; Mon/Thu
  mornings and Mon/Wed yoga are fixed.
- SPEC pre-decomposes delivery into Phases 0–5; Phase 1 must ship the
  smallest closed loop (sense → decide → act → measure → improve) and
  run 4 weeks.
- Kill criterion: if daily logging takes > 3 minutes or is skipped
  10 days in a month, simplify before adding anything.
- Causality hypothesis to test: sleep consistency and training-load
  balance are the highest-leverage variables, not supplements or gadgets.

## Constraints

- **Regulatory**: Not a medical device — no diagnosis, treatment claims,
  or medication guidance, ever.
- **Privacy**: Local-first storage, encrypted at rest, no third-party
  analytics, explicit export/delete; spiritual-practice logs in a
  separate namespace excluded from any future telemetry by default.
- **Vendor terms**: Garmin personal-use OAuth app; respect rate limits;
  cache aggressively; one scheduled sync/day plus on-demand.
- **Tech stack**: Small core language set per PRINCIPLES — Python +
  minimal JS only; boring tech preferred; new dependencies need an ADR.
- **Attention budget**: Manual log ≤ 2 min/day by design (counted fields,
  not free text); ONE active experiment at a time.
- **LLM budget**: LLM used only for the weekly narrative digest, capped;
  model tiering lives in config, never inline.
- **Architecture**: Every component assignable to exactly one of the four
  layers (Abstraction / Isolation / Validation / Infrastructure
  capacity); raw pulls append-only; derived signals recomputed, never
  hand-edited; recompute idempotent.
- **Process**: Significant choices get a 5-line ADR in `docs/adr/`;
  ecosystem map updated at every phase boundary; scheduled jobs get
  heartbeat alerts; readiness-formula changes versioned and annotated on
  charts.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| App is named "Flow" (not the spec's working name "Mizan") | Operator decision; repo identity kept | — Pending |
| Legacy habit-tracker code removed rather than reused | Unmaintained, old, and irrelevant to the new scope | — Pending |
| GSD installed from open-gsd (`@opengsd/get-shit-done-redux`) | Original `get-shit-done-cc` npm package deprecated; governance moved to open-gsd | — Pending |
| Personal-first; productization is a gated Phase 5 | Per SPEC — product pressure must not shape the personal system's design | — Pending |
| Open Wearables adapter deferred behind the ingest interface | Not a Phase 1 dependency; same interface keeps the door open | — Pending |
| Forced-choice signal output + AOR loop-closure metric | OPERATIONS.md Rules 1+4 — recommendations arrive as binary choices; % acted-on within 48h is the one metric that proves the loop closes | — Pending |
| Single agent + operator veto as the only review layer | OPERATIONS.md Rule 1 — adversarial two-agent review scoped to scout only; sequential pipeline gains nothing from more agents | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-10 after initialization*
