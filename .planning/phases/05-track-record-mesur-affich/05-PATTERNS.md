# Phase 5 : Track record mesuré & % affiché — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 7 nouveaux + 3 modifiés
**Analogs found:** 7 / 7 (1 partiel — RLS `anon` sans précédent dans le repo)

> Tous les analogs ci-dessous ont été lus dans le repo réel (pas déduits de RESEARCH). Chemins et n° de ligne vérifiés.

---

## File Classification

| Nouveau / Modifié | Rôle | Data Flow | Analog le plus proche | Qualité |
|-------------------|------|-----------|------------------------|---------|
| `packages/core/src/replay/outcome.ts` | utility (logique pure) | transform / batch | `packages/core/src/time/candle.ts` | role-match (pure déterministe core) |
| `packages/core/src/replay/outcome.test.ts` | test | — | `packages/core/src/time/candle.test.ts` | exact (golden Vitest) |
| `apps/jobs/src/jobs/outcome-tracker.ts` | job (service) | batch / I/O | `apps/jobs/src/jobs/subscription-expiry.ts` | exact |
| `apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts` | test | — | `apps/jobs/src/jobs/__tests__/subscription-expiry.test.ts` | exact |
| `packages/supabase/src/repositories/predictionOutcomes.ts` | repository (service_role write) | CRUD | `packages/supabase/src/repositories/candles.ts` + `tradeSetups.ts` | exact |
| `packages/supabase/src/repositories/patternStats.ts` | repository (anon read) | request-response | `anon-client.ts` (lecture RSC) — pas de repo read anon existant | partial |
| `supabase/migrations/0014_prediction_outcomes_pattern_stats.sql` | migration | — | `supabase/migrations/0006_analyses_trade_setups.sql` + `0003` (candles) | role-match (RLS `anon` = NEUF) |
| `apps/web/.../components/TrackRecordBlock.tsx` (+ MethodologyPage) | component (RSC) | request-response | `apps/web/src/app/[locale]/(marketing)/page.tsx` | role-match |
| **MODIF** `apps/jobs/src/dispatch.ts` | config | — | self (registre existant) | exact |
| **MODIF** `packages/supabase/src/index.ts` | config (barrel) | — | self (exports existants) | exact |
| **MODIF** `apps/web/.../(marketing)/page.tsx` (SHOW_PROOF→true) | component | — | self (ligne 18/56) | exact |

---

## Pattern Assignments

### `packages/core/src/replay/outcome.ts` (utility, transform pur)

**Analog :** `packages/core/src/time/candle.ts` — fonction pure déterministe du cœur, golden-testée, réutilise luxon + constantes.

**Imports & convention** (`candle.ts:1-9`) :
```typescript
/**
 * Utilitaires ... — packages/core (D-10)
 * Implémente la convention anti look-ahead ...
 */
import { DateTime } from 'luxon'
```
- Fonction PURE, exportée nommée, signature explicite (typescript/coding-style : types sur APIs publiques).
- Réutiliser `TIMEFRAMES.H1` / `UTC_ZONE` depuis `./constants.js` (extension `.js` OBLIGATOIRE dans les imports core — voir `index.ts:6`).
- Anti look-ahead : ne jamais inclure une bougie `ts >= valid_until` (cf. `candle.ts:26-33`, borne haute exclusive).

**Forme des types Setup/Candle** — dérivée du contrat §3 (`packages/core/src/schemas/output.ts:33-36, 53-71`) :
```typescript
// take_profits = { price, alloc_pct }[] ; TP1 = [0]
const TakeProfitSchema = z.object({ price: z.number(), alloc_pct: z.number() })
// ... direction: 'long'|'short', stop_loss: number, entry (EntrySchema.price)
```
- `realized_r` = ratio de prix sur les candles, JAMAIS via `packages/core/scoring` (anti-pattern RESEARCH §Anti-Patterns).
- Règle D-04 (distance) + flat D-02 : algo fourni dans RESEARCH §Code Examples l.264-290 (à porter tel quel, golden-testé).

**Barrel à étendre** (`packages/core/src/index.ts`) : ajouter `export { replayOutcome } from './replay/outcome.js'` + le type `Outcome`, sur le modèle des blocs existants l.6-21.

---

### `packages/core/src/replay/outcome.test.ts` (test golden)

**Analog :** `packages/core/src/time/candle.test.ts` — structure golden Vitest exacte du cœur.

**Structure à copier** (`candle.test.ts:1-12, 47-69`) :
```typescript
import { describe, expect, it } from 'vitest'
import { replayOutcome } from './outcome.js'   // import .js

describe('replayOutcome — golden values TRACK-01', () => {
  // fixtures candles H1 synthétiques (séquences OHLC contrôlées)
  it('first-touch hit_tp simple', () => { ... })
  it('cas ambigu D-04 — TP+SL même bougie → règle distance', () => { ... })
  it('flat D-02 — R au close(valid_until), long ET short', () => { ... })
  it('est déterministe : deux appels = même résultat', () => { ... })  // l.64-68
})
```
- 5 cas obligatoires (Validation Architecture §Wave 0) : hit_tp, hit_sl, ambigu D-04, flat long, flat short.
- Commande de run par task : `pnpm vitest run packages/core/src/replay`.

---

### `apps/jobs/src/jobs/outcome-tracker.ts` (job, service_role)

**Analog :** `apps/jobs/src/jobs/subscription-expiry.ts` — miroir DIRECT (idempotence, service_role lazy, stats Json).

**Client service_role lazy** (`subscription-expiry.ts:25-36`) — copier verbatim, renommer le message d'erreur :
```typescript
function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error('outcome-tracker: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env')
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

**Signature du job** (`subscription-expiry.ts:18-51`) :
```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { /* repos */ } from '@app/supabase'
import type { Json, Database } from '@app/supabase'

export async function outcomeTracker(): Promise<Json> {
  const client = getServiceClient()
  // 1. SELECT setups à traiter (idempotent) ; 2. replayOutcome ; 3. insert filet UNIQUE
  return { resolved, skipped } as Json   // stats Json
}
```

**Sélection idempotente** — RESEARCH §Code Examples l.242-249 :
```typescript
const { data: pending } = await client
  .from('trade_setups')
  .select('id, instrument_id, direction, entry_price, stop_loss, take_profits, valid_until, created_at, style, opportunity_score, risk_level')
  .in('status', ['expired', 'invalidated'])
  .lt('valid_until', new Date().toISOString())
// + exclure ceux déjà dans prediction_outcomes (NOT IN setup_id)
```

**Idempotence à 2 niveaux** : sélection bornée (re-run = 0) + filet DB `UNIQUE(setup_id)` via insert `ignoreDuplicates` — même pattern que `upsertCandles` (`candles.ts:23-25`).

**Lecture candles H1** — étendre `candles.ts` (nouvelle fn `getCandlesForReplay`) sur le modèle `getLastCandleTs` (`candles.ts:36-55`), ordre `ts asc`, fenêtre `created_at..valid_until`.

---

### `apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts` (test idempotence)

**Analog :** `apps/jobs/src/jobs/__tests__/subscription-expiry.test.ts` — mock store-en-mémoire + `vi.mock('@supabase/supabase-js')`.

**Pattern de mock** (`subscription-expiry.test.ts:41-92`) :
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
// store en mémoire (setups[] + outcomes[]) ; builder chaînable .from().select()/.insert()
vi.mock('@supabase/supabase-js', () => ({ createClient: () => makeClient() }))
import { outcomeTracker } from '../outcome-tracker'

beforeEach(() => {
  process.env['SUPABASE_URL'] = 'http://localhost'
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role'
  // fixtures setups expired/invalidated + futures (non éligibles)
})
```

**Assertions clés** (`subscription-expiry.test.ts:115-135`) :
- 1er run : insère N outcomes, stats `{ resolved, skipped }`.
- 2e run consécutif : 0 insert (idempotent) — copie le test l.131-135.

---

### `packages/supabase/src/repositories/predictionOutcomes.ts` (repository, write service_role)

**Analog :** `packages/supabase/src/repositories/candles.ts` (idempotence onConflict) + `tradeSetups.ts` (en-tête frontière D-07).

**En-tête de frontière** (`candles.ts:1-9`, `tradeSetups.ts:1-15`) — reproduire le contrat :
```typescript
/**
 * Repository prediction_outcomes — écriture via service_role (bypass RLS).
 * Idempotence : insert onConflict 'setup_id' ignoreDuplicates (UNIQUE setup_id, migration 0014).
 * JAMAIS importé depuis apps/web (D-07 — service_role réservé aux jobs).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PredictionOutcomeInsert } from '../database.types'
type ServiceClient = SupabaseClient<Database>
```

**Insert idempotent** (modèle `candles.ts:20-30`) :
```typescript
export async function insertOutcomes(client: ServiceClient, rows: PredictionOutcomeInsert[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await client
    .from('prediction_outcomes')
    .upsert(rows, { onConflict: 'setup_id', ignoreDuplicates: true })   // filet DB
  if (error) throw new Error(`insertOutcomes failed: ${error.message}`)
}
```

**Barrel** (`index.ts:62-73`) : ajouter `export { insertOutcomes } from './repositories/predictionOutcomes'` + type `PredictionOutcomeRow/Insert` au bloc des types (l.18-56).

---

### `packages/supabase/src/repositories/patternStats.ts` (repository, read anon) — PARTIAL ANALOG

**Analog :** aucun repo read-anon n'existe (tous les repos sont service_role write). La LECTURE anon se fait via `createServerSupabaseClient` (`anon-client.ts:45-67`). Modèle de lecture : RESEARCH §Code Examples l.330-337.

**Lecture RSC anon** — appelée depuis le composant, PAS un repo service_role :
```typescript
// apps/web — RSC, anon-client (PAS @app/supabase/service-client)
const supabase = createServerSupabaseClient(await cookies())
const { data } = await supabase
  .from('pattern_stats')
  .select('dimension, bucket, period, n, win_rate, expectancy')
```
- Si un helper est extrait dans `@app/supabase`, il prend un `SupabaseClient<Database>` anon en paramètre (NE PAS importer service-client — `index.ts:8-9` interdit l'export).
- Seuil N≥30 appliqué EN TS (D-09/D-12 : `n` toujours exposé), jamais en DB.

---

### `supabase/migrations/0014_prediction_outcomes_pattern_stats.sql` (migration)

**Analog :** `supabase/migrations/0006_analyses_trade_setups.sql` (table + RLS authenticated + index) ; `0003` (candles RLS `to authenticated`).

> ⚠️ **Numéro = 0014** (PAS 0013 — réservé au cluster paiement P4 différé, A4/Open Question 1). À arbitrer avec le fondateur avant `apply_migration`.
> ⚠️ **Appliquer via MCP `apply_migration`, JAMAIS `supabase db push`** (D-17, en-tête 0006:5).

**Table prediction_outcomes — RLS authenticated read, AUCUNE policy write** (miroir exact `0006:36-43` / `0003:87-95`) :
```sql
create table public.prediction_outcomes (
  setup_id     uuid primary key references public.trade_setups(id) on delete cascade,
  outcome      text not null check (outcome in ('hit_tp','hit_sl','flat')),
  realized_r   numeric not null,
  resolved_at  timestamptz not null default now(),
  candle_count int
);
alter table public.prediction_outcomes enable row level security;
create policy "prediction_outcomes: lecture authentifiés"
  on public.prediction_outcomes for select to authenticated using (true);
-- AUCUNE policy insert/update/delete → écriture service_role bypass (frontière D-05)
```
- `UNIQUE(setup_id)` = `primary key` (filet idempotence, Pitfall 3). Minimisation données (fondateur) : pas plus de colonnes.

**Vue pattern_stats — PREMIÈRE lecture `anon` du projet (TERRAIN NEUF — `grep "to anon"` = 0 résultat confirmé)** :
```sql
create view public.pattern_stats
with (security_invoker = false) as   -- bypass RLS sous-jacente → agrégats publics OK (Pitfall 1)
select 'overall'::text as dimension, 'all'::text as bucket, 'all_time'::text as period,
       count(*)::int as n,
       avg((o.outcome='hit_tp')::int)::numeric as win_rate,
       avg(o.realized_r) as expectancy
from public.prediction_outcomes o
-- union all : style / actif / tranche de score / risk_level + fenêtre 90j (D-06/D-11)
;
grant select on public.pattern_stats to anon, authenticated;  -- ⚠️ vérifier get_advisors
```
- **GATE PHASE** : `get_advisors` (security) DOIT confirmer que `prediction_outcomes` reste inaccessible à `anon` (seuls les agrégats fuient). Pitfall 1 + Security Domain V4.
- La vue retourne `n` BRUT (jamais masqué) — D-12.

**Régénérer** `packages/supabase/src/database.types.ts` après migration (`supabase gen types`).

---

### `apps/web/.../components/TrackRecordBlock.tsx` + MethodologyPage (component RSC)

**Analog :** `apps/web/src/app/[locale]/(marketing)/page.tsx` — RSC trilingue, `setRequestLocale` + `getTranslations`, classes logiques, vert/rouge contrôlé.

**Squelette RSC** (`page.tsx:12, 20-30`) :
```typescript
import { setRequestLocale, getTranslations } from 'next-intl/server'
// params: Promise<{ locale: string }> ; const { locale } = await params ; setRequestLocale(locale)
const t = await getTranslations('trackRecord')   // nouveau namespace (+ 'methodology')
// container : className="mx-auto max-w-screen-xl px-4 text-start md:px-6 lg:px-8" (page.tsx:30)
```
- Composants UI réutilisés (UI-SPEC §Registry Safety, AUCUN ajout npm/shadcn) : card, tabs, table, tooltip, badge, skeleton — tous déjà dans `apps/web/src/components/ui/`.
- Lecture data : anon-client RSC uniquement (NE JAMAIS importer service-client — frontière producteur-unique, UI-SPEC).
- Contrat figé : `05-UI-SPEC.md` (Display 40/56 pour le %, N toujours visible, vert/rouge réservé aux résultats mesurés, « échantillon insuffisant » neutre, RTL `<bdi>`+`Intl`).

**Débloquer le slot** (`page.tsx:18, 56`) : `const SHOW_PROOF = false` → `true` ; remplacer `{SHOW_PROOF && null}` par `{SHOW_PROOF && <TrackRecordBlock .../>}`.

---

### MODIF `apps/jobs/src/dispatch.ts` (enregistrement job)

**Self-analog** (`dispatch.ts:28, 35-50, 69`) :
```typescript
import { outcomeTracker } from './jobs/outcome-tracker'
const JOB_REGISTRY: Record<string, () => Promise<Json | undefined>> = {
  // ... existants ...
  // TRACK-01 — replay déterministe des setups expirés. Windows Task Scheduler : run-job.cmd outcome-tracker.
  'outcome-tracker': outcomeTracker,
}
```
- `runJob` (`runJob.ts:50-70`) trace `job_runs` automatiquement (startRun/finishRun) — RIEN à coder côté traçabilité.

---

## Shared Patterns

### Frontière producteur-unique (écriture service_role, lecture séparée)
**Source :** `tradeSetups.ts:1-15` (en-tête), `0006:43` (AUCUNE policy write), `index.ts:8-9` (service-client non ré-exporté du barrel).
**Apply to :** `predictionOutcomes.ts` (write service_role), migration 0014 (RLS), `TrackRecordBlock` (read anon only).
```sql
-- AUCUNE policy insert/update/delete → écriture service_role bypass
create policy "<table>: lecture authentifiés" on public.<table> for select to authenticated using (true);
```
> NUANCE Phase 5 : `pattern_stats` AJOUTE une lecture `anon` (grant SELECT) — première du projet. `prediction_outcomes` reste `to authenticated` strict.

### Idempotence (sélection bornée + filet DB onConflict)
**Source :** `candles.ts:23-25` (`onConflict ignoreDuplicates`), `subscription-expiry.ts:5-13` (WHERE borné), `subscription-expiry.test.ts:131-135` (test 2e run = 0).
**Apply to :** `outcome-tracker.ts`, `predictionOutcomes.ts`, son test.

### Job tracé via runJob/job_runs
**Source :** `runJob.ts:50-70` + `jobRuns.ts:19-68` (startRun/finishRun) + `dispatch.ts:35-50` (registre).
**Apply to :** `outcome-tracker.ts` (retourne `Json` stats), enregistrement `dispatch.ts`. Ne PAS écrire `job_runs` à la main — `runJob` le fait.

### Logique pure déterministe golden-testée dans core
**Source :** `candle.ts` (fn pure + luxon + anti look-ahead) + `candle.test.ts` (golden Vitest) + `index.ts` barrel (imports `.js`).
**Apply to :** `replay/outcome.ts` + `replay/outcome.test.ts`. Réutilise `TIMEFRAMES.H1`/`UTC_ZONE`, contrat §3 (`output.ts`).

### Lecture anon RSC (vitrine + miroir membre)
**Source :** `anon-client.ts:45-67` (`createServerSupabaseClient`), `page.tsx:12,20-30` (RSC i18n).
**Apply to :** `TrackRecordBlock`, MethodologyPage. Seuil N≥30 en TS (D-09).

---

## No Analog Found

| File / Concern | Rôle | Data Flow | Raison |
|----------------|------|-----------|--------|
| Vue `pattern_stats` avec `GRANT SELECT ... TO anon` | DB / RLS | request-response | **Aucune policy/grant `anon` n'existe** (vérifié : `grep "to anon"` = 0 résultat). Première lecture publique du projet — pattern à inventer + valider via Supabase `get_advisors`. Suivre RESEARCH §Pitfall 1 (option a : `security_invoker=false` + grant anon). |
| Repo de LECTURE anon dans `@app/supabase` | repository (read) | request-response | Tous les repos existants sont write service_role. La lecture anon passe par le client RSC directement (`anon-client.ts`), pas par un repo. Si helper extrait, paramétrer le client anon — ne PAS toucher service-client. |

---

## Metadata

**Analog search scope :** `apps/jobs/src`, `packages/core/src`, `packages/supabase/src`, `supabase/migrations`, `apps/web/src/app/[locale]/(marketing)`.
**Files scanned (lus en entier ou ciblé) :** subscription-expiry.ts, subscription-expiry.test.ts, runJob.ts, dispatch.ts, jobRuns.ts, candles.ts, tradeSetups.ts, constants.ts, candle.ts, candle.test.ts, output.ts, core/index.ts, supabase/index.ts, anon-client.ts, 0006/0003 migrations, marketing/page.tsx.
**Confirmed facts :** `grep "to anon"` = 0 (terrain RLS neuf) ; dernière migration = 0012, collision 0013 réelle → Phase 5 = 0014 ; SHOW_PROOF=false à `page.tsx:18`/`:56`.
**Pattern extraction date :** 2026-06-15
