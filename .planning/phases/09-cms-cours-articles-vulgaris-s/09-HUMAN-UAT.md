---
status: complete
phase: 09-cms-cours-articles-vulgaris-s
source: [09-VERIFICATION.md, 09-05-SUMMARY.md]
started: 2026-06-19
updated: 2026-06-20
---

## Current Test

[testing complete]

> **VALIDATION LOCALE OK (2026-06-20) :** dev sur webpack (`next dev`, plus `--turbopack` —
> Turbopack ne résout pas `.js→.ts` de `@app/core`, fix commit c1a014d). Deux blockers de
> compilation levés (segment `[course]`→`[slug]` 44203a4 ; dev webpack c1a014d). Home + 8
> routes Académie = 200. Covers manquants générés (0cab267) + arabe 02/03 + levier ajoutés.

## Tests

### 1. Déploiement preview + E2E réel
expected: Les routes Académie compilent et se servent ; E2E passe (ou écarts documentés).
result: pass
note: "Serving vérifié en local (2026-06-20) : home + 8 routes Académie (fr/en/ar, article, cours, leçon, RTL, fallback) = HTTP 200 ; gardes 404 OK (WR-01, slug inexistant). Deux blockers de compilation corrigés : (a) conflit segment [course]/[slug] → rename (44203a4) ; (b) dev Turbopack ne résolvait pas .js→.ts de @app/core → dev sur webpack (c1a014d). Playwright E2E non encore relancé — serving prouvé par curl."

### 2. Index trilingue
expected: `/fr/academie`, `/en/academie`, `/ar/academie` listent articles + cours ; filtres thème/niveau/plateforme fonctionnels ; entrée nav « Académie » présente.
result: pass

### 3. Lecture article
expected: `ratio-risque-rendement` rend callouts (⚠/💡), étapes numérotées, encadré « exemple de trade » ; disclaimer en pied.
result: pass

### 4. Lecture leçon
expected: `prendre-en-main-mt5/01-installer-mt5` rend la nav préc./suiv. + progression « Leçon X sur Y » ; disclaimer en pied.
result: pass

### 5. RTL arabe
expected: `/ar/academie/<slug>` → mise en page `dir=rtl` ; prix / R:R / nombres restent LTR (`<bdi>`), non inversés.
result: pass
reported: "Utilisateur : les articles switchent en arabe et changent de côté (RTL OK). Exception signalée : le cours MT5 restait en français → CORRIGÉ (les leçons 02/03 + l'article levier n'avaient pas de .ar.mdx ; ajoutés, commit 0cab267). /ar/.../prendre-en-main-mt5 est désormais 100% arabe."

### 6. Fallback D-14
expected: une locale manquante sert le FR + bandeau « traduction à venir » ; JAMAIS 404.
result: pass
note: "Slug-exemple initial `comprendre-le-levier` désormais traduit en arabe → testé via `/en/academie/prendre-en-main-mt5/03-poser-tp-sl` (03 n'a que fr+ar → fallback FR + bandeau, 200). Mécanisme D-14 inchangé (code + tests unitaires intacts)."

### 7. Funnel D-08
expected: nav permanente « Académie » + bloc « Apprenez les bases » (home) + lien « Comment exécuter ce signal ? » (détail signal) → tous mènent à `/academie` en conservant la locale.
result: pass

### 8. Disclaimer 100 % (LEGAL-01)
expected: disclaimer présent sur 100 % des articles ET leçons ; aucun crash 500.
result: pass

### 9. Robustesse frontière
expected: un fichier MDX au frontmatter invalide est exclu de l'index sans 500 (CR-01) ; une leçon n'est servie que sous son propre cours (WR-01, sinon 404).
result: pass
note: "WR-01 vérifié : /fr/academie/ratio-risque-rendement/01-installer-mt5 (leçon sous mauvais cours) = 404 ; slug inexistant = 404 (pas de 500). CR-01 (frontmatter invalide exclu) couvert par tests unitaires content.test.ts ; non rejoué manuellement."

## Summary

total: 9
passed: 9
issues: 0
pending: 0
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

- truth: "Le dev local sert toutes les pages (y compris celles qui importent @app/core)"
  status: failed
  reason: "`next dev --turbopack` plantait sur la home (TrackRecordBlock → @app/core) : « Module not found: Can't resolve './affiliate/tiers.js' » puis './track-record/threshold.js'. Turbopack (Next 15.5) ne réécrit pas .js→.ts pour les sous-imports internes d'un package workspace résolu via son exports map et n'expose pas d'extensionAlias. Build webpack OK (alias câblé) → bug masqué jusqu'au boot dev."
  severity: blocker
  test: 1
  root_cause: "Alias .js→.ts présent uniquement dans le callback webpack de next.config.ts, ignoré par Turbopack."
  status_fix: "RÉSOLU 2026-06-20 (commit c1a014d) — script dev = `next dev` (webpack, même résolveur que `next build`). `dev:turbo` conservé. Home + 8 routes = 200, log sans erreur."

- truth: "Les articles/leçons affichent leur image de couverture"
  status: failed
  reason: "Les 5 covers référencés en frontmatter (cover: /images/academie/*.png) étaient 404 : le dossier apps/web/public/images/academie/ n'existait pas. Articles sans illustration."
  severity: minor
  test: 3
  status_fix: "RÉSOLU 2026-06-20 (commit 0cab267) — 5 covers générés (fal-ai Sana 16:9, convertis en vrai PNG), servis OK par next/image (image/webp) et en statique (image/png)."

- truth: "Le cours MT5 s'affiche en arabe sous /ar"
  status: failed
  reason: "Utilisateur : le cours « installer MetaTrader » restait en français sous /ar. Cause : leçons 02-ouvrir-une-position, 03-poser-tp-sl et article comprendre-le-levier sans version .ar.mdx → fallback FR (moteur correct, manque de contenu)."
  severity: minor
  test: 5
  status_fix: "RÉSOLU 2026-06-20 (commit 0cab267) — versions .ar.mdx ajoutées pour les 3. /ar/.../prendre-en-main-mt5 = 100% arabe. NB : comprendre-le-levier n'est donc plus un cas de fallback pour le Test 6."
