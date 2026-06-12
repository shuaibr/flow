LAST_COMPLETED: Phase 0 — data contract + privacy ADRs. config.yaml (schemas,
formula v1, budgets), ADRs 0001–0004 in docs/adr/, docs/ecosystem-map.md,
framework-alignment checklist updated. Baseline repo security + spec pack
integration done in prior commits on this branch.

CURRENT_STOPPOINT: Phase 1 not started. Next blocker is a human decision:
GSD install (npx get-shit-done-cc) deliberately not run by agent — operator
runs it, or explicitly authorizes. Secrets rotation (Atlas password, JWT
SECRET → Render env) still pending, operator-only.

NEXT_3_STEPS:
1. Operator: rotate Atlas/JWT secrets; set env vars in Render.
2. Operator: install GSD (or authorize agent), run /gsd-plan-phase with
   SPEC.md + PRINCIPLES.md + OPERATIONS.md + docs/framework-alignment.md.
3. Phase 1 build: src/adapters/garmin.py + manual_log + readiness function
   against the 21-payload golden set (see ADR 0004 open question: CLI-first
   vs reuse frontend shell for the 6-tap log).

OPEN_QUESTION: does the readiness formula need activity *type* awareness
(Hyrox vs yoga load profiles) in v1, or is aggregate training load enough
until the disagreement log says otherwise?
