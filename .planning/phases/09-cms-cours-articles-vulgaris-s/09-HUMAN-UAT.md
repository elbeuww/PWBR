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

> **PRÉMISSE PÉRIMÉE (vérifié 2026-06-19) :** le chemin projet ne contient plus de `!`
> (déplacé de `Potatos WILL BECOME RICH !` → `NEXA`). `next build` traverse webpack
> sans erreur ; `next dev` (turbopack) boote et résout les `@app/*`. Pitfalls 1 & 2 levés.
> → La validation locale EST possible. MAIS le boot dev révèle un bug bloquant (ci-dessous).

## Tests

### 1. Déploiement preview + E2E réel
expected: Brancher l'URL preview → `PLAYWRIGHT_BASE_URL=<url> pnpm --filter web exec playwright test e2e/academie.spec.ts` → les tests passent (ou écarts documentés).
result: issue
reported: "Test local exécuté (premise '!' périmée). `next dev` boote mais crash routing : 'You cannot use different slug names for the same dynamic path (slug !== course)'. Routes Académie cassées — la phase 9 n'a jamais pu compiler. Vercel aurait échoué pareil."
severity: blocker

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
issues: 1
pending: 8
skipped: 0
blocked: 0

## Gaps

- truth: "Les routes Académie compilent et se servent (index, article, cours, leçon)"
  status: failed
  reason: "Conflit de segment dynamique Next.js : `academie/[slug]` et `academie/[course]/[lesson]` partagent la position `academie/<X>` avec des noms différents → 'You cannot use different slug names for the same dynamic path (slug !== course)'. Bloque TOUTES les routes du groupe (marketing). Indépendant de webpack/turbopack/`!` — Vercel échouerait pareil."
  severity: blocker
  test: 1
  root_cause: "apps/web/src/app/[locale]/(marketing)/academie/[course]/[lesson]/ utilise le nom de segment [course] alors que le détail article/cours utilise [slug] au même niveau."
  artifacts:
    - path: "apps/web/src/app/[locale]/(marketing)/academie/[course]/[lesson]/page.tsx"
      issue: "Segment [course] en conflit avec [slug] frère"
  missing:
    - "Renommer le dossier [course] -> [slug] (déplacer [lesson]/page.tsx)"
    - "Dans page.tsx leçon : renommer param course -> slug (destructuration, garde WR-01 meta.course !== slug, lessonNavigation, liens préc./suiv.)"
    - "Supprimer le dossier [course] vide"
  debug_session: ""
  status_fix: "RÉSOLU 2026-06-19 — [course]/[lesson] renommé en [slug]/[lesson], param course->slug. Dev `✓ Ready in 1044ms` sans erreur routing. Smoke local : 6 routes Académie = HTTP 200 ; rendu MDX (callouts, encadré trade, progression leçon, RTL dir=rtl + <bdi>, fallback D-14 = 200) vérifié par curl."
