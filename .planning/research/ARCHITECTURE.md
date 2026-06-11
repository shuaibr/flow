# Architecture Research

**Domain:** Local-first personal wellness / readiness system (quantified-self data pipeline)
**Researched:** 2026-06-10
**Confidence:** HIGH (layering, data flow, schema patterns) / MEDIUM (Garmin ingest specifics — depends on API access path, see Integration Points)

## Verdict on the SPEC's Layering

The SPEC's four-layer model — **ingest adapters → append-only raw store → pure-function signal computation → delivery** — is validated by common practice. It is the same shape as three well-established patterns:

1. **ELT into an embedded analytical store.** The dominant quantified-self pattern (GarminDB, DuckDB+dbt health warehouses) is: pull raw vendor payloads, land them untouched in SQLite/DuckDB, then transform downstream. GarminDB (Python + SQLite, mature since 2017) is the closest prior art: download Garmin JSON/FIT → store raw → derive daily/weekly/monthly summary tables. Flow's structure matches, with cleaner adapter boundaries.
2. **Event sourcing lite.** Append-only raw tables + derived state rebuilt by replay is exactly "event sourcing without the framework." SQLite is a recognized good fit for an append-only event store at single-user scale (transactional, serverless, trivially backed up).
3. **Functional data engineering / lambda-style recompute.** Immutable raw partitions + idempotent, deterministic transforms that can be re-run over any date range is the standard answer to "a bad sync day cannot corrupt baselines." Derived data is a disposable cache of `f(raw, config, formula_version)`.

No refinement needed to the layer list itself. The refinements below are about **where the boundaries sit inside the layers** (raw vs. derived storage, formula registry, scheduler as a fifth concern).

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│ ABSTRACTION — ingest adapters (one module per source)              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ ingest/garmin    │  │ ingest/manual    │  │ ingest/openwear  │  │
│  │ (Connect adapter)│  │ (quick-log CLI/  │  │ (future, same    │  │
│  │                  │  │  minimal web UI) │  │  interface)      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │ raw payloads        │ events              │ (later)    │
├───────────┴─────────────────────┴──────────────────────────────────┤
│ ISOLATION — store/ (SQLite, encrypted at rest)                     │
│  ┌──────────────────────────────┐  ┌─────────────────────────────┐ │
│  │ flow.db                      │  │ private.db (Phase 3)        │ │
│  │  raw_garmin   (append-only)  │  │  events (same schema,       │ │
│  │  events       (append-only)  │  │  separate file = separate   │ │
│  │  ── derived (rebuildable) ── │  │  namespace, never exported  │ │
│  │  daily_facts                 │  │  or sent to telemetry)      │ │
│  │  baselines                   │  └─────────────────────────────┘ │
│  │  readiness_scores            │                                  │
│  └──────────────┬───────────────┘                                  │
├─────────────────┴───────────────────────────────────────────────── ┤
│ VALIDATION — signals/ (pure functions over the store)              │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ extract:   │→ │ baselines: │→ │ readiness:   │→ │ freshness/ │  │
│  │ raw → day  │  │ 21-day     │  │ versioned    │  │ coverage   │  │
│  │ facts      │  │ rolling    │  │ formula reg. │  │ annotator  │  │
│  └────────────┘  └────────────┘  └──────────────┘  └────────────┘  │
├────────────────────────────────────────────────────────────────────┤
│ DELIVERY — delivery/ (render + send; computes nothing)             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐     │
│  │ morning      │  │ sunday       │  │ disagreement intake   │     │
│  │ signal 6:45  │  │ digest (LLM  │  │ ("felt wrong" → event)│     │
│  └──────────────┘  │ narrative)   │  └───────────────────────┘     │
│                    └──────────────┘                                │
├────────────────────────────────────────────────────────────────────┤
│ INFRA CAPACITY — scheduler/ + config                               │
│  cron-driven jobs (1 Garmin sync/day, 6:45 signal, Sun digest),    │
│  heartbeat alerts, API/LLM budgets in config.yaml                  │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With | Typical Implementation |
|-----------|----------------|-------------------|------------------------|
| `ingest/garmin` | Authenticate, pull the 7 Garmin streams, normalize to raw rows. Owns ALL Garmin-API knowledge (auth, endpoints, rate limits, retries). | Garmin Connect (out), `store` raw tables (write-only) | Python adapter implementing a shared `IngestAdapter` protocol; caches raw JSON |
| `ingest/manual` | ≤6-tap evening log; emits events in the single event schema. Owns UX only — no interpretation. | `store.events` (write-only) | CLI first (Phase 1), tiny local web form later |
| `store` | Append-only raw tables + rebuildable derived tables; encryption at rest; migrations. The ONLY module that issues SQL. | Everything (it is the hub); exposes typed read/append functions | SQLite via stdlib `sqlite3` or SQLAlchemy Core; SQLCipher or filesystem-level encryption |
| `signals/` | Pure functions: raw → daily_facts → baselines → readiness score + freshness report. Zero I/O inside formulas (data passed in, results returned). | Reads raw via `store`, writes derived via `store` | Plain Python modules; deterministic; fully unit-testable with fixture rows |
| `signals/formulas` | Versioned readiness formula registry (`v1`, `v2`, …). Each version is frozen code + metadata (effective date, ADR link). | Called by `signals.readiness` | Module-per-version or dict registry; version stamped on every score row |
| `delivery/` | Format and send the morning one-liner, Sunday digest, disagreement intake. Computes nothing — renders what `signals` already wrote. | Reads derived tables; notification channel (ntfy/Telegram/email); LLM (digest only) | Templates + one channel adapter; LLM behind its own abstraction module |
| `scheduler/` | Cron entries (or APScheduler), heartbeat alerts on missed jobs, budget enforcement. | Invokes ingest/signals/delivery CLI entry points | OS cron + a `flow` CLI with subcommands; heartbeat via healthchecks.io-style ping or local log check |
| `config` | Budgets, channel settings, LLM tier, baseline window params. | Read by all layers | Single `config.yaml`; no inline constants for budgets/tiers (per PRINCIPLES §5) |

## Recommended Project Structure

```
flow/
├── flow/                     # Python package
│   ├── ingest/
│   │   ├── base.py           # IngestAdapter protocol (pull(date_range) -> raw rows)
│   │   ├── garmin.py         # Garmin Connect adapter (only file that knows Garmin)
│   │   └── manual.py         # quick-log entry → event rows
│   ├── store/
│   │   ├── db.py             # connections, encryption, two-file namespace split
│   │   ├── schema.py         # DDL + migrations (raw, events, derived)
│   │   └── repo.py           # append_raw(), append_event(), read/rebuild helpers
│   ├── signals/
│   │   ├── facts.py          # raw rows → daily_facts (one value per metric per day)
│   │   ├── baselines.py      # 21-day rolling mean/sd + validity flags
│   │   ├── readiness.py      # orchestrates formula registry over facts+baselines
│   │   ├── formulas/
│   │   │   ├── registry.py   # version → callable + metadata
│   │   │   └── v1.py         # frozen formula version
│   │   └── freshness.py      # input coverage report ("sauna log missing")
│   ├── delivery/
│   │   ├── morning.py        # 6:45 one-liner + emphasis
│   │   ├── digest.py         # Sunday digest (LLM narrative behind llm.py)
│   │   ├── llm.py            # LLM abstraction, tier from config
│   │   └── channel.py        # notification channel adapter (one vendor, one file)
│   ├── cli.py                # `flow sync|log|recompute|signal|digest|status`
│   └── config.py             # loads config.yaml, enforces budgets
├── config.yaml
├── docs/adr/
└── tests/                    # fixture raw rows → expected signals (replay tests)
```

### Structure Rationale

- **`ingest/` per-vendor modules behind one protocol:** swapping/adding a vendor (Open Wearables, Phase 4) touches one new file; nothing downstream changes because everything downstream reads the store, never the adapter.
- **`store/` is the only SQL owner:** keeps "append-only" enforceable in one place (repo functions expose `append_*` but no `update_*` for raw tables).
- **`signals/formulas/` as frozen version files:** formula history is code history; old versions stay importable so historical scores remain reproducible and chart annotations are derivable.
- **`delivery/` computes nothing:** the morning job can fail at the channel level without affecting computed scores; recompute and delivery are independently retryable.

## Architectural Patterns

### Pattern 1: Append-Only Raw + Disposable Derived ("event sourcing lite")

**What:** Two classes of tables. Raw tables (`raw_garmin`, `events`) are insert-only — rows are never updated or deleted; corrections are new rows. Derived tables (`daily_facts`, `baselines`, `readiness_scores`) are caches that any run may drop and rebuild.
**When to use:** Always, for every stream in this system. This is the SPEC's Isolation layer made concrete.
**Trade-offs:** Slightly more storage and a read-side "latest wins" rule; in exchange, a bad sync day or buggy formula can never destroy history — you fix the code and recompute.

**Raw Garmin schema:**
```sql
CREATE TABLE raw_garmin (
  id           INTEGER PRIMARY KEY,
  stream       TEXT NOT NULL,      -- 'hrv'|'sleep'|'body_battery'|'training_readiness'|'stress'|'activities'|'resting_hr'
  metric_date  TEXT NOT NULL,      -- the day the data describes (local date, ISO)
  pulled_at    TEXT NOT NULL,      -- when we fetched it (UTC ISO)
  payload      TEXT NOT NULL,      -- vendor JSON, untouched
  payload_hash TEXT NOT NULL,      -- sha256 of payload
  UNIQUE (stream, metric_date, payload_hash)   -- re-pull idempotency: identical payload = no-op
);
```
A re-sync of the same day either no-ops (identical payload) or appends a newer row (Garmin revised the data — e.g., sleep recalculated after a late sync). Readers take the row with max `pulled_at` per `(stream, metric_date)`.

### Pattern 2: One Event Schema for All Manual Logs

**What:** Every manual entry — sauna, perceived readiness, free note, disagreement tap, future supplements/caffeine/yoga-quality, Phase 3 practice markers — is one row in one table:

```sql
CREATE TABLE events (
  event_id       TEXT PRIMARY KEY,   -- ULID (sortable, no coordination needed)
  event_type     TEXT NOT NULL,      -- 'sauna'|'perceived_readiness'|'note'|'disagreement'|'supplement'|...
  occurred_on    TEXT NOT NULL,      -- the day it belongs to (local date)
  recorded_at    TEXT NOT NULL,      -- when logged (UTC ISO)
  schema_version INTEGER NOT NULL,   -- per-event-type payload version
  payload        TEXT NOT NULL,      -- JSON: counted fields, e.g. {"duration_min":20,"hr_recovery_note":"fast"}
  supersedes     TEXT NULL           -- event_id this corrects (append-only edits)
);
```
**When to use:** All manual ingest, all phases. New Phase 2/3 streams = new `event_type` values + payload validation, zero migrations.
**Trade-offs:** Payload is JSON, so per-type validation lives in code (a small per-type schema check at write time — the Validation layer at the door), and queries use SQLite's `json_extract`. At 1 user / ~10 events a day this costs nothing and buys total schema stability. Corrections append a row with `supersedes`; readers ignore superseded events.

**Private namespace:** Phase 3 spiritual-practice events use the **same schema in a physically separate database file** (`private.db`), opened only by explicitly namespace-aware code paths. File-level separation (not a column flag) is what makes "excluded by default" structural: export, telemetry, and digest code never even open the file unless asked. This is the strongest cheap isolation available and matches the SPEC's intent.

### Pattern 3: Idempotent Full Recompute (lambda-lite, no speed layer needed)

**What:** One command — `flow recompute [--since DATE]` — deletes derived rows in the window and rebuilds them by replaying raw rows through pure functions: `facts(raw) → baselines(facts) → readiness(facts, baselines, formula)`. Deterministic given (raw store, config, formula version). Run it after every sync; run it whole-history after any formula or bug fix.
**When to use:** This is the only recompute mode the system needs. Do **not** build incremental/streaming updates — at 1 user, replaying years of daily data is sub-second in SQLite/Python.
**Trade-offs:** None at this scale. The classic lambda architecture exists because full recompute is too slow at big-data scale; here it isn't, so you get lambda's correctness guarantee (batch layer recomputes truth) without a speed layer.

```python
def recompute(store, since=None):
    raw = store.read_raw(since=since_minus_baseline_window(since))  # need lookback for baselines
    facts = build_daily_facts(raw)              # pure
    bases = build_baselines(facts, window=21)   # pure
    scores = [score_day(d, facts, bases, FORMULAS.current) for d in days(since)]
    store.replace_derived(since, facts, bases, scores)  # one transaction
```

### Pattern 4: 21-Day Rolling Baselines with Validity Gating

**What:** For each baseline metric (HRV, sleep duration/consistency, resting HR, Body Battery refill): rolling mean and standard deviation over the trailing 21 days, computed only from days that actually have data — **missing days are excluded, never imputed** (SPEC requirement; also Elite HRV / Oura practice: compare today against your own recent normal band, typically mean ± k·sd or a CV check). A baseline row carries `n_valid_days`; it is **invalid** below a threshold (suggest ≥14 of 21), and an invalid baseline means the readiness signal degrades honestly ("baseline still forming — 9 more days") rather than guessing.
**When to use:** From day one; the 3-week recommendation gate falls out naturally — no recommendations until the first valid baseline exists.
**Trade-offs:** Cold start is silent for ~3 weeks by design. Industry tools use 7-day rolling for short-term trend and ~2-week+ for baseline formation; 21 days as the SPEC's single window is on the conservative/robust end — fine, and a 7-day rolling view can be added later as a derived chart series without touching the gate.

```sql
CREATE TABLE baselines (
  metric       TEXT NOT NULL,    -- 'hrv_rmssd'|'sleep_minutes'|'resting_hr'|...
  as_of_date   TEXT NOT NULL,
  window_days  INTEGER NOT NULL, -- 21
  n_valid_days INTEGER NOT NULL,
  mean REAL, sd REAL,
  valid        INTEGER NOT NULL, -- n_valid_days >= min_days from config
  PRIMARY KEY (metric, as_of_date)
);
```

### Pattern 5: Versioned Readiness Formula Registry

**What:** Each formula version is a frozen, importable unit (`signals/formulas/v1.py`) registered with metadata `{version, effective_date, summary, adr}`. Every `readiness_scores` row stores the `formula_version` that produced it. Historical scores keep the version they were shown under (so trend charts reflect what the operator actually saw); chart renderers draw a vertical annotation at each version's `effective_date` straight from the registry. A `flow recompute --formula v2 --shadow` mode can backfill what v2 *would have said* into a separate shadow column/table for tuning against the disagreement log, without rewriting history.
**When to use:** From the first formula. Versioning is nearly free now and impossible to retrofit honestly later.
**Trade-offs:** Mild ceremony per change (new file + ADR line) — which is exactly the friction PRINCIPLES wants for formula changes.

```sql
CREATE TABLE readiness_scores (
  score_date      TEXT PRIMARY KEY,
  score           TEXT NOT NULL,     -- 'green'|'amber'|'red' (+ numeric subscore)
  emphasis        TEXT NOT NULL,     -- 'quality 4x4'|'zone2/yoga'|'rest'
  formula_version TEXT NOT NULL,
  inputs_json     TEXT NOT NULL,     -- per-input value + freshness, drives "shows its inputs"
  computed_at     TEXT NOT NULL
);
```

## Data Flow

### Daily Loop (the Phase 1 closed loop)

```
05:30  scheduler → ingest/garmin.pull(yesterday..today)
            ↓ append rows
       store.raw_garmin  (append-only; dedup by payload_hash)
            ↓
       signals.recompute(since=21d lookback)
            facts → baselines → readiness (formula vN) → freshness report
            ↓ replace derived rows (one transaction)
       store.{daily_facts, baselines, readiness_scores}
            ↓ read-only
06:45  delivery.morning → "green — quality day for 4×4 (HRV ↑ vs baseline;
                            sleep 7h40; sauna log missing)" → channel
  ...
21:30  operator → ingest/manual (≤6 taps) → store.events
       [optional] disagreement tap → events(event_type='disagreement')
       → events recomputed into next morning's facts automatically
```

### Weekly Loop

```
Sun 19:00  scheduler → delivery.digest
   reads derived tables (trend series, formula annotations, experiment state)
   → delivery/llm.py (capped, tier from config) renders narrative
   → channel. LLM failure ⇒ template-only digest still ships (LLM is garnish,
     never in the data path).
```

**Direction rule (the load-bearing invariant):** data flows strictly left-to-right — `ingest → raw → signals → derived → delivery`. Ingest never reads derived tables; signals never call vendors; delivery never writes anything except by emitting *events* (disagreement taps go back in through the front door as events, keeping the loop closed without back-edges).

## Suggested Build Order

Dependencies run backward from delivery, so build forward from the store:

| Step | Component | Why this order |
|------|-----------|----------------|
| 1 | `store/` schema: raw_garmin, events, derived DDL, encryption choice, namespace split design | Everything writes/reads through it; this *is* Phase 0's data contract. Schema decisions here are the expensive-to-change ones. |
| 2 | `ingest/garmin` + `flow sync` | Real raw data unblocks everything downstream; surfaces auth/rate-limit risk earliest (highest-risk integration — derisk first). |
| 3 | `ingest/manual` + `flow log` | Trivial once events table exists; start logging immediately so the 3-week baseline clock starts during development. |
| 4 | `signals/` facts → baselines → readiness v1 + freshness | Pure functions over now-real data; testable with fixtures before any delivery exists. |
| 5 | `delivery/morning` + disagreement intake | Smallest visible loop closes here. |
| 6 | `scheduler/` cron + heartbeats | Makes the loop unattended (PRINCIPLES §4: loop must run 7 days unattended). |
| 7 | `delivery/digest` (+ `llm.py`) | Weekly cadence; needs ≥1 week of derived data to render anything meaningful. |
| 8+ | Phase 2 event types, experiment engine, private namespace, Open Wearables adapter | All slot in without structural change: new event_type values, new signals modules, new adapter file. |

Note the happy accident in steps 2–3: because baselines need 21 days of data, getting ingest running *before* signals are finished means the baseline gate may already be satisfied when the morning signal first ships.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mutating raw rows ("fix the bad sync in place")
**What people do:** UPDATE the raw row when Garmin re-delivers corrected data or a parse bug is found.
**Why it's wrong:** Destroys replayability; you can no longer prove what the operator was shown or rerun history under a new formula.
**Do this instead:** Append the new payload (dedup hash makes it cheap); fix parse bugs in `signals/facts.py` and recompute.

### Anti-Pattern 2: Incremental baseline state ("running mean updated nightly")
**What people do:** Keep a stored running average and nudge it each day.
**Why it's wrong:** Stored mutable state drifts when a day is missed, double-counts on re-sync, and can't be audited — the exact "bad sync day corrupts baselines" failure the SPEC forbids.
**Do this instead:** Recompute the full 21-day window from raw every run. It's milliseconds.

### Anti-Pattern 3: Per-stream manual-log tables
**What people do:** `sauna_logs`, `readiness_ratings`, `notes` tables, each with its own migration.
**Why it's wrong:** Every Phase 2/3 stream becomes a migration + repo + UI plumbing change; schema churn is the enemy of an append-only contract.
**Do this instead:** One `events` table (Pattern 2) with per-type payload validation in code.

### Anti-Pattern 4: Computation in delivery / LLM in the data path
**What people do:** The morning-message code computes the score, or the digest asks the LLM to "analyze" raw data.
**Why it's wrong:** Scores become unreproducible and unversionable; LLM outage or hallucination corrupts the signal the operator must trust.
**Do this instead:** `signals/` writes scores with formula_version; delivery renders rows verbatim; LLM only paraphrases already-computed digest facts.

### Anti-Pattern 5: Private namespace as a column flag
**What people do:** `events.is_private = 1` in the shared DB.
**Why it's wrong:** One forgotten WHERE clause in export/telemetry/digest leaks the most sensitive data; "excluded by default" must be structural, not query discipline.
**Do this instead:** Separate `private.db` file, opened only by explicitly namespace-aware code (Pattern 2).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (Phases 0–4) | SQLite + full recompute is comfortably sufficient; years of daily data is a few MB. No services, no queues, no incremental computation. |
| Phase 5 (multi-tenant, gated) | The boundaries already isolate the work: DB-per-user (SQLite still viable) or swap `store/` internals for Postgres; adapters/signals/delivery unchanged because nothing else issues SQL. Do **not** pre-build for this. |

**First real bottleneck:** not compute — it's logging friction and Garmin auth reliability. Architecture answer: adapter caches tokens and degrades gracefully (freshness report says "Garmin stale 2 days" instead of failing the morning signal).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Garmin Connect | Single adapter `ingest/garmin.py` behind `IngestAdapter` | **Risk flag (MEDIUM confidence):** Garmin's official Health API requires developer-program approval aimed at companies. Personal projects overwhelmingly use the unofficial `garminconnect` Python library (Connect SSO/OAuth token flow, token caching, covers HRV/sleep/Body Battery/Training Readiness/stress/activities/RHR — all 7 Phase 1 streams). GarminDB is the fallback precedent. Decision belongs in Phase 0's data-contract ADR; the adapter boundary means the choice (or a later switch) touches one file. |
| Open Wearables (Phase 4) | New `ingest/openwearables.py` implementing the same protocol, writing the same raw-row shape | Zero downstream change by construction — this is the test that the ingest interface was drawn correctly. |
| Notification channel | One adapter file (`delivery/channel.py`) | ntfy/Telegram/email — pick one in Phase 1; vendor swap = one file per PRINCIPLES. |
| LLM (weekly digest only) | `delivery/llm.py`, tier + cap from config | Never in the readiness path; digest must ship template-only on LLM failure. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| ingest → store | Function calls: `append_raw()` / `append_event()` only | No update/delete API exists for raw tables — append-only enforced at the repo layer, not by convention. |
| store → signals | Typed read functions; signals receive plain rows, return plain results | Keeps formulas pure/replayable; fixture-based tests need no DB. |
| signals → delivery | Derived tables only (readiness_scores incl. inputs_json) | Delivery is read-only over derived; the freshness string is precomputed, not assembled at send time. |
| delivery → store | Only via `append_event()` (disagreement taps) | Closes feedback loop #2 without a back-edge. |
| flow.db ↔ private.db | No joins, no shared connections | Cross-namespace correlation (if ever wanted) is an explicit, opt-in read in signals — never automatic. |

## Sources

- [GarminDB — Garmin → SQLite, Python, mature open-source precedent](https://github.com/tcgoetz/GarminDB) (HIGH — closest prior art for this exact pipeline shape)
- [python-garminconnect — unofficial Garmin Connect API wrapper](https://github.com/cyberjunky/python-garminconnect) and [PyPI](https://pypi.org/project/garminconnect/) (MEDIUM — unofficial; verify endpoint coverage in Phase 0)
- [Garmin Health API developer program (official, partnership-gated)](https://developer.garmin.com/gc-developer-program/health-api/) (HIGH for the constraint that official access is gated)
- [Event Sourcing with SQLite: append-only design](https://www.sqliteforum.com/p/event-sourcing-with-sqlite) and [eventsourcing Python library SQLite backend](https://eventsourcing.readthedocs.io/en/v9.3.1/_modules/eventsourcing/sqlite.html) (MEDIUM — pattern validation)
- [Quantified-self warehouse patterns: DuckDB + dbt common data model](https://dev.to/beck_moulton/quantified-self-20-build-a-unified-health-data-warehouse-with-duckdb-and-dbt-1a05) (LOW–MEDIUM — corroborates ELT-into-embedded-store as the norm)
- [Elite HRV: 7-day rolling average & CV](https://help.elitehrv.com/article/355-what-is-the-hrv-7-day-rolling-average-and-coefficient-of-variation), [How the HRV baseline works](https://help.elitehrv.com/article/74-how-the-hrv-baseline-works), [Oura HRV Balance](https://ouraring.com/blog/hrv-balance/) (MEDIUM — industry baseline-formation practice: own-recent-normal comparison, ~2-week+ formation window, gate readiness until formed)

---
*Architecture research for: Flow — local-first personal wellness/readiness system*
*Researched: 2026-06-10*
