# ADR 0003 — Spiritual-practice namespace: separate DB file, consistency-only

- **Decision:** Phase 3 practice logs live in a separate SQLite file (`data/private.db`), schema defined only there; tracked as consistency markers, never scored, never joined into the readiness formula or any telemetry.
- **Context:** SPEC hard constraint 2 — extra-private by design and by default, excluded from any Phase 5 product path.
- **Enforcement:** signals code has no import path to the private store; exclusion is structural, not a config flag.
- **Alternatives rejected:** same DB with a `private` column (one bad query leaks it), encryption-only separation (still joinable).
- **Consequence:** export/delete for the private namespace is a file operation the operator controls directly.
