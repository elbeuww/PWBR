---
phase: 02-vitrine-publique-trilingue-gate-l-gal
plan: 02
subsystem: legal-compliance
tags: [i18n, rtl, legal-gate, disclaimer, footer, rsc, server-only]
requires:
  - "Plan 02-01 : shell [locale]/layout.tsx (slot Footer), tokens marque (bg-surface/text-muted/ring-accent), namespace theme, @/* alias"
  - "Socle P1 : next-intl 4.13, i18n/navigation (Link localisé), lint:i18n, vitest racine (alias server-only no-op), gate.ts (analog server-only)"
provides:
  - "Composant <Disclaimer> RSC transverse (D-13, source unique réutilisée P3/P6)"
  - "<Footer> global rendu sur toutes les pages (nav légale localisée + Disclaimer)"
  - "Pages légales placeholder sécurisées par allowlist (legal/[doc], D-14/D-15)"
  - "Gate légal non-code : isLegalReviewDone() server-only (lu par P4) + artefact LEGAL-REVIEW.md"
  - "Namespaces messages disclaimer/legal à parité fr/en/ar"
affects:
  - "Phase 4 (encaissement) consommera isLegalReviewDone() + le sign-off de LEGAL-REVIEW.md"
  - "Phase 3 (membre) et Phase 6 (Telegram) réutiliseront <Disclaimer>"
  - "Plan 02-03 (home/tarifs) héritera du Footer désormais présent dans le shell"
tech-stack:
  added: []
  patterns:
    - "Helper server-only à défaut sûr (=== 'true', jamais permissif) pour gate de revenu"
    - "Allowlist stricte + generateStaticParams + notFound() avant rendu sur segment dynamique"
    - "Composant disclaimer RSC unique (i18n-only) réutilisé transversalement"
key-files:
  created:
    - apps/web/src/lib/legal-gate.ts
    - apps/web/src/lib/__tests__/legal-gate.test.ts
    - apps/web/src/lib/__tests__/legal-artifact.test.ts
    - apps/web/src/components/Disclaimer.tsx
    - apps/web/src/components/Footer.tsx
    - "apps/web/src/app/[locale]/(marketing)/legal/[doc]/page.tsx"
    - apps/web/src/messages/__tests__/messages-parity-legal.test.ts
    - docs/legal/LEGAL-REVIEW.md
    - apps/web/.env.example
  modified:
    - "apps/web/src/app/[locale]/layout.tsx"
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
    - apps/web/src/messages/__tests__/theme-parity.test.ts
decisions:
  - "D-02-02-A : tests placés sous apps/web/**/__tests__/ (pas src/lib/*.test.ts ni apps/web/test/ comme l'écrivait le plan) — le glob vitest.config.ts racine n'inclut QUE packages/** et apps/**/__tests__/** ; web n'a pas de vitest local donc `pnpm --filter web exec vitest` est inopérant. Exécution via `npx vitest run` racine."
  - "D-02-02-B : gate vérifié via npx tsc racine/web ; baseline P1 (forbidden-service-import.ts) inchangée, seule erreur tsc tolérée."
  - "D-02-02-C : EN disclaimer = « No promise of gains » (pas « profit ») pour honorer le grep no-perf-claims (VITR-03) tout en restant fidèle au FR « Aucune promesse de gain »."
  - "D-02-02-D : LEGAL_REVIEW_DONE lu sans NEXT_PUBLIC_ → jamais bundlé côté client (server-only renforce). .env.example créé minimal (var gate uniquement) car absent."
metrics:
  duration: "~12 min"
  completed: 2026-06-14
  tasks: 3
  files: 14
---

# Phase 2 Plan 02 : Couche conformité transverse (Disclaimer, Footer, pages légales, gate LEGAL-02) Summary

Couche conformité de la vitrine posée sans rédiger de texte faisant foi : helper de gate légal server-only à défaut sûr (lu par la Phase 4 avant le 1ᵉʳ encaissement) + artefact checklist versionné, composant `<Disclaimer>` RSC réutilisable (D-13), 4 pages légales placeholder verrouillées par allowlist (404 sur paramètre arbitraire, D-14/D-15), et `<Footer>` global greffé dans le slot du shell P1 → disclaimer factuel présent sur toutes les pages dans les 3 langues.

## What Was Built

- **Task 1 (TDD, commit 68a9887)** : RED (tests legal-gate + legal-artifact échouent : module/artefact absents) → GREEN. `lib/legal-gate.ts` (`import 'server-only'`, `isLegalReviewDone()` = `process.env.LEGAL_REVIEW_DONE === 'true'`, défaut sûr). `docs/legal/LEGAL-REVIEW.md` (checklist crypto Algérie/MENA + sign-off, format RESEARCH §Gate verbatim). `apps/web/.env.example` créé (`LEGAL_REVIEW_DONE=false` documenté). 5 tests verts.
- **Task 2 (commit 2e01b62)** : `components/Disclaimer.tsx` (RSC, namespace `disclaimer`, `ps/pe` RTL-safe). `legal/[doc]/page.tsx` (allowlist `DOCS` + `generateStaticParams` + `notFound()` avant rendu, placeholder `reviewPending`, aucun HTML brut). Namespaces `disclaimer` + `legal` à parité fr/en/ar (titres + navLabels des 4 docs). Test parité récursif (clés + no-perf VITR-03). 7 tests verts.
- **Task 3 (commit 47dd740)** : `components/Footer.tsx` (RSC, nav légale localisée via `@/i18n/navigation` sur les 4 docs + `<Disclaimer />`, touch ≥44px, `focus-visible:ring-accent`, `bg-surface`). Slot du `[locale]/layout.tsx` remplacé par `<Footer />` (greffe chirurgicale). 12 tests verts au total.

## Verification

- `npx tsc -b --noEmit` (web) : vert hors baseline P1 (`forbidden-service-import.ts`, fixture ESLint AUTH-03 — D-01-03-BASELINE).
- `pnpm lint:i18n` : exit 0 (zéro chaîne en dur ; commentaires reformulés pour éviter faux positifs greps).
- Vitest racine (`npx vitest run apps/web`) : 4 fichiers / 12 tests GREEN (legal-gate 3, legal-artifact 2, messages-parity-legal 4, theme-parity 3 non régressé).
- Greps acceptance : `server-only`=1, `=== 'true'`=1, `Sign-off`≥1, `crypto Algérie`=1, `LEGAL_REVIEW_DONE=false`=1, Disclaimer `getTranslations`≥1 + `'use client'`=0, legal page `notFound`≥1/`generateStaticParams`=1/`dangerouslySetInnerHTML`=0/`setRequestLocale`≥1, Footer `Disclaimer`≥1/`i18n/navigation`≥1/4 slugs liés/`'use client'`=0, layout `Footer`≥1/comment slot supprimé/`hasLocale`≥1/`suppressHydrationWarning`=1/un seul `<html>`. Aucune classe physique RTL-cassante dans les nouveaux fichiers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Emplacement des tests incompatible avec le glob vitest**
- **Found during:** Task 1
- **Issue:** Le plan plaçait les tests en `apps/web/src/lib/*.test.ts` et `apps/web/test/` et lançait `pnpm --filter web exec vitest`. Or `vitest.config.ts` racine n'inclut que `packages/**` + `apps/**/__tests__/**`, et `apps/web` n'a pas de vitest local → tests non collectés / commande inopérante.
- **Fix:** Tests déplacés sous `apps/web/src/lib/__tests__/` et `apps/web/src/messages/__tests__/` (cohérent avec `theme-parity.test.ts` P1) ; exécution via `npx vitest run` racine.
- **Files:** legal-gate.test.ts, legal-artifact.test.ts, messages-parity-legal.test.ts
- **Commit:** 68a9887, 2e01b62

**2. [Rule 1 - Bug] Régression tsc dans theme-parity.test.ts induite par le namespace imbriqué `legal`**
- **Found during:** Task 2
- **Issue:** L'ajout du namespace `legal` (objets imbriqués `{doc}.title`) casse le cast `as Record<string, Record<string, string>>` de `theme-parity.test.ts` (P1), provoquant TS2352 — directement causé par mes modifications messages.
- **Fix:** Cast élargi `as unknown as Record<...>` (2 occurrences). Modification minimale, parité theme inchangée (3/3 toujours verts).
- **Files:** apps/web/src/messages/__tests__/theme-parity.test.ts
- **Commit:** 2e01b62

**3. [Rule 1 - Bug] Grep acceptance pollué par mentions en commentaire**
- **Found during:** Task 1 et Task 2
- **Issue:** `grep -c "server-only" legal-gate.ts` = 2 (import + commentaire) au lieu de 1 ; `grep -c dangerouslySetInnerHTML legal/[doc]/page.tsx` = 1 (commentaire) au lieu de 0.
- **Fix:** Reformulation des commentaires pour ne pas répéter le littéral (« import server-side-only », « aucun rendu HTML brut »). Sécurité inchangée.
- **Commit:** 68a9887, 2e01b62

**4. [Rule 1 - Bug] Comment JSDoc fermé prématurément par `*/`**
- **Found during:** Task 2
- **Issue:** `apps/**/__tests__/**` dans un commentaire JSDoc contient la séquence `*/` qui ferme le bloc → ReferenceError au parse du test parité.
- **Fix:** Reformulé le commentaire pour éviter `*/`.
- **Commit:** 2e01b62

### Scope notes
- Aucun paquet npm installé (toutes deps héritées de P1/02-01) — pas de checkpoint supply-chain requis (T-02-SC n/a).
- `isLegalReviewDone()` n'est appelé nulle part en P2 (aucun paiement) — livré prêt pour P4, conforme au plan.

## Authentication Gates

Aucun (pas d'auth touchée en P2).

## Known Stubs

- Pages légales = placeholder « ⚠️ Texte en cours de revue juridique. » (D-15 INTENTIONNEL). Le corps faisant foi sera livré par le juriste et débloqué via le sign-off de `docs/legal/LEGAL-REVIEW.md` (gate LEGAL-02, Phase 4). Ce n'est pas un stub à wirer côté code.

## Threat Flags

Aucune surface de sécurité hors `threat_model` du plan. Le segment `[doc]` est borné par allowlist (T-02-04 mitigé) ; le flag `LEGAL_REVIEW_DONE` est server-only à défaut sûr (T-02-05 mitigé) ; aucun HTML brut (T-02-07 mitigé) ; placeholder légal sans texte faisant foi (T-02-06 mitigé).

## Self-Check: PASSED

- Fichiers créés vérifiés présents : legal-gate.ts, legal-gate.test.ts, legal-artifact.test.ts, Disclaimer.tsx, Footer.tsx, legal/[doc]/page.tsx, messages-parity-legal.test.ts, docs/legal/LEGAL-REVIEW.md, apps/web/.env.example.
- Commits vérifiés présents : 68a9887 (Task 1 RED+GREEN), 2e01b62 (Task 2), 47dd740 (Task 3).
- Aucune suppression de fichier dans les commits.

## TDD Gate Compliance

Task 1 (`tdd="true"`) : RED prouvé (tests legal-gate import + artefact ENOENT échouent) avant implémentation, puis GREEN (5/5). RED et GREEN livrés dans un commit unique séquentiel (mode sequential single-writer) avec preuve RED capturée en exécution avant écriture du module. Refactor non nécessaire. Tasks 2 et 3 sont `type="auto"` non-TDD (composants UI + greffe), couverts par tests de parité et greps d'acceptance.
