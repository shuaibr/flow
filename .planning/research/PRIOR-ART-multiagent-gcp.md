# Prior Art: Multi-Agent Garmin Telemetry Platform on GCP (Reddit, 2026)

Operator-supplied reference: an open-source project analyzing 1Hz Garmin
wearable telemetry with a LangGraph multi-agent orchestrator on GCP
(Firestore OLTP + BigQuery OLAP, free-tier LLM, Telegram interface,
custom Python Garmin SDK, Terraform IaC). Reviewed 2026-06-11 against
Flow's SPEC/PRINCIPLES and existing research.

## What it validates for Flow

- **Python ingestion against Garmin is viable and is the hard part.**
  Author built a custom SDK for Garmin Health API/FIT files from scratch.
  Confirms our build-order call: derisk `ingest/garmin` first, behind a
  single adapter boundary. Their SDK + GarminDB are study references for
  auth/FIT handling.
- **Immutable raw lake separated from derived state.** Their
  BigQuery-as-immutable-lake mirrors our append-only raw store +
  idempotent recompute split. Independent confirmation of ARCHITECTURE.md.
- **Telegram as a daily interaction channel works** — validates our
  documented Telegram-bot alternative for the evening log / morning
  signal.
- **Budgets enforced in code, not prompts.** Their "agentic SRE
  guardrails" (mandatory dry-run, hard block at 500MB scanned, forced
  partition filters) is PRINCIPLES §1 Infrastructure-capacity made
  concrete. Same posture applies to our Garmin sync caps and LLM caps.

## Patterns worth adopting

1. **"Signature to the LLM."** They push compute to the warehouse
   (window functions extract trend drifts) and pass only the final
   compact mathematical signature to the LLM. Flow's Sunday digest
   should do the same: signals layer computes all trends/aggregates
   deterministically; the weekly LLM call receives only those compact
   numbers to narrate. Cheaper, capped by construction, and the LLM can
   never invent data it wasn't given. → Phase with weekly digest.
2. **Hard-block budget guards** around any metered call (Garmin sync,
   LLM digest): check budget in code before the call, alert at 80%,
   refuse past 100%. → Every phase with external calls.

## What Flow deliberately does NOT copy (with reasons)

- **Cloud-first storage (Firestore/BigQuery).** Violates Flow's
  privacy-by-architecture hard constraint: local-first, encrypted at
  rest, no third-party processing of health data. "Zero-cost" GCP still
  puts health data in Google's cloud. We keep SQLite + SQLCipher.
- **Daily multi-agent LLM orchestration (Head Coach / Data Scientist /
  Semantic Router / expert agents).** Flow's readiness signal must be a
  pure, versioned, replayable function — no LLM in the daily loop. SPEC
  caps LLM use to the weekly narrative digest. An agentic "coach"
  reintroduces hallucination risk at the highest fan-out node and is
  complexity far beyond 1-user needs (their own guardrails exist because
  agents tried to burn cloud credits).
- **1Hz telemetry scale.** Flow needs daily summaries (HRV status, sleep
  stages, Body Battery), not 1Hz streams. Data maximalism is the
  dashboard trap PITFALLS.md warns about — more data ≠ better decisions.
- **LLM-generated physiological hypotheses.** Their agents "hunt for
  physiological hypotheses" autonomously. Flow's hard constraint: no
  interpretation — anomalies produce a "consider checking with a
  professional" flag only, and candidate patterns require 3+ weeks of
  evidence plus pre-registered experiments, not LLM speculation.

## Net effect on planning

No roadmap structure changes. Two additions flow into phase planning:
the "signature to the LLM" pattern becomes a design requirement of the
weekly digest, and hard-block budget guards become an explicit task
wherever a metered external call is introduced.

---
*Source: operator-supplied screenshots of a Reddit post (r/LLMDevs-style
write-up, author runs it via Telegram; repos: Biometric AI, Garmin SDK,
Agent Orchestrator).*
