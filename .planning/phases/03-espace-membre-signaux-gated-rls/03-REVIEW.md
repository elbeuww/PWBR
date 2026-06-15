---
phase: 03-espace-membre-signaux-gated-rls
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - apps/web/src/app/[locale]/(member)/signaux/page.tsx
  - apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
  - apps/web/src/components/providers/QueryProvider.tsx
  - apps/web/src/components/signals/SignalCard.tsx
  - apps/web/src/components/signals/FilterBar.tsx
  - apps/web/src/components/signals/SignalList.tsx
  - apps/web/src/components/signals/RealtimeBadge.tsx
  - apps/web/src/components/signals/SignalsDisclaimerBanner.tsx
  - apps/web/src/components/signals/SignalDetail.tsx
  - apps/web/src/components/signals/CandleChart.tsx
  - apps/web/src/components/signals/ContributingFactors.tsx
  - apps/web/src/components/signals/GlossaryTooltip.tsx
  - apps/web/src/components/signals/__tests__/SignalDetail.test.tsx
  - apps/web/src/lib/signals/searchParams.ts
  - apps/web/src/lib/signals/__tests__/searchParams.test.ts
  - apps/web/src/lib/signals/format.ts
  - apps/web/src/lib/signals/queries.ts
  - apps/web/tests/signals-rls.spec.ts
  - supabase/migrations/0011_realtime_trade_setups.sql
  - playwright.config.ts
  - vitest.config.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: fixed
resolved:
  - CR-01
  - CR-02
  - WR-01
  - WR-02
  - WR-03
  - WR-04
remaining:
  - IN-01
  - IN-02
  - IN-03
fixed_at: 2026-06-15
fix_commits:
  - 790a222 # CR-01 WR-04 page.tsx
  - 4feb453 # CR-02 queries.ts
  - 9d56477 # WR-01 WR-02 SignalList.tsx
  - 0c349d8 # WR-03 SignalDetail.test.tsx
---

# Phase 03 : Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 20
**Status:** fixed (CR-01, CR-02, WR-01..WR-04 résolus le 2026-06-15 ; IN-01..IN-03 hors scope)

## Summary

La surface signaux est globalement bien construite sur les priorités de la phase : la barrière RLS est respectée (aucun import service_role dans apps/web), le contenu IA est rendu verbatim échappé par React (zéro `dangerouslySetInnerHTML`), et le parsing Zod protège efficacement les filtres contre l'injection. Deux défauts critiques ont été identifiés : un accès sans nullcheck à `payload.entry` qui peut lever une exception 500 côté serveur (IDOR indirect), et des filtres sur colonnes jointes (`instruments.asset_class`, `instruments.symbol`) via `.eq()` qui ne fonctionnent pas en PostgREST et retournent tous les résultats sans filtrage silencieux. Quatre avertissements fonctionnels affectent le Realtime, le test d'injection et la robustesse de l'état.

---

## Critical Issues

### CR-01: Accès non gardé `payload.entry.price` — crash 500 si payload IA malformé

**File:** `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx:91`

**Issue:** Le `payload` est casté `as unknown as TradeSetupDetail` (ligne 61) sans aucune validation Zod. Sur la ligne 91, `payload.entry.price` est accédé directement. Si la colonne JSONB `payload` en base contient un enregistrement où `entry` est `null`, `undefined`, ou la clé est absente (payload IA malformé ou enregistrement de fixture), le serveur lève une `TypeError: Cannot read properties of null (reading 'price')`, retourne une erreur 500 visible. C'est un crash serveur résultant d'une donnée non validée — le comportement diverge entre un 404 attendu (notFound) et un 500 observé selon le contenu du payload.

Même risque sur `payload.stop_loss`, `payload.take_profits`, `payload.timeframe_analysis` aux lignes 65, 74, 92-94 — tous accédés sans guard.

**Fix:**
```typescript
// Valider le payload avec Zod avant d'accéder aux champs.
// Ajouter dans packages/core/src/schemas/output.ts ou localement :
import { z } from 'zod'

const SignalPayloadSchema = z.object({
  direction: z.enum(['long', 'short']),
  timeframe_analysis: z.string(),
  entry: z.object({ type: z.string(), price: z.number(), zone: z.tuple([z.number(), z.number()]) }),
  stop_loss: z.number(),
  take_profits: z.array(z.object({ price: z.number(), alloc_pct: z.number() })),
  // ... autres champs
  veteran_note: z.string(),
  invalidation: z.string(),
  technical_reasons: z.array(z.string()),
  fundamental_reasons: z.array(z.string()),
  news_catalysts: z.array(z.object({ headline: z.string(), impact: z.string(), direction: z.string(), ts: z.string() })),
  upcoming_risk_events: z.array(z.object({ event: z.string(), ts: z.string(), note: z.string() })),
})

// Dans SignalDetailPage, après la lecture Supabase :
const payloadResult = SignalPayloadSchema.safeParse(setup.payload)
if (!payloadResult.success) {
  notFound() // payload IA invalide → même comportement que signal absent
}
const detail = { ...setup, payload: payloadResult.data } as TradeSetupDetail
```

---

### CR-02: Filtres sur colonnes jointes `.eq('instruments.asset_class', ...)` inopérants en PostgREST

**File:** `apps/web/src/lib/signals/queries.ts:72-73`

**Issue:** Les filtres `params.class` et `params.asset` sont appliqués via :
```typescript
if (params.class) query = query.eq('instruments.asset_class', params.class)
if (params.asset) query = query.eq('instruments.symbol', params.asset)
```

PostgREST (le moteur derrière Supabase) ne supporte pas `.eq()` sur des colonnes d'une table jointe avec la notation pointée sur un `select` standard. Ces appels sont silencieusement ignorés ou génèrent une erreur masquée par le cast `as unknown as SignalRow[]` (ligne 90). Résultat : lorsque l'utilisateur filtre par classe d'actif ou par symbole, **tous** les signaux actifs sont retournés sans filtrage, ce qui est un bug fonctionnel majeur (la barrière RLS tient, mais le filtre utilisateur ne fonctionne pas).

**Fix:** Utiliser un filtre PostgREST compatible via une colonne calculée, un RPC, ou restructurer la requête pour filtrer d'abord par `instrument_id` :
```typescript
// Option A — sous-requête via RPC (recommandé pour le filtrage sur join)
// Option B — pré-résoudre l'instrument_id depuis un select séparé sur instruments
if (params.class) {
  // Filtrer instrument_ids correspondants puis appliquer
  const { data: instrIds } = await supabase
    .from('instruments')
    .select('id')
    .eq('asset_class', params.class)
  const ids = (instrIds ?? []).map((r) => r.id)
  if (ids.length > 0) query = query.in('instrument_id', ids)
  else return { data: [], error: null } // aucun instrument dans cette classe
}
if (params.asset) {
  const { data: instrId } = await supabase
    .from('instruments')
    .select('id')
    .eq('symbol', params.asset)
    .maybeSingle()
  if (!instrId) return { data: [], error: null }
  query = query.eq('instrument_id', instrId.id)
}
```

---

## Warnings

### WR-01: `setRealtimeLost(status !== 'SUBSCRIBED')` active le fallback prématurément

**File:** `apps/web/src/components/signals/SignalList.tsx:101`

**Issue:** Le callback `.subscribe((status) => ...)` est appelé avec des états intermédiaires tels que `'SUBSCRIBING'`. Sur le premier appel avec `'SUBSCRIBING'`, `setRealtimeLost(true)` est exécuté immédiatement, activant `refetchInterval: REFETCH_FALLBACK_MS` et affichant le message `realtimeLost` — avant même que la connexion ait eu le temps de s'établir. L'utilisateur voit une fausse alerte "connexion perdue" lors de chaque montage du composant.

**Fix:**
```typescript
.subscribe((status) => {
  // Basculer en repli uniquement si la connexion a définitivement échoué,
  // pas pendant la phase d'établissement.
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    setRealtimeLost(true)
  } else if (status === 'SUBSCRIBED') {
    setRealtimeLost(false)
  }
  // 'SUBSCRIBING' → ne rien faire, la connexion est en cours.
})
```

---

### WR-02: `revealNew()` efface les `removedIds` au clic badge — cartes retirées réapparaissent

**File:** `apps/web/src/components/signals/SignalList.tsx:110-113`

**Issue:**
```typescript
function revealNew() {
  setNewCount(0)
  setRemovedIds(new Set()) // BUG : remet le Set à vide
  void refetchRef.current()
}
```
Lors du clic sur le badge "N nouveaux signaux", `removedIds` est vidé, ce qui fait réapparaître brièvement toutes les cartes retirées en temps réel (signaux devenus `expired` ou `invalidated`). Ensuite le refetch les retire à nouveau, causant un flash visuel indésiré et un état incohérent pendant ~100ms.

**Fix:**
```typescript
function revealNew() {
  setNewCount(0)
  // Ne PAS vider removedIds ici — les signaux retirés sont retirés de manière permanente.
  // Le refetch exclura également les signaux non-actifs.
  void refetchRef.current()
}
// Après le refetch, react-query met à jour `data` avec uniquement les actifs → le filter
// `visible = data.filter(s => !removedIds.has(s.id))` est cohérent.
```

---

### WR-03: Test `dangerouslySetInnerHTML` incomplet — vérifie uniquement `<script`

**File:** `apps/web/src/components/signals/__tests__/SignalDetail.test.tsx:83`

**Issue:**
```typescript
it('n'utilise JAMAIS dangerouslySetInnerHTML (rendu échappé)', () => {
  expect(html).not.toContain('<script')
})
```
Ce test ne prouve pas l'absence d'injection HTML. Il vérifie seulement l'absence de la balise `<script` — un payload contenant `<img src=x onerror=alert(1)>` ou `<iframe src=...>` ne serait pas détecté. De plus, `renderToStaticMarkup` d'un contenu texte échappé produit des entités HTML (`&lt;img...&gt;`) — le test devrait vérifier que les balises HTML brutes issues du payload sont bel et bien encodées.

**Fix:**
```typescript
it('n'utilise JAMAIS dangerouslySetInnerHTML (rendu échappé)', () => {
  // Vérifie que les caractères spéciaux du contenu IA sont encodés
  // (React échappe automatiquement les enfants texte).
  expect(html).not.toContain('dangerouslySetInnerHTML')
  
  // Simuler un payload avec injection HTML et vérifier qu'il est encodé :
  const xssSetup = makeSetup()
  xssSetup.payload.veteran_note = '<img src=x onerror=alert(1)>'
  const xssHtml = renderToStaticMarkup(
    createElement(SignalDetail, { setup: xssSetup, locale: 'fr' }),
  )
  expect(xssHtml).not.toContain('<img src=x')
  expect(xssHtml).toContain('&lt;img')
})
```

---

### WR-04: `mapTimeframe` reconnaît `'D'` sur n'importe quelle string contenant "D"

**File:** `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx:35-40`

**Issue:**
```typescript
function mapTimeframe(raw: string): 'H1' | 'H4' | 'D' {
  const v = (raw ?? '').toUpperCase()
  if (v.includes('H4') || v.includes('4H')) return 'H4'
  if (v.includes('D') || v.includes('1D') || v.includes('DAY')) return 'D'
  return 'H1'
}
```
Le test `v.includes('D')` matche n'importe quelle valeur contenant la lettre "D" : par exemple `'UNDEFINED'`, `'STANDARD'`, `'WEDNESDAY'`. Si l'IA génère un `timeframe_analysis` non anticipé contenant "D", le chart chargera des données D (daily) alors que le contexte analytique est différent. L'ordre des conditions protège contre `'H4D'` (H4 prend la priorité), mais `'INTRADAY'` retournerait `'D'` au lieu de `'H1'`.

**Fix:**
```typescript
function mapTimeframe(raw: string): 'H1' | 'H4' | 'D' {
  const v = (raw ?? '').toUpperCase().trim()
  if (v === 'H4' || v === '4H') return 'H4'
  if (v === 'D' || v === '1D' || v === 'DAY' || v === 'DAILY') return 'D'
  if (v.includes('H4') || v.includes('4H')) return 'H4'
  if (v.includes('1D') || v.includes('DAY')) return 'D'
  return 'H1'
}
```

---

## Info

### IN-01: Commentaire trompeur — `CrosshairMode.Normal` ≠ "mode 0 off"

**File:** `apps/web/src/components/signals/CandleChart.tsx:9` et `86`

**Issue:** Le commentaire de module dit "crosshair mode 0 (Normal off)" et code utilise `CrosshairMode.Normal`. Dans l'enum lightweight-charts v5, `Normal = 0` signifie crosshair libre actif — ce n'est pas "off". `CrosshairMode.Hidden = 2` désactive le crosshair. Le comportement réel (crosshair actif, lecture seule sur scroll/scale) est acceptable pour une vue lecture seule, mais le commentaire induit en erreur les futurs développeurs sur l'intention.

**Fix:** Corriger le commentaire :
```typescript
// Lecture seule (D-12) : scroll/scale désactivés. Crosshair actif (Normal)
// pour permettre la lecture des prix au survol.
crosshair: { mode: CrosshairMode.Normal },
// Si l'intention est de désactiver totalement : CrosshairMode.Hidden
```

---

### IN-02: `asset` sans limite de longueur maximale dans `searchParams.ts`

**File:** `apps/web/src/lib/signals/searchParams.ts:25`

**Issue:**
```typescript
asset: z.string().min(1).optional(),
```
Le champ `asset` n'a pas de contrainte `max()`. Une string de plusieurs milliers de caractères passerait la validation Zod, serait transmise à `.eq('instruments.symbol', params.asset)` (valeur paramétrée — pas d'injection SQL), mais pourrait causer des logs anormaux ou une requête inutilement grande. En pratique les symboles ne dépassent pas 20 caractères.

**Fix:**
```typescript
asset: z.string().min(1).max(20).optional(),
```

---

### IN-03: Vitest exclut le fichier de test E2E RLS `signals-rls.spec.ts`

**File:** `vitest.config.ts:37-41`

**Issue:** Le test `apps/web/tests/signals-rls.spec.ts` est un test Playwright (import `@playwright/test`) mais le pattern `vitest.config.ts` inclut `apps/web/test/**/*.test.ts` (répertoire `test`, pas `tests`). Le répertoire réel est `tests/` (avec un 's'). Ce n'est pas un bug dans le test lui-même (il est Playwright, pas Vitest), mais le pattern Vitest ne le ramasserait pas s'il était renommé accidentellement en `.test.ts`. La séparation `tests/*.spec.ts` (Playwright) vs `__tests__/*.test.ts` (Vitest) est correcte et intentionnelle — aucune action requise si la convention est documentée.

**Note:** Vérifier que `playwright.config.ts` ligne 17 (`testMatch: ['tests/**/*.spec.ts']`) correspond bien au chemin `apps/web/tests/signals-rls.spec.ts` — le `testDir: 'apps/web'` + `testMatch: ['tests/**/*.spec.ts']` → résout en `apps/web/tests/**/*.spec.ts`, ce qui est correct.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
