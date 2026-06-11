# Requirements: Flow — Personal Wellness OS

**Defined:** 2026-06-11
**Core Value:** One reliable 6:45am readiness signal the operator trusts
enough to act on — a noisy signal is worse than none.

## v1 Requirements

Requirements for the personal system (SPEC Phases 0–4). Each maps to
roadmap phases.

### Data Contract & Privacy

- [ ] **PRIV-01**: All health data is stored locally and encrypted at rest (SQLCipher); no third-party analytics anywhere
- [ ] **PRIV-02**: Spiritual-practice logs live in a physically separate `private.db`, excluded from export and any future telemetry by construction
- [ ] **PRIV-03**: Operator can export all data (private namespace excluded by default) and delete everything with one command
- [ ] **PRIV-04**: No secrets in source, commits, or logs; Garmin tokens persist outside the repo with restricted permissions
- [ ] **DATA-01**: Versioned schemas exist for every Phase 1 data stream (Garmin streams + manual log events) before any ingestion code
- [ ] **DATA-02**: ADRs recorded in `docs/adr/` for Garmin access method, encryption choice, and private-namespace isolation

### Garmin Ingest

- [ ] **INGEST-01**: System pulls HRV status, sleep stages, Body Battery, Training Readiness, stress, activities, and resting HR once daily on schedule
- [ ] **INGEST-02**: Operator can trigger an on-demand sync with one command
- [ ] **INGEST-03**: Raw pulls land in an append-only store; re-pulling the same day is idempotent (payload-hash keyed)
- [ ] **INGEST-04**: Auth tokens auto-refresh and persist; sync failure produces an alert the same day, never silence

### Manual Log

- [ ] **LOG-01**: Operator can complete the evening log in ≤6 taps / ≤2 minutes (sauna y/n + duration + HR-recovery note, perceived readiness 1–5, optional free note)
- [ ] **LOG-02**: All manual entries share one versioned events schema (append-only, corrections via supersedes)
- [ ] **LOG-03**: Skipped-log days are tracked and surfaced (kill-criterion instrumentation: >3 min/day or 10 skips/month triggers simplification review)
- [ ] **LOG-04**: Operator can log lifestyle streams: supplements checklist (creatine/whey/greens), caffeine cutoff time, tea/evening ritual done, meal-prep adherence, hot-yoga quality 1–5

### Readiness Signal

- [ ] **SIG-01**: Readiness is computed by pure functions over the store; recompute is idempotent and replaces derived tables transactionally
- [ ] **SIG-02**: No recommendation surfaces before the 21-day baseline has ≥14 valid days (structural gate, not convention)
- [ ] **SIG-03**: Every signal shows its inputs and their freshness; missing streams lower confidence and are named, never imputed
- [ ] **SIG-04**: Readiness formulas are versioned in a frozen registry; every score row carries its formula version and trend charts annotate version changes
- [ ] **SIG-05**: Anomalies (e.g., sustained HRV suppression) produce a "consider checking with a professional" flag — never an interpretation

### Delivery

- [ ] **DLVR-01**: Operator receives a one-line readiness signal + one suggested emphasis by 6:45am daily
- [ ] **DLVR-02**: Operator receives a Sunday-evening digest: trend chart, active experiment status, one candidate pattern, next week's single focus
- [ ] **DLVR-03**: The digest narrative LLM receives only precomputed aggregates ("signature to the LLM"), capped at one call per week
- [ ] **DLVR-04**: Operator can flag "signal felt wrong today" with one tap; disagreements are stored as tuning data

### Experiments

- [ ] **EXP-01**: An experiment cannot start without a pre-registered hypothesis and metric (no post-hoc storytelling)
- [ ] **EXP-02**: The system enforces ONE active experiment at a time
- [ ] **EXP-03**: Cross-stream candidate patterns require 3+ weeks of evidence before promotion
- [ ] **EXP-04**: Experiment results feed a documented routine change and the next baseline period

### Whole-Life Integration

- [ ] **LIFE-01**: Operator can opt in to private practice-consistency markers (e.g., morning class attendance, dhikr/reflection done) — tracked as consistency only, never scored
- [ ] **LIFE-02**: Suggestions are schedule-aware (knows Mon/Thu mornings and Mon/Wed yoga are fixed)
- [ ] **LIFE-03**: Disagreement-log analysis drives readiness-formula tuning on a documented cadence

### Operations

- [ ] **OPS-01**: Every scheduled job has a heartbeat alert; a missed sync or missed digest is detected the same day
- [ ] **OPS-02**: All budgets (runtime, API calls, LLM spend) live in config, are enforced in code, warn at 80%, and hard-block at 100%
- [ ] **OPS-03**: One-command setup and one-command run; README stays current
- [ ] **OPS-04**: Operator can generate a yearly review report from stored data

## v2 Requirements

Deferred. Tracked but not in the current roadmap.

### Productization (SPEC Phase 5, gated)

- **PROD-01**: Gate check: 90 consecutive days of personal use + 3 unprompted outside requests before any productization work
- **PROD-02**: Pick ONE form (templates / community / app) based on which loop proved stickiest

### Extended Ingest

- **INGEST-05**: Open Wearables adapter behind the same ingest interface (only if a second device appears)
- **INGEST-06**: Richer nutrition streams (only if Phase 2 shows nutrition matters)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Diagnosis or medical interpretation | Not a medical device — flag-only posture is a hard constraint |
| Calorie-precision nutrition tracking | Logging friction kills the loop; counted fields only |
| Social feeds / community features | Personal-first; productization gated at Phase 5 |
| Cloud sync of the private namespace | Extra-private by design — local only, ever |
| Multi-user features | Before Phase 5 gate passes, single-user-correct comes first |
| Daily-loop LLM (agentic coach, semantic router) | Readiness must be deterministic/replayable; prior art shows error amplification (see PRIOR-ART research) |
| Missing-data imputation | Missing-data honesty is a validation-layer principle |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRIV-01 | Phase 1 | Pending |
| PRIV-02 | Phase 1 | Pending |
| PRIV-03 | Phase 5 | Pending |
| PRIV-04 | Phase 1 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| INGEST-01 | Phase 2 | Pending |
| INGEST-02 | Phase 2 | Pending |
| INGEST-03 | Phase 2 | Pending |
| INGEST-04 | Phase 2 | Pending |
| LOG-01 | Phase 2 | Pending |
| LOG-02 | Phase 2 | Pending |
| LOG-03 | Phase 2 | Pending |
| LOG-04 | Phase 3 | Pending |
| SIG-01 | Phase 2 | Pending |
| SIG-02 | Phase 2 | Pending |
| SIG-03 | Phase 2 | Pending |
| SIG-04 | Phase 2 | Pending |
| SIG-05 | Phase 2 | Pending |
| DLVR-01 | Phase 2 | Pending |
| DLVR-02 | Phase 2 | Pending |
| DLVR-03 | Phase 3 | Pending |
| DLVR-04 | Phase 2 | Pending |
| EXP-01 | Phase 3 | Pending |
| EXP-02 | Phase 3 | Pending |
| EXP-03 | Phase 3 | Pending |
| EXP-04 | Phase 3 | Pending |
| LIFE-01 | Phase 4 | Pending |
| LIFE-02 | Phase 4 | Pending |
| LIFE-03 | Phase 4 | Pending |
| OPS-01 | Phase 2 | Pending |
| OPS-02 | Phase 1 | Pending |
| OPS-03 | Phase 2 | Pending |
| OPS-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 34 total (previous footer said 30 — corrected after recount during roadmap creation)
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-11*
*Last updated: 2026-06-11 after roadmap creation (traceability populated)*
