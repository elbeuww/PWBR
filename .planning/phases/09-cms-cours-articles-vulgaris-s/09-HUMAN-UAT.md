---
status: partial
phase: 09-cms-cours-articles-vulgaris-s
source: [09-VERIFICATION.md, 09-05-SUMMARY.md]
started: 2026-06-19
updated: 2026-06-19
---

## Current Test

number: 1
name: Déploiement preview + E2E réel
expected: |
  Brancher l'URL preview Vercel → `PLAYWRIGHT_BASE_URL=<url> pnpm --filter web exec playwright test e2e/academie.spec.ts` → les tests passent (ou écarts documentés).
awaiting: user response

> Le rendu MDX réel (compileMDX, composants pédago, RTL arabe, fallback) n'est PAS
> vérifiable localement : le `!` du chemin projet casse `next build`/webpack et `dev`
> tourne en turbopack (Pitfall 2). La seule validation autoritaire est en **Vercel preview**.
> Pré-requis : pousser la branche puis récupérer l'URL de preview.

## Tests

### 1. Déploiement preview + E2E réel
expected: Brancher l'URL preview → `PLAYWRIGHT_BASE_URL=<url> pnpm --filter web exec playwright test e2e/academie.spec.ts` → les tests passent (ou écarts documentés).
result: [pending]

### 2. Index trilingue
expected: `/fr/academie`, `/en/academie`, `/ar/academie` listent articles + cours ; filtres thème/niveau/plateforme fonctionnels ; entrée nav « Académie » présente.
result: [pending]

### 3. Lecture article
expected: `ratio-risque-rendement` rend callouts (⚠/💡), étapes numérotées, encadré « exemple de trade » ; disclaimer en pied.
result: [pending]

### 4. Lecture leçon
expected: `prendre-en-main-mt5/01-installer-mt5` rend la nav préc./suiv. + progression « Leçon X sur Y » ; disclaimer en pied.
result: [pending]

### 5. RTL arabe
expected: `/ar/academie/<slug>` → mise en page `dir=rtl` ; prix / R:R / nombres restent LTR (`<bdi>`), non inversés.
result: [pending]

### 6. Fallback D-14
expected: `/ar/academie/comprendre-le-levier` (locale ar manquante) → version FR + bandeau « traduction à venir » ; JAMAIS 404.
result: [pending]

### 7. Funnel D-08
expected: nav permanente « Académie » + bloc « Apprenez les bases » (home) + lien « Comment exécuter ce signal ? » (détail signal) → tous mènent à `/academie` en conservant la locale.
result: [pending]

### 8. Disclaimer 100 % (LEGAL-01)
expected: disclaimer présent sur 100 % des articles ET leçons ; aucun crash 500.
result: [pending]

### 9. Robustesse frontière
expected: un fichier MDX au frontmatter invalide est exclu de l'index sans 500 (CR-01) ; une leçon n'est servie que sous son propre cours (WR-01, sinon 404).
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
