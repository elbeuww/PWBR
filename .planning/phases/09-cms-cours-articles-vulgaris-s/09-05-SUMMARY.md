---
phase: 09-cms-cours-articles-vulgaris-s
plan: 05
subsystem: web-academie-funnel
tags: [funnel, i18n, e2e, mdx, academie, D-08]
requires:
  - "09-04 (routes Académie RSC + namespace academy + sitemap hreflang)"
provides:
  - "Académie atteignable depuis le funnel produit (nav vitrine + home + détail signal) — D-08a/b/c"
  - "E2E Playwright Académie authoré (index trilingue, article+disclaimer, leçon, RTL ar, fallback D-14)"
affects:
  - "apps/web/src/app/[locale]/layout.tsx (entrée nav Académie)"
  - "apps/web/src/app/[locale]/(marketing)/page.tsx (bloc « Apprenez les bases »)"
  - "apps/web/src/components/signals/SignalDetail.tsx (lien contextuel funnel)"
tech-stack:
  added: []
  patterns:
    - "Liens funnel via @/i18n/navigation Link (préservent la locale, localePrefix always)"
    - "Libellés via namespace academy (navAcademy / learnBasicsCta / signalExecLink) — consommés, jamais redéclarés"
    - "E2E base URL paramétrable par env (PLAYWRIGHT_BASE_URL) pour exécution en Vercel preview"
key-files:
  created:
    - "apps/web/e2e/academie.spec.ts"
  modified:
    - "apps/web/src/app/[locale]/layout.tsx"
    - "apps/web/src/app/[locale]/(marketing)/page.tsx"
    - "apps/web/src/components/signals/SignalDetail.tsx"
    - "apps/web/src/components/signals/__tests__/SignalDetail.test.tsx"
decisions:
  - "D-09-05-A : liens funnel exclusivement via @/i18n/navigation Link (zéro next/navigation Link) — préservent la locale active"
  - "D-09-05-B : layout.tsx modification CHIRURGICALE — seule l'entrée nav ajoutée, <html lang dir>/providers/fonts INCHANGÉS (Pitfall 7)"
  - "D-09-05-C : E2E authoré + parseable, EXÉCUTION GREEN = Vercel preview (jamais de GREEN local fabriqué, précédent D-01-04-C)"
  - "D-09-05-DEFER : Task 3 (vérif rendu MDX en preview) DÉFÉRÉE en UAT tracké (décision utilisateur) — next build local non-viable (chemin `!` casse webpack, Pitfall 2)"
metrics:
  duration: "~15min (Task 1+2) + finalisation"
  tasks_completed: "2/3 (Task 3 déférée UAT)"
  files: 5
  completed: 2026-06-19
---

# Phase 9 Plan 05 : Câblage funnel Académie (D-08) + E2E Summary

Câblage de l'Académie dans le funnel produit (nav vitrine permanente, bloc « Apprenez les bases » sur la home, lien contextuel « Comment exécuter ce signal ? » sur le détail signal) avec liens i18n localisés, plus l'E2E Playwright Académie authoré et prêt à exécuter en Vercel preview. La vérification du rendu MDX réel est déférée en UAT preview (non validable en build local).

## Wave 4 (FINAL) — Plan de clôture de la Phase 09

Ce plan ferme la Phase 09 (CMS cours & articles vulgarisés) côté code. Il rend l'Académie atteignable depuis le produit (D-08) et établit le filet E2E. La validation autoritaire du RENDU MDX (composants pédago, prose, RTL arabe, disclaimer, fallback) ne se fait qu'en Vercel preview — elle est tracée comme UAT déférée (voir section dédiée).

## Tâches réalisées

| Task | Nom | Commit | Statut |
| ---- | --- | ------ | ------ |
| 1 | Liens funnel D-08 (nav + home + détail signal) | f9e0ead | complète |
| 2 | E2E Playwright `academie.spec.ts` | 5f301e5 | complète (exécution en preview) |
| 3 | Vérification rendu MDX en Vercel preview | — | **DÉFÉRÉE → UAT tracké** (décision utilisateur) |

### Task 1 — Liens funnel D-08 (commit f9e0ead)

- `layout.tsx` (D-08c) : entrée nav permanente « Académie » via `@/i18n/navigation` `Link` → `/academie`, libellé `academy.navAcademy`. Modification chirurgicale — `<html lang dir>`, providers, fonts INCHANGÉS (Pitfall 7).
- `(marketing)/page.tsx` (D-08a) : bloc « Apprenez les bases » avec lien `academy.learnBasicsCta` → `/academie` (Link localisé).
- `SignalDetail.tsx` (D-08b) : lien contextuel `academy.signalExecLink` (« Comment exécuter ce signal ? ») → cours plateforme `/academie/prendre-en-main-mt5` (Link localisé).
- Tous les libellés i18n (namespace `academy` posé en Plan 04), propriétés logiques. `lint:i18n` exit 0.

### Task 2 — E2E Playwright Académie (commit 5f301e5)

`apps/web/e2e/academie.spec.ts` couvre les 5 cas du plan (base URL paramétrable `PLAYWRIGHT_BASE_URL` pour preview) :
1. `/{fr,en,ar}/academie` — index charge, nav Académie présente, ≥1 carte.
2. Article (`ratio-risque-rendement`) — titre, corps prose, disclaimer en pied (LEGAL-01), variante EN.
3. Leçon du cours `prendre-en-main-mt5` — nav préc./suiv., progression, disclaimer.
4. `/ar/academie/<slug>` — `<html dir="rtl" lang="ar">` (RTL arabe, I18N-02).
5. Fallback D-14 — `/ar/academie/comprendre-le-levier` (ar manquant) → version FR + bandeau, pas de 404.

`playwright test e2e/academie.spec.ts --list` parse sans erreur. **Aucun GREEN local fabriqué** (précédent D-01-04-C) — exécution réelle = Vercel preview.

## Known Stubs / Deferred Verification

### Vérification du rendu MDX en Vercel preview — DÉFÉRÉE (décision utilisateur, UAT tracké)

**Statut : PENDING preview verification.** Le code funnel + l'E2E sont complets et committés. La validation autoritaire du rendu MDX ne peut PAS tourner en local : `next build` casse sur le chemin `!` (webpack, RESEARCH Pitfall 2) et `dev` tourne en turbopack. Décision utilisateur : déférer en UAT preview tracké plutôt que bloquer la clôture de phase.

Checklist UAT preview (9 points — à exécuter contre une URL Vercel preview, NON validés à ce jour) :

- [ ] **UAT-1** — Déclencher un déploiement Vercel preview (push branche), récupérer l'URL de preview.
- [ ] **UAT-2** — `PLAYWRIGHT_BASE_URL=<preview>` + `pnpm --filter web exec playwright test e2e/academie.spec.ts` → E2E vert contre la preview (ou écarts documentés).
- [ ] **UAT-3** — `/fr/academie`, `/en/academie`, `/ar/academie` : l'index liste articles + cours ; filtres thème/niveau/plateforme fonctionnent.
- [ ] **UAT-4** — Article : callouts (⚠/💡), étapes numérotées, encadré « exemple de trade » (valeurs non inversées en arabe grâce à `<bdi>`), disclaimer en pied.
- [ ] **UAT-5** — Leçon du cours MT5 : nav préc./suiv., progression « Leçon X sur Y », disclaimer.
- [ ] **UAT-6** — `/ar/academie/<slug>` : bascule RTL (`dir=rtl`) ; prix/R:R restent LTR.
- [ ] **UAT-7** — Fallback D-14 : `/ar/academie/comprendre-le-levier` (ar manquant) → version FR + bandeau « traduction à venir », jamais 404.
- [ ] **UAT-8** — Aucun crash 500 sur les routes Académie en preview.
- [ ] **UAT-9** — Disclaimer présent sur 100% des articles ET leçons ouverts (LEGAL-01).

Référence : `09-VALIDATION.md` §Manual-Only Verifications (rendu MDX + bascule RTL). Les threats T-09-LEGAL, T-09-PATH (confirmation runtime) restent à confirmer dans cette passe UAT.

## Deviations from Plan

### Auto-fixed Issues

Aucune déviation Rule 1/2/3 sur les fichiers du plan.

### Hors scope (deferred-items)

**1. [Hors scope] 3 erreurs tsc pré-existantes Phase 07**
- **Trouvé pendant :** re-confirmation des gates avant SUMMARY.
- **Issue :** `tsc -b --force` rapporte 3 erreurs (hors baseline `forbidden-service-import`) dans des fichiers Phase 07/admin NON touchés par 09-05 :
  - `src/app/[locale]/affiliation/ApplicationForm.tsx(178)` TS2322
  - `src/app/[locale]/affiliation/dashboard/page.tsx(68)` TS2345 (ReadonlyRequestCookies)
  - `src/lib/admin/jobs.test.ts(60)` TS2532
- **Décision :** hors scope (SCOPE BOUNDARY) — aucun fichier 09-05 concerné (`git diff a1890ed..HEAD` → 0 overlap). Non corrigées dans ce plan, tracées pour suivi Phase 07.
- **Scope académie 09-05 : 0 erreur.**

## Verification

| Gate | Commande | Résultat |
| ---- | -------- | -------- |
| tsc (scope académie) | `tsc -b --force` (hors baseline) | 0 erreur sur les fichiers 09-05 (3 erreurs Phase 07 hors scope) |
| i18n | `pnpm lint:i18n` | exit 0 — aucune chaîne en dur |
| unit | `npx vitest run academie SignalDetail` | 63/63 passed (7 fichiers) |
| E2E parse | `playwright test e2e/academie.spec.ts --list` | parse OK (5 cas listés) |
| E2E exécution | Vercel preview | **DÉFÉRÉE → UAT** (PENDING, voir Known Stubs) |

## Self-Check: PASSED
