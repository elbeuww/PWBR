---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Plateforme publique
status: executing
last_updated: "2026-06-18T00:52:21.753Z"
last_activity: 2026-06-18 -- Phase 07 planning complete
progress:
  total_phases: 9
  completed_phases: 6
  total_plans: 28
  completed_plans: 22
  percent: 79
---

# Project State

**Project:** Plateforme d'Analyse de Trading "Vétéran"
**Last updated:** 2026-06-14

## Project Reference

**Core value:** Produire, pour chaque opportunité, une analyse fiable et explicable — vulgarisée pour un public non technique — avec un % de réussite TOUJOURS mesuré, jamais inventé : c'est le socle de confiance qui fait payer l'abonnement.
**Current focus:** Phase 06 — canal-telegram-public
**Mode:** interactive (MVP vertical)
**Granularity:** fine

## Current Position

Phase: 7
Plan: Not started
Status: Ready to execute
Last activity: 2026-06-18 -- Phase 07 planning complete

Progress: [█████████░] 91%

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

**Last session:** 2026-06-18T00:05:00.542Z

**Last session:** 2026-06-17 — Plan 06-01 COMPLETE (socle partagé + formateur Telegram bilingue, TG-02/LEGAL-01). Task 1 (9757fdf, TDD) : threshold.ts déplacé tel quel en @app/core (source unique seuil N≥30 vitrine ↔ Telegram, D-11), web re-exporte, test golden 8 vert. Task 2 (882915d) : getPatternStats porté en @app/supabase (client générique anon|service_role, SELECT agrégats exact, jamais de throw), web re-câblé en re-export, suite P5 non régressée — jobs n'importera jamais apps/web (D-49). Task 3 (28d8800, TDD) : formatMessage pur bilingue FR+AR — escapeHtml ordre & < > (T-06-INJ), bloc FR LTR + AR RTL préfixé U+200F, ticker/R/% isolés U+2066/U+2069 (T-06-BIDI), win rate via applyThreshold (TG-02/D-11), disclaimer FR+AR copy P2 chaque sortie (LEGAL-01), FormatTrade sans niveaux entry/SL/TP (D-03/T-06-LEAK grep==0), jour vide D-10, cap top-10 |R| + « +X autres » < 4096 (Pitfall 3), 11 tests golden verts. Déviation Rule 2 : export barrel core formatMessage/escapeHtml. npx vitest run 401 tests verts (53 fichiers), pnpm typecheck 0 erreur, 0 package npm. Stopped at : Plan 06-01 terminé.

**Last session (archive):** 2026-06-16 — Plan 05-02 COMPLETE (pipeline de données track record, TRACK-01/02). Migration 0014 appliquée LIVE via MCP : table prediction_outcomes (PK setup_id, FK trade_setups cascade, RLS authenticated, 0 policy write → service_role bypass) + vue pattern_stats (security_invoker=false, **grant SELECT anon = première lecture publique du projet**, agrégats only). Job outcome-tracker GREEN idempotent 2 niveaux (getResolvedSetupIds + UNIQUE setup_id onConflict ignoreDuplicates), enregistré dispatch, tracé runJob. Repos insertOutcomes/getResolvedSetupIds + getCandlesForReplay (H1 borné anti look-ahead). A1 (invalidated rejoués pleinement) + A2 (expectancy tous / avg_r gagnants) honorés. get_advisors PASS (prediction_outcomes inaccessible anon ; security_definer_view sur pattern_stats = intentionnel). Commits f931623/1584c7c/374a5bb/542a1f7. Déviations : asset_class joint depuis instruments (Rule 1), aliases database.types.ts réappliqués post gen-types (Rule 3). Tests : outcome-tracker 2/2, core replay 11/11, typecheck 0 erreur, 0 npm. Stopped at : Plan 05-02 terminé.

**Last session (archive):** 2026-06-16 — Plan 05-01 COMPLETE (cœur déterministe pur, zéro I/O). TDD : 8498a2c (RED golden tests replayOutcome) → 084d75f (GREEN replayOutcome pur + barrel core, types Outcome/ReplaySetup/ReplayCandle) ; a2f5b19 (helper applyThreshold seuil N≥30 + test + extension glob vitest apps/web/src/lib/**). replayOutcome : first-touch H1 (D-01/D-03), règle distance D-04 (tie ≤ = hit_tp), flat D-02 au close ≤ valid_until (long ET short), R sur prix candles jamais via scoring. applyThreshold : MIN_SAMPLE=30, N exposé dans les 2 branches (D-12), win_rate null → 0 (pas de NaN). 17 tests neufs verts (11 replay + 6 threshold), typecheck 0 erreur, 0 package npm. TRACK-01/TRACK-03 (logique pure) couverts ; job outcome-tracker + vue pattern_stats + RLS anon = 05-02/05-03. 2 tests d'intégration Supabase rouges hors scope (réseau, deferred-items.md). Stopped at : Plan 05-01 terminé.

**Last session (archive):** 2026-06-15 — Plan 04-03 PARTIEL (bloqué checkpoint vetting lib QR B-04-03, human-verify). Couche présentation paiement livrée hors lib QR : Task 2 (d5b38c8) 8 blocs shadcn — 7 via CLI officiel radix-nova (table/textarea/sonner/tabs/alert/alert-dialog/progress) + form.tsx écrit main (react-hook-form 7 + @hookform/resolvers 5, absent registry nova standalone D-02-01-D) ; sonner@2 dep ; existants intacts ; root layout.tsx inchangé (Pitfall 7). Task 3 (1fc7b9e) namespace payment 53 clés ×3 parité RÉCURSIVE stricte (polling.steps.*/errors.*/hash.*/screenshot.*/status.*/expiredGated.*, ICU plural expiryBanner, copy = 04-UI-SPEC) + namespace admin mono-FR + pricing D-12 + test messages-parity-payment.test.ts (4/4). Vérifs : flatten plan 53 clés OK, vitest 4/4, typecheck 0 erreur, lint:i18n exit 0. Rule 1 : i18n-ignore sur faux positif annotation CVA alert.tsx. **STOP au checkpoint Task 1** : lib QR = unique paquet npm vetté (bundle client phase argent), NON auto-approuvable → pnpm add non exécuté. PAY-01/04/05/06 + ADMIN-01/02 NON marqués complets. Stopped at : checkpoint vetting QR B-04-03.

**Last session (archive):** 2026-06-15 — Plan 04-02 PARTIEL (bloqué checkpoint LIVE apply, owned orchestrateur). Écrit migration 0012_payments.sql (72f49a5) : table payments + RLS producteur-unique (1 insert pending+self / 2 select self+superadmin / 0 update-delete) + UNIQUE(tx_hash) GLOBAL anti-replay + index unique partiel offset D-05 + RPC atomique activate_subscription_for_payment security definer + revoke execute (A8). Écrit repos service_role (eccc956) : payments.ts (reserveOffset montant unique serveur boucle 23505, insertPendingPayment 23505→ReplayError, getByHash, transitionPayment, OFFSET_RESERVATION_MINUTES=60) + subscriptions.ts (activateForPayment via RPC castée D-04-02-C, expireDue, changePlan) + barrel + .env.example (TRONGRID/USDT/TRON vars sans valeurs). Vérifs : multi-critère 5/5, RLS/RPC count, 11 key-links, tsc -b --force vert. **STOP au checkpoint Task 2** : apply_migration LIVE + gen types réservés à l'orchestrateur (jamais db push). PAY-03/04/06 + ADMIN-01/02 NON marqués complets. Stopped at : checkpoint LIVE apply B-04-02.

**Last session (archive):** 2026-06-15 — Plan 04-01 PARTIEL (bloqué checkpoint réseau). Exécuté les 2 tâches déterministes en TDD : atomic.ts BigInt zéro-float (fc17427 RED, d1f83bb GREEN, 17/17, 9.02→9020000n) et address.ts base58check TRON sans tronweb (b0d8c0a RED + GOLDEN.md, b6c9ae3 GREEN, 10/10, checksum corrompu→throw). Golden values base58 calculées hors-ligne par double-sha256 (déterministes, pas inventées). **STOP au checkpoint réseau Task 1** : aucune clé TronGrid ni TX Nile réelle → `nile-trc20-transfer.json` NON fabriqué (interdit). PAY-01/PAY-02 NON marqués complets. tsc sans nouvelle erreur. Stopped at : checkpoint réseau B-04-01, en attente de la fixture TronGrid Nile réelle.

**Last session (archive):** 2026-06-15 — Completed 03-01-PLAN.md (segment final). Task 1 (2dde589) + Task 2 (e8df555, migration 0011 appliquée live via MCP) faits par exécuteurs précédents ; ce segment a confirmé que les types Supabase n'ont pas besoin de régénération (0011 = replica identity + publication + RLS candles, aucune colonne) puis exécuté Task 3 en TDD : 5a70533 (RED searchParams), 26a3c41 (GREEN searchParams + format + QueryProvider + i18n fr/en/ar). Vérifs : vitest 10/10, parité i18n OK, `pnpm typecheck` 0 erreur, `lint:i18n` exit 0. Décision RLS candles = ALIGN. **Plan 03-01 COMPLETE (socle DB + plumbing).** Stopped at : Plan 03-01 terminé.

**Last session (archive):** 2026-06-14 — Completed 02-03-PLAN.md (4 commits : 38c1894 tarifs 9$/3$ + paiement-bientot + funnel signup→paiement-bientot, 86e7001 home bénéfice-first + proof slot masqué, 49ac57e RED no-perf-claims, fa8a5d0 GREEN glob vitest). Cœur conversion de la vitrine livré : home VITR-01, tarifs VITR-02 (USDT TRC-20, D-10/D-11/D-12), funnel honnête D-09, garde no-perf-claims VITR-03/D-08. 15 tests verts, tsc/lint:i18n OK, invariant auth P1 intact. **Phase 02 COMPLETE (3/3 plans).** Stopped at : Plan 02-03 terminé.

**Next action:** Phase 06 — Plan 06-02 (job d'envoi Telegram). Câbler grammy 1.43 + planification sur le socle livré en 06-01 : le job lira `getPatternStats` (@app/supabase, anon|service_role) + clôtures du jour, appellera `formatMessage` (@app/core, pur bilingue FR+AR) et postera sur le canal public (parse_mode HTML). Socle partagé (threshold + getPatternStats + formatMessage) déjà committé et golden-testé (9757fdf/882915d/28d8800). 06-03 = threat verify graphe packages (aucun import apps/web depuis jobs). En suspens Phase 04 : 04-03 vetting lib QR B-04-03, 04-02 LIVE apply B-04-02, 04-01 fixture TronGrid B-04-01.

**Next action (archive):** Phase 05 — Plan 05-03 (page track record publique). Consommer la vue `pattern_stats` en lecture anon (premier consommateur public), appliquer le seuil N≥30 via `applyThreshold` (threshold.ts de 05-01), afficher win_rate/expectancy/avg_r/N par dimension D-06 (all_time + 90d) sinon « en construction ». Pipeline de données (table + vue + job idempotent) déjà live et committé (05-02). En suspens Phase 04 : 04-03 vetting lib QR B-04-03, 04-02 LIVE apply B-04-02, 04-01 fixture TronGrid B-04-01.

**Next action (archive):** Phase 04 — Plan 04-03 PARTIEL, **bloqué au checkpoint vetting lib QR B-04-03** (human-verify, blocking-human). Étape humaine requise : vetter la lib QR (npmjs âge/downloads/repo/postinstall + rendu 100% offline + encode l'adresse seule) puis `pnpm --filter web add <qr-lib>` épinglée, OU repli SVG QR maison. Tasks 2+3 (8 blocs shadcn + i18n payment/admin) déjà livrées et committées (d5b38c8, 1fc7b9e). En parallèle : 04-02 bloqué au checkpoint LIVE apply B-04-02 (orchestrateur), 04-01 bloqué au checkpoint réseau TronGrid B-04-01. Ne pas marquer 04-03 complet avant le vetting QR.

**Next action (archive):** Phase 04 — Plan 04-02 PARTIEL, **bloqué au checkpoint LIVE apply B-04-02** (orchestrateur). Étape orchestrateur requise via MCP (après confirmation humaine, JAMAIS db push) : `apply_migration` 0012_payments → `generate_typescript_types` vers database.types.ts (payments + RPC activate_subscription_for_payment) → `list_tables` + `get_advisors security` → re-run `pnpm typecheck`. Le code (migration + repos) est prêt et committé (72f49a5, eccc956) ; il ne reste que l'application live. En parallèle, 04-01 reste bloqué au checkpoint réseau B-04-01 (fixture TronGrid Nile). Ne pas marquer 04-02 complet avant l'apply LIVE + gen types.

**Next action (archive):** Phase 04 — Plan 04-01 PARTIEL, **bloqué au checkpoint réseau B-04-01**. Étape humaine requise (ops) : provisionner une clé TronGrid + frapper une vraie TX USDT-test Nile et coller la réponse dans `packages/data-sources/src/trongrid/__fixtures__/nile-trc20-transfer.json`, confirmer A1-A7 dans `GOLDEN.md`. Tant que ce checkpoint n'est pas franchi, le Plan 04 (parseur Zod TronGrid) reste bloqué ; les briques déterministes atomic.ts + address.ts sont déjà livrées et golden-testées. Ne pas marquer 04-01 complet avant la fixture réelle.

---
*State updated: 2026-06-14 — milestone v2.0, roadmap 9 phases créée. Cœur analytique v1.0 (P1-4) livré et archivé, sert de socle.*
