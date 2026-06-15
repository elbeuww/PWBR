# Deferred Items — Phase 03

> Découvertes hors-scope durant l'exécution (SCOPE BOUNDARY : on ne corrige que ce
> que la tâche courante a causé). À traiter dans une passe dédiée.

## Lint pré-existant (hors fichiers du Plan 03-02)

`pnpm lint` retourne 18 erreurs + 8 warnings, TOUTES dans des fichiers hors du
périmètre 03-02 (signaux). Aucun fichier signaux n'a d'erreur/warning lint.

- `packages/data-sources/src/finnhub/schema.test.ts` : `NewsArticle` defined but never used.
- `packages/data-sources/src/finnhub/schema.ts:53` : `_category` defined but never used.
- `packages/data-sources/src/{finnhub,fred,oanda}/*.test.ts` + `packages/indicators/.../wrappers.test.ts` : unused eslint-disable directives (8 warnings).
- `scripts/check-i18n-hardcoded.mjs` : `no-undef` sur `URL`/`console`/`process` (config ESLint sans env node pour ce script `.mjs`).

Cause : configuration ESLint / dette pré-existante des packages cœur (Phases 1-2),
non liée à la surface signaux. Recommandation : passe lint dédiée + ajout d'un env
node pour les scripts `.mjs` dans la config ESLint.
