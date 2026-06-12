# ADR 0001 — Local-first SQLite, append-only raw store

- **Decision:** All durable state in `data/flow.db` (SQLite); raw Garmin pulls land append-only; derived signals recomputed, never hand-edited.
- **Context:** SPEC privacy-by-architecture constraint; single user; PRINCIPLES isolation layer requires idempotent recompute.
- **Encryption:** at rest via OS full-disk encryption now; SQLCipher revisited at Phase 4 hardening (5-line ADR then).
- **Alternatives rejected:** cloud DB (privacy, capacity), flat JSON files (no query path for baselines).
- **Consequence:** a bad sync day can never corrupt baselines; backup = copy one file; `data/` is gitignored.
