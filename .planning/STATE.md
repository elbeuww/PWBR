---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Plateforme publique
status: ready_to_plan
last_updated: "2026-06-15T00:35:46.762Z"
last_activity: 2026-06-15
progress:
  total_phases: 9
  completed_phases: 4
  total_plans: 10
  completed_plans: 10
  percent: 44
---

# Project State

**Project:** Plateforme d'Analyse de Trading "Vétéran"
**Last updated:** 2026-06-14

## Project Reference

**Core value:** Produire, pour chaque opportunité, une analyse fiable et explicable — vulgarisée pour un public non technique — avec un % de réussite TOUJOURS mesuré, jamais inventé : c'est le socle de confiance qui fait payer l'abonnement.
**Current focus:** Phase 03 — espace-membre-signaux-gated-rls
**Mode:** interactive (MVP vertical)
**Granularity:** fine

## Current Position

Phase: 4
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-15

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
| Phase 02 P01 | 25min | 3 tasks | 24 files |
| Phase 02 P02 | 12min | 3 tasks | 14 files |
| Phase 02 P03 | ~18min | 3 tasks | 9 files |
| Phase 03 P02 | 25min | 4 tasks | 12 files |
| Phase 03 P03-03 | ~9min | 2 tasks | 10 files |

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

### Decisions exécution (Plan 02-01)

- **D-02-01-A** : tokens de marque mappés sur les variables shadcn (`--primary`/`--background`/`--secondary`/…) via `@theme inline` dans globals.css → les composants `ui/` héritent automatiquement de la palette bleue institutionnelle (must_have « shadcn stylés à la marque »), pas de double système de couleurs. `@destructive` = gris neutre dans les 2 thèmes (D-04 : vert/rouge réservés au trading, absents en P2).
- **D-02-01-B** : Inter via `next/font/google` (self-host AU BUILD, A5 du RESEARCH) ; `@fontsource-variable/inter` non installé (build Google OK). IBM Plex Sans Arabic via `next/font/local` (subset arabic 400/600 .woff2 dans `src/fonts/`, D-03 zéro CDN runtime).
- **D-02-01-C** : alias `@/*` → `./src/*` ajouté au `tsconfig.json` web pour les imports shadcn (`@/lib/utils`, `@/components/ui`) ; non régressif vs imports relatifs P1.
- **D-02-01-D** : composant shadcn `form` indisponible en standalone dans le registre nova/radix → reporté au Plan 02-03 (signup, avec react-hook-form). 8 composants `ui/` livrés (button/card/badge/dialog/input/label/dropdown-menu/separator). `shadcn` CLI retiré des deps runtime.
- **D-02-01-E (Pitfall D)** : `npx shadcn init` committé séparément (013eccf) ; il avait posé `@theme inline`+`:root`/`.dark` oklch neutres (surchargés par la palette marque en Task 3) et injecté `Geist` dans le root `app/layout.tsx` (restauré pass-through — invariant Pitfall 7). `:lang(ar)` P1 préservé. Greps acceptance exacts respectés (`:lang(ar)`=1, `suppressHydrationWarning`=1, Noto=0, `@custom-variant dark`=1).
- **D-02-01-F (Rule 1 i18n)** : labels « Close » en dur de `ui/dialog` (générés par shadcn) externalisés en prop `closeLabel` (l'appelant fournit le label traduit) → `lint:i18n` exit 0.
- **D-02-01-BASELINE** : baseline P1 inchangée (`forbidden-service-import.ts` reste la seule erreur tsc/ESLint ; `next build` = `✓ Compiled successfully`, échec final = fixture intentionnelle).

### Decisions exécution (Plan 02-02)

- **D-02-02-A** : gate légal LEGAL-02 = env var `LEGAL_REVIEW_DONE` lu par `lib/legal-gate.ts` (`import 'server-only'`, défaut SÛR `=== 'true'`, jamais permissif) ; consommé par P4 avant 1ᵉʳ encaissement, appelé NULLE PART en P2. Artefact traçabilité `docs/legal/LEGAL-REVIEW.md` (checklist crypto Algérie/MENA + sign-off). `.env.example` créé (var gate documentée, sans NEXT_PUBLIC_ → jamais bundlé client).
- **D-02-02-B** : tests sous `apps/web/**/__tests__/` (pas `*.test.ts` libre ni `apps/web/test/`) — le glob `vitest.config.ts` racine n'inclut que `packages/**` + `apps/**/__tests__/**` ; web sans vitest local. Exécution `npx vitest run` racine (le `pnpm --filter web exec vitest` du plan était inopérant).
- **D-02-02-C** : pages légales `legal/[doc]` = allowlist `DOCS=[cgu,risques,confidentialite,mentions]` + `generateStaticParams` + `notFound()` avant rendu (T-02-04) ; corps = placeholder `reviewPending` (D-15, aucun texte faisant foi) ; aucun HTML brut (T-02-07). `<Disclaimer>` RSC unique (D-13) réutilisable P3/P6. `<Footer>` greffé dans le slot du shell → disclaimer sur toutes les pages, 3 langues (LEGAL-01).
- **D-02-02-D (Rule 1)** : cast `theme-parity.test.ts` élargi `as unknown as` (régression tsc induite par le namespace imbriqué `legal`) ; EN disclaimer = « No promise of gains » (évite le grep no-perf « profit », VITR-03). Baseline P1 inchangée.

### Decisions exécution (Plan 02-03)

- **D-02-03-A** : classes de couleur = tokens shadcn réels mappés marque en 02-01 (`bg-card`/`bg-primary`/`text-muted-foreground`/`border-border`) plutôt que les noms bruts du plan (`text-muted`/`text-accent`). Vert/rouge absents (D-04). Prix en `<bdi>` (anti-inversion RTL).
- **D-02-03-B (D-09)** : redirection succès signup = SEUL le `href` de `actions.ts:signUp` passe de `/dashboard` à `/paiement-bientot`. Aucune modification de `supabase.auth`/`getUser`/`getSession` — invariant auth P1 intact (`getSession` dans actions = 0). Funnel câblé bout en bout home→tarifs→signup→paiement-bientot.
- **D-02-03-C** : test no-perf-claims au chemin EXIGÉ par le plan (`apps/web/test/no-perf-claims.test.ts`) ; glob `vitest.config.ts` racine étendu de `apps/web/test/**` (RED structurel « No test files found » → GREEN après include). Diverge de D-02-02-B (chemin figé par le frontmatter du plan).
- **D-02-03-D** : « take-profit(s) » (terme de plan de trade, copy canonique UI-SPEC) contient le substring « profit » mais n'est PAS une allégation de gain → le détecteur le neutralise avant de chercher le mot « profit ». Sanity « 90% » prouve le détecteur non trivial (VITR-03).
- **D-02-03-E** : proof slot home `SHOW_PROOF=false` (D-08, zéro chiffre, activé en P5) ; écran « paiement bientôt » sans adresse/flux (D-09, paiement réel = P4) ; offre 3 $/7 j une seule fois (D-11, l'ancien 3 $/15 j absent). Métrique factuelle « marchés couverts » ajoutée pour éviter une home creuse (jamais un taux de réussite).

### Decisions exécution (Plan 03-01)

- **D-03-01-A (Open Question 1 tranchée, T-03-02)** : RLS candles = ALIGN sur `has_active_subscription()`. La policy `candles: lecture authentifiés` (0003) est drop/recreate en `candles: abonnés actifs` → un authentifié non-abonné ne lit NI les setups NI l'OHLCV. Cohérence de la barrière payante.
- **D-03-01-B (A1/A4, MEMB-05)** : 0011 pose `replica identity full` (old record sur UPDATE → détecter active→expired, D-14) + ajout idempotent de `trade_setups` à `supabase_realtime` gardé par `pg_publication_tables` (re-run sûr). Appliquée live via MCP `apply_migration` (canal 0006/0009, PAS db push). Les events postgres_changes héritent de la RLS → non-abonné = zéro event (T-03-01).
- **D-03-01-C** : types Supabase NON régénérés. 0011 n'ajoute aucune colonne ; `supabase gen types` ne reflète ni RLS policies, ni replica identity, ni publication membership → `packages/supabase/src/database.types.ts` inchangé, aucun commit vide. Projet non `link`é localement (`gen types --linked` échoue par design, D-01-01-D) ; le fichier committé reste la source.
- **D-03-01-D (T-03-05)** : `searchParams.ts` parse champ par champ via `.safeParse` — une valeur hors enum est ignorée (undefined), jamais propagée dans `.eq/.in`. `asset` reste une valeur paramétrée, jamais concaténée. `sort` hors enum revient au défaut `score` (D-08). 10/10 tests verts.
- **D-03-01-E** : i18n namespaces `signals`/`signalDetail`/`glossary` à parité stricte fr/en/ar (copy FR canonique = 03-UI-SPEC §Copywriting Contract ; `realtimeBadge` avec ICU plural). `signals.title`/`signals.body` existants préservés.

### Open todos / research flags (v2.0)

- **Phase 4 (research flag) :** TronGrid endpoint `walletsolidity`, parsing logs TRC-20, normalisation hex↔base58 — doc TS peu dense, recherche de phase recommandée.
- **Phase 5 (research flag) :** critère de succès d'un setup (TP1 ? TP2 ? fenêtre temporelle ?) — décision produit à trancher avant implémentation de `outcome-tracker`.
- **Phase 2 (gate non-code) :** revue juridique conseil non agréé + statut crypto Algérie/MENA — à lancer en parallèle, bloque l'encaissement Phase 4.
- **Prérequis hors code Phase 4 :** cold wallet opérationnel + watcher lecture seule.
- **Reporté v1.0 → ops :** configurer routines planifiées Claude + 1 run réel du moteur (checkpoint 04-04, hors roadmap v2.0).

### Blockers

Aucun.

## Session Continuity

**Last session:** 2026-06-15T00:35:36.794Z

**Last session:** 2026-06-15 — Completed 03-01-PLAN.md (segment final). Task 1 (2dde589) + Task 2 (e8df555, migration 0011 appliquée live via MCP) faits par exécuteurs précédents ; ce segment a confirmé que les types Supabase n'ont pas besoin de régénération (0011 = replica identity + publication + RLS candles, aucune colonne) puis exécuté Task 3 en TDD : 5a70533 (RED searchParams), 26a3c41 (GREEN searchParams + format + QueryProvider + i18n fr/en/ar). Vérifs : vitest 10/10, parité i18n OK, `pnpm typecheck` 0 erreur, `lint:i18n` exit 0. Décision RLS candles = ALIGN. **Plan 03-01 COMPLETE (socle DB + plumbing).** Stopped at : Plan 03-01 terminé.

**Last session (archive):** 2026-06-14 — Completed 02-03-PLAN.md (4 commits : 38c1894 tarifs 9$/3$ + paiement-bientot + funnel signup→paiement-bientot, 86e7001 home bénéfice-first + proof slot masqué, 49ac57e RED no-perf-claims, fa8a5d0 GREEN glob vitest). Cœur conversion de la vitrine livré : home VITR-01, tarifs VITR-02 (USDT TRC-20, D-10/D-11/D-12), funnel honnête D-09, garde no-perf-claims VITR-03/D-08. 15 tests verts, tsc/lint:i18n OK, invariant auth P1 intact. **Phase 02 COMPLETE (3/3 plans).** Stopped at : Plan 02-03 terminé.

**Next action:** Phase 03 en cours — Plan 03-01 (socle DB + plumbing) terminé. Prochains plans (Wave 2, parallélisables) : **03-02 (liste signaux : page RSC, SignalCard, FilterBar, SignalList Realtime)** et **03-03 (détail signal : CandleChart lightweight-charts, explication simple/approfondie)**. Rappel : lecture front via client anon uniquement (frontière producteur-unique) ; ne jamais importer un repo service_role dans apps/web.

---
*State updated: 2026-06-14 — milestone v2.0, roadmap 9 phases créée. Cœur analytique v1.0 (P1-4) livré et archivé, sert de socle.*
