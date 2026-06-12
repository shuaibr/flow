# Pitfalls Research

**Domain:** Personal wellness / quantified-self system (Garmin ingestion + manual logging + daily readiness scoring), single-operator, local-first
**Researched:** 2026-06-10
**Confidence:** HIGH on Garmin access constraints and HRV/readiness science; MEDIUM-HIGH on abandonment, missing-data, and ops pitfalls (peer-reviewed + community sources, some single-source).

> Scope note: "Flow" is single-user, local-first, privacy-by-architecture, with an explicit kill criterion (>3 min/day logging OR 10 skipped days/month → simplify before adding). Pitfalls below are filtered for *this* project, not generic SaaS advice. Phase references map to SPEC.md phases 0–5.

---

## Critical Pitfalls

### Pitfall 1: Assuming the official Garmin Connect Developer Program is an option for personal use

**What goes wrong:**
The team architects Phase 0/1 around the official Garmin Health/Connect API (clean OAuth2 PKCE, push webhooks, 2-year backfill) — then discovers the program is enterprise-only and rejects individual applicants. The entire ingestion design has to be redone late, against an unofficial reverse-engineered library with very different constraints.

**Why it happens:**
The official docs *look* like a normal developer program (sign-up form, OAuth2 spec, FAQ promising approval in two business days). The disqualifier — "you must apply as a legal entity (company, university, hospital, research institution); the program does not support personal use" — is easy to miss until the application is denied.

**How to avoid:**
Decide in **Phase 0** that ingestion runs on the unofficial path (e.g. `cyberjunky/python-garminconnect`, which authenticates via the mobile SSO flow and stores DI OAuth bearer tokens at `~/.garminconnect/garmin_tokens.json`). Treat the official API as a *deferred Phase 5 productization concern* only, gated behind forming a legal entity. Put both facts in the Phase 0 data-contract / privacy ADR so the assumption is explicit and not silently revisited.

**Warning signs:**
A plan task says "register Garmin developer app," "set up webhook endpoint," or "request production tier." Any of these implies the official program and should trigger a stop.

**Phase to address:** Phase 0 (data contract + ingest-adapter decision).

---

### Pitfall 2: Treating the unofficial Garmin auth flow as stable — login-rate-limit (429) account lockouts and MFA breakage

**What goes wrong:**
The daily sync logs in fresh each run, or retries aggressively on failure. Garmin's SSO endpoints respond with **429 Too Many Requests**, and the block is applied **at the account level (not IP)** for 48+ hours — locking the operator out of their own data and even the Garmin mobile app. Separately, MFA-enabled accounts hit "OAuth1 token is required for OAuth2 refresh" and fail on profile fetch, making unattended daily sync impossible.

**Why it happens:**
Developers model the unofficial API like a normal REST API (log in → call → repeat). But login is the rate-limited chokepoint, not the data calls. Auth flows also break without warning when Garmin changes their SSO (this already killed the `garth` library and forced `python-garminconnect` to switch to a mobile-SSO + curl_cffi Chrome-TLS-impersonation strategy to pass Cloudflare fingerprinting).

**How to avoid:**
- **Persist and reuse tokens.** Log in *once*, cache the token bundle, and let the library auto-refresh the DI token indefinitely. A full credential re-login should be rare (only when the refresh token is revoked). Never log in per-sync.
- **Single scheduled sync/day + on-demand**, exactly as SPEC constrains — and add exponential backoff with a hard ceiling so a transient failure never becomes a retry storm that triggers a lockout.
- **Avoid MFA on the sync account if feasible**, or design for the documented MFA-token limitation; do not assume MFA "just works" for headless sync.
- **Pin the library version** and treat an auth-flow break as an expected maintenance event (the adapter is behind the ingest interface, so a swap is contained).

**Warning signs:**
Any 429 in sync logs; sync code that calls a `login()` path on every run; a token file that changes every execution; the operator reporting they can't log into the Garmin app.

**Phase to address:** Phase 0 (auth/token-persistence design) + Phase 1 (sync scheduling, backoff, heartbeat).

---

### Pitfall 3: Readiness signal that overreacts to single-day HRV noise

**What goes wrong:**
The morning signal flips green↔amber↔red day-to-day chasing raw overnight HRV. Day-to-day HRV variation of **10–30% is physiologically normal** (sleep, hydration, alcohol, stress, training load). A signal that reacts to it is noise — and the SPEC is explicit that "a noisy signal is worse than none." The operator stops trusting it within weeks; the core value proposition dies.

**Why it happens:**
It's intuitive to score "today's HRV vs yesterday." Commercial scores (WHOOP/Oura) are opaque and some research finds near-zero correlation between recovery scores and meaningful outcomes — so naïvely copying them imports their noise.

**How to avoid:**
- Score **today's reading against a personal rolling baseline** (7-day rolling average for trend, ~30-day for baseline), never against population norms or yesterday.
- Require **3+ consecutive days below baseline** before flagging accumulated stress, rather than reacting to one dip.
- Honor the SPEC's **3-week baseline gate**: surface NO recommendation until ≥3 weeks of data exist.
- Show **inputs and freshness** on every signal (already in SPEC) so the operator can sanity-check.
- **Version the readiness formula** and annotate changes on charts, so a trend break is explainable rather than mysterious.

**Warning signs:**
The signal changes category most days; the disagreement log ("felt wrong today") fires frequently; baseline window shorter than 7 days; formula reads `today vs yesterday`.

**Phase to address:** Phase 1 (signal computation + 3-week gate); ongoing tuning Phase 3 (disagreement-driven).

---

### Pitfall 4: Baseline contamination from sick days, travel, and alcohol

**What goes wrong:**
A week of illness, travel, or heavy drinking is silently folded into the rolling baseline. HRV and skin-temperature shifts during illness are large (Oura uses temp deviation as an early illness sign). Contaminating the baseline makes the *recovered* state read as "below baseline" for weeks afterward, producing persistently wrong signals.

**Why it happens:**
The baseline is computed as a blind rolling average over all stored days. There's no concept of "this day was anomalous, exclude it from baseline."

**How to avoid:**
- Allow the manual log to mark a day as **sick / travel / anomalous** (one tap), and **exclude flagged days from baseline computation** while still storing them append-only.
- Detect candidate anomalies automatically (e.g. sustained HRV suppression, overnight temp spike) and surface a "consider checking with a professional" flag — never a diagnosis (hard constraint #1) — and optionally prompt to exclude from baseline.
- Because raw pulls are append-only and signals are *recomputed* (SPEC isolation layer), excluding a day is a recompute concern, never a data edit. Keep recompute idempotent.

**Warning signs:**
Baseline computation has no exclusion path; readiness stays amber/red for a week+ after the operator feels fully recovered; no "sick/travel" affordance in the log.

**Phase to address:** Phase 1 (baseline exclusion hook in the schema + recompute); refinement Phase 3.

---

### Pitfall 5: Logging friction crosses the kill threshold → abandonment

**What goes wrong:**
The evening log creeps past 6 taps / 2 minutes (free-text fields, extra questions, "while we're here" additions). Self-tracking-abandonment research identifies **perceived data inaccuracy/uselessness and loss of motivation** as the dominant permanent-abandonment drivers — and friction accelerates both. The operator skips logging; missing manual data degrades the signal; the loop collapses. This is the SPEC's named **Bottleneck #1** and the explicit kill criterion (>3 min/day OR 10 skipped days/month).

**Why it happens:**
Each individual field seems cheap. Free-text "feels nice to have." Phase 2/3 streams (supplements, caffeine, yoga quality, practice markers) get bolted onto the *same* daily log instead of being justified by demonstrated value.

**How to avoid:**
- **Counted/tap fields, not free text** (SPEC constraint). Cap the optional free note at one, clearly optional.
- **Instrument logging time and skip-streak from day one** — the kill criterion is unmeasurable otherwise. Make ">3 min" and "10 skips/month" computed metrics that surface in the Sunday digest.
- **The log must pay for itself daily** via the morning signal (SPEC incentive). If a logged field never influences the signal or a candidate pattern, it's a candidate for removal.
- Gate every new Phase 2/3 field behind "does this earn its tap?" Default to *fewer* fields.
- Treat skipped-log analysis as a first-class feedback loop (SPEC loop #3) → simplify, don't add.

**Warning signs:**
Measured log time trending up; any skip streak ≥3 days; a plan that adds log fields without removing any; free-text fields multiplying.

**Phase to address:** Phase 1 (minimal log + instrumentation); enforced as a gate in every later phase.

---

### Pitfall 6: Silent scheduled-job failure — the sync that quietly stopped

**What goes wrong:**
The daily Garmin sync (or weekly digest job) fails — cron didn't run, the machine slept, the token expired, a 429 lockout hit — and **nobody is told**. Backend scheduled tasks fail silently and can stall for days or weeks before anyone notices. The operator keeps trusting a 6:45am signal computed on stale data, or gets no signal and assumes "nothing to report." Both erode trust irreparably.

**Why it happens:**
Default cron emails an MTA nobody reads, and crucially **won't fire at all if the machine is off or offline** — exactly the failure you most need to know about. Success is invisible; only the *absence* of success matters.

**How to avoid:**
- Implement a **dead-man's-switch / heartbeat**: the sync pings a monitoring endpoint *only on success* (`sync && curl <ping-url>`), with a grace period above expected duration. No ping → you get alerted. This catches machine-down, cron-not-running, non-zero exit, and over-long runs — which plain error-handling misses.
- This is already a hard project process rule ("scheduled jobs get heartbeat alerts" / "missed-sync and missed-digest alerts"). Make it a Phase 1 acceptance criterion, not Phase 4 hardening.
- Surface **data freshness on the morning signal** (SPEC validation layer) so a stale signal is self-evident even if the alert is missed.

**Warning signs:**
No heartbeat/monitoring task in the Phase 1 plan; alerting relies on cron MAILTO; the signal doesn't display "last synced" timestamp.

**Phase to address:** Phase 1 (heartbeat + freshness display); not deferrable to Phase 4.

---

## Moderate Pitfalls

### Pitfall 7: Imputing missing data instead of flagging it

**What goes wrong:**
A night the watch wasn't worn produces a gap. The system interpolates/imputes a value to "keep the chart pretty," and the readiness signal silently treats a guess as a measurement. This directly violates the SPEC's "missing-data honesty over imputation" and "imputation of missing data" out-of-scope rule.

**Why it happens:**
Imputation is a well-published technique for wearable gaps, so it feels like best practice; gaps also make charts and averages look "broken."

**How to avoid:** Embrace gaps as first-class. The signal **degrades gracefully and says what's missing** ("HRV from last night, sauna log missing") rather than filling. Exclude missing inputs from that day's score; never synthesize. Display gaps honestly on trend charts.

**Phase to address:** Phase 1 (signal + display); reinforced Phase 2 as streams grow.

---

### Pitfall 8: Garmin 7-day server retention assumption / backfill misuse

**What goes wrong:**
Even on the unofficial path, Garmin-side data is short-lived (the official Health API retains only ~7 days from upload; backfill is the path to history and is rate/window-limited). A design that lazily re-fetches from Garmin on demand, or assumes history is always queryable, loses data permanently once it ages out.

**Why it happens:** Assuming the wearable cloud is a durable store. It is a sync buffer.

**How to avoid:** **Archive everything locally on first pull, append-only** (already the SPEC isolation principle). The local store is the source of truth; Garmin is a transient upstream. Pull daily so nothing ages out; treat backfill as a one-time bootstrap, not a routine.

**Phase to address:** Phase 0 (store design) + Phase 1 (daily pull + bootstrap backfill).

---

### Pitfall 9: Encryption-at-rest done wrong (or skipped) for the most sensitive data

**What goes wrong:**
SQLite has **no built-in encryption** — a plain DB file (plus its `-wal` and `-shm` sidecars) sits readable on disk. Health data is the most sensitive data in the project (hard constraint #2). A lost/stolen device or an unencrypted backup is a full health-data breach. A second failure mode: hardcoding the encryption passphrase in the repo, which negates the encryption.

**Why it happens:** "It's local, so it's safe" — but local-first *increases* device-loss risk while removing server-side controls.

**How to avoid:**
- Use **SQLCipher** (transparent AES-256 over the whole DB including WAL/journal), not app-layer field encryption bolted on later.
- **Never hardcode the key.** Use OS secret storage or a user-provided passphrase; key management is the actual hard part.
- `chmod 600` the DB and all sidecar files; private directory.
- Keep the **spiritual-practice namespace separately isolated** and excluded from any future telemetry by default (hard constraint #2) — design the namespace boundary in Phase 0, not retrofitted.
- Ensure **export/delete** actually covers all files and the encrypted store (explicit requirement).

**Phase to address:** Phase 0 (encryption + key-management + namespace ADR).

---

### Pitfall 10: Scope creep toward dashboards instead of decisions

**What goes wrong:**
The project drifts into building charts, graphs, and a "personal analytics dashboard." This produces **dashboard fatigue** — "looking at a beautiful color-coded graph and thinking 'so what?'" — collecting numbers for their own sake. The SPEC is emphatic: "the system's job is integration and learning loops, **not more dashboards**." The operator already has Garmin Connect's dashboards.

**Why it happens:** Dashboards are satisfying to build and demo, and each new stream "wants" a chart. It feels like progress while sidestepping the hard part (turning data into one trusted decision).

**How to avoid:**
- Anchor everything to **two outputs**: the 6:45am one-line signal + emphasis, and the Sunday narrative digest (one trend chart, one candidate pattern, one focus). That's the whole UI surface.
- New visualization needs an explicit "what decision does this change?" justification. If the answer is "it's nice to see," it's out of scope.
- LLM is **only** for the weekly narrative digest, capped, model-tier in config (SPEC). Don't let "AI insights" metastasize into a chat-with-your-data feature.

**Warning signs:** Plans mention "dashboard," "charts page," multiple graphs, a web UI with navigation; LLM usage outside the weekly digest.

**Phase to address:** Roadmap-level guardrail; especially Phase 2 (when streams multiply) and Phase 4.

---

## Minor Pitfalls

### Pitfall 11: Post-hoc storytelling in the experiment / pattern engine

**What goes wrong:** Correlations get "discovered" after the fact and narrated as causal ("sauna improved my sleep!") without a pre-registered hypothesis. With ~8 streams, spurious cross-correlations are abundant.

**How to avoid:** Enforce SPEC's rules: experiments are **pre-registered (hypothesis + metric) before** data collection; ONE active experiment at a time; candidate patterns need **3+ weeks of evidence** before promotion. The engine should refuse to "conclude" without a pre-registered metric.

**Phase to address:** Phase 2 (experiment engine).

---

### Pitfall 12: Medical-interpretation creep

**What goes wrong:** A flag drifts from "consider checking with a professional" toward implied diagnosis ("your HRV suggests overtraining/illness"). Violates hard constraint #1 (not a medical device).

**How to avoid:** Anomaly outputs are **flags, never interpretations**. Keep copy templated and reviewed. No treatment/medication/diagnosis language, ever.

**Phase to address:** Phase 1 (anomaly flagging copy); audited each phase.

---

### Pitfall 13: Recompute that isn't idempotent / hand-editing derived signals

**What goes wrong:** A bad sync day or a manual "fix" to a derived value corrupts baselines irreversibly.

**How to avoid:** Raw pulls append-only; **derived signals always recomputed from raw, never hand-edited; recompute idempotent** (SPEC isolation layer). A bad day must be recoverable by re-running, not by editing.

**Phase to address:** Phase 0/1 (store + recompute design).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Log in to Garmin every sync run | Simpler code, no token cache | Account-level 429 lockout (48h+), loses own data | Never |
| Skip heartbeat monitoring in Phase 1 | Ship sync faster | Silent stale-data signal erodes trust irreparably | Never (SPEC mandates it) |
| Plain SQLite, "encrypt later" | Faster Phase 1 start | Health-data breach on device loss; retrofit touches every file/WAL | Never for health data |
| Impute missing nights | Prettier charts/averages | Guesses presented as measurements; violates SPEC | Never |
| Add Phase 2 fields to the daily log without removing any | Richer data | Crosses kill threshold → abandonment | Only if measured log time stays <2 min |
| Free-text fields "for flexibility" | Feels expressive | Friction + un-analyzable data | One optional note max |
| Score today vs yesterday | Trivial to implement | Noisy signal → operator stops trusting it | Never; use rolling baseline |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Garmin (official program) | Applying as an individual / building on it for personal use | It's enterprise/legal-entity only; use unofficial lib for personal, defer official to gated Phase 5 |
| Garmin (unofficial lib) | Aggressive retries / per-run login | Persist tokens, auto-refresh, 1 sync/day, backoff with ceiling |
| Garmin auth flow | Assuming stability | Pin version; expect SSO breakage; isolate behind ingest interface for swap |
| Garmin MFA account | Assuming headless sync works | Documented MFA refresh-token breakage; design around it or avoid MFA on sync account |
| Garmin data window | Treating cloud as durable store | ~7-day retention; archive locally on first pull, append-only |
| Cloudflare fingerprinting | Plain HTTP client gets blocked | Library uses curl_cffi Chrome-TLS impersonation; don't strip it |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Unencrypted SQLite + WAL/shm on disk | Full health-data breach on device loss | SQLCipher whole-DB AES-256; chmod 600 all files |
| Hardcoded DB passphrase | Encryption is nullified | OS secret store or user passphrase; never in repo |
| Garmin tokens in plaintext in repo/backup | Account compromise | Store outside repo; gitignore `~/.garminconnect/`; treat as secret |
| Spiritual namespace mixed into main store/telemetry | Violates extra-private design | Separate namespace, excluded from telemetry by default + by design (Phase 0) |
| Export/delete misses encrypted store or sidecars | Incomplete "right to delete" | Verify export/delete covers DB, WAL, tokens, all namespaces |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Signal flips daily on HRV noise | Operator stops trusting it (noisy > none) | Rolling baseline + 3-consecutive-day rule + 3-week gate |
| Recommendation before baseline exists | Early wrong calls poison trust permanently | Surface NO recommendation until 3 weeks of data |
| Alert fatigue (too many flags/notifications) | Anxiety, then ignored entirely | Sparse output: one morning line, one weekly digest; flags rare |
| Log feels like a chore | Skipped days → loop collapse | ≤6 taps, counted fields, pays for itself via morning signal |
| Dashboards instead of a decision | "So what?" fatigue, no behavior change | Two outputs only: morning signal + weekly narrative |

## "Looks Done But Isn't" Checklist

- [ ] **Garmin sync:** Often missing token persistence + backoff — verify it logs in once and survives a forced 429 without retry-storming.
- [ ] **Scheduled jobs:** Often missing heartbeat — verify killing the job/turning off the machine produces an alert (dead-man's switch), not silence.
- [ ] **Readiness signal:** Often missing the baseline gate — verify it surfaces nothing before 3 weeks and uses a rolling (not yesterday) baseline.
- [ ] **Missing data:** Often silently imputed — verify a watch-not-worn night shows as "missing," not a synthesized number.
- [ ] **Encryption:** Often missing WAL/shm coverage and key management — verify the DB *and* sidecars are encrypted and the key isn't in the repo.
- [ ] **Baseline contamination:** Often missing the exclude-anomalous-day path — verify a flagged sick/travel day is excluded from baseline but still stored.
- [ ] **Kill-criterion instrumentation:** Often missing — verify log-time and skip-streak are actually measured and reported.
- [ ] **Export/delete:** Often missing the encrypted store and tokens — verify a delete truly removes all health data.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Garmin account 429 lockout | LOW (time) | Stop all login attempts; wait out 48h block; fix to token-reuse + backoff before resuming |
| Built on official API assumption | HIGH | Re-architect ingest onto unofficial lib; contained if behind ingest interface, else costly |
| Contaminated baseline | LOW | Flag the bad days, recompute (idempotent) — only works if recompute-from-raw exists |
| Imputed values shipped | MEDIUM | Purge synthesized values, recompute from raw with gaps honored |
| Unencrypted store discovered late | MEDIUM-HIGH | Migrate to SQLCipher, rotate any exposed tokens, re-key; touches all DB access |
| Logging abandonment | MEDIUM | Run skipped-log analysis; cut fields to bare minimum; re-validate <2 min before adding back |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Official-API assumption (1) | Phase 0 | ADR states unofficial path; no "register dev app" tasks |
| Garmin auth fragility / 429 / MFA (2) | Phase 0 + 1 | Force-fail test: token reuse holds, backoff prevents lockout |
| HRV noise overreaction (3) | Phase 1 | Signal uses rolling baseline; stable across a normal ±15% day |
| Baseline contamination (4) | Phase 1 (+3) | Flagged day excluded from baseline, still stored |
| Logging friction → abandonment (5) | Phase 1 (gate all phases) | Measured log time <2 min; skip-streak tracked |
| Silent job failure (6) | Phase 1 | Dead-man's-switch fires on simulated outage |
| Imputation (7) | Phase 1 | Missing night displays as missing |
| Garmin 7-day retention (8) | Phase 0 + 1 | Local append-only store is source of truth |
| Encryption/key mgmt (9) | Phase 0 | SQLCipher + sidecars + key not in repo; namespace isolated |
| Dashboard scope creep (10) | Roadmap guardrail (esp. 2, 4) | UI is morning line + weekly digest only |
| Post-hoc storytelling (11) | Phase 2 | Experiments require pre-registered hypothesis+metric |
| Medical creep (12) | Phase 1 (audit each) | Anomaly copy is flag-only, no interpretation |
| Non-idempotent recompute (13) | Phase 0/1 | Re-running recompute yields identical signals |

## Sources

Garmin program / API access (HIGH — official + multiple corroborating):
- [Garmin Connect Developer Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)
- [Garmin Health API docs](https://developer.garmin.com/gc-developer-program/health-api/)
- [Garmin: New Backfill history limits per user](https://developerportal.garmin.com/blog/new-backfill-history-limits-user)
- [Open Wearables — Garmin API Integration](https://docs.openwearables.io/providers/garmin-api-integration) (notes program is enterprise-only, apply as legal entity)

Unofficial library fragility / 429 / MFA / Cloudflare (HIGH — primary issue trackers):
- [python-garminconnect #337 — 429 during login](https://github.com/cyberjunky/python-garminconnect/issues/337)
- [python-garminconnect #344 — SSO widget to bypass 429](https://github.com/cyberjunky/python-garminconnect/issues/344)
- [python-garminconnect #312 — MFA OAuth1 refresh failure](https://github.com/cyberjunky/python-garminconnect/issues/312)
- [Garmin Forums — persistent 429, account blocked 48h+](https://forums.garmin.com/developer/fit-sdk/f/discussion/435087/persistent-429-on-api-login-account-blocked-for-48-hours)
- [matin/garth — DEPRECATED after Garmin auth change](https://github.com/matin/garth)

HRV / readiness science (HIGH/MEDIUM — clinical + practitioner):
- [Elite HRV — 7-day rolling average & coefficient of variation](https://help.elitehrv.com/article/355-what-is-the-hrv-7-day-rolling-average-and-coefficient-of-variation)
- [Marco Altini — Ultimate Guide to HRV Part 2](https://medium.com/@altini_marco/the-ultimate-guide-to-heart-rate-variability-hrv-part-2-323a38213fbc)
- [WHOOP HRV day-to-day variability study (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9505647/)
- [Composite health scores in consumer wearables — evaluation](https://www.degruyterbrill.com/document/doi/10.1515/teb-2025-0001/html)
- [Should you trust your wearable? (recovery-score critique)](https://rachelepojednic.substack.com/p/should-you-trust-your-wearable-what)

Abandonment / dashboard fatigue (MEDIUM — peer-reviewed + practitioner):
- [Why Do People Abandon Activity Trackers? (user diversity)](https://www.researchgate.net/publication/360361258_Why_Do_People_Abandon_Activity_Trackers_The_Role_of_User_Diversity_in_Discontinued_Use)
- [Abandonment of personal quantification (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0747563219303127)
- [Beyond Abandonment to Next Steps (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5428074/)
- [Quantified to qualitative self — dashboard fatigue](https://medium.com/@ann_p/from-quantified-self-to-qualitative-self-ai-shifting-focus-in-personal-analytics-68209a851322)

Missing-data handling (MEDIUM):
- [Handling Missing Data in Time-Series Wearables (IntechOpen)](https://www.intechopen.com/chapters/1154877)
- [LSM-2: learning from incomplete wearable data (Google Research)](https://research.google/blog/lsm-2-learning-from-incomplete-wearable-sensor-data/)

Ops / monitoring (HIGH):
- [Healthchecks.io — monitoring cron jobs](https://healthchecks.io/docs/monitoring_cron_jobs/)
- [Why cron jobs fail silently — heartbeat monitoring](https://www.watchflow.io/blog/why-cron-jobs-fail-silently/)
- [5 Ways Your Cron Jobs Are Failing Silently (dev.to)](https://dev.to/deadping/5-ways-your-cron-jobs-are-failing-silently-and-how-to-catch-them-2njp)

Encryption / local-first security (HIGH/MEDIUM):
- [Best practices for securing SQLite](https://blackhawk.sh/en/blog/best-practices-for-securing-sqlite/)
- [SQLCipher encryption how-to (OneUptime)](https://oneuptime.com/blog/post/2026-02-02-sqlcipher-encryption/view)
- [SQLite security & hardening — encryption, backups, OWASP](https://zuniweb.com/blog/sqlite-security-and-hardening-encryption-backups-and-owasp-best-practices/)

---
*Pitfalls research for: personal wellness / quantified-self readiness system (Flow)*
*Researched: 2026-06-10*
