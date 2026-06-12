# Project Research Summary

**Project:** Flow — Personal Wellness OS
**Domain:** Single-user, local-first, privacy-sensitive wellness/readiness system (Garmin ingest + manual logging + readiness signal + scheduled digests)
**Researched:** 2026-06-10 (synthesized 2026-06-11)
**Confidence:** HIGH

## Executive Summary

Flow is a personal readiness system, and the research converges on a clear verdict: experts build this exact shape of product as an **ELT pipeline into an embedded local store** — pull raw vendor payloads untouched into append-only SQLite tables, derive everything downstream with pure, idempotent, replayable functions, and deliver through thin channels that compute nothing. GarminDB is direct prior art for the pipeline shape; event-sourcing-lite and functional data engineering validate the SPEC's four-layer model without modification. Every major commercial competitor (Whoop, Garmin Training Readiness, Oura, HRV4Training) converges on the same core feature — one morning score with a color band over a personal rolling baseline — which defines table stakes; their universal, well-documented failures (black-box scoring, silent missing-data handling, no manual-context fusion, no experiment discipline, no feedback channel) define exactly the differentiation space Flow occupies.

The recommended approach is aggressively boring: Python 3.12 + the community `garminconnect` library (the official Garmin Health API rejects personal use — enterprise legal entities only), SQLite encrypted with SQLCipher, systemd timers with Healthchecks heartbeats, ntfy for delivery, FastAPI + HTMX for the ≤6-tap log PWA, and exactly one LLM call per week (Sonnet-tier, config-driven, ~$0.05/week) for the Sunday digest narrative. These choices are now **binding commitments** codified in `docs/framework-alignment.md` — deviations require an ADR. An operator-supplied prior-art review of a multi-agent GCP Garmin platform independently confirmed the append-only raw/derived split and contributed two adopted patterns ("signature to the LLM": deterministic compute first, LLM narrates only compact pre-computed numbers; hard-block budget guards in code around every metered call) while reinforcing what Flow rejects: cloud storage of health data, LLM in the daily decision path, 1Hz data maximalism, and LLM-generated physiological hypotheses.

The key risks are operational and behavioral, not computational. The three loop-killers are: (1) Garmin auth fragility — per-run logins trigger account-level 429 lockouts lasting 48+ hours, so token persistence with backoff is a Phase 0/1 design requirement, not hardening; (2) silent scheduled-job failure — a 6:45am signal computed on stale data erodes trust irreparably, so dead-man's-switch heartbeats are a Phase 1 acceptance criterion; (3) logging friction — the kill criterion (>3 min/day or 10 skipped days/month) must be instrumented from day one or it's unmeasurable. The signal itself must score against a 21-day personal rolling baseline (never today-vs-yesterday — daily HRV noise of 10–30% is physiologically normal), gate all recommendations behind 3 weeks of valid data, and show its inputs and freshness on every delivery.

## Key Findings

### Recommended Stack

Boring tech wins on every axis at 1-user scale. The full rationale and alternatives live in [STACK.md](STACK.md); these choices are codified as binding in `docs/framework-alignment.md` §4.

**Core technologies:**
- **Python 3.12+**: core language — PROJECT.md mandate; all key libraries require ≥3.10
- **`garminconnect` 0.3.5+**: Garmin ingest — the maintained community path (mobile-SSO flow, persisted auto-refreshing tokens, 130+ endpoints covering all 7 Phase 1 streams); official Health API excludes personal use; `garth` is deprecated/broken
- **SQLite + SQLCipher** (`sqlcipher3-wheels`): local-first encrypted store — transparent AES-256 at rest covering DB + WAL/journal; append-only raw tables + rebuildable derived tables
- **systemd timers + Healthchecks heartbeats**: scheduling — `Persistent=true` catches up after a powered-off morning; every job pings a dead-man's switch on success (APScheduler 4.x is explicitly not production-ready; cron silently skips)
- **ntfy + FastAPI/Jinja2/HTMX PWA**: delivery + ≤6-tap log UI — minimal JS honored (HTMX is one static file); Telegram bot is the documented fallback with its privacy tradeoff noted
- **Anthropic SDK, `claude-sonnet-4-6`**: the ONLY LLM call — one weekly digest narrative, ~$0.05/week, model id and `max_tokens` in config, monthly token budget enforced in code with 80% alert

**Critical version note:** use exact model alias ids (`claude-sonnet-4-6`) — date-suffixed ids 404. iOS + self-hosted ntfy needs `upstream-base-url: https://ntfy.sh` or 6:45am delivery can lag 20–30+ minutes.

### Expected Features

Full landscape in [FEATURES.md](FEATURES.md). The competitive convergence (one morning score, color band, personal baseline, baseline gate) defines table stakes; the documented complaints define differentiators.

**Must have (table stakes — the loop dies without these):**
- Daily Garmin sync into append-only local store — manual entry of objective metrics kills the loop instantly
- Single readiness score with color band + one actionable emphasis — users act on the band, not the number
- 3-week baseline gate before ANY recommendation — show collection progress during baseline, never a score
- ≤6-tap, ≤2-min evening log (counted fields, one optional note) — Bottleneck #1 per SPEC
- 6:45am fixed-time delivery with heartbeat alert — a silent miss is the fastest trust killer
- Trend visualization (weekly digest chart suffices for v1) and data export/delete (cheap early, painful retrofitted)

**Should have (differentiators — what Garmin structurally cannot do):**
- Input transparency + freshness on every score — attacks the #1 documented complaint (black-box scoring); requires the score to be a structured object (inputs + freshness + weights + formula version) from day one
- Missing-data honesty — explicit gaps, degraded confidence, abstention below threshold; never imputation
- One-tap disagreement log → eventual formula tuning — no mainstream product has this; capture is Phase-1 cheap, the dataset is the most valuable training data the system gets
- Versioned readiness formula, annotated on charts — near-zero cost in v1, impossible to retrofit honestly
- Pre-registered single-variable experiment engine (ONE active at a time) — genuinely novel; Phase 2, after the signal is trusted

**Defer (v2+):**
- Private spiritual-practice namespace (isolation *designed* in Phase 0, feature ships Phase 3), schedule-aware suggestions, disagreement-driven tuning, Open Wearables adapter, candidate-pattern surfacing

**Anti-features (deliberate):** no diagnosis/medical interpretation, no calorie tracking, no social features, no imputation, no conversational AI coach, no multiple simultaneous experiments, no intraday tracking, no dashboard proliferation — two outputs only (morning line + Sunday digest).

### Architecture Approach

The SPEC's four layers (ingest adapters → append-only raw store → pure-function signals → delivery) are validated as-is by three established patterns: ELT-into-embedded-store, event-sourcing-lite, and functional data engineering. The load-bearing invariant is the direction rule — data flows strictly `ingest → raw → signals → derived → delivery`; delivery writes nothing except disagreement *events* back through the front door. Full detail in [ARCHITECTURE.md](ARCHITECTURE.md).

**Major components:**
1. `ingest/` — one adapter module per source behind a shared protocol; `garmin.py` owns ALL Garmin knowledge (auth, retries, rate limits); swapping vendors touches one file
2. `store/` — the ONLY module that issues SQL; append-only `raw_garmin` (keyed `stream, metric_date, payload_hash` for re-pull idempotency) + one `events` table for ALL manual logs (ULID, event_type, JSON payload, `supersedes` for append-only corrections — new streams need zero migrations) + rebuildable derived tables; private namespace = physically separate `private.db` file, never a column flag
3. `signals/` — pure functions: facts → 21-day rolling baselines (valid only at ≥14 of 21 days) → readiness via a frozen versioned formula registry; `formula_version` stamped on every score row; full idempotent recompute every run (no incremental state — sub-second at this scale)
4. `delivery/` — renders what signals already wrote, computes nothing; LLM behind its own module, digest ships template-only on LLM failure
5. `scheduler/` + config — systemd timer/service pairs, heartbeats, budgets in `config.yaml`

**Build order (dependencies run backward from delivery):** store schema → Garmin ingest → manual log → signals → morning delivery + disagreement intake → scheduler/heartbeats → digest. Starting ingest early means the 21-day baseline clock runs during development.

### Critical Pitfalls

Top 5 of 13 from [PITFALLS.md](PITFALLS.md), all with phase mappings:

1. **Garmin official-API assumption** — the developer program rejects individuals (legal entities only). Decide the unofficial path in Phase 0's ADR; any plan task saying "register dev app" or "webhook endpoint" is a stop signal.
2. **Garmin auth fragility / 429 account lockouts** — login is the rate-limited chokepoint; per-run logins trigger account-level 48h+ blocks. Persist tokens, log in once, auto-refresh, exponential backoff with hard ceiling, avoid MFA on the sync account, pin the library version.
3. **HRV-noise overreaction** — 10–30% day-to-day variation is normal; a signal that flips daily dies in weeks ("a noisy signal is worse than none"). Score against the 21-day personal baseline, require 3+ consecutive days below baseline before flagging, honor the 3-week gate.
4. **Logging friction crosses the kill threshold** — instrument log-time and skip-streak from day one; every new field must "earn its tap"; counted fields only, one optional note max.
5. **Silent scheduled-job failure** — cron emails nobody reads and won't fire if the machine is off. Dead-man's-switch heartbeat (ping only on success) is a Phase 1 acceptance criterion; the morning signal displays data freshness so staleness is self-evident.

Also load-bearing: baseline contamination (sick/travel days need a one-tap exclusion flag, handled via recompute, never data edits), encryption done wrong (SQLCipher must cover WAL/shm sidecars; key never in repo), and Garmin's ~7-day server retention (local store is the source of truth; the cloud is a sync buffer).

### Prior Art (operator-supplied)

A multi-agent LangGraph/GCP Garmin telemetry platform ([PRIOR-ART-multiagent-gcp.md](PRIOR-ART-multiagent-gcp.md)) independently validates Flow's append-only raw/derived split, the derisk-Garmin-ingest-first build order, and the Telegram-channel fallback. **Adopted patterns:** (1) "signature to the LLM" — signals compute all trends deterministically; the weekly LLM call receives only compact numbers to narrate, so it can never invent data; (2) hard-block budget guards in code around every metered call (check before call, alert at 80%, refuse past 100%). **Explicitly rejected:** cloud-first storage (violates privacy-by-architecture), daily multi-agent LLM orchestration (no LLM in the daily decision path, ever — the prior-art project needed SRE guardrails against its own agents), 1Hz telemetry scale, and LLM-generated physiological hypotheses. No roadmap structure changes resulted.

## Implications for Roadmap

The SPEC pre-decomposes delivery into Phases 0–5; research confirms that decomposition and sharpens what each phase must contain. Suggested structure:

### Phase 0: Foundations & Data Contract
**Rationale:** The expensive-to-change decisions are all here — schema shape, encryption, Garmin access path, namespace isolation. Every pitfall with "Never acceptable" recovery cost is prevented in this phase.
**Delivers:** Store schema (raw_garmin + events + derived DDL), SQLCipher encryption + key management, ADRs for: unofficial Garmin path, SQLCipher vs disk-encryption fallback, delivery channel (ntfy PWA vs Telegram), private-namespace file split. `config.yaml` with budgets and model tier. `uv` project, pytest + ruff from day one.
**Addresses:** Data export/delete groundwork; private-namespace isolation design (feature ships Phase 3).
**Avoids:** Pitfalls 1 (official-API assumption), 8 (cloud-as-durable-store), 9 (encryption/key mgmt), 13 (non-idempotent recompute design).

### Phase 1: The Closed Loop (runs 4 weeks per SPEC)
**Rationale:** Smallest loop that exercises sense → decide → act → measure → improve. Garmin ingest goes first within the phase — it's the highest-risk integration, and starting it early lets the 21-day baseline form during development.
**Delivers:** Daily Garmin sync (token persistence, backoff, payload-hash dedup) → recompute (facts → baselines → readiness v1 + freshness) → 6:45am ntfy signal with provenance → ≤6-tap evening log + one-tap disagreement → systemd timers + Healthchecks heartbeats → Sunday digest (chart + computed stats; LLM narrative optional). Formula version field and sick/travel exclusion flag in the schema. Kill-criterion instrumentation (log-time, skip-streak).
**Uses:** garminconnect, SQLCipher, FastAPI+HTMX, systemd, ntfy, matplotlib.
**Avoids:** Pitfalls 2 (429 lockout), 3 (HRV noise), 4 (baseline contamination hook), 5 (friction instrumentation), 6 (heartbeats — NOT deferrable to hardening), 7 (imputation), 12 (medical-copy creep).

### Phase 2: Lifestyle Streams & Experiment Engine
**Rationale:** Gated on Phase 1 evidence — logging held under 2 min for 4 weeks, baseline stable, low disagreement rate. Experiments before a trusted signal produce garbage conclusions.
**Delivers:** New event types (supplements, caffeine cutoff, tea, yoga quality — zero migrations by construction), pre-registered single-variable experiment engine (ONE active; refuses to conclude without a pre-registered metric), LLM weekly narrative using the "signature to the LLM" pattern with hard-block budget guard.
**Avoids:** Pitfalls 5 (every field earns its tap), 10 (dashboard creep), 11 (post-hoc storytelling).

### Phase 3: Tuning & Private Namespace
**Rationale:** Needs months of disagreement logs and a proven isolation design.
**Delivers:** Disagreement-driven formula tuning (shadow recompute of candidate formulas against the disagreement log), formula v2+ with chart annotations, private spiritual-practice namespace (separate `private.db`, consistency-only, never scored), schedule-aware suggestions (static config, no calendar API).

### Phase 4: Hardening & Extensibility
**Rationale:** Only after the loop has run unattended for months.
**Delivers:** Open Wearables adapter behind the same ingest protocol (the test that the interface was drawn correctly), full export/delete tooling verified against all files including sidecars and tokens, yearly review.

### Phase 5: Productization (gated)
**Rationale:** SPEC gate — 90 consecutive days of personal use + 3 unprompted outside requests. Official Garmin Health API (legal entity) becomes relevant only here. Do not pre-build for this.

### Phase Ordering Rationale

- **Store before everything:** every component reads/writes through it; schema decisions are the expensive ones (ARCHITECTURE build order).
- **Ingest before signals:** real data derisks the riskiest integration first and starts the baseline clock early.
- **Heartbeats inside Phase 1, not Phase 4:** silent failure is a trust-killer, and PRINCIPLES requires the loop to run unattended.
- **Experiments after a 4-week trusted signal:** an experiment's metric is the readiness signal; calibrate first.
- **Provenance structure in Phase 1 even though tuning is Phase 3:** transparency, missing-data honesty, and tuning all require the score to be a structured object — unretrofittable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Garmin adapter specifics):** exact `garminconnect` endpoint/response shapes for the 7 streams, MFA/token edge cases, backfill bootstrap limits — issue trackers move fast; verify at plan time.
- **Phase 2 (experiment engine):** n=1 pre-registration methodology and minimal statistics for single-subject conclusions — sparse domain, the genuinely novel part.
- **Phase 3 (formula tuning):** how to translate disagreement logs into weight proposals — no established pattern exists; expect design work.

Phases with standard patterns (skip research-phase):
- **Phase 0:** SQLite/SQLCipher schema design, systemd units, uv setup — all well-documented; STACK.md + ARCHITECTURE.md already contain the schemas.
- **Phase 4 export/delete tooling:** straightforward once the store layer exists.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against official docs, GitHub releases, PyPI within days of research; one MEDIUM item (sqlcipher3-wheels platform coverage — verify in Phase 0) |
| Features | MEDIUM-HIGH | Multiple independent current product sources agree on convergence + complaints; competitor internals are inherently opaque |
| Architecture | HIGH | Layering/schema/recompute patterns validated by mature prior art (GarminDB) and independent prior-art review; MEDIUM only on Garmin endpoint specifics |
| Pitfalls | HIGH | Garmin access constraints and HRV science from primary sources (issue trackers, official FAQ, peer-reviewed); abandonment/ops MEDIUM-HIGH |

**Overall confidence:** HIGH

### Gaps to Address

- **`sqlcipher3-wheels` availability on the target platform** — verify in Phase 0; fallback is `sqlcipher3` + system libsqlcipher, or disk encryption per the privacy ADR.
- **Garmin endpoint coverage for all 7 streams** — `garminconnect` claims coverage; confirm response shapes with a spike in early Phase 1 before schema-locking `daily_facts`.
- **MFA + headless sync** — documented breakage exists; the operator's account MFA status determines whether design-around work is needed (Phase 0 decision).
- **Delivery-channel ADR (ntfy PWA vs Telegram)** — both researched and viable; framework-alignment commits to ntfy + PWA with Telegram as documented fallback; confirm the iOS upstream-poll tradeoff is acceptable in the privacy ADR.
- **Deploy target** — research assumes a systemd-capable always-on box (home server/Pi); if that's wrong, the APScheduler 3.11 variant applies. Confirm before Phase 0 closes.

## Sources

### Primary (HIGH confidence)
- [cyberjunky/python-garminconnect](https://github.com/cyberjunky/python-garminconnect) — auth flow, token persistence, endpoint coverage; issues #337/#344/#312 for 429/MFA failure modes
- [Garmin Connect Developer Program FAQ / Health API docs](https://developer.garmin.com/gc-developer-program/program-faq/) — personal use excluded; retention/backfill limits
- [SQLCipher (Zetetic)](https://github.com/sqlcipher/sqlcipher) + [coleifer/sqlcipher3](https://github.com/coleifer/sqlcipher3) — encryption at rest
- [APScheduler releases](https://github.com/agronholm/apscheduler/releases) — 4.x not production-ready
- [Healthchecks.io docs](https://healthchecks.io/docs/) — dead-man's-switch monitoring
- [GarminDB](https://github.com/tcgoetz/GarminDB) — closest prior art for the pipeline shape
- Anthropic model ids & pricing — claude-api skill reference (cached 2026-06)
- /home/user/flow/SPEC.md, PRINCIPLES.md, .planning/PROJECT.md, docs/framework-alignment.md — binding project constraints

### Secondary (MEDIUM confidence)
- Whoop/Oura/HRV4Training/Garmin TR official feature docs + the5krunner / Pojednic / Altini critiques — feature convergence and black-box complaints
- Elite HRV / Oura baseline-formation practice — rolling-baseline windows and gating
- Self-tracking abandonment literature (peer-reviewed) — friction → abandonment drivers
- [ntfy](https://github.com/binwiederhier/ntfy) self-hosting writeups — iOS upstream-poll caveat
- Event-sourcing-with-SQLite pattern articles — append-only validation

### Tertiary (LOW confidence)
- Operator-supplied Reddit prior art (multi-agent GCP platform) — directional validation only; patterns adopted were independently cross-checked against PRINCIPLES
- DuckDB+dbt quantified-self warehouse writeup — corroborates ELT norm, single source

---
*Research completed: 2026-06-10; synthesized 2026-06-11*
*Ready for roadmap: yes*
