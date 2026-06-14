---
status: partial
phase: 02-vitrine-publique-trilingue-gate-l-gal
source: [02-VERIFICATION.md]
started: 2026-06-14T00:00:00Z
updated: 2026-06-14T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Revue visuelle RTL arabe + bascule dark/light
expected: La mise en page est bien miroir en arabe (RTL), les prix ne s'inversent pas (balise `<bdi>` active), le toggle passe correctement du mode clair au mode sombre sans flash visible (no-FOUC). Vérifier sur dev server : `pnpm --filter web dev`, ouvrir `/ar`, `/fr`, `/en`, basculer le thème.
result: [pending]

### 2. Revue juridique externe et sign-off (LEGAL-02)
expected: Un juriste externe coche toutes les cases de `docs/legal/LEGAL-REVIEW.md` (statut crypto Algérie/MENA, périmètre éducatif/conseil non agréé, textes faisant foi FR+AR/EN) et appose sa signature datée. Ensuite `LEGAL_REVIEW_DONE=true` est posé en prod AVANT le 1er encaissement (Phase 4). Gate non-code : bloque P4, PAS la livraison P2.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
