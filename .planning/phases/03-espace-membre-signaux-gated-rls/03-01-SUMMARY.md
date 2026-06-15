---
phase: 03-espace-membre-signaux-gated-rls
plan: 01
subsystem: infra
tags: [supabase-realtime, rls, react-query, lightweight-charts, zod, i18n, shadcn]

# Dependency graph
requires:
  - phase: 01-socle-transverse
    provides: "RLS has_active_subscription() (0009/0010), client anon serveur/navigateur, i18n next-intl fr/en/ar a parite, groupe (member) + requireActiveSub"
  - phase: 02-vitrine-publique
    provides: "tokens de marque shadcn (globals.css), primitives ui/ (card/badge/dialog/dropdown-menu), <Disclaimer>, check-i18n-hardcoded"
provides:
  - "Realtime arme cote DB sur trade_setups (publication supabase_realtime + replica identity full) — MEMB-05 desormais verifiable"
  - "RLS candles gated sur has_active_subscription() (decision ALIGN, T-03-02) — coherence de la barriere payante"
  - "lightweight-charts 5.2.0 + @tanstack/react-query 5.101.0 au lockfile ; 4 primitives shadcn (tooltip/skeleton/select/collapsible)"
  - "QueryProvider react-query (repli realtime D-16)"
  - "searchParams Zod parse/serialize (anti-injection T-03-05, defaut sort=score D-08) + format prix/age purs (Intl)"
  - "namespaces i18n signals/signalDetail/glossary a parite stricte fr/en/ar"
affects: [03-02-liste-signaux, 03-03-detail-signal]

# Tech tracking
tech-stack:
  added: ["lightweight-charts@5.2.0", "@tanstack/react-query@5.101.0", "shadcn: tooltip/skeleton/select/collapsible"]
  patterns: ["Zod whitelist sur entree URL avant requete .eq/.in", "QueryClient memorise par useState dans un provider 'use client'", "Realtime gate = publication + replica identity full + RLS heritee par les events postgres_changes"]

key-files:
  created:
    - supabase/migrations/0011_realtime_trade_setups.sql
    - apps/web/src/lib/signals/searchParams.ts
    - apps/web/src/lib/signals/format.ts
    - apps/web/src/lib/signals/__tests__/searchParams.test.ts
    - apps/web/src/components/providers/QueryProvider.tsx
    - apps/web/src/components/ui/tooltip.tsx
    - apps/web/src/components/ui/skeleton.tsx
    - apps/web/src/components/ui/select.tsx
    - apps/web/src/components/ui/collapsible.tsx
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json

key-decisions:
  - "D-03-01-A : RLS candles tranchee = ALIGN sur has_active_subscription() (un authentifie non-abonne ne lit ni setups ni OHLCV)."
  - "D-03-01-B : ajout idempotent a supabase_realtime garde par pg_publication_tables (re-run sur) ; replica identity full pour porter l'old record sur UPDATE (D-14)."
  - "D-03-01-C : pas de regeneration de database.types.ts — 0011 n'ajoute aucune colonne ; gen types ne reflete ni RLS, ni replica identity, ni publication membership. Aucun commit vide."
  - "D-03-01-D : searchParams parse champ par champ via .safeParse — une valeur hors enum est ignoree (undefined), jamais propagee dans .eq/.in (T-03-05)."

patterns-established:
  - "Anti-injection URL : tout filtre traduit en .eq/.in passe par une whitelist z.enum ; asset reste une valeur parametree, jamais concatenee."
  - "Provider react-query : QueryClient cree une fois via useState, jamais au re-render (App Router)."
  - "Realtime DB : table en publication supabase_realtime + replica identity full ; la RLS de lecture filtre les events (un non-abonne ne recoit rien)."

requirements-completed: [MEMB-01, MEMB-02, MEMB-05]

# Metrics
duration: ~15min
completed: 2026-06-15
---

# Phase 3 Plan 01 : Socle DB + plumbing signaux Summary

**Realtime arme sur trade_setups (publication + replica identity full) avec RLS candles gatee, plus le plumbing front : libs verrouillees, QueryProvider, searchParams Zod anti-injection, format Intl, et i18n signals/signalDetail/glossary a parite fr/en/ar.**

## Performance

- **Duration:** ~15 min (segment final ; install + migration faites par les executeurs precedents)
- **Completed:** 2026-06-15
- **Tasks:** 3 (Task 1 + Task 2 par executeurs precedents, Task 3 + finalisation ici)
- **Files modified:** 14

## Accomplishments
- Migration 0011 appliquee live (publication supabase_realtime + replica identity full sur trade_setups ; RLS candles alignee sur has_active_subscription()) — MEMB-05 desormais verifiable.
- Libs verrouillees installees (lightweight-charts, react-query) + 4 primitives shadcn alignees sur la convention radix-ui unifiee ; recharts explicitement exclu.
- Utilitaires purs testes : searchParams Zod (round-trip, defaut score, rejet hors-enum) 10/10 verts ; format prix/age via Intl.
- QueryProvider react-query (repli realtime D-16).
- i18n signals/signalDetail/glossary a parite stricte fr/en/ar.

## Task Commits

1. **Task 1 : install libs + composants shadcn** - `2dde589` (feat) — executeur precedent
2. **Task 2 : migration 0011 realtime + RLS candles** - `e8df555` (feat) — executeur precedent ; appliquee live via MCP apply_migration par l'orchestrateur
3. **Task 3 (RED) : test searchParams** - `5a70533` (test)
4. **Task 3 (GREEN) : searchParams + format + QueryProvider + i18n** - `26a3c41` (feat)

**Plan metadata :** commit docs final (ce SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Files Created/Modified
- `supabase/migrations/0011_realtime_trade_setups.sql` - publication realtime + replica identity full + RLS candles gatee
- `apps/web/src/lib/signals/searchParams.ts` - parse/serialize Zod des filtres+tri (anti-injection)
- `apps/web/src/lib/signals/format.ts` - formatPrice/formatRelativeAge purs (Intl)
- `apps/web/src/lib/signals/__tests__/searchParams.test.ts` - 10 tests (round-trip, defaut, rejet hors-enum)
- `apps/web/src/components/providers/QueryProvider.tsx` - QueryClientProvider memorise
- `apps/web/src/components/ui/{tooltip,skeleton,select,collapsible}.tsx` - primitives shadcn
- `apps/web/src/messages/{fr,en,ar}.json` - namespaces signals/signalDetail/glossary
- `apps/web/package.json` + `pnpm-lock.yaml` - lightweight-charts + react-query

## Decisions Made
- **D-03-01-A (RLS candles = ALIGN)** : candles n'est plus lisible par tout `authenticated` (`using(true)`) mais uniquement par les abonnes actifs (`has_active_subscription()`). Coherence de la barriere payante ; un non-abonne ne lit ni setups ni OHLCV.
- **D-03-01-C (types non regeneres)** : la migration 0011 ne change aucune colonne. `supabase gen types` ne capture ni les RLS policies, ni la replica identity, ni la publication membership → `packages/supabase/src/database.types.ts` inchange. Aucun commit vide cree (conforme aux consignes). Note : le projet n'est pas `link`e localement (canal MCP `apply_migration` etabli, D-01-01-D) — `supabase gen types --linked` echoue par design, le fichier reste la source committee.

## Deviations from Plan

None - plan executed exactly as written. Les Tasks 1 et 2 (checkpoints blocking-human) avaient ete approuvees et executees par les executeurs precedents ; ce segment a repris a la regeneration des types puis a execute Task 3 (auto/TDD) tel quel.

## Issues Encountered
- `supabase gen types --linked` retourne « Cannot find project ref » (projet non `link`e localement). Attendu : le canal projet est MCP `apply_migration`, pas la CLI locale (D-01-01-D). La redirection avait vide le fichier de types ; restaure depuis sauvegarde et verifie identique a HEAD. Aucun changement de schema a committer.

## Verification Results
- `pnpm vitest run apps/web/src/lib/signals/__tests__/searchParams.test.ts` : **10/10 verts**.
- Parite i18n fr/en/ar sur signals/signalDetail/glossary : **OK**.
- `pnpm typecheck` (tsc -b --noEmit) : **0 erreur**.
- `pnpm lint:i18n` : **exit 0** (aucune chaine en dur).

## User Setup Required
None - migration deja appliquee live ; aucune nouvelle variable d'environnement.

## Next Phase Readiness
- Socle DB + plumbing pret : Realtime arme, libs/composants presents, utilitaires purs testes, i18n prete.
- Plans 03-02 (liste) et 03-03 (detail) peuvent composer en parallele (Wave 2).
- Rappel pour 03-02/03 : la frontiere producteur-unique impose la lecture front via le client anon uniquement ; ne jamais importer un repo service_role dans apps/web.

## Self-Check: PASSED

Tous les fichiers cles existent (migration 0011, searchParams + test + format, QueryProvider, 4 primitives shadcn). Tous les commits verifies (2dde589, e8df555, 5a70533, 26a3c41).

---
*Phase: 03-espace-membre-signaux-gated-rls*
*Completed: 2026-06-15*
