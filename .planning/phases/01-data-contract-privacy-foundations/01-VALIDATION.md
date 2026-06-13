---
phase: 1
slug: data-contract-privacy-foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (installed by Wave 0 via `uv`) |
| **Config file** | `pyproject.toml` (`[tool.pytest.ini_options]`) — Wave 0 creates |
| **Quick run command** | `uv run pytest -q` |
| **Full suite command** | `uv run pytest` |
| **Estimated runtime** | ~5 seconds (pure-function + in-temp-dir DB tests) |

---

## Sampling Rate

- **After every task commit:** Run `uv run pytest -q`
- **After every plan wave:** Run `uv run pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

Representative mapping — exact task IDs are assigned by the planner. Every
phase requirement has at least one automated test.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-xx | 01 | 0 | — | — | pytest+ruff scaffold green | unit | `uv run pytest -q` | ❌ W0 | ⬜ pending |
| 1-0x-xx | 0x | 1 | PRIV-01 | — | DB file on disk is ciphertext; opening without key raises DatabaseError | unit | `uv run pytest tests/test_store_encryption.py` | ❌ W0 | ⬜ pending |
| 1-0x-xx | 0x | 1 | PRIV-02 | — | `private.db` is a separate file with its own key; main-key open of private file fails; export excludes it | unit | `uv run pytest tests/test_namespace_isolation.py` | ❌ W0 | ⬜ pending |
| 1-0x-xx | 0x | 1 | PRIV-04 | — | no secret literals in tracked files; key sourced from env; tokens dir gitignored | unit | `uv run pytest tests/test_secrets_discipline.py` | ❌ W0 | ⬜ pending |
| 1-0x-xx | 0x | 1 | DATA-01 | — | pydantic schemas for 7 Garmin streams + events table; missing fields → None (no imputation); schema_version present | unit | `uv run pytest tests/test_schemas.py` | ❌ W0 | ⬜ pending |
| 1-0x-xx | 0x | 1 | DATA-02 | — | three ADR files exist in docs/adr/ with required decisions | unit | `uv run pytest tests/test_adrs_present.py` | ❌ W0 | ⬜ pending |
| 1-0x-xx | 0x | 1 | OPS-02 | — | BudgetGuard warns at 80%, raises BudgetError at 100%; budgets read from config.yaml; state persists | unit | `uv run pytest tests/test_budget_guard.py` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pyproject.toml` — `uv` project + pytest/ruff config (Wave 0 scaffold)
- [ ] `tests/conftest.py` — shared fixtures (temp-dir encrypted DB, test key from env)
- [ ] pytest + ruff installed via `uv` (no framework present yet — greenfield)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| On-disk ciphertext spot check | PRIV-01 | Belt-and-suspenders over the automated test; reassures operator | `hexdump -C data/flow.db \| head` shows no plaintext markers; `grep` for a known inserted value returns nothing |

*All phase behaviors also have automated verification; the row above is an optional operator-facing double-check.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
