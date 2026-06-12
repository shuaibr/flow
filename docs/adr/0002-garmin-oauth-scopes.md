# ADR 0002 — Garmin Connect: personal-use OAuth app, minimal scopes

- **Decision:** Personal-use OAuth app; request only Health + Activity read scopes; 1 scheduled sync/day plus manual on-demand; cache aggressively.
- **Context:** SPEC hard constraint 3 (Garmin developer terms; never resell derived data without re-reading terms at Phase 5).
- **Adapter:** all Garmin access through `src/adapters/garmin.py` — swapping providers (Open Wearables, Phase 4) touches one file.
- **Alternatives rejected:** unofficial scraping clients (terms risk), continuous webhook sync (capacity budget, no Phase 1 need).
- **Consequence:** tokens via env only; rate-limit respect enforced in the adapter, not callers.
