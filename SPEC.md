# SPEC.md — Flow: Personal Wellness OS

> GSD: read alongside PRINCIPLES.md and OPERATIONS.md. Personal-first;
> productization is a gated Phase 5, not a design driver. The app is named
> "Flow" — keep this name. **Current Active repo per OPERATIONS.md Rule 3.**

## Vision

A phased personal wellness system that fuses objective wearable data
(Garmin Forerunner 955 via Garmin Connect API) with lightweight manual
logging of everything the watch can't see — sauna sessions, yoga quality,
supplements, tea/nutrition, mood, and spiritual practice — and turns it
into one trustworthy daily readiness signal plus weekly experiments.
The operator already runs a sophisticated stack (Hyrox, RPM, hot yoga,
strength, wet sauna, polarized Zone 2 / Norwegian 4×4 programming,
structured mornings); the system's job is integration and learning loops,
not more dashboards.

## Outcomes

- **Primary (personal):** one reliable morning readiness signal and a
  weekly experiment cadence that demonstrably improves recovery markers
  (HRV trend, Body Battery overnight refill, sleep consistency) within
  12 weeks.
- **Secondary (financial, Phase 5, gated):** productize for hybrid
  athletes (Hyrox/CrossFit + recovery culture) as templates, a paid
  community, or a self-hosted app. Gate: 90 consecutive days of personal
  use + 3 outsiders asking for it unprompted.
- **Kill criterion (personal phase):** if daily logging takes > 3 minutes
  or is skipped 10 days in a month, the design is wrong — simplify before
  adding anything.

## Hard constraints

1. **Not a medical device.** No diagnosis, no treatment claims, no
   medication guidance. Anomalies (e.g., sustained HRV suppression,
   overnight temperature spikes) produce a "consider checking with a
   professional" flag, never an interpretation.
2. **Privacy by architecture.** Health data is the most sensitive data in
   any project in this pack: local-first storage, encrypted at rest,
   no third-party analytics, explicit export/delete. Spiritual-practice
   logs are extra-private: stored in a separate namespace, excluded from
   any future product telemetry by default and by design.
3. **Garmin API terms.** Personal-use OAuth app; respect rate limits;
   cache aggressively; never resell Garmin-derived data in Phase 5
   without re-reading the developer terms.

## System architecture (four layers)

- **Abstraction:** `ingest/garmin` (Connect API adapter), `ingest/manual`
  (one quick-log interface), `signals/` (readiness computation),
  `delivery/` (digest channel). Open Wearables self-hosted is a future
  adapter behind the same ingest interface — not a Phase 1 dependency.
- **Isolation:** raw pulls land in an append-only store; derived signals
  are recomputed, never hand-edited; a bad sync day cannot corrupt
  baselines (recompute is idempotent).
- **Validation:** every readiness score shows its inputs and their
  freshness ("HRV from last night, sauna log missing"); missing-data
  honesty over imputation; weekly experiment results require pre-registered
  hypothesis + metric (no post-hoc storytelling); 3-week baseline period
  before ANY recommendation is surfaced.
- **Infrastructure capacity:** one Garmin sync/day + on-demand; manual log
  budget ≤ 2 min/day by design (counted fields, not free text); LLM used
  only for the weekly narrative digest, capped.

## Ecosystem map (initial)

- **Scale:** 1 user, ~8 data streams. 10x (Phase 5) = multi-tenant — which
  is why isolation and privacy are built single-user-correct first.
- **Time:** morning signal by 6:45am (before Quran class / gym decision);
  weekly digest Sunday evening (planning night); baselines monthly.
- **Causality hypothesis:** the highest-leverage variables are sleep
  consistency and training-load balance, not any supplement or gadget.
  The experiment engine exists to test beliefs like this, one at a time.
- **Fan-in:** all streams converge at the readiness signal — highest-
  validation node; it must degrade gracefully when streams are missing.
  **Fan-out:** the morning signal influences the whole day's decisions —
  a noisy signal is worse than none, hence the 3-week baseline gate.
- **Emergence:** cross-stream correlations the operator hasn't predicted
  (e.g., evening sauna × sleep latency; late caffeine × HRV). Surface as
  "candidate patterns" requiring 3+ weeks of evidence before promotion.
- **Incentives:** the 2-minute log must pay for itself daily via the
  morning signal; streaks and weekly insights are the retention loop.
- **Capacity:** operator attention is the constraint — ONE active
  experiment at a time, ever.
- **Feedback loops:** (1) experiment results → routine changes → next
  baseline; (2) signal-vs-felt-readiness disagreement log → readiness
  formula tuning; (3) skipped-log analysis → UX simplification.
- **Bottleneck #1:** logging friction. Phase 1 ships the smallest possible
  manual log (≤ 6 taps) before any analytics depth.

## Data streams by phase

- **Phase 1 (objective core):** Garmin — HRV status, sleep stages, Body
  Battery, Training Readiness, stress, activities, resting HR.
- **Phase 1 (manual core):** sauna session (y/n, duration, post-session
  HR-recovery note), perceived readiness (1–5), one free note (optional).
- **Phase 2:** supplements taken (checklist: creatine/whey/greens),
  caffeine cutoff time, tea/evening ritual done, meal-prep adherence,
  hot-yoga session quality (1–5).
- **Phase 3 (private namespace, opt-in):** practice consistency markers
  the operator defines (e.g., morning class attendance, dhikr/reflection
  done) — tracked as consistency only, never "scored" by the system.
- **Phase 4:** Open Wearables adapter if a second device appears; richer
  nutrition only if Phase 2 shows it matters.

## Communication loops

- System → operator: 6:45am one-line signal + one suggested emphasis
  ("green — quality day for 4×4" / "amber — Zone 2 or yoga only").
- Operator → system: 2-minute evening log.
- Weekly: Sunday digest — trend chart, active experiment status, one
  candidate pattern, next week's single focus.
- Disagreement channel: one tap to say "signal felt wrong today" — the
  most valuable training data the system gets.

## Engineering fundamentals (project-specific)

- Reliability: missed-sync and missed-digest alerts; silent-failure
  postmortems per PRINCIPLES.
- Code health: one schema for all log entries; signals are pure functions
  over the store (testable, replayable).
- Release hygiene: readiness-formula changes are versioned and annotated
  on charts (so trend breaks are explainable).

## Phases

- **Phase 0 — Data contract + privacy ADR.** Garmin OAuth scopes, storage
  encryption choice, stream schemas, spiritual-namespace isolation design.
- **Phase 1 — Smallest closed loop.** Daily Garmin pull + 6-tap evening
  log + 3-week baseline + morning signal + Sunday digest. Run 4 weeks.
- **Phase 2 — Lifestyle streams + experiment engine.** Supplements/tea/
  caffeine/yoga-quality logging; pre-registered single-variable
  experiments; candidate-pattern surfacing.
- **Phase 3 — Whole-life integration.** Private practice-consistency
  namespace; schedule-aware suggestions (knows Mon/Thu mornings and
  Mon/Wed yoga are fixed); disagreement-driven formula tuning.
- **Phase 4 — Hardening.** Open Wearables adapter option, data export,
  yearly review report.
- **Phase 5 — Productization (gated).** Only after 90-day personal streak:
  pick ONE form (templates / community / app) based on which loop proved
  stickiest personally.

## Operations alignment (OPERATIONS.md governs)

- **Action output:** forced-choice only (Rule 1) — schema in framework-alignment.md.
- **Measure row = AOR** logged to `metrics/loop_closure.csv` (Rule 4).
- **Coordination:** single agent + signal schema + operator disagreement log as review.
- Session hygiene: `reentry.md` on every stop (Rule 2); WIP cap (Rule 3) and
  meta-work quarantine (Rule 5) apply.

## Out of scope

Diagnosis or medical interpretation, calorie-precision nutrition tracking,
social feeds, any cloud sync of the private namespace, multi-user features
before Phase 5 gate passes.
