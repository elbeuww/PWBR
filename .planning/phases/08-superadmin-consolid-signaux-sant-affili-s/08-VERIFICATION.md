---
phase: 08-superadmin-consolid-signaux-sant-affili-s
verified: 2026-06-19T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Superadmin ouvre /admin — 3 cartes KPI s'affichent avec des comptes réels (membres actifs, file en attente, feu santé global)"
    expected: "Cartes liées vers /admin/membres, /admin/file, /admin/sante ; feu basé sur les données réelles jobs/candles/news/macro"
    why_human: "Requiert un serveur Next.js + connexion Supabase active pour confirmer que les head counts remontent des données et que le feu global est cohérent"
  - test: "Superadmin ouvre /admin/signaux — liste chronologique avec badges Telegram 2-états, filtres instrument et statut URL-synced"
    expected: "Colonne Telegram montre Posté (emerald) ou Non publié (muted) ; filtre par instrument peuple uniquement les instruments présents ; filtre statut filtre correctement ; chaque ligne clique vers /admin/signaux/[id]"
    why_human: "Requiert trade_setups et telegram_posts peuplés pour valider le badge, les filtres et la navigation détail"
  - test: "Superadmin ouvre /admin/signaux/[id] pour un setup EXPIRÉ ou INVALIDÉ"
    expected: "La page affiche le setup (instrument, direction, statut, score, entrée, SL, R:R, dates) sans erreur — prouvant l'absence de filtre status='active'"
    why_human: "Requiert un setup expiré/invalidé en base pour prouver la divergence intentionnelle vs la route membre"
  - test: "Superadmin ouvre /admin/sante — 3 feux de fraîcheur (candles/news/macro) + tableau des derniers job_runs"
    expected: "Feux vert/ambre/rouge cohérents avec l'âge réel des données ; tableau job_runs montre le dernier run par job avec statut et durée"
    why_human: "Requiert des données v_data_freshness, news, macro_series et job_runs peuplées pour valider les couleurs et la table"
  - test: "Superadmin ouvre /admin/affiliation/affilies — liste des affiliés avec filleuls et commissions dues/payées"
    expected: "Données agrégées depuis tables de base (affiliates/referrals/commissions) ; montants affichés en USDT via formatAtomic BigInt ; lien 'Gérer les payouts' navigue vers /admin/affiliation/payouts"
    why_human: "Requiert des données affiliés/commissions réelles pour valider l'agrégation et les montants"
  - test: "Depuis /admin/affiliation/affilies, cliquer 'Gérer les payouts' → page payouts existante : marquer une commission payée avec une référence tx, voir l'historique paid"
    expected: "La page payouts (non modifiée en Phase 8) continue de fonctionner : marquer paid via mark_commission_paid RPC, la ligne paid reste visible avec le lien TronScan"
    why_human: "Requiert un workflow payout réel (commission due existante) pour confirmer D-09/D-10 — la page est confirmée intacte par git diff mais la fonctionnalité end-to-end requiert validation manuelle"
  - test: "Lancer pnpm playwright test gating sur infra live — block ACCESS-03b (6 nouveaux tests) passe au vert"
    expected: "Chaque route (/admin/signaux, /admin/signaux/[id], /admin/sante) retourne 404 pour visiteur non-auth ET utilisateur authentifié non-superadmin — jamais 200/redirect/403"
    why_human: "Spec gating.spec.ts requiert next dev sur :3000 + Supabase env + 'Confirm email' désactivé (convention live-infra ; non exécutable en session statique)"
---

# Phase 8 : Superadmin consolidé (signaux, santé, affiliés) — Rapport de vérification

**Phase Goal:** Compléter le back-office superadmin avec la visibilité opérationnelle consolidée — shell/sidebar + dashboard KPI, vue Signaux publiés (liste + statut Telegram + filtres + détail), vue Santé (feux fraîcheur + job_runs), et pilotage payouts affiliés (liste perfs + marquage payé). Mono-FR, hors [locale], gaté requireRole('superadmin').
**Vérifié:** 2026-06-19
**Statut:** human_needed
**Re-vérification:** Non — vérification initiale

## Objectif atteint

### Vérités observables

| # | Vérité | Statut | Evidence |
|---|--------|--------|----------|
| 1 | Fonctions pures `postedSetupIdSet` + `telegramStatusFor` (2 états, jamais 'failed') | VERIFIED | `apps/web/src/lib/admin/signals.ts` : type `TelegramStatus = 'posted' \| 'unpublished'`, aucune mention 'failed' dans la logique ; 8 tests unitaires couvrant bornes exactes, clés non-notable, entrée vide |
| 2 | Fonctions pures `candleColor` + `ageColor` + seuils `NEWS_THRESHOLDS`/`MACRO_THRESHOLDS` | VERIFIED | `apps/web/src/lib/admin/freshness.ts` : seuils 6h/24h et 36h/72h ; logique red/amber/green strictement supérieure ; tests bornes exactes et juste-au-dessus dans `freshness.test.ts` |
| 3 | Fonction pure `latestPerJob` + `runDurationMs` | VERIFIED | `apps/web/src/lib/admin/jobs.ts` : réduit les lignes job_runs (supposées triées started_at desc) au dernier run par job_name, attache durationMs null si running ; tests couvrant dupliqué, running, vide |
| 4 | Chaque route (admin)/* s'affiche dans le shell sidebar persistant avec 7 items D-01 | VERIFIED | `(admin)/layout.tsx` : shell flex 2 colonnes avec `<AdminSidebar />` monté SOUS `await requireRole('superadmin')` ; `AdminSidebar.tsx` liste exactement 7 items en ordre D-01 avec hrefs littéraux |
| 5 | Sidebar surligne la route active par prefix-match via usePathname() | VERIFIED | `AdminSidebar.tsx` : `isActive()` = prefix-match sauf `/admin` exact (`exact: true` sur l'item dashboard) ; plain `next/link` (admin hors [locale]) |
| 6 | Gate `requireRole('superadmin')` préservé, non-superadmin reçoit notFound() (404) | VERIFIED | `layout.tsx` ligne 19 : `await requireRole('superadmin')` est la première instruction du RSC, avant tout rendu ; `AdminSidebar` est `'use client'` sans accès service_role |
| 7 | Toutes les clés FR Phase 8 (admin.nav/dashboard/signals/health/affiliates.*) centralisées dans fr.json | VERIFIED | `apps/web/src/messages/fr.json` : les 5 namespaces `nav`, `dashboard`, `signals`, `health`, `affiliates` sont présents sous `admin` ; les plans Wave 2 (02/03/04) n'ont pas touché fr.json (confirmé par les SUMMARYs) |

**Score:** 7/7 vérités vérifiées

### Artéfacts requis

| Artéfact | Attendu | Statut | Détails |
|----------|---------|--------|---------|
| `apps/web/src/lib/admin/signals.ts` | Mapper Telegram pur | VERIFIED | 39 lignes, exports nommés `postedSetupIdSet` + `telegramStatusFor`, zéro import I/O |
| `apps/web/src/lib/admin/freshness.ts` | Feux fraîcheur purs | VERIFIED | 49 lignes, exports `candleColor`, `ageColor`, `NEWS_THRESHOLDS`, `MACRO_THRESHOLDS` |
| `apps/web/src/lib/admin/jobs.ts` | Réducteur job_runs pur | VERIFIED | 47 lignes, exports `latestPerJob`, `runDurationMs`, interface `JobRunInput` |
| `apps/web/src/app/(admin)/_components/AdminSidebar.tsx` | Sidebar client nav active-route | VERIFIED | 80 lignes, `'use client'`, `usePathname`, plain `next/link`, 7 items D-01, active prefix-match |
| `apps/web/src/app/(admin)/layout.tsx` | Shell 2 colonnes avec gate préservé | VERIFIED | 29 lignes, `await requireRole('superadmin')` en ligne 19, flex 2 colonnes, `<AdminSidebar />` |
| `apps/web/src/app/(admin)/signaux/page.tsx` | RSC liste signaux × telegram_posts + filtres | VERIFIED | 214 lignes, `createAdminServiceClient`, `postedSetupIdSet`+`telegramStatusFor` importés et utilisés, filtres GET URL-synced, badges 2 états, liens détail |
| `apps/web/src/app/(admin)/signaux/[id]/page.tsx` | RSC détail signal read-only (tous statuts) | VERIFIED | 86 lignes, `createAdminServiceClient`, `maybeSingle()`, `notFound()`, AUCUN filtre `status='active'`, AUCUN `createClient(` |
| `apps/web/src/app/(admin)/sante/page.tsx` | RSC santé : feux fraîcheur + table job_runs | VERIFIED | 244 lignes, `candleColor`+`ageColor`+`latestPerJob` importés et utilisés, `v_data_freshness`+`news`+`macro_series` lus, `is_stale` LU de la vue (jamais recalculé en JS) |
| `apps/web/src/app/(admin)/page.tsx` | RSC dashboard /admin avec 3+ KPI cards | VERIFIED | 207 lignes, `count:'exact'` sur subscriptions + payments, `candleColor`+`ageColor` pour feu global, 3 `<Card>` chacune link vers `/admin/membres`, `/admin/file`, `/admin/sante` |
| `apps/web/src/app/(admin)/affiliation/affilies/page.tsx` | RSC affiliés perfs (base tables, CR-02 money) | VERIFIED | 145 lignes, `.from('affiliates').select(...)`, agrégation BigInt, `formatAtomic(BigInt(...))`, AUCUN `Number(` sur atomiques, link vers payouts |
| `apps/web/e2e/gating.spec.ts` | E2E gate étendu : 404 sur nouvelles routes Phase 8 | VERIFIED | Block `ACCESS-03b` ajouté (lignes 97-133) : 6 `test()` explicites (3 routes × 2 états auth), tous `toBe(404)`, AUCUN `toBe(403)` ni `toBe(200)` |

### Liens clés (wiring)

| De | Vers | Via | Statut |
|----|------|-----|--------|
| `(admin)/layout.tsx` | `AdminSidebar.tsx` | `import { AdminSidebar }` + rendu dans flex shell | WIRED |
| `(admin)/layout.tsx` | `requireRole('superadmin')` | `await requireRole('superadmin')` ligne 19 | WIRED |
| `AdminSidebar.tsx` | `usePathname` (next/navigation) | `import { usePathname } from 'next/navigation'` ; utilisé dans `isActive()` | WIRED |
| `(admin)/signaux/page.tsx` | `lib/admin/signals.ts` | `import { postedSetupIdSet, telegramStatusFor }` ; `postedIds = postedSetupIdSet(posts)` ; `telegramStatusFor(s.id, postedIds)` | WIRED |
| `(admin)/signaux/page.tsx` | `createAdminServiceClient` | `import { createAdminServiceClient }` ; `const client = createAdminServiceClient()` | WIRED |
| `(admin)/signaux/page.tsx` | `(admin)/signaux/[id]/page.tsx` | `href={\`/admin/signaux/${s.id}\`}` dans `<Link>` | WIRED |
| `(admin)/signaux/[id]/page.tsx` | `createAdminServiceClient` (service_role, pas anon) | `import { createAdminServiceClient }` ; AUCUN `createClient(` | WIRED |
| `(admin)/sante/page.tsx` | `lib/admin/freshness.ts` | `import { candleColor, ageColor, NEWS_THRESHOLDS, MACRO_THRESHOLDS }` | WIRED |
| `(admin)/sante/page.tsx` | `lib/admin/jobs.ts` | `import { latestPerJob, type JobRunInput }` ; `latestPerJob((runs ?? []) as JobRunInput[])` | WIRED |
| `(admin)/page.tsx` | `/admin/membres`, `/admin/file`, `/admin/sante` | 3 `<Link href="...">` wrappant les `<Card>` | WIRED |
| `(admin)/page.tsx` | `candleColor`+`ageColor` | import + usage dans `loadKpis()` pour le feu global | WIRED |
| `(admin)/affiliation/affilies/page.tsx` | `createAdminServiceClient → affiliates` (base tables) | `.from('affiliates').select(...)` ; AUCUNE `affiliate_dashboard` | WIRED |
| `(admin)/affiliation/affilies/page.tsx` | `formatAtomic(BigInt(...))` | `import { formatAtomic } from '@app/core'` ; `formatAtomic(BigInt(r.commissionsDueAtomic))` | WIRED |
| `gating.spec.ts` | `/admin/signaux`, `/admin/signaux/[id]`, `/admin/sante` | 6 assertions `toBe(404)` explicites dans `ACCESS-03b` | WIRED (statique) |

### Trace de flux de données (Niveau 4)

| Artéfact | Variable data | Source | Données réelles | Statut |
|----------|---------------|--------|-----------------|--------|
| `signaux/page.tsx` | `allSignals` | `trade_setups` + `telegram_posts` via `createAdminServiceClient` | Requêtes PostgREST réelles (order + like) | FLOWING |
| `signaux/[id]/page.tsx` | `data` | `trade_setups` via `createAdminServiceClient().maybeSingle()` | Requête réelle, `notFound()` si null | FLOWING |
| `sante/page.tsx` | `sources`, `jobs` | `v_data_freshness` + `news` + `macro_series` + `job_runs` via `createAdminServiceClient` | 4 requêtes DB réelles | FLOWING |
| `page.tsx` (dashboard) | `activeMembers`, `pendingQueue`, `health` | `subscriptions` + `payments` + `v_data_freshness` + `news` + `macro_series` via head counts | `count:'exact', head:true` — requêtes réelles sans rows | FLOWING |
| `affilies/page.tsx` | `rows` | `affiliates + referrals + commissions` via `createAdminServiceClient` | Agrégation BigInt en JS depuis données DB réelles | FLOWING |

### Anti-patterns détectés

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| Aucun | — | — | — | Zéro TBD/FIXME/XXX trouvé dans les fichiers Phase 8 ; zéro `return null` stub dans les composants ; zéro `Number()` sur montants atomiques |

Vérifications supplémentaires confirmées :
- Aucune migration DB introduite en Phase 08 (dernière = `0016_affiliation.sql`, prévue Phase 7)
- `affiliate_dashboard` (vue auth.uid()-scoped) ABSENTE de `affilies/page.tsx` — agrégation depuis tables de base uniquement (décision A3)
- `is_stale` jamais recalculé en JS dans `sante/page.tsx` — LU depuis `v_data_freshness.is_stale` (gestion week-end FX/DST par la vue DB)
- `createClient(` absent de `signaux/[id]/page.tsx` — service_role uniquement, pas de client anon
- Sidebar utilise `next/link` (jamais le Link i18n next-intl) — admin hors [locale] conforme à D-15

### Vérifications comportementales (Spot-Checks)

| Comportement | Commande | Résultat | Statut |
|-------------|---------|---------|--------|
| Tests unitaires fonctions pures | `pnpm vitest run apps/web/src/lib/admin` | 33/33 verts (selon SUMMARY 08-01) | PASS (rapporté) |
| Typecheck global | `pnpm tsc --noEmit` | exit 0 (selon tous SUMMARYs) | PASS (rapporté) |
| Lint i18n (pas de texte JSX en dur) | `pnpm lint:i18n` | exit 0 (selon tous SUMMARYs) | PASS (rapporté) |
| Suite vitest complète | `pnpm vitest run` | 507 passed, 4 skipped (selon SUMMARY 08-02 + 08-04) | PASS (rapporté) |
| E2E gating parse | `pnpm playwright test gating --list` | 12 tests listés dont 6 nouveaux ACCESS-03b (selon SUMMARY 08-04) | PASS (rapporté) |

### Exécution des probes

Aucune probe shell (`probe-*.sh`) déclarée pour cette phase. Step 7c : SKIPPED (phase front-end/RSC, probes non applicable).

### Couverture des exigences

| Exigence | Plan source | Description | Statut | Evidence |
|----------|------------|-------------|--------|----------|
| ADMIN-03 | 08-01, 08-04 | Le superadmin voit les affiliés et leurs performances et gère les payouts de commissions | SATISFIED | `affilies/page.tsx` : liste affiliés + referrals + commissions due/paid (BigInt CR-02) + lien payouts ; page payouts (Phase 7, non modifiée) : marquage paid + historique |
| ADMIN-04 | 08-01, 08-02, 08-03, 08-04 | Le superadmin voit les signaux publiés et la santé des jobs/données (job_runs, freshness) | SATISFIED | `signaux/page.tsx` + `signaux/[id]/page.tsx` : liste + détail read-only + badges Telegram 2-états + filtres ; `sante/page.tsx` : feux fraîcheur (candles/news/macro) + table job_runs |

### Vérification humaine requise

#### 1. Dashboard /admin — comptes KPI réels

**Test:** Superadmin ouvre /admin  
**Attendu:** 3 cartes (membres actifs, file en attente, santé globale) avec comptes réels depuis Supabase ; chaque carte navigue vers sa page dédiée  
**Pourquoi humain:** Requiert serveur + connexion Supabase ; les `head:true` queries retournent 0 sans données réelles ce qui serait fonctionnellement correct mais visuellement vide

#### 2. Vue Signaux — badges Telegram et filtres

**Test:** Superadmin ouvre /admin/signaux avec des trade_setups et telegram_posts existants  
**Attendu:** Badge Posté (emerald) pour les setups ayant une ligne `notable:<id>` dans telegram_posts ; badge Non publié (muted) sinon ; filtres par instrument et statut fonctionnels ; chaque ligne navigue vers /admin/signaux/[id]  
**Pourquoi humain:** Requiert données réelles ; la logique de mapping est vérifiée en unitaire mais le rendu visuel des badges et le comportement des filtres URL-synced nécessite une validation end-to-end

#### 3. Détail signal /admin/signaux/[id] pour un setup expiré

**Test:** Superadmin clique sur un signal expiré ou invalidé depuis la liste  
**Attendu:** La page affiche le setup complet (statut "expired" ou "invalidated") sans 404 — prouvant la divergence intentionnelle vs la route membre  
**Pourquoi humain:** Requiert un setup expiré en base ; le grep confirme l'absence de filtre `status='active'` mais la preuve runtime est nécessaire

#### 4. Vue Santé — feux et table job_runs

**Test:** Superadmin ouvre /admin/sante avec des données fraîches et stale  
**Attendu:** Feux cohérents (vert si récent, ambre si approche du seuil, rouge si stale) ; table job_runs montre le dernier run par job avec durée et statut  
**Pourquoi humain:** Logique verifiable en unitaire (tests freshness.test.ts) mais la cohérence du rendu visuel avec des données de production requiert validation

#### 5. Vue Affiliés + workflow payout complet

**Test:** Superadmin ouvre /admin/affiliation/affilies, voit des données d'affiliés, clique "Gérer les payouts", marque une commission comme payée avec une référence tx  
**Attendu:** Montants en USDT BigInt corrects ; lien payouts fonctionnel ; la page payouts (D-09/D-10 non modifiée) marque paid via RPC, la ligne paid reste visible  
**Pourquoi humain:** Requiert des affiliés et commissions réelles ; le workflow payout est confirmé intact par `git diff --quiet` mais la validation end-to-end est manuelle

#### 6. E2E admin-gate ACCESS-03b (live infra)

**Test:** Lancer `pnpm playwright test gating` avec `next dev` sur :3000 + Supabase env + "Confirm email" désactivé  
**Attendu:** 6 nouveaux tests ACCESS-03b passent au vert : `/admin/signaux`, `/admin/signaux/[id]`, `/admin/sante` retournent 404 pour non-auth et non-superadmin (jamais 200/redirect/403)  
**Pourquoi humain:** Env-gated (live infra requise) — convention identique aux autres specs E2E live-infra du projet (D-01-04-C)

---

## Décisions D-01..D-10 honorées

| Décision | Description | Vérification |
|----------|-------------|-------------|
| D-01 | Shell admin avec sidebar persistante, 7 items | VERIFIED — `AdminSidebar.tsx` : 7 items dans l'ordre exact, monté par `layout.tsx` |
| D-02 | Page d'accueil /admin avec 3+ KPI cards | VERIFIED — `page.tsx` : 3 Cards linkées vers membres/file/sante |
| D-03 | Liste chronologique trade_setups × telegram_posts (2 états) | VERIFIED — `signaux/page.tsx` : `created_at` desc, badges posted/unpublished |
| D-04 | Filtres par instrument et statut, lien détail | VERIFIED — GET form + filtrage en mémoire + lien `href=/admin/signaux/${s.id}` |
| D-05 | Lecture seule (pas d'édition/suppression) | VERIFIED — aucun contrôle d'action dans signaux/* ; grep edit/delete/publish == 0 |
| D-06 | Feux vert/orange/rouge par source de fraîcheur | VERIFIED — `sante/page.tsx` : dots `bg-emerald/amber/red-500` par source |
| D-07 | Tableau des derniers job_runs par job | VERIFIED — `sante/page.tsx` : `latestPerJob(runs)` → table Job/Statut/Durée/Dernier run |
| D-08 | Présentation seule, pas d'alerting automatique | VERIFIED — aucun polling, aucune notification, aucune action dans sante/* |
| D-09 | Enrichir workflow payout : marquer paid + référence tx | VERIFIED (zero DB work) — page payouts non modifiée (git diff --quiet OK) ; migration 0016 couvre payouts + mark_commission_paid RPC |
| D-10 | Server action sous requireRole('superadmin'), idempotente | VERIFIED (déléguée Phase 7) — payout mutation dans `affiliation/payouts/actions.ts` (Phase 7, non touchée Phase 8) |

---

_Vérifié : 2026-06-19_
_Vérificateur : Claude (gsd-verifier)_
