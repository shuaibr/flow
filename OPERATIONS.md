# OPERATIONS.md — Portfolio Operating Rules

**Scope:** All six repos (flow, reeyaz, sama, scout, mena, maruf)
**Lives at:** workspace root, above all repos
**Constraint:** ~5–8 hrs/week total. The bottleneck is attention, not compute.
**Honesty note:** Rules below are marked [EVIDENCE] where backed by verifiable research, [POLICY] where the threshold is a chosen operating value, not a finding. Policies don’t need citations; they need enforcement.

-----

## Rule 1 — Forced-Choice Outputs (Veto Interface)

Agents never deliver open-ended reports as their action output. Every actionable recommendation arrives as a binary/forced choice pushed to phone or CLI (e.g., `SCOUT: 2020 Corolla $21,400 — BUY-LOOK / PASS`), with a one-line reason. Every veto or disagreement appends one line to that repo’s `docs/codex.md`.

- **Adversarial two-agent review is scoped to scout only** — the one parallel + verifier project where a checker agent is justified. [EVIDENCE: orchestrated verification contains error amplification to ~4.4x vs ~17.2x uncoordinated — arXiv 2512.08296]
- All other repos: single agent + output schema + my veto as the only review layer. Adding agents to sequential tasks degrades performance (up to ~70% on sequential planning — same paper).

## Rule 2 — 3-Minute Ready-to-Resume (R2R)

Before closing any work session, spend ≤3 minutes writing `reentry.md` in the repo root:

```
LAST_COMPLETED:
CURRENT_STOPPOINT:   (file:line or exact blocker)
NEXT_3_STEPS:
```

[EVIDENCE: Leroy & Glomb 2018, Organization Science — R2R plans release unfinished tasks from working memory and reduce attention residue. Refocusing after interruption averages ~23 min (Gloria Mark, UC Irvine); the R2R note bypasses most of that reconstruction cost.]

## Rule 3 — WIP Cap = 1

Exactly one repo is **Active** (code changes, prompt engineering, features). The other five are **Passive**: cron runs, read-only logs, critical isolated bugfixes only.

|State      |Allowed                        |Exit criteria                         |
|-----------|-------------------------------|--------------------------------------|
|Active (1) |All development                |Ships its defined validation milestone|
|Passive (5)|Automated runs + critical fixes|Active slot vacant + highest priority |

- Rotation happens at milestones, not moods.
- **Current Active: flow.** Milestone: framework-alignment filled → /gsd-plan-phase → first working readiness signal.
- [POLICY — grounded in cognitive load theory generally, but the cap value is a choice]

## Rule 4 — Action-to-Output Ratio (AOR)

One metric per repo: **% of agent recommendations I acted on (or explicitly vetoed) within 48h.**

- AOR < 50% over a 2-week window → the pipeline is noise → demote from push to weekly digest, or mute.
- Log: `metrics/loop_closure.csv` per repo — `date, recommendation_id, pushed_at, acted(Y/N), action_taken`.
- This *is* the “Measure” row of each repo’s framework-alignment doc, with teeth.
- [POLICY — the 50%/48h thresholds are mine; revise after 60 days of real data]

## Rule 5 — 30-Day Meta-Work Quarantine

Any custom tool, wrapper, or pipeline component built *for the agents* (not the product) goes in `meta_work_quarantine.md` at workspace root with its creation date. At 30 days: if it hasn’t saved measurable hours or driven a decision → delete it.

- Test before building: “Would a 5-line bash script do?” If yes, the pipeline doesn’t get built.
- [POLICY — the failure mode (tool-building displacing shipping) is real and self-observed; the 30-day window and any prevalence statistics are not evidence-backed. Enforce anyway.]

-----

## Rule 6 — Human Learning Loop (Learning-Opportunities)

The portfolio closes agent loops; this rule closes MINE. Install
DrCatHicks/learning-opportunities as a Claude Code plugin in every repo
(`/plugin marketplace add https://github.com/DrCatHicks/learning-opportunities.git`
then `/plugin install learning-opportunities@learning-opportunities`).

- After architectural work (new modules, schema changes, refactors), accept
  the offered 10–15 min exercise **at most once per session, minimum twice
  per week across the portfolio.** Log each completed exercise as one line
  in the repo's `docs/learning_log.md`: `date, topic, exercise_type,
  one-sentence takeaway`.
- Run `/orient` + `/learning-opportunities orient` once per repo before its
  first Active rotation — systems awareness beats feature velocity.
- The R2R note (Rule 2) gains an optional 4th line: `OPEN_QUESTION:` —
  one thing I don't yet understand about my own system. Next session's
  retrieval check-in starts there.
- Suppression honored: never more than 2 exercises/session; never force it
  during a shipping push. Learning capacity is governed like API capacity.
- [EVIDENCE: generation effect, retrieval practice, spacing, and the
  fluency illusion are established learning science (Bjork et al. 2013;
  Roediger & Karpicke 2006; Soderstrom & Bjork 2015). Hicks et al. 2025
  finds commitment to learning predicts lower AI skill threat and higher
  team effectiveness. The cadence values here are POLICY.]

-----

## Do-Not-Do List

1. **No heavy orchestrators** (Airflow, Prefect, queues). Plain Python + SQLite + cron. Team tools eat solo time budgets.
1. **No internal validation as proof.** Clean runs, nice code, friendly feedback ≠ validation. Validation = an external action: a stranger subscribes, someone pays, someone describes the problem unprompted.
1. **No multi-agent swarms on sequential tasks.** Parallelizable + verifier-gated, or single agent. No exceptions. [EVIDENCE: arXiv 2512.08296]
1. **No new projects while a repo sits at 60–80% complete.** New ideas go to `PARKING_LOT.md` (current occupant: sama taste profiler — revisit after flow V1).

-----

## Verified Sources (only these survived audit)

- Leroy, S. & Glomb, T.M. (2018). *Tasks Interrupted… and How a “Ready-to-Resume” Plan Mitigates the Effects.* Organization Science 29(3).
- Mark, G. (UC Irvine) — interruption recovery research (~23 min refocus).
- Kim et al. (2025). *Towards a Science of Scaling Agent Systems.* arXiv:2512.08296.
- Anthropic (2025). *Effective Context Engineering for AI Agents.*
- Hicks, C.M., Lee, C.S., & Foster-Marks, K. (2025). *The New Developer: AI Skill Threat, Identity Change & Developer Thriving.* PsyArXiv.
- Bjork, Dunlosky & Kornell (2013); Roediger & Karpicke (2006); Soderstrom & Bjork (2015) — learning-science basis for Rule 6.

Stripped as unverifiable: “674 AI sessions” study, “72% of abandoned projects,” “one-third meta-work / 15% zero value,” and the “19% slower” stat as framed (real number, different study, different mechanism — METR 2025 measured overall AI-assisted task slowdown, not tooling churn).
