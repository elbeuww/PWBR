# Phase 4 : Paiement USDT MVP & abonnement — JALON ENCAISSEMENT - Research

**Researched:** 2026-06-15
**Domain:** Vérification on-chain TRC-20 (TronGrid), monnaie atomique BigInt, RLS producteur-unique, cycle de vie d'abonnement, job idempotent, polling react-query
**Confidence:** MEDIUM-HIGH (patterns codebase = HIGH ; formes de réponse TronGrid = ASSUMED, réseau bloqué cette session → à vérifier avant implémentation)

> ⚠️ **Avertissement de provenance majeur.** L'accès réseau (WebFetch, curl, node fetch, MCP context-mode) était **bloqué** durant cette session de recherche. Les formes exactes de réponse JSON de TronGrid (champs, casing) n'ont **pas pu être confirmées en direct**. Elles sont documentées depuis la connaissance d'entraînement + les résultats WebSearch (docs officielles `developers.tron.network`) et taguées `[ASSUMED]` ou `[CITED: url]`. **Wave 0 DOIT inclure une tâche `checkpoint:human-verify` qui frappe TronGrid testnet (Nile) sur une vraie TX et fige la forme réelle dans des fixtures avant d'écrire le parseur.** Ne jamais traiter ces formes comme verrouillées.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 :** Une seule adresse USDT TRC-20 partagée (cold wallet ; watcher lecture seule ; clés privées JAMAIS en code ni DB). Hash + montant unique distinguent les paiements. Pas d'adresses HD par user.
- **D-02 :** Polling live in-app pendant la vérif on-chain (~1 min) ; accès s'ouvre dès confirmation. Repli différé acceptable si job lent (à arbitrer planning).
- **D-03 :** Screenshot optionnel — preuve file superadmin, JAMAIS dans la vérif auto (hash = seule source de vérité). Zéro friction si absent.
- **D-04 :** Échec → raison claire + re-soumission tracée. Pas de bascule auto en file pour erreurs triviales (faute de frappe).
- **D-05 :** Montant unique par facture (centimes 9.01/9.02… / 3.01…) pour matching déterministe. Montant affiché = nominal + offset unique. Calcul/comparaison decimals 6 (BigInt atomique ×10⁶, zéro float). *(Flag planning : durée de validité offset / collision space.)*
- **D-06 :** Sous-paiement → file de validation superadmin (décision manuelle). Pas de rejet auto.
- **D-07 :** Sur-paiement → activer période normale, surplus ignoré (noté, non remboursé auto).
- **D-08 :** File superadmin = paiements ambigus + actions Activer / Rejeter (motif) + ajuster durée/plan. User écrit QUE `payments(pending)` ; seul service_role transitionne vers `verified`/`active`.
- **D-09 :** Rappel avant expiration = bandeau in-app (J-3/J-1). AUCUNE infra email au MVP.
- **D-10 :** Coupe nette à `current_period_end` (RLS le fait déjà). Pas de période de grâce.
- **D-11 :** Renouvellement = même parcours de paiement (nouveau hash) → prolonge `current_period_end`. Pas d'auto-renew.
- **D-12 :** Offre découverte 3 $/7 j = one-shot + upgrade anticipé. Enforcement par historique DB (`plan='discovery'` déjà consommé). En période découverte : peut passer au standard (nouveau paiement prolonge), sans remboursement. Pas de cumul libre.
- **D-13 :** Vue membres superadmin = lecture + actions manuelles (activer/prolonger, révoquer/suspendre, changer de plan). Toute action via service_role.
- **D-14 :** Liste membres = filtre statut + recherche email + colonnes plan / expiration / dernier paiement.
- **D-15 :** Emplacement = route group `(admin)` existant (HORS `[locale]`, 404 non-superadmin). Squelette existe déjà.

### Claude's Discretion
- Schéma exact table `payments` (migration **0012**) + policies RLS (insert pending user ; lectures scopées ; transitions service_role ; `UNIQUE(tx_hash)` GLOBAL).
- Forme du client TronGrid (fetch + Zod maison) : lecture TX TRC-20, normalisation destinataire hex↔base58, `only_confirmed:true`, montant BigInt ×10⁶.
- Variables `.env` : adresse réception USDT TRC-20, contrat USDT officiel (`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`), clé/endpoint TronGrid. JAMAIS de clé privée.
- Mécanique offset de montant unique (D-05) : plage, durée de réservation, libération.
- Job `subscription-expiry` (Windows Task Scheduler + idempotence `job_runs`).
- Découpage composants UI + extension namespace messages (`payment`).
- Stratégie polling (intervalle/timeout, react-query) + repli différé éventuel.

### Deferred Ideas (OUT OF SCOPE)
- Reset mot de passe membre par superadmin (auth — P8 ou tâche dédiée).
- Auto-renew / paiement récurrent (impossible USDT manuel).
- Watcher push on-chain généralisé / détection auto sans hash (PAY-AUTO, Wave 5 hors roadmap).
- Infra email (rappels/reçus) — bandeau in-app au MVP.
- Période de grâce après expiration — coupe nette.
- Remboursement auto sur-paiements — à la main via file/vue membres.
- Adresses USDT dérivées par user (HD wallet) — une adresse partagée + montant unique.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | User voit adresse USDT TRC-20 + montant exact dû | §UI PaymentPanel, §Money Handling (montant atomique affiché = nominal+offset), QR client-side offline |
| PAY-02 | User soumet hash (+screenshot opt) ; vérif on-chain TronGrid (contrat/montant/destinataire/confirmations) | §TronGrid Client, §Money Handling, §Architecture (server action service_role) |
| PAY-03 | Paiement valide active l'abonnement (période + expiration) sans intervention | §Subscription State Model, §Architecture (transition service_role atomique) |
| PAY-04 | Replay / mauvais montant·token·destinataire / non confirmé → rejeté+tracé ; ambigus → file superadmin | §payments schema (`UNIQUE(tx_hash)` global), §Verification Decision Tree, §Pitfalls |
| PAY-05 | Abonnement expire en fin de période ; user informé, perd accès | §subscription-expiry job, §UI ExpiryBanner, RLS `has_active_subscription()` (déjà posée) |
| PAY-06 | Offre découverte 3 $/7 j one-shot puis standard | §Subscription State Model (enforcement DB `plan='discovery'`), §UI PlanCard |
| ADMIN-01 | Superadmin voit membres (actifs/inactifs, état abo/paiement) | §UI AdminMembers, RLS `is_superadmin()` (déjà posée), §Architecture |
| ADMIN-02 | Superadmin traite file paiements ambigus (activer/rejeter) | §UI AdminQueue, §payments schema (status `ambiguous`), §Architecture |
</phase_requirements>

## Summary

Cette phase encaisse de l'argent réel. Le risque dominant n'est PAS l'UI ni l'abonnement (ceux-ci réutilisent des patterns codebase solides : RLS, jobs idempotents, server actions, next-intl). Le risque dominant est **la correction de la vérification on-chain** : un seul paiement crédité à tort, un replay accepté, ou un mauvais token compté comme USDT = perte directe ou crédit frauduleux. Tout doit se faire **côté serveur (service_role)** — le client n'écrit jamais qu'une ligne `payments(pending)`, jamais l'état `verified`/`active`.

La vérification doit valider **cinq invariants conjoints** sur la transaction (le ET logique de tous est requis) : (1) le `Transfer` provient du **contrat USDT officiel** lu en `.env` (jamais saisi par l'user), (2) le **destinataire** = adresse de réception, comparée après normalisation hex↔base58, (3) le **montant atomique** = montant attendu (BigInt ×10⁶, comparaison exacte, zéro float), (4) la TX est **confirmée** (`only_confirmed:true` + seuil de confirmations anti-réorg), (5) le `tx_hash` n'a **jamais** servi (`UNIQUE(tx_hash)` GLOBAL en DB = filet ultime contre le replay, même en course concurrente). Sur/sous-paiement → file superadmin (jamais d'auto-décision risquée).

La normalisation d'adresse TRON (base58 `T...` ↔ hex `41...`) **n'a pas besoin de tronweb** : c'est un base58check déterministe (préfixe `0x41` + double-SHA256 4 octets de checksum). Une implémentation maison ~40 lignes, testée golden-values, est plus sûre et plus légère qu'une dépendance lourde — cohérent avec la stratégie codebase « clients data-sources fetch+Zod maison » et avec l'avertissement CLAUDE.md sur `technicalindicators`/structure de marché codée maison. **Mais** la fonction de hash crypto (sha256) doit venir du `crypto` natif Node (déjà utilisé dans `marketaux/client.ts`), jamais réimplémentée.

**Primary recommendation :** Client TronGrid fetch+Zod maison dans `packages/data-sources/src/trongrid/` (miroir exact de `fred`/`marketaux`), montant en `bigint` partout (jamais `number`), normalisation d'adresse base58check maison testée golden-values, vérification dans une **server action `apps/web`** (PAS un job — c'est synchrone et lié à l'user) utilisant un **client service_role créé localement dans la server action** (jamais importé du barrel), transition `payments→verified` + `subscriptions→active` faite via une **fonction Postgres atomique (RPC security definer)** pour éviter la course, `UNIQUE(tx_hash)` global comme garde-fou DB inviolable, job `subscription-expiry` calqué sur `calendar-ingest`/`runJob`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Affichage adresse/QR/montant | Frontend Server (RSC) | Browser (QR svg offline, copy) | Lecture statique ; QR généré client offline (zéro fuite réseau, UI-SPEC) |
| Soumission hash (insert pending) | Browser → API (server action) | Database (RLS insert pending) | User n'écrit que pending ; format validé client+serveur (Zod) |
| Lecture on-chain TronGrid | API / Backend (server action) | — | Clé TronGrid + contrat `.env` côté serveur uniquement ; jamais le client |
| Décision de vérification (5 invariants) | API / Backend (server action, service_role) | Database (`UNIQUE(tx_hash)`) | Logique financière 100% serveur ; DB = filet replay |
| Transition payments→verified + subscription→active | Database (RPC atomique service_role) | API | Atomicité requise (PAY-03) ; bypass RLS par service_role |
| Génération/réservation offset montant unique | API / Backend (server action) | Database (contrainte unicité offset actif) | Collision space borné en DB, réservé serveur |
| Expiration auto | Job (`subscription-expiry`, service_role) | Database | Idempotent, hors requête user, Windows Task Scheduler |
| Gating accès signaux post-expiry | Database (RLS `has_active_subscription()`) | Frontend Server (gate.ts) | Barrière déjà posée P1 ; coupe nette à `current_period_end` |
| Back-office membres + file | Frontend Server (`(admin)` RSC) | API (actions service_role) | RLS `is_superadmin()` lecture ; écritures service_role (D-13) |
| Gate légal prod | API / Backend (`isLegalReviewDone()`) | — | Consommé avant 1er encaissement réel (LEGAL-02), bloque prod pas dev |

## Standard Stack

### Core (déjà installé — réutiliser, ne rien ajouter sauf ligne ci-dessous)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 4.4.3 | Parsing réponse TronGrid + validation hash form + .env | Verrouillé. Frontière d'ingestion (cf. fred/marketaux) `[VERIFIED: package.json]` |
| `@supabase/supabase-js` | 2.108.0 | Client service_role (server action + job) | Verrouillé `[VERIFIED: package.json]` |
| `@supabase/ssr` | 0.12.0 | `getUser()` server (qui paie) | Verrouillé `[VERIFIED: package.json]` |
| `@tanstack/react-query` | 5.101.0 | Polling statut vérification (D-02) | Déjà installé apps/web `[VERIFIED: apps/web/package.json]` |
| `p-retry` | 8.0.0 | Backoff sur appel TronGrid (429/5xx) | Pattern fred/marketaux `[CITED: CLAUDE.md stack]` |
| `p-limit` | 7.3.0 | Borne concurrence TronGrid si batch | Pattern fred `[CITED: CLAUDE.md stack]` |
| `luxon` | 3.7.2 | Calcul `current_period_end` (+7j / +1 mois), J-3/J-1, expiry | Verrouillé `[CITED: CLAUDE.md stack]` |
| `pino` | 10.3.1 | Logs job → `job_runs` | Pattern runJob `[VERIFIED: apps/jobs/src/runJob.ts]` |
| `tsx` | 4.22.4 | Exécution job `subscription-expiry` | Verrouillé `[VERIFIED: package.json]` |
| `crypto` (natif Node) | — | sha256 pour base58check checksum (PAS de réimplémentation) | Déjà utilisé `marketaux/client.ts` `[VERIFIED: codebase]` |

### Supporting (NOUVEL ajout — à vetter en Wave 0)
| Library | Version | Purpose | When to Use | Provenance |
|---------|---------|---------|-------------|------------|
| QR lib `<svg>` offline | (à trancher) | Générer QR adresse côté client, zéro réseau | PaymentPanel QR (UI-SPEC §Registry) | **`[ASSUMED]`** — candidats : `qrcode` (npm, très répandu) en mode `toString`/svg, ou une micro-lib svg pure. **Exigence dure UI-SPEC :** rendu 100% offline, encode UNIQUEMENT l'adresse publique, zéro `fetch`/CDN/telemetry. À vérifier au install (slopcheck + inspection postinstall). |

### Décision tronweb : NE PAS l'installer
| Besoin | Solution retenue | Pourquoi pas tronweb |
|--------|------------------|----------------------|
| Conversion hex↔base58 | base58check maison (~40 lignes) + `crypto` natif | tronweb = dépendance lourde (~MB, transitive), surface d'attaque, pour une conversion déterministe triviale. Cohérent CLAUDE.md (« clients fetch maison », structure de marché codée maison). Testable golden-values exhaustivement. |
| Lecture TX | TronGrid REST fetch+Zod | Idem fred/oanda/marketaux. Pas de SDK. |
| Clé privée / signature | **N/A — INTERDIT** | Aucune signature côté plateforme (cold wallet, watcher lecture seule, D-01). tronweb sert surtout à signer → non pertinent et dangereux ici. |

**Installation (web) :**
```bash
# QR lib à trancher en Wave 0 après vetting offline+slopcheck
pnpm --filter web add <qr-lib-vérifiée>
```
Aucun autre paquet npm requis : TronGrid client = fetch+Zod maison (zéro dep), base58check = maison + crypto natif.

**Version verification :** non exécutable cette session (réseau bloqué). Wave 0 : `npm view <qr-lib> version` + `npm view <qr-lib> scripts.postinstall` avant install.

## Package Legitimacy Audit

> slopcheck non exécutable cette session (réseau bloqué). **Tous les nouveaux paquets sont `[ASSUMED]` → la planification DOIT gater chaque install derrière un `checkpoint:human-verify`.**

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `<qr-lib>` (ex. `qrcode`) | npm | à vérifier | à vérifier | à vérifier | non exécuté | **`[ASSUMED]` — checkpoint:human-verify requis** (offline + no telemetry + postinstall propre) |
| TronGrid client | aucun (code maison) | — | — | code repo | n/a | Aucun paquet — fetch+Zod |
| base58check | aucun (code maison) | — | — | code repo | n/a | Aucun paquet — crypto natif |

**Packages removed due to slopcheck [SLOP] verdict :** none (slopcheck non exécuté)
**Packages flagged [SUS] :** none confirmé — `<qr-lib>` reste à vetter

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
   User (browser)        │            apps/web (Next.js 15)             │
   ───────────────       │                                              │
   1. choisit offre ────►│  [locale]/(member)/abonnement  (RSC)         │
                         │    lit subscriptions (anon, RLS scopée)      │
   2. voit adresse  ◄────│    affiche adresse(.env public-ok?) + QR     │
      + montant unique   │    + montant atomique = nominal + offset     │
                         │                                              │
   3. paie HORS-APP ─────┼──►  TRON blockchain (USDT TRC-20 transfer)   │
      (wallet externe)   │                                              │
                         │                                              │
   4. soumet hash   ────►│  Server Action  verifyPayment(hash)          │
      (+screenshot opt)  │   a. getUser() (qui paie)                    │
                         │   b. INSERT payments(pending) [user-scoped]  │
   5. polling react-     │   c. service_role (créé LOCAL) →             │
      query status  ◄───►│      ┌──────────────────────────────────┐   │
                         │      │ TronGrid client (fetch+Zod)       │───┼──► api.trongrid.io
                         │      │  GET tx by hash / events          │◄──┼─── (clé .env, only_confirmed)
                         │      └──────────────────────────────────┘   │
                         │      d. 5 invariants (ET) :                  │
                         │         contrat==USDT_CONTRACT(.env)         │
                         │         to==RECEIVE_ADDR (hex↔base58 norm)   │
                         │         value==expected (BigInt ×10⁶)        │
                         │         confirmed + seuil confirmations      │
                         │         tx_hash jamais vu (DB UNIQUE)        │
                         │      e. décision :                           │
                         │         exact     → RPC activate (atomique)  │
                         │         over/under→ payments=ambiguous(file) │
                         │         invalide  → payments=rejected+raison │
                         └──────────────┬───────────────────────────────┘
                                        │ RPC security definer (service_role)
                                        ▼
                         ┌─────────────────────────────────────────────┐
                         │  Postgres (Supabase, migration 0012)         │
                         │   payments (pending→verified/rejected/ambig) │
                         │   subscriptions (pending→active, period_end) │
                         │   UNIQUE(tx_hash) GLOBAL  ◄── filet replay   │
                         │   RLS: user insert pending only; reads scoped│
                         │   has_active_subscription() (P1, inchangée)  │
                         └──────────────┬───────────────────────────────┘
                                        │
   ┌──────────────────────┐            │ service_role (bypass RLS)
   │ subscription-expiry   │────────────┘
   │ (tsx job, Task Sched) │   active→expired WHERE current_period_end<=now()
   │ → job_runs (pino)     │   idempotent (re-run = même résultat)
   └──────────────────────┘

   ┌──────────────────────┐
   │ (admin) RSC HORS      │ is_superadmin() RLS → lecture membres+file
   │ [locale], 404 sinon   │ actions → service_role (activer/rejeter/ajuster)
   └──────────────────────┘
```

### Recommended Project Structure
```
packages/data-sources/src/trongrid/
├── client.ts          # fetch+Zod : getTxByHash / getTrc20TransfersByTx, p-retry, clé .env
├── schema.ts          # Zod schemas réponse TronGrid (figés sur fixtures réelles Wave 0)
├── address.ts         # base58check hex↔base58 (maison, crypto natif) + normalizeTo
├── address.test.ts    # golden values (TR7NH... ↔ 41a614f...) + checksum invalide → throw
├── verify.ts          # les 5 invariants → VerificationResult (typed error codes)
└── verify.test.ts     # cas: exact / over / under / mauvais token / mauvais dest / non confirmé / replay

packages/supabase/src/repositories/
├── payments.ts        # insertPendingPayment(anon) + transitions (service_role) + getByHash
└── subscriptions.ts   # activate/extend/expire/changePlan (service_role) + RPC wrappers

packages/core/src/money/         # OU packages/data-sources — montant atomique réutilisable
├── atomic.ts          # toAtomic(decimalString)->bigint, formatAtomic(bigint)->string, USDT_DECIMALS=6
└── atomic.test.ts     # zéro-float prouvé (9.02 -> 9020000n), offset, comparaison exacte

apps/jobs/src/jobs/
└── subscription-expiry.ts        # calqué calendar-ingest : service_role lazy, idempotent, stats

apps/web/src/app/[locale]/(member)/abonnement/
├── page.tsx           # PlanCard (PAY-06) + PaymentPanel (adresse/QR/montant)
├── actions.ts         # 'use server' verifyPayment / submitHash / status (service_role LOCAL)
├── PaymentPanel.tsx   # client : copy 1-tap, QR offline
├── HashForm.tsx       # react-hook-form + zod resolver
├── VerificationPolling.tsx  # react-query polling (D-02)
└── components...

apps/web/src/app/(admin)/membres/      # ADMIN-01
apps/web/src/app/(admin)/file/         # ADMIN-02 (queue) + actions service_role

apps/web/src/messages/{fr,en,ar}.json  # + namespace `payment` (parité stricte) ; `admin` FR seul

supabase/migrations/0012_payments.sql  # table + RLS + UNIQUE(tx_hash) + RPC activate atomique
```

### Pattern 1 : Client TronGrid fetch+Zod (miroir fred/marketaux)
**What :** Un client maison qui lit une TX TRC-20, parse en Zod tolérant, propage `Retry-After`.
**When :** Toute lecture on-chain. Clé `TRONGRID_API_KEY` depuis env (throw si absente), header `TRON-PRO-API-KEY`.
**Example (squelette, formes de réponse à figer Wave 0) :**
```typescript
// Source: pattern packages/data-sources/src/fred/client.ts (VERIFIED codebase)
//         + endpoints TronGrid [CITED: developers.tron.network] / shapes [ASSUMED]
import { z } from 'zod'
import pRetry from 'p-retry'

const TRONGRID_MAINNET = 'https://api.trongrid.io'
const TRONGRID_NILE    = 'https://nile.trongrid.io'   // testnet (dev, D-contrainte démo d'abord)

// ⚠️ FORME ASSUMED — figer sur fixture réelle Nile avant de coder le parseur.
// Endpoint A (recommandé) : transfers TRC-20 d'un compte, filtrables par contrat.
//   GET /v1/accounts/{RECEIVE_ADDR}/transactions/trc20
//       ?only_confirmed=true&contract_address={USDT_CONTRACT}&limit=200
const Trc20TransferSchema = z.object({
  transaction_id: z.string(),
  from: z.string(),                 // base58 'T...' [ASSUMED]
  to: z.string(),                   // base58 'T...' [ASSUMED]
  value: z.string(),                // montant ATOMIQUE en string décimal → BigInt
  type: z.string().optional(),      // 'Transfer'
  block_timestamp: z.number().optional(),
  token_info: z.object({
    address: z.string(),            // contrat (base58) [ASSUMED]
    decimals: z.number(),           // 6 pour USDT — VÉRIFIER, ne pas hardcoder aveuglément
    symbol: z.string().optional(),
  }),
}).passthrough()

const Trc20Response = z.object({
  success: z.boolean().optional(),
  data: z.array(Trc20TransferSchema),
})

export async function fetchTrc20TransfersForReceiver(): Promise<unknown> {
  const apiKey = process.env['TRONGRID_API_KEY']
  if (!apiKey) throw new Error('TRONGRID_API_KEY must be set')
  const base = process.env['TRON_NETWORK'] === 'mainnet' ? TRONGRID_MAINNET : TRONGRID_NILE
  const receiver = process.env['USDT_RECEIVE_ADDRESS']!
  const contract = process.env['USDT_CONTRACT_ADDRESS']!
  return pRetry(async () => {
    const url = `${base}/v1/accounts/${receiver}/transactions/trc20`
      + `?only_confirmed=true&contract_address=${contract}&limit=200`
    const res = await fetch(url, { headers: { 'TRON-PRO-API-KEY': apiKey } })
    if (!res.ok) {
      const err = new Error(`TronGrid: HTTP ${res.status}`)
      if (res.status === 429) {
        const ra = Number(res.headers.get('retry-after') ?? 0)
        if (ra > 0) (err as any).retryAfterMs = ra * 1000
      }
      throw err
    }
    return Trc20Response.parse(await res.json())
  }, { retries: 3, onFailedAttempt: async ({ error }) => {
    const w = (error as any).retryAfterMs
    if (w) await new Promise(r => setTimeout(r, w))
  }})
}
```

**Endpoint B (alternative, par hash exact) :** `POST /wallet/gettransactioninfobyid` body `{ "value": "<txid>" }` retourne `log[]` (events bruts : `topics` keccak + `data`), `receipt.result` (`SUCCESS`), `contract_address`, `blockNumber`. Plus bas niveau : il faut décoder le log Transfer (topic0 = keccak `Transfer(address,address,uint256)`, `to` = topics[2] hex 32 octets, `value` = data hex). **Endpoint A est plus simple et déjà filtré par contrat → recommandé.** `[CITED: developers.tron.network/reference]` pour l'existence ; décodage de log = `[ASSUMED]`.

### Pattern 2 : Normalisation d'adresse base58check (maison, déterministe)
**What :** Convertir/comparer adresses TRON sans tronweb. base58 `T...` = base58check de (`0x41` ‖ 20 octets hex) avec 4 octets de checksum = premiers 4 de `sha256(sha256(payload))`.
**When :** Comparer `to` de la TX à `USDT_RECEIVE_ADDRESS`, et `token_info.address` à `USDT_CONTRACT_ADDRESS`, quel que soit le format renvoyé (hex `41...` ou base58 `T...`).
**Example :**
```typescript
// Source: algorithme base58check TRON [CITED: github EmbraceUU/tron-address-conversion]
//         + crypto natif (VERIFIED codebase marketaux). Math [ASSUMED] → golden tests Wave 0.
import { createHash } from 'crypto'
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function sha256(b: Buffer): Buffer { return createHash('sha256').update(b).digest() }

export function base58ToHex(addr: string): string {
  // décode base58 → bigint → bytes ; vérifie 4 octets checksum ; retourne 21 octets hex (41...)
  // throw si checksum invalide (anti-adresse-corrompue)
  /* ... ~25 lignes ... */
  return '' // placeholder
}
export function hexToBase58(hex: string): string { /* inverse + checksum */ return '' }

/** Compare deux adresses TRON quel que soit leur format. Normalise en hex 41... lower. */
export function sameAddress(a: string, b: string): boolean {
  const norm = (s: string) => (s.startsWith('T') ? base58ToHex(s) : s.replace(/^0x/, '')).toLowerCase()
  return norm(a) === norm(b)
}
```
**Golden values à figer (Wave 0, vérifier sur tron-converter ou node test) :**
- `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (contrat USDT mainnet) ↔ hex `41` + 20 octets. `[ASSUMED — vérifier la valeur hex exacte]`
- Adresse de réception du cold wallet (fournie hors-code, `.env`).
- Test négatif : checksum corrompu → throw (jamais comparer une adresse non vérifiée).

### Pattern 3 : Montant atomique BigInt (zéro float)
**What :** Tout montant manipulé en `bigint` atomique (×10⁶). Aucune valeur monétaire en `number` JS (perte de précision flottante au-delà de 2⁵³, et 9.02 n'est pas représentable exactement en float).
**When :** Génération du montant attendu, parsing `value` TronGrid (string→BigInt), comparaison, affichage.
**Example :**
```typescript
// Source: D-V2-03 (verrouillé roadmap) + pattern hash canonique D-44 (toFixed 6) du cœur
export const USDT_DECIMALS = 6n
const SCALE = 10n ** USDT_DECIMALS  // 1_000_000n

/** "9.02" -> 9020000n. Parse strict (regex), jamais Number(). */
export function toAtomic(decimal: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(decimal.trim())
  if (!m) throw new Error(`montant invalide: ${decimal}`)
  const whole = BigInt(m[1]) * SCALE
  const frac = BigInt((m[2] ?? '').padEnd(6, '0'))
  return whole + frac
}
/** 9020000n -> "9.020000" (Intl côté UI fera l'affichage final, <bdi>). */
export function formatAtomic(atomic: bigint): string {
  const w = atomic / SCALE, f = atomic % SCALE
  return `${w}.${f.toString().padStart(6, '0')}`
}
// Comparaison: receivedAtomic === expectedAtomic (exacte, jamais d'epsilon).
// TronGrid 'value' est DÉJÀ atomique en string → BigInt(value) directement (PAS toAtomic).
```
> ⚠️ Piège : `token_info.decimals` peut différer de 6 pour un faux token homonyme. Valider `decimals === 6` ET `contract === USDT officiel` ensemble. Ne jamais dériver le montant depuis `decimals` d'un token non vérifié.

### Pattern 4 : Transition atomique via RPC Postgres (anti-course)
**What :** `payments→verified` + `subscriptions→active`(+period_end) en UNE transaction Postgres (fonction `security definer`), appelée par le service_role. Évite l'état incohérent (paiement vérifié mais abo non activé) et sérialise contre le double-submit.
**When :** Décision « exact ». Le `UNIQUE(tx_hash)` est le filet ; la RPC est l'atomicité métier.
**Example (migration 0012, esquisse) :**
```sql
-- activate_subscription_for_payment : transition atomique, service_role only.
create function public.activate_subscription_for_payment(
  p_payment_id uuid, p_user_id uuid, p_plan text, p_period interval
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.payments set status='verified', verified_at=now()
    where id=p_payment_id and status='pending';
  if not found then raise exception 'payment not pending'; end if;
  insert into public.subscriptions(user_id, status, plan, current_period_end)
    values (p_user_id, 'active', p_plan, now() + p_period)
    on conflict ... -- ou UPDATE pour prolonger (renouvellement D-11)
  ;
end $$;
revoke execute on function public.activate_subscription_for_payment(...) from public, anon, authenticated;
-- service_role bypass : pas besoin de grant (il bypass RLS et a usage). Vérifier en Wave 0.
```

### Pattern 5 : Job idempotent (miroir calendar-ingest + runJob)
**What :** `subscription-expiry` enregistré dans `dispatch.ts`, exécuté par Windows Task Scheduler via `run-job.cmd subscription-expiry`. Idempotent : `UPDATE subscriptions SET status='expired' WHERE status='active' AND current_period_end <= now()` — re-run = 0 ligne affectée la 2e fois.
**Example :** calqué sur `apps/jobs/src/jobs/calendar-ingest.ts` (client service_role lazy, stats, `runJob` wrappe `job_runs`). Ajouter `'subscription-expiry'` au `JOB_REGISTRY` de `dispatch.ts`.

### Anti-Patterns to Avoid
- **Vérifier on-chain côté client** ou exposer la clé TronGrid au navigateur → fuite + manipulation. TOUJOURS server action / service_role.
- **Importer `serviceClient` du barrel dans apps/web** → interdit (ESLint + `server-only`). Créer le client service_role LOCALEMENT dans la server action (comme `runJob`/`calendar-ingest` le font), à partir de `process.env`, dans un module `import 'server-only'`.
- **Faire confiance à `token_info.symbol === 'USDT'`** pour identifier le token → un faux token peut se nommer USDT. Seul `contract_address === USDT officiel(.env)` fait foi.
- **Montant en `number`** → 9.02 n'est pas exact en float. `bigint` partout.
- **Décision sur/sous-paiement automatique** (rembourser/activer prorata) → file superadmin (D-06/D-07).
- **Transition `verified`/`active` sans RPC atomique** → fenêtre d'incohérence + double-activation possible.
- **Comparer adresses brutes sans normaliser hex↔base58** → faux négatif (rejette un vrai paiement) ou faux positif.
- **Confirmer sans `only_confirmed:true`** → vulnérable au réorg (TX annulée après crédit).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| sha256 (checksum base58) | Implémentation maison | `crypto` natif Node (`createHash('sha256')`) | Déjà utilisé marketaux ; jamais réimplémenter de la crypto |
| Backoff/retry 429 | Boucle maison | `p-retry` (+ `Retry-After`) | Pattern fred/marketaux verrouillé |
| Calcul de périodes/DST | Maths de dates maison | `luxon` (`DateTime.plus({days:7})`/`{months:1}`) | Verrouillé ; DST géré |
| Idempotence d'exécution job | Flag maison | `WHERE status='active' AND period_end<=now()` (naturellement idempotent) + `job_runs` | Pattern cœur |
| Validation hash/format | Regex éparpillées | Zod (form + frontière TronGrid) | Frontière unique |
| Filet anti-replay | Vérif applicative seule | `UNIQUE(tx_hash)` contrainte DB | Inviolable même en course concurrente (le check applicatif seul a une TOCTOU) |

**Key insight :** Le seul code « maison » légitime ici est (1) le client TronGrid fetch+Zod (cohérent codebase, pas de SDK fiable typé), et (2) la conversion base58check (déterministe, ~40 lignes, golden-tested, évite tronweb). TOUT le reste réutilise des primitives existantes. La crypto (sha256) n'est PAS hand-rolled.

## Runtime State Inventory

> Phase à composante « état runtime » réelle (cold wallet, Task Scheduler, secrets, types générés). Non-greenfield sur ces points.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Table `subscriptions` réelle (0009) déjà en prod via MCP — P4 y ÉCRIT (transitions). Nouvelle table `payments` (0012). | migration 0012 + RPC ; ne PAS réécrire `has_active_subscription()`/RLS subscriptions |
| Live service config | **Cold wallet TRON opérationnel + watcher lecture seule** (prérequis hors-code listé STATE.md). Adresse de réception réelle. Compte TronGrid (clé API, tier gratuit). Réseau testnet Nile/Shasta pour dev. | Provisionner hors-code (fondateur) ; valeurs en `.env` ; **bloque le test réel, pas le code** |
| OS-registered state | Nouvelle tâche Windows Task Scheduler `subscription-expiry` (description peut contenir le nom). `run-job.cmd` déjà générique. | Enregistrer la tâche (manuel/ops) appelant `run-job.cmd subscription-expiry` |
| Secrets/env vars | NOUVELLES : `USDT_RECEIVE_ADDRESS`, `USDT_CONTRACT_ADDRESS` (=`TR7NH...` mainnet ; contrat différent sur Nile), `TRONGRID_API_KEY`, `TRON_NETWORK` (nile\|mainnet). EXISTANTE consommée : `LEGAL_REVIEW_DONE` (=false par défaut). **JAMAIS de clé privée.** | Étendre `.env.example` (sans valeurs) ; côté jobs ET web (server action lit TronGrid) |
| Build artifacts | `packages/supabase/src/database.types.ts` devient stale après 0012 (nouvelle table `payments` + colonnes). | Régénérer `supabase gen types` OU éditer manuellement (le repo n'est pas `link`é localement, cf. D-01-01-D/D-03-01-C — types committés à la main pour les nouvelles tables) ; ré-exporter dans le barrel |

**Contrat USDT sur testnet ≠ mainnet :** `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` est le contrat **mainnet**. Sur Nile/Shasta le contrat USDT (ou un token de test) a une **autre adresse** → `USDT_CONTRACT_ADDRESS` doit être configurable par réseau, pas hardcodé. `[ASSUMED — confirmer l'adresse du token de test Nile en Wave 0]`.

## Common Pitfalls

### Pitfall 1 : Faux token homonyme accepté comme USDT
**What goes wrong :** Un attaquant déploie un token nommé « USDT » avec 6 decimals et envoie le montant exact ; le système l'accepte.
**Why :** Identification par symbole/decimals au lieu du contrat.
**How to avoid :** `sameAddress(token_info.address, USDT_CONTRACT_ADDRESS_from_env)` obligatoire dans le ET des 5 invariants. Le contrat n'est JAMAIS saisi par l'user (.env).
**Warning signs :** Code qui lit `symbol` ou `decimals` pour décider.

### Pitfall 2 : Replay accepté en course concurrente (TOCTOU)
**What goes wrong :** Même hash soumis 2× quasi-simultanément ; les deux passent le check applicatif « hash déjà vu ? » avant insertion.
**Why :** Vérification applicative non atomique.
**How to avoid :** `UNIQUE(tx_hash)` GLOBAL en DB ; capter l'erreur `23505` (unique violation) = replay → message D-04 « hash déjà utilisé ». La contrainte DB est le seul garde-fou inviolable.
**Warning signs :** Pas de contrainte unique, ou catch générique de l'erreur insert.

### Pitfall 3 : Réorg blockchain → crédit sur TX annulée
**What goes wrong :** TX vue/comptée puis annulée par réorganisation de chaîne ; abonnement activé sans paiement réel.
**Why :** Crédit sur une TX non (assez) confirmée.
**How to avoid :** `only_confirmed=true` ET attendre un seuil de confirmations raisonnable. Sur TRON les blocs sont ~3 s ; les transactions sont « finalisées » après ~19 confirmations (SR round). `[ASSUMED — confirmer le seuil/finalité TRON en Wave 0]`. Polling D-02 (~1 min) couvre largement plusieurs blocs.
**Warning signs :** `only_confirmed` absent/false, ou activation immédiate sur 1ère vue.

### Pitfall 4 : Précision flottante sur le montant
**What goes wrong :** `9.02 * 1e6 = 9019999.999...` ou comparaison float → sous-paiement faussement détecté ou montant unique mal matché.
**Why :** `number` JS.
**How to avoid :** `bigint` de bout en bout ; `value` TronGrid (déjà atomique) → `BigInt(value)` direct ; comparaison `===` exacte.
**Warning signs :** `parseFloat`, `Number(value)`, `* 1e6`, `toFixed` dans la logique de décision (toFixed OK pour l'affichage seulement, via Intl/`<bdi>`).

### Pitfall 5 : Collision d'offset de montant unique (D-05)
**What goes wrong :** Deux factures actives portent le même offset (9.02) → impossible de distinguer les payeurs.
**Why :** Espace de centimes borné (00–99 = 100 valeurs par montant nominal) sans réservation.
**How to avoid :** Réserver l'offset en DB (ex. contrainte d'unicité sur `(expected_amount_atomic)` parmi les paiements `pending` non expirés), avec une **fenêtre de validité** (ex. 30–60 min) après laquelle l'offset est libéré (paiement abandonné). Si l'espace sature, repli : élargir aux millièmes ou file. **Flag planning explicite (D-05) :** durée de réservation + comportement de saturation à trancher au plan.
**Warning signs :** Offset aléatoire sans contrainte d'unicité ; pas d'expiration de la réservation.

### Pitfall 6 : service_role importé côté client
**What goes wrong :** `import { serviceClient }` dans un composant web → clé service_role dans le bundle.
**Why :** Réutilisation naïve.
**How to avoid :** Créer le client service_role LOCALEMENT dans la server action (`createClient(process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`), dans un module `'use server'` / `import 'server-only'`. Le barrel n'exporte pas service-client (D-07). ESLint `no-restricted-imports` + `server-only` gardent.
**Warning signs :** Import depuis `@app/supabase/service-client` hors `apps/jobs`.

### Pitfall 7 : Gate légal contourné en prod
**What goes wrong :** 1er encaissement réel avant sign-off juriste.
**Why :** `isLegalReviewDone()` non appelé sur le chemin d'encaissement prod.
**How to avoid :** La server action de vérification consomme `isLegalReviewDone()` (déjà livré P2, `lib/legal-gate.ts`) AVANT toute activation en prod. En dev/test (testnet) le flux tourne ; la garde bloque l'activation réelle si `LEGAL_REVIEW_DONE!=='true'`. Définir précisément « prod » (env) vs « test » au plan.
**Warning signs :** Aucun appel à `isLegalReviewDone` dans le chemin paiement.

## Code Examples

### Server action : créer le client service_role localement (jamais le barrel)
```typescript
// Source: pattern runJob.ts / calendar-ingest.ts (VERIFIED codebase) adapté server action
'use server'
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@app/supabase'

function serviceClientLocal() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) throw new Error('service_role env manquant')
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```
> Note : la server action lit aussi `getUser()` via le client anon SSR (`lib/supabase/server.ts`) pour identifier le payeur, PUIS bascule sur le client service_role pour la lecture TronGrid + la RPC atomique.

### RLS payments (migration 0012, esquisse — miroir 0006/0009)
```sql
-- Source: pattern 0006 (écriture service_role) + 0009 (lecture scopée) [VERIFIED codebase]
create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  tx_hash               text not null,
  plan                  text not null check (plan in ('discovery','standard')),
  expected_amount_atomic bigint not null,        -- nominal + offset (×10⁶)
  amount_atomic         bigint,                  -- reçu on-chain (null tant que pending)
  status                text not null default 'pending'
                        check (status in ('pending','verified','rejected','ambiguous')),
  reject_reason         text,                    -- typed error code (D-04)
  screenshot_url        text,                    -- D-03 optionnel
  created_at            timestamptz not null default now(),
  verified_at           timestamptz
);
alter table public.payments enable row level security;

-- UNIQUE GLOBAL anti-replay (PAY-04) : le même hash ne crédite jamais 2 comptes.
create unique index payments_tx_hash_global_idx on public.payments (tx_hash);

-- Réservation d'offset (D-05) : un seul montant attendu actif (pending non expiré).
-- (forme à affiner : index partiel + colonne reservation_expires_at)
-- create unique index payments_expected_amount_pending_idx
--   on public.payments (expected_amount_atomic) where status='pending';

-- User INSERT pending uniquement, pour lui-même, status forcé pending.
create policy "payments: user insère pending"
  on public.payments for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- User lit les siens ; superadmin lit tout (ADMIN-01/02).
create policy "payments: lire les siens" on public.payments
  for select to authenticated using (user_id = auth.uid());
create policy "payments: superadmin voit tout" on public.payments
  for select to authenticated using (public.is_superadmin());

-- AUCUNE policy update/delete pour authenticated → transitions service_role only (D-08).
```
> ⚠️ Subtilité : la policy INSERT autorise l'user à fournir `expected_amount_atomic`. Le serveur (server action) doit **recalculer/valider** le montant attendu côté serveur avant la vérif on-chain — ne jamais faire confiance au montant inséré par le client. Idéalement, l'insert pending se fait via la server action (service_role) qui pose le montant réservé, et la policy user INSERT sert de défense en profondeur.

## Verification Decision Tree (PAY-02/03/04)

```
soumission hash
 ├─ format hash invalide ......................→ erreur form (Zod), pas de pending
 ├─ INSERT pending → 23505 (UNIQUE tx_hash) ...→ rejected:"replay" (D-04, jamais 2e crédit)
 └─ lecture TronGrid (only_confirmed) :
     ├─ TX introuvable / non confirmée .........→ pending/retry → si timeout: rejected:"not_confirmed"
     ├─ contrat ≠ USDT(.env) ...................→ rejected:"wrong_token"
     ├─ to ≠ RECEIVE_ADDR (normalisé) ..........→ rejected:"wrong_recipient"
     ├─ value === expected (atomic) ............→ RPC activate (atomique) → verified+active (PAY-03)
     ├─ value <  expected ......................→ ambiguous → file superadmin (D-06)
     └─ value >  expected ......................→ activer période normale + ambiguous note (D-07)
```
> Tous les `rejected:*` sont des **typed error codes** mappés en messages i18n localisés (UI-SPEC §Copywriting). Chaque tentative est tracée (D-04).

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| `@oanda/v20`-style SDK généré | client REST fetch+Zod maison | stack v2.0 | Cohérence : TronGrid suit fred/marketaux, pas de SDK |
| tronweb pour tout | base58check maison + crypto natif (conversion seule) | ce projet | Léger, testable, pas de signature côté plateforme |
| float * 1e6 | `bigint` atomique | D-V2-03 | Zéro perte de précision |

**Deprecated/outdated :** `@supabase/auth-helpers` (utiliser `@supabase/ssr`, déjà en place). Ne pas utiliser TronWeb pour signer (aucune signature côté plateforme).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Forme réponse TronGrid `/v1/accounts/{addr}/transactions/trc20` (champs `from/to/value/token_info.address/decimals`, base58) | §Pattern 1 | HAUT — parseur Zod faux → vérif cassée. **Figer sur fixture réelle Nile (Wave 0).** |
| A2 | `only_confirmed=true` + filtre `contract_address` supportés sur cet endpoint | §Pattern 1 | HAUT — sinon filtrer côté code, risque réorg |
| A3 | Header clé = `TRON-PRO-API-KEY` | §Pattern 1 | MOYEN — 429 systématiques sinon |
| A4 | base58check TRON = `0x41`+payload+sha256² checksum 4 octets ; hex de `TR7NH...` | §Pattern 2 | HAUT — comparaison d'adresse fausse. **Golden test Wave 0.** |
| A5 | USDT TRC-20 = 6 decimals | §Pattern 3 | HAUT — montant ×1000 faux. Valider `token_info.decimals===6`. |
| A6 | Adresse contrat USDT sur Nile testnet ≠ mainnet (à fournir) | §Runtime State | MOYEN — test sur mauvais contrat |
| A7 | Seuil de confirmations / finalité TRON (~19 conf / SR round) | §Pitfall 3 | MOYEN — fenêtre réorg |
| A8 | service_role bypass RLS sans grant explicite sur la RPC `security definer` | §Pattern 4 | MOYEN — activation échoue ; tester en Wave 0 |
| A9 | QR lib offline candidate (`qrcode` ou équivalent) propre (no telemetry) | §Stack | MOYEN — fuite/dep douteuse. slopcheck + checkpoint. |
| A10 | Rate limit TronGrid tier gratuit (≈ qq req/s, quota journalier) | §Stack | BAS — p-retry/p-limit couvrent |

> **La majorité des assumptions HAUT-risque concernent les formes/valeurs on-chain non vérifiables réseau-bloqué cette session.** Elles convergent vers UNE tâche Wave 0 : frapper TronGrid Nile sur une vraie TX USDT-test et figer fixtures + golden values avant d'écrire parseur et conversion.

## Open Questions

1. **Durée de réservation de l'offset + saturation (D-05, flag explicite CONTEXT)**
   - Connu : centimes uniques (00–99) par montant nominal, matching déterministe.
   - Flou : durée de validité, libération si abandon, comportement à saturation (>100 paiements pending même nominal).
   - Reco : réservation 30–60 min via colonne `reservation_expires_at` + index unique partiel sur pending non expiré ; saturation → élargir aux millièmes ou file. À trancher au plan/discuss.

2. **Polling : intervalle / timeout / repli différé (D-02)**
   - Connu : react-query, ~1 min cible, UI steppée, repli « continuer en arrière-plan ».
   - Flou : intervalle (3–5 s ?), timeout (90–120 s ?), où vit le « repli différé » (le job d'expiry ne couvre pas ça ; faut-il un job `payment-poll` ou seulement re-soumission user ?).
   - Reco : `refetchInterval: 4000`, `staleTime:0`, stop sur `verified`/`rejected`/`ambiguous` ou après ~120 s → message timeout (jamais erreur dure). Repli = l'user re-soumet plus tard (le pending reste lisible) ; PAS de watcher auto (hors scope PAY-AUTO).

3. **Insert pending : par l'user (RLS) ou par la server action (service_role) ?**
   - Reco : insert pending via la server action service_role (pose le montant réservé authentique), policy user-INSERT = défense en profondeur. Évite que le client choisisse `expected_amount_atomic`.

4. **Définition exacte de « prod » pour le gate légal (LEGAL-02)**
   - Reco : `TRON_NETWORK==='mainnet'` ⇒ exiger `isLegalReviewDone()`. Testnet ⇒ libre. À confirmer.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| TronGrid API (Nile testnet) | Vérif on-chain dev | ✗ (non testé, réseau bloqué) | — | Fixtures figées en Wave 0 ; tests unitaires sur fixtures |
| Cold wallet + watcher lecture seule | Encaissement réel | ✗ (prérequis ops hors-code) | — | Dev/test sur testnet sans fonds réels |
| Compte/clé TronGrid | Lecture on-chain | ✗ (à provisionner) | — | Tier gratuit suffit pour MVP |
| Windows Task Scheduler | job subscription-expiry | ✓ (déjà utilisé v1.0) | — | croner in-process (déjà au stack) |
| Supabase MCP `apply_migration` | migration 0012 | ✓ (convention repo) | — | — |
| `supabase gen types` | régénérer types | partiel (projet non `link`é) | — | édition manuelle de database.types.ts (précédent D-03-01-C) |
| QR lib offline | PaymentPanel | ✗ (à installer+vetter) | — | rendu SVG minimal maison si lib douteuse |

**Missing dependencies (bloquent le test réel, PAS le code) :** cold wallet, clé TronGrid, accès réseau testnet. Le code + tests sur fixtures avancent sans eux ; l'encaissement réel attend ops + LEGAL-02.

## Validation Architecture

> nyquist_validation = true (config.json) → section requise. Argent = correction prouvée obligatoire.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 `[VERIFIED: package.json]` |
| Config file | `vitest.config.ts` (racine) — globs `packages/**/*.test.ts`, `apps/**/__tests__/**`, `apps/web/test/**` |
| Quick run command | `pnpm test` (ou `npx vitest run <path>`) |
| Full suite command | `pnpm test` puis `pnpm test:e2e` (Playwright RLS cross-user) |
| E2E | Playwright 1.60.0 (auth, parcours paiement testnet, RLS isolation) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-02 | montant atomique zéro-float (9.02→9020000n) | unit | `npx vitest run packages/core/src/money/atomic.test.ts` | ❌ Wave 0 |
| PAY-02 | base58↔hex golden values + checksum invalide throw | unit | `npx vitest run packages/data-sources/src/trongrid/address.test.ts` | ❌ Wave 0 |
| PAY-02 | parseur TronGrid sur fixtures réelles (Zod) | unit | `npx vitest run packages/data-sources/src/trongrid/schema.test.ts` | ❌ Wave 0 |
| PAY-02/04 | 5 invariants : exact/over/under/wrong token/wrong dest/non confirmé | unit | `npx vitest run packages/data-sources/src/trongrid/verify.test.ts` | ❌ Wave 0 |
| PAY-04 | replay rejeté par UNIQUE(tx_hash) (23505) | integration | RLS test anon-client (insert même hash 2×) | ❌ Wave 0 |
| PAY-03 | RPC activate atomique (pending→verified + active) | integration | test service_role contre DB | ❌ Wave 0 |
| PAY-04 | user ne peut écrire que pending (pas verified/active) | integration | anon-client tente update status → refus RLS | ❌ Wave 0 |
| PAY-04 | over/under → ambiguous (file) ; exact → active | unit | verify.test.ts (decision tree) | ❌ Wave 0 |
| PAY-05 | subscription-expiry idempotent (re-run = 0 ligne 2e fois) | integration | `apps/jobs/__tests__/subscription-expiry.test.ts` | ❌ Wave 0 |
| PAY-05 | coupe nette : non-abonné expiré → 0 signal (RLS) | integration | étendre `gating-rls.test.ts` (P1 existant) | ✅ base existe |
| PAY-06 | discovery one-shot : 2e discovery refusé, standard seul visible | unit+integration | enforcement `plan='discovery'` consommé | ❌ Wave 0 |
| ADMIN-01/02 | superadmin lit membres+file ; non-superadmin 404 | e2e | Playwright `(admin)` cross-role | ❌ Wave 0 |

### Sampling Rate
- **Per task commit :** `npx vitest run <fichier concerné>` (atomic / address / verify — < 5 s).
- **Per wave merge :** `pnpm test` (suite complète unit+integration).
- **Phase gate :** `pnpm test` + `pnpm test:e2e` verts + parité i18n (`lint:i18n` exit 0) avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/src/money/atomic.ts` + `.test.ts` — PAY-02 (zéro-float, golden)
- [ ] `packages/data-sources/src/trongrid/address.ts` + `.test.ts` — golden hex↔base58 + checksum
- [ ] **Fixtures TronGrid réelles** (Nile testnet) figées dans `__fixtures__/` — **checkpoint:human-verify (réseau requis)** débloque schema/verify
- [ ] `packages/data-sources/src/trongrid/schema.ts`/`verify.ts` + tests
- [ ] migration `0012_payments.sql` (table + RLS + UNIQUE + RPC) appliquée via MCP
- [ ] `database.types.ts` régénéré/édité + barrel ré-exporte `payments`/repos
- [ ] `apps/web/src/messages/payment` namespace fr/en/ar parité stricte (CI `check-i18n-hardcoded`)
- [ ] QR lib vettée (slopcheck + offline + postinstall) — checkpoint:human-verify

## Security Domain

> security_enforcement absent de config.json ⇒ activé. Phase = argent réel, surface critique.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getUser()` SSR (jamais `getSession`) — pattern P1 |
| V3 Session Management | yes | cookies @supabase/ssr (middleware existant) |
| V4 Access Control | yes | RLS (`has_active_subscription`, `is_superadmin`) + `(admin)` 404 ; user INSERT pending only ; transitions service_role |
| V5 Input Validation | yes | Zod (hash form + frontière TronGrid + .env) ; montant `bigint` parse strict |
| V6 Cryptography | yes | `crypto` natif (sha256 base58check) — jamais hand-rolled ; clé privée HORS système (D-01) |
| V7 Errors/Logging | yes | typed error codes → i18n opaque (pas de fuite) ; pino → job_runs ; jamais logger clé API |
| V9 Communications | yes | TronGrid HTTPS ; clé en header serveur, jamais bundle client |

### Known Threat Patterns for {TRON/TRC-20 payment + Supabase RLS}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Replay du même hash (double crédit) | Tampering/Elevation | `UNIQUE(tx_hash)` GLOBAL (DB) + catch 23505 |
| Faux token homonyme « USDT » | Spoofing | `contract === USDT(.env)` obligatoire (jamais symbol/decimals seuls) |
| Réorg → crédit sur TX annulée | Tampering | `only_confirmed=true` + seuil confirmations |
| Sur-écriture du montant attendu par le client | Tampering | montant recalculé serveur ; insert pending via service_role |
| Élévation : user transitionne sa sub en active | Elevation | aucune policy update/delete authenticated ; service_role + RPC only |
| Fuite clé TronGrid / service_role au client | Info Disclosure | `server-only` + ESLint no-restricted-imports + clé en header serveur |
| Encaissement réel avant sign-off juriste | Compliance | `isLegalReviewDone()` consommé sur chemin mainnet |
| Clé privée wallet dans code/DB | Info Disclosure/Catastrophe | INTERDIT (D-01) — watcher lecture seule, cold wallet, zéro signature plateforme |
| Open-redirect / XSS via error param | Tampering | typed error codes opaques (pattern `toSafeErrorKey` existant) |
| Screenshot upload (si stocké) | Multiple | validation type/taille ; jamais dans vérif auto (D-03) ; bucket scopé si Supabase Storage |

## Project Constraints (from CLAUDE.md)

- Stack **verrouillée** : Next.js 15 (PAS 16), Supabase, TS strict, Zod v4, react-query, monorepo pnpm, tsx jobs, luxon, pino, p-retry/p-limit. Ne pas dévier.
- Clients data-sources = **fetch+Zod maison** (pas de SDK) → TronGrid suit ce modèle.
- **Pas d'ORM** : migrations SQL versionnées = source de vérité unique. Migration **0012** via MCP `apply_migration` (PAS `supabase db push`).
- **service_role réservé aux jobs/serveur** ; jamais importé du barrel côté web (`server-only` + ESLint).
- **Déterminisme financier** : BigInt atomique ×10⁶, zéro float (D-V2-03).
- **i18n** : tout texte via next-intl, parité stricte fr/en/ar (CI anti-chaîne-dure) ; montants/dates `<bdi>`/`Intl`.
- **Sécurité** : secrets en `.env` non commités ; clé privée JAMAIS ; testnet d'abord ; RLS stricte ; `getUser()` jamais `getSession`.
- **Légal** : LEGAL-02 gate non-code bloque la prod (pas le dev).
- **GSD enforcement** : passer par une commande GSD avant tout edit.
- **Robustesse routines** : jobs idempotents + `job_runs` + Windows Task Scheduler backup.

## Sources

### Primary (HIGH confidence)
- Codebase (`packages/data-sources/src/{fred,marketaux}/client.ts`, `apps/jobs/src/{runJob,dispatch,jobs/calendar-ingest}.ts`, `packages/supabase/src/repositories/*`, `supabase/migrations/{0006,0008,0009}`, `apps/web/src/lib/{auth/gate,legal-gate,supabase/server}.ts`, `apps/web/src/app/(admin)/layout.tsx`) — patterns à mirorer, VERIFIED.
- `04-CONTEXT.md` D-01..D-15 + Claude's Discretion ; `04-UI-SPEC.md` (money-law D-V2-03, surfaces) ; `REQUIREMENTS.md` PAY/ADMIN ; `STATE.md` D-V2-03 + research flag Phase 4 ; `ROADMAP.md` §Phase 4. HIGH (source projet).
- `package.json` / `apps/web/package.json` / `.planning/config.json` — versions + nyquist VERIFIED.

### Secondary (MEDIUM confidence)
- WebSearch docs TronGrid : `developers.tron.network/docs/get-trc20-transaction-history`, `/reference/get-trc20-transaction-info-by-account-address`, `/docs/trc20-contract-interaction` — endpoints `/v1/accounts/{address}/transactions/trc20`, param `only_confirmed`, `contract_address`, `limit` [CITED].
- WebSearch base58 TRON : `github.com/EmbraceUU/tron-address-conversion`, gist Aziz87 — algorithme base58check, hex préfixe `41` [CITED, algo à golden-tester].

### Tertiary (LOW confidence / ASSUMED — réseau bloqué cette session)
- Formes exactes de réponse JSON TronGrid (noms de champs, casing, base58 vs hex retourné), header de clé exact, seuil de confirmations TRON, adresse contrat USDT testnet Nile, valeur hex de `TR7NH...` — **training knowledge non vérifiée en direct → Wave 0 checkpoint:human-verify obligatoire.**

## Metadata

**Confidence breakdown :**
- Standard stack & patterns codebase : HIGH — lus directement, mirroring de clients/jobs/RLS existants.
- Architecture (server action + RPC atomique + RLS + UNIQUE) : HIGH — dérive de primitives prouvées P1-P3.
- Montant atomique / base58check (algo) : MEDIUM — algo documenté, valeurs exactes à golden-tester.
- Formes de réponse TronGrid / valeurs on-chain : LOW (ASSUMED) — réseau bloqué, à figer sur fixtures réelles testnet.
- Sécurité / pitfalls : HIGH — invariants dérivés de la roadmap verrouillée + STRIDE.

**Research date :** 2026-06-15
**Valid until :** 2026-07-15 (stack stable). **Caveat :** les hypothèses TronGrid (A1-A7) doivent être confirmées en Wave 0 avant tout code de vérification — elles ne « périment » pas, elles sont non vérifiées dès maintenant.
