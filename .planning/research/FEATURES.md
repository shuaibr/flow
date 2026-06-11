# Feature Research

**Domain:** Personal readiness/recovery system (wearable fusion + manual logging + n=1 experiments), single-user
**Researched:** 2026-06-10
**Confidence:** MEDIUM-HIGH (web-verified across multiple current product sources; no Context7-relevant libraries for feature research)

## Competitive Landscape Summary

Every major readiness product (Whoop, Garmin Training Readiness, Oura, Athlytic, Bevel, HRV4Training) converges on the same core: **one morning score (0–100) with a color band, derived from overnight HRV + sleep + recent load, with a baseline period before scores are trusted**. That convergence defines table stakes.

The universal, well-documented complaints — and therefore the open differentiation space — are:

1. **Black-box scoring.** No major vendor discloses how scores are calculated; Garmin's Training Readiness weighting is hidden, so "when the score sits in amber after a rough night, you genuinely cannot tell how much of that is the sleep versus something else" (the5krunner, Pojednic substack).
2. **Scores surface too early / degrade silently.** Vendors report scores before baselines are solid "to make consumers happy," and quietly compute with missing inputs rather than saying so.
3. **No fusion of manual context.** Garmin can't see sauna, yoga quality, supplements, or perceived readiness. Oura Tags and HRV4Training's morning questionnaire are the closest, but tags annotate trends — they don't feed the score.
4. **No real experiment discipline.** Oura "Experiments" are canned 14-day templates; Exist.io finds open-ended correlations (post-hoc storytelling risk); Reflect does pre-registered n=1 experiments but doesn't compute a readiness signal. Nobody combines a readiness signal with a pre-registered single-variable experiment engine.
5. **No feedback loop on the score itself.** No mainstream product has a "this score felt wrong" channel that tunes the formula.

**Why build Flow instead of using stock Garmin Training Readiness:** Garmin already produces a competent objective score (and Flow ingests it as an input). What Garmin cannot do: (a) show its inputs and their freshness, (b) incorporate sauna/yoga/perceived-readiness/lifestyle context, (c) run pre-registered experiments, (d) accept disagreement feedback and version its formula, (e) be honest about missing data, (f) know the operator's fixed schedule, (g) keep a private practice namespace. Flow's value is the *trustworthy, transparent, context-aware* layer on top — integration and learning loops, not a competing dashboard.

## Feature Landscape

### Table Stakes (the loop dies without these)

Features every readiness product has; missing any of these and the daily loop doesn't close.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Daily wearable sync into a local store | All competitors auto-ingest; manual data entry of objective metrics kills the loop instantly | MEDIUM | Garmin Connect: official Health API is push-to-callback OAuth (needs a registered endpoint); community `garminconnect` (PyPI) pulls HRV, sleep stages, Body Battery, Training Readiness, stress, RHR, activities. One scheduled sync/day + on-demand per SPEC. Append-only raw store. |
| Single composite readiness score with color band (green/amber/red) | Universal pattern: Whoop Recovery % (green/yellow/red), Oura Readiness 0–100, Garmin TR 0–100. Users act on the band, not the number | MEDIUM | Pure function over the store; recompute idempotent. Start simple (few inputs, transparent weights) — complexity is the enemy of trust. |
| Baseline calibration period before any recommendation | Whoop withholds early scores; HRV4Training needs 4 days for baseline + ~2 months for "normal range"; Garmin advises 3–4 weeks of overnight wear before trusting TR | MEDIUM | SPEC mandates 3 weeks — in line with industry. During baseline, show data collected + days remaining, never a recommendation. |
| Actionable emphasis attached to the score | Whoop Strain Coach, Garmin daily workout suggestions, HRV4Training "proceed as planned / limit intensity" — a bare number isn't actionable | LOW | One line: "green — quality day for 4×4" / "amber — Zone 2 or yoga only." Maps band → emphasis. |
| Fixed-time morning delivery | The score is only useful before the day's first decision; every product leads with a morning report | LOW-MEDIUM | 6:45am hard deadline (pre-Quran-class/gym). Needs scheduled job + heartbeat alert on failure (a silent miss breaks trust fastest). |
| Quick manual context log | Oura Tags, HRV4Training morning questionnaire, Reflect forms, Exist custom tags — subjective context is standard | LOW-MEDIUM | ≤6 taps, ≤2 min: sauna y/n + duration + HR-recovery note, perceived readiness 1–5, optional note. Counted fields, one schema for all entries. Friction here is Bottleneck #1 per SPEC. |
| Trend visualization | All products show 7-day/monthly trends; users need to see direction, not just today | LOW | Weekly chart in Sunday digest is sufficient for v1 — no interactive dashboard needed. |
| Perceived/subjective readiness capture | HRV4Training's questionnaire and Whoop journal show subjective input is expected and is also the calibration target | LOW | The 1–5 perceived readiness in the evening log doubles as ground truth for later formula tuning. |
| Data export & delete | Privacy table stakes for health data; Reflect/local-first apps lead with it | LOW | Explicit export/delete per SPEC privacy constraint. Cheap if built early (single store, one schema); painful retrofitted. |

### Differentiators (competitive advantage vs stock Garmin / market)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Input transparency + freshness display | Directly attacks the #1 documented complaint about every readiness product: black-box scores. "HRV from last night; sauna log missing" makes the signal auditable, which is the core value (trust) | MEDIUM | Each score carries provenance: per-input value, timestamp, weight contribution. This is *the* differentiator — design the score data structure around it from day one. |
| Missing-data honesty (graceful degradation, no imputation) | Competitors silently compute with stale/missing inputs; users discover this only when scores feel wrong. Flow says "amber*, computed without last night's HRV" | MEDIUM | Score must define behavior per missing input: degrade confidence, widen band, or abstain. Cheaper than imputation and builds trust. Depends on input-transparency structure. |
| Manual context fused INTO the signal | Oura Tags annotate; HRV4Training asks but barely adjusts. Fusing sauna/yoga-quality/perceived readiness into the score is what Garmin structurally cannot do | MEDIUM-HIGH | Phase the fusion: Phase 1 displays manual context alongside the objective score; only weight it into the formula once baseline correlations justify it (avoid hand-tuned magic numbers). |
| Pre-registered single-variable experiment engine | Oura Experiments = canned templates; Exist = post-hoc correlation dredging; Reflect = closest (n=1, predictions vs outcomes) but no readiness signal. Pre-registration (hypothesis + metric declared up front, ONE active at a time) is genuinely novel in this space | HIGH | Requires stable baseline + readiness signal first. Experiment = {variable, hypothesis, metric, start, duration}; result report compares against pre-registered metric only. |
| Disagreement log → formula tuning | No mainstream product lets you say "the score felt wrong today" and learns from it. Coaches document exactly this failure (good score, flat athlete) | MEDIUM | One-tap capture is LOW; the tuning loop (review disagreements vs inputs, propose weight changes) is MEDIUM and can be manual/assisted at first. Most valuable training data the system gets, per SPEC. |
| Versioned readiness formula, annotated on charts | Vendors change algorithms silently and break users' trends (documented complaint). Versioning makes trend breaks explainable | LOW-MEDIUM | Formula version stamped on every score; chart annotations at version boundaries. Cheap insurance — build the version field in from v1 even if v1 never changes. |
| Candidate-pattern surfacing with 3-week evidence gate | Exist.io's correlations are valued but fire on noise. Requiring 3+ weeks of evidence + promotion to a pre-registered experiment converts curiosity into method | HIGH | Phase 2+. Depends on multiple streams + experiment engine. Cap at ONE candidate pattern per weekly digest (attention budget). |
| Sunday weekly digest with capped LLM narrative | Whoop/Gyroscope push AI summaries constantly; a single weekly narrative (trend chart, experiment status, one pattern, next week's single focus) matches the operator's planning cadence without AI noise | MEDIUM | LLM only for narrative prose; numbers computed deterministically first, LLM never invents data. Model tiering in config. |
| Schedule-aware suggestions | No competitor knows Mon/Thu mornings and Mon/Wed yoga are fixed; suggestions that fight the calendar get ignored | MEDIUM | Phase 3. Static schedule config is enough — no calendar API integration needed. |
| Private spiritual-practice namespace (consistency-only, never scored) | No wellness product offers an extra-private, telemetry-excluded, unscored namespace; deeply personal-first | LOW-MEDIUM | Phase 3, opt-in. Isolation designed in Phase 0 (storage namespace + encryption), feature shipped later. "Consistency only, never scored" is a hard product rule. |

### Anti-Features (deliberately NOT building)

| Feature | Why Requested / Surface Appeal | Why Problematic | Alternative |
|---------|-------------------------------|-----------------|-------------|
| Diagnosis / medical interpretation | Users want "what does my low HRV mean?"; competitors flirt with illness detection | Regulatory line (medical device); wrong interpretations destroy the trust the whole system depends on | Anomaly → neutral "consider checking with a professional" flag, never an interpretation (SPEC hard constraint #1) |
| Calorie-precision nutrition tracking | Bevel bundles nutrition; Gyroscope built an AI Health Camera around it | Highest-friction logging category in QS; directly violates the ≤2-min budget and trips the kill criterion | Phase 2 counted fields: meal-prep adherence y/n, caffeine cutoff time, tea ritual done |
| Social feeds / leaderboards / sharing | Whoop Teams and Oura Circles drive vendor retention | Personal-first system; social pressure distorts honest logging and adds privacy surface | None. Phase 5 productization gate exists for outside interest |
| Imputation of missing data | Smooth charts and always-available scores look better; vendors do it silently | Fabricated inputs poison baselines and experiment results; silent gap-filling is the black-box behavior Flow exists to reject | Missing-data honesty: show the gap, degrade the score's confidence explicitly, abstain when below input threshold |
| Conversational AI coach (Whoop AI, Gyroscope G1 style) | "Ask your data anything" is the current market fashion | Unbounded LLM spend, hallucination risk on health data, daily AI chatter erodes signal trust; LLM budget is capped by SPEC | LLM only for the weekly digest narrative, capped, over deterministically computed numbers |
| Multiple simultaneous experiments / open correlation dredging | Exist.io-style "find all correlations" feels like free insight | n=1 with ~8 streams guarantees spurious hits; post-hoc storytelling is explicitly banned by SPEC validation layer | ONE pre-registered experiment at a time; candidate patterns need 3+ weeks of evidence before promotion |
| Real-time / intraday strain & stress tracking | Whoop's live Strain Coach is its signature feature | Flow's decision cadence is daily (6:45am) + weekly; intraday data multiplies sync, storage, and attention cost with no decision it informs | Daily-granularity ingestion; Garmin watch itself already shows live data |
| More dashboards / score proliferation | Every competitor ships 3–8 scores (sleep, readiness, strain, stress, resilience…) | Fan-out problem: many scores dilute the one signal that must be trusted; "integration, not more dashboards" is the vision sentence | One readiness signal + one emphasis; everything else lives in the weekly digest |
| Cloud sync / third-party analytics (esp. private namespace) | Convenience, multi-device access | Health data sensitivity; spiritual namespace is extra-private by design | Local-first, encrypted at rest; export is explicit and user-initiated |
| Free-text-heavy journaling | Rich notes feel expressive; many QS apps center the journal | Free text isn't computable, slows logging past 2 min, and invites skipped days | Counted fields + one optional short note |
| Building a second wearable adapter now | Open Wearables support feels architecturally virtuous | YAGNI for one operator with one watch; delays the closed loop | Design `ingest/` interface so Garmin is adapter #1; Open Wearables waits behind the same interface (Phase 4) |

## Feature Dependencies

```
Garmin sync (append-only store)
    └──required by──> Baseline computation (3 weeks)
                          └──required by──> Readiness signal + emphasis
                                                ├──required by──> 6:45am morning delivery
                                                ├──required by──> Disagreement log ──feeds──> Formula tuning
                                                └──required by──> Experiment engine (needs stable signal as metric)
Manual evening log
    ├──displayed alongside──> Readiness signal (Phase 1)
    ├──fused into──> Readiness signal (Phase 2+, after evidence)
    └──required by──> Candidate-pattern surfacing

Input transparency/provenance structure
    ├──required by──> Missing-data honesty
    └──required by──> Disagreement-driven tuning (can't tune what you can't inspect)

Formula versioning ──required by──> Trustworthy trend charts (annotated breaks)

Experiment engine ──required by──> Candidate-pattern promotion
Weekly digest <──aggregates── trends, experiment status, candidate pattern

One-signal discipline ──conflicts──> Score proliferation / extra dashboards
Missing-data honesty ──conflicts──> Imputation
≤2-min log budget ──conflicts──> Calorie tracking, free-text journaling
```

### Dependency Notes

- **Baseline gates everything user-facing:** no recommendation, emphasis, or pattern surfaces before 3 weeks of data. The morning message during baseline shows collection progress instead.
- **Provenance is foundational, not a polish feature:** input transparency, missing-data honesty, and disagreement tuning all require the score to be a structured object (inputs + freshness + weights + formula version), not a bare number. Build this shape in Phase 1 even though tuning arrives in Phase 3.
- **Experiments depend on a trusted signal:** an experiment's metric is usually a readiness/recovery marker; running experiments before the signal is calibrated produces garbage conclusions. Hence Phase 2, after Phase 1's 4-week run.
- **Disagreement log can ship before tuning exists:** capture is one tap (Phase 1-cheap); the tuning loop that consumes it is Phase 3. Capturing early builds the dataset.

## MVP Definition

### Launch With (v1 = SPEC Phase 1, run 4 weeks)

- [ ] Daily Garmin sync → append-only store — objective core; nothing works without it
- [ ] ≤6-tap evening log (sauna, perceived readiness, optional note) — closes the human side of the loop; tests the kill criterion immediately
- [ ] 3-week baseline computation with progress display — trust gate; also the first real test of sync reliability
- [ ] Readiness signal + one emphasis, **with input provenance and freshness shown** — the core value; transparency must be v1, not retrofit
- [ ] 6:45am delivery with heartbeat/missed-delivery alert — a silent 6:45am miss is the fastest trust killer
- [ ] One-tap disagreement log — trivially cheap now, invaluable dataset later
- [ ] Sunday digest (trend chart + simple summary; LLM narrative optional in v1) — closes the weekly loop
- [ ] Formula version field on every computed score — near-zero cost now, enables annotated trend breaks forever

### Add After Validation (v1.x = Phase 2)

- [ ] Lifestyle streams (supplements checklist, caffeine cutoff, tea ritual, yoga quality 1–5) — trigger: Phase 1 logging held under 2 min for 4 weeks
- [ ] Pre-registered single-variable experiment engine — trigger: baseline stable + signal trusted (low disagreement rate)
- [ ] Candidate-pattern surfacing (one per digest, 3-week evidence gate) — trigger: ≥2 streams beyond Garmin with sufficient history
- [ ] LLM weekly narrative (capped, config-tiered) — trigger: digest content stable enough to narrate

### Future Consideration (v2+ = Phases 3–4)

- [ ] Private spiritual-practice namespace (consistency-only) — defer: requires Phase 0 isolation design proven; opt-in
- [ ] Schedule-aware suggestions — defer: needs disagreement data to know when generic suggestions fail
- [ ] Disagreement-driven formula tuning — defer: needs months of disagreement logs
- [ ] Open Wearables adapter, full data export tooling, yearly review — defer: hardening, no Phase 1 dependency

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Garmin daily sync (append-only) | HIGH | MEDIUM | P1 |
| Readiness signal + emphasis w/ provenance | HIGH | MEDIUM | P1 |
| ≤6-tap evening log | HIGH | LOW | P1 |
| 3-week baseline gate | HIGH | MEDIUM | P1 |
| 6:45am delivery + heartbeat | HIGH | LOW-MEDIUM | P1 |
| Disagreement one-tap log | MEDIUM (now) / HIGH (later) | LOW | P1 |
| Sunday digest (chart + summary) | HIGH | MEDIUM | P1 |
| Formula versioning field | MEDIUM | LOW | P1 |
| Missing-data honesty behaviors | HIGH | MEDIUM | P1–P2 (structure P1, full behaviors P2) |
| Experiment engine (pre-registered) | HIGH | HIGH | P2 |
| Lifestyle stream logging | MEDIUM | LOW | P2 |
| Candidate-pattern surfacing | MEDIUM | HIGH | P2–P3 |
| LLM weekly narrative | MEDIUM | MEDIUM | P2 |
| Schedule-aware suggestions | MEDIUM | MEDIUM | P3 |
| Private practice namespace | MEDIUM | LOW-MEDIUM | P3 (isolation design P0) |
| Formula tuning from disagreements | HIGH | MEDIUM | P3 |
| Open Wearables adapter | LOW | MEDIUM | P3+ |

## Competitor Feature Analysis

| Feature | Whoop | Garmin TR | Oura | HRV4Training | Reflect / Exist | Flow's Approach |
|---------|-------|-----------|------|--------------|-----------------|-----------------|
| Morning readiness score | Recovery % (G/Y/R) | 0–100, six hidden factors | 0–100 Readiness | HRV vs baseline + advice | — | One signal + one emphasis, band-based |
| Score transparency | Opaque | Opaque (hidden weighting, documented complaint) | Contributors shown, weights hidden | Most transparent (HRV math published) | n/a | Full provenance: inputs, freshness, weights, formula version |
| Missing-data handling | Computes anyway; early-data warning | Silently drops factors | Computes anyway | Requires the measurement | n/a | Explicit gaps, degraded confidence, abstain below threshold; no imputation |
| Manual context | Journal (post-hoc correlations) | None | Tags + Smart Tags (annotate trends) | Morning questionnaire (training, soreness, alcohol) | Fully manual forms/tags | ≤6-tap counted-field log, phased into signal |
| Experiments | Journal impact stats (post-hoc) | None | Canned templates (e.g., 14-day coffee) | None | Reflect: pre-registered n=1; Exist: open correlations | ONE pre-registered single-variable experiment; patterns need 3-wk evidence to promote |
| Feedback on the score | None | None | None | None | n/a | One-tap disagreement log → formula tuning |
| Baseline period | ~4 days min, weeks to settle | 3–4 weeks advised | ~2 weeks | 4 days baseline, ~2 months normal range | n/a | 3 weeks, hard gate before any recommendation |
| Privacy model | Cloud, subscription | Cloud | Cloud, subscription | Local-leaning | Reflect: fully local | Local-first, encrypted, private namespace, explicit export/delete |
| AI usage | Whoop AI chat coach | None | Oura Advisor | None | None | Weekly narrative only, capped, config-tiered |

## Sources

- Whoop Recovery/Strain/Sleep mechanics — [whoop.com/thelocker: How Recovery Works](https://www.whoop.com/us/en/thelocker/how-does-whoop-recovery-work-101/), [Whoop Developer 101](https://developer.whoop.com/docs/whoop-101/), [Whoop AI prompts](https://www.whoop.com/us/en/thelocker/7-ways-to-use-whoop-coach/) — MEDIUM-HIGH (official)
- Garmin Training Readiness factors & criticism — [the5krunner: TR factors explained](https://the5krunner.com/garmin-features/training/training-readiness/), [the5krunner: TR not accurate](https://the5krunner.com/2023/08/02/garmin-training-readiness-not-accurate-heres-why/), [Garmin forums: TR always low](https://forums.garmin.com/outdoor-recreation/outdoor-recreation/f/fenix-7-series/308068/training-readiness---almost-always-low-almost-never-good) — MEDIUM (expert review + community, consistent)
- Oura Readiness, Tags, Experiments — [ouraring.com: Readiness Score](https://ouraring.com/blog/readiness-score/), [Oura support: Readiness](https://support.ouraring.com/hc/en-us/articles/360025589793-Readiness-Score), [Oura Q4 features overview](https://medium.com/@fitnesator/oura-ring-q4-2023-circles-stress-tags-experiments-and-more-8e01c77425b0) — MEDIUM-HIGH (official + verified)
- HRV4Training baseline & advice model — [HRV4Training QuickStart](https://www.hrv4training.com/quickstart-guide.html), [Marco Altini: morning HRV measurement](https://marcoaltini.substack.com/p/how-should-you-measure-your-morning) — HIGH (creator-published methodology)
- Athlytic vs Bevel — [Vora: Bevel vs Athlytic](https://askvora.com/blog/bevel-vs-athlytic-apple-watch-recovery-apps), [Cora: Athlytic review](https://www.corahealth.app/compare/athlytic) — MEDIUM
- Black-box / trust critique — [Pojednic: Should you trust your wearable?](https://rachelepojednic.substack.com/p/should-you-trust-your-wearable-what), [Marco Altini: Data interpretation issues in wearables](https://medium.com/@altini_marco/data-interpretation-issues-in-wearables-a3942cae82ac), [Matheny Endurance: readiness trackers](https://mathenyendurance.com/wearables/) — MEDIUM (multiple independent sources agree)
- Reflect n=1 experiments — [QS Forum: Reflect n=1 experiments](https://forum.quantifiedself.com/t/perform-n-1-experiments-with-reflect-track-anything-ios-app/12071), [App Store: Reflect](https://apps.apple.com/us/app/reflect-track-anything/id6463800032) — MEDIUM
- Exist.io correlations & custom tracking — [exist.io](https://exist.io/), [BrettTerpstra: Exist custom tracking](https://brettterpstra.com/2017/08/02/quantify-everything-with-exist-dot-io-custom-tracking/) — MEDIUM
- Gyroscope feature set (anti-feature reference) — [gyrosco.pe](https://gyrosco.pe/), [App Store: Gyroscope](https://apps.apple.com/us/app/gyroscope/id1104085053) — MEDIUM
- Garmin Connect API data availability — [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/), [Open Wearables: Garmin API guide](https://openwearables.io/blog/garmin-connect-api-developer-guide-activities-health-metrics), [python-garminconnect (PyPI)](https://pypi.org/project/garminconnect/) — MEDIUM-HIGH (official + maintained library)
- Project constraints — /home/user/flow/SPEC.md, /home/user/flow/.planning/PROJECT.md — HIGH

---
*Feature research for: personal readiness/recovery system (Flow)*
*Researched: 2026-06-10*
