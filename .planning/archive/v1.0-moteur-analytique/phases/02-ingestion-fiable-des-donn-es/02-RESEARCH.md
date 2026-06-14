# Phase 2 : Ingestion fiable des données - Recherche

**Researched:** 2026-06-12
**Domain:** Ingestion de données de marché multi-sources (OHLCV, news, macro, calendrier éco) — clients fetch/SDK + jobs idempotents tolérants aux pannes
**Confidence:** HIGH (endpoints/SDK vérifiés sources officielles ; 1 zone MEDIUM = testnet Binance)

## Summary

La Phase 2 branche des clients data-sources sur le runner agnostique de Phase 1 (`runJob` → `job_runs`, dispatcher tsx). Aucun nouveau pattern d'infra : chaque job d'ingestion n'apporte QUE sa logique métier (pull → normalise UTC → upsert idempotent) et délègue le monitoring/erreur à `runJob`. La stack est verrouillée par CLAUDE.md (SDK `binance` tiagosiebler, SDK `finnhub`, clients fetch+Zod maison pour OANDA/Marketaux/FRED, `p-retry`/`p-limit`, luxon, Zod v4, pino) — la recherche porte sur *comment* utiliser ces libs, pas sur des alternatives.

Les 6 research flags de CONTEXT.md sont résolus. Le point dur : **le testnet spot Binance se réinitialise périodiquement et ne sert PAS un historique de 2 ans** — le backfill DOIT utiliser le REST public mainnet en lecture seule (klines = endpoint non signé, aucune clé requise). Deuxième point : **le calendrier économique de Finnhub free est verrouillé premium** → source gratuite retenue = flux JSON hebdomadaire FairEconomy/ForexFactory (`nfs.faireconomy.media/ff_calendar_thisweek.json`).

**Primary recommendation:** Un job d'ingestion par classe de source (`market-ingest` OHLCV, `news-ingest`, `macro-ingest`, `calendar-ingest`), chacun auto-rattrapant (gap fill basé sur la dernière ligne en base — D-22), chacun isolant ses erreurs par instrument/source dans `job_runs.stats` (DATA-07). Idempotence par contrainte `unique` Postgres + `upsert ... onConflict` du client supabase-js. Backfill OHLCV pagine par fenêtres : OANDA `count` max 5000 (count XOR from/to), Binance klines max 1000/req via `startTime`/`endTime`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pull OHLCV (OANDA/Binance) | apps/jobs (job market-ingest) | packages/data-sources (clients) | Côté serveur, service_role ; jamais le navigateur |
| Pull news + sentiment | apps/jobs (news-ingest) | packages/data-sources | Idem ; rate limits gérés côté job |
| Pull macro FRED | apps/jobs (macro-ingest) | packages/data-sources | 1×/jour, déterministe |
| Pull calendrier éco | apps/jobs (calendar-ingest) | packages/data-sources | Flux hebdo caché, alimente Phase 3 news_risk |
| Normalisation UTC / bougie clôturée | packages/core (déjà fait P1) | apps/jobs | Constantes verrouillées — consommer, pas redéfinir |
| Validation des payloads sources | packages/data-sources (Zod) | — | Frontière d'ingestion = ne jamais faire confiance à la donnée externe |
| Upsert idempotent + repositories | packages/supabase | apps/jobs | Pattern repository typé établi (jobRuns.ts modèle) |
| Calcul/exposition staleness | Postgres (vue/colonne calculée) | apps/web (lecture P5) | La staleness est un contrat DB lu par Phase 4/5 |
| Seed univers 12 instruments | Migration SQL (données) | — | Univers extensible par UPDATE, pas par code (D-17) |

## Standard Stack

> Stack **verrouillée par CLAUDE.md** — ne PAS substituer. Versions vérifiées sur npm le 2026-06-12.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `binance` (tiagosiebler) | `3.5.10` (npm latest ; CLAUDE.md verrouille 3.5.9 — bump patch sans rupture) | Client Binance REST klines (crypto OHLCV) | `[CITED: github.com/tiagosiebler/binance]` TS natif, `testnet: true` + mainnet public |
| `finnhub` | `2.0.14` | News marché par catégorie (crypto/forex/general) | `[CITED: github.com/Finnhub-Stock-API/finnhub-js]` SDK officiel |
| OANDA v20 | **client fetch+Zod maison** (PAS `@oanda/v20`) | OHLCV FX/métaux/énergie | `[CITED: CLAUDE.md]` API REST simple, déterminisme |
| Marketaux | **client fetch+Zod maison** | News fallback | `[CITED: CLAUDE.md]` pas de SDK fiable |
| FRED | **client fetch+Zod maison** | Séries macro | `[CITED: CLAUDE.md]` API triviale |
| `zod` | `4.4.3` | Validation frontières d'ingestion | `[VERIFIED: npm registry]` v4 verrouillée |
| `luxon` | `3.7.2` | UTC, fenêtres de backfill, sessions/DST, stale hors-marché | `[VERIFIED: npm registry]` déjà utilisé P1 |
| `@supabase/supabase-js` | `2.108.0` | service_role + `.upsert(onConflict)` | `[CITED: CLAUDE.md]` déjà installé P1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-retry` | `8.0.0` | Backoff 429/5xx, respect `Retry-After` | ESM only — chaque appel data-source |
| `p-limit` | `7.3.0` | Borne la concurrence des pulls | ESM only — par source (valeurs §rate limits) |
| `pino` | `10.3.1` | Logs structurés → `job_runs.stats` | Déjà câblé dans `runJob` |
| `tsx` | `4.22.4` | Exécution directe TS des jobs | Déjà câblé dans dispatch |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `binance` SDK | `ccxt` | **Interdit P1** (CLAUDE.md What NOT to Use) — bundle lourd mono-exchange |
| Client OANDA maison | `@oanda/v20` | **Interdit** (binding généré non typé) |
| Contrainte unique + upsert | Drizzle/Prisma | **Interdit** (dédouble la source de vérité du schéma) |

**Installation:**
```bash
# Jobs / data-sources (ESM) — versions épinglées CLAUDE.md
pnpm --filter @app/data-sources add binance@3.5.9 finnhub@2.0.14 p-retry@8.0.0 p-limit@7.3.0 luxon@3.7.2
# (zod, pino, @supabase/supabase-js, tsx déjà présents depuis P1)
# OANDA / Marketaux / FRED = clients fetch maison (aucun paquet npm) dans packages/data-sources
```
> Note ESM : `p-retry 8` / `p-limit 7` sont ESM-only — OK, les jobs tournent en ESM (`"type":"module"` + tsx). Ne jamais `require()`.

**Version verification (2026-06-12, npm registry):** binance `3.5.10` (verrouiller `3.5.9` CLAUDE.md), finnhub `2.0.14`, p-retry `8.0.0`, p-limit `7.3.0`, luxon `3.7.2`, zod `4.4.3`, pino `10.3.1`, tsx `4.22.4`. `[VERIFIED: npm registry]`

## Package Legitimacy Audit

> slopcheck bloqué par le sandbox (install/exécution d'un paquet non déclaré refusée). Graceful degradation appliquée : chaque paquet vérifié directement sur npm registry ET nommé dans la stack verrouillée CLAUDE.md (source projet autoritaire). Les SDK ont des dépôts source publics actifs.

| Package | Registry | Source Repo | slopcheck | Disposition |
|---------|----------|-------------|-----------|-------------|
| `binance` | npm 3.5.10 | github.com/tiagosiebler/binance (actif) | non exécuté | Approuvé (CLAUDE.md locked 3.5.9) |
| `finnhub` | npm 2.0.14 | github.com/Finnhub-Stock-API/finnhub-js | non exécuté | Approuvé (officiel + locked) |
| `p-retry` | npm 8.0.0 | github.com/sindresorhus/p-retry | non exécuté | Approuvé (sindresorhus) |
| `p-limit` | npm 7.3.0 | github.com/sindresorhus/p-limit | non exécuté | Approuvé (sindresorhus) |
| `luxon` | npm 3.7.2 | github.com/moment/luxon | non exécuté | Approuvé (déjà P1) |
| `zod` | npm 4.4.3 | github.com/colinhacks/zod | non exécuté | Approuvé (déjà P1) |
| `pino` | npm 10.3.1 | github.com/pinojs/pino | non exécuté | Approuvé (déjà P1) |

**Packages retirés ([SLOP]) :** aucun.
**Packages suspects ([SUS]) :** aucun. Tous proviennent de mainteneurs établis (sindresorhus, moment, colinhacks, pinojs) ou de la stack verrouillée projet. Le planner peut omettre les checkpoints human-verify : ces paquets sont des décisions verrouillées CLAUDE.md, pas des découvertes de recherche.

## Architecture Patterns

### System Architecture Diagram

```
                  ┌──────────── DISPATCHER (apps/jobs/src/dispatch.ts, P1) ────────────┐
                  │  tsx src/dispatch.ts <market-ingest|news-ingest|macro-ingest|...>   │
                  └───────────────────────────┬───────────────────────────────────────┘
                                              │ runJob(name, fn)  → job_runs running
                                              ▼
   ┌────────────────────────────── JOBS D'INGESTION (logique métier seule) ──────────────────────────────┐
   │                                                                                                       │
   │  market-ingest          news-ingest              macro-ingest            calendar-ingest             │
   │  ┌───────────────┐      ┌────────────────┐       ┌──────────────┐        ┌────────────────┐         │
   │  │ pour chaque   │      │ Finnhub (prim) │       │ FRED series  │        │ FairEconomy    │         │
   │  │ instrument    │      │ → Marketaux    │       │ DFF/CPIAUCSL │        │ ff_calendar    │         │
   │  │ actif × TF    │      │   (fallback)   │       │ DTWEXBGS/    │        │ _thisweek.json │         │
   │  │ (H1/H4/D)     │      │ par catégorie  │       │ DFII10       │        │ (caché 1×/sem) │         │
   │  └──────┬────────┘      └───────┬────────┘       └──────┬───────┘        └───────┬────────┘         │
   │         │ gap fill              │ url_hash dédup        │ upsert               │ upsert            │
   │         ▼                       ▼                       ▼                      ▼                   │
   │  packages/data-sources : clients fetch+Zod (OANDA/Marketaux/FRED/FairEconomy) + SDK (binance/finnhub)│
   │  chaque appel : p-limit(n) ∘ p-retry(backoff, Retry-After)                                          │
   │  chaque réponse : parse Zod (frontière) → normalise UTC (packages/core) → ligne typée               │
   │         │                                                                                            │
   │         │  erreur source/instrument → try/catch local → push dans stats[], les AUTRES continuent     │
   └─────────┼────────────────────────────────────────────────────────────────────────────────────────┘
             ▼  upsert idempotent (onConflict = clé unique) via repositories typés (service_role)
   ┌──────────────────────────────── SUPABASE (Postgres) ────────────────────────────────┐
   │  instruments (étendu) · candles · news · macro_series · economic_calendar             │
   │  + vue v_data_freshness (calcul stale, tenant compte horaires de cotation)            │
   │  job_runs.stats ← { inserted, skipped, errors:[{source,instrument,msg}] }             │
   └──────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
packages/data-sources/
├── src/
│   ├── oanda/
│   │   ├── client.ts        # fetch + Bearer, GET candles, pagination count/from/to
│   │   ├── schema.ts        # Zod : CandleResponse OANDA → OHLCV normalisé
│   │   └── instruments.ts   # mapping symbole OANDA (EUR_USD, WTICO_USD...)
│   ├── binance/
│   │   ├── client.ts        # MainClient (testnet:true ou mainnet public), getKlines
│   │   └── schema.ts        # Zod : Kline[] tuple → OHLCV normalisé
│   ├── finnhub/client.ts    # SDK marketNews(category)
│   ├── marketaux/client.ts  # fetch + Zod, fallback
│   ├── fred/client.ts       # fetch + Zod, series/observations
│   ├── faireconomy/client.ts# fetch JSON calendrier, cache hebdo
│   └── index.ts
apps/jobs/src/jobs/
│   ├── market-ingest.ts     # gap fill OHLCV multi-instrument/TF (plan 02)
│   ├── news-ingest.ts       # plan 04
│   ├── macro-ingest.ts      # plan 04
│   └── calendar-ingest.ts   # plan 04
packages/supabase/src/repositories/
│   ├── candles.ts           # upsertCandles(onConflict)
│   ├── news.ts              # upsertNews(onConflict url_hash)
│   ├── macroSeries.ts
│   └── economicCalendar.ts
```

### Pattern 1 : Gap fill auto-rattrapant (D-22)
**What:** un seul job lit la dernière bougie en base par (instrument, TF) puis tire ce qui manque. Premier run = backfill complet, runs suivants = incrémental.
**When to use:** tout OHLCV (market-ingest). Robuste au PC éteint plusieurs jours.
**Example:**
```typescript
// Pseudocode — la borne haute exclusive vient de packages/core (anti look-ahead)
import { lastClosedCandleStart, TIMEFRAMES } from '@app/core'
import { DateTime } from 'luxon'

const last = await getLastCandleTs(client, instrumentId, tf)           // null au 1er run
const since = last ?? backfillStart(tf)                                 // 2 ans D / 6 mois H4/H1
const until = lastClosedCandleStart(DateTime.utc(), TIMEFRAMES[tf])     // exclut bougie en cours
// pagine entre since et until (OANDA count≤5000 ; Binance limit≤1000)
```

### Pattern 2 : Isolation des pannes par source (DATA-07)
**What:** chaque (source × instrument) est dans son propre try/catch ; une erreur est poussée dans un tableau `stats.errors`, jamais propagée — le job retourne `success` partiel.
**When to use:** tous les jobs multi-cible.
**Example:**
```typescript
const stats = { inserted: 0, skipped: 0, errors: [] as Array<{instrument:string,msg:string}> }
for (const inst of activeInstruments) {
  try { stats.inserted += await ingestOne(inst) }
  catch (e) { stats.errors.push({ instrument: inst.symbol, msg: String(e) }) } // les autres continuent
}
return stats  // runJob l'écrit dans job_runs.stats ; status reste 'success'
```
> Couper une clé API d'UNE source ⇒ ses instruments échouent, les autres ingèrent. Prouvable par test (voir Validation Architecture).

### Pattern 3 : Upsert idempotent (DATA-06)
**What:** contrainte `unique` Postgres + `.upsert(rows, { onConflict: '...', ignoreDuplicates: false })`.
**Example:**
```typescript
// repository candles.ts
await client.from('candles').upsert(rows, {
  onConflict: 'instrument_id,timeframe,ts',   // = index unique de la migration
  ignoreDuplicates: false,                    // ré-écrit (corrections de bougie) sans doublon
})
```
> Re-run complet ⇒ 0 nouvelle ligne. Clés uniques : candles `(instrument_id,timeframe,ts)`, news `url_hash`, macro `(series_code,ts)`, calendar `(event_key)`.

### Pattern 4 : Backfill paginé OANDA (count XOR from/to)
**What:** OANDA refuse `count` + (`from`&`to`) ensemble. Pour un backfill borné, utiliser `from`+`to`+`granularity` (count auto), OU boucler par `count=5000` + `includeFirst=false` à partir du dernier `to`.
**Example:**
```
GET /v3/instruments/EUR_USD/candles?granularity=H1&from=<iso>&to=<iso>&price=M
# OU pagination : ?granularity=H1&count=5000&from=<dernier_ts>&includeFirst=false
```

### Anti-Patterns to Avoid
- **Utiliser le testnet Binance pour le backfill historique** : il se réinitialise (pas d'historique 2 ans) → utiliser le REST public mainnet (klines non signé). Le `testnet:true` reste pour la cohérence "démo d'abord" sur les opérations qui touchent un compte, jamais pour l'historique klines.
- **Calendrier éco via Finnhub free** : endpoint premium-locked → 403/données vides. Utiliser FairEconomy JSON.
- **`news-sentiment` Finnhub free** : premium-locked et US-equities only. En crypto/forex, prendre le sentiment du provider de news tel quel (D-30) ou ne pas stocker de sentiment Finnhub.
- **`company-news` Finnhub pour forex/crypto** : ne couvre que les actions nord-américaines. Utiliser `marketNews(category)`.
- **Mixer horloge locale et `now()` Postgres** (héritage P1) : `started_at`/`finished_at` viennent de l'horloge locale.
- **Heuristique de matching mots-clés maison** pour mapper news→instrument : interdit par D-28 (requête ciblée par catégorie/symbole, la news arrive déjà mappée).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backoff / retry 429/5xx | boucle setTimeout maison | `p-retry` + respect `Retry-After` | edge cases (jitter, Retry-After, abort) |
| Limiter la concurrence | sémaphore maison | `p-limit(n)` | testé, ESM, simple |
| Idempotence | "SELECT puis INSERT si absent" | `unique` + `upsert onConflict` | atomique, sans race condition |
| Klines Binance + pagination | fetch REST + signature maison | SDK `binance` `getKlines` | typage + base URLs gérés |
| Sessions/DST forex (week-end ≠ stale) | calcul d'offset maison | luxon `setZone` + `DAILY_ANCHOR` (P1) | DST automatique |
| Bougie clôturée / anti look-ahead | floor maison | `lastClosedCandleStart` (packages/core P1) | déjà testé 16/16 golden |

**Key insight:** tout l'échafaudage (retry, concurrence, idempotence, temps) existe déjà — sous forme de libs verrouillées ou de constantes P1. La Phase 2 n'écrit que le *mapping source→ligne typée* et l'*orchestration gap-fill*.

## Runtime State Inventory

> Phase greenfield additive (création de tables + jobs neufs), mais elle introduit un seed de données et touche `instruments`. Inventaire ciblé :

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Table `instruments` P1 a 3 lignes seed (XAU_USD, EUR_USD, BTCUSDT) AVEC schéma actuel (colonnes `pip_size/min_size/precision/active`). Le seed P2 = 12 instruments. | Migration : ajouter colonnes (symbole canonique, symbole par source, catégorie étendue, horaires cotation), upsert/remplacer le seed. Vérifier que les 3 lignes existantes ne créent pas de doublon. |
| Live service config | Aucune (pas de service externe enregistrant un état). Clés API stockées en `.env` jobs uniquement. | None |
| OS-registered state | Windows Task Scheduler P1 pointe `run-job.cmd <job>`. Les nouveaux jobs (market-ingest...) doivent être déclenchés. | Re-enregistrer/ajouter des déclencheurs Task Scheduler (cadence horaire D-25, FRED 1×/jour). Manuel ou doc. |
| Secrets/env vars | Nouvelles clés requises : `OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID`, `BINANCE_API_KEY/SECRET` (testnet, optionnel pour klines publics), `FINNHUB_API_KEY`, `MARKETAUX_API_KEY`, `FRED_API_KEY`. | Étendre `.env.example` (contrat commité, valeurs vides) + `.env` jobs local. FairEconomy = aucune clé. |
| Build artifacts | `packages/data-sources` n'existe pas encore (D-11 le crée à cette phase). `database.types.ts` sera périmé après migration. | Créer le package ; régénérer les types Supabase après chaque migration (MCP `generate_typescript_types`). |

**Nothing found pour Live service config / OS state au-delà de Task Scheduler** — vérifié : aucun webhook, aucun process daemon, pas de croner enregistré (D-25 utilise Task Scheduler seul).

## Common Pitfalls

### Pitfall 1 : Testnet Binance sans historique
**What goes wrong:** backfill 2 ans sur testnet ⇒ peu/pas de bougies, données incohérentes.
**Why:** le Spot Test Network est réinitialisé périodiquement (état vierge). `[CITED: developers.binance.com/docs/binance-spot-api-docs/testnet]`
**How to avoid:** klines = endpoint public non signé → utiliser le REST mainnet (`new MainClient({})`, aucune clé) pour TOUT l'OHLCV crypto. Réserver `testnet:true` aux éventuelles opérations de compte (hors P2).
**Warning signs:** `getKlines` renvoie < N bougies attendues ; gaps massifs.

### Pitfall 2 : Calendrier/sentiment Finnhub premium-locked
**What goes wrong:** `economicCalendar` et `news-sentiment` renvoient 403/vide sur clé free.
**Why:** premium sur free tier ; sentiment limité aux actions US. `[CITED: finnhub.io/docs/api]`
**How to avoid:** calendrier ⇒ FairEconomy JSON ; news ⇒ `marketNews("crypto"|"forex"|"general")` (free) ; sentiment ⇒ provider tel quel (D-30), pas Finnhub sentiment.

### Pitfall 3 : OANDA count + from/to incompatibles
**What goes wrong:** 400 Bad Request si `count` ET (`from`&`to`) fournis.
**Why:** mutuellement exclusifs par design. `[CITED: developer.oanda.com/rest-live-v20/instrument-ep]`
**How to avoid:** backfill = `from`+`to`+`granularity` (count auto ≤5000), ou pagination `count=5000`+`from`+`includeFirst=false`. Forcer `includeFirst=false` entre pages pour éviter la bougie dupliquée à la jointure.

### Pitfall 4 : Stale faux-positif le week-end (forex)
**What goes wrong:** EUR_USD marqué `stale` samedi/dimanche alors que le marché est fermé.
**Why:** le seuil "2× le TF" (D-26) ne sait pas que le marché FX ferme vendredi 17:00 NY → dimanche 17:00 NY.
**How to avoid:** la vue/colonne de staleness doit consulter les horaires de cotation par instrument (D-19) via luxon `DAILY_ANCHOR`/sessions ; marché fermé ⇒ `stale=false`. Crypto = 24/7, toujours évaluable.

### Pitfall 5 : Rate limit FairEconomy
**What goes wrong:** 429/blocage si on tire le flux à chaque run horaire.
**Why:** FairEconomy limite à 2 téléchargements / 5 min, recommande 1×/semaine. `[CITED: forexfactory.com]`
**How to avoid:** cacher le JSON (table ou fichier), re-télécharger 1×/jour max (idéalement hebdo), servir le cache aux runs horaires.

### Pitfall 6 : `database.types.ts` périmé
**What goes wrong:** TypeScript ne connaît pas `candles`/`news`/... ⇒ repositories non typés.
**Why:** types générés figés ; nouvelle migration non régénérée.
**How to avoid:** après CHAQUE `apply_migration`, lancer MCP `generate_typescript_types` (ou `supabase gen types`) et committer.

## Code Examples

### Klines crypto (mainnet public, backfill)
```typescript
// Source: github.com/tiagosiebler/binance/blob/master/src/main-client.ts L823
import { MainClient } from 'binance'
const client = new MainClient({})                 // pas de clé : klines est non signé (mainnet public)
const klines = await client.getKlines({
  symbol: 'BTCUSDT',
  interval: '1h',                                 // KlineInterval : '1h' | '4h' | '1d' ...
  startTime: sinceMs,
  endTime: untilMs,
  limit: 1000,                                    // max 1000/req, poids 2
})  // Kline[] = tuples [openTime, open, high, low, close, volume, closeTime, ...]
```

### News marché par catégorie (Finnhub free)
```typescript
// Source: github.com/Finnhub-Stock-API/finnhub-js README L182
finnhubClient.marketNews('crypto', {}, (error, data) => { /* general | crypto | forex */ })
// D-28 : mapping par catégorie ciblée, pas d'heuristique mots-clés.
```

### OANDA candles (client fetch maison)
```typescript
// Source: developer.oanda.com/rest-live-v20/instrument-ep
const url = `${OANDA_BASE}/v3/instruments/EUR_USD/candles`
  + `?granularity=H1&from=${fromIso}&to=${toIso}&price=M`   // count XOR from/to
const res = await fetch(url, { headers: { Authorization: `Bearer ${OANDA_API_TOKEN}` } })
const parsed = OandaCandlesSchema.parse(await res.json())    // Zod frontière
// Demo base URL = https://api-fxpractice.oanda.com
```

### FRED série macro (client fetch maison)
```typescript
// Source: fred.stlouisfed.org (series/observations)
const url = `https://api.stlouisfed.org/fred/series/observations`
  + `?series_id=DFF&api_key=${FRED_API_KEY}&file_type=json`
  + `&observation_start=${twoYearsAgo}`
const parsed = FredObservationsSchema.parse(await res.json())
```

### Calendrier éco (FairEconomy, caché)
```typescript
// Source: nfs.faireconomy.media/ff_calendar_thisweek.json
const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json')
const events = FairEconomyCalendarSchema.parse(await res.json())
// champs : title, country, date (ISO), impact (High|Medium|Low), forecast, previous
// cacher : re-fetch 1×/jour max (rate limit 2/5min)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers` | `@supabase/ssr` | — (déjà P1) | sans objet en P2 |
| Finnhub free `company-news` pour tout | `marketNews(category)` pour forex/crypto | Finnhub a restreint company-news aux actions NA | P2 utilise marketNews |
| Finnhub `economicCalendar` free | premium-locked | restriction tier free | P2 utilise FairEconomy |
| binance 3.5.9 (CLAUDE.md) | 3.5.10 (npm latest) | patch | non-bloquant, garder `3.5.9` épinglé |

**Deprecated/outdated:**
- `@oanda/v20`, `ccxt` (P1), ORM : interdits par CLAUDE.md.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Le compte démo OANDA (api-fxpractice) sert WTICO_USD, XAU_USD, XAG_USD et les 4 paires FX | Pitfalls / Stack | MEDIUM — instruments confirmés sur OANDA en général ; la disponibilité *exacte sur CE compte démo* n'a pas pu être testée (pas de clé en recherche). Vérifier au 1er run via `GET /v3/accounts/{id}/instruments` ; D-20 gère l'absence (skip + erreur tracée). |
| A2 | Les 5 paires USDT existent sur testnet spot Binance | Décisions D-14 | LOW — sans objet pour l'OHLCV (on tire le mainnet public). N'impacte que d'éventuelles opérations de compte hors P2. |
| A3 | FairEconomy JSON reste accessible sans clé et stable de format | Calendrier | MEDIUM — flux communautaire ForexFactory ; format `title/country/date/impact` confirmé par sources tierces, pas par doc officielle. Parser tolérant (Zod) + fallback : si indisponible, table calendrier vide ⇒ Phase 3 news_risk dégradé, pas bloquant. |
| A4 | `marketNews` free renvoie crypto/forex utilisables | News | MEDIUM — endpoint confirmé free ; volume/qualité par catégorie non mesurés. Marketaux en fallback (D-29). |
| A5 | DTWEXBGS = bon proxy DXY sur FRED | Macro | LOW — DTWEXBGS = Trade Weighted USD Broad Goods&Services (≠ ICE DXY exact mais proxy macro valable). Alternative : pas de DXY pur gratuit sur FRED. Documenter la sémantique. |

## Open Questions (RESOLVED)

1. **Disponibilité exacte WTICO_USD sur le compte démo OANDA précis** — **RESOLVED:** mitigation D-20 retenue (skip + log + continuer, jamais bloquant) ; vérification déléguée au 1er run réel via `GET /v3/accounts/{accountId}/instruments` (logguer les symboles absents dans `job_runs.stats`). Pas de blocage planning.
   - Ce qu'on sait : WTICO_USD est le symbole OANDA correct pour le WTI ; XAU_USD/XAG_USD/EUR_USD/GBP_USD/USD_JPY/AUD_USD sont standards.
   - Inconnu (levé à l'exécution) : la liste exacte servie par CE compte démo.
   - Décision : au démarrage de market-ingest, appeler `GET /v3/accounts/{accountId}/instruments` une fois, logguer les symboles absents (D-20). L'absence d'un instrument n'interrompt pas l'ingestion des autres (DATA-07).

2. **Granularité H4 native OANDA vs agrégation** — **RESOLVED:** tirer la granularité **H4 native** d'OANDA (`granularity=H4`), PAS d'agrégation maison depuis H1. Alignement vérifié contre `packages/core` au 1er run.
   - Ce qu'on sait : OANDA expose H4 nativement (liste des granularités inclut H4).
   - Inconnu (levé à l'exécution) : l'alignement H4 OANDA (ancrage) vs la convention interne.
   - Décision : `granularity=H4` natif (zéro agrégation côté job) ; au 1er run, comparer l'ancrage des bornes OANDA aux constantes `packages/core` et tracer tout écart dans `job_runs.stats`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ESM + tsx | tous les jobs | ✓ (P1) | tsx 4.22.4 | — |
| Supabase (cloud, MCP) | upsert/migrations | ✓ | project csotpitrjxryjkadyiml | — |
| Clé OANDA démo (token + accountId) | market-ingest FX | ✗ à fournir | — | **bloquant FX** — D-20 skip si absent |
| Clé Binance (testnet) | hors klines | optionnel | — | klines mainnet public = aucune clé |
| Clé Finnhub free | news-ingest | ✗ à fournir | — | Marketaux fallback (D-29) |
| Clé Marketaux free | news fallback | ✗ à fournir | — | dégradé (Finnhub seul) |
| Clé FRED | macro-ingest | ✗ à fournir | — | **bloquant macro** si absente |
| FairEconomy JSON | calendar-ingest | ✓ (sans clé) | — | calendrier vide (Phase 3 dégradée) |

**Missing dependencies sans fallback (bloquantes) :**
- Token OANDA démo (FX/métaux/énergie) ; clé FRED (macro). À placer dans `apps/jobs/.env` avant exécution. La staleness/D-20 rend leur absence visible, pas crashante.
</content>
