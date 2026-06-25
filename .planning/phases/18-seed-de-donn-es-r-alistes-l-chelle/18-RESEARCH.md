# Phase 18 : Seed de données réalistes à l'échelle - Recherche

**Researched:** 2026-06-25
**Domain:** Seed déterministe FK-cohérent à l'échelle (~10k) sur Supabase/Postgres + labellisation source + preuve RLS anon
**Confidence:** HIGH (schéma DB lu intégralement migrations 0001→0017 ; faker vérifié npm + slopcheck ; patterns RLS/test issus du code projet existant)

## Summary

Phase 18 = script `seed.ts` (devDep `@faker-js/faker`, exécuté via `tsx`) qui peuple la DB de ~10k lignes FK-cohérentes, déterministes (`faker.seed()`), idempotentes, labellisées `source ∈ {demo, backtest, live}`, sans fabriquer aucun chiffre de performance (VITR-03). L'écriture passe par le **client service_role** (jobs uniquement, jamais front) ; la **lecture de la preuve RLS** (SEED-03) passe par le **client anon**. Trois leviers déjà posés en Phase 17 conditionnent le réalisme : les index keyset `(created_at desc, id desc)`, la matview `mv_mrr` (cash encaissé = Σ `payments.amount_atomic` WHERE verified), et les policies RLS wrappées `(select …)`. Le seed doit donc étaler `created_at` et produire des `payments` verified avec `verified_at` étalés sur plusieurs mois pour que keyset + MRR + churn soient démontrables.

Le graphe FK est entièrement chaîné sur `profiles(id) → auth.users(id)` : créer un user passe **obligatoirement** par `auth.admin.createUser()` (le trigger `handle_new_user` crée la ligne `profiles`). À ~10k users c'est le goulot de perf principal. Le reste (signaux, paiements, abonnements, affiliés, outcomes, candles) s'insère en batch service_role. La colonne `source` (mini-migration `0018`) est requise sur les tables que le seed remplit ET dont le nettoyage idempotent (D-06 : `delete WHERE source='demo'` en ordre FK inverse) doit cibler sans toucher `live`.

**Primary recommendation:** Migration `0018` ajoutant `source text not null default 'live' check (source in ('live','demo','backtest'))` sur les 8 tables seedées non-référentielles (profiles, subscriptions, payments, analyses, trade_setups, prediction_outcomes, affiliates, commissions) + colonnes héritées implicites pour les tables filles purgées par cascade. Seed en une transaction logique batchée par table dans l'ordre topologique, `faker.seed(42)` + locales `[fr, en, ar]` via `faker` multi-locale, purge idempotente par `source='demo'` en ordre FK inverse. Preuve RLS = nouveau test Vitest `seed-rls.test.ts` calqué sur `affiliate-rls.test.ts` (anon-client, `describe.skipIf`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Création des users (`auth.users` + `profiles`) | Database (trigger `handle_new_user`) | Script seed via `auth.admin.createUser` | Le seul chemin légal : `profiles.id` FK `auth.users.id`. Pas d'insert direct dans `profiles`. |
| Insertion masse signaux/paiements/affiliés/outcomes | Script seed (service_role) | Database (RLS bypass) | Frontière producteur : toutes ces tables ont RLS active + 0 policy write → seul service_role écrit. |
| Labellisation `source` | Database (colonne + check) | Script seed (valeur `demo`) | Colonne explicite requêtable/testable (D-01), pas une convention implicite. |
| Idempotence (purge cohorte) | Script seed (delete WHERE source='demo') | Database (FK cascade) | Ordre FK inverse explicite ; les cascades `on delete cascade` propagent vers les tables filles. |
| MRR / KPIs mesurés | Database (`mv_mrr`, `pattern_stats`, `affiliate_dashboard`) | — | Aucun % stocké : tout calculé à partir des lignes brutes seedées (D-02). |
| Preuve isolation RLS | Test Vitest (anon-client) | Database (policies) | SEED-03 : lecture anon, jamais service_role, sur données à l'échelle. |
| Déterminisme | Script seed (`faker.seed()`) | — | Même seed → même dataset → N stable au re-run. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@faker-js/faker` | `10.5.0` (publié 2026-06-17) | Génération de données réalistes déterministes (noms, emails, montants, dates), multi-locale fr/en/ar | `[VERIFIED: npm registry]` Standard de fait écosystème JS. 16,7M dl/semaine. Repo officiel `github.com/faker-js/faker`. `faker.seed(n)` = déterminisme garanti. Locales `fr`, `en`, `ar` natives. slopcheck **[OK]**. |
| `tsx` | `4.22.4` (déjà devDep racine) | Exécution directe du script TS sans build | `[VERIFIED: codebase]` Déjà utilisé par `apps/jobs` (`dispatch`, `freeze-nile-fixture`). Pattern établi. |
| `@supabase/supabase-js` | `2.108.0` (déjà devDep `apps/jobs` + dep `packages/supabase`) | Client service_role (écriture seed) + client anon (preuve RLS) | `[VERIFIED: codebase]` `serviceClient` existant (`packages/supabase/src/service-client.ts`). `auth.admin.createUser` pour les users. |
| `vitest` | `4.1.8` (déjà devDep racine) | Test d'intégration RLS anon (D-07) + scan no-perf-claims (D-02) | `[VERIFIED: codebase]` Framework de test du projet, glob déjà configuré. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `luxon` | `3.7.2` (déjà dep `apps/jobs`) | Étalement déterministe des `created_at`/`verified_at` (fenêtres mensuelles, churn) | Pour fabriquer des dates UTC cohérentes (mois d'encaissement MRR, expirations). Évite les pièges TZ de `Date`. |
| `p-limit` | `7.3.0` (dispo écosystème, ESM) | Borner la concurrence des `auth.admin.createUser` (Pitfall 11 : épuisement connexions) | Création des ~10k users : `pLimit(5-10)` pour ne pas saturer le pooler/Auth API. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `auth.admin.createUser` (1 appel/user) | Insert SQL direct dans `auth.users` via service_role | `[ASSUMED]` Insert direct contourne le trigger `handle_new_user` et casse l'intégrité auth (hash password, identities). À ~10k, c'est tentant pour la perf mais fragile. **Recommandation : rester sur `auth.admin.createUser`** + `pLimit`. Si perf inacceptable, évaluer un INSERT SQL batch dans `auth.users` + `public.profiles` en transaction (à VALIDER avec le fondateur — touche le schéma `auth`). |
| `faker` multi-locale runtime | 3 instances faker (`new Faker({locale:[fr]})` etc.) | Multi-locale natif `new Faker({ locale: [ar, fr, en] })` suffit ; choisir la locale par user via un index déterministe. Plus simple qu'instancier 3 Faker. |
| Seed en TS | Seed SQL pur (génération côté Postgres `generate_series`) | SQL `generate_series` est plus rapide à l'échelle MAIS ne crée pas les `auth.users` et perd faker/locales/réalisme MENA. CONTEXT verrouille `seed.ts` faker/tsx (D hors discrétion). |

**Installation:**
```bash
# devDep racine (le seed est un outil de dev, pas du runtime)
pnpm add -D -w @faker-js/faker
# p-limit : si pas déjà présent dans le workspace data-sources, l'ajouter au package du seed
```

**Version verification:** `npm view @faker-js/faker version` → `10.5.0`, `time.modified` 2026-06-17, repo officiel faker-js, 0 `scripts.postinstall`. Vérifié 2026-06-25.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@faker-js/faker` | npm | mature (v10, lignée 2022+) | 16,7M/sem | github.com/faker-js/faker (officiel) | [OK] | Approuvé |
| `tsx` | npm | déjà installé `4.22.4` | — | — | non re-scanné (déjà dans le repo) | Déjà présent |
| `p-limit` | npm | déjà dans l'écosystème projet | — | — | déjà verrouillé CLAUDE.md | Déjà approuvé projet |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`@faker-js/faker` : pas de `postinstall`, maintainers officiels faker-js, repo source présent et actif → `[VERIFIED: npm registry]`. slopcheck a rendu `[OK]` (le traceback observé portait sur l'étape `npm install` réelle, pas sur le verdict de légitimité qui a affiché `1 OK`).

## Architecture Patterns

### System Architecture Diagram

```
                        seed.ts  (tsx, devDep)
                          │  faker.seed(42)  ── déterminisme
                          │  locale picker fr/en/ar (index % 3)
                          ▼
              ┌─────────────────────────────┐
              │  ÉTAPE 0 : PURGE idempotente │   delete WHERE source='demo'
              │  (ordre FK inverse)          │   (cascade vers tables filles)
              └─────────────┬───────────────┘
                            ▼
   service_role client (bypass RLS — écriture seulement)
                            │
   ┌────────────────────────┼─────────────────────────────────────────┐
   │ ordre topologique d'insertion (parents → enfants)                 │
   │                                                                   │
   │ 1. auth.users  ──auth.admin.createUser()──►  trigger              │
   │      └─► public.profiles (role: member/affiliate/superadmin)      │
   │ 2. instruments (DÉJÀ seedés 0003 — NE PAS re-seeder, réutiliser)  │
   │ 3. subscriptions (status active/expired/canceled, period_end)     │
   │ 4. payments (verified, amount_atomic, verified_at étalé) ─► mv_mrr│
   │ 5. analyses ─► trade_setups (status active/expired/invalidated)   │
   │ 6. prediction_outcomes (PK=setup_id, outcome+realized_r BRUTS)    │
   │ 7. affiliates ─► affiliate_codes ─► referrals ─► commissions      │
   │    └─► payouts ;  compute_affiliate_commissions(period) RPC       │
   │ 8. candles / snapshots / news / job_runs / telegram_posts (volume)│
   └────────────────────────┼─────────────────────────────────────────┘
                            ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ DÉRIVÉS (jamais seedés — calculés) :                              │
   │   pattern_stats (vue) · mv_mrr (matview) · affiliate_dashboard    │
   │   → tous les % / MRR / churn lus ICI, jamais stockés (D-02/VITR-03)│
   └─────────────────────────────────────────────────────────────────┘
                            ▼
   PREUVE (séparée) : seed-rls.test.ts via ANON client
     • non-abonné lit 0 trade_setups        • user A ne voit pas user B
```

### Recommended Project Structure
```
apps/jobs/
├── scripts/
│   └── seed.ts            # script principal (tsx)  ← entrée `pnpm seed`
│   └── seed/
│       ├── config.ts      # SEED_VERSION, volumes, ratios distribution démo
│       ├── users.ts       # createUser + profiles + roles (faker locales)
│       ├── subscriptions.ts
│       ├── payments.ts    # verified_at étalé → MRR/churn
│       ├── signals.ts     # analyses + trade_setups + outcomes BRUTS
│       ├── affiliation.ts # affiliates/codes/referrals/commissions/payouts
│       ├── market.ts      # candles/snapshots/news/job_runs/telegram volume
│       └── purge.ts       # delete WHERE source='demo' (ordre FK inverse)
packages/supabase/src/repositories/__tests__/
│   └── seed-rls.test.ts   # SEED-03 (anon, skipIf) — calqué affiliate-rls.test.ts
apps/web/test/
│   └── no-perf-seed-claims.test.ts  # SEED-02 scan (extension du pattern existant)
supabase/migrations/
│   └── 0018_seed_source_column.sql  # colonne source (D-01)
```

### Pattern 1 : Création de user déterministe (auth → profiles)
**What:** Le seul chemin pour créer un user. `email_confirm: true` évite l'étape de confirmation.
**When to use:** Étape 1 du seed, pour chaque user de la cohorte.
```typescript
// Source: pattern @supabase/supabase-js admin API + trigger handle_new_user (0001)
import { faker } from '@faker-js/faker'
// faker multi-locale : ar pour ~MENA, fr, en
const f = faker // ou new Faker({ locale: [ar, fr, en] })

const email = `seed-${i}@demo.nexa.invalid`        // domaine .invalid = jamais routé
const { data, error } = await serviceClient.auth.admin.createUser({
  email,
  password: 'SeedDemo!2026',
  email_confirm: true,
  user_metadata: { seed: true },                   // traçabilité
})
// le trigger handle_new_user crée public.profiles(id, email) automatiquement
// puis : UPDATE profiles SET role=…, source='demo' WHERE id = data.user.id
```
**Note perf:** `auth.admin.createUser` = 1 appel réseau/user. À 10k, borner via `pLimit(5)` et tolérer ~minutes d'exécution. `[ASSUMED]` le débit exact dépend du plan Supabase.

### Pattern 2 : Insertion batch service_role + labellisation source
**What:** Insert en lots (chunks de ~500-1000) pour les tables non-auth.
```typescript
// Source: serviceClient existant (packages/supabase/src/service-client.ts)
const rows = users.map((u, i) => ({
  user_id: u.id,
  status: pickStatus(i),                 // distribution démo déterministe
  plan: pickPlan(i),                     // 'standard' | 'discovery'
  current_period_end: periodEnd(i),      // luxon, étalé
  source: 'demo',                        // ← colonne 0018
}))
for (const chunk of chunks(rows, 1000)) {
  const { error } = await serviceClient.from('subscriptions').insert(chunk)
  if (error) throw new Error(`seed subscriptions: ${error.message}`)
}
```

### Pattern 3 : Outcomes BRUTS uniquement (D-02 / VITR-03)
**What:** On seede `outcome ∈ {hit_tp,hit_sl,flat}` + `realized_r` (numeric). On ne stocke JAMAIS de win_rate/%. `pattern_stats` (vue 0014) calcule tout.
```typescript
// prediction_outcomes : PK = setup_id (1 outcome / setup expiré ou invalidé)
const outcome = faker.helpers.weightedArrayElement([
  { weight: 55, value: 'hit_tp' },   // distribution réaliste, PAS un % affiché
  { weight: 35, value: 'hit_sl' },
  { weight: 10, value: 'flat' },
])
const realized_r = outcome === 'hit_tp'
  ? faker.number.float({ min: 0.8, max: 3.5, fractionDigits: 2 })
  : outcome === 'hit_sl'
    ? faker.number.float({ min: -1.2, max: -0.8, fractionDigits: 2 })
    : faker.number.float({ min: -0.3, max: 0.3, fractionDigits: 2 })
// AUCUN champ "win_rate" ici. Le % émerge de la vue pattern_stats.
```

### Pattern 4 : MRR mesuré via paiements étalés (D-03/D-04, mv_mrr)
**What:** `mv_mrr` = Σ `payments.amount_atomic` WHERE `status='verified'` GROUP BY mois de `verified_at`. Pour un MRR/churn visible, étaler `verified_at` sur ~12 mois et faire varier le volume.
```typescript
// pricing verrouillé D-04 : 9$ standard / 3$ découverte, USDT 6 décimales → atomic
const PRICE_ATOMIC = { standard: 9_000_000n, discovery: 3_000_000n } // ×10^6
// verified_at étalé : luxon, mois calendaires UTC, plus de volume sur mois récents
```

### Anti-Patterns to Avoid
- **Insérer dans `public.profiles` sans passer par `auth.users`** : viole la FK `profiles.id → auth.users.id`. Toujours `auth.admin.createUser`.
- **Stocker un win_rate/% seedé** : viole VITR-03/D-02. Les % restent calculés (`pattern_stats`/`mv_mrr`).
- **Re-seeder `instruments`** : déjà seedés idempotemment en 0003 (12 instruments) + 0001 (3). Le seed Phase 18 les RÉUTILISE (lit les `id`), ne les recrée pas.
- **`created_at` tous identiques** : casse keyset + tri + réalisme (Pitfall 12). Étaler via faker/luxon.
- **Lire la preuve RLS via service_role** : viole SEED-03. La preuve passe par anon-client.
- **Purger par TRUNCATE global** : détruirait d'éventuelles données `source='live'`. Purger uniquement `WHERE source='demo'`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Noms/emails/montants réalistes multi-locale | Générateur maison de chaînes | `@faker-js/faker` multi-locale | Locales fr/en/ar natives, MENA names, déterminisme `seed()`. |
| Déterminisme du dataset | RNG maison seedé | `faker.seed(n)` | Garanti par faker, re-run = N stable (D-06). |
| Création users + profil | INSERT manuel `auth.users` | `auth.admin.createUser` | Gère hash password, identities, déclenche le trigger profiles. |
| Agrégats MRR/win-rate | Calcul JS stocké | Vues/matviews DB existantes (`mv_mrr`, `pattern_stats`, `affiliate_dashboard`) | Déjà posées 0014/0016/0017 ; conforme VITR-03 (mesuré, jamais inventé). |
| Calcul des commissions | Boucle JS de commissions | RPC `compute_affiliate_commissions(period)` (0016) | Idempotent, applique la grille bps, exclut auto-parrainage. Le seed l'APPELLE après avoir seedé referrals+payments. |

**Key insight:** La quasi-totalité de la logique métier (MRR, commissions, win-rate, isolation) est DÉJÀ en DB (migrations 0009-0017). Le seed ne fait que produire les **lignes brutes** ; il n'implémente aucun calcul. Toute tentation de calculer un agrégat en TS dans le seed est un anti-pattern (double source de vérité + risque VITR-03).

## Runtime State Inventory

> Phase de seed/migration de données — inventaire requis.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Tables Postgres existantes : `instruments` (15 lignes seedées 0001+0003), `asset_drivers` (13 lignes 0005). Données `live` futures éventuelles. | Le seed ne touche QUE `source='demo'`. `instruments`/`asset_drivers` réutilisés (lecture), jamais purgés. |
| Live service config | `mv_mrr` (matview Phase 17) doit être **rafraîchie après seed** (`refresh_mv_mrr()` service_role) sinon MRR=vide. `pattern_stats`/`affiliate_dashboard` = vues live (pas de refresh). | Étape finale du seed : appeler `refresh_mv_mrr()` (ou `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr` via service_role). Exige l'index unique `mv_mrr_month_idx` (Partie B 0017 — **VÉRIFIER LIVE qu'il existe**). |
| OS-registered state | Aucun. Le seed est un script `tsx` à la demande, pas un job planifié. | None — vérifié (pas de Task Scheduler pour le seed). |
| Secrets/env vars | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (écriture seed) ; `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (preuve RLS). Lus dans `.env`/`.env.test` (gitignorés). | Le seed lit `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (comme `apps/jobs`). Le test RLS lit `.env.test` (déjà câblé vitest.config.ts). Aucun nouveau secret. |
| Build artifacts | `packages/supabase/src/database.types.ts` édité à la main après migration (convention repo : pas de `gen types --linked`). La colonne `source` (0018) ajoute des champs aux types `Insert`/`Row`. | Après `apply_migration` 0018 + `generate_typescript_types` (MCP) → ré-éditer `database.types.ts` à la main (ré-appliquer alias maison + override `*_atomic`). Pitfall 5 connu du repo. |

**Le seed Phase 18 ne renomme rien** — il ajoute une colonne et insère des lignes. L'inventaire ci-dessus couvre l'état runtime à rafraîchir/régénérer après seed.

## Détermination du périmètre exact de la colonne `source` (Open Question 1)

Analyse du graphe FK complet (migrations lues). Une table a besoin de `source` si : (a) le seed y insère des lignes, ET (b) le nettoyage idempotent D-06 doit la cibler sans purger `live`, OU (c) la purge passe par cascade FK depuis une table colonnée.

### Tables recevant la colonne `source` explicite (insérées en racine de cohorte)
| Table | Pourquoi `source` requis | Purge |
|-------|--------------------------|-------|
| `profiles` | Dimension utilisateur, racine de presque toutes les FK. D-01 minimum. | `delete WHERE source='demo'` (cascade vers subscriptions/payments/etc. via FK `on delete cascade`) |
| `subscriptions` | FK `user_id → profiles`. Seedée pour MRR/gating. Mais profiles cascade → optionnel pour purge. **Colonner quand même** : permet purge ciblée si on garde des profiles live. | colonne + cascade |
| `payments` | FK `user_id → profiles`. Source du MRR (`mv_mrr`). D-01 implicite (MRR). | colonne + cascade |
| `analyses` | Racine des signaux (`trade_setups.analysis_id → analyses`). FK `instrument_id → instruments` (PAS user). **N'est PAS purgée par cascade user** → `source` OBLIGATOIRE pour purge. | `delete WHERE source='demo'` |
| `trade_setups` | D-01 explicite. FK `analysis_id → analyses` (cascade depuis analyses) MAIS aussi cœur du seed signaux. `source` explicite (D-01). | cascade depuis analyses OU delete direct |
| `prediction_outcomes` | D-01 explicite. PK=`setup_id → trade_setups` (cascade). `source` explicite (D-01) — facilite scan/test. | cascade depuis trade_setups |
| `affiliates` | FK `user_id → profiles` (cascade). D-05 (cohorte affiliés). Colonner pour purge ciblée propre. | colonne + cascade |
| `commissions` | FK `affiliate_id → affiliates` (cascade) + `referral_id → profiles`. Calculées par RPC. Colonner pour scan/test. | cascade |

### Tables filles purgées UNIQUEMENT par cascade FK (colonne `source` OPTIONNELLE)
`affiliate_codes` (←affiliates), `referrals` (←affiliates/profiles), `payouts` (←commissions). Ces tables disparaissent par `on delete cascade` quand le parent colonné est purgé. **Recommandation : NE PAS les colonner** (réduit la surface de la migration 0018) sauf si un scan SEED-02 doit les vérifier indépendamment.

### Tables de marché (volume) — décision à trancher
`candles`, `snapshots`, `news`, `macro_series`, `economic_calendar`, `job_runs`, `telegram_posts` : FK vers `instruments`/`job_runs`, PAS vers `profiles`. Si le seed y ajoute du volume démo, elles ne sont purgées par AUCUNE cascade user → il faut soit `source` soit une autre clé de purge.
- **Recommandation `[ASSUMED]`** : colonner `candles`, `job_runs`, `telegram_posts`, `snapshots` avec `source` si on y seede du volume. `news`/`macro_series`/`economic_calendar` ont déjà des clés d'upsert naturelles (`url_hash`, `series_code+ts`, `event_key`) → on peut les seeder idempotemment SANS `source` (purge par préfixe de clé démo). **À confirmer au planning** selon le volume cible par table.

**Recommandation finale périmètre 0018 :** colonne `source` sur **8 tables** (profiles, subscriptions, payments, analyses, trade_setups, prediction_outcomes, affiliates, commissions) + **4 tables volume si seedées** (candles, snapshots, job_runs, telegram_posts). Total 8-12 selon décision volume. `default 'live'` (les lignes existantes deviennent `live`, future-proof).

## Ordre de purge FK-inverse (Open Question 2 — D-06)

Ordre d'insertion (topologique parent→enfant) puis purge en **inverse strict**. `on delete cascade` rend la plupart des deletes filles automatiques, mais l'ordre explicite évite les surprises sur les FK `set null`.

**Ordre d'INSERTION (parents d'abord) :**
1. `auth.users` → (trigger) `profiles`
2. `subscriptions`, `payments` (FK user)
3. `analyses` → `trade_setups` → `prediction_outcomes`
4. `affiliates` → `affiliate_codes`, `referrals` → `commissions` → `payouts`
5. `candles`/`snapshots`/`job_runs`/`telegram_posts` (volume, FK instruments/job_runs)

**Ordre de PURGE (enfants d'abord — D-06) :**
```
1.  delete payouts        WHERE commission_id IN (SELECT id FROM commissions WHERE source='demo')
                          -- ou cascade depuis commissions
2.  delete commissions    WHERE source='demo'
3.  delete referrals       (cascade depuis affiliates/profiles, ou WHERE affiliate_id IN demo)
4.  delete affiliate_codes (cascade depuis affiliates)
5.  delete affiliates     WHERE source='demo'
6.  delete prediction_outcomes WHERE source='demo'  (ou cascade depuis trade_setups)
7.  delete trade_setups   WHERE source='demo'
8.  delete analyses       WHERE source='demo'
9.  delete telegram_posts / snapshots / candles / job_runs  WHERE source='demo'  (si colonnés)
10. delete payments       WHERE source='demo'
11. delete subscriptions  WHERE source='demo'
12. delete profiles       WHERE source='demo'   -- cascade nettoie tout résiduel FK user
13. auth.admin.deleteUser() pour chaque user démo (auth.users n'a pas de colonne source
    → tracer les user_ids démo, ex via user_metadata.seed=true ou liste déterministe)
```
**Point d'attention `[VERIFIED: codebase]`** : `auth.users` ne peut pas porter `source`. Pour purger les users démo de façon idempotente, deux options : (a) lister les emails déterministes (`seed-*@demo.nexa.invalid`) et `auth.admin.listUsers` + `deleteUser` filtrés ; (b) marquer `user_metadata.seed=true` et filtrer. La suppression `auth.users` cascade vers `profiles` (FK `on delete cascade`) — donc purger les users démo nettoie automatiquement profiles+enfants. **Recommandation : purge par email pattern via `auth.admin`.**

## Ratios de distribution démo concrets (Open Question 3 — D-03)

D-03 verrouille « ~35-40% payants actifs ». Proposition chiffrée pour ~10k users produisant des dashboards remplis ET un churn visible (`[ASSUMED]` — à confirmer fondateur, c'est un choix de démonstration) :

| Segment | % | Volume (~10k) | Détail |
|---------|---|---------------|--------|
| Abonnés actifs payants | 37% | ~3 700 | `subscriptions.status='active'`, `current_period_end > now()`. Mix plans : ~75% standard (9$), ~25% discovery (3$). |
| Abonnés expirés (churn visible) | 18% | ~1 800 | `status='expired'`, `current_period_end < now()`. Matérialise le churn. |
| Annulés | 5% | ~500 | `status='canceled'`. |
| Jamais payé (lead/inscrits) | 40% | ~4 000 | profiles sans subscription active → funnel d'acquisition rempli (ADASH-01). |
| Affiliés (sous-ensemble) | ~3% des users | ~300 | `role='affiliate'` + ligne `affiliates`. Avec referrals/commissions. |
| Superadmin | 1-2 comptes | 2 | `role='superadmin'` (pour tester `is_superadmin()` + dashboard admin). |

**Paiements (mv_mrr) :** chaque abonné actif/expiré a 1-N `payments` verified étalés. Volume cible ~6 000-8 000 payments verified sur ~12 mois → MRR mensuel mesurable, courbe de revenu non plate.

**Affiliation (D-05) :** ~300 affiliés, chacun 0-50 referrals (distribution longue traîne : quelques gros affiliés à 50, beaucoup à 0-5) → la grille bps (8% à 20%) s'active sur les paliers (référer à `affiliate_rate_bps`). Appeler `compute_affiliate_commissions('2026-MM')` pour chaque mois seedé → commissions `due`/`paid`.

## Volumes par table pour atteindre ~10k cohérent (Open Question 4)

| Table | Volume cible | Rationale |
|-------|-------------|-----------|
| `profiles` (+ auth.users) | ~10 000 | Cible « ~10k users » SEED-01. Goulot perf (`createUser`). |
| `subscriptions` | ~6 000 | Actifs+expirés+annulés (60% des users). |
| `payments` | ~6 000-8 000 verified | MRR/churn sur 12 mois. |
| `analyses` | ~1 500-3 000 | Parents des signaux (1 analyse → 1-2 setups). |
| `trade_setups` | ~3 000-5 000 | Feed signaux pour keyset/dashboards. Mix status active/expired/invalidated. |
| `prediction_outcomes` | ~2 500 | Sur les setups expired/invalidated (PK=setup_id). N≥30 par bucket pour pattern_stats significatif. |
| `affiliates` | ~300 | Cohorte affiliés (D-05). |
| `referrals` | ~3 000 | Distribution longue traîne. |
| `commissions` | ~1 000-2 000 | Calculées par RPC sur mois × affiliés actifs. |
| `payouts` | ~300-500 | Sous-ensemble des commissions `paid`. |
| `candles` (si seedées) | ~5 000-20 000 | Optionnel : 12 instruments × 3 TF × N bougies. Sert SCALE-06 (Phase 21). Décision volume au planning. |
| `job_runs` | ~200-500 | Santé opérationnelle (ADASH-03). |
| `telegram_posts` | ~100-300 | Idempotence dedupe_key. |

**Total lignes ~10k « users » + plusieurs dizaines de milliers de lignes filles** → suffisant pour révéler les pièges perf (Pitfall 5/10/12) à l'audit Phase 21.

## Fenêtre temporelle des paiements / churn (Open Question 5)

Stratégie luxon : ancrer sur `now() = 2026-06-25`. Étaler `verified_at` et `current_period_end` :
- **Cohortes mensuelles** : répartir les premières souscriptions sur les 12 derniers mois (2025-07 → 2026-06), volume croissant vers les mois récents (courbe d'acquisition réaliste).
- **Churn visible** : pour ~18% des subscriptions, `current_period_end` dans le passé (1-6 mois avant now) → expirés. Pour les actifs, `current_period_end` futur (now + 1-30j) dont une fraction en J-3/J-1 (teste `ExpiryBanner` Phase 19).
- **Renouvellements** : certains users ont 2-N payments verified successifs (prolongation D-11) → MRR récurrent + LTV mesurable.
- **MRR par mois** = `mv_mrr` agrège `amount_atomic` par mois de `verified_at` → courbe non plate si les paiements sont étalés.

## Scan no-perf-claims pour le seed (Open Question 8 — D-02 / VITR-03)

Le test existant (`apps/web/test/no-perf-claims.test.ts`) scanne les **JSON i18n marketing**. Pour SEED-02, il faut un test **différent** qui prouve qu'aucune table seedée ne stocke un % de performance fabriqué. Deux volets complémentaires :

**Volet A — scan statique du code seed** (rapide, sans DB) :
```typescript
// no-perf-seed-claims.test.ts : grep AST/regex sur apps/jobs/scripts/seed/**
// Échoue si le code seed contient une affectation à un champ win_rate/winRate/
// success_rate/expectancy/avg_r/pct/percentage destinée à un INSERT.
// Liste blanche : realized_r, outcome, amount_atomic (montants), rate_bps (taux
// affiliation = commission, PAS perf de trade).
const FORBIDDEN_SEED_FIELDS = /win_?rate|success_?rate|winRatePct|hardcoded.*%/i
```

**Volet B — assertion DB post-seed** (intégration, skipIf comme les tests RLS) :
```typescript
// Prouve qu'aucune colonne de % de PERF n'existe en dur dans les lignes seedées.
// Les seules tables avec des % sont des VUES calculées (pattern_stats) — non seedées.
// Assertion : SELECT sur trade_setups/prediction_outcomes ne ramène AUCUNE colonne
// "win_rate" (le schéma n'en a pas → le scan confirme que le seed n'a pas tenté
// d'en ajouter via la migration). Vérifier que pattern_stats.n compte des lignes
// BRUTES (count>0) et que win_rate y est calculé (entre 0 et 1), jamais stocké ailleurs.
```
**Insight clé :** le schéma DB n'a AUCUNE colonne `win_rate`/`%` stockée (vérifié migrations 0006/0014). `pattern_stats`/`mv_mrr` sont des vues/matview. Donc VITR-03 est structurellement garanti TANT QUE la migration 0018 n'ajoute pas de colonne de perf et que le seed n'écrit que des champs bruts. Le scan A (code) est le garde-fou principal ; le scan B documente la mesure.

## Common Pitfalls

### Pitfall 1 : Seed FK-incohérent / sous-dimensionné → audit faussement vert (PITFALLS #5/#12)
**What goes wrong:** FK orphelines (setup → analyse inexistante), volumes trop faibles → les pièges perf restent invisibles, `created_at` identiques → keyset/tri invérifiables.
**Why it happens:** Seed traité comme remplissage cosmétique, pas comme jeu de validation de scalabilité.
**How to avoid:** Ordre topologique strict (parents d'abord, garder les `id` retournés). Volumes ~10k. `created_at`/`verified_at` étalés (luxon). Réutiliser les `instruments.id` existants.
**Warning signs:** Dashboards vides ; FK violations au seed ; perf « bonne » qui s'effondre sur vraies données.

### Pitfall 2 : Stocker un % de performance (VITR-03)
**What goes wrong:** Tentation de pré-calculer un win_rate pour « remplir » un dashboard.
**How to avoid:** Ne JAMAIS écrire de %. Seeder outcomes bruts ; laisser `pattern_stats`/`mv_mrr` calculer. Scan no-perf-seed-claims vert.
**Warning signs:** Champ `win_rate`/`pct` dans le code seed ; migration 0018 ajoutant une colonne de perf.

### Pitfall 3 : Preuve RLS lue via service_role (SEED-03)
**What goes wrong:** Tester l'isolation avec le client service_role → bypass RLS total → test toujours vert et faux.
**How to avoid:** La LECTURE de la preuve passe par anon-client (auth.uid()=A). Le SEEDING utilise service_role mais jamais la lecture asserted. Calquer `affiliate-rls.test.ts`.
**Warning signs:** `createClient(url, SERVICE_ROLE_KEY)` dans la partie assertion du test.

### Pitfall 4 : Épuisement connexions / Auth API rate limit à 10k createUser (PITFALLS #11)
**What goes wrong:** 10k `auth.admin.createUser` en parallèle → « Max client connections » ou rate-limit Auth.
**How to avoid:** `pLimit(5-10)` sur la création users. Batcher les inserts non-auth (chunks 500-1000). Pooler transaction (6543) si SQL direct.
**Warning signs:** Erreurs 429/connexion ; seed qui hang.

### Pitfall 5 : `mv_mrr` non rafraîchie → MRR vide malgré paiements seedés
**What goes wrong:** La matview est un snapshot ; sans `refresh_mv_mrr()` après seed, le dashboard MRR reste vide.
**How to avoid:** Étape finale du seed : `refresh_mv_mrr()` (service_role). Vérifier que l'index unique `mv_mrr_month_idx` existe (requis pour REFRESH CONCURRENTLY — Partie B 0017).
**Warning signs:** `mv_mrr` vide alors que `payments` verified existe.

### Pitfall 6 : `database.types.ts` désynchronisé après 0018
**What goes wrong:** La colonne `source` n'apparaît pas dans les types → `.insert({source:'demo'})` rejeté au typecheck.
**How to avoid:** Après `apply_migration` 0018 + `generate_typescript_types`, ré-éditer `database.types.ts` à la main (convention repo, Pitfall 5 connu). Inclure `source` dans Row/Insert/Update des tables colonnées.
**Warning signs:** `tsc` rouge sur `source` ; champ absent de l'autocomplétion.

## Code Examples

### Test de preuve RLS anon (SEED-03) — calqué sur affiliate-rls.test.ts
```typescript
// Source: packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts (existant)
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Database } from '../../database.types'

const URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const ANON = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const SERVICE = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
const HAS_ENV = Boolean(URL && ANON && SERVICE)

describe.skipIf(!HAS_ENV)('SEED-03 : isolation RLS à l\'échelle (anon)', () => {
  // non-abonné (signUp sans subscription active) → 0 trade_setups
  it('un non-abonné lit 0 ligne de trade_setups', async () => {
    const client = createClient<Database>(URL, ANON)
    await client.auth.signUp({ email: `nosub-${Date.now()}@gmail.com`, password: 'Test123!' })
    const { data, error } = await client.from('trade_setups').select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(0)   // has_active_subscription() = false → barrière RLS
  })
  // user A (abonné) ne voit pas les payments de user B
  it('user A ne lit aucun payment de user B', async () => {
    /* signUp A + B, seed payments B via service_role, lire payments via clientA */
  })
})
```

### Multi-locale faker (fr/en/ar — Open Question 6)
```typescript
// Source: @faker-js/faker docs — instanciation multi-locale
import { Faker, ar, fr, en, base } from '@faker-js/faker'
// Une instance par locale pour des noms cohérents par user (MENA = ar prioritaire)
const fakers = {
  ar: new Faker({ locale: [ar, base] }),
  fr: new Faker({ locale: [fr, base] }),
  en: new Faker({ locale: [en, base] }),
}
Object.values(fakers).forEach(f => f.seed(42))   // déterminisme par instance
// répartition : ~50% ar (MENA), ~30% fr, ~20% en — déterministe par index
const localeOf = (i: number) => (i % 10 < 5 ? 'ar' : i % 10 < 8 ? 'fr' : 'en')
const name = fakers[localeOf(i)].person.fullName()
```
**Note `[ASSUMED]`** : la répartition exacte fr/en/ar et la disponibilité complète du dataset `ar` dans faker 10 (certains modules ont moins de données ar) à confirmer à l'implémentation. `base` en fallback garantit qu'aucun champ ne manque.

### faker.seed() à l'échelle (Open Question 7)
```typescript
// Déterminisme global : seed UNE fois en tête de script, AVANT toute génération.
// L'ordre de génération doit être STABLE entre runs (mêmes boucles, même ordre)
// sinon le même seed produit un dataset différent.
faker.seed(42)
// Inserts batchés via service_role (perf) — l'ordre d'insert n'affecte pas le
// déterminisme de faker tant que l'ordre de GÉNÉRATION est fixe.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `faker` (paquet original, non maintenu) | `@faker-js/faker` (fork communautaire officiel) | 2022 | Toujours le standard en 2026 (v10). Ne jamais installer `faker` tout court. |
| `faker.locale = 'fr'` (mutation globale, v7-) | `new Faker({ locale: [fr, base] })` (instanciation) | faker v8+ | API actuelle multi-locale. Les tutos v7 sont périmés. |
| Seed SQL `db push` | `apply_migration` via MCP + `database.types.ts` main | convention repo (0006+) | Le projet n'est PAS link localement ; toute migration passe par MCP. |

**Deprecated/outdated:**
- Paquet `faker` (sans scope `@faker-js/`) : abandonné/saboté 2022 → utiliser `@faker-js/faker`.
- `faker.locale = …` : remplacé par l'instanciation `new Faker({locale})`.

## Project Constraints (from CLAUDE.md)

- **Migrations SQL = source de vérité unique**, pas d'ORM. Dernière appliquée 0017 → cette phase = **0018**. Appliquer via **MCP `apply_migration`**, JAMAIS `supabase db push` (projet non link).
- **service_role réservé aux jobs** (`apps/jobs`), jamais côté pages web. Le seed est un script `tsx` dans `apps/jobs` → service_role autorisé. Le test RLS utilise anon.
- **Vitest cible 80%**. `@faker-js/faker` en **devDep**.
- **Secrets en `.env`** non commités ; valider présence au démarrage. Pas de secret hardcodé.
- **Déterminisme exigé** (TypeScript strict, Zod). `faker.seed()` non négociable.
- **Borner les opérations en masse** : `pLimit` sur createUser (cohérent avec discipline `p-limit` data-sources).
- **`database.types.ts` édité à la main** après migration (pas de `gen types --linked`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Création users via `auth.admin.createUser` (pas INSERT SQL direct dans auth.users) | Standard Stack / Pattern 1 | Si perf inacceptable à 10k, il faudra évaluer un INSERT SQL batch dans `auth.users` (touche schéma auth — validation fondateur requise). |
| A2 | Ratios distribution démo (37% actifs, 18% expirés, etc.) | Open Question 3 | Choix de démonstration ; le fondateur peut vouloir d'autres ratios. Doit produire dashboards remplis + churn visible. |
| A3 | Volumes par table (~6k payments, ~5k setups, etc.) | Open Question 4 | Sous-dimensionner masque les pièges perf (Pitfall 1). Sur-dimensionner ralentit le seed. À ajuster au planning. |
| A4 | Tables volume (candles/snapshots/job_runs/telegram) reçoivent `source` SI seedées | Périmètre 0018 | Si non seedées, ne pas les colonner. Décision volume au planning. |
| A5 | Répartition locales ~50% ar / 30% fr / 20% en + complétude dataset `ar` faker 10 | Code Examples | Dataset `ar` faker peut être partiel sur certains modules → fallback `base`. |
| A6 | Purge users démo par email pattern (`seed-*@demo.nexa.invalid`) via auth.admin | Ordre purge / D-06 | Si une autre convention d'identification démo est préférée (metadata), adapter. auth.users n'a pas de colonne source. |
| A7 | `mv_mrr_month_idx` (index unique Partie B 0017) existe LIVE | Pitfall 5 / Runtime State | Si l'index n'a pas été appliqué en Phase 17, `REFRESH CONCURRENTLY` échoue → vérifier LIVE avant le refresh post-seed. |

## Open Questions

1. **Volume `candles`/`snapshots` à seeder ?**
   - Connu : SCALE-06 (Phase 21) consomme le volume ; ces tables n'ont pas de FK user.
   - Inconnu : combien de bougies par instrument/TF rendent l'audit pertinent sans gonfler le seed.
   - Recommandation : trancher au planning (proposition : ~10-20k candles total, 12 instruments × 3 TF × ~400-500 bougies).

2. **Perf réelle de `auth.admin.createUser` à 10k sur le plan Supabase courant ?**
   - Connu : 1 appel réseau/user, rate-limité.
   - Inconnu : durée totale acceptable. À mesurer ; prévoir un mode « N réduit » paramétrable pour les itérations.

3. **La migration 0018 doit-elle indexer `source` ?**
   - Le `delete WHERE source='demo'` à 10k bénéficierait d'un index partiel `(source) WHERE source='demo'`.
   - Recommandation : ajouter un index léger sur `source` sur les grosses tables purgées directement (analyses, trade_setups, payments) — non bloquant si fait `CONCURRENTLY` hors transaction (Pitfall 9).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@faker-js/faker` | Génération seed | ✗ (à installer) | 10.5.0 dispo npm | aucune (verrouillé CONTEXT) |
| `tsx` | Exécution seed | ✓ | 4.22.4 | — |
| `@supabase/supabase-js` | Écriture + preuve RLS | ✓ | 2.108.0 | — |
| `vitest` | Tests SEED-02/03 | ✓ | 4.1.8 | — |
| `luxon` | Étalement dates | ✓ | 3.7.2 | — |
| `p-limit` | Bornage createUser | partiel (écosystème) | 7.3.0 | bornage manuel via batches séquentiels |
| Supabase live (URL+keys) | Apply 0018 + seed + refresh mv | ✓ (MCP connecté) | — | — |
| Index `mv_mrr_month_idx` | refresh_mv_mrr post-seed | à VÉRIFIER LIVE | — | `REFRESH … ` non concurrent (lock lecture) si absent |

**Missing dependencies with no fallback:** `@faker-js/faker` (installation triviale `pnpm add -D -w`).
**Missing dependencies with fallback:** `p-limit` (si absent du workspace seed, bornage par batches séquentiels).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (racine — charge `.env.test` natif) |
| Quick run command | `pnpm test` (vitest run) |
| Full suite command | `pnpm test` + `pnpm typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEED-01 | Seed idempotent FK-cohérent, re-run → N stable | integration (skipIf live) | `pnpm test -- seed` puis 2e run → COUNT identique | ❌ Wave 0 |
| SEED-02 | Aucun % de perf seedé (scan code) | unit (statique, sans DB) | `pnpm test -- no-perf-seed-claims` | ❌ Wave 0 |
| SEED-02 | Labellisation `source` requêtable | integration | assertion `SELECT count WHERE source='demo' > 0` | ❌ Wave 0 |
| SEED-03 | Non-abonné lit 0 signal (anon) + isolation cross-user | integration (skipIf) | `pnpm test -- seed-rls` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- <fichier ciblé>` + `pnpm typecheck`
- **Per wave merge:** `pnpm test` complet
- **Phase gate:** suite verte + re-run seed manuel prouvant N stable + `get_advisors(security)` confirme `source` n'ouvre aucune fuite RLS.

### Wave 0 Gaps
- [ ] `apps/web/test/no-perf-seed-claims.test.ts` — couvre SEED-02 (scan code seed, sans DB → toujours exécutable en CI)
- [ ] `packages/supabase/src/repositories/__tests__/seed-rls.test.ts` — couvre SEED-03 (anon, `describe.skipIf(!HAS_ENV)`)
- [ ] `apps/jobs/scripts/seed/*` — structure du seed (config volumes/ratios isolée pour testabilité)
- [ ] Migration `0018_seed_source_column.sql` — colonne `source` (gate avant tout seed)
- [ ] Régénération `database.types.ts` après 0018 (manuel, convention repo)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `auth.admin.createUser` (service_role) ; users démo isolés (emails `.invalid`, metadata seed). Jamais de vrais emails routables. |
| V3 Session Management | no | Le seed ne gère pas de sessions. |
| V4 Access Control | **yes** | Cœur SEED-03 : RLS prouvée anon. `source` ne doit JAMAIS apparaître dans une policy d'ouverture de lecture (c'est un label de provenance, pas un gate). Vérifier `get_advisors(security)` après 0018. |
| V5 Input Validation | yes | `source` borné par `check (source in ('live','demo','backtest'))`. Montants `*_atomic` en bigint (pas de float). |
| V6 Cryptography | no | Pas de crypto introduite. |

### Known Threat Patterns for seed/Supabase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Preuve RLS lue via service_role (faux vert) | Info Disclosure | Lecture anon-client uniquement dans les assertions (D-07). |
| `source` utilisé comme gate de lecture par erreur | Elevation | `source` = label seulement ; aucune policy ne doit `using (source=…)`. Re-tester non-abonné → 0 ligne. |
| Users démo avec emails réels routables | Info Disclosure / spam | Domaine `.invalid` (RFC 2606, jamais routé) + metadata `seed:true`. |
| Purge `TRUNCATE` détruisant des données `live` | Tampering / Destruction | Purge ciblée `WHERE source='demo'` exclusivement (D-06). |
| service_role key fuite hors `apps/jobs` | Elevation | Seed reste dans `apps/jobs` (barrière `server-only` + lint existants). |

## Sources

### Primary (HIGH confidence)
- Code projet — migrations `0001`,`0003`,`0005`,`0006`,`0008`,`0009`,`0010`,`0012`,`0014`,`0015`,`0016`,`0017` lues intégralement (graphe FK, RLS, vues/matviews, RPC). **HIGH**
- Code projet — `packages/supabase/src/{service-client,anon-client}.ts`, `repositories/__tests__/affiliate-rls.test.ts`, `apps/web/test/no-perf-claims.test.ts`, `vitest.config.ts`. **HIGH** (patterns réutilisables)
- npm registry — `@faker-js/faker` 10.5.0 publié 2026-06-17, repo officiel faker-js, 16,7M dl/sem, 0 postinstall. slopcheck **[OK]**. Vérifié 2026-06-25. **HIGH**
- `.planning/research/PITFALLS.md` §Pitfall #5/#11/#12 (seed incohérent, RLS perf, connexions). **HIGH**
- `.planning/phases/18-…/18-CONTEXT.md` (D-01→D-07 verrouillés). **HIGH**

### Secondary (MEDIUM confidence)
- faker multi-locale API (`new Faker({locale})`) — connaissance écosystème + docs faker. **MEDIUM** (à reconfirmer complétude dataset `ar` à l'implémentation)

### Tertiary (LOW confidence)
- Ratios de distribution démo et volumes par table — propositions chiffrées `[ASSUMED]` à valider fondateur/planner.

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — faker vérifié npm+slopcheck, reste déjà dans le repo.
- Architecture / graphe FK / périmètre source / ordre purge : HIGH — migrations lues intégralement.
- Ratios/volumes/locales : LOW-MEDIUM — choix de démonstration `[ASSUMED]`, à confirmer.
- Pitfalls : HIGH — issus de PITFALLS.md projet + schéma réel.

**Research date:** 2026-06-25
**Valid until:** ~2026-07-25 (stable ; faker peut bouger de patch, schéma DB stable)
