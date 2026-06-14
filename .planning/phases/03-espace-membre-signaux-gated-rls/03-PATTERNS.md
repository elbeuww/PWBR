# Phase 3 : Espace membre signaux (gated RLS) — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 22 (créés/modifiés)
**Analogs found:** 21 / 22 (1 sans analog : CandleChart canvas client-only)

> Tout analog ci-dessous a été ouvert dans le dépôt réel. Le planner DOIT réutiliser ces conventions Phase 1 & 2 plutôt que d'inventer.
>
> ⚠️ **CORRECTION sur le RESEARCH** : les exemples de requête de `03-RESEARCH.md` citent `instruments.canonical_symbol` et `instruments.price_decimals`. **Ces colonnes N'EXISTENT PAS.** La table réelle `public.instruments` (migration `0001`, l.32-42) expose : `symbol`, `broker`, `asset_class`, `display_name`, `pip_size`, `min_size`, `precision`, `active`. Le select join correct est `instruments!inner(symbol, asset_class, precision, display_name)`. Le formatage des décimales par actif s'appuie sur `precision` (int), pas `price_decimals`.

---

## File Classification

| Fichier (créé/modifié) | Rôle | Data Flow | Analog le plus proche | Qualité match |
|------------------------|------|-----------|------------------------|----------------|
| `apps/web/src/app/[locale]/(member)/signaux/page.tsx` *(REMPLACE le placeholder)* | RSC page | request-response (read RLS) | `apps/web/src/app/[locale]/dashboard/page.tsx` | exact |
| `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx` *(NOUVEAU)* | RSC page | request-response (read RLS) | `dashboard/page.tsx` + `gate.ts` (notFound) | exact |
| `apps/web/src/lib/signals/searchParams.ts` *(NOUVEAU)* | utility (Zod parse/serialize) | transform | `packages/core/src/schemas/output.ts` (style Zod v4) | role-match |
| `apps/web/src/lib/signals/queries.ts` *(NOUVEAU, optionnel)* | data-access (lecture anon) | CRUD read | `dashboard/page.tsx` inline query + `gate.ts` rpc | role-match |
| `apps/web/src/components/signals/SignalCard.tsx` *(NOUVEAU)* | component (server-renderable) | request-response | `components/ui/card.tsx` + `Disclaimer.tsx` | role-match |
| `apps/web/src/components/signals/FilterBar.tsx` *(NOUVEAU)* | client component | event-driven (URL sync) | `components/LanguageSwitcher.tsx` (useRouter/i18n nav) | role-match |
| `apps/web/src/components/signals/SignalList.tsx` *(NOUVEAU)* | client component | event-driven (Realtime + react-query) | `components/ThemeProvider.tsx` (use client provider) + anon-client.ts | partial |
| `apps/web/src/components/signals/RealtimeBadge.tsx` *(NOUVEAU)* | client component | event-driven | — (composition simple, voir SignalList) | role-match |
| `apps/web/src/components/signals/SignalDetail.tsx` *(NOUVEAU)* | component | request-response | `dashboard/page.tsx` (i18n + text-start) | role-match |
| `apps/web/src/components/signals/ContributingFactors.tsx` *(NOUVEAU)* | component | transform (repli D-11) | OutputSchema (`*_reasons`) | role-match |
| `apps/web/src/components/signals/CandleChart.tsx` *(NOUVEAU)* | client component | streaming (canvas) | **AUCUN analog** (lightweight-charts) | no-analog |
| `apps/web/src/components/signals/GlossaryTooltip.tsx` *(NOUVEAU)* | client component | request-response | shadcn `tooltip` (à ajouter) + `LanguageSwitcher` | partial |
| `apps/web/src/components/providers/QueryProvider.tsx` *(NOUVEAU)* | provider (client) | — | `components/ThemeProvider.tsx` | exact |
| `apps/web/src/components/ui/tooltip.tsx` *(NOUVEAU — shadcn)* | ui primitive | — | `components/ui/dialog.tsx` (radix-ui import shape) | exact |
| `apps/web/src/components/ui/skeleton.tsx` *(NOUVEAU — shadcn)* | ui primitive | — | `components/ui/separator.tsx` | exact |
| `apps/web/src/components/ui/select.tsx` *(NOUVEAU — shadcn)* | ui primitive | — | `components/ui/dropdown-menu.tsx` | exact |
| `apps/web/src/components/ui/collapsible.tsx` *(NOUVEAU — shadcn)* | ui primitive | — | `components/ui/dialog.tsx` | exact |
| `supabase/migrations/0011_realtime_trade_setups.sql` *(NOUVEAU)* | migration | — | `supabase/migrations/0009_subscriptions_gating.sql` (entête + drop/recreate) | role-match |
| `apps/web/src/messages/{fr,en,ar}.json` *(MODIFIÉS)* | i18n messages | — | namespace `signals`/`dashboard` existant (fr.json l.81-96) | exact |
| `apps/web/package.json` *(MODIFIÉ)* | config | — | `apps/web/package.json` (déjà lu) | exact |
| `apps/web/src/lib/signals/__tests__/searchParams.test.ts` *(NOUVEAU)* | test (vitest) | — | `apps/web/src/lib/__tests__/legal-gate.test.ts` | role-match |
| e2e `signals-rls` / `signal-detail` / `signals-realtime` *(NOUVEAUX)* | test (playwright) | — | Wave 0 — mirroir test RLS journal P1 (à localiser) | partial |

---

## Pattern Assignments

### `app/[locale]/(member)/signaux/page.tsx` (RSC, lecture RLS)

**Analog :** `apps/web/src/app/[locale]/dashboard/page.tsx` (mirroir exact lecture serveur gated).

**À COPIER tel quel :**
- Le `createClient()` serveur depuis `../../../lib/supabase/server` (anon-key + cookies, JAMAIS service_role).
- `getTranslations('signals')` + `setRequestLocale(locale)` (déjà dans le placeholder actuel `signaux/page.tsx` l.11-20).
- Le pattern d'états : `error → bloc i18n` / `length===0 → vide` / `sinon grille` (dashboard l.57-82, à transposer en grille de cartes D-01/D-18).
- `className="… text-start"` (logique RTL, jamais `text-left`).

**Imports pattern (dashboard l.10-14, à adapter) :**
```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '../../../lib/supabase/server'   // anon + cookies
```

**Lecture RLS + filtres/tri (D-02/06/08/19) — fondé sur trade_setups réel (0006) + instruments réel (0001) :**
```tsx
const supabase = await createClient()
const sp = await searchParams                        // Next 15 : async (PAS dans dashboard, NOUVEAU)
// parse sp via lib/signals/searchParams.ts (Zod) AVANT toute requête
let q = supabase
  .from('trade_setups')
  .select('id, instrument_id, direction, opportunity_score, risk_level, risk_reward, style, valid_until, created_at, instruments!inner(symbol, asset_class, precision, display_name)')
  .eq('status', 'active')                             // D-02
  .limit(100)                                         // D-19
if (style) q = q.eq('style', style)                  // 'day'|'swing'
if (risk)  q = q.eq('risk_level', risk)              // 'low'|'medium'|'high'|'extreme'
if (assetIds.length) q = q.in('instrument_id', assetIds)
q = sort === 'recent' ? q.order('created_at',{ascending:false})
  : sort === 'rr'     ? q.order('risk_reward',{ascending:false})
  :                     q.order('opportunity_score',{ascending:false})  // défaut D-08
const { data, error } = await q
```

**À CHANGER vs dashboard :**
- Le dashboard fait `getUser()` inline + redirect (car il vit HORS `(member)`). **NE PAS** dupliquer ici : le layout `(member)/layout.tsx` appelle déjà `requireActiveSub()` (lu l.8-13). La page signaux n'a PAS de guard inline.
- Le dashboard lit `instruments` via le repo `listActiveInstruments`. La page signaux lit `trade_setups` **inline via le client anon** — ⛔ ne JAMAIS importer `@app/supabase/repositories/tradeSetups` (frontière producteur-unique, voir Shared Patterns).
- `searchParams: Promise<…>` est NOUVEAU (le dashboard n'en a pas) — Next 15 async.

---

### `app/[locale]/(member)/signaux/[id]/page.tsx` (RSC détail)

**Analog :** `dashboard/page.tsx` (lecture serveur) + `gate.ts` l.118 (`notFound()` pour absence).

**Core pattern :**
```tsx
const supabase = await createClient()
const { id } = await params                          // Next 15 async
const { data: setup, error } = await supabase
  .from('trade_setups')
  .select('*, instruments!inner(symbol, asset_class, precision, display_name)')
  .eq('id', id)
  .eq('status', 'active')                            // D-02 (un signal peut expirer entre liste et détail → not-found)
  .maybeSingle()                                     // pattern maybeSingle vu dans candles.ts l.48
if (!setup) { notFound() }                           // copy « Ce signal n'est plus actif » (UI-SPEC)
// candles pour le chart (RLS authenticated using(true), 0003 l.89-93) :
const tf = mapTimeframe(setup.payload.timeframe_analysis)   // 'H1'|'H4'|'D'
const { data: candles } = await supabase
  .from('candles')
  .select('ts, open, high, low, close')
  .eq('instrument_id', setup.instrument_id)
  .eq('timeframe', tf)
  .order('ts', { ascending: true })
  .limit(150)                                        // D-12
```

**Contenu §3 VERBATIM (D-10/MEMB-04) :** `setup.payload` est l'`Output` de `packages/core/src/schemas/output.ts` (lu l.53-71). Champs affichables tels quels : `veteran_note`, `technical_reasons`, `fundamental_reasons`, `news_catalysts`, `upcoming_risk_events`, `invalidation`, `entry`, `stop_loss`, `take_profits`, `timeframe_analysis`. ⛔ Le score/risk_reward/risk_level NE sont PAS dans payload → ils viennent des colonnes `trade_setups` (0006 l.63-69).

**À CHANGER :** le chart est client-only → importer via `next/dynamic({ ssr:false })` (voir CandleChart ci-dessous). Pas de guard inline (layout `(member)` gère le gate).

---

### `lib/signals/searchParams.ts` (Zod parse/serialize)

**Analog :** `packages/core/src/schemas/output.ts` (style Zod v4 du repo — `z.enum`, `z.infer`).

**À COPIER (style enums + infer) :**
```tsx
import { z } from 'zod'
const StyleEnum = z.enum(['day', 'swing'])           // miroir output.ts l.21
const RiskEnum  = z.enum(['low','medium','high','extreme'])   // miroir 0006 l.64
const SortEnum  = z.enum(['score','recent','rr']).default('score')   // D-08 défaut
export const SignalsParamsSchema = z.object({
  style: StyleEnum.optional(),
  risk:  RiskEnum.optional(),
  asset: z.string().optional(),       // whitelist/normalise vs liste instruments (anti-injection .eq/.in)
  class: z.enum(['crypto','forex','metal','energy']).optional(),   // miroir 0001 l.36
  sort:  SortEnum,
})
export type SignalsParams = z.infer<typeof SignalsParamsSchema>
```
**Pourquoi :** sécurité V5 (anti-injection sur `.eq/.in`), round-trip URL testable (MEMB-01/02). Zod déjà installé (package.json l.27).

---

### `components/signals/SignalCard.tsx` (carte)

**Analog :** `components/ui/card.tsx` (Card/CardHeader, tokens `--card`, `rounded-xl`, classes logiques) + `Disclaimer.tsx` (composant simple i18n).

**À COPIER :** import `cn` depuis `@/lib/utils`, primitives `Card`/`CardHeader`/`CardContent` shadcn, classes logiques (`ps/pe/ms/me`, jamais `left/right`). Lien carte via `Link` de `@/i18n/navigation` (préserve la locale — voir navigation.ts l.10).

**À CHANGER / RÈGLES (D-03 color law) :**
- Direction badge : vert = long / rouge = short via les tokens sémantiques de `globals.css` (P2). ⛔ Score = NEUTRE (brand blue), JAMAIS vert/rouge.
- Valeurs numériques (score, R:R, prix, fraîcheur) encadrées `<bdi>` + `Intl` (décimales via `instruments.precision`).

---

### `components/signals/FilterBar.tsx` (client, URL sync)

**Analog :** `components/LanguageSwitcher.tsx` — seul composant existant qui utilise `useRouter`/`usePathname` de `@/i18n/navigation`.

**À COPIER (navigation localisée) :**
```tsx
'use client'
import { useRouter, usePathname } from '@/i18n/navigation'   // PAS next/navigation (perd la locale)
import { useSearchParams } from 'next/navigation'            // lecture des params OK
// toggle chip → const next = new URLSearchParams(searchParams); next.set('style', v)
// router.replace(`${pathname}?${next.toString()}`, { scroll:false })   // re-render RSC
```
**À CHANGER :** ajouter chips toggle (style/risque) + `select` shadcn (actif/classe). Bouton « Réinitialiser » quand filtre actif (copy UI-SPEC). Tap target ≥44px.

---

### `components/signals/SignalList.tsx` (client, Realtime + react-query)

**Analog (partiel) :** `components/ThemeProvider.tsx` (forme `'use client'` provider) + `packages/supabase/src/anon-client.ts` l.20-25 (`createBrowserClient` porte le token de session via cookies).

**Browser client + canal Realtime (D-13/14/16) :**
```tsx
'use client'
import { createClient } from '@/lib/supabase/client'   // = createBrowserSupabaseClient (client.ts l.5-7)
const supabase = createClient()
const channel = supabase.channel('signals-active')
  .on('postgres_changes',
      { event:'INSERT', schema:'public', table:'trade_setups', filter:'status=eq.active' },
      (p) => { /* badge "N nouveaux" D-13 ; insère au clic seulement */ })
  .on('postgres_changes',
      { event:'UPDATE', schema:'public', table:'trade_setups' },   // SANS filtre statut (Pitfall 4)
      (p) => { if (p.new.status !== 'active') removeCard(p.new.id) })   // D-14
  .subscribe((status) => { if (status !== 'SUBSCRIBED') enableRefetchFallback() })  // D-16
// cleanup: supabase.removeChannel(channel)
```
**RÈGLES :**
- `createBrowserSupabaseClient` (anon-client.ts) porte la session → la RLS `has_active_subscription()` filtre les events. ⛔ JAMAIS service_role côté front.
- Repli D-16 : react-query `initialData` (rows RSC) + `refetchInterval` léger si `subscribe` n'atteint pas `SUBSCRIBED`. Ne pas dépendre du Realtime.
- **Dépend de la migration 0011** (publication + replica identity) sinon zéro callback (Pitfall 2).

---

### `components/signals/CandleChart.tsx` (client canvas) — **NO ANALOG**

Aucun composant chart n'existe dans le repo. Suivre `03-RESEARCH.md §Pattern 4` (lightweight-charts v5 API : `addSeries(CandlestickSeries, …)`, `createPriceLine` entrée/SL/TP). Monté via `next/dynamic(() => import(...), { ssr:false })` depuis la page détail RSC (Pitfall 5). Couleurs : up/down = vert/rouge sémantiques ; entrée = brand-blue dashed ; SL = rouge ; TP = vert ; lignes légendées (colorblind-safe). Render-fail → le plan résumé textuel (D-09) reste lisible.

---

### `components/providers/QueryProvider.tsx` (react-query)

**Analog :** `components/ThemeProvider.tsx` (provider client). À COPIER : `'use client'` + wrapping `{children}`. À CHANGER : `QueryClientProvider` (`@tanstack/react-query`) avec un `QueryClient` mémorisé. À monter au-dessus de la surface signaux (pas globalement si non nécessaire).

---

### `components/ui/{tooltip,skeleton,select,collapsible}.tsx` (shadcn radix-nova)

**Analog :** `components/ui/dialog.tsx` et `components/ui/dropdown-menu.tsx` — montrent la convention d'import du repo : `import { Tooltip as TooltipPrimitive } from "radix-ui"` (package `radix-ui` unifié l.21 package.json, PAS `@radix-ui/react-*` séparés), `cn` depuis `@/lib/utils`, `data-slot`. Générer via `pnpm dlx shadcn@latest add tooltip skeleton select collapsible` puis vérifier qu'ils utilisent bien l'import `radix-ui` unifié (branche v4 / React 19).

---

### `supabase/migrations/0011_realtime_trade_setups.sql` (migration)

**Analog :** `supabase/migrations/0009_subscriptions_gating.sql` — style d'entête commenté (rationale + décisions + invariant producteur-unique) et pattern drop/recreate par NOM EXACT.

**À COPIER (entête commenté détaillé, l.1-19 de 0009) + contenu :**
```sql
-- Migration 0011 : Realtime pour trade_setups (MEMB-05).
-- Vérifier l'état réel via MCP/SQL AVANT (la publication peut déjà contenir la table — A4).
--   select * from pg_publication_tables where pubname='supabase_realtime';
alter table public.trade_setups replica identity full;            -- old record sur UPDATE (D-14, A1)
alter publication supabase_realtime add table public.trade_setups; -- guarder si déjà présent (A4)
-- RLS lecture déjà gated par 0009/0010 (has_active_subscription) → les events postgres_changes en héritent.
```
**Décision sécurité ouverte (à trancher avec l'utilisateur AVANT) :** `candles` est lisible par tout `authenticated` (`using(true)`, 0003 l.89-93), PAS gated. Optionnel : aligner sur `has_active_subscription()` pour cohérence du gate, OU documenter que l'OHLCV brut n'est pas le produit payant. Voir Open Question 1 du RESEARCH.

⚠️ **Process projet :** migration appliquée via **MCP `apply_migration`** (PAS `db push`) — convention 0006 l.6 / 0009. Vérifier l'état de la publication via MCP avant pour rendre la migration idempotente.

---

### `messages/{fr,en,ar}.json` (i18n)

**Analog :** namespace `signals` existant (fr.json l.81-84) + `dashboard` (l.85-96) — shape `{ "namespace": { "key": "valeur" } }`.

**À CHANGER :** étendre `signals` (liste/filtres/tri/états vide/erreur/badge realtime/disclaimer banner) + ajouter `signalDetail` et `glossary` (D-10). Copy canonique FR = `03-UI-SPEC §Copywriting Contract`. Parité fr/en/ar obligatoire (CI `check-i18n-hardcoded.mjs` bloque les chaînes en dur). Le contenu IA (`veteran_note` etc.) N'est PAS une clé i18n (DB, verbatim).

---

### `lib/signals/__tests__/searchParams.test.ts` (vitest)

**Analog :** `apps/web/src/lib/__tests__/legal-gate.test.ts` (structure test unit du repo, vitest). À COPIER : structure `describe/it`, import du module testé. Couvrir : round-trip parse/serialize, défaut sort=score (MEMB-01/02).

---

## Shared Patterns

### Frontière producteur-unique (CRITIQUE — V1/V4)
**Source :** `packages/supabase/src/repositories/tradeSetups.ts` l.15 (« JAMAIS importé depuis apps/web »), `candles.ts` l.9, lint fixture `apps/web/src/lib/supabase/__lint_fixtures__/forbidden-service-import.ts`.
**Apply to :** TOUTES les lectures front (page liste, détail, queries.ts, SignalList).
**Règle :** le front lit UNIQUEMENT via le client anon (`createClient()` serveur ou `createBrowserSupabaseClient()`). ⛔ Ne JAMAIS `import` un repo service_role ni instancier un client service_role dans `apps/web`. La RLS est la vraie barrière (Pitfall #5).

### Gate UX + RLS (défense en profondeur — V4)
**Source :** `apps/web/src/app/[locale]/(member)/layout.tsx` l.8-13 + `lib/auth/gate.ts` l.83-97.
**Apply to :** toutes les routes sous `(member)/signaux/**`.
**Règle :** le gate `requireActiveSub()` est déjà posé par le layout → **ne pas** dupliquer un guard inline dans les pages signaux. La RLS `has_active_subscription()` (0009 l.88-91 / 0010) tranche réellement. La barrière trade_setups/analyses est `using (public.has_active_subscription())` (0009 l.87-97), PAS `using(true)` (0006 a été overridé par 0009).

### Client Supabase serveur (RSC)
**Source :** `apps/web/src/lib/supabase/server.ts` l.14-38 (createServerClient, cookies getAll/setAll, anon-key). `getUser()` jamais `getSession()` (gate.ts l.65). Importer depuis `../../../lib/supabase/server`.
**Apply to :** pages RSC liste + détail.

### Client Supabase navigateur (Realtime)
**Source :** `apps/web/src/lib/supabase/client.ts` l.5-7 → `anon-client.ts` l.20-25 (`createBrowserClient`, porte le token via cookies).
**Apply to :** SignalList (canal Realtime), tout composant `'use client'` qui lit.

### Navigation localisée
**Source :** `apps/web/src/i18n/navigation.ts` l.10-11 + usage dans `LanguageSwitcher.tsx`.
**Apply to :** FilterBar (`useRouter`/`usePathname`), SignalCard (`Link`). ⛔ Ne PAS utiliser `next/navigation` Link/useRouter (perd la locale `localePrefix:'always'`).

### i18n + RTL logique
**Source :** `dashboard/page.tsx` (`getTranslations`, `text-start`), `Disclaimer.tsx` (`ps-4 pe-4`).
**Apply to :** tous les composants. Texte via next-intl ; classes logiques `ms/me/ps/pe/start/end` ; valeurs numériques en `<bdi>` + `Intl`.

### Disclaimer membre (LEGAL-01 / D-20)
**Source :** `components/Disclaimer.tsx` l.12-15 (RSC, `getTranslations('disclaimer')`).
**Apply to :** surface signaux (liste + détail) — réutiliser `<Disclaimer/>` en footer transverse + ajouter un bandeau court dédié (nouvelle clé i18n `signals.disclaimerBanner`).

### Style migration
**Source :** `0009_subscriptions_gating.sql` l.1-19 (entête rationale) + 0006 l.6 (apply via MCP, pas db push).
**Apply to :** `0011_realtime_trade_setups.sql`.

---

## No Analog Found

| Fichier | Rôle | Data Flow | Raison |
|---------|------|-----------|--------|
| `components/signals/CandleChart.tsx` | client canvas | streaming | Aucun chart dans le repo. Suivre RESEARCH §Pattern 4 (lightweight-charts v5) ; à installer. |
| e2e Playwright `signals-*` | test | — | Config Playwright à confirmer en Wave 0 (RESEARCH §Wave 0 Gaps) ; aucun test e2e existant localisé. |

---

## Metadata

**Analog search scope :** `apps/web/src/{app,lib,components,messages,i18n}`, `packages/supabase/src/{anon-client,repositories}`, `packages/core/src/schemas`, `supabase/migrations/000{1,3,6,9},0010`.
**Files scanned :** ~24 ouverts.
**Corrections vs RESEARCH :** colonnes `instruments` = `symbol/asset_class/precision/display_name` (PAS `canonical_symbol/price_decimals`).
**Confirmé manquant (gap migration) :** aucune migration ne touche `supabase_realtime` ni `replica identity` → 0011 requise (grep « No files found »).
**Pattern extraction date :** 2026-06-15
