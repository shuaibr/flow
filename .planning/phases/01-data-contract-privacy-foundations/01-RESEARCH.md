# Phase 1: Data Contract & Privacy Foundations - Research

**Researched:** 2026-06-13
**Domain:** Encrypted local storage (SQLCipher), pydantic v2 schema versioning, ULID generation, Python project scaffold (uv + src-layout), secrets discipline, budget guards in config
**Confidence:** HIGH — empirically verified on the sandbox environment (Python 3.11 and 3.12 tested)

---

## Summary

Every expensive-to-change decision is made and enforced in code before any data flows. This phase creates the foundation that all subsequent phases build on: the encrypted dual-database store, versioned stream schemas, a separate private namespace, secrets discipline, and budget guards. Project-level research (STACK.md, ARCHITECTURE.md, PITFALLS.md) already resolves the technology choices; this research verifies the implementation specifics empirically and fills in the remaining open questions from the phase brief.

**Key empirical findings in this session:**
1. `sqlcipher3-wheels` 0.5.7 installs and works on both Python 3.11 and Python 3.12 via uv (Python 3.12 via `uv add` in a managed environment — confirmed working). The MEDIUM-confidence platform flag from project research is now RESOLVED for Linux x86_64 on Python 3.11 and 3.12.
2. SQLCipher encryption verified end-to-end: `PRAGMA key` as first statement produces fully ciphertext on-disk files; wrong key raises `DatabaseError`; correct key reopens cleanly. WAL-mode connections also encrypt sidecar files.
3. `python-ulid` 3.1.0 (API: `ULID()`, `.datetime`, `.from_str()`) works correctly and produces 26-char Crockford Base32 sortable identifiers.
4. `pydantic` 2.13.4 with `Optional[field]` `= None` correctly models missing-data honesty (all fields can be None, none imputed).
5. `pydantic-settings` 2.14.1 with `YamlConfigSettingsSource` works for `config.yaml` loading; `pydantic-settings[yaml]` extra required (adds PyYAML).
6. Budget guard pattern (warn 80%, hard-block 100%) verified in plain Python — no library needed.
7. Namespace isolation verified: two separate DBs with separate keys; wrong key on the private DB raises `DatabaseError` — separation is structural, not query-discipline.

**Primary recommendation:** Build the project scaffold first (`uv init --app --package --python 3.12`), wire the connection factory and dual-DB namespace next, define all 7+1 pydantic schemas, then write the Walking Skeleton test (one encrypted write/read + one schema validation). The phase is intentionally greenfield so the build order within it is unconstrained.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Storage & Encryption:**
- SQLite + SQLCipher (AES-256 at rest) via `sqlcipher3`/`sqlcipher3-wheels`; app-level encryption, not filesystem-only (framework-alignment Codified Learning #2)
- Main store at `data/flow.db`; spiritual-practice namespace is a physically separate `data/private.db` file, never a column flag (Learning #4)
- `PRAGMA key` must be the first statement on every connection — one connection factory owns this
- Raw Garmin pulls table keyed `(stream, metric_date, payload_hash)` for re-pull idempotency (Learning #2) — schema defined now, populated in Phase 2
- One universal `events` table for all manual logs: ULID id, `event_type`, `occurred_on`, `schema_version`, JSON payload, `supersedes` for append-only corrections (Learning #3)
- Derived tables rebuilt transactionally by idempotent recompute; never hand-edited (Learning #5)
- Encryption verification is testable: opening the DB file without the key yields ciphertext, including WAL/journal sidecars

**Schemas & Validation:**
- Versioned pydantic schemas for every Phase 1 stream (7 Garmin streams: HRV status, sleep stages, Body Battery, Training Readiness, stress, activities, resting HR + manual-log events) BEFORE any ingestion code (DATA-01)
- Golden set foundation: 21 synthetic day-payloads with expected outcomes (framework-alignment Validation gate) — fixture format established this phase
- Missing-data honesty: schemas must represent absent streams explicitly, never impute (Learning #11)

**Secrets & Privacy:**
- No secrets in source, commits, or logs; env-only (PRINCIPLES §2 Security; PRIV-04)
- Garmin tokens will persist OUTSIDE the repo in an app-owned data dir with restricted permissions (location decided here, used in Phase 2)
- No third-party analytics anywhere; export path excludes `private.db` by default (PRIV-02)
- PII never logged

**ADRs (DATA-02) — 5-line format per PRINCIPLES §2:**
- ADR: Garmin access via community `garminconnect` library (official Health API excludes personal use — legal-entity application + license fees; `garth` deprecated/broken; per-run logins risk 48h+ account lockouts)
- ADR: Encryption choice (SQLCipher app-level vs filesystem-only; record the `sqlcipher3-wheels` platform-coverage validation result — flagged MEDIUM confidence in research)
- ADR: Private-namespace isolation design (separate DB file, export/telemetry exclusion by construction)

**Budgets (OPS-02):**
- All budgets in `config.yaml`: runtime ceiling per job (≤5 min), API call caps (1 Garmin sync/day + on-demand), LLM spend (≤$0.50 CAD/day, ≤1 narrative call/week)
- Enforced by code-level guards: warn at 80%, hard-block at 100% — in code, not prompts
- Model tier assignments live in config, never inline (PRINCIPLES §5)

**Project Layout & Tooling:**
- Python 3.12+; `uv` for env + deps (one-command setup `uv sync`); pytest + ruff from day one (single lint config, single test runner)
- Adapters pattern: `src/adapters/<provider>.py` — one file per external service (framework-alignment Architecture gate; implemented progressively, layout established now)
- Plain Python + SQLite — no heavy orchestrators (OPERATIONS Do-Not-Do #1)
- New dependencies need an ADR (PRINCIPLES §2)

### Claude's Discretion

- Exact pydantic model organization and naming
- Migration/versioning mechanics for `schema_version`
- Test layout and fixture format details
- Connection-factory API shape
- Whether `config.yaml` loading uses pydantic-settings (research-recommended) or stdlib

### Deferred Ideas (OUT OF SCOPE)

- Garmin ingestion implementation (Phase 2 — INGEST-01..04)
- Readiness computation, delivery, heartbeats (Phase 2)
- Export/delete commands (Phase 5 — PRIV-03; but store design must not preclude them)
- Open Wearables adapter (v2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRIV-01 | All health data is stored locally and encrypted at rest (SQLCipher); no third-party analytics anywhere | SQLCipher 4.x with `sqlcipher3-wheels` 0.5.7 verified working on Python 3.11 and 3.12 Linux x86_64; full AES-256-CBC encryption including WAL confirmed. Connection factory + `chmod 600` on data dir covers the requirement. |
| PRIV-02 | Spiritual-practice logs live in a physically separate `private.db`, excluded from export and any future telemetry by construction | Dual-DB architecture verified: separate file + separate key; wrong key → `DatabaseError`. Namespace isolation is structural (separate file), not query discipline. |
| PRIV-04 | No secrets in source, commits, or logs; Garmin tokens persist outside the repo with restricted permissions | `pydantic-settings` env-prefix loading separates secrets (env) from config (yaml). Token directory: `data/` (outside repo root is better; can be `~/.local/share/flow/` with `chmod 700`). `.gitignore` must cover `data/`, `.env`, `*.db`, `*.db-wal`, `*.db-shm`. |
| DATA-01 | Versioned schemas exist for every Phase 1 data stream (7 Garmin streams + manual-log events) before any ingestion code | 8 pydantic v2 models: `HRVStatusPayload`, `SleepStagesPayload`, `BodyBatteryPayload`, `TrainingReadinessPayload`, `StressPayload`, `ActivitiesPayload`, `RestingHRPayload`, `EventPayload` (base). All fields `Optional[T] = None` for missing-data honesty. `schema_version: Literal[N]` for versioning. |
| DATA-02 | ADRs recorded in `docs/adr/` for Garmin access method, encryption choice, and private-namespace isolation | Three ADRs needed in 5-line PRINCIPLES §2 format: `0001-garmin-access.md`, `0002-encryption.md`, `0003-private-namespace.md`. `docs/adr/` directory must be created. |
| OPS-02 | All budgets (runtime, API calls, LLM spend) live in config, enforced in code, warn at 80%, hard-block at 100% | `config.yaml` with `pydantic-settings` (`YamlConfigSettingsSource`). `BudgetGuard` class: `check(used, cap)` → warn at 80%, raise `BudgetError` at 100%. Budget state (LLM token usage) persisted to `flow.db`. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Encrypted DB storage (SQLCipher) | Database / Storage | — | The `store/` layer is the only SQL issuer; encryption lives in the connection factory, not in callers |
| Dual-namespace isolation (`flow.db` / `private.db`) | Database / Storage | — | File-level separation; private factory is only exposed to explicitly namespace-aware code paths |
| Stream schemas (pydantic models) | API / Backend (Validation layer) | — | Pydantic models are the Validation layer's schema checks on every raw pull and manual log |
| Config loading (`config.yaml` + env secrets) | API / Backend (Infra Capacity layer) | — | `pydantic-settings` bridges config file and env vars; read by all layers |
| Budget guards (warn/block) | API / Backend (Infra Capacity layer) | — | Code-level enforcement; called at every metered operation before dispatch |
| ADR authoring | — | — | Documentation artifact; no runtime tier, but must exist before Phase 2 implements the decisions |
| Project scaffold (`uv`, `pyproject.toml`, `pytest`, `ruff`) | Infrastructure | — | Dev toolchain, not a runtime tier; sets up the environment for all other tiers |
| Walking Skeleton test | API / Backend (Validation layer) | — | Exercises the store layer end-to-end; proves encrypted write/read + schema validation round-trip |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sqlcipher3-wheels` | 0.5.7 [VERIFIED: PyPI] | Encrypted SQLite DB-API binding | Bundles SQLCipher 4.x (AES-256-CBC, WAL encryption); installs without compiling; coleifer-maintained; verified working Python 3.11 + 3.12 Linux x86_64 in this session |
| `pydantic` | 2.13.4 [VERIFIED: PyPI] | Versioned stream schemas + event validation | v2 preferred; `Optional[T] = None` models missing-data honesty; `Literal[N]` for schema_version; `model_dump()` for JSON serialization to DB payload |
| `pydantic-settings` | 2.14.1 [VERIFIED: PyPI] | `config.yaml` + env loading | `YamlConfigSettingsSource` (requires `pydantic-settings[yaml]`); `FLOW_` env prefix for secrets isolation; merges yaml config with env overrides cleanly |
| `python-ulid` | 3.1.0 [VERIFIED: PyPI] | ULID generation for `event_id` | `ULID()` → 26-char Crockford Base32 sortable text; `.datetime` accessor; no coordination needed; slopcheck OK |
| `pytest` | 9.0.3 [VERIFIED: PyPI] | Test runner | PRINCIPLES single-test-runner requirement; slopcheck OK |
| `ruff` | 0.15.17 [VERIFIED: PyPI] | Linter + formatter | PRINCIPLES single-lint-config requirement; replaces flake8 + isort + black; one config block in pyproject.toml; slopcheck OK |
| `uv` | 0.8.17 [VERIFIED: installed] | Project scaffold + dep management | `uv init --app --package --python 3.12` creates src-layout with `[project.scripts]` for the `flow` CLI; `uv sync` one-command setup; `uv add` for deps |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `PyYAML` | 6.0.1 [VERIFIED: installed] | YAML parsing for `config.yaml` | Pulled in automatically by `pydantic-settings[yaml]`; no direct import needed |
| `python-dotenv` | 1.2.2 [VERIFIED: installed] | `.env` file loading | Pulled in by `pydantic-settings`; useful for local dev secret injection without polluting the shell environment |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pydantic-settings` | `stdlib yaml + os.environ` | Stdlib approach is simpler but loses schema validation of config values and auto env-override merging. Discretion area per CONTEXT.md — `pydantic-settings` recommended since pydantic is already a dependency. |
| `python-ulid` | `uuid.uuid4()` as TEXT | UUIDs work and are stdlib, but are not time-sortable. ULIDs sort chronologically by generation time, making `ORDER BY event_id` equivalent to `ORDER BY recorded_at` — useful for event replay. Both are viable; ULID chosen per CONTEXT.md locked decision. |
| `sqlcipher3-wheels` | `sqlcipher3` + system libsqlcipher | System lib fallback avoids wheel binary but requires `libsqlcipher-dev` installed on the OS. Use only if the wheels package fails on target platform (macOS arm64 — not yet tested in this session). |

### Installation

```bash
# Project init (in /home/user/flow)
uv init --app --package --python 3.12

# Core dependencies
uv add "sqlcipher3-wheels" "pydantic>=2.13" "pydantic-settings[yaml]>=2.14" "python-ulid>=3.1"

# Dev dependencies
uv add --dev "pytest>=9" "ruff>=0.15"
```

---

## Package Legitimacy Audit

> slopcheck 0.6.1 was available and run in this session.

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `sqlcipher3-wheels` | PyPI | [OK] | Approved — coleifer-maintained, 0.5.7, established |
| `pydantic` | PyPI | [OK] | Approved — core ecosystem, 2.13.4 |
| `pydantic-settings` | PyPI | [OK] | Approved — official pydantic org, 2.14.1 |
| `python-ulid` | PyPI | [OK] | Approved — slopcheck noted "name looks like LLM bait but package is established"; verified via direct install and API test |
| `pytest` | PyPI | [OK] | Approved — universal standard |
| `ruff` | PyPI | [OK] | Approved — astral-sh, dominant linter/formatter |
| `uv` | PyPI | [OK] | Approved — astral-sh, dominant env manager |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

This phase creates the foundational layers; data does not yet flow in production (Garmin ingest is Phase 2).

```
Phase 1 scope: boxes in [brackets] are created; arrows show future data paths

[pyproject.toml / uv.lock]      ← one-command setup (uv sync)
[config.yaml]                   ← budgets, model tier, channel config
[.env (gitignored)]             ← FLOW_DB_KEY, future secrets (never in repo)
        │
        ▼
[src/flow/config.py]            ← pydantic-settings loads config.yaml + FLOW_* env
        │
        ├──► [BudgetGuard]      ← warn 80%, hard-block 100% on every metered op
        │
[src/flow/store/]               ← ONLY module that issues SQL
        │
        ├──► [db.py: DBConnectionFactory]
        │        ├── main_db()   → data/flow.db     (AES-256, PRAGMA key first)
        │        └── private_db() → data/private.db  (separate key, separate file)
        │
        ├──► [schema.py: DDL]
        │        ├── raw_garmin  (stream, metric_date, payload_hash UNIQUE)
        │        ├── events      (ULID, event_type, occurred_on, schema_version, payload, supersedes)
        │        └── derived stubs (daily_facts, baselines, readiness_scores — empty until Phase 2)
        │
[src/flow/schemas/]             ← pydantic v2 models, ALL fields Optional[T] = None
        ├── garmin.py           ← HRVStatus, SleepStages, BodyBattery, TrainingReadiness,
        │                          Stress, Activities, RestingHR  (7 models)
        └── events.py           ← EventPayload base + per-type payload models
                                   (SaunaPayload, PerceivedReadinessPayload, ...)

[docs/adr/]                     ← 0001-garmin-access.md, 0002-encryption.md,
                                   0003-private-namespace.md

[tests/]
        ├── conftest.py         ← tmp db fixtures (in-memory or temp file)
        ├── test_store.py       ← Walking Skeleton: encrypted write/read, wrong-key error,
        │                          namespace isolation, WAL encryption
        └── test_schemas.py     ← schema validation: valid payload, missing fields OK,
                                   invalid type raises ValidationError
```

### Recommended Project Structure

```
/home/user/flow/
├── pyproject.toml               # uv project; [project.scripts] flow = "flow.cli:main"
├── uv.lock                      # committed lock file
├── config.yaml                  # non-secret config (budgets, model tier, schema versions)
├── .env.example                 # template (committed); .env is gitignored
├── .gitignore                   # data/, .env, *.db, *.db-wal, *.db-shm, __pycache__
├── data/                        # gitignored; chmod 700 at init
│   ├── flow.db                  # main encrypted store
│   ├── private.db               # private namespace (separate key)
│   └── tokens/                  # Garmin tokens (outside repo, restricted perms, Phase 2)
├── docs/
│   └── adr/
│       ├── 0001-garmin-access.md
│       ├── 0002-encryption.md
│       └── 0003-private-namespace.md
├── src/
│   └── flow/
│       ├── __init__.py
│       ├── cli.py               # `flow init` Walking Skeleton entry point
│       ├── config.py            # FlowSettings (pydantic-settings), BudgetGuard
│       ├── store/
│       │   ├── __init__.py
│       │   ├── db.py            # DBConnectionFactory (main + private), data dir init
│       │   └── schema.py        # DDL: raw_garmin, events, derived stubs
│       └── schemas/
│           ├── __init__.py
│           ├── garmin.py        # 7 Garmin stream pydantic models
│           └── events.py        # EventPayload + per-event-type payload models
└── tests/
    ├── conftest.py              # pytest fixtures: tmp_db_factory, main_conn, private_conn
    ├── test_store.py            # encryption, namespace isolation, DDL, idempotent init
    └── test_schemas.py          # schema validation, missing-data honesty, version field
```

### Pattern 1: Connection Factory (PRAGMA key first)

**What:** One class owns PRAGMA key as the absolutely first statement on every connection. No caller ever issues PRAGMA key directly.

**When to use:** Every SQLite connection in the system — main and private DB.

```python
# src/flow/store/db.py
# [VERIFIED: tested in sandbox session 2026-06-13]
import sqlcipher3
from pathlib import Path

class DBConnectionFactory:
    """Single factory that ensures PRAGMA key is the first statement on every connection."""

    def __init__(self, path: str | Path, key: str) -> None:
        self._path = str(path)
        self._key = key

    def connect(self):
        conn = sqlcipher3.dbapi2.connect(self._path)
        # MUST be the first statement — no exception
        conn.execute(f"PRAGMA key = '{self._key}'")
        conn.row_factory = sqlcipher3.dbapi2.Row
        return conn

    def __enter__(self):
        self._conn = self.connect()
        return self._conn

    def __exit__(self, *exc):
        self._conn.close()


def get_factories(data_dir: Path, main_key: str, private_key: str):
    """Return (main_factory, private_factory). Keys from env only."""
    data_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    return (
        DBConnectionFactory(data_dir / "flow.db", main_key),
        DBConnectionFactory(data_dir / "private.db", private_key),
    )
```

### Pattern 2: Pydantic Schemas — Missing-Data Honesty

**What:** All fields are `Optional[T] = None`. A watch-not-worn night produces a model where every field is `None` — explicit absence, never imputed.

**When to use:** All 7 Garmin stream schemas + every event payload model.

```python
# src/flow/schemas/garmin.py
# [VERIFIED: pydantic 2.13.4, tested in sandbox 2026-06-13]
from pydantic import BaseModel, field_validator
from typing import Optional, Literal

class HRVStatusPayload(BaseModel):
    """Garmin HRV Status stream schema. All fields Optional — missing is explicit."""
    schema_version: Literal[1] = 1
    rmssd_ms: Optional[float] = None
    status: Optional[str] = None          # 'balanced' | 'unbalanced' | 'poor'
    weekly_avg_ms: Optional[float] = None
    last_5_night_avg_ms: Optional[float] = None

    @field_validator("rmssd_ms", "weekly_avg_ms", "last_5_night_avg_ms")
    @classmethod
    def must_be_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("HRV measurements must be positive")
        return v


class SleepStagesPayload(BaseModel):
    schema_version: Literal[1] = 1
    total_sleep_minutes: Optional[int] = None
    deep_sleep_minutes: Optional[int] = None
    light_sleep_minutes: Optional[int] = None
    rem_sleep_minutes: Optional[int] = None
    awake_minutes: Optional[int] = None
    sleep_score: Optional[int] = None        # 0-100 Garmin score


class BodyBatteryPayload(BaseModel):
    schema_version: Literal[1] = 1
    morning_level: Optional[int] = None      # 0-100
    evening_level: Optional[int] = None
    charged_amount: Optional[int] = None
    drained_amount: Optional[int] = None


class TrainingReadinessPayload(BaseModel):
    schema_version: Literal[1] = 1
    score: Optional[int] = None              # 0-100 Garmin TR score
    level: Optional[str] = None             # 'excellent'|'good'|'moderate'|'low'|'none'
    recovery_time_hours: Optional[float] = None


class StressPayload(BaseModel):
    schema_version: Literal[1] = 1
    avg_stress_level: Optional[int] = None   # 0-100
    max_stress_level: Optional[int] = None
    rest_stress_duration_minutes: Optional[int] = None
    activity_stress_duration_minutes: Optional[int] = None


class ActivitiesPayload(BaseModel):
    """Summary of activities for the day (one row per day, not per activity)."""
    schema_version: Literal[1] = 1
    total_activity_minutes: Optional[int] = None
    activity_types: Optional[list[str]] = None   # ['running', 'strength_training', ...]
    total_calories: Optional[int] = None
    training_load: Optional[float] = None


class RestingHRPayload(BaseModel):
    schema_version: Literal[1] = 1
    resting_hr_bpm: Optional[int] = None
```

### Pattern 3: Budget Guard

**What:** `BudgetGuard.check(used, cap)` raises `BudgetError` at 100% and calls a notify function at 80%. Callers check before dispatching any metered operation.

**When to use:** LLM calls (weekly digest), Garmin sync count (1/day cap). Not needed for SQLite operations (no external metering).

```python
# src/flow/config.py  [VERIFIED: tested in sandbox 2026-06-13]
class BudgetError(Exception):
    """Raised when a hard budget ceiling is exceeded."""


class BudgetGuard:
    """Warn at warn_pct, hard-block at 100%."""

    def __init__(self, name: str, cap: float, warn_pct: float = 0.80) -> None:
        self.name = name
        self.cap = cap
        self.warn_pct = warn_pct

    def check(self, used: float, notify_fn=None) -> None:
        pct = used / self.cap
        if pct >= 1.0:
            raise BudgetError(
                f"{self.name} budget exhausted: {used:.4f}/{self.cap:.4f} "
                f"({pct*100:.1f}%) — hard block"
            )
        if pct >= self.warn_pct and notify_fn:
            notify_fn(
                f"BUDGET WARN: {self.name} at {pct*100:.1f}% "
                f"({used:.4f}/{self.cap:.4f})"
            )
```

### Pattern 4: pydantic-settings Config Loading

**What:** `FlowSettings` inherits from `BaseSettings` and reads from `config.yaml` first, then `FLOW_*` env vars override. Secrets (DB key) come only from env — never from config.yaml.

```python
# src/flow/config.py
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict, YamlConfigSettingsSource
from pydantic_settings.main import PydanticBaseSettingsSource
from typing import Tuple, Type

class FlowSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FLOW_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Secrets — env only (FLOW_DB_KEY, FLOW_PRIVATE_DB_KEY)
    db_key: str = Field(default="", description="SQLCipher key for flow.db; FLOW_DB_KEY env var")
    private_db_key: str = Field(default="", description="SQLCipher key for private.db; FLOW_PRIVATE_DB_KEY")

    # Budgets (from config.yaml, env can override)
    garmin_sync_per_day: int = 1
    llm_spend_cap_cad_day: float = 0.50
    llm_narrative_calls_per_week: int = 1
    job_timeout_seconds: int = 300
    budget_warn_pct: float = 0.80

    # LLM config (never hardcode — PRINCIPLES §5)
    digest_model: str = "claude-sonnet-4-6"
    digest_max_output_tokens: int = 2000
    monthly_token_budget: int = 50000        # conservative; ~$0.15/month at Sonnet rates

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        **kwargs,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        return (
            kwargs["env_settings"],           # env vars override yaml
            YamlConfigSettingsSource(settings_cls, yaml_file="config.yaml"),
            kwargs["dotenv_settings"],
            kwargs["init_settings"],
        )
```

### Pattern 5: SQLCipher Cipher Hardening

**What:** SQLCipher 4.x ships secure defaults (AES-256-CBC, PBKDF2-HMAC-SHA512, 256000 iterations). Additional PRAGMA settings can be set after key for explicit control and documentation.

**When to use:** Connection factory initialization, after `PRAGMA key`.

```python
# Optional: explicit cipher hardening after PRAGMA key
# These match SQLCipher 4.x defaults — set them explicitly for documentation
conn.execute("PRAGMA cipher_page_size = 4096")
conn.execute("PRAGMA kdf_iter = 256000")
conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
conn.execute("PRAGMA journal_mode = WAL")   # WAL is also encrypted by SQLCipher
```

> Note: SQLCipher 4.x WAL files are encrypted automatically — no special handling needed. The `-wal` and `-shm` sidecars are encrypted when the main DB is encrypted. [VERIFIED: tested in sandbox — WAL mode active, no plaintext in sidecars]

### Anti-Patterns to Avoid

- **PRAGMA key anywhere except the connection factory:** If any caller issues `PRAGMA key` directly, there is no longer a single enforcement point. Every new connection path becomes a potential unkeyed access vector.
- **Storing DB key in `config.yaml` or the repo:** The key is the entire security of the encrypted store. Config is committed. Key goes in `FLOW_DB_KEY` env var only.
- **`is_private = 1` column flag instead of separate file:** One missing WHERE clause in any export, telemetry, or digest code leaks the most sensitive data. Separate file = structural exclusion.
- **Mutable `schema_version` field:** Once a row is written with schema_version = 1, that version must remain frozen for as long as the row exists. New schemas get Literal[2], etc. Never update a row's schema_version.
- **`Optional` fields imputed to defaults:** If the watch wasn't worn, all fields remain `None`. Never substitute 0, mean, or last-known value — that is imputation.
- **`uv add --upgrade` in production:** Lock file is pinned. Only upgrade deliberately with a commit + regression test.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypted SQLite | Custom field encryption layer | `sqlcipher3-wheels` | Field encryption misses WAL/journal sidecars, indexes, and metadata; full-DB encryption is transparent and covers everything |
| Config + secret loading | `os.environ.get()` scattered through codebase | `pydantic-settings` | Scattered env reads can't validate types, ranges, or required fields at startup; pydantic-settings validates the full settings object at import time |
| Budget tracking | Ad-hoc counters in module globals | `BudgetGuard` class + persistence to `flow.db` | Module globals reset on process restart; budget state must survive across job runs |
| ULID generation | Manual timestamp + random string | `python-ulid` | ULIDs have a defined binary/text encoding; home-grown timestamps may not sort correctly or collide |
| Schema validation | `isinstance()` checks + manual field parsing | `pydantic` | Manual parsing misses nested validation, type coercion, and doesn't give structured error messages for debugging |

**Key insight:** SQLCipher does more work than it appears — it encrypts not just the page content but the page header, WAL frames, and checksum blocks. Any hand-rolled encryption that wraps plain SQLite will miss these and leave metadata in plaintext on disk.

---

## Common Pitfalls

### Pitfall 1: PRAGMA key not first statement

**What goes wrong:** Calling any other PRAGMA or SQL before `PRAGMA key` on an encrypted DB raises `DatabaseError: file is not a database` because SQLCipher tries to read the unkeyed header first and finds ciphertext.

**Why it happens:** `conn.execute("PRAGMA journal_mode = WAL")` before `PRAGMA key` is a natural ordering mistake.

**How to avoid:** The connection factory is the single place where `PRAGMA key` is issued, and it is the first line after `connect()`. No code outside the factory opens a connection.

**Warning signs:** `DatabaseError: file is not a database` on a DB that was created and written successfully earlier.

---

### Pitfall 2: DB key in `config.yaml` or `.env` committed to repo

**What goes wrong:** The encryption key is committed to git. SQLCipher encryption is fully bypassed — anyone with the repo has the key.

**Why it happens:** `config.yaml` is convenient for all config; the key "is just another config value."

**How to avoid:** `FlowSettings` uses `env_prefix="FLOW_"` and the DB key field is `Field(default="", ...)` — it can ONLY be set via `FLOW_DB_KEY` env var. `config.yaml` must not contain a `db_key` or `private_db_key` field (pydantic-settings `extra="ignore"` would silently drop it but document the exclusion explicitly).

**Warning signs:** `FLOW_DB_KEY` appears in `config.yaml`; `.env` is not in `.gitignore`.

---

### Pitfall 3: sqlcipher3-wheels not installed in the active Python environment

**What goes wrong:** `import sqlcipher3` raises `ModuleNotFoundError`. On Python 3.12, the system Python 3.12 binary (`/usr/bin/python3.12`) does not have `sqlcipher3-wheels` installed — only the uv-managed virtual environment does.

**Why it happens:** Installing with `pip install sqlcipher3-wheels` under Python 3.11 does not affect the 3.12 interpreter.

**How to avoid:** Always run the project via `uv run python` or activate the uv venv. The `[project.scripts]` entry in `pyproject.toml` ensures `flow` runs in the correct environment. Verify with: `uv run python -c "import sqlcipher3; print('OK')"`.

**Warning signs:** Tests pass under `uv run pytest` but fail under direct `python3.12 -m pytest`.

---

### Pitfall 4: `private.db` opened by export/digest code

**What goes wrong:** Export or digest code iterates all `*.db` files in `data/`, opening `private.db`. Private spiritual-practice events are inadvertently included in exports or sent to the LLM.

**Why it happens:** Convenience loops over the data directory.

**How to avoid:** Export and digest code holds a reference to `main_factory` only. `private_factory` is only accessible via an explicitly named function (`get_private_factory()`) that requires a separate opt-in call. `data/private.db` is never enumerated by glob.

**Warning signs:** Any code path that opens `data/*.db` in a loop.

---

### Pitfall 5: `schema_version` treated as mutable for existing rows

**What goes wrong:** When a schema evolves, code tries to UPDATE existing rows' `schema_version` to the new version. Old rows are now mis-labeled — the payload is v1 but the version says v2. Replay fails because the v2 parser can't handle the v1 shape.

**Why it happens:** Schema versioning is confused with database migration (ALTER TABLE).

**How to avoid:** `schema_version` is written once at insert time and never updated. New schema version = new pydantic class (`HRVStatusPayloadV2`). Old rows are read with the old parser, new rows with the new one. The reader dispatches on `schema_version`. This is the SPEC's "append-only corrections via `supersedes`" pattern applied to schemas.

---

### Pitfall 6: `pydantic-settings` YAML source ordering

**What goes wrong:** YAML values override env vars because the settings source order is wrong. `FLOW_DIGEST_MODEL` set in the environment is silently ignored because `config.yaml` takes precedence.

**Why it happens:** The default `settings_customise_sources` order puts `init_settings` first, then `env_settings`, then `dotenv_settings`. A custom YAML source is often appended last but should have lower priority than env vars.

**How to avoid:** In `settings_customise_sources`, place `env_settings` BEFORE `YamlConfigSettingsSource`. Env vars always win over config file. (See Pattern 4 above — this is the verified correct order.)

---

## Code Examples

### Walking Skeleton: `flow init`

```python
# src/flow/cli.py
# [BASED ON: verified connection factory + schema patterns above]
import os
import click
from pathlib import Path
from flow.config import FlowSettings
from flow.store.db import DBConnectionFactory
from flow.store.schema import init_schema

@click.group()
def cli():
    pass

@cli.command()
def init():
    """Initialize the encrypted store and verify it works end-to-end."""
    settings = FlowSettings()
    data_dir = Path("data")
    data_dir.mkdir(mode=0o700, parents=True, exist_ok=True)

    main_factory = DBConnectionFactory(data_dir / "flow.db", settings.db_key)
    with main_factory as conn:
        init_schema(conn)
        # Walking Skeleton: trivial write/read proves encryption round-trip
        conn.execute(
            "INSERT OR IGNORE INTO events "
            "(event_id, event_type, occurred_on, recorded_at, schema_version, payload) "
            "VALUES (?, ?, ?, datetime('now'), ?, ?)",
            ("01INIT000000000000000000000", "system_init", "2026-06-13", 1, '{"status": "ok"}')
        )
        conn.commit()
        row = conn.execute(
            "SELECT event_type FROM events WHERE event_id = ?",
            ("01INIT000000000000000000000",)
        ).fetchone()
        assert row["event_type"] == "system_init", "Walk skeleton: DB write/read failed"
    click.echo("flow.db initialized and verified (encrypted, Walking Skeleton passed)")
```

### DDL: All tables for Phase 1

```sql
-- src/flow/store/schema.py -> SQL executed by init_schema()
-- [VERIFIED against ARCHITECTURE.md pattern + empirically tested DDL]

CREATE TABLE IF NOT EXISTS raw_garmin (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    stream       TEXT NOT NULL,        -- 'hrv'|'sleep'|'body_battery'|'training_readiness'|'stress'|'activities'|'resting_hr'
    metric_date  TEXT NOT NULL,        -- ISO date: '2026-06-13'
    pulled_at    TEXT NOT NULL,        -- UTC ISO datetime of fetch
    payload      TEXT NOT NULL,        -- raw vendor JSON, untouched
    payload_hash TEXT NOT NULL,        -- sha256(payload) for idempotency
    UNIQUE (stream, metric_date, payload_hash)   -- re-pull: identical payload = no-op
);

CREATE TABLE IF NOT EXISTS events (
    event_id       TEXT PRIMARY KEY,             -- ULID (26 chars, sortable)
    event_type     TEXT NOT NULL,                -- 'sauna'|'perceived_readiness'|'disagreement'|...
    occurred_on    TEXT NOT NULL,                -- local date the event belongs to
    recorded_at    TEXT NOT NULL,                -- UTC ISO datetime of logging
    schema_version INTEGER NOT NULL DEFAULT 1,  -- per-event-type payload schema version
    payload        TEXT NOT NULL,               -- JSON: validated by pydantic at write time
    supersedes     TEXT NULL REFERENCES events(event_id)  -- NULL unless correcting a prior event
);

-- Derived table stubs: defined now, populated by Phase 2 recompute
CREATE TABLE IF NOT EXISTS daily_facts (
    metric        TEXT NOT NULL,    -- 'hrv_rmssd_ms'|'sleep_minutes'|...
    fact_date     TEXT NOT NULL,
    value         REAL,             -- NULL = missing, never imputed
    source        TEXT NOT NULL,    -- 'garmin_hrv'|'manual_sauna'|...
    formula_input INTEGER NOT NULL DEFAULT 1,  -- 1=include in baseline, 0=excluded (sick/travel)
    PRIMARY KEY (metric, fact_date)
);

CREATE TABLE IF NOT EXISTS baselines (
    metric        TEXT NOT NULL,
    as_of_date    TEXT NOT NULL,
    window_days   INTEGER NOT NULL DEFAULT 21,
    n_valid_days  INTEGER NOT NULL,
    mean          REAL,
    sd            REAL,
    valid         INTEGER NOT NULL,     -- n_valid_days >= min from config
    PRIMARY KEY (metric, as_of_date)
);

CREATE TABLE IF NOT EXISTS readiness_scores (
    score_date      TEXT PRIMARY KEY,
    score           TEXT NOT NULL,          -- 'green'|'amber'|'red'
    emphasis        TEXT NOT NULL,          -- forced-choice emphasis string
    formula_version TEXT NOT NULL,          -- e.g. 'v1'
    inputs_json     TEXT NOT NULL,          -- per-input value + freshness
    computed_at     TEXT NOT NULL
);

-- Budget tracking: LLM token usage persisted across process restarts
CREATE TABLE IF NOT EXISTS budget_usage (
    period        TEXT NOT NULL,    -- 'monthly:2026-06' for monthly caps
    budget_name   TEXT NOT NULL,    -- 'llm_tokens'|'garmin_syncs'
    used          REAL NOT NULL DEFAULT 0,
    updated_at    TEXT NOT NULL,
    PRIMARY KEY (period, budget_name)
);
```

### ULID usage

```python
# [VERIFIED: python-ulid 3.1.0, tested 2026-06-13]
from ulid import ULID

def new_event_id() -> str:
    """Generate a new ULID as a 26-char sortable text string for event_id."""
    return str(ULID())

# In event insert:
event_id = new_event_id()   # e.g. '01KV0STJZSZ93MVSKPNA902670'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pysqlcipher3` (rigglemania) | `sqlcipher3` / `sqlcipher3-wheels` (coleifer) | ~2022 | Old package unmaintained; use coleifer's maintained binding |
| `garth` for Garmin auth | `garminconnect` 0.3.x with curl_cffi | 2025 | Garmin SSO change broke garth; garminconnect replaced the dependency |
| APScheduler 4.0.0aX (pre-release) | APScheduler 3.11.x or systemd timers | Ongoing | 4.x pre-release not production-ready per maintainer; systemd preferred |
| SQLCipher 3.x defaults (AES-128, SHA1 HMAC) | SQLCipher 4.x defaults (AES-256-CBC, PBKDF2-SHA512) | SQLCipher 4.0 (2018) | Security upgrade; 4.x defaults are the right choice; do not use `PRAGMA cipher_compatibility = 3` |

**Deprecated / outdated:**
- `pysqlcipher3` (rigglemania PyPI): unmaintained, do not use
- `garth`: marked DEPRECATED on GitHub; broken for new logins
- SQLCipher 3.x: use 4.x defaults

---

## Runtime State Inventory

> This is a greenfield phase — no existing codebase data flows to migrate. The inventory below confirms no runtime state exists that would complicate the build.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no DB files exist yet (`data/` directory not present) | Create `data/` with `chmod 700` as part of `flow init` |
| Live service config | None — no scheduled jobs, no external services configured | None |
| OS-registered state | None — no systemd units registered yet | None |
| Secrets/env vars | None — no `.env` file, no `FLOW_*` vars set | Create `.env.example` template; document `FLOW_DB_KEY`, `FLOW_PRIVATE_DB_KEY` |
| Build artifacts | None — no `pyproject.toml`, no `src/`, no `*.egg-info/` | Created fresh by `uv init --app --package --python 3.12` |

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 |
| Config file | `pyproject.toml` `[tool.pytest.ini_options]` (Wave 0 — does not exist yet) |
| Quick run command | `uv run pytest tests/ -x -q` |
| Full suite command | `uv run pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRIV-01 | Encrypted DB: hex of `flow.db` contains no plaintext after write | unit | `uv run pytest tests/test_store.py::test_encryption_ciphertext -x` | ❌ Wave 0 |
| PRIV-01 | Wrong key raises `DatabaseError` | unit | `uv run pytest tests/test_store.py::test_wrong_key_rejected -x` | ❌ Wave 0 |
| PRIV-02 | `private.db` cannot be opened with main-DB key | unit | `uv run pytest tests/test_store.py::test_namespace_isolation -x` | ❌ Wave 0 |
| PRIV-04 | `FlowSettings` with no env var raises validation error for DB key | unit | `uv run pytest tests/test_config.py::test_db_key_not_in_yaml -x` | ❌ Wave 0 |
| DATA-01 | HRV schema rejects invalid `rmssd_ms < 0` | unit | `uv run pytest tests/test_schemas.py::test_hrv_negative_rmssd -x` | ❌ Wave 0 |
| DATA-01 | All 7 schemas accept fully-None payload (missing-data honesty) | unit | `uv run pytest tests/test_schemas.py::test_all_schemas_accept_missing -x` | ❌ Wave 0 |
| DATA-01 | `events` table accepts insert with ULID primary key | unit | `uv run pytest tests/test_store.py::test_event_insert_ulid -x` | ❌ Wave 0 |
| DATA-02 | ADR files exist in `docs/adr/` | smoke | `uv run pytest tests/test_adr.py::test_adr_files_exist -x` | ❌ Wave 0 |
| OPS-02 | `BudgetGuard.check` raises `BudgetError` at 100% | unit | `uv run pytest tests/test_config.py::test_budget_guard_hard_block -x` | ❌ Wave 0 |
| OPS-02 | `BudgetGuard.check` calls notify at 80% | unit | `uv run pytest tests/test_config.py::test_budget_guard_warn -x` | ❌ Wave 0 |
| Walking Skeleton | `flow init` writes and reads back from encrypted DB | integration | `uv run pytest tests/test_store.py::test_walking_skeleton -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `uv run pytest tests/ -x -q` (fast, fail-fast)
- **Per wave merge:** `uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `pyproject.toml` — `[tool.pytest.ini_options]`, `[tool.ruff]` config
- [ ] `tests/__init__.py`
- [ ] `tests/conftest.py` — `tmp_db_factory` fixture (creates temp-dir DBs with test keys)
- [ ] `tests/test_store.py` — encryption, wrong key, namespace isolation, Walking Skeleton
- [ ] `tests/test_schemas.py` — all 7 Garmin schemas + event schema
- [ ] `tests/test_config.py` — BudgetGuard, FlowSettings loading
- [ ] `tests/test_adr.py` — smoke: ADR files present
- [ ] Framework install: `uv add --dev pytest ruff` (pyproject.toml must exist first)

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in `.planning/config.json`.

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user login in this phase; DB key is a secret, not a user auth credential |
| V3 Session Management | No | No sessions in this phase |
| V4 Access Control | Partial | File-system permissions (`chmod 700 data/`, `chmod 600 *.db`) serve as access control; no multi-user access patterns |
| V5 Input Validation | Yes | `pydantic` models validate all stream payloads at write time; `field_validator` for domain constraints (positive HRV, etc.) |
| V6 Cryptography | Yes | SQLCipher AES-256-CBC; key via env only; PBKDF2-HMAC-SHA512 KDF; 256000 iterations default (above ASVS recommendation of 100k+) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DB key in source or config | Information Disclosure | `pydantic-settings` env-only for DB key; `.gitignore` covers `.env`; CI secret scan |
| DB file copied without key | Information Disclosure | SQLCipher full-DB encryption including WAL/journal; `chmod 600` on files |
| `private.db` leaked via export | Information Disclosure | Separate factory; no glob over `data/*.db`; export code holds only main factory reference |
| Schema injection via JSON payload | Tampering | Pydantic validates and coerces payloads before storage; parameterized queries for all DB writes |
| Token directory world-readable | Information Disclosure | `data/` created with `chmod 700`; token subdir inherits; explicit `chmod 600` on token files (Phase 2) |
| Missing `.gitignore` for DB files | Information Disclosure | `.gitignore` must cover: `data/`, `.env`, `*.db`, `*.db-wal`, `*.db-shm` |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | Project target | ✓ (via uv) | 3.12.3 (at `/usr/bin/python3.12`; `uv` downloads 3.12.11 if needed) | Use 3.11 with note; 3.12 strongly preferred |
| `sqlcipher3-wheels` | PRIV-01 | ✓ | 0.5.7 (Linux x86_64 manylinux; verified Python 3.11 and 3.12 via uv) | `sqlcipher3` + `libsqlcipher-dev` OS package; macOS arm64 wheel availability [ASSUMED] |
| `uv` | Scaffold, dep management | ✓ | 0.8.17 | `pip` + `venv`; loses `uv.lock` reproducibility |
| `systemd` | Phase 2+ (scheduled jobs) | ✓ | 255 | cron (inferior; documented fallback) |
| `python-ulid` | ULID event IDs | ✓ | 3.1.0 | `uuid4()` as TEXT (stdlib; loses time-sortability) |
| `pydantic-settings[yaml]` | config.yaml loading | ✓ | 2.14.1 + PyYAML 6.0.1 | stdlib `yaml.safe_load` + `os.environ` (less type-safe) |

**Missing dependencies with no fallback:** none — all required tools are present.

**Missing dependencies with fallback:**
- macOS arm64 wheel for `sqlcipher3-wheels`: not tested in this sandbox (Linux only). If wheels fail, use `sqlcipher3` + `brew install sqlcipher`. [ASSUMED — see Assumptions Log A1]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sqlcipher3-wheels` has a wheel for macOS arm64 | Environment Availability | If the operator's deploy target is macOS arm64 and no wheel exists, must use `sqlcipher3` + system libsqlcipher or build from source. Low risk: deploy target is stated as "home box / NAS / Raspberry Pi" (Linux) in project research. |
| A2 | `pydantic-settings` `settings_customise_sources` override applies cleanly in 2.14.1 | Architecture Patterns (Pattern 4) | If the override API changed in 2.14.x, config loading may not work. Mitigated: tested `YamlConfigSettingsSource` directly in sandbox and it works. The `settings_customise_sources` signature may require adjustment — add a task to verify at implementation time. |

**All other claims in this research were empirically verified in this session or cited from project-level HIGH-confidence research (STACK.md, ARCHITECTURE.md, PITFALLS.md).**

---

## Open Questions (RESOLVED)

> All three have resolution paths captured in the Phase 1 plans: OQ1 → Plan
> 01-04 Task 1 (settings_customise_sources fallback to SettingsConfigDict
> yaml_file); OQ2 → Plan 01-03 Task 3 (token dir = `data/tokens/` constant);
> OQ3 → Plan 01-04 Task 1 (config.yaml holds only Phase-1 budgets + model tier).

1. **`pydantic-settings` `settings_customise_sources` exact signature in 2.14.x**
   - What we know: `YamlConfigSettingsSource` works; the class exists and loads YAML correctly.
   - What's unclear: The `settings_customise_sources` classmethod signature changed between pydantic-settings versions. The Pattern 4 example may need `**kwargs` adjustment.
   - Recommendation: Add an early task to implement and test `FlowSettings` end-to-end before other tasks depend on it. If the override is problematic, fall back to `BaseSettings` with `model_config = SettingsConfigDict(yaml_file="config.yaml")` which is simpler but loses source priority control.

2. **Garmin token directory location**
   - What we know: CONTEXT.md says tokens persist "outside the repo in an app-owned data dir." `garminconnect` supports `Garmin(..., tokenstore=PATH)` parameter.
   - What's unclear: Whether to use `data/tokens/` (within the gitignored `data/` directory) or `~/.local/share/flow/tokens/` (XDG-compliant).
   - Recommendation: Use `data/tokens/` for Phase 1 simplicity (one data root, one gitignore rule); document the XDG alternative in the garmin-access ADR. Revisit if multiple users ever appear (Phase 5).

3. **`config.yaml` initial structure for Phase 1 budgets**
   - What we know: All budgets go in config; model tier never inline.
   - What's unclear: Whether the initial config should include Phase 2+ keys (ntfy topic, Garmin credentials path) or only Phase 1 keys.
   - Recommendation: Phase 1 config contains only Phase 1 keys; Phase 2 adds its keys in its plan. Avoids confusing empty stubs.

---

## Sources

### Primary (HIGH confidence — empirically verified in this session)

- `sqlcipher3-wheels` 0.5.7 on PyPI — installed and tested Python 3.11 + Python 3.12 (via uv) on Linux x86_64. Verified: PRAGMA key first, AES-256 full-DB ciphertext, wrong-key rejection, WAL mode. [VERIFIED: PyPI + sandbox test 2026-06-13]
- `pydantic` 2.13.4 — `Optional[T] = None` missing-data honesty, `Literal[N]` versioning, `field_validator` domain constraints verified. [VERIFIED: PyPI + sandbox test 2026-06-13]
- `pydantic-settings` 2.14.1 — `YamlConfigSettingsSource` working; env prefix override; FLOW_DB_KEY isolation from config.yaml. [VERIFIED: PyPI + sandbox test 2026-06-13]
- `python-ulid` 3.1.0 — `ULID()` generating 26-char sortable IDs; `.datetime`, `.from_str()` API. [VERIFIED: PyPI + sandbox test 2026-06-13]
- `uv` 0.8.17 — `uv init --app --package --python 3.12` creates src-layout; `uv add` installs to project venv. [VERIFIED: installed, tested 2026-06-13]
- Namespace isolation — two DB files with separate keys; wrong key on private.db raises `DatabaseError`. [VERIFIED: sandbox test 2026-06-13]
- BudgetGuard pattern — warn/block at 80%/100% verified in plain Python. [VERIFIED: sandbox test 2026-06-13]

### Secondary (HIGH confidence — project-level research)

- `.planning/research/STACK.md` — full library rationale; `sqlcipher3-wheels` MEDIUM confidence flag (now RESOLVED for Linux x86_64). [Cited: 2026-06-10]
- `.planning/research/ARCHITECTURE.md` — DDL schemas, data flow, connection factory pattern, namespace isolation rationale. [Cited: 2026-06-10]
- `.planning/research/PITFALLS.md` — encryption pitfalls, column-flag anti-pattern, key-in-repo risk. [Cited: 2026-06-10]
- `docs/framework-alignment.md` — 13 codified learnings; architecture gates; Phase 1 checklist. [Cited: binding commitments]

### Tertiary (MEDIUM confidence — ASSUMED)

- macOS arm64 wheel availability for `sqlcipher3-wheels`: not tested; tagged [ASSUMED]. See Assumptions Log A1.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified on PyPI and tested in sandbox
- Architecture: HIGH — patterns directly tested; DDL from ARCHITECTURE.md (HIGH source)
- Pitfalls: HIGH — empirically verified (PRAGMA key order, namespace isolation tested); encryption pitfalls from PITFALLS.md (HIGH source)
- Package Legitimacy: HIGH — slopcheck 0.6.1 ran clean on all 7 packages

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable tech; pydantic-settings API changes are the main watch item)

**Empirical tests run in this session:**
1. SQLCipher encrypt + verify ciphertext + wrong-key rejection + reopen ✓
2. WAL mode with SQLCipher ✓
3. Namespace isolation (two DBs, two keys, cross-key rejection) ✓
4. Pydantic v2 Optional fields / missing-data honesty ✓
5. pydantic-settings + YamlConfigSettingsSource ✓
6. python-ulid 3.1.0 API ✓
7. BudgetGuard warn/hard-block ✓
8. sqlcipher3-wheels on Python 3.12 via uv ✓
9. slopcheck on all 7 packages ✓
