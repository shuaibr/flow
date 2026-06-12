# Ecosystem map — Flow (updated at every phase boundary, PRINCIPLES §3)

**Phase being planned:** Phase 1 — smallest closed loop
**Last updated:** 2026-06-12

- **Scale:** 1 user, ~8 streams, ~2 runs/day. At 10x (Phase 5 multi-tenant)
  the single-file SQLite store and env-based secrets break first — accepted;
  single-user-correct privacy comes before multi-tenant design.
- **Time:** morning signal hard deadline 6:45am local; evening log ≤2 min;
  Sunday digest in the 7–9pm planning window; baselines recomputed monthly.
- **Causality:** hypothesis — sleep consistency and training-load balance
  drive recovery markers more than any supplement. The experiment engine
  (Phase 2) exists to test this; until then weights are explicitly v1 guesses.
- **Fan-in/out:** all streams fan in at the readiness function (highest-
  validation node: golden set of 21 synthetic day-payloads gates every
  formula merge). The 6:45 signal fans out into the whole day's decisions —
  hence the 21-day baseline gate before anything is surfaced.
- **Emergence:** unpredicted cross-stream correlations (evening sauna ×
  sleep latency, late caffeine × HRV). Instrumented as "candidate patterns";
  promotion requires 3+ weeks of evidence.
- **Incentives:** the 2-minute log must pay for itself daily via the morning
  signal; if logging is skipped 10 days in a month, simplify (kill criterion).
- **Capacity:** operator attention is the constraint (~5–8 hrs/week across
  the portfolio, WIP cap = 1). Budgets in config.yaml; ONE active experiment
  ever.
- **Feedback loops (each with its metric):**
  1. Morning signal → agree/disagree tap → `metrics/loop_closure.csv` (AOR).
  2. Signal-vs-felt disagreement log → formula weight tuning (versioned).
  3. Skipped-log analysis → UX simplification.
- **Bottleneck #1 this phase:** logging friction. Phase 1 ships the ≤6-tap
  log before any analytics depth; nothing else is allowed to grow until the
  loop runs unattended for 7 days.
