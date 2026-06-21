---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: "Mise en vie : identité NEXA, moteur live & track record"
status: executing
last_updated: "2026-06-21T15:09:46.807Z"
last_activity: 2026-06-21
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 11
  completed_plans: 9
  percent: 82
---

# Project State

**Project:** Plateforme d'Analyse de Trading "Vétéran"
**Last updated:** 2026-06-20

## Project Reference

See: .planning/PROJECT.md (mis à jour 2026-06-20 après clôture v2.0)

**Core value:** Produire, pour chaque opportunité, une analyse fiable et explicable — vulgarisée pour un public non technique — avec un % de réussite TOUJOURS mesuré, jamais inventé : c'est le socle de confiance qui fait payer l'abonnement.
**Current focus:** Phase 11 — composants-nexa-reskin-transversal-rebranding
**Mode:** interactive (MVP vertical)
**Granularity:** fine

## Current Position

Phase: 11 (composants-nexa-reskin-transversal-rebranding) — EXECUTING
Plan: 7 of 8
Status: 11-07 (hero animé greenfield UI-02) livré — code vert (177 tests web). Reste manuel : rendu visuel + reduced-motion OS dans les 3 locales.
**Seul item ouvert (live, non-bloquant) :** vérification runtime no-flash — `pnpm --filter web dev` puis `/fr|/en|/ar/login` avec `localStorage.theme='dark'` + reload → confirmer aucune frame claire au premier paint. Rapport : 10-VERIFICATION.md.
**Prochaine action à la reprise :** `/clear` puis `/gsd-plan-phase 11` (Composants NEXA, reskin, MERA→NEXA, hero, ExpiryBanner — DESIGN-05, BRAND-01..04, UI-01..07).
Last activity: 2026-06-21

## Deferred Items

Items acquittés et différés à la clôture du jalon v2.0 le 2026-06-20. Décision
utilisateur : « Acquitter le reste + clôturer v2.0 ». La couche de vérification
AUTOMATISÉE est 100 % verte (Vitest 566 ✓, typecheck 0 erreur) ; P01 et P09 sont
live-vérifiés (E2E 32 ✓). Les items ci-dessous restent ouverts car ils exigent des
ressources externes non provisionnables en session de développement.

| Catégorie | Item | Raison du report |
|-----------|------|------------------|
| verification | P02 (vitrine/légal) | Sign-off juriste externe (LEGAL-02) + revue visuelle RTL — gate non-code |
| verification | P03 (signaux membre) | Supabase Realtime live + rendu canvas charts + signaux seedés |
| verification | P04 (paiement USDT) | Paiement on-chain testnet réel + actions superadmin live |
| verification | P05 (track record) | Vitrine visuelle + RLS anon via devtools, vue pattern_stats live |
| verification | P06 (Telegram) | Envoi réel : bot token + canal public (secret hors-code) |
| verification | P07 (affiliation) | Flux live + service_role + session superadmin + données seedées |
| verification | P08 (superadmin) | 6 checks sur données superadmin seedées (item gating ✅ live-vert) |
| uat | P02-HUMAN-UAT (2) | mêmes dépendances visuelles/live que P02 |
| uat | P03-HUMAN-UAT (10) | mêmes dépendances Realtime/canvas/seed que P03 |
| quick_task | 260617-547 / j1a / nsh / sy5 | Terminées (SUMMARY présentes) — faux-positifs de registre |

**Dette technique explicite (décision requise hors jalon, NON un simple report) :**

- **WIRING-01 (P04 / PAY-05)** : `ExpiryBanner` (alerte J-3/J-1 avant expiration d'abonnement) existe mais n'est rendu nulle part → l'utilisateur n'est PAS informé in-app avant de perdre l'accès. À câbler avant l'ouverture réelle de l'encaissement.
- **LEGAL-02** : revue juridique externe signée — gate non-code bloquant le PREMIER encaissement réel (Phase 4 en prod), pas la livraison du code. `LEGAL_REVIEW_DONE` reste `false`.

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
| Phase 05 P01 | ~15min | 3 tasks | 6 files |
| Phase 05 P05-02 | ~30min | 4 tasks | 8 files |
| Phase 06 P06-01 | ~12min | 3 tasks | 9 files |
| Phase 07 P07-03 | ~12min | 2 tasks | 9 files |
| Phase 07 P07-04 | ~10min | 2 tasks | 6 files |
| Phase 07 P07-05 | ~20min | 2 tasks | 7 files |
| Phase 08 P01 | ~12min | 2 tasks | 9 files |
| Phase 08 P02 | ~10 min | 2 tasks | 2 files |
| Phase 08 P03 | ~15 min | 2 tasks | 2 files |
| Phase 08 P04 | ~12min | 2 tasks | 2 files |
| Phase 09 P01 | 10min | 3 tasks | 10 files |
| Phase 09 P02 | ~12 min | 3 tasks | 15 files |
| Phase 09 P03 | ~15 min | 3 tasks | 9 files |
| Phase 09 P04 | ~10 min | 3 tasks | 8 files |
| Phase 09 P05 | ~15 min | 2 tasks | 5 files |
| Phase 10 P01 | ~12 min | 2 tasks | 6 files |
| Phase 10 P02 | ~9min | 3 tasks | 12 files |
| Phase 10 P03 | ~8min | 2 tasks | 1 file |
| Phase Phase 11 P01 P01 | ~5min | 2 tasks | 1 files |
| Phase 11 P02 | ~6min | 3 tasks | 3 files |
| Phase 11 P03 | ~10min | 3 tasks | 4 files |
| Phase 11 P04 | ~12min | 3 tasks | 9 files |
| Phase 11 P05 | ~10min | 3 tasks | 9 files |
| Phase 11 P07 | ~14min | 3 tasks | 13 files |

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

## Roadmap v2.1 (5 phases, 10-14)

10. Fondation design system NEXA — tokens OKLCH + 5 polices + no-flash RTL (DESIGN-01..04)
11. Composants NEXA, reskin transversal & rebranding — bibliothèque + reskin toutes surfaces + MERA→NEXA + hero + ExpiryBanner (DESIGN-05, BRAND-01..04, UI-01..07)
12. Routines d'analyse Claude planifiées (sans API) — Environment + schedules day/swing + 1 run réel snapshot→analyze→persist (ROUTINE-01..05)
13. Backtest catalogue de patterns — migration source AVANT seed + catalogue figé + packages/backtest réutilisant replayOutcome + Wilson (BACKTEST-01..04)
14. Track record affiché & boucle outcomes en prod — provenance + N visible + bascule N≥30 + outcome-tracker en prod (TRACK-04..06)

**Arêtes critiques v2.1 :**

- Tokens/thèmes/polices (P10) AVANT composants/reskin (P11) ; no-flash + RTL en fondation.
- Config Environment + réseau *.supabase.co (P12) AVANT scheduling ; ANALYZE reste agent-native, persist.ts = seule frontière d'écriture IA.
- Migration source (BACKTEST-01) + catalogue figé (BACKTEST-02) AVANT moteur (BACKTEST-03) et affichage (P14) — inverser corrompt pattern_stats.
- P14 dépend de P12 (signaux réels) ET P13 (seed backtest).
- Research flags : P12 (valider réseau Remote A1) · P13 (figer le catalogue de patterns, décision fondateur).

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

### Decisions exécution (Plan 04-01 — PARTIEL, bloqué checkpoint)

- **D-04-01-A** : golden values base58check **calculées hors-ligne** par double-sha256 (crypto natif) → déterministes/reproductibles, pas une frappe réseau. `address.ts` golden-testé SANS attendre le checkpoint réseau, qui ne concerne que la forme de réponse API (`nile-trc20-transfer.json`), pas la crypto d'adresse.
- **D-04-01-B** : `__fixtures__/GOLDEN.md` créé (golden crypto-locales + section ASSUMED A1-A7) ; `nile-trc20-transfer.json` NON créé (séparation golden déterministes vs fixture réseau).
- **D-04-01-C** : exécution Task 2 (atomic) + Task 3 (address) avant le checkpoint Task 1. Le checkpoint ne bloque que le Plan 04 aval (parseur Zod TronGrid), pas ces deux briques.
- **Commits 04-01** : fc17427 (RED atomic), d1f83bb (GREEN atomic + barrel), b0d8c0a (RED address + GOLDEN.md), b6c9ae3 (GREEN address). 27 tests verts (atomic 17 + address 10). PAY-01/PAY-02 NON marqués complets (plan partiel).

### Decisions exécution (Plan 04-02 — PARTIEL, bloqué checkpoint LIVE apply)

- **D-04-02-A** : `reserveOffset` pose un `tx_hash` placeholder déterministe `reservation:{user_id}:{expected}` à la réservation pré-paiement (la colonne `tx_hash` est `not null`) ; le tx_hash réel arrive via `insertPendingPayment` (Plan 05). La collision 23505 (offset partiel OU tx_hash global) fait avancer l'offset (boucle bornée MAX 999, Open Q1). `expected_amount_atomic` JAMAIS dérivé d'une entrée client (D-05).
- **D-04-02-B** : RPC `activate_subscription_for_payment` = upsert manuel (SELECT plus récent → INSERT/UPDATE) plutôt qu'`ON CONFLICT` (`subscriptions` n'a pas de unique sur `user_id`) ; prolongation D-11 `greatest(coalesce(current_period_end, now()), now()) + p_period`. UPDATE payment gardé `status='pending'` + `row_count=0 → raise` = anti double-activation (idempotence négative).
- **D-04-02-C** : `activateForPayment` caste `client.rpc(...)` localement car la signature de la fonction est ABSENTE de `database.types.ts` tant que Task 2 (gen types LIVE) n'est pas faite — pas de stub de type inventé. Forme d'appel exacte préservée (`rpc('activate_subscription_for_payment', { p_payment_id, p_user_id, p_plan, p_period })`), cast retiré après régénération.
- **Commits 04-02** : 72f49a5 (migration 0012 : table + RLS 1 insert/2 select/0 update-delete + UNIQUE tx_hash GLOBAL + offset partiel + RPC security definer + revoke), eccc956 (repos payments dont reserveOffset/ReplayError + subscriptions dont activateForPayment + barrel + .env TRON). Vérifs statiques : multi-critère 5/5, RLS/RPC count, 11 key-links, `tsc -b --force` vert. PAY-03/04/06 + ADMIN-01/02 NON marqués complets (apply LIVE non franchi).

### Decisions exécution (Plan 04-03 — PARTIEL, bloqué checkpoint vetting QR)

- **D-04-03-A** : `form.tsx` écrit main (registry nova ne le fournit pas en standalone, confirme D-02-01-D). `react-hook-form@7` + `@hookform/resolvers@5` = deps standard shadcn du registry OFFICIEL → vetting NON requis (UI-SPEC Registry Safety). Le SEUL paquet nécessitant vetting argent reste la lib QR (Task 1, checkpoint). Le CLI shadcn a ajouté 7 blocs + `sonner@2` ; form ajouté main au style projet (radix-ui umbrella, cn, data-slot).
- **D-04-03-B** : namespace `admin` mono-FR (back-office `(admin)` hors `[locale]`, UI-SPEC Producer-boundary/D-09) — non soumis à la parité 3 langues. Les tests de parité sont par-namespace → admin FR-only ne casse rien. Namespace `payment` member-facing : 53 clés ×3 à parité RÉCURSIVE stricte (polling.steps.*, errors.*, hash.*, screenshot.*, status.*, expiredGated.*). `pricing` étendu D-12. ICU plural sur expiryBanner.
- **D-04-03-C (Rule 1)** : faux positif `lint:i18n` — `& VariantProps<typeof alertVariants>` (annotation type CVA générée par le CLI dans alert.tsx) lue comme texte JSX par le détecteur regex maison (`&` hors liste ponctuation-code). Neutralisé via `// i18n-ignore` (mécanisme prévu par le script), sans réécrire le composant. Précédent D-02-01-F.
- **D-04-03-D (Rule 2)** : ajout `messages-parity-payment.test.ts` (garde CI parité récursive payment fr/en/ar + sentinelles sous-clés + no-perf VITR-03), cohérent avec messages-parity-legal.test.ts. 4/4 verts.
- **Commits 04-03** : d5b38c8 (8 blocs shadcn + form + sonner/react-hook-form/@hookform/resolvers), 1fc7b9e (i18n payment/admin/pricing D-12 + test parité). Vérifs : script flatten plan 53 clés OK, vitest 4/4, `pnpm typecheck` 0 erreur, `lint:i18n` exit 0, root layout.tsx inchangé. **STOP au checkpoint Task 1** (vetting lib QR, blocking-human). PAY-01/04/05/06 + ADMIN-01/02 NON marqués complets.

### Decisions exécution (Plan 05-01)

- **D-05-01-A** : `realized_r` mesuré EXCLUSIVEMENT sur les prix des candles — gagnant `|tp1-entry|/denom`, perdant `-1`, flat `(close-entry)/denom` (long) / `(entry-close)/denom` (short). JAMAIS via `packages/core/scoring` (anti-pattern RESEARCH : le replay mesure le prix réalisé, pas le score de génération). `denom > 0` par construction.
- **D-05-01-B** : tie-break ambigu D-04 = `distTp <= distSl → hit_tp` (égalité incluse → hit_tp), porté tel quel depuis l'algo figé RESEARCH §Code Examples. Golden-testé (3 sous-branches : TP proche, SL proche, égalité).
- **D-05-01-C** : aucune candle dans la fenêtre (gap de données, A3) → `flat` realized_r 0 (R neutre).
- **D-05-01-D** : `vitest.config.ts` include étendu de `apps/web/src/lib/**/*.test.ts` pour couvrir le chemin de test figé par le frontmatter du plan (RED structurel « No test files found » → GREEN, précédent D-02-03-C).
- **D-05-01-E** : helper `applyThreshold` = union discriminée `{ sufficient:true, winRatePct, n, expectancy, avgR }` | `{ sufficient:false, n }` ; `MIN_SAMPLE=30` (D-09) ; N exposé dans LES DEUX branches (D-12) ; `win_rate` null → winRatePct 0 (jamais NaN). Seuil en couche TS, jamais en DB.
- **Commits 05-01** : 8498a2c (RED golden tests replayOutcome), 084d75f (GREEN replayOutcome + barrel core), a2f5b19 (helper threshold + test + glob). 17 tests neufs verts (11 replay + 6 threshold), `pnpm typecheck` 0 erreur, 0 package npm ajouté. TRACK-01/TRACK-03 (logique pure) couverts ; job + vue + RLS anon = 05-02/05-03.
- **D-05-01-DEFER** : 2 tests d'intégration Supabase rouges (`runJob`/`idempotency`, réseau + `.env.test`) hors scope — loggés `deferred-items.md`, aucun fichier du plan touché.

### Decisions exécution (Plan 05-02)

- **D-05-02-A (A1)** : setups `invalidated` rejoués PLEINEMENT par `replayOutcome` (jamais présumés hit_sl) — le replay décide hit_tp/hit_sl/flat. Sélection job = status IN ('expired','invalidated') AND valid_until < now().
- **D-05-02-B (A2)** : `expectancy` = AVG(realized_r) sur TOUS les trades ; `avg_r` = AVG(realized_r) FILTER WHERE outcome='hit_tp' (R moyen des gagnants). Figé dans la vue `pattern_stats`. N exposé BRUT (D-12), seuil 30 appliqué côté front (threshold.ts 05-01).
- **D-05-02-C (déviation Rule 1)** : la dimension `asset_class` est jointe depuis `public.instruments` (colonne réelle `i.asset_class`) via JOIN, PAS depuis `trade_setups` (le plan référençait `instrument_class`, inexistant sur trade_setups).
- **D-05-02-D (apply LIVE)** : migration 0014 appliquée LIVE via MCP `apply_migration` (JAMAIS db push). Table `prediction_outcomes` (PK setup_id, FK trade_setups on delete cascade, RLS authenticated, AUCUNE policy write → service_role bypass) + vue `pattern_stats` (security_invoker=false, **grant SELECT anon = PREMIÈRE lecture publique du projet**, agrégats SEULEMENT).
- **D-05-02-E (gate sécurité PASS)** : `get_advisors` (security) confirme que `prediction_outcomes` n'est PAS exposé à anon (rls_enabled, authenticated-only select). Le seul nouvel advisor est `security_definer_view` sur `pattern_stats` — INTENTIONNEL (agrège du public via security_invoker=false), NON corrigé. 2 advisors préexistants hors scope (`has_active_subscription`/`is_superadmin`) + WARN leaked-password.
- **D-05-02-F (déviation Rule 3)** : `generate_typescript_types` écrase tout `database.types.ts` et supprime le bloc d'aliases de convenance maintenus à la main (CandleInsert/TradeSetupInsert/ProfileRow/Timeframe…). Réappliqués à la fin du fichier (source = dist/.d.ts précédent) + ajout PredictionOutcome{Row,Insert,Update}. À refaire après chaque régénération.
- **Commits 05-02** : f931623 (RED test idempotence + getCandlesForReplay), 1584c7c (migration 0014 + repos + barrel), 374a5bb (GREEN job outcome-tracker + dispatch), 542a1f7 (apply LIVE + regen types + drop temp casts). outcome-tracker test 2/2 vert (2e run = 0 insert), core replay 11/11 non régressé, `pnpm typecheck` 0 erreur, 0 package npm. **TRACK-01/TRACK-02 complets.** Reste 05-03 (page publique consommant pattern_stats en anon + seuil N≥30).

### Decisions exécution (Plan 06-01)

- **D-06-01-A** : `threshold.ts` (MIN_SAMPLE/applyThreshold + types) déplacé tel quel (contenu IDENTIQUE) en `packages/core/src/track-record/threshold.ts` ; `apps/web/src/lib/track-record/threshold.ts` = re-export mince depuis `@app/core`. Aucun changement de logique → cohérence stricte vitrine ↔ Telegram (D-11). Source unique du seuil pour vitrine P5 ET job Telegram P6.
- **D-06-01-B** : `getPatternStats` porté en `packages/supabase/src/repositories/patternStats.ts`, typé `SupabaseClient<Database>` générique (anon RSC OU service_role job — la vue grant SELECT anon+authenticated, service_role bypass). SELECT EXACT `'dimension, bucket, period, n, win_rate, avg_r, expectancy'`, jamais de throw. Barrel `@app/supabase` exporte `getPatternStats`/`PatternStatRow` (service-client toujours sous garde D-07). Web re-câblé en re-export mince → jobs n'importera jamais apps/web (D-49).
- **D-06-01-C** : disclaimer FR+AR en constantes locales dans `format.ts` (copy P2 `disclaimer.footer` identique, sans promesse de gain, LEGAL-01). Le job en `@app/core` ne peut PAS importer les messages next-intl de `apps/web` (cross-app interdit D-49) → la copy est dupliquée volontairement comme constante du formateur pur.
- **D-06-01-D (Rule 2)** : ajout de l'export barrel `@app/core` pour `formatMessage`/`escapeHtml` + types (non re-listé dans files_modified du plan pour Task 3 mais requis pour que le job P6 importe sans toucher apps/web).
- **D-06-01-E (formatMessage)** : pur zéro I/O, sortie HTML unique parse_mode ; `escapeHtml` ordre `& < >` sur toute donnée dynamique (T-06-INJ) ; bloc FR LTR + bloc AR RTL (RLM préfixe), ticker/R/% isolés U+2066/U+2069 (T-06-BIDI) ; win rate via `applyThreshold` (TG-02/D-11) ; `FormatTrade` limité à symbol+direction+outcome+realized_r — JAMAIS entry/SL/TP (D-03/T-06-LEAK, grep == 0) ; jour vide D-10 ; cap top-10 par |R| + « +X autres », sortie < 4096 (Pitfall 3).
- **Commits 06-01** : 9757fdf (Task 1 threshold→core + re-export web + test golden 8), 882915d (Task 2 getPatternStats→@app/supabase + re-câblage web), 28d8800 (Task 3 formatMessage pur bilingue + 11 tests golden). `npx vitest run` 401 tests verts (53 fichiers, dont core threshold 8 + format 11 ; P5 non régressée), `pnpm typecheck` 0 erreur, 0 package npm. **TG-02/LEGAL-01 couverts.** Reste 06-02/06-03 (job d'envoi grammy + planification + threat verify graphe packages).

### Decisions exécution (Plan 07-02)

- **D-07-02-A (miroir SQL aux bornes plafond)** : `affiliateRateBps` (TS, @app/core) est le miroir bit-à-bit du `case` SQL `affiliate_rate_bps` (0016). La table `TIERS` pose le palier plafond à `minSignups: 50001`, mais le SQL teste `>= 50000 → 2000` → le PARCOURS exécuté garde le seuil à `>= 50000` (50000 ET 50001 → 2000 bps), les deux verrouillés par golden test. TIERS = description d'affichage ; le seuil exécuté fait foi.
- **D-07-02-B (commission BigInt)** : `computeCommissionAtomic(base, bps) = (base * BigInt(bps)) / 10000n` — division entière BigInt (troncature/floor, Q3), zéro float, exact > 2⁵³ (T-07-FLOAT). `grep -c "Number(" tiers.ts == 0` (deux commentaires citant `Number()` reformulés en « coercion vers Number »).
- **D-07-02-C (pureté + chemin)** : `tiers.ts` zéro I/O (aucun import Supabase/fs/http/fetch/server-only), exporté via barrel `@app/core` (miroir threshold/replayOutcome). Tests au chemin imposé `affiliate/__tests__/tiers.test.ts` (sous-dossier `__tests__/`, divergent du pattern `*.test.ts` côté-module mais couvert par le glob `packages/**/*.test.ts`).
- **Commits 07-02** : 4a06c4c (RED 28 golden tests : 17 bornes signups→bps + invariants TIERS + 7 cas commission floor), cd27a0c (GREEN tiers.ts + barrel). `npx vitest run packages/core` 144/144 verts, `pnpm typecheck` 0 erreur, 0 package npm (T-07-SC accept). **AFF-03 (logique pure) couvert.** Source unique grille + commission réutilisable par le dashboard affiliation (07 aval).

### Decisions exécution (Plan 07-03)

- **D-07-03-A (RPC wrappers, zéro calcul JS, T-07-FLOAT)** : `commissions.ts` ne fait qu'invoquer les RPC LIVE `compute_affiliate_commissions` / `mark_commission_paid` — aucun INSERT/SELECT de calcul. `grep -c "Number(" commissions.ts == 0` (commentaires reformulés). Toute l'idempotence (T-07-DOUBLEPAY) et le financier restent en DB.
- **D-07-03-B (CR-02 sur mark_commission_paid)** : la signature générée type `p_amount_atomic: number`, mais la colonne DB est bigint > 2⁵³ → on transmet une **string** (PostgREST caste sans perte) via cast d'argument volontaire (`as unknown as ...Args`), jamais `Number()`. Précédent D-04-02-C.
- **D-07-03-C (attribution best-effort, T-07-ATTR-CRASH)** : `attributeReferral` capture 23505 sur `referrals(user_id)` → idempotent (last-touch joué au cookie, D-11) ; code inconnu/self-ref (D-12) → no-op sans throw → ne casse jamais le signup. Squelette RESEARCH §Code Examples honoré (lookup `affiliate_codes.select('affiliate_id, affiliates!inner(user_id)')`).
- **D-07-03-D (job luxon UTC, T-07-TZ)** : période = `DateTime.utc().toFormat('yyyy-MM')` (`grep -c "new Date(" affiliate-commission.ts == 0`), `argv[3]` validé `^\d{4}-\d{2}$` pour re-calcul. Idempotence portée par le RPC (UNIQUE + on conflict do update where status='due') → re-run du même mois = même total, jamais d'écrasement d'un payé.
- **Commits 07-03** : 26ce2f4 (Task 1 : 4 repos service_role + barrel + 8 tests verts + affiliate-rls.test.ts isolation cross-user), c023314 (Task 2 : job affiliate-commission idempotent luxon UTC + dispatch). `npx vitest run` 457 verts | 4 skip (RLS réseau), `pnpm typecheck` 0 erreur, 0 package npm. D-49 respecté (aucun import apps/web). **AFF-01/02/04/05 complets** (AFF-03 déjà 07-02). affiliate-rls.test.ts (AFF-02) authoré mais GREEN différé réseau (deferred-items.md).

### Decisions exécution (Plan 07-04)

- **D-07-04-A (capture ?ref, Pitfall 2)** : `captureRef(request, response)` inséré comme 3ᵉ étape du middleware composé en MUTANT la response next-intl (jamais `NextResponse.next()` recréée — même invariant que `updateSession`, D-01-03-B). Ordre verrouillé **locale → ref → session** (D-09). Regex `^[A-Z0-9]{3,20}$` validée AVANT pose (anti-injection T-07-REFINJ) ; cookie `aff_ref` httpOnly+secure+sameSite=lax (T-07-COOKIE/A1), `maxAge` 30j (D-09), last-touch (D-10, écrase toujours). 8 tests vitest verts.
- **D-07-04-B (attribution figée au signup, D-11)** : le trigger DB `handle_new_user` (`search_path=''`) ne voit pas le cookie HTTP → l'écriture `referrals` se fait dans `signUp` APRÈS `auth.signUp` réussi, via `attributeReferral(createAdminServiceClient(), …)` (service_role local server-only ; la RLS D-07 interdit l'écriture front). Cookie consommé (`delete('aff_ref')`) une fois. `redirect /paiement-bientot` (D-02-03-B), `signIn`/`signOut`/`toSafeErrorKey` intacts.
- **D-07-04-C (best-effort ABSOLU, T-07-ATTR-CRASH/A2)** : `attributeReferral` enveloppé dans `try/catch` ; échec loggé `console.error` serveur (jamais `console.log`), jamais propagé. Code inconnu / self-ref (D-12, no-op repo) / 23505 idempotent / erreur DB → l'inscription RÉUSSIT toujours et redirige `/paiement-bientot`. E2E `affiliation-attribution.spec.ts` authoré (3 tests, `--list` OK) ; GREEN = human-verify (préconditions deferred-items.md, D-01-04-C). Aucune fuite service_role client (lue via `process.env`, sans `NEXT_PUBLIC_`).
- **Commits 07-04** : f53302e (RED captureRef test), 0169370 (GREEN captureRef + insertion middleware), f066d77 (signUp attribution best-effort + E2E authoré). `npx vitest run` 465 verts | 4 skip, `pnpm typecheck` 0 erreur, `lint:i18n` exit 0, 0 package npm. **AFF-01 bout en bout couvert** (capture ?ref → attribution au signup).

### Decisions exécution (Plan 07-05)

- **D-07-05-A (back-office mono-FR, miroir (admin)/file)** : 2 surfaces superadmin créées hors `[locale]` — `(admin)/affiliation` (revue candidatures) + `(admin)/affiliation/payouts`. 404 non-superadmin via layout `(admin)` (`requireRole('superadmin')` → notFound) ET re-validation `requireRole` en tête de CHAQUE server action (endpoint POST direct, T-07-ADMIN-WRITE). i18n `admin.affiliateQueue.*` + `admin.payouts.*` mono-FR (en/ar non touchés, invariant D-04-03-B ; tests parité par-namespace → admin FR-only ne casse rien). Badges ambre pending/due, neutre approved/paid (jamais vert/rouge D-04, grep green-/red- == 0).
- **D-07-05-B (approbation : résolution email→user_id)** : `affiliate_applications` ne stocke que `applicant_email` (pas de user_id) ; `promoteAffiliate` exige un user_id. `approveApplication` résout l'email → `profiles.id` (ilike) via service_role ; compte inexistant → erreur `NO_ACCOUNT` (le candidat doit déjà avoir un compte, cohérent D-07 pas de self-serve). Puis `promoteAffiliate` (rôle affiliate + affiliates idempotent) + `createCode` (code vanity validé `^[A-Z0-9]{3,20}$` AVANT écriture, CodeTakenError → toast i18n `affiliateQueue.errors.codeTaken`) + `transitionApplication('approved')`. Rejet = `transitionApplication('rejected', {reject_reason})` motif requis (T-07-DESTRUCT).
- **D-07-05-C (payout : vue due+paid, RPC atomique)** : `payCommission` re-valide `requireRole('superadmin')` puis `markCommissionPaid(service_role, {commission_id, tx_hash, amount_atomic})` — RPC `mark_commission_paid` atomique (commission due→paid + insert payouts), anti double-payout porté par la DB. Montant saisi lisible (USDT) → `toAtomic` côté client → **string** atomique côté serveur (CR-02, borne `^[0-9]+$`, jamais Number). La vue affiche due ET paid (déviation Rule 2 vs `loadDue` du plan) pour porter le lien tx_hash → TronScan `target="_blank" rel="noopener noreferrer"` (T-07-EXTLINK) sur les payés ; action « Marquer payé » seulement sur les due. Date de paiement saisie obligatoire UI (D-15) mais horodatage réel = DB (`payouts.paid_at default now()`, le RPC ne prend pas paid_at).
- **Commits 07-05** : 6cfa967 (Task 1 : file de revue page+actions+ApplicationRowActions+i18n), 6fa809b (Task 2 : payouts page+actions+PayoutRowAction). `pnpm typecheck` 0 erreur, `lint:i18n` exit 0, `npx vitest run` 465 verts | 4 skip (non régressé), 0 package npm (T-07-SC accept). **AFF-01 (pose code vanity par superadmin, D-07) + AFF-04 (payout tracé tx_hash, D-15) couverts back-office.** Reste 07-06 (surface 1 candidature `[locale]` trilingue + surface 3 dashboard affilié no-PII).

### Decisions exécution (Plan 08-01)

- **D-08-01-A (TDD logique pure)** : 3 modules purs `lib/admin/{signals,freshness,jobs}.ts` (zéro I/O, aucun import next/@supabase/server-only/fs/fetch) extraits pour être unit-testés sans rendre les RSC (RESEARCH §Wave 0). `signals` = `postedSetupIdSet` (notable: → setup-id Set) + `telegramStatusFor` (2 états posted/unpublished, JAMAIS d'échec persistant, Pitfall 3). `freshness` = `candleColor` (is_stale + bande ambre 1.5× seuil) + `ageColor` + `NEWS_THRESHOLDS` (6h/24h) + `MACRO_THRESHOLDS` (36h/72h), bornes strictement supérieures. `jobs` = `runDurationMs` (null si running/inanalysable) + `latestPerJob` (premier-vu par job_name = plus récent, ordre stable). 33 tests verts (RED prouvé avant GREEN). Le glob vitest `apps/web/src/lib/**/*.test.ts` existait déjà (précédent D-05-01-D) → ZÉRO changement de config.
- **D-08-01-B (déviation Rule 1)** : token `'failed'` retiré des commentaires JSDoc de `signals.ts` (reformulés « état d'échec persistant ») pour satisfaire `grep -c "'failed'" == 0`. La logique était déjà conforme (`TelegramStatus = 'posted' | 'unpublished'`).
- **D-08-01-C (shell admin D-01)** : `(admin)/_components/AdminSidebar.tsx` îlot `'use client'` — `usePathname` prefix-match (l'item `/admin` exact-match pour ne pas rester toujours actif), plain `next/link` (admin HORS `[locale]`, JAMAIS le Link i18n), 7 items ordre D-01, icônes lucide (déjà verrouillé), accent `--primary` réservé à l'actif. `layout.tsx` passé en flex 2 colonnes ; gate `requireRole('superadmin')` + `NextIntlClientProvider` + `Toaster` préservés verbatim, sidebar montée SOUS le gate (T-08-01/02/03 mitigés).
- **D-08-01-D (copy FR centralisée)** : tout le bloc `admin.{nav,dashboard,signals,health,affiliates}.*` ajouté à `fr.json` en une passe (sourcé UI-SPEC §Copywriting Contract) → les plans Wave 2 (08-02/03/04) ne touchent JAMAIS `fr.json` = file-disjoints, parallèles. admin.* mono-FR (en/ar non touchés) ; parité par-namespace 18/18 verte.
- **Commits 08-01** : f3c624a (RED 33 tests admin), 3f4d54b (GREEN 3 modules purs), 93da8d8 (shell sidebar + layout + fr.json). `pnpm typecheck` 0 erreur, `lint:i18n` exit 0, 0 package npm (T-08-SC accept). **Fondation ADMIN-03/04 posée** (vues consommatrices = Wave 2 ; ADMIN-03/04 NON marqués complets tant que 08-02/03/04 ne sont pas livrés).

### Decisions exécution (Plan 08-04)

- **D-08-04-A (affiliés-perfs depuis tables de base, A3)** : `(admin)/affiliation/affilies/page.tsx` lit l'agrégat via `createAdminServiceClient().from('affiliates').select('id, profiles!inner(email), referrals(count), commissions(amount_atomic, status)')` — JAMAIS la vue `affiliate_dashboard` (security_invoker + auth.uid()-scoped → VIDE sous service_role, décision 4). Somme par affilié en JS : `referralCount` brut, `commissionsDueAtomic`/`commissionsPaidAtomic` cumulés en **BigInt** par statut, affichés via `formatAtomic` (CR-02, jamais coercion flottante). Tri par dues décroissantes. RSC pur, aucune mutation, aucun `requireRole` inline (gate au layout (admin)). Lien header → `/admin/affiliation/payouts`. Aucune nouvelle clé fr.json (réutilise `admin.affiliates.*` de Plan 01).
- **D-08-04-B (déviation Rule 3 — grep-gates littéraux)** : commentaires reformulés (« jamais Number() » → « jamais coercé en flottant », « affiliate_dashboard » → « la vue agrégée par-utilisateur », « requireRole('superadmin') » → « garde superadmin ») pour satisfaire `grep -c` == 0 sur ces tokens. Logique déjà conforme. Précédent D-07-02-B / D-07-03-A / D-08-01-B.
- **D-08-04-C (E2E admin-gate déroulé, T-04-ADMIN-ELEV)** : `gating.spec.ts` ACCESS-03b — 6 `test()` explicites (déroulés, pas de boucle, pour ≥6 `toBe(404)` littéraux) couvrant `/admin/signaux`, `/admin/signaux/[id]` (id UUID concret), `/admin/sante` × {non-auth, auth-non-superadmin}. Toutes assertions `toBe(404)`, jamais 200/redirect/403 (l'existence du back-office ne fuit pas). Additif seul (ACCESS-03 + helpers `signUp`/`uniqueEmail` intacts). `--list` OK (12 tests). Exécution LIVE = human-verify (SKIP env-gated, convention live-infra D-01-04-C).
- **D-08-04-D (payouts intacte — D-09/D-10 zéro DB-work)** : `git diff --quiet apps/web/src/app/(admin)/affiliation/payouts/` exit 0 confirmé. La page payouts existante rend toujours due+paid + lien TronScan et marque payé via RPC `mark_commission_paid` ; atteignable depuis la sidebar (Plan 01) et liée depuis affilies. Aucune migration (schéma payouts déjà en 0016).
- **Commits 08-04** : 89a8564 (feat affiliés-perfs page), 4218941 (test E2E ACCESS-03b 404). `pnpm tsc --noEmit` 0 erreur, `lint:i18n` exit 0, `npx vitest run` 507 verts | 4 skip (non régressé), 0 package npm (T-08-SC accept). **ADMIN-03 + ADMIN-04 complets. Phase 08 COMPLETE (4/4 plans).**

### Decisions exécution (Plan 10-01 — Wave-0 validation)

- **D-10-01-A (voie A PATTERNS)** : 5 portes de validation Phase 10 créées AVANT toute implémentation. Les 3 tests Vitest vivent sous `apps/web/src/styles/__tests__/` (déjà couvert par le glob existant `apps/**/__tests__/**/*.test.ts`) ; le glob `include` de `vitest.config.ts` est ÉLARGI d'une SEULE entrée `apps/web/tests/**/*.test.ts` (parité/futur) — les 6 entrées existantes + `globals: false` préservés (T-10-01). Les 2 specs Playwright vont sous `apps/web/tests/` (collectées as-named par `testMatch tests/**/*.spec.ts`).
- **D-10-01-B (RED prouvé par la collecte, T-10-02)** : `design-tokens.test.ts` (3/4 RED : oklch absent, --nexa-green-500 absent, #1E5FBF présent ; la 4e — @theme inline = var() only — GREEN car v2.0 mappe déjà en var()) + `fonts.test.ts` (5/5 RED) échouent par ASSERTION contre v2.0, pas par erreur de collecte (3 Test Files, 11 tests parsés). `rtl-logical-props.test.ts` GREEN (garde de non-régression : layout.tsx utilise ms-/me-).
- **D-10-01-C (déviation Rule 1 — parser oxc)** : la séquence littérale `*/` dans un commentaire JSDoc (`--color-*/--font-*`) cassait le transform oxc/Vitest (`PARSE_ERROR`, faux RED par collecte échouée) → reformulée en « valeurs de couleur et de police ». Vrai RED d'assertion rétabli.
- **D-10-01-D (specs Playwright créées, GREEN déféré)** : `no-cdn-fonts.spec.ts` (interception `page.on('request')` zéro Google Fonts) + `no-flash.spec.ts` (thème stocké `dark` via `addInitScript` → `<html class=dark>` fr/en/ar) PARSENT et apparaissent dans `playwright test --list` (4 tests). GREEN déféré au merge wave 02/03 (dev server :3000 requis), conforme au plan.
- **D-10-01-E (requirements NON marqués complets)** : DESIGN-01..04 restent `Pending`/`[ ]` dans REQUIREMENTS.md — ce plan ne crée que les portes RED, l'implémentation (tokens OKLCH, fonts self-hostées, no-flash) est portée par les plans 10-02/10-03. Le marquage auto du SDK a été réverté.
- **Commits 10-01** : d25f577 (3 gardes Vitest + glob élargi), 3563199 (2 specs Playwright). `npx vitest run apps/web/src/styles/__tests__` = 3 fichiers collectés, 8 RED + 3 GREEN ; `npx playwright test --list` = 4 tests listés ; 0 package npm. **5 portes Wave-0 posées.** Reste 10-02 (fonts) + 10-03 (tokens) à exécuter contre ces gardes.

### Decisions exécution (Plan 10-02 — fonts NEXA self-hostées)

- **D-10-02-A (déviation Rule 3 — paquet Noto absent)** : le plan supposait `@fontsource/noto-sans-arabic` déjà installé ; en réalité seul `@fontsource/ibm-plex-sans-arabic` (ancien D-01) était présent. Provenance vérifiée (`npm view` → 5.2.10, `scripts.postinstall` vide, org Fontsource déjà approuvée au gate supply-chain Task 0) puis `pnpm --filter web add -D @fontsource/noto-sans-arabic`. Pas un install ambigu : paquet officiel attendu, dans le périmètre du checkpoint approuvé (Noto = remplaçant IBM Plex).
- **D-10-02-B (sourcing)** : .woff2 sources résolus sous `apps/web/node_modules/@fontsource/<name>/files/<name>-<subset>-<weight>-normal.woff2` (résolution pnpm par workspace, PAS à la racine). 10 fichiers copiés aux noms cibles exacts (latin 400/600 ×4 latines + arabic 400/600 Noto), 2 IBM Plex orphelins supprimés.
- **D-10-02-C (Pitfall 4)** : Noto en subset `arabic` — `NotoSansArabic-Regular.woff2` = 48 KB (≫ fichier latin ~15 KB), confirme le bon subset (pas de boîtes □□□).
- **D-10-02-D (no-CDN vérifié live, dépasse le déféré)** : `lib/fonts.ts` réécrit en 5 exports `next/font/local` (zéro `next/font/google`), `[locale]/layout.tsx` injecte les 5 `.variable` sur `<body>`. `fonts.test.ts` GREEN 5/5, `tsc --noEmit` 0 erreur. `no-cdn-fonts.spec.ts` exécuté contre serveur dev :3000 réel → 0 requête Google Fonts (GREEN runtime, pas seulement --list). DESIGN-02 (volet build/exposition + runtime no-CDN) couvert.
- **Commits 10-02** : b5efb9b (10 .woff2 + 5 @fontsource devDeps + drop IBM Plex), 863dd7c (fonts.ts 5 familles + layout.tsx injection). **Reste 10-03 (tokens OKLCH) gaté par design-tokens.test.ts.**

### Decisions exécution (Plan 10-03 — tokens OKLCH NEXA 3 couches)

- **D-10-03-A (déviation Rule 1 — HEX en commentaire)** : `design-tokens.test.ts` scanne TOUT le fichier (valeur ET commentaire). Les HEX de marque (#03d87f, #63279b, #1E5FBF) placés dans mes commentaires de doc faisaient échouer l'assertion (3) bien que la couche sémantique soit 100% OKLCH. Retiré ces HEX des commentaires (gardé hue OKLCH + noms de var). Intention de la garde (zéro HEX de marque obsolète) respectée.
- **D-10-03-B (rampe neutre)** : rampe neutre OKLCH chroma ~0.02 hue ~265 (navy-teinté, cohérent avec l'ink NEXA hue 269) pour card/secondary/muted/border/input — plutôt que gris pur. Discrétion Claude (CONTEXT §Claude's Discretion).
- **D-10-03-C (--destructive résout Unknown #6)** : `--destructive` repointé sur `--nexa-signal-bear` (rouge réel). Avec des signaux dédiés (D-05), plus besoin de garder `--destructive` neutre comme en v2.0 (ancien D-04 v2.0).
- **D-10-03-D (body font, anti var orpheline)** : body repointé sur `var(--font-sans)` (= Space Grotesk via @theme inline, D-02) plutôt que recréer `--font-latin`. Évite un fallback system-ui silencieux dû à une var orpheline (RESEARCH §Runtime State Inventory). Aucune occurrence de `--font-latin`/`--font-inter`/`--font-ibm-plex-arabic` résiduelle.
- **D-10-03-E (3 couches / D-05)** : @theme = primitives theme-indépendantes ; :root/.dark = sémantique (seule couche qui flippe) ; @theme inline = component, noms shadcn inchangés, var() only (anti-Pitfall 3). `--primary` = brand green (jamais un signal), signaux trading `--signal-bullish`/`--signal-bearish` exposés à part, définis une seule fois en :root (même teinte dans les 2 thèmes). Règle D-05 documentée en commentaire CSS.
- **Commits 10-03** : 56be63d (Task 1 — primitives OKLCH + sémantique repointée light/dark, design-tokens GREEN 4/4), f15fa97 (Task 2 — body→Space Grotesk, base layer logique préservé, rtl-logical-props GREEN). `tsc --noEmit` exit 0. **DESIGN-01/03/04 couverts ; Phase 10 ready for verification.**

### Decisions exécution (Plan 11-01 — tokens component purple accent & amber risque)

- **D-11-01-A** : `--risk-moderate` GARDE sa teinte amber dans les deux thèmes (un risque modéré reste ambre clair/sombre) → déclaré une SEULE fois en `:root`, NON redéclaré en `.dark` (même invariant que `--signal-bullish/bearish`). `--accent-brand` au contraire flippe : `var(--nexa-purple-500)` light -> `var(--nexa-purple-400)` dark (éclairci), repointant sur une primitive dédiée existante de Phase 10.
- **D-11-01-B** : var()-only strict hors couche 1 — aucun littéral OKLCH/HEX introduit dans `:root`/`.dark`/`@theme inline` (Pitfall 3 : un littéral casserait silencieusement le flip `.dark`). Seule la primitive amber absente était à ajouter (`--nexa-amber-500: oklch(0.7686 0.1647 70.08)`, hue 70, distinct du brand hue 155 et des signals hue 27/149). Le purple primitive existait déjà (Phase 10), non dupliqué.
- **Commits 11-01** : 54cc3b1 (Task 1 — 5 tokens en 3 couches : primitive amber + 2 sémantiques :root + 1 override .dark + 2 component). Task 2 = garde RTL fondation Phase 10 re-validée verte (2/2, exit 0), aucun fichier modifié. grep multi-critère 7 occurrences. **DESIGN-05 couvert ; tokens consommables par Eyebrow/ScoreRing/ExpiryBanner en Wave 2.**

### Decisions exécution (Plan 11-03 — recoloration HEX/amber résiduels → tokens NEXA)

- **D-11-03-A** : lightweight-charts ne lit PAS les CSS vars (canvas). Couleurs résolues via `getComputedStyle(containerRef).getPropertyValue('--token')` au montage, puis re-coloration au flip de thème par un `MutationObserver` sur la classe de `document.documentElement` (toggle `.dark`) qui relit les tokens et appelle `series.applyOptions` + `priceLine.applyOptions`. Choisi plutôt que `resolvedTheme` de next-themes en dépendance du `useEffect` (évite un remount complet du chart à chaque toggle ; recoloration in-place plus fluide). Refs des price lines (entry/SL/TP) conservées en variables locales du `useEffect` pour les re-colorer sans recréer le chart. `themeObserver.disconnect()` ajouté au cleanup.
- **D-11-03-B** : mapping couleur figé — UP/TP → `--signal-bullish`, DOWN/SL → `--signal-bearish`, entrée → `--foreground` (neutre). Les `--signal-*` gardent leur teinte aux 2 thèmes (perte = rouge partout) ; `--foreground` flippe → l'entrée s'éclaircit en dark. SignalCard direction passe aux mêmes tokens (`bg/text-[var(--signal-*)]`), variantes `dark:` manuelles supprimées (le token flippe seul). Bloc score reste neutre `text-primary` (D-03).
- **D-11-03-C** : variante `warning` ajoutée à `alertVariants` consommant `var(--risk-moderate)` (amber component-layer 11-01) — zéro littéral `amber-*`/couleur Tailwind nommée. ExpiryBanner passe à `variant="warning"`, logique J-3/J-1 + ICU + CTA intacts. **UI-07 NON marqué complet** : seule la tokenisation `warning` est livrée ici ; le câblage in-app (WIRING-01/PAY-05) est traité en 11-08. UI-03/DESIGN-05 moitié couleur livrée (CandleChart + SignalCard flip-safe). Frontière RLS serveur intacte (aucun `createClient/from(/supabase` ajouté, grep=0).
- **Commits 11-03** : 51eb874 (Task 1 CandleChart recolor + theme-flip), 571b9c5 (Task 2 SignalCard direction tokens), 67568b3 (Task 3 variante warning alert + ExpiryBanner). Greps acceptance : HEX=0, amber=0, getPropertyValue/applyOptions/MutationObserver présents. RTL test 3/3, `tsc -b --noEmit` 0 erreur sur les 4 fichiers.

### Decisions exécution (Plan 11-05 — rebranding NEXA visible + metadata)

- **D-11-05-A** : header `[locale]/layout.tsx` — span « Vétéran Trading » → `<Logo variant="full">` + baseline `t('baseline.text')` rendue SOUS le wordmark via `getTranslations('baseline')` dans le RSC (D-16/D-17, ton sobre vétéran zéro hype). `ms-6`/`ms-auto`/ThemeToggle/LanguageSwitcher/slot Footer/`<html lang dir>` unique intacts ; commentaire i18n-ignore retiré. Footer rend `<Logo variant="full">` + Disclaimer + nav légale préservés.
- **D-11-05-B** : `app/layout.tsx` metadata NEXA (title/description neutres éducatifs sans promesse de gain, `metadataBase` via `NEXT_PUBLIC_SITE_URL` precedent sitemap.ts, `openGraph` type website) ; root reste pass-through (aucun html, Pitfall 7). 3 metadata files racine via next/og natif next@15 (aucun package) : `icon.tsx` 32×32, `apple-icon.tsx` 180×180, `opengraph-image.tsx` 1200×630 — paths SVG exacts du mark Logo, dégradé marque #03d87f→#63279b sur fond ink #0a0e1a ; OG ajoute wordmark + baseline. Asset statique authored (T-11-OG-XSS), zéro % (T-11-LEGAL).
- **D-11-05-C** : `fr.json:210` `MERA2026`→`NEXA2026` + `dashboard.title` fr/en/ar Vétéran/Veteran Trading→NEXA. Une seule édition codePlaceholder (namespace admin mono-FR, D-04-03-B ; pas d'équivalent en/ar). no-mera-brand.test.ts GREEN (scan apps/web/src zéro MERA/slogan).
- **Commits 11-05** : 1d0aed1 (Task 1 Logo+baseline header/footer), 0009f9d (Task 2 metadata NEXA + favicon/apple-icon/OG next/og), f46ed09 (Task 3 MERA2026→NEXA2026). Vérifs : no-mera-brand 2/2, no-perf-claims 4/4, `tsc -b --noEmit` exit 0, 0 package npm. BRAND-01/02/03 livrés.

### Decisions exécution (Plan 11-07 — hero animé greenfield UI-02)

- **D-11-07-A** : CTA hero primaire → `/methodologie` (« Découvrir la méthode » éducatif, route existante), secondaire → `/tarifs` (« Voir les tarifs ») ; namespace i18n `hero` dédié. L'ancien `home.heroCta`/`heroTitle`/`heroLede` reste dans le JSON (non supprimé, hors scope) mais n'est plus rendu — la home rend `<Hero />`.
- **D-11-07-B** : fond ink FIXE `style={{ backgroundColor: 'var(--nexa-ink)' }}` + texte forcé `text-white`/`text-white/70` (D-04) — seule surface où le texte ne suit pas les tokens de thème (justifié par le fond cyber figé theme-indépendant). Globe/data-rain CSS-only gardés `@media (prefers-reduced-motion: no-preference)` ; tilt vanilla TS gardé `matchMedia('reduce')` return AVANT `addEventListener` (Pitfall 2). Zéro lib tierce (grep `three|gsap|framer-motion`=0, D-05).
- **D-11-07-C** : cartes anonymisées via i18n `hero.cards` (jamais DB) — instrument·direction·score·risque, ZÉRO % (D-01) ; `ScoreRing` (11-04) couleur=risque jamais « vert=gagnant » (D-12). Faux positifs de grep neutralisés (commentaire HeroTilt + tolérances obsolètes no-perf-claims/rtl-logical-props + commentaire Marquee) — précédent D-11-04-C.
- **Commits 11-07** : ee64a29 (Task 1 globe+data-rain CSS-only), adb3f87 (Task 2 cartes+tilt+i18n hero), e8ced78 (Task 3 Hero composé + câblage home), b17c1fc (SUMMARY). Vérifs : no-perf-claims 5/5, rtl-logical-props 3/3, suite web 177/177, `tsc -b --noEmit` exit 0, 0 package npm. UI-02/DESIGN-05/BRAND-04 livrés.

### Open todos / research flags (v2.0)

- **Phase 4 (research flag) :** TronGrid endpoint `walletsolidity`, parsing logs TRC-20, normalisation hex↔base58 — doc TS peu dense, recherche de phase recommandée.
- **Phase 5 (research flag) :** critère de succès d'un setup (TP1 ? TP2 ? fenêtre temporelle ?) — décision produit à trancher avant implémentation de `outcome-tracker`.
- **Phase 2 (gate non-code) :** revue juridique conseil non agréé + statut crypto Algérie/MENA — à lancer en parallèle, bloque l'encaissement Phase 4.
- **Prérequis hors code Phase 4 :** cold wallet opérationnel + watcher lecture seule.
- **Reporté v1.0 → ops :** configurer routines planifiées Claude + 1 run réel du moteur (checkpoint 04-04, hors roadmap v2.0).

### Blockers

- **B-04-03 (checkpoint vetting lib QR, human-verify blocking-human)** : Task 1 de 04-03 non franchie. C'est l'UNIQUE nouveau paquet npm de la phase (ASSUMED A9), entrant dans le **bundle client d'une phase tout-l'argent** → légitimité NON auto-approuvable. `pnpm add` de la lib QR NON exécuté. Candidat nommé : `qrcode` (toString/SVG) OU micro-lib SVG pure. À vérifier par un humain AVANT install : (1) npmjs.com — âge/downloads/repo/dernière publication ; (2) `npm view <qr-lib> scripts.postinstall` (aucun postinstall) ; (3) rendu 100% OFFLINE (zéro fetch/CDN/télémétrie) ; (4) encode UNIQUEMENT l'adresse publique TRON. Après approbation : `pnpm --filter web add <qr-lib>`, épingler la version. Resume-signal : `approved: <nom-lib>@<version>` + verdict, OU repli SVG QR maison. Tasks 2+3 (8 blocs shadcn + i18n) déjà livrées (d5b38c8, 1fc7b9e). Ne PAS marquer 04-03 complet avant le vetting QR.

- **B-04-02 (checkpoint LIVE apply, owned orchestrateur)** : Task 2 de 04-02 non franchie. La migration `supabase/migrations/0012_payments.sql` existe (72f49a5) mais n'est PAS dans la base live. À exécuter par l'orchestrateur via MCP (PAS `supabase db push`) après confirmation humaine : (1) `apply_migration` name `0012_payments` ; (2) `generate_typescript_types` → `packages/supabase/src/database.types.ts` (ajouter `payments` Row/Insert/Update + fonction `activate_subscription_for_payment` dans `Functions`) ; (3) `list_tables` (confirmer payments + UNIQUE tx_hash + RLS + RPC) ; (4) `get_advisors` security (WARN security-definer RPC = EXPECTED, non bloquant) ; (5) re-run `pnpm typecheck`. Les repos compilent contre les types actuels mais ne sont pleinement type-safe qu'après régénération. Aucun stub de type fabriqué (interdit). Resume-signal : `applied` + sortie list_tables/get_advisors.
- **B-04-01 (checkpoint réseau, bloque Plan 04 aval)** : Task 1 de 04-01 non franchie. Aucune clé TronGrid provisionnée (pas de `apps/web/.env`, aucune entrée `TRON-PRO-API-KEY`/`TRON_*` dans les `.env.example`) et accès réseau TronGrid Nile indisponible. À fournir par ops (hors-code) : (1) clé TronGrid tier gratuit, (2) une vraie TX USDT-test Nile confirmée, (3) coller la réponse JSON brute dans `packages/data-sources/src/trongrid/__fixtures__/nile-trc20-transfer.json`, (4) confirmer A1-A7 dans `GOLDEN.md` (champs API, `only_confirmed`/`contract_address`, header, `decimals===6`, contrat USDT **Nile**, seuil de confirmations). Aucune fixture/golden API fabriquée (interdit). Resume-signal : `approved` + fixture collée.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260617-547 | Fix bug cap 1000 lignes PostgREST dans readClosedCandles (technical-engine) — snapshots techniques gelés sur données périmées | 2026-06-17 | ced206c | [260617-547](./quick/260617-547-corriger-le-bug-du-cap-1000-lignes-dans-/) |
| 260617-j1a | combine-engine (TROU #2) — assemble snapshots technical/fundamental/news en kind='combined' (latest-par-kind, ancré sur computed_for_ts technical, triplet incomplet→skip), hash réutilisé, upsert idempotent, dispatch | 2026-06-17 | 499d3f5 | [260617-j1a](./quick/260617-j1a-combine-engine/) |
| 260617-nsh | Déblocage build prod Next 15/Vercel (apps/web) : dynamic(ssr:false)→wrapper Client, build webpack + résolution imports .js des packages TS-source, @app/data-sources dans transpilePackages, +~50 erreurs de type purgées (frontière argent bigint number→string type-only, lib QR guards, exactOptionalPropertyTypes) — tsc 0 err, next build webpack OK (44/44 pages), 419 tests verts, security-review RAS | 2026-06-17 | c6868d9 | [260617-nsh](./quick/260617-nsh-fix-web-prod-build/) |
| 260617-sy5 | Retrait du disclaimer LEGAL-01 par message Telegram (formatMessage) — D-06 RÉVISÉE : disclaimer porté par la DESCRIPTION du canal (persistante), messages = titre + trades + ligne taux de réussite ; golden tests inversés (.not.toContain) + test « ligne taux toujours présente », garde-fous bidi/seuil/escapeHtml/no-niveaux intacts — 421 tests verts, typecheck 0, LEGAL-01 toujours satisfait | 2026-06-17 | 9b797ab | [260617-sy5](./quick/260617-sy5-tg-no-disclaimer-msg/) |

## Session Continuity

**Last session:** 2026-06-21T14:59:28.131Z

**Last session (archive):** 2026-06-19T03:41:29.665Z

**Last session (archive):** 2026-06-18T02:30:00.000Z — Plan 07-02 COMPLETE (grille de paliers + commission BigInt en logique pure @app/core, AFF-03). TDD : 4a06c4c (RED — 28 golden tests, module `../tiers.js` absent) → cd27a0c (GREEN — `tiers.ts` pur + barrel). `affiliateRateBps(signups)` miroir bit-à-bit du `case` SQL `affiliate_rate_bps` (0016 LIVE) : 17 bornes verrouillées (0/1/99/100/500/501/600/1000/1001/5000/5001/10000/10001/25000/25001/50000/50001), seuil plafond gardé à `>= 50000` pour matcher le SQL (D-07-02-A). `computeCommissionAtomic(base, bps) = (base * BigInt(bps)) / 10000n` floor BigInt zéro float (T-07-FLOAT, D-07-02-B), exact > 2⁵³. `TIERS` (8 paliers) + type `Tier` exportés du barrel. Pureté : zéro I/O (grep imports Supabase/fs/http/fetch == 0), `grep -c "Number(" == 0`. `npx vitest run packages/core` 144/144 verts (28 neufs), `pnpm typecheck` 0 erreur, 0 package npm. Source unique grille + commission réutilisable par le dashboard affiliation. Stopped at : Plan 07-02 terminé.

**Last session (archive):** 2026-06-17 — Plan 06-01 COMPLETE (socle partagé + formateur Telegram bilingue, TG-02/LEGAL-01). Task 1 (9757fdf, TDD) : threshold.ts déplacé tel quel en @app/core (source unique seuil N≥30 vitrine ↔ Telegram, D-11), web re-exporte, test golden 8 vert. Task 2 (882915d) : getPatternStats porté en @app/supabase (client générique anon|service_role, SELECT agrégats exact, jamais de throw), web re-câblé en re-export, suite P5 non régressée — jobs n'importera jamais apps/web (D-49). Task 3 (28d8800, TDD) : formatMessage pur bilingue FR+AR — escapeHtml ordre & < > (T-06-INJ), bloc FR LTR + AR RTL préfixé U+200F, ticker/R/% isolés U+2066/U+2069 (T-06-BIDI), win rate via applyThreshold (TG-02/D-11), disclaimer FR+AR copy P2 chaque sortie (LEGAL-01), FormatTrade sans niveaux entry/SL/TP (D-03/T-06-LEAK grep==0), jour vide D-10, cap top-10 |R| + « +X autres » < 4096 (Pitfall 3), 11 tests golden verts. Déviation Rule 2 : export barrel core formatMessage/escapeHtml. npx vitest run 401 tests verts (53 fichiers), pnpm typecheck 0 erreur, 0 package npm. Stopped at : Plan 06-01 terminé.

**Last session (archive):** 2026-06-16 — Plan 05-02 COMPLETE (pipeline de données track record, TRACK-01/02). Migration 0014 appliquée LIVE via MCP : table prediction_outcomes (PK setup_id, FK trade_setups cascade, RLS authenticated, 0 policy write → service_role bypass) + vue pattern_stats (security_invoker=false, **grant SELECT anon = première lecture publique du projet**, agrégats only). Job outcome-tracker GREEN idempotent 2 niveaux (getResolvedSetupIds + UNIQUE setup_id onConflict ignoreDuplicates), enregistré dispatch, tracé runJob. Repos insertOutcomes/getResolvedSetupIds + getCandlesForReplay (H1 borné anti look-ahead). A1 (invalidated rejoués pleinement) + A2 (expectancy tous / avg_r gagnants) honorés. get_advisors PASS (prediction_outcomes inaccessible anon ; security_definer_view sur pattern_stats = intentionnel). Commits f931623/1584c7c/374a5bb/542a1f7. Déviations : asset_class joint depuis instruments (Rule 1), aliases database.types.ts réappliqués post gen-types (Rule 3). Tests : outcome-tracker 2/2, core replay 11/11, typecheck 0 erreur, 0 npm. Stopped at : Plan 05-02 terminé.

**Last session (archive):** 2026-06-16 — Plan 05-01 COMPLETE (cœur déterministe pur, zéro I/O). TDD : 8498a2c (RED golden tests replayOutcome) → 084d75f (GREEN replayOutcome pur + barrel core, types Outcome/ReplaySetup/ReplayCandle) ; a2f5b19 (helper applyThreshold seuil N≥30 + test + extension glob vitest apps/web/src/lib/**). replayOutcome : first-touch H1 (D-01/D-03), règle distance D-04 (tie ≤ = hit_tp), flat D-02 au close ≤ valid_until (long ET short), R sur prix candles jamais via scoring. applyThreshold : MIN_SAMPLE=30, N exposé dans les 2 branches (D-12), win_rate null → 0 (pas de NaN). 17 tests neufs verts (11 replay + 6 threshold), typecheck 0 erreur, 0 package npm. TRACK-01/TRACK-03 (logique pure) couverts ; job outcome-tracker + vue pattern_stats + RLS anon = 05-02/05-03. 2 tests d'intégration Supabase rouges hors scope (réseau, deferred-items.md). Stopped at : Plan 05-01 terminé.

**Last session (archive):** 2026-06-15 — Plan 04-03 PARTIEL (bloqué checkpoint vetting lib QR B-04-03, human-verify). Couche présentation paiement livrée hors lib QR : Task 2 (d5b38c8) 8 blocs shadcn — 7 via CLI officiel radix-nova (table/textarea/sonner/tabs/alert/alert-dialog/progress) + form.tsx écrit main (react-hook-form 7 + @hookform/resolvers 5, absent registry nova standalone D-02-01-D) ; sonner@2 dep ; existants intacts ; root layout.tsx inchangé (Pitfall 7). Task 3 (1fc7b9e) namespace payment 53 clés ×3 parité RÉCURSIVE stricte (polling.steps.*/errors.*/hash.*/screenshot.*/status.*/expiredGated.*, ICU plural expiryBanner, copy = 04-UI-SPEC) + namespace admin mono-FR + pricing D-12 + test messages-parity-payment.test.ts (4/4). Vérifs : flatten plan 53 clés OK, vitest 4/4, typecheck 0 erreur, lint:i18n exit 0. Rule 1 : i18n-ignore sur faux positif annotation CVA alert.tsx. **STOP au checkpoint Task 1** : lib QR = unique paquet npm vetté (bundle client phase argent), NON auto-approuvable → pnpm add non exécuté. PAY-01/04/05/06 + ADMIN-01/02 NON marqués complets. Stopped at : checkpoint vetting QR B-04-03.

**Last session (archive):** 2026-06-15 — Plan 04-02 PARTIEL (bloqué checkpoint LIVE apply, owned orchestrateur). Écrit migration 0012_payments.sql (72f49a5) : table payments + RLS producteur-unique (1 insert pending+self / 2 select self+superadmin / 0 update-delete) + UNIQUE(tx_hash) GLOBAL anti-replay + index unique partiel offset D-05 + RPC atomique activate_subscription_for_payment security definer + revoke execute (A8). Écrit repos service_role (eccc956) : payments.ts (reserveOffset montant unique serveur boucle 23505, insertPendingPayment 23505→ReplayError, getByHash, transitionPayment, OFFSET_RESERVATION_MINUTES=60) + subscriptions.ts (activateForPayment via RPC castée D-04-02-C, expireDue, changePlan) + barrel + .env.example (TRONGRID/USDT/TRON vars sans valeurs). Vérifs : multi-critère 5/5, RLS/RPC count, 11 key-links, tsc -b --force vert. **STOP au checkpoint Task 2** : apply_migration LIVE + gen types réservés à l'orchestrateur (jamais db push). PAY-03/04/06 + ADMIN-01/02 NON marqués complets. Stopped at : checkpoint LIVE apply B-04-02.

**Last session (archive):** 2026-06-15 — Plan 04-01 PARTIEL (bloqué checkpoint réseau). Exécuté les 2 tâches déterministes en TDD : atomic.ts BigInt zéro-float (fc17427 RED, d1f83bb GREEN, 17/17, 9.02→9020000n) et address.ts base58check TRON sans tronweb (b0d8c0a RED + GOLDEN.md, b6c9ae3 GREEN, 10/10, checksum corrompu→throw). Golden values base58 calculées hors-ligne par double-sha256 (déterministes, pas inventées). **STOP au checkpoint réseau Task 1** : aucune clé TronGrid ni TX Nile réelle → `nile-trc20-transfer.json` NON fabriqué (interdit). PAY-01/PAY-02 NON marqués complets. tsc sans nouvelle erreur. Stopped at : checkpoint réseau B-04-01, en attente de la fixture TronGrid Nile réelle.

**Last session (archive):** 2026-06-15 — Completed 03-01-PLAN.md (segment final). Task 1 (2dde589) + Task 2 (e8df555, migration 0011 appliquée live via MCP) faits par exécuteurs précédents ; ce segment a confirmé que les types Supabase n'ont pas besoin de régénération (0011 = replica identity + publication + RLS candles, aucune colonne) puis exécuté Task 3 en TDD : 5a70533 (RED searchParams), 26a3c41 (GREEN searchParams + format + QueryProvider + i18n fr/en/ar). Vérifs : vitest 10/10, parité i18n OK, `pnpm typecheck` 0 erreur, `lint:i18n` exit 0. Décision RLS candles = ALIGN. **Plan 03-01 COMPLETE (socle DB + plumbing).** Stopped at : Plan 03-01 terminé.

**Last session (archive):** 2026-06-14 — Completed 02-03-PLAN.md (4 commits : 38c1894 tarifs 9$/3$ + paiement-bientot + funnel signup→paiement-bientot, 86e7001 home bénéfice-first + proof slot masqué, 49ac57e RED no-perf-claims, fa8a5d0 GREEN glob vitest). Cœur conversion de la vitrine livré : home VITR-01, tarifs VITR-02 (USDT TRC-20, D-10/D-11/D-12), funnel honnête D-09, garde no-perf-claims VITR-03/D-08. 15 tests verts, tsc/lint:i18n OK, invariant auth P1 intact. **Phase 02 COMPLETE (3/3 plans).** Stopped at : Plan 02-03 terminé.

**Next action:** Phase 10 — Plan 10-03 (tokens OKLCH). Migrer `globals.css` des HEX de marque obsolètes (#1E5FBF/#03d87f/#63279b) vers la palette OKLCH NEXA (`--nexa-green-500` etc.), `@theme inline` = var() only, repointer `--font-latin`/`--font-arabic` vers les 5 nouvelles variables `--font-*` exposées en 10-02. Cible GREEN : `design-tokens.test.ts` (4 assertions, 3 actuellement RED). 10-02 COMPLETE (b5efb9b/863dd7c) : 5 polices NEXA self-hostées, `fonts.test.ts` GREEN 5/5, `no-cdn-fonts.spec.ts` GREEN runtime. `rtl-logical-props.test.ts` + `no-flash.spec.ts` = gardes de non-régression à préserver.

**Next action (archive):** Milestone v2.1 — roadmap créée (5 phases, 10-14). Lancer la planification de **Phase 10 (Fondation design system NEXA, DESIGN-01..04)** via `/gsd-execute-phase 10`. Axe design (P10-11) parallélisable contre routine+backtest (P12-13). Research flags à lever au planning : P12 (réseau Remote *.supabase.co, Open Q A1) et P13 (figer le catalogue de patterns — décision fondateur Borhane). Dette héritée v2.0 traitée : WIRING-01/ExpiryBanner → Phase 11 (UI-07). Hors scope v2.1 : LEGAL-02, PAY-AUTO, AFF-AUTO, ENGINE-API.

**Next action (archive):** Phase 08 COMPLETE (4/4 plans) — ADMIN-03/04 couverts. Lancer la vérification de phase (`/gsd:verify-phase 08`) puis Phase 09 (CMS cours & articles vulgarisés, CMS-01/02). En suspens hérité : Phase 04 (04-03 vetting lib QR B-04-03, 04-02 LIVE apply B-04-02, 04-01 fixture TronGrid B-04-01) ; E2E live-infra (gating ACCESS-03b, affiliation-attribution) restent human-verify.

**Next action (archive):** Phase 07 — Plan 07-06 (surfaces `[locale]` trilingues restantes). Surface 1 = formulaire de candidature `[locale]/affiliation` (form react-hook-form + zod, namespace i18n `affiliate.application.*` à parité STRICTE fr/en/ar + RTL, insert via service_role D-08, toast sonner). Surface 3 = dashboard affilié no-PII `[locale]/(affiliate)/dashboard` (rôle affiliate, vue `affiliate_dashboard` security_invoker en lecture RLS seule via @tanstack/react-query, grille 8 paliers + progression, namespaces `affiliate.dashboard.*`/`affiliate.tiers.*`, zéro ligne par filleul D-13). Back-office (surfaces 2 & 4) déjà livré en 07-05 (6cfa967, 6fa809b). Le job mensuel `affiliate-commission` est enregistré au dispatch. affiliate-rls.test.ts (AFF-02) reste à passer GREEN une fois `.env.test` + 2 users seedés disponibles (deferred-items.md). En suspens Phase 04 : 04-03 vetting lib QR B-04-03, 04-02 LIVE apply B-04-02, 04-01 fixture TronGrid B-04-01. Phase 06 : 06-02 (job grammy) / 06-03 (threat verify graphe packages).

**Next action (archive):** Phase 07 — Plan 07-04 (signUp étendu : lecture cookie aff_ref + `attributeReferral` best-effort + delete cookie). Le repo `attributeReferral(client, {affiliate_code, referral_user_id})` est livré (26ce2f4, @app/supabase) et best-effort (ne casse jamais le signup) ; 07-04 le câble dans l'action serveur (try/catch, redirige paiement-bientot même si l'attribution échoue). Puis 07-05 (back-office) et 07-06 (candidature).

**Next action (archive):** Phase 06 — Plan 06-02 (job d'envoi Telegram). Câbler grammy 1.43 + planification sur le socle livré en 06-01 : le job lira `getPatternStats` (@app/supabase, anon|service_role) + clôtures du jour, appellera `formatMessage` (@app/core, pur bilingue FR+AR) et postera sur le canal public (parse_mode HTML). Socle partagé (threshold + getPatternStats + formatMessage) déjà committé et golden-testé (9757fdf/882915d/28d8800). 06-03 = threat verify graphe packages (aucun import apps/web depuis jobs). En suspens Phase 04 : 04-03 vetting lib QR B-04-03, 04-02 LIVE apply B-04-02, 04-01 fixture TronGrid B-04-01.

**Next action (archive):** Phase 05 — Plan 05-03 (page track record publique). Consommer la vue `pattern_stats` en lecture anon (premier consommateur public), appliquer le seuil N≥30 via `applyThreshold` (threshold.ts de 05-01), afficher win_rate/expectancy/avg_r/N par dimension D-06 (all_time + 90d) sinon « en construction ». Pipeline de données (table + vue + job idempotent) déjà live et committé (05-02). En suspens Phase 04 : 04-03 vetting lib QR B-04-03, 04-02 LIVE apply B-04-02, 04-01 fixture TronGrid B-04-01.

**Next action (archive):** Phase 04 — Plan 04-03 PARTIEL, **bloqué au checkpoint vetting lib QR B-04-03** (human-verify, blocking-human). Étape humaine requise : vetter la lib QR (npmjs âge/downloads/repo/postinstall + rendu 100% offline + encode l'adresse seule) puis `pnpm --filter web add <qr-lib>` épinglée, OU repli SVG QR maison. Tasks 2+3 (8 blocs shadcn + i18n payment/admin) déjà livrées et committées (d5b38c8, 1fc7b9e). En parallèle : 04-02 bloqué au checkpoint LIVE apply B-04-02 (orchestrateur), 04-01 bloqué au checkpoint réseau TronGrid B-04-01. Ne pas marquer 04-03 complet avant le vetting QR.

**Next action (archive):** Phase 04 — Plan 04-02 PARTIEL, **bloqué au checkpoint LIVE apply B-04-02** (orchestrateur). Étape orchestrateur requise via MCP (après confirmation humaine, JAMAIS db push) : `apply_migration` 0012_payments → `generate_typescript_types` vers database.types.ts (payments + RPC activate_subscription_for_payment) → `list_tables` + `get_advisors security` → re-run `pnpm typecheck`. Le code (migration + repos) est prêt et committé (72f49a5, eccc956) ; il ne reste que l'application live. En parallèle, 04-01 reste bloqué au checkpoint réseau B-04-01 (fixture TronGrid Nile). Ne pas marquer 04-02 complet avant l'apply LIVE + gen types.

**Next action (archive):** Phase 04 — Plan 04-01 PARTIEL, **bloqué au checkpoint réseau B-04-01**. Étape humaine requise (ops) : provisionner une clé TronGrid + frapper une vraie TX USDT-test Nile et coller la réponse dans `packages/data-sources/src/trongrid/__fixtures__/nile-trc20-transfer.json`, confirmer A1-A7 dans `GOLDEN.md`. Tant que ce checkpoint n'est pas franchi, le Plan 04 (parseur Zod TronGrid) reste bloqué ; les briques déterministes atomic.ts + address.ts sont déjà livrées et golden-testées. Ne pas marquer 04-01 complet avant la fixture réelle.

---
*State updated: 2026-06-21 — milestone v2.1 « Mise en vie », roadmap 5 phases (10-14) créée, 28/28 requirements mappés. Numérotation continue après v2.0 (clôturé phase 9).*

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
