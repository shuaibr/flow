<!-- GSD:project-start source:PROJECT.md -->
## Project

**Flow — Personal Wellness OS**

Flow is a phased personal wellness system for a single operator (a hybrid
athlete running Hyrox, RPM, hot yoga, strength, sauna, and structured
mornings). It fuses objective wearable data from a Garmin Forerunner 955
(via the Garmin Connect API) with lightweight manual logging of everything
the watch can't see — sauna sessions, yoga quality, supplements,
tea/nutrition, mood, and spiritual practice — and turns it into one
trustworthy daily readiness signal plus weekly experiments. Its job is
integration and learning loops, not more dashboards.

**Core Value:** One reliable 6:45am readiness signal the operator trusts enough to act on
— a noisy signal is worse than none.

### Constraints

- **Regulatory**: Not a medical device — no diagnosis, treatment claims,
  or medication guidance, ever.
- **Privacy**: Local-first storage, encrypted at rest, no third-party
  analytics, explicit export/delete; spiritual-practice logs in a
  separate namespace excluded from any future telemetry by default.
- **Vendor terms**: Garmin personal-use OAuth app; respect rate limits;
  cache aggressively; one scheduled sync/day plus on-demand.
- **Tech stack**: Small core language set per PRINCIPLES — Python +
  minimal JS only; boring tech preferred; new dependencies need an ADR.
- **Attention budget**: Manual log ≤ 2 min/day by design (counted fields,
  not free text); ONE active experiment at a time.
- **LLM budget**: LLM used only for the weekly narrative digest, capped;
  model tiering lives in config, never inline.
- **Architecture**: Every component assignable to exactly one of the four
  layers (Abstraction / Isolation / Validation / Infrastructure
  capacity); raw pulls append-only; derived signals recomputed, never
  hand-edited; recompute idempotent.
- **Process**: Significant choices get a 5-line ADR in `docs/adr/`;
  ecosystem map updated at every phase boundary; scheduled jobs get
  heartbeat alerts; readiness-formula changes versioned and annotated on
  charts.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.12+ | Core language | PROJECT.md mandate (Python + minimal JS). 3.12 is the boring, widely-packaged baseline; garminconnect and FastAPI both require ≥3.10. |
| `garminconnect` (cyberjunky/python-garminconnect) | 0.3.5 (2026-06-04) | Garmin Connect ingest adapter | The de-facto standard community library. 130+ API methods covering every Phase-1 stream (HRV status, sleep stages, Body Battery, Training Readiness, stress, activities, resting HR). Uses the same mobile SSO flow as the official Garmin Connect Android app, handles MFA via a `prompt_mfa` callback, persists DI OAuth tokens to `~/.garminconnect/garmin_tokens.json`, and auto-refreshes them indefinitely while the refresh token is valid — interactive login is needed only once or after revocation. Actively maintained (release 6 days before this research). **Confidence: HIGH** (verified on GitHub master). |
| SQLite (stdlib `sqlite3`) + SQLCipher via `sqlcipher3-wheels` | SQLCipher 4.14.0 (2026-03), `sqlcipher3` 0.6.2 | Local-first encrypted store (append-only event tables + derived signal tables) | SQLite is the boring-tech answer for a 1-user, ~8-stream system; SQLCipher adds transparent AES-256 full-database encryption at rest with zero query changes — satisfies "encrypted at rest" at the *application* layer, so a stolen disk, a synced backup, or a copied file is useless without the key. SQLCipher is commercially maintained by Zetetic (4.14.0 released March 2026, SQLite baseline 3.51.3); `sqlcipher3` is coleifer's maintained DB-API binding (released Jan 2026). Use the `sqlcipher3-wheels` PyPI package to avoid compiling SQLCipher locally. **Confidence: HIGH** for SQLCipher core; MEDIUM for the wheels package availability on your target platform — verify in Phase 0 and fall back to `sqlcipher3` + system libsqlcipher if needed. |
| systemd timers (+ a thin Python job runner) | systemd (OS-provided) | Daily 6:45am signal job, daily Garmin sync, Sunday digest | Boring tech that wins on every PRINCIPLES axis: jobs survive process crashes (no long-lived daemon to babysit), `Persistent=true` catches up after a powered-off morning (cron silently skips), `OnCalendar=` is readable, logs land in journald, and each unit is one file. APScheduler 4.x is still a pre-release the maintainer says not to use in production; APScheduler 3.x means running your own always-on daemon — exactly the silent-failure surface PRINCIPLES warns about. **Confidence: HIGH.** |
| Healthchecks (self-hosted) or healthchecks.io | latest Docker image / hosted free tier | Heartbeat alerts for every scheduled job (PRINCIPLES hard requirement) | Purpose-built dead-man's-switch monitoring: each job pings a check URL on success; a missed ping at the expected schedule triggers an alert. Open-source Django app, trivially self-hostable (keeps the privacy posture), with first-class docs for monitoring systemd timers and Python scripts. Hosted free tier (20 checks) is fine to start since pings carry no health data — only "job ran". **Confidence: HIGH.** |
| ntfy (self-hosted or ntfy.sh) | latest | Delivery channel: 6:45am one-line signal, Sunday digest link, missed-sync alerts | Dead-simple HTTP POST → push notification; open source, native iOS/Android apps, self-hostable, no account required. Sending is one `httpx.post()` — perfectly matches the Abstraction layer's "one module per notification channel". Caveat below on iOS + self-hosted latency. **Confidence: HIGH** for the mechanism; see Stack Patterns for the iOS nuance. |
| FastAPI + Jinja2 + HTMX | FastAPI 0.136.3 (2026-05-23), HTMX 2.x (single vendored JS file) | ≤6-tap evening log UI + disagreement tap (served on LAN/Tailscale, installable as a PWA) | Keeps the "minimal JS" constraint honest: HTMX is one static file, all logic stays in Python, the log page is a handful of big tap targets posting HTML fragments. Add a 10-line manifest + service worker and it installs to the phone home screen like an app. FastAPI also gives you the on-demand sync endpoint and future chart pages for free. **Confidence: HIGH.** |
| Anthropic Python SDK (`anthropic`) | latest (`pip install anthropic`) | Weekly narrative digest generation (the ONLY LLM call) | Official SDK; one `client.messages.create()` call per week. Model id lives in `config.yaml` per PRINCIPLES §5 (tier assignments in config, never inline). **Confidence: HIGH** (verified via claude-api skill, cached 2026-06-04). |
### LLM model choice for the capped weekly digest
| Model | ID | Input $/MTok | Output $/MTok | Fit |
|-------|----|--------------|---------------|-----|
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | $3.00 | $15.00 | **Recommended digest default.** Synthesis-quality narrative from ~5–15K tokens of weekly data for well under $0.10/week — the cap is trivially satisfiable. |
| Claude Opus 4.8 | `claude-opus-4-8` | $5.00 | $25.00 | Config-swap upgrade if Sonnet narratives feel flat. Still pennies/week at this volume. |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1.00 | $5.00 | Downgrade option for any future bulk-extraction tier (PRINCIPLES §5); not needed in Phase 1. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `httpx` | latest stable | HTTP client for ntfy pings, healthchecks pings | Everywhere you'd reach for `requests`; one client library for the whole codebase. |
| `pydantic` | 2.x | Stream schemas, log-entry validation ("one schema for all log entries") | Already a FastAPI dependency; use it for the Validation layer's schema checks on every raw pull and manual log. |
| `pydantic-settings` | 2.x | `config.yaml`/env loading (budgets, model tier, channel tokens) | Secrets via env per PRINCIPLES; budgets/tiers in config. |
| `matplotlib` | 3.x | Sunday digest trend chart (rendered to PNG, attached/linked) | Boring, zero-JS charting; readiness-formula version annotations are just `axvline` + text. |
| Jinja2 | 3.x | HTML templates for log page + digest | Standard FastAPI pairing. |
| `uvicorn` | latest stable | ASGI server for the log UI | Run as a systemd service. |
| pytest + ruff | latest | One test runner, one lint config (PRINCIPLES) | From day one; signals are pure functions over the store — ideal pytest targets. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `uv` | Env + dependency management, one-command setup | `uv sync` satisfies the "one-command setup" principle; lock file in repo. |
| Tailscale (optional but recommended) | Reach the log UI from the phone without exposing anything to the internet | Keeps local-first honest if the server is a home box; zero open ports. |
| systemd unit files in `deploy/` | Reproducible job + service definitions | Timer + service pairs for: garmin-sync, morning-signal, weekly-digest, web UI. |
## Installation
# Core (uv project)
# Dev
# Each scheduled job wraps its work with a heartbeat ping:
# ExecStart=/usr/bin/flow-sync && curl -fsS https://hc.example/ping/<uuid>
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `garminconnect` (community) | **Official Garmin Connect Developer Program Health API** | Only at Phase 5 (productization). The official program **does not support personal use** — you must apply as a legal entity (company/university/hospital), go through an approval + integration call, and commercial use carries a license fee. It is a push/webhook architecture aimed at multi-user services. Wrong tool for a single operator; revisit when multi-tenant. (Verified: developer.garmin.com program FAQ, 2026-06.) |
| `garminconnect` | `garth` directly | Don't. `garth` is marked **[DEPRECATED]** on GitHub; a 2025/2026 Garmin auth-flow change broke its login path (existing OAuth1 tokens limp along ~1 year, new logins fail). `garminconnect` 0.3.x replaced the garth dependency with its own mobile-SSO + DI-token flow and is the maintained path. |
| `garminconnect` | `garmy` (newer, garth-inspired) | Younger, smaller community; consider only if `garminconnect` stalls. The ingest interface (Abstraction layer) makes swapping a one-file change anyway. |
| SQLCipher (app-level encryption) | Filesystem/disk encryption only (LUKS, FileVault, gocryptfs) | Acceptable fallback if `sqlcipher3` wheels prove painful on the target platform — but disk encryption protects only against device theft, not against the file leaving the machine (backups, sync, copy). Best posture: SQLCipher **and** an encrypted disk. Decide in Phase 0's privacy ADR. |
| SQLite | DuckDB / Postgres | DuckDB shines for analytics but has no mature encryption story and is overkill at this scale; Postgres is a daemon to operate for 1 user. SQLite's file-per-database model is also what makes "explicit export/delete" trivial. |
| systemd timers | cron | Cron works but lacks `Persistent=true` catch-up, has weaker logging, and the 6:45am signal is exactly the job you can't afford to silently skip after a reboot. |
| systemd timers | APScheduler 3.x in a daemon | Use only if the deploy target can't run systemd (e.g. a container platform with one long-lived process). Then: APScheduler 3.11.x (stable) + SQLAlchemy job store, never 4.0.0aX (pre-release, explicitly not production-ready per maintainer). |
| ntfy | Telegram bot (`python-telegram-bot` v22.7) | Telegram becomes the better choice **if** you adopt it for the evening log UI too (see Stack Patterns) — then signal delivery and log input share one channel. Pure-delivery-wise it routes health data through Telegram's servers, a privacy step down from self-hosted ntfy. |
| ntfy | Email (SMTP) | Email is fine for the Sunday digest body (long-form + chart) and terrible for a 6:45am glanceable one-liner. Reasonable secondary channel for the digest. |
| ntfy | Apple/Android native push (APNs/FCM direct) | Requires an app + developer accounts; entirely disproportionate for one user. ntfy's apps already wrap APNs/FCM for you. |
| FastAPI + HTMX log page (PWA) | Telegram bot with `InlineKeyboardButton` rows | Genuinely competitive: bot buttons give a ≤6-tap flow with zero hosting of a web UI, and the bot doubles as the disagreement-tap channel. Costs: health data transits Telegram, and counted-field UIs (1–5 scales, durations) are clunkier than HTML inputs. Pick ONE in Phase 0's ADR; default recommendation is the PWA for privacy symmetry with the rest of the stack. |
| FastAPI + HTMX | iOS Shortcuts → FastAPI endpoint | Excellent *complement*, not a replacement: a Shortcut/widget can POST the sauna-yes/no + readiness score to the same FastAPI endpoint in 2 taps from the home screen. Keep the HTML page as the canonical UI; add the Shortcut later as a friction reducer. |
| `claude-sonnet-4-6` for digest | `claude-opus-4-8` | Swap in config if narrative quality matters more than the (still tiny) cost. Never hardcode — PRINCIPLES §5. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `garth` | Deprecated; broken by Garmin's auth change for new logins | `garminconnect` 0.3.5+ |
| `pysqlcipher3` (rigglemania) | Effectively unmaintained; superseded | `sqlcipher3` / `sqlcipher3-wheels` (coleifer) |
| APScheduler 4.0.0aX | Pre-release; maintainer explicitly warns against production use; no 3.x migration path yet | systemd timers (or APScheduler 3.11.x if a daemon is unavoidable) |
| Official Garmin Health API (now) | No personal-use tier; legal-entity application, approval process, commercial license fees | `garminconnect` personal-use flow; re-evaluate at Phase 5 |
| React/Vue/Svelte SPA for the log page | Violates "minimal JS"; a 6-tap form needs no build pipeline | HTMX fragment swaps over FastAPI |
| Date-suffixed Claude model ids (e.g. `claude-sonnet-4-6-2025…`) | Current aliases are complete as-is; constructed ids 404 | Exact ids from the table above, stored in config |
| Imputation libraries / pandas-heavy signal pipelines (Phase 1) | SPEC: missing-data honesty over imputation; signals are pure functions over the store | Plain Python functions + pydantic models; add pandas only when a real analytics need appears (ADR) |
| Cloud sync of the DB file (Dropbox/iCloud on the live DB) | SQLite + file sync = corruption risk; also violates the private-namespace constraint | Local store + explicit, encrypted, versioned export job |
## Stack Patterns by Variant
- systemd timers + self-hosted ntfy + self-hosted Healthchecks, FastAPI UI reachable via Tailscale.
- Note the verified iOS caveat: a **self-hosted** ntfy server needs `upstream-base-url: https://ntfy.sh` configured so iOS push arrives instantly (iOS background limits otherwise delay delivery, sometimes by 20–30+ min — fatal for a 6:45am signal). Only a message-ID poll trigger goes upstream, not message content, but record this tradeoff in the privacy ADR; using ntfy.sh directly with a random topic name is the pragmatic alternative (topic names are effectively bearer tokens — treat them as secrets).
- Telegram bot (`python-telegram-bot` 22.x) becomes both delivery channel and log UI: morning signal as a message, evening log as 2–3 inline-keyboard messages (sauna y/n → duration presets → readiness 1–5), disagreement as a single button under the morning message. One process, one systemd service, polling mode (no inbound ports). Accept the Telegram-servers privacy tradeoff explicitly in the ADR.
- APScheduler 3.11.x inside the FastAPI process, with healthchecks pings wrapping each job and a startup self-test. Treat as second choice.
- `config.yaml`: `digest_model`, `digest_max_output_tokens` (e.g. 2000), `monthly_token_budget`. Count usage from `response.usage`, persist to the store, alert at 80% via ntfy. The digest job degrades gracefully: if budget exhausted or API down, send the chart + computed stats without narrative (and ping healthchecks with a failure flag).
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| garminconnect 0.3.5 | Python ≥3.10 | Token store at `~/.garminconnect/`; point it at an app-owned dir via `Garmin(..., tokenstore=...)` so tokens live with the encrypted data dir. |
| sqlcipher3 0.6.2 | SQLCipher 4.x | DB-API 2.0 compatible with stdlib `sqlite3` patterns; `PRAGMA key` must be the first statement on every connection — wrap in one connection factory. |
| FastAPI 0.136.3 | Pydantic 2.x, Python ≥3.10 | HTMX is backend-agnostic (one static JS file, no version coupling). |
| anthropic SDK | `claude-sonnet-4-6` / `claude-opus-4-8` / `claude-haiku-4-5` | Use alias ids exactly as written; `thinking: {"type": "adaptive"}` if enabling thinking on 4.6+; model string in config only. |
| python-telegram-bot 22.7 | Python ≥3.9 | Only if the Telegram variant is chosen. |
## Sources
- [cyberjunky/python-garminconnect](https://github.com/cyberjunky/python-garminconnect) — v0.3.5 (2026-06-04), auth flow, MFA callback, token persistence/auto-refresh, 130+ endpoints. **HIGH**
- [matin/garth](https://github.com/matin/garth) — repo title marked [DEPRECATED]; Garmin auth change broke new logins. **HIGH**
- [Garmin Connect Developer Program — Health API](https://developer.garmin.com/gc-developer-program/health-api/) and [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/) — no personal use; legal-entity application; commercial license fee. **HIGH**
- [SQLCipher 4.14.0 release (Zetetic, 2026-03-17)](https://www.zetetic.net/blog/2026/03/17/sqlcipher-4.14.0-release/) and [sqlcipher/sqlcipher](https://github.com/sqlcipher/sqlcipher) — active maintenance, SQLite 3.51.3 baseline. **HIGH**
- [coleifer/sqlcipher3](https://github.com/coleifer/sqlcipher3) / [sqlcipher3 on PyPI](https://pypi.org/project/sqlcipher3/) — 0.6.2 (Jan 2026), DB-API bindings, `-wheels` variant. **MEDIUM** (wheel coverage per-platform unverified)
- [APScheduler PyPI](https://pypi.org/project/APScheduler/) + [GitHub releases](https://github.com/agronholm/apscheduler/releases) — stable 3.11.2; 4.0 pre-release "should not be used in production". **HIGH**
- [Healthchecks.io docs](https://healthchecks.io/docs/) and [healthchecks/healthchecks](https://github.com/healthchecks/healthchecks) — heartbeat model, systemd/Python integration, open-source self-hosting. **HIGH**
- [ntfy.sh](https://ntfy.sh/) / [binwiederhier/ntfy](https://github.com/binwiederhier/ntfy) + self-hosting writeups (vanwerkhoven.org, noted.lol) — iOS upstream-poll requirement for instant delivery on self-hosted servers. **MEDIUM-HIGH**
- [python-telegram-bot v22.7 docs — InlineKeyboardButton](https://docs.python-telegram-bot.org/telegram.inlinekeyboardbutton.html) — current version, callback buttons. **HIGH**
- [FastAPI on PyPI](https://pypi.org/project/fastapi/) — 0.136.3 (2026-05-23). **HIGH**; [TestDriven.io FastAPI+HTMX](https://testdriven.io/blog/fastapi-htmx/) — pattern validation. **MEDIUM**
- Anthropic model ids & pricing — claude-api skill reference (cached 2026-06-04): `claude-sonnet-4-6` $3/$15, `claude-opus-4-8` $5/$25, `claude-haiku-4-5` $1/$5 per MTok. **HIGH**
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
