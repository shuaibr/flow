# Agent Principles — Flow

> **Document hierarchy:** this repo is governed by the portfolio spec pack —
> [`SPEC.md`](../SPEC.md) (project vision: Flow personal wellness OS),
> [`PRINCIPLES.md`](../PRINCIPLES.md) (non-negotiable engineering
> constraints), [`OPERATIONS.md`](../OPERATIONS.md) (portfolio operating
> rules: WIP cap, AOR, forced-choice outputs), and
> [`framework-alignment.md`](framework-alignment.md) (loop definition and
> architecture gates). Where this doc and those conflict, **they win**.
> This doc remains as the repo-specific application of the shared principles
> to the *current* TypeScript habit-tracker codebase, which predates the
> spec; SPEC.md describes where the project is going (Garmin + manual-log
> wellness OS), not what the legacy code does today.

Foundational principles for human and AI agents working in this repository.
The operating bias is **validate first, optimize later**: ship the smallest
change that proves a product or feature hypothesis, then invest in scaling
and hardening once the feature has earned it. The only thing that is never
deferred is **baseline security** (defined below).

---

## 1. Operating model: four layers

Every change should be reasoned about through four layers. An agent should be
able to say, for any change, which layer it touches and what the criteria are.

### 1.1 Abstraction

Work at the highest level that solves the problem; don't leak lower-level
details upward.

**Criteria**
- Frontend talks to the backend only through the service modules
  (`frontend/src/services/`), never with inline `fetch` calls in components.
- Backend route handlers stay thin: routing + auth in controllers
  (`backend/controllers/`), data shape in models (`backend/models/`),
  cross-cutting concerns in `backend/utils/middleware.ts`.
- Configuration (URLs, ports, secrets) is read from environment variables via
  `backend/utils/config.ts` — never hardcoded at the call site.
- New shared types go in the existing `types.ts` files, not duplicated inline.

### 1.2 Isolation

Changes, environments, and failures must be contained.

**Criteria**
- All work happens on a feature branch; `main` is never pushed to directly.
- Test, development, and production use separate databases
  (`NODE_ENV` switches `MONGODB_URI` vs `MONGODB_TEST_URI`).
- Test-only surface area (e.g. `controllers/testing.ts`) is mounted only when
  `NODE_ENV === 'test'`.
- A failure in one feature should not take down unrelated routes: handlers
  catch their own errors and return scoped error responses.

### 1.3 Validation

Clear, cheap validation gates — biased toward speed. The goal of validation
in this phase is to prove the **feature works for a user**, not to prove the
system scales.

**Criteria, in order of priority**
1. **It runs**: backend starts (`npm run start:dev`) and frontend builds
   (`npm run build`) with no errors.
2. **The happy path works end-to-end**: signup → login → create habit →
   complete habit, verified manually or via the Cypress specs in
   `frontend/cypress/integration/`.
3. **Existing tests stay green**: backend `npm test` (Jest + Supertest) and
   lint (`npm run lint`) pass before push.
4. **New behavior gets one test**: each new endpoint or user-visible flow gets
   at least one integration or E2E test covering its happy path. Edge-case
   and load testing are deferred until the feature is validated with users.

A change that passes gates 1–3 is shippable for validation purposes. Gate 4
is required before the feature is considered "done".

### 1.4 Infrastructure capacity

Right-size infrastructure to the current phase; don't pre-buy scale.

**Criteria**
- Current targets (Render backend, Vercel frontend, MongoDB Atlas free tier)
  are sufficient until real usage proves otherwise.
- Don't add caching, queues, replicas, or CDN layers speculatively.
- Do record capacity assumptions when you make them (e.g. "single Render
  instance, cold starts acceptable") so they're visible when they break.

---

## 2. Ecosystem mapping principles

When changing how the pieces of this project fit together, check the change
against these lenses:

| Lens | What to ask here |
|---|---|
| **Scale** | Is this built for the users we have (dozens), not the users we imagine (millions)? |
| **Time** | What's the cost of this decision in 3 months? Prefer reversible decisions made quickly. |
| **Causality** | If this change breaks something, can we trace why? (Morgan request logging, scoped errors.) |
| **Fan-in/out** | How many components depend on what you're touching? `types.ts` and `config.ts` have high fan-out — change with care. |
| **Emergence** | Watch for behavior no single component owns (e.g. localStorage state vs server state drifting). |
| **Incentives** | Make the easy path the correct path — e.g. env vars easier to use than hardcoding. |
| **Capacity** | Respect limits of free-tier infra and of reviewer attention: small PRs. |
| **Feedback loops** | Shorten them: run tests locally before pushing; prefer fast manual verification over slow exhaustive suites during validation. |
| **Bottlenecks** | The single `App.tsx` state container is the known frontend bottleneck; don't add to it, extract from it. |

---

## 3. Ecosystem components and ownership

The components agents interact with in this repo, and the expectation for each:

- **Source code / version control** — GitHub, feature branches, descriptive
  commits. The diff is the record of what was done.
- **Build tools** — `tsc` for backend, CRA (`react-scripts`) for frontend.
  Builds must pass before push.
- **Static analysis** — ESLint in both packages; run it, don't disable rules
  to get green.
- **Testing tools/compute** — Jest + Supertest (backend), Cypress (frontend).
  Tests run locally; there is no CI yet — adding CI is a known gap, deferred
  behind product validation.
- **Code review** — review is mentorship and quality control, not gatekeeping.
  Keep PRs small enough to review in one sitting.
- **Release tooling** — Render (backend) and Vercel (frontend) deploy from
  `main`. Merging to `main` *is* a release; treat it that way.
- **Observability** — Morgan request logs only, for now. Sufficient for the
  validation phase.
- **Token/secret management** — environment variables only (`.env` locally,
  Render/Vercel dashboards in deployment). See §5.

---

## 4. Cultural principles

- **Engineering-led, transparency by default** — decisions and their reasons
  live in commits, PRs, and this doc, not in private context.
- **Standardization is valuable** — follow the patterns already in the repo
  before inventing new ones.
- **Blameless postmortems** — when something breaks (including leaked
  secrets), fix the system that allowed it, then move on.
- **Automation is better than toil** — but only automate what you've done
  manually at least twice; automation is an optimization and follows the
  validate-first rule.
- **Sustainability over heroics** — small, frequent, reversible changes beat
  big-bang rewrites.

---

## 5. Security: baseline now, hardening later

Security work is split into a **non-negotiable baseline** (always enforced,
even during rapid validation) and **hardening** (scheduled after product
validation).

### 5.1 Baseline (repo level — never deferred)

- **No secrets in source or git history.** Connection strings, passwords,
  JWT secrets, and API keys come from environment variables via
  `utils/config.ts`. If a secret is ever committed, it is considered
  compromised: rotate it immediately, then remove it from code.
- **`.gitignore` hygiene.** `.env*`, `node_modules`, build output, OS junk
  (`.DS_Store`), and archives/binaries are ignored and never committed.
- **Passwords are hashed** (bcrypt — already in place) and never logged or
  returned in responses.
- **Auth required for writes.** Any endpoint that creates, mutates, or
  deletes user data must verify a token. (Known gap: habit `PUT`/`DELETE`
  currently don't — this is baseline, not hardening, and should be fixed.)
- **Dependencies with critical known vulnerabilities** are patched when
  flagged; broader upgrade campaigns are hardening.

### 5.2 Hardening (deferred until after validation)

- Per-user authorization checks (ownership of habits) beyond token presence.
- Token expiry and refresh flows.
- Rate limiting, input sanitization beyond schema validation, security
  headers, CSP.
- Dependency modernization (React 17 → current, Mongoose 5 → current, etc.).
- CI with automated test + audit gates.

---

## 6. Fundamentals checklist

Before merging, an agent should be able to answer yes to:

- [ ] **Decision making** — is the smallest change that validates the goal?
- [ ] **Technical strategy** — follows existing patterns or documents why not?
- [ ] **Developer productivity** — leaves the repo easier to work in, not harder?
- [ ] **Collaboration** — PR is small, described, and reviewable?
- [ ] **Security** — baseline (§5.1) holds; no secrets, auth on writes?
- [ ] **Code health** — lint and existing tests pass?
- [ ] **Release hygiene** — safe to deploy the moment it lands on `main`?
- [ ] **Reliability** — happy path verified end-to-end?
