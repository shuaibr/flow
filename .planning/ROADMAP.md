# Roadmap: Flow — Personal Wellness OS

## Overview

Flow ships as five phases that follow SPEC.md's pre-decomposition (SPEC Phases 0–4; SPEC Phase 5 productization is gated v2 work, not on this roadmap). Phase 1 locks the expensive-to-change decisions — encrypted local store, versioned schemas, private-namespace isolation, Garmin access ADR — before any ingestion code exists. Phase 2 ships the smallest closed loop (sense → decide → act → measure → improve): daily Garmin sync, ≤6-tap evening log, the structural 21-day baseline gate, the 6:45am signal with provenance, heartbeat-monitored scheduling, and the Sunday digest — then **soaks for 4 weeks of real-world operation** before anything else is built. Phase 3 adds lifestyle streams and the pre-registered single-variable experiment engine plus the weekly LLM narrative. Phase 4 integrates the whole life: private practice-consistency markers, schedule-aware suggestions, and disagreement-driven formula tuning. Phase 5 hardens: verified export/delete and the yearly review.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Contract & Privacy Foundations** - Encrypted store, versioned schemas, private-namespace split, budget config, and the ADRs that are never-acceptable to get wrong (SPEC Phase 0)
- [ ] **Phase 2: Smallest Closed Loop** - Daily Garmin sync → baseline-gated readiness signal at 6:45am → evening log + disagreement tap → heartbeat-monitored schedule + Sunday digest; runs 4 weeks (SPEC Phase 1)
- [ ] **Phase 3: Lifestyle Streams & Experiment Engine** - Supplements/caffeine/tea/yoga logging, pre-registered single-variable experiments, LLM weekly narrative (SPEC Phase 2)
- [ ] **Phase 4: Whole-Life Integration & Formula Tuning** - Private practice-consistency markers, schedule-aware suggestions, disagreement-driven tuning (SPEC Phase 3)
- [ ] **Phase 5: Hardening** - Verified export/delete tooling and yearly review report (SPEC Phase 4)

## Phase Details

### Phase 1: Data Contract & Privacy Foundations

**Goal**: Every expensive-to-change decision is made, recorded, and enforced in code before any data flows — encrypted local storage, versioned stream schemas, physically separate private namespace, secrets discipline, and budget guards.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PRIV-01, PRIV-02, PRIV-04, DATA-01, DATA-02, OPS-02
**Corresponds to**: SPEC Phase 0 (Data contract + privacy ADR)
**Success Criteria** (what must be TRUE):

  1. All health data written by the system lands in a local SQLCipher-encrypted store (AES-256 at rest, covering WAL/journal sidecars); opening the file without the key yields ciphertext, and the key is never in the repo
  2. Spiritual-practice data has a physically separate `data/private.db` file (not a column flag), excluded from export and any future telemetry paths by construction
  3. Versioned schemas exist and are tested for every Phase 1 data stream (7 Garmin streams + the manual-log events table with ULID/event_type/schema_version/supersedes) before any ingestion code is written
  4. ADRs in `docs/adr/` record the Garmin access method (community `garminconnect`; official Health API excludes personal use), the encryption choice, and the private-namespace isolation design; no secrets appear in source, commits, or logs
  5. All budgets (runtime per job, API calls, LLM spend) live in `config.yaml` and are enforced by code-level guards that warn at 80% and hard-block at 100%**Plans**: 5 plans

**Wave 1**

- [ ] 01-01-PLAN.md — Walking Skeleton: uv scaffold + encrypted connection factory + flow init write/read + first schema test (PRIV-01, DATA-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Full data contract: 7 Garmin schemas + event payloads + full DDL + golden-fixture format (DATA-01)
- [ ] 01-03-PLAN.md — Privacy: separate private.db namespace + export-exclusion-by-construction + secrets discipline (PRIV-01, PRIV-02, PRIV-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-04-PLAN.md — Budgets: config.yaml + FlowSettings + BudgetGuard (warn 80%/block 100%) with persistence (OPS-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-05-PLAN.md — ADRs: Garmin access, encryption, private-namespace isolation + presence test (DATA-02)

### Phase 2: Smallest Closed Loop

**Goal**: The operator wakes to one trustworthy 6:45am readiness line, logs the evening in under 2 minutes, and the whole loop runs unattended with same-day failure detection — then proves itself over 4 weeks of real-world operation.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, LOG-01, LOG-02, LOG-03, SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, DLVR-01, DLVR-02, DLVR-04, OPS-01, OPS-03
**Corresponds to**: SPEC Phase 1 (Smallest closed loop — must run 4 weeks before Phase 3 starts)
**Success Criteria** (what must be TRUE):

  1. All 7 Garmin streams (HRV status, sleep stages, Body Battery, Training Readiness, stress, activities, resting HR) sync once daily on schedule plus on-demand into the append-only store; re-pulling a day is idempotent (payload-hash keyed); auth tokens persist outside the repo and auto-refresh (no per-run logins — no 429 lockouts); a failed sync alerts the operator the same day, never silently
  2. Operator completes the evening log in ≤6 taps / ≤2 minutes and can flag "signal felt wrong today" with one tap; log duration and skip-streaks are instrumented from day one so the kill criterion (>3 min/day or 10 skips/month) is measurable
  3. By 6:45am the operator receives a one-line readiness signal + one suggested emphasis that shows its inputs and their freshness; missing streams are named and lower confidence — never imputed; anomalies produce only a "consider checking with a professional" flag
  4. No recommendation surfaces before the 21-day baseline has ≥14 valid days (structural gate in code); during baseline the operator sees collection progress, not a score; every score row carries its formula version from the frozen registry
  5. Every scheduled job (sync, recompute, morning delivery, Sunday digest) pings a dead-man's-switch heartbeat — a missed job is detected the same day; the Sunday digest delivers a trend chart and computed stats; setup and run are each one command with a current README

**Plans**: TBD
**UI hint**: yes

**Soak gate**: Phase 2 must run 4 real-world weeks (logging held ≤2 min, baseline stable, heartbeats quiet) before Phase 3 begins — per SPEC.

### Phase 3: Lifestyle Streams & Experiment Engine

**Goal**: The operator can test one belief at a time with pre-registered rigor, log the lifestyle context the watch can't see, and read a weekly LLM-narrated digest that can never invent data.
**Mode:** mvp
**Depends on**: Phase 2 (plus its 4-week soak gate)
**Requirements**: LOG-04, EXP-01, EXP-02, EXP-03, EXP-04, DLVR-03
**Corresponds to**: SPEC Phase 2 (Lifestyle streams + experiment engine)
**Success Criteria** (what must be TRUE):

  1. Operator can log supplements (creatine/whey/greens checklist), caffeine cutoff time, tea/evening ritual, meal-prep adherence, and hot-yoga quality 1–5 through the same versioned events schema — zero store migrations required
  2. An experiment cannot be started without a pre-registered hypothesis and metric, and the system refuses to run more than ONE active experiment at a time
  3. The Sunday digest narrative is LLM-generated from precomputed aggregates only ("signature to the LLM"), capped at one call per week with a hard-block budget guard, and ships template-only if the LLM call fails
  4. Cross-stream candidate patterns surface only after 3+ weeks of evidence, and a concluded experiment records a documented routine change that feeds the next baseline period

**Plans**: TBD
**UI hint**: yes

### Phase 4: Whole-Life Integration & Formula Tuning

**Goal**: The signal understands the operator's actual life — fixed schedule anchors, private practice consistency, and months of disagreement data feeding documented formula tuning.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: LIFE-01, LIFE-02, LIFE-03
**Corresponds to**: SPEC Phase 3 (Whole-life integration)
**Success Criteria** (what must be TRUE):

  1. Operator can opt in to private practice-consistency markers (e.g., morning class attendance, dhikr/reflection done) stored only in `private.db`, displayed as consistency only — never scored or weighted into readiness
  2. Morning suggestions are schedule-aware: the system knows Mon/Thu mornings and Mon/Wed yoga are fixed (static config, no calendar API) and emphasizes accordingly
  3. Disagreement-log analysis produces readiness-formula tuning on a documented cadence; candidate formulas are shadow-recomputed against the disagreement log before promotion, and every formula version change is annotated on trend charts

**Plans**: TBD

### Phase 5: Hardening

**Goal**: The operator's data is fully theirs — provably exportable, provably deletable — and the system can tell the story of a year.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PRIV-03, OPS-04
**Corresponds to**: SPEC Phase 4 (Hardening; Open Wearables adapter and richer nutrition remain v2 — INGEST-05/06)
**Success Criteria** (what must be TRUE):

  1. One command exports all data (private namespace excluded by default), and one command deletes everything — verified against every file on disk including WAL/shm sidecars and persisted tokens
  2. Operator can generate a yearly review report from stored data (trends, experiments run, formula history)

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → (4-week soak) → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Contract & Privacy Foundations | 0/5 | Not started | - |
| 2. Smallest Closed Loop | 0/TBD | Not started | - |
| 3. Lifestyle Streams & Experiment Engine | 0/TBD | Not started | - |
| 4. Whole-Life Integration & Formula Tuning | 0/TBD | Not started | - |
| 5. Hardening | 0/TBD | Not started | - |

## Coverage

All 34 v1 requirements mapped to exactly one phase:

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1 | PRIV-01, PRIV-02, PRIV-04, DATA-01, DATA-02, OPS-02 | 6 |
| 2 | INGEST-01..04, LOG-01..03, SIG-01..05, DLVR-01, DLVR-02, DLVR-04, OPS-01, OPS-03 | 17 |
| 3 | LOG-04, EXP-01..04, DLVR-03 | 6 |
| 4 | LIFE-01..03 | 3 |
| 5 | PRIV-03, OPS-04 | 2 |

v2 (not on this roadmap): PROD-01, PROD-02 (SPEC Phase 5, gated), INGEST-05, INGEST-06.

---
*Roadmap created: 2026-06-11*
