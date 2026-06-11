# Flow — Personal Wellness OS

> Project scope updated: this repo is now driven by [`SPEC.md`](./SPEC.md)
> (vision, phases, data streams, out-of-scope), [`PRINCIPLES.md`](./PRINCIPLES.md)
> (non-negotiable engineering principles), and [`OPERATIONS.md`](./OPERATIONS.md)
> (portfolio operating rules — Flow is the Current Active repo, WIP cap = 1).
> They are the source of truth for planning and execution.

A phased personal wellness system that fuses objective wearable data
(Garmin Forerunner 955 via the Garmin Connect API) with lightweight manual
logging of everything the watch can't see — sauna sessions, yoga quality,
supplements, tea/nutrition, mood, and spiritual practice — and turns it
into one trustworthy daily readiness signal plus weekly experiments.

## Scope at a glance

- **Primary outcome (personal):** one reliable 6:45am readiness signal and
  a weekly experiment cadence that demonstrably improves recovery markers
  (HRV trend, Body Battery overnight refill, sleep consistency) within
  12 weeks.
- **Secondary outcome (financial, gated):** productization for hybrid
  athletes is Phase 5 only, gated on 90 consecutive days of personal use
  plus 3 unprompted outside requests.
- **Kill criterion:** if daily logging takes > 3 minutes or is skipped
  10 days in a month, simplify before adding anything.

## Hard constraints

1. **Not a medical device** — no diagnosis, treatment claims, or
   medication guidance.
2. **Privacy by architecture** — local-first storage, encrypted at rest,
   no third-party analytics, explicit export/delete. Spiritual-practice
   logs live in a separate, extra-private namespace.
3. **Garmin API terms** — personal-use OAuth app, rate-limit respect,
   aggressive caching.

## Phases

| Phase | Deliverable |
|---|---|
| 0 | Data contract + privacy ADR (OAuth scopes, encryption, schemas, namespace isolation) |
| 1 | Smallest closed loop: daily Garmin pull + 6-tap evening log + 3-week baseline + morning signal + Sunday digest |
| 2 | Lifestyle streams + pre-registered single-variable experiment engine |
| 3 | Whole-life integration: private practice-consistency namespace, schedule-aware suggestions |
| 4 | Hardening: Open Wearables adapter option, data export, yearly review |
| 5 | Productization (gated at 90-day personal streak) |

See [`SPEC.md`](./SPEC.md) for the full system architecture (four-layer
model), ecosystem map, communication loops, and out-of-scope list.

## Status

Greenfield. This repo previously hosted an unrelated habit-tracking app;
that code was removed (recoverable from git history) and the wellness OS
is being built fresh per SPEC.md and PRINCIPLES.md, starting with Phase 0
(data contract + privacy ADR).
