# Phase 7 : Affiliation à paliers — Research

**Researched:** 2026-06-18
**Domain:** Programme d'affiliation idempotent (capture `?ref`, calcul de commission mensuel BigInt, dashboard no-PII, payout manuel tracé) sur socle Next.js 15 + Supabase RLS
**Confidence:** HIGH (tous les patterns réutilisés sont lus dans le code réel du dépôt ; zéro paquet npm nouveau)

## Summary

Phase 7 n'introduit **aucune technologie nouvelle**. Tout est une recombinaison de patterns déjà livrés et golden-testés dans P1–P6 : RLS producteur-unique (0009/0012), RPC atomique `security definer` + `UNIQUE` index anti-doublon (0012), file de revue superadmin via `service_role` local (`(admin)/file`), job idempotent `runJob`/`job_runs`/dispatch (`outcome-tracker`, `subscription-expiry`), client `service_role` local côté web (`admin-service.ts`), BigInt atomique ×10⁶ string (convention `database.types.ts`), middleware composé i18n→session.

Les **3 zones réellement neuves** sont : (1) la **capture du cookie `?ref` dans le middleware** existant et son **attribution à l'inscription** — résolue par un **wrapper server-action autour de `signUp`** qui lit le cookie et écrit le `referral` via `service_role` (le trigger DB `handle_new_user` NE PEUT PAS voir le cookie, c'est le point dur) ; (2) la **migration 0016** (5 tables : `affiliate_applications`, `affiliate_codes`, `referrals`, `commissions`, `payouts`) avec `UNIQUE(affiliate_id, referral_id, period)` ; (3) le **job mensuel de commission** qui agrège `payments.amount_atomic` des filleuls ACTIFS, applique la grille D-01 selon le **compteur d'inscrits** (D-02), exclut l'auto-parrainage (D-12), et upsert idempotent.

**Primary recommendation:** Modéliser strictement deux compteurs distincts (D-05 flag) — `referrals` attribués = audience (détermine le TAUX via la grille), `payments.amount_atomic` des filleuls actifs sur le mois = base (détermine le MONTANT). Calculer le taux à l'intérieur d'un RPC `security definer` mono-transaction (miroir `activate_subscription_for_payment`) pour que l'idempotence `UNIQUE(affiliate_id, referral_id, period)` et le `GREATEST`/upsert vivent côté DB, pas côté JS.

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **D-01 :** Taux progressif à 8 paliers, plafond 20 % (grille validée fondateur) :

  | Palier | Inscrits via le code | Taux |
  |--------|----------------------|------|
  | 1 | 1 – 99 | 8 % |
  | 2 | 100 – 500 | 12 % |
  | 3 | 501 – 1 000 | 14 % |
  | 4 | 1 001 – 5 000 | 15 % |
  | 5 | 5 001 – 10 000 | 16 % |
  | 6 | 10 001 – 25 000 | 17 % |
  | 7 | 25 001 – 50 000 | 18 % |
  | 8 | 50 000 + | 20 % |

- **D-02 :** Le palier (taux %) est déterminé par le **NOMBRE D'INSCRITS via le code** (referrals attribués au signup), PAS par les abonnés actifs.
- **D-03 :** Base du montant = `payments.amount_atomic` (BigInt atomique ×10⁶, zéro float) des filleuls ACTIFS uniquement. Commission = `taux × Σ amount_atomic des paiements vérifiés du filleul sur la période`.
- **D-04 :** Découverte (3 $/7 j) ET standard (9 $/mois) commissionnent toutes deux.
- **D-05 :** Période = mois calendaire (`period = 'YYYY-MM'`). `UNIQUE(affiliate_id, referral_id, period)` → 1 commission par filleul par mois, idempotente (re-run = même total). ⚠️ **Flag planning** : un `referral` = un profil attribué à l'affilié au moment du signup (capture du cookie ref). Le palier compte ces inscrits ; le montant ne paie que les actifs/payants. Deux compteurs distincts et déterministes.
- **D-06 :** Code = vanity choisi par l'affilié, unique, format borné (A-Z0-9, longueur à fixer — discrétion).
- **D-07 :** Posé par le superadmin (promotion `profiles.role = 'affiliate'` + enregistrement du code via back-office `(admin)`). Pas de self-serve.
- **D-08 :** Onboarding = candidature. Formulaire (réseaux sociaux, Telegram, Facebook, nb abonnés, interactions) → file de revue back-office → vérification manuelle → approbation → rôle + code.
- **D-09 :** Capture middleware ordre **locale → ref → session**. Cookie `ref` persistant 30 jours.
- **D-10 :** Last-touch — le dernier `?ref=` écrase le précédent.
- **D-11 :** Attribution figée à l'inscription — le `ref` dans le cookie au signup attache le profil créé à l'affilié.
- **D-12 :** Auto-parrainage exclu AU CALCUL — le job EXCLUT `referral.user_id = affiliate.user_id`. Inviolable côté calcul.
- **D-13 :** Filleuls affichés en AGRÉGATS SEULS (compteurs) — aucune ligne par filleul.
- **D-14 :** Métriques = set complet : abonnés actifs ramenés · total inscrits via le code · revenus générés (cumul + mois courant) · commissions dues/payées · taux/palier actuel.
- **D-15 :** Payout = tx_hash + date + montant. État `due → payée` reflété dans le dashboard.

### Claude's Discretion

- **Schéma exact des tables** (migration 0016 — plus haute existante = 0015 ; ⚠️ 0013 absente, NE PAS réutiliser).
- **RLS isolation affilié** : « lis les tiens » + « superadmin voit tout », miroir `payments`/`subscriptions` (0009/0012). Écritures réservées `service_role`/RPC. Prouver l'isolation.
- **Job de calcul** idempotent (pattern `job_runs` + Windows Task Scheduler, mensuel), agrégation BigInt ×10⁶, grille D-01 selon compteur d'inscrits.
- **Définition opérationnelle d'« inscrit »** (compteur referrals attribués, distinct des abonnés actifs).
- **Format/longueur/normalisation du code vanity** (casse, charset, collision).
- **Capture cookie `ref`** dans le middleware existant, sans casser locale → ref → session.
- **Requêtes d'agrégation no-PII** du dashboard.
- **Découpage UI** : candidature, portail/dashboard, file de revue, vue payout ; namespace i18n `affiliate`.

### Deferred Ideas (OUT OF SCOPE)

- Moteur d'éligibilité auto-évalué (vérif auto des seuils) — MVP = validation manuelle.
- Payout on-chain automatisé (AFF-AUTO, Wave 5).
- Lignes pseudonymisées par filleul dans le dashboard — écarté (D-13).
- Blocage de l'auto-parrainage à l'inscription — gardé optionnel (le garde-fou au calcul D-12 suffit).
- Gestion consolidée affiliés/performances superadmin (ADMIN-03/04) — Phase 8.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AFF-01 | Code promo ; visiteur `?ref=` attribué à l'affilié à l'inscription | Capture middleware (§Pattern 1) + wrapper signUp lisant le cookie (§Pattern 2) + table `referrals` + code vanity (§Pattern 5) |
| AFF-02 | Dashboard affilié (abonnés actifs, revenus, commissions dues/payées) sans PII | Vues d'agrégation RLS no-PII (§Pattern 6) + RLS « lis les tiens » miroir 0009/0012 |
| AFF-03 | Commissions récurrentes (palier max 20 %) sur abonnés ACTIFS, idempotentes par période | Job mensuel (§Pattern 3) + RPC commission `security definer` + `UNIQUE(affiliate_id, referral_id, period)` (§Pattern 4) |
| AFF-04 | Superadmin marque commissions payées (payout manuel crypto) ; reflété au dashboard | Table `payouts` (tx_hash+date+montant D-15) + action `(admin)` service_role (§Pattern 7) |
| AFF-05 | Auto-parrainage et abonnés expirés → 0 commission | Exclusion `referral.user_id = affiliate.user_id` au calcul (D-12) + filtre `subscriptions.status='active' AND current_period_end > now()` via `has_active_subscription`-équivalent (§Pitfall 3) |

</phase_requirements>

## Project Constraints (from CLAUDE.md + STATE.md)

- **Migrations via MCP `apply_migration`** — JAMAIS `supabase db push`, JAMAIS `supabase gen types --linked` (projet non lié). Après apply : `generate_typescript_types` PUIS **ré-appliquer manuellement** les alias maison + override `*_atomic` string en fin de `database.types.ts` (D-05-02-F : `generate_typescript_types` écrase tout le fichier).
- **Prochaine migration = 0016** (0015 = dernière sur disque ; ⚠️ 0013 absente — NE PAS réutiliser).
- **Colonnes `*_atomic` typées `string`** (BIGINT) dans `database.types.ts` — PostgREST sérialise bigint en string (>2^53). `BigInt(x).toString()` à l'écriture, `BigInt(x)` à la lecture, JAMAIS `Number()` (CR-02).
- **`service_role` réservé serveur/jobs** — `@app/supabase/service-client` lint-interdit côté web. Web utilise `createAdminServiceClient()` local (`apps/web/src/lib/supabase/admin-service.ts`, `import 'server-only'`). `apps/jobs` instancie son propre client lazy.
- **JAMAIS `NEXT_PUBLIC_` sur la clé service_role**. RLS stricte (isolation affilié).
- **`@app/data-sources` server-only** ; jobs idempotents + `job_runs` ; luxon pour TZ/mois calendaire UTC.
- **TypeScript strict** (`typescript.ignoreBuildErrors` INTERDIT) ; `exactOptionalPropertyTypes` actif (spread conditionnel pour props optionnelles).
- **i18n next-intl verrouillé P1** : tout texte via `t(...)` ; check CI `lint:i18n` anti-chaîne-dure ; parité STRICTE fr/en/ar par namespace. Montants/codes/% en `<bdi>`.
- **`getUser()` jamais `getSession()`** côté serveur.
- **Build prod = webpack (PAS turbopack)** ; imports `.js` des packages TS-source ; frontière argent bigint = string type-only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capture `?ref` (cookie 30j, last-touch) | Frontend Server (middleware) | — | Le middleware voit chaque requête et l'URL brute ; seul endroit pour intercepter `?ref` avant routing (D-09). Pose un cookie httpOnly. |
| Attribution à l'inscription (créer `referral`) | API/Backend (server action `service_role`) | — | Le trigger DB `handle_new_user` ne voit PAS le cookie HTTP. L'attribution doit lire le cookie côté serveur après `signUp` puis écrire `referrals` via service_role (RLS interdit l'écriture front). |
| Candidature affilié (formulaire) | Frontend Server (RSC + server action) | — | `[locale]/affiliation` publique gated derrière le lien ; insertion `affiliate_applications(pending)` — l'utilisateur peut insérer la sienne (RLS) OU service_role (à trancher §Open Q). |
| File de revue + promotion rôle + code | API/Backend (`(admin)` service_role) | — | Cross-user (lire toutes les candidatures) + écritures privilégiées (`profiles.role`, `affiliate_codes`) → service_role local, miroir `(admin)/file`. |
| Calcul de commission mensuel | API/Backend (job `apps/jobs` service_role) | Database (RPC `security definer`) | Agrégation `payments`×`subscriptions`×`referrals` + idempotence `UNIQUE` → job idempotent traçant `job_runs`, logique d'idempotence/atomicité poussée dans un RPC DB. |
| Dashboard affilié no-PII | Frontend Server (RSC) | Database (vues d'agrégat RLS) | Lecture agrégée seule (D-13) ; la RLS « lis les tiens » est la SEULE barrière d'isolation (Pitfall #5). Pas d'écriture front. |
| Payout (marquer payé) | API/Backend (`(admin)` service_role) | — | Insertion `payouts` (tx_hash) + transition commission due→payée via service_role. |

## Standard Stack

**Aucun paquet npm nouveau.** Tout est déjà installé et verrouillé. Le researcher a vérifié les `package.json` réels.

### Core (déjà présents)
| Library | Version (réelle au dépôt) | Purpose | Where |
|---------|------|---------|--------------|
| `@supabase/supabase-js` | 2.108.0 | Client service_role (jobs + admin local) | `apps/jobs`, `apps/web/lib/supabase/admin-service.ts` |
| `@supabase/ssr` | 0.12.0 | Session cookies App Router (middleware, RSC) | `apps/web` |
| `@tanstack/react-query` | 5.101.0 | Cache/fetch dashboard affilié (D-14) | `apps/web/package.json` (déjà installé) |
| `luxon` | 3.7.2 | Bornes du mois calendaire UTC (`period='YYYY-MM'`, D-05) | `apps/jobs`, `packages/core` |
| `next-intl` | 4.13 | i18n namespace `affiliate` (FR/EN/AR parité stricte) | `apps/web` |
| `zod` | 4.4.3 | Validation formulaire candidature (client + serveur) | `apps/web` |
| `react-hook-form` + `@hookform/resolvers` | 7 / 5 | Formulaire candidature (pattern signup P2/P4) | `apps/web` |
| `pino` | 10.3.1 | Logs job de commission | `apps/jobs` |
| `tsx` | 4.22.4 | Exécution du job (`tsx src/dispatch.ts <job>`) | `apps/jobs` |

### Composants UI (déjà installés — UI-SPEC §Design System)
`table`, `card`, `badge`, `progress`, `tabs`, `form`, `alert-dialog`, `input`, `textarea`, `label`, `button`, `skeleton`, `sonner`. **N'INSTALLER aucune lib d'icônes** (lucide-react absent, invariant D-01-03-D → SVG inline).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RPC `security definer` pour la commission | Calcul + upsert en JS (job) | Le RPC garde l'idempotence/atomicité DANS la transaction DB (miroir `activate_subscription_for_payment`). En JS, une race entre lecture du compteur et insert ouvrirait une fenêtre TOCTOU ; le `UNIQUE` index reste le filet, mais la logique de taux doit rester déterministe. **Recommandé : RPC.** |
| Vue SQL d'agrégat pour le dashboard | Requête PostgREST `.select(count)` côté RSC | Une **vue `security_invoker=true`** (hérite la RLS de l'appelant) garantit l'isolation no-PII sans risque de jointure PII oubliée. Précédent `pattern_stats` (0014) mais celle-ci était `security_invoker=false` + grant anon (lecture publique). Ici on veut l'inverse : isolation par affilié. **Recommandé : vue `security_invoker=true` OU RPC `security definer` filtré sur `auth.uid()`** (cf. §Open Q2). |

## Package Legitimacy Audit

**Non applicable.** Phase 7 n'installe AUCUN paquet npm (UI-SPEC §Registry Safety : « Aucun nouveau paquet npm. Aucune lib d'icônes »). Tous les composants `ui/` et libs (`@tanstack/react-query`, `luxon`, `zod`, `react-hook-form`) sont déjà présents et vettés en P2/P4. slopcheck non requis.

## Architecture Patterns

### System Architecture Diagram

```
                          VISITEUR
                             │
          arrive avec ?ref=BORHANE
                             │
                             ▼
   ┌──────────────────────────────────────────────┐
   │  MIDDLEWARE (apps/web/src/middleware.ts)       │
   │  1. handleI18n(request)  → response (locale)   │  ◄── ORDRE D-09 : locale
   │  2. captureRef(request, response)              │  ◄── ref (NOUVEAU)
   │       si ?ref present → set cookie `aff_ref`   │       httpOnly 30j, last-touch
   │  3. updateSession(request, response)           │  ◄── session
   └──────────────────────────────────────────────┘
                             │ cookie aff_ref persiste 30j
                             ▼
                      … navigation …
                             │
                  user clique « S'inscrire »
                             ▼
   ┌──────────────────────────────────────────────┐
   │  SERVER ACTION signUp (auth/actions.ts)        │
   │  a. supabase.auth.signUp() → trigger DB crée   │
   │     profiles(id,email,role='member')           │
   │  b. SI succès : lire cookie aff_ref (cookies()) │
   │  c. attributeReferral(serviceClient, {          │
   │       affiliate_code, referral_user_id })       │  ◄── service_role local
   │       → INSERT referrals (ignore si self-ref)    │      (RLS interdit front)
   │  d. clear cookie aff_ref                         │
   └──────────────────────────────────────────────┘
                             │
                             ▼  (plus tard) le filleul paie → payments(verified) + subscriptions(active)
                             │
   ┌──────────────────────────────────────────────┐
   │  JOB MENSUEL  apps/jobs/src/jobs/              │
   │  affiliate-commission.ts (dispatch + runJob)    │
   │  pour chaque affilié :                          │
   │   1. count referrals attribués → palier → TAUX │  D-02 (audience)
   │   2. Σ payments.amount_atomic des filleuls       │  D-03 (argent réel)
   │      ACTIFS sur le mois (exclut self-ref D-12)   │  AFF-05
   │   3. RPC upsert_commission(...)                  │  UNIQUE(aff,ref,period)
   │      → 1 ligne/filleul/mois, re-run = idempotent │  D-05
   └──────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
  ┌─────────────────┐              ┌──────────────────────┐
  │ DASHBOARD (RSC) │              │  (admin) PAYOUT       │
  │ vues agrégat    │              │  marquer payé →       │
  │ RLS lis-les-    │◄─────────────│  INSERT payouts        │
  │ tiens, no-PII   │  due→payée   │  (tx_hash+date+montant)│
  │ (react-query)   │              │  service_role          │
  └─────────────────┘              └──────────────────────┘
```

### Recommended Project Structure
```
supabase/migrations/
└── 0016_affiliation.sql            # 5 tables + RLS + RPC upsert_commission + grille en fonction SQL

packages/supabase/src/repositories/
├── affiliates.ts                   # service_role : promoteAffiliate, createCode, attributeReferral
├── affiliateApplications.ts        # candidatures (list pending, approve/reject)
├── commissions.ts                  # service_role : upsertCommission (via RPC), markPaid
└── referrals.ts                    # countReferrals, lookup code → affiliate

apps/jobs/src/jobs/
└── affiliate-commission.ts         # job mensuel idempotent (miroir outcome-tracker.ts)

apps/web/src/
├── lib/affiliate/captureRef.ts     # helper middleware (pose cookie aff_ref)
├── app/[locale]/affiliation/        # surface 1 : candidature (RSC + form + action)
├── app/[locale]/(affiliate)/dashboard/  # surface 3 : dashboard no-PII (react-query)
└── app/(admin)/affiliation/         # surfaces 2+4 : file de revue + payouts
```

### Pattern 1 : Capture `?ref` dans le middleware composé (D-09, D-10)
**What:** Insérer une 3ᵉ étape entre `handleI18n` et `updateSession`, qui pose un cookie `aff_ref` si `?ref=CODE` est présent. Ordre strict **locale → ref → session** (verrouillé). Last-touch = on écrase toujours.
**When to use:** Toute requête UI (le matcher middleware existant couvre déjà tout sauf api/assets).
**Example:**
```typescript
// apps/web/src/lib/affiliate/captureRef.ts
// Source: pattern lu dans apps/web/src/middleware.ts (composition sur UNE response)
import type { NextRequest, NextResponse } from 'next/server'

const REF_COOKIE = 'aff_ref'
const REF_MAX_AGE = 60 * 60 * 24 * 30 // 30 jours (D-09)
const CODE_RE = /^[A-Z0-9]{3,20}$/      // borne D-06 (longueur à confirmer)

export function captureRef(request: NextRequest, response: NextResponse): void {
  const raw = request.nextUrl.searchParams.get('ref')
  if (!raw) return
  const code = raw.toUpperCase().trim()
  if (!CODE_RE.test(code)) return // ignore une valeur non conforme (anti-injection)
  // last-touch (D-10) : on écrase toujours le cookie précédent.
  response.cookies.set({
    name: REF_COOKIE,
    value: code,
    maxAge: REF_MAX_AGE,
    httpOnly: true,   // non lisible par JS client (anti-vol/tamper)
    sameSite: 'lax',  // suivi cross-site sur navigation top-level
    secure: true,
    path: '/',
  })
}
```
```typescript
// apps/web/src/middleware.ts — insertion (ordre D-09 préservé)
const response = handleI18n(request)           // 1. locale
response.headers.set('x-pathname', request.nextUrl.pathname)
captureRef(request, response)                  // 2. ref (MUTE la même response)
return await updateSession(request, response)  // 3. session
```
**Pourquoi MUTER la même `response`** : recréer `NextResponse.next()` perdrait le rewrite de locale (Pitfall 2, lu dans `lib/supabase/middleware.ts`). Même invariant que `updateSession`.

### Pattern 2 : Attribution à l'inscription via wrapper server-action (D-11, point dur)
**What:** Le trigger DB `handle_new_user` (0001, `search_path=''`) crée `profiles` mais **ne voit pas le cookie HTTP**. L'attribution doit donc se faire dans la server action `signUp` APRÈS `auth.signUp`, en lisant le cookie côté serveur et en écrivant `referrals` via `service_role` (la RLS interdit toute écriture front sur `referrals`).
**When to use:** Uniquement dans `apps/web/src/app/[locale]/(auth)/actions.ts:signUp`.
**Example:**
```typescript
// extension de signUp (actions.ts) — APRÈS le signUp réussi, AVANT le redirect
// Source: pattern lu dans actions.ts (signUp) + admin-service.ts (service_role local)
import { cookies } from 'next/headers'
import { createAdminServiceClient } from '../../../lib/supabase/admin-service'
import { attributeReferral } from '@app/supabase'

const { data, error } = await supabase.auth.signUp({ email, password })
if (error) { /* … redirect erreur … */ }

// D-11 : attribution figée à l'inscription
const refCode = (await cookies()).get('aff_ref')?.value
if (refCode && data.user) {
  // service_role local (RLS interdit l'écriture front sur referrals)
  await attributeReferral(createAdminServiceClient(), {
    affiliate_code: refCode,
    referral_user_id: data.user.id,
  })
  // best-effort : un code invalide / self-ref ne bloque JAMAIS le signup
}
;(await cookies()).delete('aff_ref') // consommé une fois
redirect({ href: '/paiement-bientot', locale })
```
**`attributeReferral` (repo service_role)** : résout `affiliate_code → affiliate_id` ; si introuvable → no-op ; insère `referrals(affiliate_id, user_id, attributed_at)` avec `ON CONFLICT (user_id) DO NOTHING` (un user n'est attribué qu'une fois, last-touch s'est déjà joué au niveau du cookie). **Ne lève jamais** : l'échec d'attribution ne doit pas casser l'inscription (best-effort, loggé).

### Pattern 3 : Job mensuel idempotent (miroir `outcome-tracker.ts`)
**What:** Job `affiliate-commission` enregistré dans `dispatch.ts`, exécuté via `runJob` (trace `job_runs` automatiquement), client `service_role` lazy. Cadence mensuelle (Windows Task Scheduler + routine Claude). Calcule pour le mois calendaire courant (ou un `period` passé en argv).
**When to use:** Calcul des commissions. Re-run = même total (D-05).
**Example (squelette, miroir exact outcome-tracker.ts):**
```typescript
// apps/jobs/src/jobs/affiliate-commission.ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import type { Json, Database } from '@app/supabase'

function getServiceClient() { /* … miroir outcome-tracker.ts … */ }

export async function affiliateCommission(): Promise<Json> {
  const client = getServiceClient()
  // mois calendaire UTC (D-05). luxon pour les bornes exactes.
  const period = DateTime.utc().toFormat('yyyy-MM')          // 'YYYY-MM'
  // Tout le calcul + l'upsert idempotent vivent dans le RPC (atomicité/idempotence DB).
  const { data, error } = await client.rpc('compute_affiliate_commissions', { p_period: period })
  if (error) throw new Error(`affiliate-commission: ${error.message}`)
  return { period, ...(data as object) } as Json
}
```
Puis enregistrer dans `dispatch.ts` : `'affiliate-commission': affiliateCommission,`.

### Pattern 4 : RPC commission `security definer` + `UNIQUE` idempotent (miroir 0012)
**What:** Toute la logique de calcul dans un RPC `security definer set search_path = public`, `revoke execute from public, anon, authenticated` (seul service_role appelle). Pour chaque (affilié, filleul actif, période) : applique la grille de taux selon le compteur d'inscrits, calcule `taux × Σ amount_atomic`, upsert sur `UNIQUE(affiliate_id, referral_id, period)`.
**When to use:** Cœur AFF-03/AFF-05. Idempotence et exclusion auto-parrainage vivent ici.
**Example (SQL — structure ; chiffres exacts = discrétion planner):**
```sql
-- 0016 (extrait) : grille de taux en fonction SQL pure (D-01/D-02)
create function public.affiliate_rate_bps(p_signups int) returns int
  language sql immutable as $$
  select case
    when p_signups >= 50000 then 2000  -- 20.00 % (basis points)
    when p_signups >= 25001 then 1800
    when p_signups >= 10001 then 1700
    when p_signups >= 5001  then 1600
    when p_signups >= 1001  then 1500
    when p_signups >= 501   then 1400
    when p_signups >= 100   then 1200
    when p_signups >= 1     then 800
    else 0
  end;
$$;

-- RPC d'upsert idempotent par mois (miroir activate_subscription_for_payment)
create function public.compute_affiliate_commissions(p_period text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inserted int := 0;
begin
  -- 1 ligne par (affilié, filleul actif, période). amount_atomic = bigint exact.
  insert into public.commissions (affiliate_id, referral_id, period, rate_bps, base_atomic, amount_atomic, status)
  select
    a.id, r.user_id, p_period,
    public.affiliate_rate_bps(cnt.signups)                                   as rate_bps,
    coalesce(sum(p.amount_atomic), 0)                                        as base_atomic,
    (coalesce(sum(p.amount_atomic), 0) * public.affiliate_rate_bps(cnt.signups)) / 10000 as amount_atomic,
    'due'
  from public.affiliates a
  join public.referrals r        on r.affiliate_id = a.id
  -- D-12 : EXCLUSION auto-parrainage au calcul (inviolable)
  and r.user_id <> a.user_id
  -- compteur d'inscrits (D-02) — audience, détermine le taux
  join lateral (select count(*) as signups from public.referrals rr where rr.affiliate_id = a.id) cnt on true
  -- D-03 : paiements vérifiés du filleul tombant dans le mois
  join public.payments p on p.user_id = r.user_id and p.status = 'verified'
    and to_char(p.verified_at, 'YYYY-MM') = p_period
  -- AFF-05 : filleul ACTIF sur la période (abonnement actif non expiré)
  join public.subscriptions s on s.user_id = r.user_id and s.status = 'active'
    and s.current_period_end > now()
  group by a.id, r.user_id, cnt.signups
  on conflict (affiliate_id, referral_id, period) do update
    set rate_bps = excluded.rate_bps,
        base_atomic = excluded.base_atomic,
        amount_atomic = excluded.amount_atomic
    where public.commissions.status = 'due';   -- ne JAMAIS écraser une commission déjà payée
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('period', p_period, 'rows', v_inserted);
end; $$;
revoke execute on function public.compute_affiliate_commissions(text) from public, anon, authenticated;
```
**Points critiques** :
- `base_atomic` et `amount_atomic` sont `bigint` ⇒ `string` dans `database.types.ts` (override manuel, CR-02). La multiplication `× rate_bps / 10000` reste **entière** (zéro float) — division entière Postgres tronque, ce qui est le comportement déterministe voulu (à confirmer arrondi avec le fondateur, §Open Q3).
- `on conflict … do update … where status='due'` = re-run idempotent qui **ne touche pas** les commissions déjà payées (D-15 : `due → payée` irréversible côté calcul).
- `to_char(verified_at, 'YYYY-MM')` lie le paiement au mois calendaire (D-05). ⚠️ Préférer une comparaison de bornes `[date_trunc, +1 month)` avec timezone UTC explicite plutôt que `to_char` (DST/locale), cohérent luxon UTC du job — §Pitfall 4.

### Pattern 5 : Code vanity (D-06) — normalisation & unicité
**What:** Code choisi par l'affilié, normalisé en MAJUSCULES, charset `[A-Z0-9]`, longueur bornée. Unicité garantie par `UNIQUE` DB (filet inviolable) + check applicatif (UX) — miroir exact de l'anti-replay `tx_hash`.
**Example:**
```sql
-- 0016 (extrait)
create table public.affiliate_codes (
  code         text primary key check (code ~ '^[A-Z0-9]{3,20}$'),  -- borne + filet
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  created_at   timestamptz not null default now()
);
-- 1 affilié peut avoir plusieurs codes ? Au MVP : 1 seul → unique sur affiliate_id si souhaité.
```
Normalisation côté insertion (superadmin) : `code.toUpperCase().trim()`. La violation `23505` (code pris) → message i18n `affiliate.errors.codeTaken` (déjà prévu UI-SPEC). **Longueur exacte = discrétion** : recommandation 3–20 (mémorisable pour un influenceur, assez large pour éviter les collisions).

### Pattern 6 : Dashboard no-PII — agrégats RLS seuls (D-13, AFF-02)
**What:** Le dashboard ne rend QUE des compteurs/sommes. Zéro ligne par filleul. Deux options d'implémentation (cf. §Open Q2) :
- **Option A (recommandée) — vue d'agrégat `security_invoker=true`** : la vue hérite de la RLS de l'appelant ⇒ un affilié ne voit que SES agrégats. La vue ne SELECT que des `count()`/`sum()` groupés par `affiliate_id`, jamais d'`user_id` de filleul.
- **Option B — RPC `security definer` filtrée sur `auth.uid()`** : retourne un objet d'agrégats pour l'affilié courant uniquement.
**Isolation prouvée (test obligatoire)** : un affilié A authentifié ne doit JAMAIS lire les agrégats de B (cross-user → 0 ligne / accès refusé). Miroir des tests RLS `gating-rls.test.ts` (P1) et isolation `subscriptions` cross-user.
**No-PII checker** : le checker/auditeur DOIT échouer si une surface affilié rend une boucle/table sur des referrals individuels (UI-SPEC §Tier Grid).

### Pattern 7 : Payout (D-15, AFF-04) — file `(admin)` service_role
**What:** Surface `(admin)/affiliation/payouts` (mono-FR, hors `[locale]`, miroir `(admin)/file`). Le superadmin saisit tx_hash + montant + date dans un `alert-dialog`, l'action server `service_role` insère `payouts` ET transitionne la commission `due → payée` (idéalement dans un RPC mono-transaction pour ne pas diverger, miroir `activate_subscription_for_payment`). Re-valide `requireRole('superadmin')` en tête de l'action (T-04-ADMIN-WRITE).
**Example:**
```typescript
// (admin)/affiliation/payouts/actions.ts — miroir (admin)/file/actions.ts
'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { requireRole } from '../../../lib/auth/gate'
import { createAdminServiceClient } from '../../../lib/supabase/admin-service'
import { markCommissionPaid } from '@app/supabase'

export async function payCommission(formData: FormData) {
  await requireRole('superadmin')               // re-valide (endpoint POST direct)
  const client = createAdminServiceClient()
  const commission_id = String(formData.get('commission_id') ?? '')
  const tx_hash = String(formData.get('tx_hash') ?? '').trim()
  const amount_atomic = String(formData.get('amount_atomic') ?? '')  // bigint string
  if (!commission_id || !tx_hash) throw new Error('commission_id et tx_hash requis')
  await markCommissionPaid(client, { commission_id, tx_hash, amount_atomic })  // RPC: insert payouts + commission→payée
  revalidatePath('/affiliation/payouts')
}
```

### Anti-Patterns to Avoid
- **Faire l'attribution `?ref` dans le trigger DB `handle_new_user`** : le trigger n'a AUCUN accès au cookie HTTP. L'attribution DOIT passer par la server action (Pattern 2).
- **Stocker le taux/palier en colonne dénormalisée recalculée au front** : le taux est dérivé du compteur d'inscrits au moment du calcul (job/RPC) — le front l'AFFICHE seulement (D-14), ne le calcule jamais.
- **Float pour la commission** : `taux × amount_atomic` reste entier BigInt ×10⁶. Zéro `Number()`, zéro virgule flottante (déterminisme financier P4).
- **Joindre une PII de filleul dans la vue dashboard** : violation D-13 directe. La vue ne SELECT que des agrégats.
- **Écriture front sur `referrals`/`commissions`/`payouts`** : RLS = aucune policy write (miroir 0012/0015). Tout passe par service_role/RPC.
- **`security_invoker=false` sur la vue dashboard** : casserait l'isolation (un affilié verrait tout). C'était correct pour `pattern_stats` (lecture publique) mais INVERSE ici.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotence du job de commission | Compteur applicatif + check exists | `UNIQUE(affiliate_id, referral_id, period)` + `ON CONFLICT` (Pattern 4) | Filet DB inviolable (le check applicatif a une TOCTOU) — miroir exact `UNIQUE(tx_hash)` 0012 et `UNIQUE(dedupe_key)` 0015. |
| Atomicité insert payout + transition commission | Deux requêtes séparées | RPC `security definer` mono-transaction | Évite la divergence payout/commission (miroir `activate_subscription_for_payment`, T-04-INCONSIST). |
| Traçage de l'exécution du job | `console.log` + insert manuel | `runJob(name, fn)` (`apps/jobs/src/runJob.ts`) | Trace `job_runs` running→success/error automatiquement (JOB-04). RIEN à coder. |
| Bornes du mois calendaire UTC | `new Date()` + arithmétique manuelle | luxon `DateTime.utc().toFormat('yyyy-MM')` + `startOf/endOf('month')` | DST/locale gérés ; cohérent avec le cœur jobs (luxon verrouillé). |
| Client service_role côté web | `@app/supabase/service-client` (lint-interdit) | `createAdminServiceClient()` (`admin-service.ts`, `server-only`) | Double barrière : lint + `server-only` plante le build si fuite navigateur. |
| Isolation affilié | Filtrage applicatif `where affiliate_id = …` | RLS « lis les tiens » (miroir 0009/0012) + vue `security_invoker=true` | La RLS est la SEULE barrière non contournable (Pitfall #5). Le filtre applicatif est bypassable. |
| « Filleul actif » | Requête maison `status='active'` | Logique de `has_active_subscription()` (0009) répliquée dans le RPC (job en service_role, pas `auth.uid()`) | Source unique de la définition d'actif (`status='active' AND current_period_end > now()`). |

**Key insight:** Phase 7 = assemblage. Chaque brique (idempotence, RPC atomique, file superadmin, job tracé, service_role local, BigInt string) existe déjà et est golden-testée. Le risque n'est pas technique mais de **fidélité au pattern** : reproduire EXACTEMENT les conventions (noms de policy, `revoke execute`, `search_path` figé, override string `*_atomic`, ré-application des alias post gen-types).

## Runtime State Inventory

> Phase 7 est majoritairement greenfield (nouvelles tables/surfaces). Quelques points d'état runtime existent néanmoins.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `profiles.role` existant — les users actuels sont `'member'` par défaut (0008). Promouvoir un user en `'affiliate'` = UPDATE service_role. | Code edit (action admin de promotion). Aucune migration de données. |
| Live service config | **Aucune.** Pas de service externe (Telegram/OANDA/Binance/TronGrid) impliqué dans l'affiliation. Payout = manuel hors-plateforme. | None — vérifié : le payout AFF-04 est manuel (D-15), pas d'intégration on-chain (AFF-AUTO déféré). |
| OS-registered state | **Nouveau** : ajouter le job `affiliate-commission` au Windows Task Scheduler (cadence mensuelle). Le `.cmd` wrapper existe déjà (`apps/jobs/windows/run-job.cmd <job>`). | Re-register : 1 nouvelle tâche mensuelle (hors-code, ops). Documenter dans le plan. |
| Secrets/env vars | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` déjà requis (jobs + admin-service). **Aucun nouveau secret** (pas de clé API affiliation). | None — réutilise les env vars existantes. |
| Build artifacts | Aucun rename. La régénération `database.types.ts` post-0016 écrase les alias maison (D-05-02-F) → les **ré-appliquer manuellement** + override string sur les nouvelles colonnes `*_atomic`. | Code edit : ré-appliquer alias + ajouter `AffiliateRow`/`CommissionRow`/… aliases + override `base_atomic`/`amount_atomic` string. |

## Common Pitfalls

### Pitfall 1 : Attribution `?ref` perdue (cookie non lu au signup)
**What goes wrong:** Le cookie `aff_ref` est posé par le middleware mais le signup ne le lit pas (ou le trigger DB est censé le faire).
**Why it happens:** Confusion sur QUI attribue : le trigger DB `handle_new_user` n'a pas le cookie ; seul le code serveur (server action) y a accès via `cookies()`.
**How to avoid:** Attribution explicite dans `signUp` après `auth.signUp`, via service_role (Pattern 2). Test E2E : arriver avec `?ref=X`, s'inscrire, vérifier la ligne `referrals`.
**Warning signs:** `referrals` vide malgré des arrivées `?ref` ; ou attribution qui marche en local mais pas en prod (cookie `secure` + http local).

### Pitfall 2 : Double compteur confondu (audience vs argent — D-05 flag)
**What goes wrong:** Le palier (taux) est calculé sur les abonnés actifs au lieu du nombre d'inscrits, ou le montant est payé sur des inscrits non payants.
**Why it happens:** Le fondateur dit « pas de compte sans payer » mais techniquement un profil existe dès le signup (avant paiement). Les deux compteurs sont distincts (D-02 audience / D-03 argent).
**How to avoid:** `count(referrals)` = audience → grille → taux (D-02). `Σ payments.amount_atomic des filleuls actifs` = base → montant (D-03). Deux jointures séparées dans le RPC (Pattern 4). Tester : un affilié avec 600 inscrits dont 2 payants → taux palier 3 (14 %) sur le revenu des 2 payants seulement.
**Warning signs:** Montant de commission proportionnel au nombre d'inscrits ; ou taux qui varie avec le nombre de payants.

### Pitfall 3 : Filleul expiré commissionné (AFF-05)
**What goes wrong:** Un abonné dont l'abonnement a expiré génère encore une commission.
**Why it happens:** Filtre sur `payments.verified` sans vérifier l'état d'abonnement à la période.
**How to avoid:** Jointure `subscriptions.status = 'active' AND current_period_end > now()` (définition canonique « actif », 0009). Le job tourne en service_role, donc répliquer la logique de `has_active_subscription()` dans le RPC (pas `auth.uid()`). Tester : filleul avec paiement vérifié + abonnement expiré → 0 commission.
**Warning signs:** Commissions sur des users sans abonnement actif.

### Pitfall 4 : Mois calendaire mal borné (DST / timezone)
**What goes wrong:** Un paiement de fin de mois tombe dans le mauvais `period`, ou un re-run dans un fuseau différent change le total (casse l'idempotence D-05).
**Why it happens:** `to_char(verified_at, 'YYYY-MM')` dépend du timezone de session Postgres ; `new Date()` en JS suit le TZ local.
**How to avoid:** UTC explicite partout. Job : `DateTime.utc().toFormat('yyyy-MM')` (luxon). RPC : comparer `verified_at` à des bornes `[date_trunc('month', $period::date) , + interval '1 month')` en `timestamptz` UTC, plutôt qu'un `to_char` sensible au TZ. Documenter le TZ d'ancrage.
**Warning signs:** Total de commission différent entre deux re-runs ; paiements de minuit mal classés.

### Pitfall 5 : Régénération `database.types.ts` écrase les alias (récurrent P5/P6)
**What goes wrong:** Après `generate_typescript_types`, les alias maison (`CandleInsert`, `ProfileRow`, …) et les overrides string `*_atomic` disparaissent → ~50 erreurs tsc.
**Why it happens:** `generate_typescript_types` réécrit TOUT le fichier (D-05-02-F).
**How to avoid:** Après chaque régénération : ré-appliquer le bloc d'alias en fin de fichier + override manuel `amount_atomic`/`base_atomic`/`expected_amount_atomic` en `string` (commentaire CR-02 existant comme modèle). Ajouter `AffiliateRow/Insert`, `ReferralRow/Insert`, `CommissionRow/Insert`, `PayoutRow/Insert`, `AffiliateApplicationRow/Insert`.
**Warning signs:** Erreurs tsc « has no exported member ProfileRow » après une migration appliquée live.

### Pitfall 6 : Isolation RLS dashboard contournée (no-PII faux)
**What goes wrong:** Un affilié lit les données d'un autre, ou une PII de filleul fuit via une jointure.
**Why it happens:** Vue `security_invoker=false` (vue le voit tout), ou requête RSC en service_role (bypass RLS) qui oublie un filtre.
**How to avoid:** Dashboard en **anon/auth-client** (PAS service_role) + vue `security_invoker=true` OU RPC `security definer` filtrée `auth.uid()`. La vue ne SELECT que des agrégats. Test cross-user obligatoire (miroir gating-rls). `get_advisors security` au gate de phase.
**Warning signs:** Le dashboard affiche un `user_id` ou une date d'inscription individuelle ; un affilié voit des chiffres non nuls pour un autre.

## Code Examples

### Repo `attributeReferral` (service_role, best-effort, ON CONFLICT DO NOTHING)
```typescript
// packages/supabase/src/repositories/affiliates.ts
// Source: pattern lu dans payments.ts (service_role, isUniqueViolation) + subscriptions.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
type ServiceClient = SupabaseClient<Database>

export interface AttributeReferralInput {
  affiliate_code: string       // depuis le cookie aff_ref (déjà normalisé A-Z0-9)
  referral_user_id: string
}

/** D-11/D-12 : résout le code → affilié, insère le referral (sauf self-ref). Best-effort. */
export async function attributeReferral(
  client: ServiceClient,
  input: AttributeReferralInput,
): Promise<{ attributed: boolean }> {
  const { data: codeRow } = await client
    .from('affiliate_codes')
    .select('affiliate_id, affiliates!inner(user_id)')
    .eq('code', input.affiliate_code)
    .maybeSingle()
  if (!codeRow) return { attributed: false }                 // code inconnu → no-op

  const affiliateUserId = (codeRow.affiliates as unknown as { user_id: string }).user_id
  // D-12 garde-fou optionnel à l'inscription (le calcul exclut déjà) :
  if (affiliateUserId === input.referral_user_id) return { attributed: false } // self-ref

  const { error } = await client
    .from('referrals')
    .insert({ affiliate_id: codeRow.affiliate_id, user_id: input.referral_user_id })
    // un user n'est attribué qu'une fois (last-touch joué au cookie)
  if (error && (error as { code?: string }).code !== '23505') {
    throw new Error(`attributeReferral: ${error.message}`)
  }
  return { attributed: true }
}
```

### Vue d'agrégat dashboard (no-PII, security_invoker)
```sql
-- 0016 (extrait) : agrégats par affilié, RLS héritée de l'appelant (no-PII D-13)
create view public.affiliate_dashboard with (security_invoker = true) as
select
  a.id                                                   as affiliate_id,
  count(distinct r.user_id)                              as total_signups,        -- D-14 inscrits
  count(distinct s.user_id) filter (
    where s.status='active' and s.current_period_end > now()
  )                                                       as active_referrals,     -- D-14 abonnés actifs
  coalesce(sum(c.amount_atomic) filter (where c.status='due'),  0)::text as commissions_due_atomic,
  coalesce(sum(c.amount_atomic) filter (where c.status='payée'),0)::text as commissions_paid_atomic
from public.affiliates a
left join public.referrals r     on r.affiliate_id = a.id
left join public.subscriptions s on s.user_id = r.user_id
left join public.commissions c   on c.affiliate_id = a.id
where a.user_id = auth.uid()        -- isolation (la RLS sous-jacente la renforce)
group by a.id;
-- ::text sur les bigint sommés → PostgREST string (CR-02), JAMAIS Number côté JS.
```
*(Le taux/palier courant se dérive de `total_signups` via `affiliate_rate_bps` — exposable en colonne calculée ou côté RSC.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` `getUser()` | déjà P1 | N/A pour P7 (hérité). |
| `to_char` pour borner un mois | bornes `timestamptz` UTC `[date_trunc, +1 month)` | recommandation P7 | Idempotence robuste au TZ (Pitfall 4). |
| Float pour montants | BigInt atomique ×10⁶ string | P4 | Déterminisme financier (hérité, à respecter). |

**Deprecated/outdated:** rien de spécifique à P7. Tous les patterns sont courants dans le dépôt (dernière migration 0015, juin 2026).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Le cookie `aff_ref` en `sameSite:'lax'` suffit pour capturer un `?ref` sur navigation top-level depuis un lien externe (influenceur) | Pattern 1 | `strict` casserait l'attribution cross-site ; `lax` est le bon défaut mais à valider en E2E réel. |
| A2 | L'attribution doit être best-effort (un code invalide ne bloque jamais le signup) | Pattern 2 | Si l'attribution devait être bloquante (rare), le flux changerait — mais bloquer un signup sur une erreur d'affiliation est un anti-pattern produit. |
| A3 | Longueur du code vanity = 3–20 caractères `[A-Z0-9]` | Pattern 5 / D-06 | Borne exacte = discrétion ; trop court = collisions, trop long = non mémorisable. À confirmer fondateur. |
| A4 | Un `referral` est unique par `user_id` (un filleul n'appartient qu'à un affilié, last-touch figé au signup) | Pattern 2 / D-11 | Si un user pouvait être ré-attribué après signup, le modèle changerait — mais D-11 fige l'attribution à l'inscription. |
| A5 | L'arrondi de `amount_atomic × rate_bps / 10000` se fait par troncature entière Postgres | Pattern 4 | Arrondi (floor vs round) affecte des micro-unités ; impact financier négligeable mais à figer (déterminisme). §Open Q3. |
| A6 | La candidature `affiliate_applications` est insérée par l'utilisateur authentifié (RLS insert self) OU via service_role | Pattern 6 / D-08 | Si le formulaire est public (non authentifié), l'insertion doit passer par une server action service_role (pas de RLS authenticated). §Open Q1. |
| A7 | `commissions.status` utilise les valeurs `'due'`/`'payée'` (UI-SPEC) | Pattern 4/7 | Cohérence avec les badges UI ; le planner doit figer l'enum exact (text + check, miroir 0012). Éviter un accent dans une valeur SQL → préférer `'due'`/`'paid'` en DB et traduire au front. |

## Open Questions

1. **Le formulaire de candidature est-il accessible non authentifié ?**
   - What we know: UI-SPEC dit « page publique gated derrière le lien programme », audience « visiteur/membre candidat ».
   - What's unclear: un visiteur non connecté peut-il candidater (alors aucune RLS authenticated ne couvre l'insert) ?
   - Recommendation: insérer `affiliate_applications` via une **server action service_role** (pas de policy insert front), qui capture les champs + l'email saisi. Évite d'exiger un compte pour candidater et garde la frontière producteur-unique. (Si réservé aux membres connectés : RLS insert `user_id = auth.uid()` possible.)

2. **Dashboard : vue `security_invoker=true` ou RPC `security definer` filtré `auth.uid()` ?**
   - What we know: les deux isolent. `pattern_stats` (0014) était `security_invoker=false` (lecture publique) — cas inverse.
   - What's unclear: lequel donne la meilleure ergonomie react-query + le test d'isolation le plus simple.
   - Recommendation: **vue `security_invoker=true`** (plus simple à requêter via PostgREST `.select()`, RLS héritée automatiquement, isolation prouvable par test cross-user). RPC si des agrégats multi-tables deviennent trop lourds pour une vue.

3. **Arrondi de la commission (troncature vs arrondi au plus proche) ?**
   - What we know: `amount_atomic × rate_bps / 10000` en entier ⇒ Postgres tronque.
   - What's unclear: le fondateur veut-il `floor` (par défaut) ou `round` ?
   - Recommendation: `floor` (troncature) = déterministe et conservateur (jamais sur-payer). Documenter et figer en test golden. Impact = sous-unités USDT (négligeable), mais doit être stable entre re-runs.

4. **`commissions.status` : valeur SQL accentuée `'payée'` ou `'paid'` ?**
   - Recommendation: stocker `'paid'`/`'due'` en DB (check constraint sans accent, évite les surprises d'encodage), traduire `'paid' → « payée »` au front via i18n. Le planner tranche.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MCP Supabase `apply_migration` | Migration 0016 | ✓ (utilisé 0008–0015) | — | Aucun (jamais db push) |
| `@tanstack/react-query` | Dashboard affilié | ✓ | 5.101.0 (apps/web) | — |
| luxon | Bornes mois calendaire | ✓ | 3.7.2 (apps/jobs) | — |
| Windows Task Scheduler | Cadence mensuelle du job | ✓ (déjà utilisé : outcome-tracker, subscription-expiry) | — | Routine Claude scheduled |
| `SUPABASE_SERVICE_ROLE_KEY` | Job + admin-service + RPC | ✓ (déjà requis) | — | Aucun |

**Missing dependencies with no fallback:** aucune.
**Missing dependencies with fallback:** aucune. Phase entièrement réalisable avec l'environnement existant.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit) + Playwright 1.60.0 (E2E) |
| Config file | `vitest.config.ts` (racine) — glob `packages/**` + `apps/**/__tests__/**` + chemins étendus (`apps/web/src/lib/**`, `apps/web/test/**`) |
| Quick run command | `npx vitest run <path>` |
| Full suite command | `npx vitest run` (racine) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AFF-01 | `captureRef` pose cookie sur `?ref`, ignore invalide, last-touch | unit | `npx vitest run apps/web/src/lib/affiliate/__tests__/captureRef.test.ts` | ❌ Wave 0 |
| AFF-01 | `attributeReferral` : code inconnu→no-op, self-ref→skip, 23505→idempotent | unit | `npx vitest run packages/supabase/src/repositories/__tests__/affiliates.test.ts` | ❌ Wave 0 |
| AFF-01 | E2E : arriver `?ref=X` → signup → ligne `referrals` créée | e2e | `npx playwright test affiliation-attribution.spec.ts` | ❌ Wave 0 (human-verify : dev server + .env) |
| AFF-03 | Grille : 600 inscrits → palier 3 (14 %) ; bornes de paliers | unit | `npx vitest run packages/core/src/affiliate/__tests__/tiers.test.ts` (si grille portée en core) | ❌ Wave 0 |
| AFF-03/05 | Job idempotent : re-run = même total ; expiré→0 ; self-ref→0 | integration | `npx vitest run apps/jobs/src/jobs/__tests__/affiliate-commission.test.ts` | ❌ Wave 0 (réseau Supabase → possible human-verify) |
| AFF-02 | Isolation RLS : affilié A ne lit pas les agrégats de B | integration | `npx vitest run packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts` (anon-client cross-user) | ❌ Wave 0 |
| AFF-04 | `markCommissionPaid` : insert payouts + commission due→paid atomique | integration | idem affiliate repo tests | ❌ Wave 0 |
| AFF-02 | i18n parité `affiliate` fr/en/ar (clés strictes) | unit | `npx vitest run apps/web/.../messages-parity-affiliate.test.ts` | ❌ Wave 0 (miroir messages-parity-payment.test.ts) |

### Sampling Rate
- **Per task commit:** `npx vitest run <fichier ciblé>` (logique pure : grille, captureRef, formatage).
- **Per wave merge:** `npx vitest run` (suite complète, ~420+ tests — non-régression P1–P6).
- **Phase gate:** suite complète verte + `get_advisors security` (isolation affilié confirmée) avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/web/src/lib/affiliate/__tests__/captureRef.test.ts` — couvre AFF-01 (cookie)
- [ ] `packages/supabase/src/repositories/__tests__/affiliates.test.ts` — couvre AFF-01 (attribution)
- [ ] `packages/core/src/affiliate/__tests__/tiers.test.ts` — couvre AFF-03 (grille pure, si portée en core)
- [ ] `apps/jobs/src/jobs/__tests__/affiliate-commission.test.ts` — couvre AFF-03/05 (idempotence)
- [ ] `messages-parity-affiliate.test.ts` — parité i18n (miroir `messages-parity-payment.test.ts`)
- [ ] Tests RLS cross-user anon-client (miroir `gating-rls.test.ts`) — couvre AFF-02 isolation
- Framework déjà installé — aucun install requis.

## Security Domain

> `security_enforcement` non désactivé en config → section incluse.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | oui | `getUser()` serveur (jamais `getSession()`) ; rôle via `profiles.role` (jamais JWT) |
| V3 Session Management | oui | Cookie `aff_ref` httpOnly/secure/sameSite=lax ; `@supabase/ssr` cookies session |
| V4 Access Control | oui (central) | RLS « lis les tiens » + `is_superadmin()` ; `requireRole('superadmin'/'affiliate')` re-validé en tête de CHAQUE server action ; écritures service_role/RPC uniquement |
| V5 Input Validation | oui | Zod (formulaire candidature) ; code vanity `^[A-Z0-9]{3,20}$` (regex + check DB) ; périodes/plans en allowlist serveur |
| V6 Cryptography | non | Aucune crypto maison ; tx_hash = identifiant public (pas un secret) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auto-parrainage (affilié se commissionne) | Tampering / Fraud | Exclusion `referral.user_id = affiliate.user_id` AU CALCUL (D-12, inviolable) + garde-fou optionnel à l'attribution |
| Double calcul de commission (re-run job) | Tampering | `UNIQUE(affiliate_id, referral_id, period)` + `ON CONFLICT DO UPDATE WHERE status='due'` (jamais écraser une payée) |
| Fuite PII de filleul via dashboard | Information Disclosure | Vue `security_invoker=true` agrégats seuls (D-13) ; checker échoue sur toute boucle par filleul ; test cross-user |
| Affilié lit les referrals d'un autre | Information Disclosure / Elevation | RLS `affiliate_id`/`user_id = auth.uid()` ; test isolation obligatoire (miroir gating-rls) |
| Écriture front sur commissions/payouts | Elevation of Privilege | RLS sans policy write → service_role bypass uniquement (miroir 0012/0015) |
| Server action admin appelée directement (POST) | Elevation | `requireRole('superadmin')` re-validé en tête de chaque action (T-04-ADMIN-WRITE) |
| Code vanity injection (`?ref` malicieux) | Tampering / Injection | Regex `^[A-Z0-9]{3,20}$` au middleware AVANT pose du cookie ; valeur paramétrée jamais concaténée |
| Reverse-tabnabbing (lien tx_hash → TronScan) | — | `target="_blank" rel="noopener noreferrer"` (T-04-EXTLINK, miroir (admin)/file) |
| Tampering du cookie `aff_ref` | Tampering | httpOnly (non lisible JS) ; même si forgé, le code inconnu → no-op à l'attribution (résolution DB) |

## Sources

### Primary (HIGH confidence — code réel du dépôt, lu en session)
- `supabase/migrations/0012_payments.sql` — RLS producteur-unique, `UNIQUE(tx_hash)`, RPC atomique `activate_subscription_for_payment` (modèle idempotence + RPC commission)
- `supabase/migrations/0009_subscriptions_gating.sql` — `subscriptions(status, current_period_end)`, `has_active_subscription()` (définition « actif »)
- `supabase/migrations/0008_profiles_role.sql` — `profiles.role` (member/affiliate/superadmin), `is_superadmin()`
- `supabase/migrations/0015_telegram_posts.sql` — `UNIQUE(dedupe_key)` idempotence, RLS sans policy write (modèle le plus récent)
- `supabase/migrations/0001_…sql` — trigger `handle_new_user` (preuve : ne voit pas le cookie → attribution server-action)
- `apps/web/src/middleware.ts` + `lib/supabase/middleware.ts` — middleware composé (point d'insertion captureRef, MUTER la response)
- `apps/web/src/app/[locale]/(auth)/actions.ts` — `signUp` (point d'attribution)
- `apps/web/src/app/(admin)/file/{page,actions}.tsx` — file de revue superadmin (modèle candidatures + payouts)
- `apps/web/src/app/(admin)/membres/actions.ts` — re-validation `requireRole`, service_role local, revoke pattern
- `apps/web/src/lib/auth/gate.ts` — `requireRole('affiliate'|'superadmin')`
- `apps/web/src/lib/supabase/admin-service.ts` — `createAdminServiceClient()` (service_role local web)
- `apps/jobs/src/{dispatch,runJob}.ts` + `jobs/outcome-tracker.ts` — job idempotent + `job_runs` (squelette commission)
- `packages/supabase/src/repositories/{payments,subscriptions}.ts` — service_role repos, `isUniqueViolation`, BigInt string
- `packages/supabase/src/database.types.ts` — convention override `*_atomic` string (CR-02)
- `.planning/phases/07-affiliation-paliers/07-{CONTEXT,UI-SPEC}.md` — décisions D-01..D-15, 4 surfaces, no-PII
- `package.json` (vérifiés) — `@tanstack/react-query@5.101.0` (apps/web), `luxon@3.7.2` (apps/jobs)

### Secondary (MEDIUM)
- `.planning/STATE.md` — décisions exécution P1–P6 (régénération types D-05-02-F, conventions migration MCP)
- `.planning/research/{STACK,ARCHITECTURE,PITFALLS}.md` (référencés CONTEXT) — Pitfall #5 RLS seule barrière

### Tertiary (LOW)
- Aucune. Phase 7 n'a nécessité aucune recherche web : zéro techno nouvelle, tout vérifié dans le code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zéro paquet nouveau, versions lues dans les `package.json` réels.
- Architecture: HIGH — chaque pattern lu dans le code livré (migrations 0008–0015, middleware, actions, jobs, repos).
- Pitfalls: HIGH — dérivés directement des conventions du dépôt (override types, régénération, RLS, TZ).
- Zones neuves (captureRef + attribution server-action + RPC commission): MEDIUM-HIGH — l'approche est dérivée des patterns existants mais n'a pas encore d'implémentation de référence dans CE dépôt (d'où §Open Questions sur 4 points de discrétion).

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (30 j — stack verrouillée, stable ; revérifier si une migration intercalaire change le numéro 0016 ou si P4 débloque les checkpoints LIVE en attente)
