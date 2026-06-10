# PRINCIPLES.md — Engineering Principles (applies to every phase)

GSD planners and executors: treat this file as non-negotiable constraints.
Every PLAN.md must show how its tasks satisfy the relevant sections below.

## 1. Four-layer system model

Every component must be assignable to exactly one layer:

- **Abstraction** — agents talk to interfaces, never to raw vendors.
  One module per external dependency (search provider, marketplace,
  LLM, notification channel). Swapping a vendor touches one file.
- **Isolation** — agent runs are sandboxed and stateless between runs;
  all durable state lives in versioned storage (git, SQLite, object store).
  A failed run can never corrupt prior outputs. Secrets only via env.
- **Validation** — nothing reaches a human or a customer unvalidated:
  schema-check all agent JSON, citation-check all claims, score-bound all
  recommendations. Every skill has at least one eval case.
- **Infrastructure capacity** — explicit budgets: max tokens per run,
  max API calls per provider per day, max runtime per job. Budgets live
  in config, enforced in code, alert at 80%.

## 2. Fundamentals (enforced every release)

- **Decision making** — significant choices get a 5-line ADR in `docs/adr/`.
- **Technical strategy** — prefer boring tech; new dependencies need an ADR.
- **Developer productivity** — one-command setup, one-command run, README
  current. Automation is better than toil.
- **Organizational collaboration** — code review as mentorship; transparency
  by default (plans, evals, and postmortems live in the repo).
- **Security** — no secrets in code or commits; least-privilege API keys;
  user/community data handled per a written data policy; PII never logged.
- **Code health** — small core language set (Python + minimal JS only);
  standardization is valuable: one lint config, one test runner.
- **Release hygiene** — trunk-based dev, every merge green, tagged releases,
  CHANGELOG entries. (Almost) everything built from source in CI.
- **Reliability** — every scheduled job has a heartbeat alert; blameless
  postmortem doc for any silent failure > 24h.

## 3. Ecosystem mapping (revisit at every phase boundary)

Before planning a phase, update `docs/ecosystem-map.md` answering:

- **Scale** — users/sources/runs expected this phase vs next; what breaks at 10x?
- **Time** — which loops are real-time, daily, weekly? Are cadences matched
  to user expectations?
- **Causality** — what actually drives the outcome metric? Validate, don't assume.
- **Fan-in/out** — where do many inputs converge (digest) or one output
  spread (community post)? Those nodes need the most validation.
- **Emergence** — what behavior appears only with real users? Instrument for it.
- **Incentives** — why does each participant (user, contributor, payer)
  keep showing up? If a loop has no incentive, it will die.
- **Capacity** — current API quotas, compute, and human review bandwidth.
- **Feedback loops** — name each closed loop and its measurement; a loop
  without a metric is decoration.
- **Bottlenecks** — the single constraint limiting growth this phase; the
  phase plan must address it explicitly.

## 4. Closed-loop requirement

Phase 1 of every project MUST ship the smallest complete loop:
sense → decide → act → measure → improve. Features that don't serve the
loop are out of scope until the loop runs unattended for 7 days.

## 5. Model tiering

Orchestration/synthesis on the frontier model; bulk extraction on the
cheapest adequate model; tier assignments live in config.yaml, never inline.
