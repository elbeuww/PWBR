---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Plateforme publique
status: executing
last_updated: "2026-06-14T13:42:25.954Z"
last_activity: 2026-06-14
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

**Project:** Plateforme d'Analyse de Trading "Vétéran"
**Last updated:** 2026-06-14

## Project Reference

**Core value:** Produire, pour chaque opportunité, une analyse fiable et explicable — vulgarisée pour un public non technique — avec un % de réussite TOUJOURS mesuré, jamais inventé : c'est le socle de confiance qui fait payer l'abonnement.
**Current focus:** Phase 01 — socle-transverse-i18n-rtl-r-les-gating
**Mode:** interactive (MVP vertical)
**Granularity:** fine

## Current Position

Phase: 01 (socle-transverse-i18n-rtl-r-les-gating) — COMPLET (4/4 plans)
Plan: 4 of 4 — COMPLET (3 tasks : i18n.spec + gating.spec E2E des 8 success criteria, check statique lint:i18n I18N-03, auth.spec localisé /fr/…). 18 tests Playwright listés/parse OK ; typecheck --force vert ; lint:i18n exit 0. Exécution GREEN des E2E = human-verify (dev server + .env).
Status: Phase 01 terminée — prêt pour vérification (/gsd:verify-work) puis Phase 02
Last activity: 2026-06-14

Progress: [██████████] 100%

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete (v2.0) | 0/9 |
| Plans complete (v2.0) | 0 |
| Requirements covered (v2.0) | 0/41 (couche produit non démarrée) |
| Cœur analytique (v1.0) | Livré P1-4, 261/261 tests (socle, non re-roadmappé) |
| Phase 01 P02 | 3 min | 3 tasks | 11 files |
| Phase 01 P03 | 25 min | 4 tasks | 19 files |
| Phase 01 P04 | 30min | 3 tasks | 9 files |

## Roadmap v2.0 (9 phases)

1. Socle transverse — i18n/RTL & rôles/gating (I18N-01..04, ACCESS-01..04)
2. Vitrine publique trilingue & gate légal (VITR-01..03, LEGAL-01/02)
3. Espace membre signaux gated RLS (MEMB-01..05)
4. Paiement USDT MVP & abonnement — **JALON ENCAISSEMENT** (PAY-01..06, ADMIN-01/02)
5. Track record mesuré & % affiché (TRACK-01..03)
6. Canal Telegram public (TG-01..03)
7. Affiliation à paliers (AFF-01..05)
8. Superadmin consolidé (ADMIN-03/04)
9. CMS cours & articles vulgarisés (CMS-01/02)

**Arêtes critiques :** i18n/rôles avant UI · RLS signaux avant exposition membre · gate légal signé + subscriptions avant encaissement · subscriptions avant affiliation · outcomes avant Telegram & % affiché.

## Accumulated Context

### Decisions (héritées v1.0 — socle technique du cœur analytique)

- Forfait Claude Max + routines planifiées (pas de clé API) en v1.0 ; migration `@anthropic-ai/sdk` au lancement payant (reportée v2.1, ENGINE-API).
- Marchés : crypto + forex + or/argent/pétrole (pas d'actions). Styles Day + Swing en MVP, scalping en v3.
- Indicateurs/R:R/sizing/outcomes calculés en code déterministe ; Claude raisonne uniquement.
- Single-writer / backend read-only ; Supabase = unique frontière producteur/consommateur.
- D-09 : DAILY_ANCHOR.oanda = { America/New_York, 17h } / binance = { UTC, 0h }.
- D-10 : lastClosedCandleStart via floor(epoch/tf)-1 — anti look-ahead (DATA-05).
- D-30 : `snapshots` = table horizontale écrite par 3 moteurs, référencée par `content_hash`.
- D-43 : frontière de confiance unique `persist()` (Zod §3 + garde-fous + scoring + immuabilité/expiry).
- D-44 : hash de contenu = sha256 JSON canonique (clés triées + toFixed 6) — gèle le bruit flottant.
- D-49 : graphe de packages unidirectionnel (core le plus bas ; pas d'import indicators dans core).

### Decisions v2.0 (issues de la recherche — à appliquer en planification)

- **D-V2-01 (roadmap)** : 9 phases reset à 1 ; jalon d'encaissement = Phase 4 ; W5 automatisation (PAY-AUTO/ENGINE-API/AFF-AUTO) hors scope de ce milestone.
- **D-V2-02** : Stack additions v2.0 = next-intl 4.13, grammy 1.43, next-mdx-remote 6.0 ; clients REST maison TronGrid (+ Cryptomus en v2.1). RTL = propriétés logiques natives Tailwind v4 (PAS tailwindcss-rtl).
- **D-V2-03 (argent)** : contrat USDT officiel `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` en `.env` ; decimals 6 BigInt atomique ; `only_confirmed:true` anti-réorg ; `UNIQUE(tx_hash)` GLOBAL ; user n'écrit que `payments(pending)`, service_role transitionne `verified`/`active`.
- **D-V2-04 (sécurité revenu)** : gating = défense en profondeur (layout UX + RLS `has_active_subscription()` security definer) ; test non-abonné → 0 ligne obligatoire.
- **D-V2-05 (rôle)** : `profiles.role` (migration 0008), lu après `getUser()`, jamais dans le JWT ; helpers RLS `is_superadmin()`/`has_active_subscription()` security definer search_path figé.
- **D-V2-06 (affiliation)** : `UNIQUE(affiliate_id, referral_id, period)`, commission sur abonnés actifs uniquement, 1 seul niveau (pas de MLM), `referrals` sans PII, payout MANUEL.
- **D-V2-07 (légal)** : revue juriste signée = gate non-code bloquant Phase 4 en prod ; signaux génériques jamais personnalisés ; disclaimers rédigés par juriste.
- **D-V2-08 (track record)** : % TOUJOURS mesuré (backtest puis réel, distingués) ; seuil d'échantillon sinon « en construction » ; réutiliser constantes anti look-ahead du cœur.

### Decisions exécution (Plan 01-01)

- **D-01-01-A** : migrations 0008 (profiles.role text+check member/affiliate/superadmin défaut member + `is_superadmin()` security definer `search_path=public`) et 0009 (table `subscriptions` RÉELLE D-04 + `has_active_subscription()` security definer + drop/recreate RLS `trade_setups`/`analyses` using `has_active_subscription()`) écrites localement.
- **D-01-01-B (A6 tranché)** : colonne d'expiry = `current_period_end` (PAS `expires_at` d'ARCHITECTURE) ; le helper RLS référence ce même nom.
- **D-01-01-C** : test anon-client `gating-rls.test.ts` couvre ACCESS-02/03/04 (non-abonné→0 trade_setup, 0 analyses, isolation subscriptions cross-user). GREEN après push (4/4) ; `rls.test.ts` 6/6 non régressé.
- **D-01-01-D** : 0008/0009 poussées LIVE via MCP `apply_migration` (canal 0006), aucun `supabase link` local. 2 WARN advisors security-definer (`has_active_subscription`/`is_superadmin` callable par authenticated) EXPECTED BY DESIGN (D-V2-05/Pitfall 6), non bloquants. ACCESS-02/03/04 couverts.

### Decisions exécution (Plan 01-02)

- **D-01-02-A** : i18n posé (next-intl 4.13 `routing`/`navigation`/`request` + messages fr/en/ar à parité de clés STRICTE) AVANT toute UI ; aucune route déplacée (réservé Plan 03). routing = locales fr/en/ar, defaultLocale fr, localePrefix `always` (D-01/02/03).
- **D-01-02-B (A1 tranché)** : imports next-intl 4.13 validés contre la map `exports` installée — `next-intl/routing`, `next-intl/navigation`, `next-intl/server`, root `next-intl` (`hasLocale`).
- **D-01-02-C (D-11)** : `@theme` minimal (`--font-arabic` sur `:lang(ar)`) ; RTL via propriétés logiques natives Tailwind v4, INTERDIT `tailwindcss-rtl`/`tailwindcss-logical` ; design system de marque reporté P2. `next.config.ts` wrappé `withNextIntl` en préservant transpilePackages/turbopack.root.
- **D-01-02-DEFER** : ~50 erreurs tsc pré-existantes dans `packages/supabase` (`database.types.ts` n'exporte pas ProfileRow/TradeSetupRow/… ) hors scope — loggées `deferred-items.md`, aucune dans les fichiers du plan.

### Decisions exécution (Plan 01-03)

- **D-01-03-A** : `gate.ts` réutilise `createClient()` (`lib/supabase/server.ts`, déjà typé `Database`) plutôt que recâbler `createServerSupabaseClient(await cookies())`. Les `redirect` localisés de next-intl 4.13 exigent un `locale` explicite → résolu serveur via `getLocale()` (gate.ts + actions.ts).
- **D-01-03-B (Pitfall 2)** : middleware composé — `handleI18n` produit la response (rewrite + cookie NEXT_LOCALE), `updateSession(request, response)` la MUTE (jamais `NextResponse.next()` recréée). Header `x-pathname` posé pour le returnTo du gate (D-08).
- **D-01-03-C (RESEARCH Q1)** : `dashboard` placé HORS `(member)` sous `[locale]/dashboard` — il ne lit que `instruments` (authenticated, non sub-gated) ; le sub-gater bloquerait tout le monde en P1. `(member)` réservé aux surfaces de signaux.
- **D-01-03-D (threat T-01-SC)** : `lucide-react` absent du package.json → icônes globe/chevron du LanguageSwitcher en SVG inline ; aucun nouvel install npm dans ce plan.
- **D-01-03-E (Pitfall 7)** : un SEUL `<html lang dir>` dans `[locale]/layout.tsx` ; root `app/layout.tsx` réduit à pass-through (`return children`).
- **D-01-03-BASELINE** : 1 erreur tsc pré-existante acceptée (`__lint_fixtures__/forbidden-service-import.ts`, fixture ESLint v1.0 AUTH-03) — hors scope, gate vert si aucune NOUVELLE erreur au-delà.

### Decisions exécution (Plan 01-04)

- **D-01-04-A** : surface membre minimale `[locale]/(member)/signaux/page.tsx` créée (Rule 2) — le groupe `(member)` n'avait qu'un `layout.tsx`, aucune URL membre ne déclenchait `requireActiveSub`, rendant D-07 (auth-sans-abo→/tarifs) non testable en E2E. Stub i18n (namespace `signals` fr/en/ar), contenu réel en Phase 3.
- **D-01-04-B** : check statique `scripts/check-i18n-hardcoded.mjs` (Node natif, zéro dépendance, script `lint:i18n`) — interdit le texte JSX littéral et les attributs visibles hors `t(...)` (I18N-03, threat T-01-10). Détection prouvée sur chaîne plantée ; nom de marque `Vétéran Trading` exclu via `// i18n-ignore`.
- **D-01-04-C** : 18 tests Playwright (i18n.spec + gating.spec + auth.spec localisé) authorés, parse/`--list` OK, mais exécution GREEN = **human-verify** (dev server :3000 + `.env.local` Supabase requis ; aucun GREEN fabriqué). I18N-04 reste Manual-Only en P1 (skip explicite). `tsc -b --force` vert ; `lint:i18n` exit 0.

### Open todos / research flags (v2.0)

- **Phase 4 (research flag) :** TronGrid endpoint `walletsolidity`, parsing logs TRC-20, normalisation hex↔base58 — doc TS peu dense, recherche de phase recommandée.
- **Phase 5 (research flag) :** critère de succès d'un setup (TP1 ? TP2 ? fenêtre temporelle ?) — décision produit à trancher avant implémentation de `outcome-tracker`.
- **Phase 2 (gate non-code) :** revue juridique conseil non agréé + statut crypto Algérie/MENA — à lancer en parallèle, bloque l'encaissement Phase 4.
- **Prérequis hors code Phase 4 :** cold wallet opérationnel + watcher lecture seule.
- **Reporté v1.0 → ops :** configurer routines planifiées Claude + 1 run réel du moteur (checkpoint 04-04, hors roadmap v2.0).

### Blockers

Aucun.

## Session Continuity

**Last session:** 2026-06-14T13:41:19.862Z

**Last session:** 2026-06-14 — Completed 01-04-PLAN.md (3 tasks committés : 700cffb, 5cf68db, 8a6e59e). Phase 01 COMPLÈTE (4/4 plans). Stopped at : phase 01 terminée.

**Next action:** Lancer `/gsd:verify-work` sur la Phase 01 (exécuter la suite E2E avec dev server + `.env.local` pour passer les 18 tests Playwright en GREEN ; revue visuelle RTL arabe Manual-Only), puis planifier **Phase 02** (Vitrine publique trilingue & gate légal). Socle i18n/RTL + rôles/gating complet et vérifiable (E2E authorés + lint:i18n CI + RLS Plan 01).

---
*State updated: 2026-06-14 — milestone v2.0, roadmap 9 phases créée. Cœur analytique v1.0 (P1-4) livré et archivé, sert de socle.*
