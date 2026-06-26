# Phase 19 : Dashboard utilisateur — Research

**Researched:** 2026-06-26
**Domain:** Next.js 15 App Router (RSC) + Supabase RLS — agrégation de surfaces membre + 1re écriture front (watchlist) + pagination keyset
**Confidence:** HIGH (tout est vérifié dans le codebase ; aucune dépendance externe nouvelle requise)

## Summary

Phase d'**agrégation brownfield**, pas de greenfield. Le gros du travail = monter un shell `(dash)` (sidebar desktop + bottom-nav mobile) qui **compose des composants déjà livrés** (`SignalList`, `ExpiryBanner`, `RevenueTabs`, surfaces abonnement/affiliation) sans les réimplémenter. Trois éléments réellement neufs : (1) la table `user_followed_setups` + RLS anti-IDOR (migration `0020`), (2) un helper de **curseur keyset** (aucun code n'existe — seuls les index DB sont posés en Phase 17), (3) la page **Paramètres** (UDASH-06). Tout le reste est du câblage.

La stack est verrouillée et **suffisante en l'état** : `@tanstack/react-query@5.101.0`, `sonner@2.0.7`, `lucide-react@1.18.0`, `zod@4.4.3` sont déjà installés. `@tanstack/react-table`, `@tanstack/react-virtual`, `nuqs` sont **absents** — la recherche conclut qu'**il ne faut PAS les ajouter** : le pattern URL-state custom Zod (`lib/signals/searchParams.ts`) couvre le besoin, les pages keyset chargent ~20 lignes (pas de virtualisation utile), et l'UI-SPEC impose explicitement « no new dependency ».

**Primary recommendation:** Réutiliser les patterns existants à 100 % ; n'ajouter aucun package npm. Construire 3 artefacts neufs uniquement : migration `0020` (table + RLS + index keyset CONCURRENTLY), un module `lib/keyset/` (encode/decode curseur `(created_at, id)`), et la surface `(dash)` qui agrège. La watchlist s'écrit via **anon-client RLS-scopé** (jamais service_role), `with check (user_id = (select auth.uid()))` = vraie barrière anti-IDOR.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Shell `(dash)` = sidebar latérale persistante (desktop) + bottom-nav (mobile), 6 onglets (overview, signaux suivis/historique, watchlist, abonnement, affiliation, paramètres). RTL-safe propriétés logiques. Pas de néon sur la nav (Tier App, P16 D-04/D-05).
- **D-02:** Agrégation = le shell monte les composants existants (`SignalList`, `RevenueTabs`, `ExpiryBanner`…). Zéro réimplémentation. Stub `/dashboard` (liste `instruments`) remplacé. Redirection des anciennes routes = discrétion planner.
- **D-03:** Gate `(dash)` = `requireUser` (auth seul). Pas de compte gratuit : un abonné **expiré** entre pour renouveler. Overview montre statut « expiré » + CTA renouvellement ; onglets signaux/watchlist affichent état « renouvelle » (RLS renvoie 0 ligne — barrière réelle, jamais le gate UX seul). État de **renouvellement**, pas un upsell « gratuit ».
- **D-04:** Modèle source unique : « Suivis » = watchlist de setups **ouverts** ; « Historique » = ces mêmes setups **clôturés** (avec issue). Une donnée : `user_followed_setups ⋈ trade_setups` filtré par statut. Scope strictement personnel. Pas de table view-log.
- **D-05:** Pagination **keyset** (curseur `(created_at desc, id desc)`) sur suivis + historique, alignée sur les index Phase 17. EXPLAIN attendu = index scan, pas seq+sort.
- **D-06:** Déclencheur watchlist = icône étoile/bookmark toggle sur chaque `SignalCard` (liste) ET dans le détail. Toggle **optimiste** (react-query).
- **D-07:** Table `user_followed_setups` (neuve) → migration `0020` via MCP `apply_migration`. Policies insert/delete/select scopées `user_id = (select auth.uid())` (wrap InitPlan ; colonne non wrappée — Pitfall 3). FK vers `trade_setups(id)` + `auth.users`/`profiles`. Index keyset `(user_id, created_at desc, id desc)` via `CONCURRENTLY`. Test anti-IDOR : client anon, non-propriétaire écrit 0 ligne d'autrui (pattern Phase 18 D-07).
- **D-08:** Overview = abonnement + ExpiryBanner J-3/J-1 en tête → 3-4 derniers signaux → raccourcis (watchlist, affiliation, paramètres).
- **D-09:** **Interdit : equity curve / P&L / ROI** (VITR-03). Tout % via `applyThreshold` + N + provenance.
- **D-10:** Affiliation dans le user-dash = **carte résumé uniquement** (X abonnés ramenés, Y revenus mesurés), affichée **seulement si l'user est affilié**, lien vers le dashboard affilié dédié (`affiliation/dashboard`, `requireRole('affiliate')`). Pas d'onglet plein.
- **D-11:** Paramètres = Compte (email affiché, changement mdp via Supabase auth) + Langue & préférences (sélecteur AR/EN/FR ; pas de toggle thème — `forcedTheme="dark"`) + préférences Notifications (UI seule) + lien gestion abonnement + bouton déconnexion.
- **D-12:** Notifications = stockage de préférences UI uniquement. Infra d'envoi (email/push) hors scope.

### Claude's Discretion
- Choix de redirection des anciennes routes vs conservation (D-02).
- Encodage/décodage exact du curseur keyset (module helper à construire).
- Décision libs : `react-table`/`react-virtual`/`nuqs` vs réutilisation du pattern URL-state custom existant — **tranchée ci-dessous : RÉUTILISER, ne rien ajouter**.

### Deferred Ideas (OUT OF SCOPE)
- **Programme de parrainage à récompense** (« inviter 10 amis = 2 mois gratuits ») — capacité distincte de l'affiliation. Tracking invitations, comptage palier, octroi crédit, garde-fous anti-abus, conformité promo MENA. Déféré à sa propre phase. **Ne pas amorcer.**
- **Infra de delivery des notifications** (email/push) — Phase 19 ne livre que l'UI de préférences.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UDASH-01 | Vue d'ensemble (état abonnement, derniers signaux, raccourcis) | Compose `ExpiryBanner` (existant) + `fetchActiveSignals(limit 3-4)` (existant) + cartes raccourci. Ordre figé D-08. RSC anon-client. |
| UDASH-02 | Signaux suivis + historique, paginés keyset | Source unique `user_followed_setups ⋈ trade_setups` filtré par `status` ; helper keyset neuf ; index `0020` (user_id, created_at desc, id desc). |
| UDASH-03 | Ajout/retrait watchlist (`user_followed_setups`, écriture scopée, anti-IDOR) | Table + RLS `0020` ; toggle optimiste react-query (déjà installé) ; insert/delete anon-client RLS-scopé ; test client anon 0-ligne. |
| UDASH-04 | Gestion abonnement (statut, expiration, alerte J-3/J-1 via ExpiryBanner) | `ExpiryBanner` existant (composant orphelin WIRING-01) + lecture `subscriptions.current_period_end` (pattern member/layout.tsx). |
| UDASH-05 | Tableau affiliation (abonnés ramenés, revenus mesurés) intégré | Carte résumé conditionnelle (D-10) lisant la vue `affiliate_dashboard` (security_invoker, no-PII) ; lien vers route affilié dédiée. `formatAtomic(BigInt)`. |
| UDASH-06 | Paramètres de compte | Page neuve : email affiché + `supabase.auth.updateUser({password})` + `LanguageSwitcher` existant + préférences notifications UI + signOut. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack verrouillée** : Next.js 15 (PAS 16), TypeScript strict, `@supabase/supabase-js 2.108.0`, `@supabase/ssr 0.12.0`, Tailwind v4 (config CSS-first, `bg-[var(--token)]` pas `bg-[--token]` — CR-01 P16), Zod v4, `@tanstack/react-query 5.101.0`.
- **Sécurité** : RLS = vraie barrière, jamais service_role côté pages membre (frontière producteur-unique). Aucun secret hardcodé. Validation entrées (Zod whitelist).
- **% TOUJOURS mesuré** (VITR-03/no-perf-claims) : aucun chiffre fabriqué ; `applyThreshold` + N + provenance.
- **i18n fr/en/ar à parité STRICTE de clés** (next-intl 4.13) + RTL via propriétés logiques (interdit `tailwindcss-rtl`).
- **Migrations** via MCP `apply_migration` (jamais `db push`) ; `CONCURRENTLY` hors tx via `execute_sql` ; puis `generate_typescript_types` → édition manuelle `database.types.ts` → `get_advisors`.
- **Tests** : Vitest cible 80 %, lecture RLS assertée TOUJOURS via anon-client (jamais service_role = faux vert).
- **Recherche d'abord** : préférer réutiliser l'existant à 80 % plutôt qu'écrire neuf — ici appliqué à la décision « pas de nouvelle lib ».

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gate `(dash)` `requireUser` | Frontend Server (RSC) | — | Porte UX ; `gate.ts` server-only, redirect avant rendu |
| Isolation des données (watchlist, signaux, subs) | Database (RLS Postgres) | — | Vraie barrière ; `with check`/`using` scopés `auth.uid()` / `has_active_subscription()` |
| Lecture overview/suivis/historique | Frontend Server (RSC) | Database (RLS) | RSC anon-client + cookies → RLS tranche ; SSR initialData |
| Toggle watchlist (écriture) | Browser (react-query mutation) | Database (RLS `with check`) | Optimiste D-06 ; insert/delete anon-client navigateur, RLS = anti-IDOR |
| Pagination keyset (curseur) | Frontend Server (RSC) | Database (index composite) | Curseur dans l'URL, requête `.lt()/.or()` sur index Phase 17 |
| Affiliation résumé | Frontend Server (RSC) | Database (vue `affiliate_dashboard`) | Lecture vue security_invoker scopée ; conditionnel `requireRole('affiliate')` |
| Changement mot de passe / signOut | Browser (Supabase Auth client) | — | `auth.updateUser` / `auth.signOut` côté client |

## Standard Stack

### Core (déjà installé — aucune action)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.x | App Router + RSC, route groups | Verrouillé CLAUDE.md [CITED: apps/web/package.json] |
| @supabase/supabase-js | 2.108.0 | Client DB/Auth/Realtime anon + service | Verrouillé [VERIFIED: apps/web/package.json] |
| @supabase/ssr | 0.12.0 | Auth cookies RSC/middleware | Verrouillé [VERIFIED: package.json] |
| @tanstack/react-query | 5.101.0 | Mutation optimiste watchlist + repli liste | Déjà monté via `QueryProvider`/`SignalList` [VERIFIED: package.json] |
| sonner | 2.0.7 | Toast rollback du toggle optimiste (UI-SPEC) | Déjà vendored (`components/ui/sonner`) [VERIFIED: package.json] |
| lucide-react | 1.18.0 | Icône `Star` du toggle watchlist | Présent — mais vérifier l'import (précédent P01 D-01-03-D : SVG inline si absent) [VERIFIED: package.json] |
| zod | 4.4.3 | Whitelist params URL (curseur, onglet) | Pattern `searchParams.ts` [VERIFIED: package.json] |
| next-intl | 4.13.0 | i18n fr/en/ar parité stricte | Verrouillé [VERIFIED: package.json] |

### Supporting (déjà vendored shadcn — `components/ui/*`)
Card, Badge, Table, Progress, Tooltip, Alert, Button, Sonner, Dialog, AlertDialog, DropdownMenu, Select, Skeleton, Tabs, Separator, Input, Label, Form. **Tous présents** (UI-SPEC Registry Safety) — aucun `shadcn add` requis sauf si un bloc manque à la vérification.

### Alternatives Considered — décision libs (Claude's Discretion → TRANCHÉE)
| Instead of (proposé roadmap) | Décision | Tradeoff |
|------------|----------|----------|
| `nuqs` | **NE PAS ajouter** | Le pattern `parseSignalsParams`/`serializeSignalsParams` (Zod whitelist, anti-injection T-03-05) est l'analogue maison établi. Étendre avec un param `cursor` + `tab`. Ajouter nuqs dédoublerait le pattern. |
| `@tanstack/react-table` | **NE PAS ajouter** | Suivis/Historique = grille de cartes (`SignalCard`) ou table simple ; tri/filtre déjà gérés serveur. react-table (headless, tri/filtre client) est surdimensionné pour une liste keyset paginée serveur. |
| `@tanstack/react-virtual` | **NE PAS ajouter** | La pagination keyset charge ~20 lignes/page (pas de liste infinie de 10k en DOM). Virtualisation = complexité sans gain. Si une vue « tout charger » émergeait en P20+, réévaluer. |

**Installation:** Aucune. `pnpm install` inchangé. Si un onglet exige un bloc shadcn manquant, l'ajouter via le pattern vendored existant (pas de registre tiers — `components.json` `"registries": {}`).

## Package Legitimacy Audit

**Aucun package externe installé dans cette phase.** La décision de recherche est de **ne rien ajouter** (réutilisation à 100 % de la stack verrouillée déjà auditée aux phases 01-18). Le slopcheck gate est donc **sans objet** (rien à vérifier).

| Package | Registry | Disposition |
|---------|----------|-------------|
| — | — | Aucun nouvel ajout (réutilisation stack verrouillée) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────────────────────────┐
   Requête membre  ─────▶│  middleware (i18n + updateSession cookies)    │
                         └───────────────────────┬──────────────────────┘
                                                 ▼
                    ┌─────────────────────────────────────────────────────┐
                    │  [locale]/(dash)/layout.tsx                          │
                    │   requireUser()  ── non-auth ──▶ redirect /login     │
                    │   lit subscriptions.current_period_end (anon RLS)    │
                    │   rend : <Sidebar/> + <BottomNav/> + <ExpiryBanner/> │
                    └───────────────────────────┬─────────────────────────┘
                                                 ▼  (children = onglet actif)
   ┌──────────────┬──────────────┬──────────────┬──────────────┬───────────────┐
   ▼              ▼              ▼              ▼              ▼               ▼
 overview      suivis/        watchlist      abonnement     affiliation     paramètres
 (RSC)         historique     (RSC liste +   (RSC,          (RSC, carte     (client:
  │            (RSC keyset)    toggle client) ExpiryBanner)  conditionnelle  auth.updateUser
  │               │              │               │           si affilié)     + signOut)
  │               │              │               │               │
  ▼               ▼              ▼               ▼               ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │  anon-client Supabase (cookies) ──▶ RLS Postgres = VRAIE BARRIÈRE         │
 │   • trade_setups : has_active_subscription()  (expiré → 0 ligne = D-03)   │
 │   • user_followed_setups : user_id = auth.uid()  (insert/del/select)      │
 │   • subscriptions : user_id = auth.uid()                                  │
 │   • affiliate_dashboard (vue security_invoker, no-PII)                    │
 └─────────────────────────────────────────────────────────────────────────┘
        ▲                                            ▲
        │ écriture watchlist                          │ index keyset (0017 posés / 0020 neuf)
   useMutation (optimiste)                       (created_at desc, id desc)
   insert/delete anon-client ─▶ RLS with check ─▶ rollback + toast si échec
```

### Recommended Project Structure
```
apps/web/src/
├── app/[locale]/(dash)/
│   ├── layout.tsx              # requireUser + shell (sidebar/bottom-nav) + ExpiryBanner
│   ├── page.tsx                # overview (UDASH-01) — redirect ou contenu racine
│   ├── suivis/page.tsx         # Suivis ouverts (UDASH-02, keyset)
│   ├── historique/page.tsx     # Historique clôturés + issue (UDASH-02, keyset)
│   ├── watchlist/page.tsx      # (peut fusionner avec suivis — décision planner)
│   ├── abonnement/page.tsx     # ré-héberge la surface (account)/abonnement ou redirige
│   └── parametres/page.tsx     # UDASH-06 (neuf)
├── components/dash/
│   ├── DashShell.tsx           # sidebar + bottom-nav (client, nav active sans glow D-01)
│   ├── WatchlistToggle.tsx     # étoile lucide, useMutation optimiste (client)
│   ├── AffiliateSummaryCard.tsx# carte résumé conditionnelle (D-10)
│   └── KeysetList.tsx          # liste paginée curseur (client ou RSC + lien ?cursor=)
├── lib/keyset/
│   └── cursor.ts               # encode/decode (created_at,id) — base64url, NEUF
└── lib/watchlist/
    └── queries.ts              # fetchFollowedSetups(status, cursor) + mutations
```

### Pattern 1 : Lecture RSC anon-client + RLS (réutilisation)
**What:** Toute lecture passe par `createClient()` serveur (anon + cookies). La RLS tranche.
**When to use:** Overview, suivis, historique, affiliation résumé.
**Example:**
```typescript
// Source: apps/web/src/app/[locale]/(member)/layout.tsx (pattern établi)
const supabase = await createClient() // anon SSR, jamais service_role
const { data: sub } = await supabase
  .from('subscriptions')
  .select('current_period_end')
  .eq('user_id', user.id)
  .eq('status', 'active')
  .order('current_period_end', { ascending: false })
  .limit(1)
  .maybeSingle()
```

### Pattern 2 : Toggle watchlist optimiste (NEUF, mais calqué sur SignalList browser-client)
**What:** Écriture front via anon-client navigateur, RLS `with check` = anti-IDOR. Optimiste.
**When to use:** Étoile sur `SignalCard` + détail (D-06).
**Example:**
```typescript
// 'use client' — calque SignalList.tsx (createClient browser + react-query)
import { createClient } from '@/lib/supabase/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const supabase = createClient()
const qc = useQueryClient()
const toggle = useMutation({
  mutationFn: async ({ setupId, followed }: { setupId: string; followed: boolean }) => {
    if (followed) {
      // user_id auto = default auth.uid() ; RLS with check rejette toute usurpation
      const { error } = await supabase.from('user_followed_setups').insert({ setup_id: setupId })
      if (error) throw error
    } else {
      const { error } = await supabase.from('user_followed_setups').delete().eq('setup_id', setupId)
      if (error) throw error
    }
  },
  onMutate: async (vars) => { /* flip optimiste du cache local */ },
  onError: (_e, _vars, ctx) => { /* rollback */ toast.error(t('watchlist.error')) },
})
```
> **Note sécurité :** ne PAS envoyer `user_id` depuis le client. La colonne porte `default (select auth.uid())` et la policy `with check (user_id = (select auth.uid()))` ; un client malveillant injectant `user_id` d'autrui est rejeté par le `with check` (0 ligne / erreur 42501). C'est la preuve anti-IDOR à tester.

### Pattern 3 : Curseur keyset (NEUF — aucun code n'existe)
**What:** Pagination par curseur `(created_at desc, id desc)` au lieu d'OFFSET.
**When to use:** Suivis + historique (D-05). Index posés Phase 17 (`trade_setups_keyset_idx`) + index neuf `0020` sur `user_followed_setups`.
**Example:**
```typescript
// lib/keyset/cursor.ts — encode/decode opaque base64url
export interface Cursor { createdAt: string; id: string }
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.createdAt, c.id])).toString('base64url')
}
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null
  try { const [createdAt, id] = JSON.parse(Buffer.from(raw, 'base64url').toString()); return { createdAt, id } }
  catch { return null } // curseur corrompu → première page (jamais throw)
}

// Requête PostgREST keyset : « la ligne suivante » après (createdAt, id)
// WHERE (created_at, id) < (cursor.createdAt, cursor.id)  en DESC
let q = supabase.from('user_followed_setups')
  .select('setup_id, created_at, trade_setups!inner(...)')
  .order('created_at', { ascending: false })
  .order('id', { ascending: false })
  .limit(PAGE_SIZE + 1) // +1 pour détecter « page suivante »
if (cursor) {
  // PostgREST: .or() émule le tuple-compare (created_at < X) OR (created_at = X AND id < Y)
  q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
}
```
> **EXPLAIN attendu (gate D-05) :** `Index Scan using user_followed_setups_keyset_idx`, PAS `Seq Scan + Sort`. Valider via MCP `execute_sql` post-migration (gabarit (b) du fichier 0017).

### Pattern 4 : Source unique Suivis/Historique (D-04)
**What:** Une seule table jointe, filtrée par statut. Pas de table view-log.
**Schéma de statut (vérifié) :** `trade_setups.status ∈ ('active','invalidated','expired')` (0006 L.71). `prediction_outcomes.outcome ∈ ('hit_tp','hit_sl','flat')` keyé sur `setup_id` (0014 L.29-31), lisible par authenticated.
- **Suivis** = `user_followed_setups ⋈ trade_setups WHERE status='active'`.
- **Historique** = `... WHERE status IN ('invalidated','expired')`, joint `prediction_outcomes` pour l'issue.
> **Barrière renouvellement (D-03) gratuite :** le join `trade_setups!inner` reste gardé par `has_active_subscription()`. Un abonné expiré lit ses lignes `user_followed_setups` mais le `!inner` les filtre toutes (trade_setups invisible) → 0 ligne. La RLS, pas le gate UX, applique l'état « renouvelle ».

### Anti-Patterns to Avoid
- **service_role côté page membre** — interdit (frontière producteur-unique). La watchlist s'écrit en anon-client RLS-scopé, PAS via une server action service_role (contrairement aux paiements, où le client ne doit pas choisir le montant ; ici, l'écriture EST la donnée de l'user).
- **Envoyer `user_id` depuis le client** — laisser le `default auth.uid()` + `with check`. Recevoir `user_id` du client = surface IDOR.
- **`bg-[--token]`** (Tailwind v4) — utiliser `bg-[var(--token)]` (CR-01 P16, dette persistante dans signaux/affiliation).
- **OFFSET pagination** — interdit D-05 (seq scan à l'échelle). Keyset uniquement.
- **Glow/néon sur la nav** — D-01/P16 : nav = lisibilité, accent réservé (CTA, item actif subtil, focus ring, étoile active).
- **Wrap de la colonne dans la policy** — `user_id = (select auth.uid())`, JAMAIS `(select user_id = auth.uid())` (Pitfall 3, P17).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rappel d'expiration J-3/J-1 | Nouveau bandeau | `components/member/ExpiryBanner.tsx` (existe, ICU plural, CTA `/tarifs`) | Composant orphelin (WIRING-01) à câbler, pas à recréer |
| Liste de signaux + Realtime | Nouvelle liste | `SignalList` + `SignalCard` + `QueryProvider` | Déjà gère react-query repli + Broadcast |
| Revenus affiliation | Calcul maison | vue `affiliate_dashboard` + `RevenueTabs` + `formatAtomic(BigInt)` | No-PII, montants atomiques, déjà mesurés |
| Gate auth/rôle | Guard inline | `lib/auth/gate.ts` (`requireUser`/`requireRole`) | Defense-in-depth, redirect localisé, `safeReturnTo` |
| Sélecteur de langue | Nouveau composant | `LanguageSwitcher` existant | i18n next-intl déjà câblé |
| Validation params URL | Parse manuel | `searchParams.ts` (Zod whitelist) — étendre avec `cursor`/`tab` | Anti-injection T-03-05 déjà couvert |
| State client react-query | Setup manuel | `QueryProvider` (useState QueryClient) | Pattern App Router correct déjà en place |

**Key insight:** Cette phase est à ~80 % du câblage de surfaces existantes. Le risque n'est pas « comment construire » mais « réimplémenter par accident » (interdit D-02). Localiser et monter, ne pas dupliquer.

## Runtime State Inventory

> Phase d'agrégation avec remplacement du stub `/dashboard` et nouvelle table — quelques éléments de state runtime.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Nouvelle table `user_followed_setups` — **non seedée** (Phase 18 D-07 confirme). Vide au démarrage. | Migration `0020` crée la table ; pas de migration de données (table neuve). |
| Live service config | Index keyset Phase 17 sur `trade_setups` **déjà posés LIVE** (0017 Partie B appliquée, REPRISE P17). L'index neuf de `user_followed_setups` est à poser CONCURRENTLY. | `execute_sql` CONCURRENTLY hors tx, vérifier `indisvalid`. |
| OS-registered state | Aucun (pas de cron/scheduler touché). | None — vérifié : phase front + 1 migration. |
| Secrets/env vars | Aucun nouveau secret. Réutilise cookies session anon + RLS. | None. |
| Build artifacts | `database.types.ts` devient stale après `0020` → régénérer via `generate_typescript_types` + édition manuelle (convention P17). Route `/dashboard` stub remplacée → liens/bookmarks internes vers `/dashboard` à re-pointer ou rediriger (D-02, discrétion planner). | Régénérer types ; auditer les liens `href="/dashboard"`. |

**Canonical question (après mise à jour de tous les fichiers) :** la seule state runtime résiduelle = la table neuve (vide, OK) + les types TS à régénérer + les liens vers l'ancien `/dashboard`. Aucun datastore externe ne porte d'ancien identifiant.

## Common Pitfalls

### Pitfall 1 : `with check` manquant ou mal scopé sur l'INSERT watchlist
**What goes wrong:** Une policy `for insert` sans `with check` (ou avec `using` seulement) laisse passer n'importe quel `user_id` → IDOR.
**Why it happens:** Confusion `using` (lecture/filtre) vs `with check` (validation écriture). INSERT n'utilise QUE `with check`.
**How to avoid:** `create policy "ufs: insérer la sienne" for insert to authenticated with check (user_id = (select auth.uid()))`. Colonne `user_id uuid not null default (select auth.uid())`. DELETE/SELECT : `using (user_id = (select auth.uid()))`.
**Warning signs:** Test anti-IDOR (client A insère pour user B) retourne succès au lieu de 0 ligne / 42501.

### Pitfall 2 : `CREATE INDEX CONCURRENTLY` dans `apply_migration`
**What goes wrong:** Erreur 25001 « cannot run inside a transaction block ».
**Why it happens:** `apply_migration` est transactionnel ; CONCURRENTLY l'interdit.
**How to avoid:** Table + RLS dans `apply_migration` (Partie A) ; l'index keyset CONCURRENTLY via `execute_sql` UN statement à la fois (Partie B), puis vérifier `indisvalid` (script gate (a) du 0017).
**Warning signs:** Index `indisvalid=false` non utilisé par le planner.

### Pitfall 3 : Wrap de la comparaison de colonne dans la RLS
**What goes wrong:** `(select user_id = auth.uid())` casse l'optimisation InitPlan et peut fausser la corrélation.
**How to avoid:** Wrapper UNIQUEMENT la fonction non corrélée : `user_id = (select auth.uid())` (P17 D-01, 0017 L.41-42).
**Warning signs:** `get_advisors(performance)` signale `auth_rls_initplan`.

### Pitfall 4 : Tuple-compare keyset mal traduit en PostgREST
**What goes wrong:** Utiliser seulement `.lt('created_at', X)` perd les lignes au même `created_at` (timestamps égaux après seed déterministe) → trous/doublons.
**How to avoid:** `.or('created_at.lt.X,and(created_at.eq.X,id.lt.Y)')` — tuple complet avec tiebreaker `id`. L'index `(created_at desc, id desc)` couvre exactement ce tri.
**Warning signs:** Lignes manquantes/dupliquées entre pages ; EXPLAIN montre un Sort.

### Pitfall 5 : Réimplémenter une surface au lieu de l'agréger
**What goes wrong:** Recréer une liste de signaux / un calcul de revenus → divergence avec la source de vérité + double maintenance.
**How to avoid:** D-02 strict. Monter `SignalList`/`RevenueTabs`/`ExpiryBanner`. Si un composant n'est pas réutilisable tel quel, l'adapter à la marge, pas le cloner.
**Warning signs:** Nouveau fichier qui duplique `lib/signals/queries.ts` ou recalcule `formatAtomic`.

### Pitfall 6 : Chiffre de performance fabriqué dans l'overview
**What goes wrong:** Ajouter un « +X % ce mois », equity curve, ou ROI → viole VITR-03 + promesse implicite.
**How to avoid:** D-09. Overview = abonnement + signaux + raccourcis. Aucun agrégat de gain. Affiliation = revenus MESURÉS (`formatAtomic`, vue) uniquement.
**Warning signs:** Tout `%` non issu d'`applyThreshold` + N + provenance.

### Pitfall 7 : `lucide-react` importé alors qu'absent/instable
**What goes wrong:** Précédent P01 D-01-03-D : `lucide-react` était absent → SVG inline. Ici il est présent (1.18.0) mais l'UI-SPEC demande de vérifier avant import.
**How to avoid:** Confirmer l'import `Star` se résout ; sinon SVG inline (hit-area ≥44px).

## Code Examples

### Migration 0020 — table + RLS anti-IDOR (gabarit, calqué 0016/0017)
```sql
-- 0020 : user_followed_setups (watchlist membre — 1re écriture front, UDASH-03).
create table public.user_followed_setups (
  user_id    uuid        not null default (select auth.uid()) references auth.users(id) on delete cascade,
  setup_id   uuid        not null references public.trade_setups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, setup_id)               -- idempotence : un seul follow par (user,setup)
);
alter table public.user_followed_setups enable row level security;

create policy "ufs: lire les siens" on public.user_followed_setups
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ufs: insérer la sienne" on public.user_followed_setups
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "ufs: supprimer la sienne" on public.user_followed_setups
  for delete to authenticated using (user_id = (select auth.uid()));

-- Partie B (execute_sql, CONCURRENTLY hors tx) :
-- create index concurrently user_followed_setups_keyset_idx
--   on public.user_followed_setups (user_id, created_at desc, id desc);
-- NOTE : pas de colonne `id` séparée → la PK est (user_id, setup_id). Pour le keyset,
-- ajouter soit une colonne `id uuid default gen_random_uuid()` comme tiebreaker stable,
-- soit utiliser setup_id comme tiebreaker. DÉCISION PLANNER : préférer une colonne `id`
-- dédiée alignée sur le pattern (created_at desc, id desc) des autres tables (cohérence
-- du helper keyset). Réévaluer la PK en conséquence.
```
> **Open question résolue à trancher au plan :** le keyset suppose un tiebreaker `id`. `user_followed_setups` n'a pas d'`id` naturel (PK composite). Recommandation : ajouter `id uuid not null default gen_random_uuid() unique` pour aligner le helper keyset générique, OU utiliser `setup_id` comme tiebreaker (plus simple, suffisant car unique par user). Le second évite une colonne ; trancher selon la réutilisabilité du helper.

### Changement de mot de passe (UDASH-06, client Supabase Auth)
```typescript
// 'use client'
const { error } = await supabase.auth.updateUser({ password: newPassword })
// + signOut : await supabase.auth.signOut() puis redirect localisé
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OFFSET pagination | Keyset cursor `(created_at,id)` | P17 (index posés) | Index scan O(log n), pas O(n) à 10k |
| postgres_changes filtré par subscriber | Broadcast topic fixe `new-signals` | P17 D-04 (0017) | `SignalList` déjà migré — réutiliser tel quel |
| `@supabase/auth-helpers` | `@supabase/ssr` | P01 | Déjà en place |
| `/dashboard` stub (liste instruments) | Shell `(dash)` agrégé | **Cette phase** | Remplace le stub |

**Deprecated/outdated:** Le stub `[locale]/dashboard/page.tsx` (liste `instruments`, non sub-gated, D-01-03-C) est remplacé. Décider redirection vs suppression (D-02).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `lucide-react@1.18.0` résout l'import `Star` sans souci | Stack/Pitfall 7 | Faible — fallback SVG inline documenté |
| A2 | Le join `trade_setups!inner` sous RLS `has_active_subscription()` filtre bien les lignes pour un abonné expiré (barrière D-03 gratuite) | Pattern 4 | Moyen — à VÉRIFIER live : si PostgREST applique la RLS de la table embarquée avant le `!inner`. Tester avec un user expiré. Sinon, filtrer explicitement côté requête. |
| A3 | Le tiebreaker keyset peut être `setup_id` (unique par user) à défaut d'`id` | Code Examples | Faible — alternative `id` dédiée documentée |
| A4 | PostgREST `.or(...and(...))` traduit correctement le tuple-compare keyset | Pattern 3/Pitfall 4 | Moyen — valider l'EXPLAIN + l'absence de trous entre pages sur seed |
| A5 | Aucune lib (nuqs/react-table/react-virtual) n'est nécessaire | Alternatives | Faible — réévaluable si volumétrie d'une vue explose |

## Open Questions (RESOLVED)

> Tranchées en planification (Phase 19). Résolutions inline ci-dessous.

1. **Tiebreaker keyset de `user_followed_setups`** (PK composite sans `id`) — **RESOLVED** : colonne `id uuid` dédiée tranchée en 19-01 T1 (helper keyset générique cross-table).
   - Connu : keyset exige un ordre total stable `(created_at, tiebreaker)`.
   - Inconnu : `id` dédié vs `setup_id`.
   - Recommandation : `setup_id` (unique par user, zéro colonne ajoutée) sauf si le helper keyset doit rester générique cross-table → alors `id uuid`.
2. **RLS sur join embarqué pour l'abonné expiré (A2)** — **RESOLVED** : géré comme risque accepté avec gate Manual-Only (cf. `19-VALIDATION.md`) + fallback documenté (menaces T-19-11/T-19-26) — test live abonné expiré → 0 ligne attendu ; sinon filtre serveur explicite + état « renouvelle ».
   - Connu : RLS `trade_setups` = `has_active_subscription()`.
   - Inconnu (résiduel, validé live) : comportement exact PostgREST `!inner` + RLS embarquée pour un expiré.
3. **Redirection des anciennes routes** (`/dashboard`, `(member)/signaux`, `(account)/abonnement`) vs conservation — **RESOLVED** : rediriger `/dashboard` → `(dash)` (19-05 T3), router watchlist → Suivis (19-07 T3), conserver `(member)`/`(account)` comme surfaces réutilisées montées dans le shell. Gate `(dash)` reste `requireUser`, gate `(member)` `requireActiveSub` non affaibli.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase MCP (`apply_migration`/`execute_sql`/`generate_typescript_types`/`get_advisors`) | Migration 0020 + index + types + advisors | ✓ | connecté | — |
| Vitest | Tests anti-IDOR + keyset | ✓ | 4.1.8 (root) | — |
| `.env.test` (URL + ANON_KEY + SERVICE_ROLE_KEY) | Tests RLS live (anti-IDOR) | ⚠ conditionnel | — | `describe.skipIf(!HAS_ENV)` (pattern seed-rls.test.ts) — structure complète, SKIP sans creds |
| Playwright | E2E (P21, hors phase) | ✓ | 1.60.0 | — |

**Missing dependencies with no fallback:** aucune.
**Missing dependencies with fallback:** tests RLS live nécessitent `.env.test` + réseau ; sinon SKIP propre (pattern établi).

## Validation Architecture

> `nyquist_validation: true` → section incluse.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (root `package.json`, `test: vitest run`) |
| Config file | racine (workspace) — voir `packages/supabase/__tests__/*` + `apps/web/test/*` |
| Quick run command | `pnpm vitest run <fichier>` |
| Full suite command | `pnpm test` (617 tests verts au dernier état P17) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UDASH-03 | Non-propriétaire écrit 0 ligne d'autrui (anti-IDOR insert) | integration (RLS live, anon-client) | `pnpm vitest run packages/supabase/.../user-followed-rls.test.ts` | ❌ Wave 0 (calquer seed-rls.test.ts) |
| UDASH-03 | Abonné lit/insère/supprime SA watchlist | integration | idem | ❌ Wave 0 |
| UDASH-02 | Curseur keyset : encode/decode round-trip + curseur corrompu → null | unit | `pnpm vitest run apps/web/.../cursor.test.ts` | ❌ Wave 0 |
| UDASH-02 | Pas de trou/doublon entre 2 pages keyset (timestamps égaux) | integration | idem RLS file | ❌ Wave 0 |
| UDASH-02 | EXPLAIN keyset = Index Scan (pas Seq+Sort) | DB gate (manuel MCP) | `execute_sql` EXPLAIN (gabarit 0017 (b)) | ❌ gate manuel |
| UDASH-01 | Overview ne rend AUCUN chiffre de perf fabriqué | unit (no-perf-claims) | `pnpm vitest run apps/web/test/no-perf-seed-claims.test.ts` (étendre) | ⚠ existe, étendre |
| UDASH-03 | Toggle optimiste : rollback + toast si erreur | unit (composant, mock mutation) | `pnpm vitest run apps/web/.../WatchlistToggle.test.tsx` | ❌ Wave 0 |
| UDASH-04 | ExpiryBanner rendu dans le shell (anti-orphelin WIRING-01) | unit/intégration rendu | assert présence dans layout `(dash)` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run <fichier touché>`
- **Per wave merge:** `pnpm test` (suite complète) + `pnpm tsc --noEmit` (typecheck vert)
- **Phase gate:** suite verte + `get_advisors(performance)` 0 `auth_rls_initplan` + `get_advisors(security)` 0 nouvelle alerte + EXPLAIN keyset Index Scan, avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/supabase/.../__tests__/user-followed-rls.test.ts` — anti-IDOR insert/delete/select (calquer `seed-rls.test.ts`, `describe.skipIf(!HAS_ENV)`)
- [ ] `apps/web/src/lib/keyset/__tests__/cursor.test.ts` — round-trip + curseur corrompu
- [ ] `apps/web/src/components/dash/__tests__/WatchlistToggle.test.tsx` — optimiste + rollback
- [ ] DB gate manuel : EXPLAIN keyset + advisors (MCP, non automatisable en Vitest)
- [ ] Étendre `no-perf-seed-claims.test.ts` pour couvrir l'overview `(dash)`

## Security Domain

> `security_enforcement` non désactivé → section incluse. UDASH-03 = 1re écriture front membre = modèle de menace prioritaire.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Frontière producteur-unique : anon-client RLS côté pages, jamais service_role |
| V2 Authentication | yes | `requireUser` (`getUser()` token revalidé serveur) ; `auth.updateUser`/`signOut` (UDASH-06) |
| V3 Session Management | yes | Cookies `@supabase/ssr` ; `realtime.setAuth()` pour le canal privé |
| V4 Access Control | **yes (critique)** | RLS `user_id = (select auth.uid())` `with check` sur INSERT (anti-IDOR UDASH-03) ; `has_active_subscription()` (barrière renouvellement D-03) ; `requireRole('affiliate')` (D-10) |
| V5 Input Validation | yes | Zod whitelist params URL (curseur/tab) ; curseur corrompu → null, jamais throw ; pas de `user_id` reçu du client |
| V6 Cryptography | no | Aucune crypto custom ; curseur = encodage base64url opaque (pas un secret) |

### Known Threat Patterns for Next.js 15 + Supabase RLS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR write (insérer/supprimer la watchlist d'autrui) | Tampering/Elevation | `with check (user_id = (select auth.uid()))` + `default auth.uid()` ; ne jamais recevoir `user_id` du client ; test anon-client 0-ligne |
| Gate UX contourné (accès direct API) | Elevation | RLS = vraie barrière, gate UX = défense en profondeur seulement (D-03) |
| Abonné expiré lit des signaux | Info Disclosure | `has_active_subscription()` sur `trade_setups` + `!inner` (vérifier A2) |
| Fuite PII affiliation | Info Disclosure | vue `affiliate_dashboard` security_invoker no-PII, agrégats seuls (D-10) |
| Injection via params URL (curseur/filtre) | Tampering | Zod whitelist + valeurs paramétrées PostgREST `.eq/.lt/.or`, jamais concaténation SQL |
| service_role exposé côté page | Elevation | ESLint `no-restricted-imports` (frontière) ; aucun import service-client dans `(dash)` |
| Curseur falsifié (sauter des lignes) | Tampering | Curseur opaque base64url ; même falsifié, RLS scope toujours à `auth.uid()` → pas d'élévation, juste un offset incohérent (dégradation gracieuse) |

## Sources

### Primary (HIGH confidence)
- Codebase NEXA (lecture directe) — `apps/web/package.json`, `lib/auth/gate.ts`, `lib/signals/{queries,searchParams}.ts`, `components/member/ExpiryBanner.tsx`, `components/signals/{SignalList,SignalCard}.tsx`, `components/providers/QueryProvider.tsx`, `(member)/layout.tsx`, `(account)/abonnement/{page,actions}.ts`, `affiliation/dashboard/page.tsx`, `supabase/migrations/{0006,0014,0017}.sql`, `packages/supabase/.../seed-rls.test.ts` — [VERIFIED: codebase]
- `.planning/phases/19-dashboard-utilisateur/19-CONTEXT.md` + `19-UI-SPEC.md` — décisions D-01..D-12, contrat UI — [VERIFIED: project docs]
- `.planning/STATE.md` — REPRISE P17 (index keyset LIVE), dette WIRING-01, conventions migration — [VERIFIED: project docs]
- `.planning/REQUIREMENTS.md` — UDASH-01..06 — [VERIFIED: project docs]
- `.planning/config.json` — `nyquist_validation: true` — [VERIFIED: config]

### Secondary (MEDIUM confidence)
- Décisions phases 16/17/18 (CONTEXT) — patterns RLS InitPlan, Broadcast, anti-IDOR seed — [CITED: phase CONTEXT files]

### Tertiary (LOW confidence)
- Comportement PostgREST `!inner` + RLS embarquée pour un abonné expiré (A2) — à vérifier live.
- Traduction tuple-compare keyset via `.or()/.and()` PostgREST (A4) — valider par EXPLAIN.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tout lu dans `package.json` + usages réels ; décision « no new lib » alignée UI-SPEC + CLAUDE.md.
- Architecture: HIGH — patterns RSC anon-client/RLS, react-query, ExpiryBanner, gate.ts tous établis dans le code.
- Pitfalls: HIGH — issus des migrations réelles (0006/0014/0017) et décisions P17/P18.
- Keyset/PostgREST tuple-compare: MEDIUM — gabarit correct mais à valider par EXPLAIN + test pages.
- RLS embarquée abonné expiré: MEDIUM — A2 à confirmer live.

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable — stack verrouillée, brownfield ; re-vérifier seulement si la stack bouge)
