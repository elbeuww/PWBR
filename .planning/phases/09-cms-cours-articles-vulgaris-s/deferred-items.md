# Deferred Items — Phase 09

Pré-existant, hors périmètre du plan 09-02 (non causé par mes changements).

## Erreurs `tsc --noEmit` pré-existantes (exactOptionalPropertyTypes)

Détectées en lançant `tsc` lors du plan 09-02, mais antérieures et hors des fichiers du plan :

- `src/lib/academie/toc.ts(35,19)` et `(36,18)` — TS2532 Object is possibly 'undefined' (module Wave 1, plan 09-01).
- `src/lib/admin/jobs.test.ts(60,12)` — TS2532 Object is possibly 'undefined' (hors Académie).

Action : non corrigées (scope boundary). À traiter dans un plan de durcissement TS dédié si besoin. Les tests Vitest restent verts (tsc strict ≠ gate local du plan, cf. 09-VALIDATION : `next build`/tsc local non-viable, gate = Vitest ciblé).
