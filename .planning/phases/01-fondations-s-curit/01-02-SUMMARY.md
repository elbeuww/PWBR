---
phase: 01-fondations-s-curit
plan: "02"
subsystem: auth-rls
tags: [supabase, next15, rls, auth, ssr, server-only, eslint, tdd]

# Dependency graph
requires: ["01-01"]
provides:
  - Migration SQL 0001 (3 tables profiles/instruments/job_runs + RLS + trigger handle_new_user)
  - packages/supabase : clients anon (browser/server) + service_role (server-only) + repositories typés
  - apps/web : Next 15 auth SSR (signup/login/middleware/dashboard) + E2E test (RED)
  - Test intégration RLS cross-user (RED en attente push schéma + .env)
affects: [jobs-ingestion, core-indicators, auth-rls]

# Tech tracking
tech-stack:
  added:
    - "@supabase/ssr@0.12.0"
    - "@supabase/supabase-js@2.108.0"
    - "server-only@0.0.1"
    - "next@15"
    - "react@19"
    - "zod@4.4.3"
  patterns:
    - "Trois clients Supabase distincts (browser/server/middleware) — jamais interchangés"
    - "getUser() côté serveur, jamais getSession() (T-03)"
    - "cookies getAll/setAll (non dépréciés)"
    - "import 'server-only' en première ligne de service-client.ts (T-01)"
    - "Trigger SECURITY DEFINER avec SET search_path = '' (T-04)"
    - "RLS ENABLE + policy explicite par table — deny par défaut sans policy (Pitfall 3)"
    - "Repository pattern : client Supabase passé en argument (testable)"

key-files:
  created:
    - supabase/migrations/0001_init_profiles_instruments_job_runs.sql
    - packages/supabase/src/database.types.ts
    - packages/supabase/src/anon-client.ts
    - packages/supabase/src/service-client.ts
    - packages/supabase/src/repositories/instruments.ts
    - packages/supabase/src/repositories/profiles.ts
    - packages/supabase/src/repositories/jobRuns.ts
    - packages/supabase/__tests__/rls.test.ts
    - apps/web/next.config.ts
    - apps/web/tsconfig.json
    - apps/web/middleware.ts
    - apps/web/src/lib/supabase/client.ts
    - apps/web/src/lib/supabase/server.ts
    - apps/web/src/lib/supabase/middleware.ts
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/(auth)/actions.ts
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/(auth)/signup/page.tsx
    - apps/web/src/app/dashboard/page.tsx
    - apps/web/e2e/auth.spec.ts
  modified:
    - packages/supabase/package.json (ajout deps @supabase/*)
    - packages/supabase/src/index.ts (barrel clients + types + repositories)
    - packages/supabase/tsconfig.json (nouveau)
    - apps/web/package.json (ajout deps + @app/supabase workspace:*)

key-decisions:
  - "database.types.ts écrits à la main (déviation : gen types différé — Supabase non connecté en session)"
  - "updateSession placé dans apps/web/src/lib/supabase/middleware.ts (pas dans packages/supabase) — évite dep next dans le package partagé"
  - "createServerSupabaseClient implémenté directement dans apps/web/src/lib/supabase/server.ts (même raison : types ReadonlyRequestCookies propres à next/headers)"
  - "Server Actions void (pas de retour d'erreur UI en Phase 1 — Phase 5 = design)"

# Metrics
duration: ~120min
completed: "2026-06-10"
status: "IN_PROGRESS — paused at checkpoint:human-action"
tasks_completed: 3
tasks_total: 5
---

# Phase 1 Plan 02: Auth + RLS Supabase Summary

**Migration SQL 3 tables (profiles/instruments/job_runs) + RLS + trigger, packages/supabase clients typés (anon + service_role isolé), apps/web Next 15 auth SSR câblée — paused au checkpoint human-action (credentials Supabase requis)**

## Status

**PLAN EN COURS — paused au checkpoint:human-action (Task 4)**

Tasks 1-3 exécutées et commitées. Tasks 4-5 nécessitent les credentials Supabase (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY) et la désactivation de "Confirm email" dans le Dashboard.

## Performance

- **Duration (partiel):** ~120 min (Tasks 1-3)
- **Started:** 2026-06-10
- **Tasks completed:** 3/5 auto (+ 1 checkpoint:human-action atteint)
- **Files created/modified:** 22

## Accomplishments

- Migration SQL complète : 3 tables, 3 `ENABLE ROW LEVEL SECURITY`, policies cross-user, trigger `handle_new_user` SECURITY DEFINER avec `SET search_path = ''` (T-04), seed 3 instruments
- Package `@app/supabase` : clients anon (browser/server) + service_role isolé (`import 'server-only'` en première ligne, T-01/D-07) + repositories instruments/profiles/jobRuns
- App web Next 15 compilable : middleware `updateSession(getUser())`, Server Actions signup/signIn, dashboard RSC protégé + redirect vers /login
- Tests RED en place : `rls.test.ts` (intégration RLS cross-user) + `auth.spec.ts` (E2E signup/session) — deviendront GREEN après push schéma + remplissage .env

## Task Commits

1. **Task 1 RED: migration SQL + test RLS** - `a5841ee` (test)
2. **Task 2: packages/supabase clients + repositories** - `e034d2e` (feat)
3. **Task 3 RED: apps/web scaffold auth SSR + E2E** - `13106f9` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `database.types.ts` écrit à la main (déviation critique)**
- **Found during:** Task 2
- **Issue:** Le plan prévoyait `supabase gen types typescript --linked` ou le MCP Supabase `generate_typescript_types`. La session n'a pas accès au projet Supabase (credentials non fournis — c'est l'objet du checkpoint).
- **Fix:** Types écrits à la main en reproduisant fidèlement le schéma de la migration 0001 (3 tables, types SQL → TS, Row/Insert/Update, enums broker/asset_class/status).
- **Regénération:** Après push schéma, exécuter `supabase gen types typescript --linked > packages/supabase/src/database.types.ts` pour remplacer ces types manuels par les types officiels.
- **Files modified:** `packages/supabase/src/database.types.ts`

**2. [Rule 1 - Bug] `updateSession` déplacé de `packages/supabase` vers `apps/web`**
- **Found during:** Task 2 (typecheck)
- **Issue:** La version initiale de `anon-client.ts` importait `next/server` (NextRequest/NextResponse) depuis le package partagé `@app/supabase`, qui n'a pas `next` comme dépendance.
- **Fix:** `updateSession` implémenté directement dans `apps/web/src/lib/supabase/middleware.ts`. Le barrel `@app/supabase` n'exporte pas cette fonction.
- **Files modified:** `packages/supabase/src/anon-client.ts`, `apps/web/src/lib/supabase/middleware.ts`

**3. [Rule 1 - Bug] `createServerSupabaseClient` remplacé dans apps/web/server.ts**
- **Found during:** Task 3 (typecheck)
- **Issue:** L'interface `CookieStore` de `packages/supabase` n'était pas compatible avec `ReadonlyRequestCookies` de Next (signature `set` différente avec `exactOptionalPropertyTypes: true`).
- **Fix:** `createClient()` dans `apps/web/src/lib/supabase/server.ts` utilise `createServerClient` directement depuis `@supabase/ssr` avec le type natif Next, évitant la coercition de type.
- **Files modified:** `apps/web/src/lib/supabase/server.ts`

**4. [Rule 1 - Bug] Server Actions retournent `void` (pas `AuthActionResult`)**
- **Found during:** Task 3 (typecheck)
- **Issue:** Les Server Actions câblées à `form action={signUp}` doivent retourner `void | Promise<void>` — retourner `AuthActionResult` cause une erreur TS.
- **Fix:** Actions retournent `void`, erreurs redirigées via `redirect('/signup?error=...')`. Feedback UI propre prévu en Phase 5.
- **Files modified:** `apps/web/src/app/(auth)/actions.ts`

**5. [Rule 1 - Bug] tsconfig.json rootDir corrigé (`"."` au lieu de `"./src"`)**
- **Found during:** Task 2 (typecheck)
- **Issue:** `rootDir: './src'` rejetait les fichiers `__tests__/*.ts` hors de `src/`.
- **Fix:** `rootDir: '.'` couvre `src/` et `__tests__/`.
- **Files modified:** `packages/supabase/tsconfig.json`

## Known Stubs

**database.types.ts (manuel)** — À regénérer après push schéma :
- `packages/supabase/src/database.types.ts` : types écrits manuellement, valides mais non officiels. Regénérer via `supabase gen types typescript --linked`.

## Tasks restantes (après checkpoint)

- **Task 4 (checkpoint:human-action)** : Fournir credentials Supabase + remplir `.env.local` + désactiver "Confirm email"
- **Task 5 (checkpoint:human-verify)** : Pousser la migration 0001 sur le projet cloud + vérifier `get_advisors`
- **Task 6 (auto tdd=true GREEN)** : Exécuter rls.test.ts (vert) + auth.spec.ts (vert) + fixture lint AUTH-03

## Checkpoint Atteint

**Type:** human-action (gate: blocking-human)
**Bloquant:** credentials Supabase + configuration Dashboard

**Actions requises par l'utilisateur :**
1. Supabase Dashboard → Project Settings → API → copier Project URL et anon key
2. Remplir `apps/web/.env.local` : `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (jamais SERVICE_ROLE ici)
3. Créer `apps/jobs/.env` (sera utilisé au plan 03) : `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
4. Dashboard → Authentication → Providers → Email → mettre "Confirm email" sur OFF (D-02)
5. Signal de reprise : taper "approved"

## Threat Surface Scan

Aucun périmètre de sécurité hors du threat_model identifié. Toutes les menaces T-01 à T-06 sont adressées structurellement :

- **T-01** (service_role dans bundle web) : double barrière en place (`import 'server-only'` + ESLint `no-restricted-imports`)
- **T-02** (RLS désactivée) : 3 × `ENABLE ROW LEVEL SECURITY` + policies explicites + `get_advisors` gate (checkpoint human-verify)
- **T-03** (getSession côté serveur) : grep gate vérifié → 0 occurrence non commentée dans apps/web
- **T-04** (trigger search_path) : `SET search_path = ''` présent dans handle_new_user
- **T-05** (signup cassé par trigger) : schema profiles minimal (id/email/created_at), E2E signup prévu
- **T-06** (secrets commités) : `.env.local` gitignored, `.env.example` sans valeur, SERVICE_ROLE absent du .env.local web

## Threat Flags

Aucun nouveau périmètre de sécurité non prévu dans le threat_model.

## Self-Check

Vérification des commits :
- a5841ee (test Task 1 RED) : `git log --oneline | grep a5841ee` → présent
- e034d2e (feat Task 2) : présent
- 13106f9 (test Task 3 RED) : présent

Vérification des fichiers clés :
- `supabase/migrations/0001_init_profiles_instruments_job_runs.sql` : présent
- `packages/supabase/src/service-client.ts` : présent (import 'server-only' ligne 4)
- `apps/web/middleware.ts` : présent (appelle updateSession)
- `apps/web/e2e/auth.spec.ts` : présent
- `packages/supabase/__tests__/rls.test.ts` : présent

Vérification critères critiques :
- `grep -c "enable row level security" migration` → 3 ✓
- `grep "set search_path" migration` → présent ✓
- `grep "after insert on auth.users" migration` → présent ✓
- `grep "for insert" migration` → aucune (job_runs) ✓
- `grep -n "server-only" service-client.ts` → ligne 4 ✓
- `grep "getSession" apps/web/src apps/web/middleware.ts | grep -v getUser | grep -c getSession` → 0 ✓
- `grep "SERVICE_ROLE" apps/web/.env.local` → absent ✓
- `grep "transpilePackages" apps/web/next.config.ts` → @app/core + @app/supabase ✓
- `pnpm typecheck (packages/supabase)` → clean ✓
- `pnpm typecheck (apps/web)` → clean ✓

## Self-Check: PASSED

---
*Phase: 01-fondations-s-curit*
*Plan: 02 — PAUSED at checkpoint:human-action*
*Tasks: 3/5 completed*
