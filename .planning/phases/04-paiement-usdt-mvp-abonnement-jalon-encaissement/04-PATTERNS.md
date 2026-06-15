# Phase 4 : Paiement USDT MVP & abonnement — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 22 (créés/modifiés)
**Analogs found:** 20 / 22 (2 net-new sans analog direct)

> Source des fichiers : 04-CONTEXT.md (Claude's Discretion), 04-RESEARCH.md (§Recommended Project Structure, §Patterns 1-5, §Code Examples), 04-UI-SPEC.md (§Component Anatomy, §Registry, §Copywriting).
> Toute interaction codebase = lecture seule. Excerpts ci-dessous = chemins + lignes exactes à copier.

---

## File Classification

| Fichier à créer/modifier | Role | Data Flow | Analog le plus proche | Qualité |
|--------------------------|------|-----------|------------------------|---------|
| `packages/data-sources/src/trongrid/client.ts` | data-source client | request-response (fetch+Zod) | `packages/data-sources/src/fred/client.ts` | exact |
| `packages/data-sources/src/trongrid/schema.ts` | schema/parser | transform | `packages/data-sources/src/fred/client.ts` (bloc Zod l.27-39) | role-match |
| `packages/data-sources/src/trongrid/address.ts` | utility (crypto) | transform | `packages/data-sources/src/marketaux/client.ts` (`createHash` l.15,52-54) | partial (crypto natif seul) |
| `packages/data-sources/src/trongrid/address.test.ts` | test (golden) | — | `packages/data-sources/src/fred/schema.test.ts` | role-match |
| `packages/data-sources/src/trongrid/verify.ts` | service (5 invariants) | transform/decision | `packages/data-sources/src/marketaux/client.ts` (parse+normalise) | partial |
| `packages/data-sources/src/trongrid/verify.test.ts` | test | — | `packages/data-sources/src/*/schema.test.ts` | role-match |
| `packages/core/src/money/atomic.ts` | utility (money) | transform | **aucun** (net-new — voir §No Analog) | none |
| `packages/core/src/money/atomic.test.ts` | test | — | `packages/data-sources/src/fred/schema.test.ts` | role-match |
| `packages/supabase/src/repositories/payments.ts` | repository | CRUD (service_role) | `packages/supabase/src/repositories/tradeSetups.ts` | exact |
| `packages/supabase/src/repositories/subscriptions.ts` | repository | CRUD + RPC (service_role) | `packages/supabase/src/repositories/tradeSetups.ts` | exact |
| `supabase/migrations/0012_payments.sql` | migration (table+RLS+RPC) | — | `0006_analyses_trade_setups.sql` + `0009_subscriptions_gating.sql` + `0008_profiles_role.sql` | exact |
| `apps/jobs/src/jobs/subscription-expiry.ts` | job | batch (idempotent) | `apps/jobs/src/jobs/calendar-ingest.ts` | exact |
| `apps/jobs/src/dispatch.ts` (modif) | config/registry | — | `apps/jobs/src/dispatch.ts` (lui-même) | exact |
| `apps/web/src/app/[locale]/(member)/abonnement/actions.ts` | server action | request-response (service_role local) | `apps/web/src/app/[locale]/(auth)/actions.ts` + `apps/jobs/src/runJob.ts` (`getServiceClient`) | role-match |
| `apps/web/src/app/[locale]/(member)/abonnement/page.tsx` | RSC page | request-response | `apps/web/src/app/[locale]/(member)/signaux/page.tsx` + `tarifs/page.tsx` | role-match |
| `apps/web/src/app/[locale]/(member)/abonnement/VerificationPolling.tsx` | component (client) | polling (react-query) | `apps/web/src/components/providers/QueryProvider.tsx` + `lib/signals/queries.ts` | partial |
| `apps/web/src/app/[locale]/(member)/abonnement/HashForm.tsx` | component (client form) | request-response | `apps/web/src/app/[locale]/(auth)/login/page.tsx` (form→action) | partial |
| `apps/web/src/app/[locale]/(member)/abonnement/PaymentPanel.tsx` | component (client) | — | `apps/web/src/components/signals/SignalCard.tsx` | partial |
| `apps/web/src/app/(admin)/membres/page.tsx` | RSC page (admin) | CRUD | `apps/web/src/app/(admin)/layout.tsx` + `lib/auth/gate.ts` (`requireRole`) | role-match |
| `apps/web/src/app/(admin)/file/page.tsx` | RSC page (admin) | CRUD | idem membres + `actions.ts` service_role | role-match |
| `apps/web/src/messages/{fr,en,ar}.json` (modif) | i18n config | — | `apps/web/src/messages/fr.json` (namespace `pricing`/`paiement`) | exact |
| `apps/web/components.json` + `ui/*` (8 blocs) | config | — | `apps/web/components.json` (lui-même) | exact |

---

## Pattern Assignments

### `packages/data-sources/src/trongrid/client.ts` (data-source client, fetch+Zod)

**Analog:** `packages/data-sources/src/fred/client.ts` (miroir le plus complet — pLimit + pRetry + Retry-After + clé env)

**Imports + clé env throw** (fred/client.ts l.15-24, 48-52) :
```typescript
import { z } from 'zod'
import pLimit from 'p-limit'
import pRetry from 'p-retry'
import { DateTime } from 'luxon'

const limit = pLimit(2)
// ...
const apiKey = process.env['FRED_API_KEY']
if (!apiKey) {
  throw new Error('FRED_API_KEY must be set in apps/jobs/.env')
}
```
→ Pour TronGrid : `TRONGRID_API_KEY` (throw si absent), header `TRON-PRO-API-KEY` (vs query param pour FRED — TronGrid passe la clé en header, cf. RESEARCH §Pattern 1 l.278). Base URL conditionnée par `TRON_NETWORK` (nile|mainnet).

**fetch + Retry-After 429 + parse Zod** (fred/client.ts l.57-95) :
```typescript
return limit(() =>
  pRetry(
    async () => {
      const res = await fetch(url)
      if (!res.ok) {
        const err = new Error(`FRED ${seriesCode}: HTTP ${res.status} ${res.statusText}`)
        if (res.status === 429) {
          const retryAfterSec = Number(res.headers.get('retry-after') ?? 0)
          if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
            ;(err as Error & { retryAfterMs?: number }).retryAfterMs = retryAfterSec * 1000
          }
        }
        throw err
      }
      const json: unknown = await res.json()
      return FredObservationsResponseSchema.parse(json)
    },
    {
      retries: 3,
      onFailedAttempt: async ({ error }) => {
        const waitMs = (error as Error & { retryAfterMs?: number }).retryAfterMs
        if (waitMs && Number.isFinite(waitMs)) {
          await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
      },
    },
  ),
)
```
→ Copier verbatim la mécanique Retry-After. **Différence TronGrid** : ajouter `headers: { 'TRON-PRO-API-KEY': apiKey }` au `fetch`.

> ⚠️ RESEARCH A1-A3 (HAUT risque) : la forme JSON TronGrid est `[ASSUMED]`, réseau bloqué. Le schéma Zod (`schema.ts`) doit être figé sur fixture réelle Nile en Wave 0 AVANT d'écrire le parseur (checkpoint:human-verify).

---

### `packages/data-sources/src/trongrid/schema.ts` (schema/parser Zod tolérant)

**Analog:** `packages/data-sources/src/marketaux/client.ts` (Zod tolérant `.passthrough()` + `.catch()` + parse séparé du fetch)

**Schéma tolérant** (marketaux/client.ts l.21-47) :
```typescript
const MarketauxArticleSchema = z
  .object({
    uuid: z.string().optional(),
    title: z.string(),
    sentiment_score: z.number().min(-1).max(1).nullable().optional().catch(null),
    // ...
  })
  .passthrough()  // champs inattendus ignorés

const MarketauxResponseSchema = z.object({ data: z.array(MarketauxArticleSchema) })
export type MarketauxResponse = z.infer<typeof MarketauxResponseSchema>
```
→ `.passthrough()` obligatoire (TronGrid renvoie beaucoup de champs). `value` = string atomique → `BigInt(value)` direct (PAS `Number`, PAS `toAtomic` — RESEARCH §Pattern 3 l.351). Valider `token_info.decimals === 6` ET contrat == USDT(.env) ensemble (RESEARCH Pitfall 1).

---

### `packages/data-sources/src/trongrid/address.ts` (utility crypto, base58check)

**Analog:** `packages/data-sources/src/marketaux/client.ts` — SEUL le `createHash` natif est l'analog (le reste est net-new déterministe ~40 lignes).

**crypto natif (JAMAIS réimplémenter sha256)** (marketaux/client.ts l.15, 52-54) :
```typescript
import { createHash } from 'crypto'

function deriveUrlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}
```
→ Pour base58check : `sha256(sha256(payload))` premiers 4 octets = checksum (RESEARCH §Pattern 2 l.298-321). `sameAddress(a,b)` normalise hex↔base58 puis compare. **Golden-tested obligatoire** (RESEARCH A4, HAUT risque). throw si checksum invalide (jamais comparer une adresse non vérifiée).

---

### `packages/supabase/src/repositories/payments.ts` (repository, CRUD service_role)

**Analog:** `packages/supabase/src/repositories/tradeSetups.ts` (exact — write service_role, transition status-only, garde "JAMAIS importé depuis apps/web")

**En-tête + type ServiceClient + transition status-only** (tradeSetups.ts l.1-69) :
```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TradeSetupInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>

export async function insertTradeSetups(client: ServiceClient, rows: TradeSetupInsert[]): Promise<void> {
  const { error } = await client.from('trade_setups').insert(rows)
  if (error) throw new Error(`insertTradeSetups failed: ${error.message}`)
}

export async function expirePriorSetups(client: ServiceClient, key: ImmutabilityKey): Promise<void> {
  const { error } = await client
    .from('trade_setups')
    .update({ status: 'expired' })
    .eq('instrument_id', key.instrument_id)
    // ...
    .eq('status', 'active')
  if (error) throw new Error(`expirePriorSetups failed: ${error.message}`)
}
```
→ `payments.ts` : `insertPendingPayment`, `getByHash`, `transitionPayment(verified/rejected/ambiguous)`. Capter le code `23505` (unique violation tx_hash) = replay (RESEARCH Pitfall 2). Header comment doc-bloc « JAMAIS importé depuis apps/web (D-07) » à copier de tradeSetups.ts l.15.

---

### `packages/supabase/src/repositories/subscriptions.ts` (repository, CRUD + RPC)

**Analog:** `packages/supabase/src/repositories/tradeSetups.ts` (write service_role) + `apps/web/src/lib/auth/gate.ts` l.89 pour le pattern `.rpc(...)`.

**Appel RPC** (gate.ts l.89) :
```typescript
const { data: hasActive } = await supabase.rpc('has_active_subscription')
```
→ wrapper `activateForPayment(client, { payment_id, user_id, plan, period })` appelant `client.rpc('activate_subscription_for_payment', {...})`. + `expireDue`, `changePlan` (service_role updates).

---

### `supabase/migrations/0012_payments.sql` (migration : table + RLS + UNIQUE + RPC)

**Analogs:** `0006_analyses_trade_setups.sql` (table + RLS lecture authenticated, AUCUNE policy write, index unique partiel) + `0009_subscriptions_gating.sql` (lecture scopée `user_id=auth.uid()` + superadmin) + `0008_profiles_role.sql` (RPC security definer + revoke/grant).

**Table + RLS lecture scopée** (0009 l.27-50) :
```sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'canceled')),
  -- ...
);
alter table public.subscriptions enable row level security;

create policy "subscriptions: lire les siennes"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

create policy "subscriptions: superadmin voit tout"
  on public.subscriptions for select to authenticated
  using (public.is_superadmin());
```
→ `payments` ajoute UNE policy INSERT (RESEARCH l.511-513) : `with check (user_id = auth.uid() and status = 'pending')`. AUCUNE policy update/delete (transitions service_role, D-08).

**Index unique partiel (filet anti-race)** (0006 l.93-95) :
```sql
create unique index trade_setups_versionkey_idx
  on public.trade_setups (instrument_id, style, session, session_day)
  where status = 'active';
```
→ `payments` : (a) `create unique index payments_tx_hash_global_idx on public.payments (tx_hash);` GLOBAL anti-replay (RESEARCH l.503) ; (b) réservation offset = index unique partiel sur `(expected_amount_atomic) where status='pending'` (RESEARCH l.507-508, à affiner avec `reservation_expires_at` — flag planning D-05).

**RPC security definer + revoke/grant** (0008 l.29-47) :
```sql
create function public.is_superadmin()
  returns boolean language sql stable security definer
  set search_path = public
as $$ select exists (...) $$;

revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;
```
→ `activate_subscription_for_payment(...)` en `plpgsql security definer set search_path = public` (transition atomique, RESEARCH §Pattern 4 l.361-374) ; `revoke execute ... from public, anon, authenticated` (service_role bypass — vérifier A8 en Wave 0).

> Convention : appliquée via MCP `apply_migration` (PAS `db push`) — cf. 0006 l.6. Puis régénérer/éditer `database.types.ts` + ré-exporter dans le barrel `packages/supabase/src/index.ts` (l.47-73 = précédent Phase 4 exact).

---

### `apps/jobs/src/jobs/subscription-expiry.ts` (job, batch idempotent)

**Analog:** `apps/jobs/src/jobs/calendar-ingest.ts` (exact — service_role lazy, stats, try/catch, retourne Json)

**Client service_role lazy + stats + retour Json** (calendar-ingest.ts l.13-32, 40-68) :
```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Json, Database } from '@app/supabase'

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error('calendar-ingest: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env')
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function calendarIngest(): Promise<Json> {
  const stats = { inserted: 0, skipped: 0, errors: [] as Array<{ source: string; msg: string }> }
  const client = getServiceClient()
  // ...
  return stats as Json
}
```
→ `subscriptionExpiry()` : `UPDATE subscriptions SET status='expired' WHERE status='active' AND current_period_end <= now()` — naturellement idempotent (re-run = 0 ligne 2e fois, RESEARCH §Pattern 5 l.378). stats = `{ expired: n }`.

**Enregistrement dispatch** (dispatch.ts l.23, 34-46) :
```typescript
import { calendarIngest } from './jobs/calendar-ingest'
// ...
const JOB_REGISTRY: Record<string, () => Promise<Json | undefined>> = {
  // ...
  'calendar-ingest': calendarIngest,
}
```
→ Ajouter import + entrée `'subscription-expiry': subscriptionExpiry`. Windows Task Scheduler appelle `run-job.cmd subscription-expiry` (générique, déjà en place).

---

### `apps/web/src/app/[locale]/(member)/abonnement/actions.ts` (server action, service_role local)

**Analogs:** `apps/web/src/app/[locale]/(auth)/actions.ts` ('use server' + redirect localisé + `toSafeErrorKey`) + `apps/jobs/src/runJob.ts` l.30-41 (`getServiceClient` à recopier LOCALEMENT, jamais le barrel).

**'use server' + getUser via SSR + toSafeErrorKey** (auth/actions.ts l.1-31, 33-44) :
```typescript
'use server'
import { getLocale } from 'next-intl/server'
import { createClient } from '../../../lib/supabase/server'

function toSafeErrorKey(message: string): string {
  // mappe message brut → clé i18n opaque (jamais error.message au client)
  // ...
  return 'auth-error'
}

export async function signUp(formData: FormData): Promise<void> {
  const supabase = await createClient()  // anon SSR = getUser()
  // ...
}
```

**service_role créé LOCALEMENT** (runJob.ts l.30-41 — à inliner dans la server action, RESEARCH §Code Examples l.464-480, Pitfall 6) :
```typescript
import 'server-only'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@app/supabase'

function serviceClientLocal() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) throw new Error('service_role env manquant')
  return createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```
→ `verifyPayment(hash)` : (1) `getUser()` anon (qui paie), (2) service_role local → client TronGrid + 5 invariants, (3) RPC atomique. **INTERDIT** : `import { serviceClient } from '@app/supabase/service-client'` (ESLint no-restricted-imports + server-only). Consommer `isLegalReviewDone()` (`lib/legal-gate.ts` l.19) sur le chemin mainnet AVANT activation réelle (RESEARCH Pitfall 7).

---

### `apps/web/src/app/[locale]/(member)/abonnement/VerificationPolling.tsx` (component client, react-query)

**Analog:** `apps/web/src/components/providers/QueryProvider.tsx` (QueryClient mémorisé) + `lib/signals/queries.ts` (lecture anon-only).

**QueryClient mémorisé** (QueryProvider.tsx l.18-31) — déjà monté ; le composant polling consomme `useQuery` avec `refetchInterval`. RESEARCH Q2 l.578 : `refetchInterval: 4000`, `staleTime: 0`, stop sur `verified`/`rejected`/`ambiguous` ou ~120 s → message timeout (jamais erreur dure, UI-SPEC §VerificationPolling). Repli = re-soumission user (pas de watcher auto, hors scope PAY-AUTO).

---

### `apps/web/src/app/(admin)/membres/page.tsx` + `file/page.tsx` (RSC admin, CRUD)

**Analogs:** `apps/web/src/app/(admin)/layout.tsx` (le `requireRole('superadmin')` protège déjà tout le groupe) + `lib/auth/gate.ts` l.99-118 (`requireRole` → `notFound()` 404 discrétion).

**Garde 404 déjà appliquée par le layout** (admin/layout.tsx l.7-12) :
```typescript
import { requireRole } from '../../lib/auth/gate'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('superadmin')
  return <>{children}</>
}
```
→ Les pages `membres`/`file` lisent via anon-client + RLS `is_superadmin()` (lecture). Actions de mutation = server action service_role local (même pattern que `abonnement/actions.ts`). Mono-FR (namespace `admin`). Tables = blocs shadcn `table`/`tabs`/`alert-dialog`/`textarea` (UI-SPEC §Registry).

---

### `apps/web/src/messages/{fr,en,ar}.json` (i18n, modif)

**Analog:** namespaces existants `pricing` (10 clés) et `paiement` dans `fr.json`. Top-level actuels : `common, language, theme, auth, access, pricing, paiement, home, disclaimer, legal, signals, signalDetail, glossary, dashboard`.

→ Ajouter namespace `payment` (member-facing, parité STRICTE fr/en/ar — CI `check-i18n-hardcoded.mjs`) + namespace `admin` (FR-only acceptable mais routé next-intl, pas hardcodé). Étendre `pricing` pour D-12 (offre découverte consommée / upgrade). Copy canonique = UI-SPEC §Copywriting Contract (table complète des clés). Montants/dates via `<bdi>` + `Intl`.

---

### `apps/web/components.json` + 8 blocs `ui/*` (config shadcn)

**Analog:** `apps/web/components.json` (style `radix-nova`, `registries: {}` → registry officiel, pas de vetting gate).

**Existants (NE PAS ré-ajouter)** : badge, button, card, collapsible, dialog, dropdown-menu, input, label, select, separator, skeleton, tooltip.
**NEW (registry officiel `radix-nova`)** : `table`, `form` (react-hook-form+zod), `textarea`, `sonner`, `tabs`, `alert`, `alert-dialog`, `progress` (UI-SPEC §Registry l.249).
→ QR lib = dépendance npm SÉPARÉE (pas un bloc shadcn) : offline-only, encode l'adresse publique seule, zéro fetch/CDN/telemetry — **checkpoint:human-verify (slopcheck + postinstall)** avant install (RESEARCH §Package Legitimacy A9).

---

## Shared Patterns

### Frontière producteur-unique (service_role)
**Sources:** `packages/supabase/src/service-client.ts` (l.1-4 `import 'server-only'`), barrel `index.ts` (l.5-10 : n'exporte JAMAIS service-client), `runJob.ts`/`calendar-ingest.ts` (`getServiceClient` lazy local).
**Apply to:** `payments.ts`, `subscriptions.ts`, `subscription-expiry.ts`, `abonnement/actions.ts`, actions admin.
**Règle:** l'user (anon-client) n'écrit QUE `payments(pending)` ; toute transition (`verified`/`active`/`expired`/`rejected`) passe par service_role créé localement (web) ou lazy (jobs). Jamais `import { serviceClient }` dans apps/web.
```typescript
// service-client.ts l.1-4 — la garde build-time
import 'server-only'  // plante le build Next si importé côté client
```

### Déterminisme financier BigInt (zéro float)
**Source:** net-new `packages/core/src/money/atomic.ts` (RESEARCH §Pattern 3 l.334-352). Précédent de discipline : `trade_setups` numeric + `expirePriorSetups` status-only.
**Apply to:** `atomic.ts`, `trongrid/schema.ts` (`BigInt(value)` direct), `verify.ts` (comparaison `===` exacte), affichage UI (`Intl` + `<bdi>`, jamais `toFixed` dans la décision).

### RLS lecture scopée + RPC security definer
**Sources:** `0009` (l.41-50 lecture scopée + superadmin), `0008` (l.29-47 RPC + revoke/grant).
**Apply to:** migration `0012` (table payments, RPC activate atomique).

### Erreurs opaques i18n (typed error codes)
**Source:** `apps/web/src/app/[locale]/(auth)/actions.ts` l.25-31 (`toSafeErrorKey`) + `gate.ts` l.32-51 (`safeReturnTo` anti open-redirect).
**Apply to:** `abonnement/actions.ts` (codes `wrong_token`/`wrong_recipient`/`not_confirmed`/`replay`/`wrong_amount` → messages i18n, RESEARCH §Verification Decision Tree l.539). Jamais d'`error.message` brut au client.

### Job idempotent + job_runs (pino)
**Source:** `runJob.ts` l.50-70 (wrappe job_runs running→success/error) + `dispatch.ts` (registry).
**Apply to:** `subscription-expiry.ts` + entrée dispatch.

---

## No Analog Found

| Fichier | Role | Data Flow | Raison |
|---------|------|-----------|--------|
| `packages/core/src/money/atomic.ts` | utility (money) | transform | Aucun helper monétaire atomique BigInt n'existe (les montants `trade_setups` sont `numeric` SQL, jamais manipulés en BigInt JS). **Net-new** — suivre RESEARCH §Pattern 3 l.334-352 (regex strict, `toAtomic`/`formatAtomic`, `USDT_DECIMALS=6n`, `SCALE=10n**6`). Le package `packages/core` peut ne pas exister encore → confirmer son existence au planning, sinon le créer (alternative : `packages/data-sources/src/money/`). |
| `packages/data-sources/src/trongrid/verify.ts` (logique des 5 invariants) | service (decision) | decision-tree | La logique de décision conjointe (5 invariants ET) est spécifique au paiement on-chain ; aucun analog de « decision tree » dans le codebase. Structure dérivée de RESEARCH §Verification Decision Tree l.527-538. Réutilise `address.ts` (sameAddress) + `atomic.ts` (comparaison) comme briques. |

---

## Metadata

**Analog search scope:** `packages/data-sources/src/`, `apps/jobs/src/`, `supabase/migrations/`, `packages/supabase/src/`, `apps/web/src/` (app + lib + components + messages), `apps/web/components.json`.
**Files scanned:** ~14 analogs lus intégralement (fred/marketaux clients, runJob, calendar-ingest, dispatch, 0006/0008/0009, tradeSetups, admin layout, gate, legal-gate, auth actions, queries, QueryProvider, service-client, 2 barrels, components.json) + fr.json namespaces.
**Pattern extraction date:** 2026-06-15

**Wave 0 dependencies (gates avant code de vérification)** — repris de RESEARCH §Wave 0 Gaps :
- Fixtures TronGrid réelles (Nile) → débloque `schema.ts`/`verify.ts` (checkpoint:human-verify, A1-A3).
- Golden values base58check (TR7NH… ↔ hex) → débloque `address.ts` (A4).
- QR lib vettée (slopcheck + offline + postinstall) → débloque PaymentPanel (A9).
- `0012` appliquée via MCP `apply_migration` + `database.types.ts` régénéré/édité + barrel ré-exporte payments/repos.
