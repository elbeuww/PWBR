# Phase 3 : Espace membre signaux (gated RLS) — Recherche

**Recherché :** 2026-06-15
**Domaine :** Lecture front gated (Next.js 15 App Router + @supabase/ssr RLS) · charting financier (lightweight-charts v5) · temps réel sous RLS (Supabase Realtime postgres_changes) · filtres URL/RSC + react-query
**Confiance globale :** HIGH (tout est ancré dans des fichiers réellement lus du dépôt ; les 2 flags bloquants sont tranchés sur preuve de code)

---

<user_constraints>
## Contraintes utilisateur (depuis 03-CONTEXT.md)

### Décisions verrouillées (D-01 → D-20)
- **D-01** Grille de cartes responsives (1 col mobile / 2-3 desktop), à construire au-dessus du design system P2.
- **D-02** Liste membre = **uniquement `status = 'active'`**. `expired`/`invalidated` exclus (historique → P5).
- **D-03** Score = chiffre + libellé qualitatif de conviction + **couleur NEUTRE de marque**. ⛔ vert/rouge réservés à la sémantique trading uniquement.
- **D-04** Fraîcheur = âge relatif (« il y a 2 h », Intl/luxon, `<bdi>`) + échéance `valid_until`.
- **D-05** Filtres mixtes : chips toggle pour `style` + `risque` ; recherche/déroulant pour `actif` + `classe d'actif`.
- **D-06** Filtres cumulables (ET logique).
- **D-07** État filtres + tri persisté dans l'URL (query params), lisible côté serveur (RSC).
- **D-08** Tris : score décroissant (défaut) + « plus récents » (fraîcheur) + « meilleur R:R ».
- **D-09** Niveau 1 « explication simple » (`veteran_note` + plan résumé) ; Niveau 2 « analyse approfondie » dépliable (raisons + décompo score + invalidation + upcoming_risk_events).
- **D-10** Jargon = contenu IA affiché **TEL QUEL** + aide additive (infobulles/glossaire). ⛔ Ne JAMAIS reformuler le contenu faisant foi.
- **D-11** Décompo du score = barres par dimension via recharts **SI les composantes sont persistées**. ⚠️ FLAG → **tranché ci-dessous : NON persistées → repli « facteurs contributifs »**.
- **D-12** Chart chandeliers lightweight-charts v5, lecture seule, timeframe de l'analyse, ~100-150 bougies, lignes entrée/SL/TP légendées, vert/rouge sémantiques. ⚠️ FLAG (candles RLS) → **tranché ci-dessous**.
- **D-13** Badge discret « N nouveaux signaux — afficher » en haut, clic insère (non intrusif).
- **D-14** Temps réel écoute INSERT (`active`) ET transitions de statut (`active → expired/invalidated`) → disparition en direct.
- **D-15** Portée temps réel = liste seulement au MVP. Le détail est un instantané au chargement.
- **D-16** Repli silencieux si Realtime indisponible : chargement serveur initial + revalidation périodique légère. Le temps réel est un bonus, pas une dépendance dure.
- **D-17** Détail = route dédiée `/[locale]/(member)/signaux/[id]` (RSC, deep-link).
- **D-18** États soignés : vide rassurant, skeletons, erreur + réessayer.
- **D-19** Volume = tout afficher, plafond de sécurité ~100, pas de pagination MVP.
- **D-20** Disclaimer (LEGAL-01) = footer transverse (P2) + bandeau dédié sur la surface signaux (liste + détail).

### Discrétion de Claude
- Wiring exact Supabase Realtime (channel, filtres postgres_changes, interaction RLS).
- Découpage exact des composants (`SignalCard`, `FilterBar`, `SignalList`, `SignalDetail`, `CandleChart`, `ScoreBreakdown`, glossaire/tooltip).
- Format des nombres/prix par actif (décimales selon l'instrument) via Intl + `<bdi>`.
- Mécanique glossaire/infobulles (tooltip shadcn vs section dédiée).
- Stratégie de revalidation (intervalle refetch, react-query `staleTime` + Realtime).
- Étendre le namespace `signals` existant vs ajouter `signalDetail`/`glossary`.

### Idées différées (HORS SCOPE)
- Historique des signaux passés + % de réussite chiffré → **Phase 5** (track record).
- Détail en temps réel (signal ouvert qui s'invalide en direct) → écarté MVP (D-15).
- Notifications push / email → future phase.
- Pagination / scroll infini → seulement si le volume explose (improbable, borné par l'immuabilité).
- Accessibilité avancée du chart (résumé textuel structuré) → partiel via le plan résumé (D-09).
</user_constraints>

<phase_requirements>
## Exigences de la phase

| ID | Description (REQUIREMENTS.md § MEMB) | Support recherche |
|----|-------------|------------------|
| MEMB-01 | Liste des signaux actifs triés par score, carte = actif/direction/score/risque/R:R/fraîcheur | `trade_setups` lisible via RLS pour abonné (0006+0009) ; index `trade_setups_score_idx` (score desc) déjà présent ; lecture RSC via `createClient()` serveur (mirroir dashboard) |
| MEMB-02 | Filtres cumulables (actif/classe/style/risque) persistés en URL | `searchParams` RSC + traduction en `.eq()/.in()` sur le client serveur Supabase ; colonnes filtrables présentes sur `trade_setups` (`style`,`session`,`risk_level`,`instrument_id`) + jointure `instruments` pour `asset_class`/`canonical_symbol` |
| MEMB-03 | Détail : chart chandeliers (entrée/SL/TP) + explication simple → analyse approfondie | `trade_setups.payload` (§3 verbatim) + `candles` (OHLCV, RLS authenticated) ; lightweight-charts v5 client-only |
| MEMB-04 | Contenu IA affiché VERBATIM, jamais reformulé | `payload` = `OutputSchema` (§3) brut ; rendu as-is, glossaire additif uniquement |
| MEMB-05 | Mise à jour temps réel (badge « N nouveaux », repli silencieux) | Supabase Realtime postgres_changes sous RLS + react-query fallback ; ⚠️ migration publication requise (gap, voir §Runtime State) |
</phase_requirements>

## Résumé

La phase est presque entièrement une **couche de lecture** par-dessus un schéma cœur v1.0 déjà livré et déjà gated. Le gate UX (`requireActiveSub()`) et la barrière RLS (`has_active_subscription()` sur `trade_setups`/`analyses`) sont en place depuis la Phase 1 — P3 n'ajoute que le contenu lu via l'anon-client + RLS, jamais d'écriture front. Les patterns front (client serveur RSC `@supabase/ssr`, client navigateur, `getUser()`, i18n next-intl, RTL logique, lecture via repos typés) existent et sont à **mirroir-er** depuis le dashboard et le gate, pas à réinventer.

**Les deux flags bloquants sont tranchés sur preuve de code, pas sur hypothèse :**

1. **Composantes du score (D-11) : NON persistées.** `scoreSetup()` calcule bien un `ScoreBreakdown` (trendAlign/keyLevel/momentum/fundamental/news/rr/penalties), mais `persist.ts` ne l'écrit nulle part : `trade_setups.payload` reçoit uniquement l'`Output` §3 de l'agent (ligne 353), et `analyses.snapshot` reçoit le snapshot d'**entrée** (les indicateurs bruts), pas le breakdown. ⇒ **Repli D-11 obligatoire : « Facteurs contributifs »** (liste dérivée de `technical_reasons`/`fundamental_reasons`/`news_catalysts`), **pas** de barres recharts par dimension depuis la DB. (Option différable, hors scope : persister le breakdown via une migration + reprise du moteur — c'est une modif Phase « cœur », pas P3.)

2. **Lecture candles + Realtime : un GAP de migration à combler dans P3.** Les `candles` sont lisibles par tout `authenticated` (RLS `using (true)`, 0003) → le chart fonctionne pour l'abonné. MAIS **aucune migration ne configure la publication `supabase_realtime`** : `trade_setups` n'y est pas, et REPLICA IDENTITY n'est pas réglée pour les UPDATE/DELETE filtrés. ⇒ **P3 doit livrer une migration** (ajout de `trade_setups` à la publication + REPLICA IDENTITY) pour que MEMB-05 fonctionne. La RLS `has_active_subscription()` s'applique aux events postgres_changes (l'abonné ne reçoit que ce qu'il peut lire), à condition que le client navigateur porte le token de session.

**Primary recommendation :** Construire la surface en RSC (lecture serveur initiale : tri/filtre via `searchParams` traduits en requêtes Supabase) + un overlay client (react-query + un canal Realtime postgres_changes filtré `status=eq.active`). Livrer une **migration P3** : (a) `alter publication supabase_realtime add table public.trade_setups;` + REPLICA IDENTITY, (b) optionnellement aligner la RLS `candles` sur `has_active_subscription()` pour cohérence du gate (décision sécurité à confirmer). Chart = composant client `dynamic(..., { ssr:false })`. Décompo score = repli « Facteurs contributifs ».

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lecture initiale liste (tri/filtre) | Frontend Server (RSC) | Database (RLS) | `searchParams` lisibles serveur (D-07) ; RLS tranche réellement |
| Persistance / gating | Database (RLS Postgres) | — | `has_active_subscription()` = seule barrière non contournable (Pitfall #5) |
| Filtres cumulables état | Frontend Server (URL) | Browser | URL = source de vérité partageable/rechargeable (D-07) |
| Live (nouveaux/disparus) | Browser (Realtime client) | Database (publication+RLS) | postgres_changes filtré RLS ; canal navigateur avec token session |
| Cache + repli revalidation | Browser (react-query) | — | staleTime + refetch si Realtime tombe (D-16) |
| Chart chandeliers | Browser (canvas) | Database (candles RLS) | lightweight-charts = canvas client-only, lecture seule |
| Rendu contenu IA verbatim | Browser/RSC (présentation) | — | `payload` §3 affiché as-is ; glossaire additif |

## Standard Stack

### Core (déjà installé — vérifié dans `apps/web/package.json`)
| Library | Version installée | Purpose | Statut |
|---------|------|---------|--------------|
| next | `15` | App Router + RSC | [VERIFIED: apps/web/package.json] verrouillé |
| react / react-dom | `^19.2.7` | UI | [VERIFIED] |
| @supabase/ssr | `0.12.0` | Auth cookies + clients RSC/browser | [VERIFIED] paire supportée |
| @supabase/supabase-js | `2.108.0` | DB/Realtime client | [VERIFIED] |
| next-intl | `4.13.0` | i18n (fr/en/ar, localePrefix always) | [VERIFIED: apps/web/src/i18n/routing.ts] |
| next-themes | `0.4.6` | dark/light | [VERIFIED] |
| zod | `4.4.3` | validation (searchParams, env) | [VERIFIED] |
| tailwindcss + @tailwindcss/postcss | `4.3.1` | styling v4 (RTL logique) | [VERIFIED] |
| radix-ui | `1.5.0` | primitives shadcn v4 | [VERIFIED] |
| lucide-react | `1.18.0` | icônes | [VERIFIED] |

### Supporting (À INSTALLER — absents de apps/web/package.json)
| Library | Version cible | npm `latest` (2026-06-15) | Purpose | Provenance |
|---------|------|------|---------|-------------|
| lightweight-charts | `5.2.0` | `5.2.0` (publié 2026-04-24) | Chart chandeliers détail (D-12) | [VERIFIED: npm registry] + verrouillé CLAUDE.md ; latest == lock |
| @tanstack/react-query | `5.101.0` | `5.101.0` (2026-06-02) | Cache/refetch liste + repli Realtime (D-16) | [VERIFIED: npm registry] + verrouillé CLAUDE.md ; latest == lock |
| recharts | `3.6.1` (lock CLAUDE.md) | `3.8.1` (2026-06-07) | **Repli D-11 ne l'exige PAS** (pas de barres par dimension). À installer seulement si un graphe analytique neutre est ajouté ; sinon NE PAS l'installer en P3. | [VERIFIED: npm registry] — latest 3.8.1 > lock 3.6.1 (bump mineur) |

**Décision recharts :** comme D-11 tombe en repli « Facteurs contributifs » (liste textuelle, sans chiffres par dimension), **recharts n'est PAS nécessaire pour P3**. Ne l'installer que si le planner choisit d'ajouter une barre de progression neutre du score global (un simple `<div>` Tailwind suffit alors — recharts est surdimensionné pour une seule barre). Recommandation : **pas de recharts en P3**.

## Package Legitimacy Audit

> slopcheck non disponible dans cet environnement → packages tagués selon provenance. Tous sont des libs verrouillées CLAUDE.md / déjà au lockfile, donc faible risque ; le planner peut ajouter un `checkpoint:human-verify` avant install par prudence.

| Package | Registry | Âge / repo | Downloads | slopcheck | Disposition |
|---------|----------|-----|-----------|-----------|-------------|
| lightweight-charts | npm | TradingView OSS, mature | très élevés | n/a | Approuvé (verrouillé CLAUDE.md, latest=5.2.0 confirmé npm) |
| @tanstack/react-query | npm | TanStack, mature | très élevés | n/a | Approuvé (verrouillé CLAUDE.md, latest=5.101.0 confirmé npm) |
| recharts | npm | mature | très élevés | n/a | **NON requis P3** (repli D-11) |

**Removed [SLOP] :** aucun. **Flagged [SUS] :** aucun. Provenance : tous discoverés via CLAUDE.md (source projet autoritaire) ET confirmés via `npm view`.

## Architecture Patterns

### Diagramme de flux

```
                         ┌──────────────────────────────────────────────┐
  Navigation / URL ────► │  /[locale]/(member)/layout.tsx                │
  ?asset=&style=&...     │  requireActiveSub()  (gate UX, D-07/08)       │
                         └───────────────────────┬──────────────────────┘
                                                 │ (RLS = vraie barrière)
              ┌──────────────────────────────────▼───────────────────────────┐
              │  signaux/page.tsx  (RSC)                                       │
              │  1. createClient() serveur (@supabase/ssr, cookies)           │
              │  2. parse searchParams (Zod) → filtres + tri                  │
              │  3. SELECT trade_setups (status=active) + join instruments    │
              │     .eq(style)/.eq(risk_level)/.in(instrument_id)/.order(...) │
              │     limit 100                          ◄── RLS has_active_sub  │
              └───────────────┬───────────────────────────┬──────────────────┘
                              │ initial rows (HTML)        │ click carte
                              ▼                            ▼
              ┌───────────────────────────┐   ┌────────────────────────────────┐
              │ SignalList (client)        │   │ signaux/[id]/page.tsx (RSC)     │
              │ - react-query (initialData)│   │ - SELECT trade_setup by id      │
              │ - Realtime channel:        │   │ - SELECT candles (RLS auth)     │
              │   postgres_changes         │   │ - payload §3 verbatim           │
              │   table=trade_setups       │   └───────────┬─────────────────────┘
              │   filter=status=eq.active  │               ▼
              │   INSERT → badge "N new"   │   ┌────────────────────────────────┐
              │   UPDATE status≠active     │   │ CandleChart (client, no-SSR)   │
              │     → retire la carte      │   │ lightweight-charts v5          │
              │ - repli: refetch si canal  │   │ addSeries(CandlestickSeries)   │
              │   tombe (D-16)             │   │ + priceLine entrée/SL/TP        │
              └────────────────────────────┘   └────────────────────────────────┘
                              ▲
                  Supabase Realtime (WS) ── publication supabase_realtime
                  + token session (anon-client browser) ── RLS filtre les events
```

### Structure de fichiers recommandée
```
apps/web/src/
├── app/[locale]/(member)/signaux/
│   ├── page.tsx                 # RSC liste : searchParams → query Supabase (D-07/08/19)
│   └── [id]/page.tsx            # RSC détail : trade_setup + candles (D-17)
├── components/signals/
│   ├── SignalCard.tsx           # carte (D-01) — server-renderable
│   ├── FilterBar.tsx            # client : chips + select, sync URL (D-05/06/07)
│   ├── SignalList.tsx           # client : initialData + Realtime overlay (D-13/14/16)
│   ├── RealtimeBadge.tsx        # "N nouveaux signaux — afficher" (D-13)
│   ├── SignalDetail.tsx         # niveaux 1/2, contenu §3 verbatim (D-09/10)
│   ├── ContributingFactors.tsx  # repli D-11 (liste, PAS de barres)
│   ├── CandleChart.tsx          # 'use client' + dynamic no-SSR (D-12)
│   └── GlossaryTooltip.tsx      # aide additive (D-10)
├── lib/signals/
│   ├── searchParams.ts          # Zod schema + parse/serialize filtres+tri
│   └── queries.ts               # helpers SELECT (lecture seule, anon-client)
└── components/providers/QueryProvider.tsx  # react-query (client)
```

### Pattern 1 : Lecture RSC gated (mirroir dashboard)
**Quoi :** lire `trade_setups` côté serveur via le client `@supabase/ssr` à cookies ; la RLS tranche.
**Quand :** chargement initial de la liste et du détail.
```tsx
// Source : apps/web/src/app/[locale]/dashboard/page.tsx (mirroir vérifié)
//          apps/web/src/lib/supabase/server.ts (createClient async, getAll/setAll)
import { createClient } from '../../../lib/supabase/server'

export default async function SignalsPage({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const supabase = await createClient()        // anon-key + cookies ; JAMAIS service_role
  const sp = await searchParams                // Next 15 : async
  // ... parse sp via Zod (lib/signals/searchParams.ts)
  let q = supabase
    .from('trade_setups')
    .select('id, instrument_id, direction, opportunity_score, risk_level, risk_reward, style, valid_until, created_at, instruments!inner(canonical_symbol, asset_class, price_decimals)')
    .eq('status', 'active')                     // D-02 : actifs uniquement
    .limit(100)                                 // D-19 : plafond, pas de pagination
  // filtres cumulables (D-06) : .eq('style', …) / .eq('risk_level', …) / .in('instrument_id', …)
  // tri (D-08) : .order('opportunity_score',{ascending:false}) | 'created_at' | 'risk_reward'
  const { data, error } = await q
  // états D-18 : error → bloc erreur+réessayer ; data.length===0 → vide rassurant ; sinon grille
}
```
⚠️ **Ne JAMAIS** importer `@app/supabase/repositories/tradeSetups` (service_role write-only, frontière producteur-unique). Lecture front = client anon + RLS uniquement. [VERIFIED: packages/supabase/src/repositories/tradeSetups.ts entête + 01-CONTEXT D-07]

### Pattern 2 : Filtres cumulables persistés en URL (RSC-readable)
**Quoi :** l'URL `?asset=BTCUSDT&class=crypto&style=swing&risk=low&sort=score` est la source de vérité ; le RSC lit `searchParams`, le `FilterBar` (client) met à jour l'URL via `useRouter().replace`.
**Quand :** D-05/06/07/08. Utiliser `next-intl` navigation (`useRouter`/`usePathname` depuis `src/i18n/navigation.ts`) pour préserver la locale.
```tsx
// FilterBar.tsx ('use client') — sync sans rechargement complet
import { useRouter, usePathname } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
// toggle chip → next = new URLSearchParams(current); next.set('style', value)
// router.replace(`${pathname}?${next}`, { scroll:false })  // RSC re-render avec nouveaux filtres
```
Valider/normaliser chaque param avec Zod (enum style/risk, whitelist asset) avant de l'injecter dans la requête (anti-injection sur les `.eq`). [ASSUMED — pattern standard Next 15, à mirroir-er sur le style du repo]

### Pattern 3 : Realtime postgres_changes filtré + react-query overlay (D-13/14/16)
**Quoi :** un canal Realtime écoute `trade_setups` filtré `status=eq.active` ; INSERT → incrémente le badge ; UPDATE (status≠active) → retire la carte. react-query détient `initialData` (rows RSC) et refetch périodique en repli.
```tsx
// SignalList.tsx ('use client')
import { createClient } from '@/lib/supabase/client'   // browser anon-client (porte le token session)
const supabase = createClient()
const channel = supabase
  .channel('signals-active')
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'trade_setups', filter: 'status=eq.active' },
      (payload) => { /* badge "N nouveaux", D-13 ; n'insère qu'au clic */ })
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'trade_setups' },
      (payload) => { /* si payload.new.status !== 'active' → retirer la carte, D-14 */ })
  .subscribe((status) => { /* si status !== 'SUBSCRIBED' → repli react-query refetch, D-16 */ })
// cleanup : supabase.removeChannel(channel)
```
- La RLS `has_active_subscription()` s'applique aux events postgres_changes : l'abonné ne reçoit que les lignes qu'il peut lire ; un non-abonné ne reçoit rien. [CITED: supabase.com/blog/realtime-row-level-security-in-postgresql — « changes broadcast to authenticated users, respecting the same RLS policies »]
- Le client navigateur doit porter le **token de session** (l'anon-client `@supabase/ssr` `createBrowserClient` le fait via cookies). Ne JAMAIS utiliser service_role côté front. [VERIFIED: packages/supabase/src/anon-client.ts]
- **Repli D-16 :** ne pas dépendre du Realtime — react-query `refetchInterval` léger (ex. 60 s) + `staleTime` ; si `subscribe` n'atteint pas `SUBSCRIBED`, afficher la note discrète « Mise à jour temps réel indisponible… » (copy déjà fixée 03-UI-SPEC).

### Pattern 4 : Chart lightweight-charts v5 client-only (D-12)
**Quoi :** composant `'use client'` monté via `next/dynamic` avec `{ ssr:false }` (le canvas n'existe pas côté serveur). API v5 unifiée.
```tsx
// CandleChart.tsx ('use client')
import { createChart, CandlestickSeries, LineStyle } from 'lightweight-charts'  // v5 API
// const chart = createChart(el, { /* lecture seule */ handleScroll:false, handleScale:false, crosshair:{mode:0} })
// const series = chart.addSeries(CandlestickSeries, { upColor:'#15803D'/* long */, downColor:'#B91C1C' })
// series.setData(candles.map(c => ({ time: c.ts, open:c.open, high:c.high, low:c.low, close:c.close })))
// series.createPriceLine({ price: entry, color:'#1E5FBF', lineStyle: LineStyle.Dashed, title:'Entrée' })
// series.createPriceLine({ price: stop_loss, color:'#B91C1C', title:'SL' })
// take_profits.forEach((tp,i) => series.createPriceLine({ price: tp.price, color:'#15803D', title:`TP${i+1}` }))
```
- v5 : `addSeries(CandlestickSeries, …)` (PAS `addCandlestickSeries` v4). [CITED: lightweight-charts v5 — verrouillé CLAUDE.md « API v5 = series unifiée »]
- Lecture seule (D-12) : désactiver scroll/scale/crosshair. ~100-150 bougies → un seul timeframe (`timeframe_analysis` du payload §3 ; mapper sur `candles.timeframe` H1/H4/D).
- Canvas reste LTR même en `dir=rtl` ; encadrer les valeurs numériques hors-canvas en `<bdi>`. [VERIFIED: 03-UI-SPEC §Color/Spacing]
- `render-fail` → le plan résumé textuel (D-09) reste lisible sans le chart (a11y partielle + robustesse).

### Anti-patterns à éviter
- **Gating UI sans RLS** (Pitfall #5) : ne jamais s'appuyer sur le seul `requireActiveSub()` — la RLS est la barrière. Le front lit en anon-client ; sans RLS, tout serait exposé.
- **Importer le repo service_role dans `apps/web`** : il existe un lint fixture (`__lint_fixtures__/forbidden-service-import.ts`) qui interdit ça. Lecture = anon-client uniquement.
- **Reformuler le contenu IA** (D-10) : `veteran_note`/`*_reasons`/`invalidation`/`news_catalysts` rendus VERBATIM. Le glossaire est additif (tooltip à côté du terme), jamais une substitution du texte.
- **Vert/rouge décoratif** (D-03) : score = neutre brand-blue ; vert/rouge uniquement direction + bornes de prix du plan.
- **Chart en SSR** : import statique de lightweight-charts dans un RSC casse le build (référence `window`/canvas) → `dynamic(no-SSR)`.

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser | Pourquoi |
|---------|-------------|-------------|-----|
| Cache liste + refetch + repli Realtime | Store maison + setInterval | @tanstack/react-query | invalidation, staleTime, états loading/error gérés (verrouillé) |
| Chart chandeliers + price lines | Canvas/SVG maison | lightweight-charts v5 | perf canvas, `createPriceLine`, conçu OHLCV (verrouillé) |
| Temps réel | Polling agressif | Supabase Realtime postgres_changes (+ repli refetch léger) | RLS-aware, WS push, déjà dans la stack |
| Auth/cookies front | gestion JWT maison | @supabase/ssr (createServer/BrowserClient existants) | déjà implémenté P1, getAll/setAll non dépréciés |
| Dates relatives / TZ | `Date` maison | Intl.RelativeTimeFormat (UI) / luxon (logique) | DST/TZ corrects, `<bdi>` RTL |
| Validation searchParams | parsing manuel | Zod (déjà installé) | anti-injection sur `.eq`, types sûrs |
| i18n | chaînes en dur | next-intl (CI `check-i18n-hardcoded.mjs` bloque) | régression bloquée en CI |

**Insight clé :** quasi tout le travail neuf est de la **composition** de briques verrouillées + une **migration Realtime**. Le seul code « métier » réellement nouveau est le mapping searchParams→requête, le découpage composants, et le repli « facteurs contributifs ».

## Runtime State Inventory

> Phase principalement additive (nouveau code front) mais avec **une migration DB requise** et des gaps de config Realtime. Catégories explicites :

| Catégorie | Constat | Action requise |
|----------|-------------|------------------|
| Données stockées | `trade_setups`/`analyses`/`candles` existent et sont peuplés par les jobs cœur. `payload` = §3 verbatim ; `analyses.snapshot` = indicateurs d'entrée. **Le `ScoreBreakdown` n'est PAS stocké.** [VERIFIED: persist.ts l.353, score.ts l.40-49] | Aucune migration de données. Décompo score → repli « facteurs contributifs ». |
| Config service live | **Publication `supabase_realtime` NON configurée** par les migrations : aucun `alter publication … add table` dans `supabase/migrations/*`. [VERIFIED: grep — « No matches found »] `trade_setups` n'y est probablement pas. | **Migration P3 :** `alter publication supabase_realtime add table public.trade_setups;` + vérifier l'état réel via MCP/SQL sur le projet lié avant. |
| État REPLICA IDENTITY | Non réglée dans les migrations. Pour que les events UPDATE/DELETE portent l'ancien enregistrement et soient filtrables, REPLICA IDENTITY FULL est nécessaire sur `trade_setups`. | **Migration P3 :** `alter table public.trade_setups replica identity full;` (à confirmer contre la doc live + comportement du filtre `status=eq.active` sur UPDATE). |
| RLS candles (cohérence gate) | `candles` lisible par **tout `authenticated`** (`using (true)`, 0003), PAS gated par `has_active_subscription()`. Le chart fonctionne pour l'abonné, mais un authentifié non-abonné peut lire l'OHLCV. [VERIFIED: 0003 l.89-93] | **Décision sécurité (à confirmer) :** aligner `candles` sur `has_active_subscription()` pour cohérence du gate, OU documenter que l'OHLCV brut n'est pas le produit payant (le produit = setups/score). Le planner doit trancher avec l'utilisateur. |
| Secrets / env | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` déjà utilisés (anon-client.ts). Realtime navigateur n'en exige pas d'autres. | Aucune. JAMAIS service_role côté front. |
| Artefacts build | recharts/lightweight-charts/react-query absents du lockfile web. | `pnpm add` (voir Installation) + régénérer le lockfile. |
| Types générés | `database.types.ts` à jour pour `trade_setups`/`candles` (Row/Insert présents). | Aucune si aucune colonne ajoutée. Si on persistait le breakdown (hors scope) → `supabase gen types`. |

**Question canonique :** après le code front livré, deux choses runtime restent à régler côté DB : (1) la publication+REPLICA IDENTITY pour le live, (2) la cohérence RLS candles. Les deux sont des migrations/décisions de cette phase, pas du code front.

## Common Pitfalls

### Pitfall 1 : Croire que le score est décomposable depuis la DB (D-11)
**Ce qui cloche :** planifier des barres recharts par dimension qui n'ont aucune source de données.
**Cause :** `ScoreBreakdown` est calculé dans `score.ts` mais jeté par `persist.ts` (jamais écrit). `payload`=§3 (pas de score ni breakdown — l'`OutputSchema` exclut volontairement `opportunity_score`).
**Éviter :** repli D-11 « Facteurs contributifs » (liste dérivée des `*_reasons`). Pas de recharts.
**Signes :** une tâche qui cherche `payload.breakdown` ou `analyses.snapshot.breakdown` → n'existe pas.

### Pitfall 2 : Realtime « ne marche pas » faute de publication
**Ce qui cloche :** aucun event reçu malgré un canal correct.
**Cause :** `trade_setups` absent de `supabase_realtime` ; REPLICA IDENTITY par défaut → UPDATE/DELETE incomplets.
**Éviter :** migration P3 (add table + REPLICA IDENTITY FULL) ; vérifier l'état réel avant via SQL/MCP.
**Signes :** `subscribe` atteint `SUBSCRIBED` mais zéro callback à l'INSERT.

### Pitfall 3 : Realtime sans token → events filtrés à vide ou refusés
**Ce qui cloche :** l'abonné ne reçoit rien alors que la RLS l'autorise.
**Cause :** canal ouvert sans le JWT de session (RLS évalue `auth.uid()` = null → `has_active_subscription()` faux).
**Éviter :** utiliser `createBrowserClient` (@supabase/ssr) qui porte les cookies de session ; ne pas instancier un client anon « nu ».
**Signes :** lecture RSC OK (cookies serveur) mais live vide.

### Pitfall 4 : UPDATE de statut non capté → carte fantôme
**Ce qui cloche :** un signal passé `expired` reste affiché (contredit D-02/D-14).
**Cause :** filtre `status=eq.active` sur l'event UPDATE peut empêcher de recevoir la transition vers non-active (selon la sémantique du filtre Realtime sur new vs old).
**Éviter :** écouter UPDATE **sans** filtre statut (ou large) puis décider côté client (`payload.new.status !== 'active'` → retirer). REPLICA IDENTITY FULL aide à disposer de l'ancien état.
**Signes :** les cartes n'disparaissent jamais en live.

### Pitfall 5 : Chart importé en SSR
**Ce qui cloche :** build/render échoue (`window`/canvas indéfini).
**Éviter :** `const CandleChart = dynamic(() => import('@/components/signals/CandleChart'), { ssr:false })`.

### Pitfall 6 : Régression i18n / RTL
**Ce qui cloche :** chaîne en dur → CI rouge (`check-i18n-hardcoded.mjs`) ; classes physiques `left/right` cassent l'arabe.
**Éviter :** tout texte via next-intl (étendre `signals`, ajouter `signalDetail`/`glossary`) ; propriétés logiques `ms/me/ps/pe/start/end` ; valeurs numériques en `<bdi>`.

## Code Examples

### Requête liste filtrée+triée (lecture seule, RLS)
```tsx
// Source : mirroir dashboard/page.tsx + database.types.ts (trade_setups Row)
let q = supabase.from('trade_setups')
  .select('id, instrument_id, direction, opportunity_score, risk_level, risk_reward, style, valid_until, created_at, instruments!inner(canonical_symbol, asset_class, price_decimals)')
  .eq('status', 'active')
if (style)  q = q.eq('style', style)            // 'day' | 'swing'
if (risk)   q = q.eq('risk_level', risk)        // 'low'|'medium'|'high'|'extreme'
if (assets.length) q = q.in('instrument_id', assets)
q = sort === 'recent' ? q.order('created_at', { ascending:false })
  : sort === 'rr'     ? q.order('risk_reward', { ascending:false })
  :                     q.order('opportunity_score', { ascending:false })  // défaut D-08
const { data, error } = await q.limit(100)
```

### Lecture candles pour le détail
```tsx
// Source : candles RLS authenticated (0003) + CandleRow (database.types.ts l.670)
const { data: candles } = await supabase.from('candles')
  .select('ts, open, high, low, close')
  .eq('instrument_id', setup.instrument_id)
  .eq('timeframe', tf)          // tf dérivé de payload.timeframe_analysis → 'H1'|'H4'|'D'
  .order('ts', { ascending:true })
  .limit(150)                   // D-12 : ~100-150 bougies
```

### Migration Realtime (à livrer en P3)
```sql
-- 0011_realtime_trade_setups.sql (nom indicatif)
-- Vérifier l'état réel AVANT via MCP/SQL (la publication peut déjà contenir la table).
alter table public.trade_setups replica identity full;   -- old record sur UPDATE/DELETE
alter publication supabase_realtime add table public.trade_setups;
-- RLS de lecture déjà gated (0009/0010) → les events postgres_changes en héritent.
-- (Optionnel/décision) aligner candles sur le gate :
--   drop policy "candles: lecture authentifiés" on public.candles;
--   create policy "candles: abonnés actifs" on public.candles
--     for select to authenticated using (public.has_active_subscription());
```

## State of the Art

| Ancien | Actuel | Quand | Impact |
|--------------|------------------|--------------|--------|
| lightweight-charts v4 `addCandlestickSeries()` | v5 `addSeries(CandlestickSeries,…)` | v5 (2024+) | Suivre la doc v5, PAS les tutos v4 |
| `@supabase/auth-helpers` | `@supabase/ssr` getAll/setAll | déjà adopté P1 | Ne pas régresser |
| Realtime sans RLS | postgres_changes RLS-aware (authenticated) | depuis ~2022 | events filtrés par policy, aucun code de sécurité front |

**Déprécié / à éviter :** auth-helpers ; cookies get/set/remove (utiliser getAll/setAll) ; service_role côté front ; recharts pour une simple barre (Tailwind `<div>` suffit).

## Assumptions Log

| # | Claim | Section | Risque si faux |
|---|-------|---------|---------------|
| A1 | REPLICA IDENTITY FULL est requise pour des UPDATE/DELETE filtrés/complets sur trade_setups | Runtime/Code | Sans elle, les transitions de statut peuvent ne pas porter assez d'info → carte fantôme (D-14). À confirmer doc Supabase live + test. |
| A2 | Le filtre `status=eq.active` sur event UPDATE peut masquer la transition vers non-active | Pitfall 4 | Mauvais comportement de retrait live ; mitigation = écouter UPDATE large. À valider par test e2e. |
| A3 | `createBrowserClient` (@supabase/ssr) porte bien le token de session vers le canal Realtime | Pattern 3 | Si non, events filtrés à vide. Vérifier en runtime (subscribe + un INSERT de test). |
| A4 | La publication `supabase_realtime` ne contient pas déjà `trade_setups` | Runtime | Si déjà présente, la migration `add table` échoue (idempotence) → guarder/vérifier d'abord. |
| A5 | recharts non nécessaire en P3 (repli D-11) | Standard Stack | Si le planner veut une barre de progression → un `<div>` Tailwind suffit, pas recharts. |
| A6 | Le pattern FilterBar (useRouter.replace + searchParams) est conforme au style repo | Pattern 2 | Style/structure à aligner sur le code existant ; aucun composant filtre n'existe encore. |

## Open Questions (RESOLVED)

1. **Cohérence RLS candles vs gate.** `candles` est lisible par tout `authenticated`, pas seulement les abonnés.
   - Ce qu'on sait : 0003 pose `using (true)`. Le produit payant = setups/score (gated), pas l'OHLCV brut.
   - Recommandation : décision utilisateur. Par cohérence du gate, aligner sur `has_active_subscription()` (migration P3). Sinon documenter explicitement le choix.
   - **RÉSOLU :** tranché au checkpoint humain du Plan 01 Task 2 (migration 0011) — l'alignement RLS `candles` y est décidé/livré.
2. **État réel de la publication `supabase_realtime` sur le projet lié.**
   - Ce qu'on sait : aucune migration ne la touche.
   - Recommandation : vérifier via MCP/SQL (`select * from pg_publication_tables where pubname='supabase_realtime'`) AVANT d'écrire la migration, pour la rendre idempotente.
   - **RÉSOLU :** géré dans le Plan 01 Task 2 — la migration 0011 porte une garde idempotente sur l'`alter publication` (vérification d'état avant ajout).
3. **Persister le `ScoreBreakdown` (pour de vraies barres par dimension, post-MVP) ?**
   - Ce qu'on sait : le breakdown est calculé mais jeté. Le persister = migration colonne + reprise `persist.ts` (phase cœur, hors P3).
   - Recommandation : repli « facteurs contributifs » en P3 ; noter comme amélioration future éventuelle.
   - **RÉSOLU :** hors scope MVP (D-15 déféré, documenté dans 03-CONTEXT) — P3 livre le repli « facteurs contributifs », la persistance du breakdown reste une amélioration future.

## Environment Availability

| Dépendance | Requise par | Disponible | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (Postgres/Realtime/RLS) | toute la phase | ✓ (MCP connecté) | Postgres 15+ | — |
| Publication supabase_realtime | MEMB-05 | ✗ (non configurée par migrations) | — | repli react-query refetch (D-16) + migration P3 |
| lightweight-charts | MEMB-03 chart | ✗ (à installer) | 5.2.0 | plan résumé textuel (render-fail) |
| @tanstack/react-query | liste/live | ✗ (à installer) | 5.101.0 | — |
| recharts | (repli D-11 → non requis) | ✗ | — | liste « facteurs contributifs » |

**Manquantes sans fallback :** publication Realtime → mais MEMB-05 a un repli (D-16) ⇒ pas bloquant pour le reste.
**Manquantes avec fallback :** libs npm (install simple).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.8` (unit) + @playwright/test `1.60.0` (e2e) |
| Config | racine workspace (vitest) ; playwright config attendue dans apps/web — **vérifier en Wave 0** |
| Quick run | `pnpm vitest run <path>` |
| Full suite | `pnpm vitest run` + `pnpm playwright test` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Commande | Existe ? |
|--------|----------|------|----------|----------|
| MEMB-01 | mapping searchParams→query, tri par défaut score desc | unit | `pnpm vitest run apps/web/src/lib/signals/__tests__/searchParams.test.ts` | ❌ Wave 0 |
| MEMB-02 | filtres cumulables sérialisés/parsés en URL (round-trip) | unit | idem ci-dessus | ❌ Wave 0 |
| MEMB-01/02 | RLS : non-abonné ne voit aucun signal ; abonné voit la liste | e2e | `pnpm playwright test signals-rls` | ❌ Wave 0 (réutilise le pattern test RLS journal P1) |
| MEMB-03 | détail rend le plan + monte le chart (entrée/SL/TP) | e2e | `pnpm playwright test signal-detail` | ❌ Wave 0 |
| MEMB-04 | contenu IA rendu VERBATIM (pas de transform) | unit (snapshot du rendu) | `pnpm vitest run …SignalDetail.test.tsx` | ❌ Wave 0 |
| MEMB-05 | Realtime : INSERT→badge ; UPDATE non-active→retrait ; repli si canal tombe | e2e/intégration | `pnpm playwright test signals-realtime` | ❌ Wave 0 (peut nécessiter un service_role de test pour INSERT/UPDATE) |

### Sampling Rate
- **Par commit de tâche :** vitest sur le module touché.
- **Par merge de wave :** suite vitest complète + e2e ciblé.
- **Phase gate :** vitest + playwright verts avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/web/src/lib/signals/__tests__/searchParams.test.ts` — round-trip filtres/tri (MEMB-01/02)
- [ ] e2e `signals-rls` — abonné vs non-abonné (mirroir test RLS P1)
- [ ] e2e `signal-detail` — chart + plan (MEMB-03)
- [ ] test rendu verbatim contenu IA (MEMB-04)
- [ ] e2e `signals-realtime` — INSERT/UPDATE/repli (MEMB-05) ; prévoir un util d'injection (service_role de test, hors front)
- [ ] Confirmer présence d'une config Playwright dans apps/web ; sinon l'ajouter

## Security Domain

> `security_enforcement` actif (jamais désactivé). Surface = données payantes derrière RLS + contenu légal sensible.

### Catégories ASVS applicables
| ASVS | Applique | Contrôle standard |
|---------------|---------|-----------------|
| V1 Architecture | oui | Frontière producteur-unique (lecture anon, écriture service_role jobs) ; RLS = barrière |
| V2 Authentication | oui (hérité P1) | `getUser()` serveur (jamais `getSession()`) ; cookies @supabase/ssr |
| V4 Access Control | **oui (cœur)** | RLS `has_active_subscription()` sur trade_setups/analyses ; gate UX `requireActiveSub()` en défense en profondeur ; **décision RLS candles** |
| V5 Input Validation | oui | Zod sur searchParams (anti-injection `.eq/.in`), whitelist enums |
| V7 Error/Logging | oui | états erreur sans fuite ; pas de détail technique exposé |
| V13 API/Realtime | oui | canal Realtime avec token session ; jamais service_role front ; events filtrés par RLS |

### Threat patterns pour cette stack
| Pattern | STRIDE | Mitigation |
|---------|--------|---------------------|
| Gating UI sans RLS (data leak) | Information Disclosure | RLS Postgres (Pitfall #5 projet) — déjà posée, ne pas régresser |
| service_role exposé côté front | Elevation of Privilege | anon-client uniquement ; lint fixture `forbidden-service-import` |
| Injection via searchParams dans `.eq/.in` | Tampering | Zod validate + whitelist avant requête |
| Realtime sans token → fuite/échec RLS | Information Disclosure | createBrowserClient porte la session ; tester events |
| Open-redirect (returnTo) | — (hérité) | `safeReturnTo()` déjà en place (gate.ts) |
| candles lisibles hors abonnement | Information Disclosure | décision : aligner RLS candles sur le gate, ou documenter |
| Promesse de gain / conseil personnalisé | Compliance (LEGAL-01) | bandeau dédié + footer Disclaimer (D-20), contenu éducatif |

## Project Constraints (from CLAUDE.md)
- Stack verrouillée : Next 15 (PAS 16), Tailwind v4, shadcn v4, lightweight-charts 5.x, @supabase/ssr 0.12, supabase-js 2.108, react-query 5, luxon, Zod v4.
- Démo/testnet d'abord ; clés en `.env` non commitées ; service_role réservé aux jobs ; RLS stricte ; jamais de secret hardcodé.
- Légal : contenu éducatif, disclaimers explicites, aucune promesse de gain.
- Immutabilité (coding-style global) : créer de nouveaux objets, pas de mutation.
- Tests : couverture 80 % cible ; TDD ; e2e Playwright pour les flux critiques (RLS).
- i18n : tout texte via next-intl (CI `check-i18n-hardcoded.mjs`) ; RTL logique ; valeurs en `<bdi>`.

## Sources

### Primaire (HIGH)
- Code dépôt lu : `supabase/migrations/0003,0005,0006,0009,0010.sql` ; `apps/jobs/src/jobs/persist.ts` ; `packages/core/src/scoring/{score,weights,index}.ts` ; `packages/core/src/schemas/output.ts` ; `packages/supabase/src/{anon-client.ts,repositories/{tradeSetups,candles}.ts,database.types.ts}` ; `apps/web/src/{lib/supabase/{client,server}.ts,lib/auth/gate.ts,app/[locale]/(member)/{layout,signaux/page}.tsx,app/[locale]/dashboard/page.tsx,i18n/routing.ts,messages/fr.json}` ; `apps/web/package.json` ; root `package.json`.
- 03-CONTEXT.md, 03-UI-SPEC.md, CLAUDE.md (stack lock).
- npm registry (2026-06-15) : lightweight-charts 5.2.0, @tanstack/react-query 5.101.0, recharts 3.8.1.

### Secondaire (MEDIUM)
- [Supabase blog — Realtime RLS](https://supabase.com/blog/realtime-row-level-security-in-postgresql) — events broadcast aux authenticated, respectant la RLS.
- [Supabase Realtime Authorization docs](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Tertiaire (LOW — à valider)
- REPLICA IDENTITY FULL + sémantique du filtre postgres_changes sur UPDATE → training knowledge, marqué [ASSUMED] (A1/A2), à confirmer doc live + test.

## Metadata
**Confidence breakdown :**
- Flags tranchés (score non persisté, Realtime/publication, candles RLS) : HIGH — preuve de code directe.
- Stack & versions : HIGH — vérifié npm + lockfile.
- Wiring Realtime exact (REPLICA IDENTITY, filtre UPDATE) : MEDIUM — principe HIGH (RLS-aware), détails à valider runtime.
- Patterns front : HIGH — mirroir de code existant.

**Research date :** 2026-06-15
**Valid until :** ~2026-07-15 (stack verrouillée, stable) ; revérifier la publication Realtime sur le projet avant la migration.

## RESEARCH COMPLETE
