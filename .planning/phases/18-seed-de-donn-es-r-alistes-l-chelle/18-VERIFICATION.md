---
phase: 18-seed-de-donn-es-r-alistes-l-chelle
verified: 2026-06-25T18:05:00Z
status: human_needed
score: 8/8 structural truths verified (at-scale runtime proof = Manual-Only UAT)
overrides_applied: 0
re_verification:
human_verification:
  - test: "Run `pnpm seed` against LIVE Supabase at full scale (~10k users)"
    expected: "Seed completes; counts source='demo' > 0 on profiles/subscriptions/payments/analyses/trade_setups/prediction_outcomes/affiliates/commissions; no error; service_role never logged"
    why_human: "auth.admin.createUser cost at 10k users exceeds CI latency budget; deliberately deferred (VALIDATION.md §Manual-Only). Code is correct and runnable; only execution is human."
  - test: "Re-run `pnpm seed` a second time at full scale, compare COUNT(source='demo') run#1 vs run#2"
    expected: "COUNT identical across both runs (idempotence, no accumulation); COUNT(source='live') unchanged"
    why_human: "SEED-01 at-scale idempotence proof. seed.test.ts proves the mechanic at SEED_SCALE=0.005 but is skipIf(!HAS_ENV) — needs .env.test + network. Full-scale stability is Manual-Only."
  - test: "Provide .env.test (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY) and run `pnpm test -- seed-rls`"
    expected: "Both anon-client assertions pass: non-subscriber reads 0 trade_setups; user A reads 0 of user B's payments"
    why_human: "SEED-03 RLS runtime proof requires live anon round-trip; CI skips cleanly (skipIf). Structure verified by code read, runtime needs credentials."
  - test: "After seed: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr, then verify MRR > 0"
    expected: "mv_mrr non-empty; MRR/churn visible on admin dashboard"
    why_human: "Depends on LIVE index mv_mrr_month_idx (0017 Part B) and a populated payments cohort; observed outside unit suite. seed.ts calls refresh_mv_mrr() last but warns (does not mask) if index absent."
---

# Phase 18: Seed de données réalistes à l'échelle — Verification Report

**Phase Goal:** Peupler la DB LIVE avec une cohorte démo réaliste à l'échelle (~10k users + signaux/paiements/affiliés/outcomes), idempotente, FK-cohérente, labellisée `source='demo'`, gatée par une colonne de provenance — sans aucun chiffre de performance fabriqué et avec isolation RLS prouvée depuis un client anon.
**Verified:** 2026-06-25T18:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SEED-02: aucun champ de % de perf stocké dans le code seed | ✓ VERIFIED | `no-perf-seed-claims.test.ts` GREEN (dans les 621 passed). Scanne `apps/jobs/scripts/seed/**` réel (7 fichiers), 0 offender. Contrôle anti vacuous-green actif: `detectForbidden('win_rate: 0.9')===true` + 5 autres motifs assertés (L66-74). `prediction_outcomes` Row = `{outcome, realized_r, resolved_at, setup_id, source, candle_count}` — AUCUNE colonne win_rate/success_rate/expectancy (database.types.ts L377-384). |
| 2 | source='demo' sur chaque INSERT; purge ne touche que source='demo' | ✓ VERIFIED | `SEED_SOURCE='demo'` (config.ts L29) posé sur tous les inserts: profiles (users.ts L159), subscriptions L136, payments L83, analyses L128, trade_setups L181, prediction_outcomes L216, affiliates L101. purge.ts: `delete().eq('source','demo')` en ordre FK inverse (L50-57), JAMAIS TRUNCATE, auth.users purgés par domaine `.invalid` (L70-96). |
| 3 | SEED-03: isolation RLS assertée via client anon uniquement | ✓ VERIFIED (structural) | seed-rls.test.ts: les 2 `it()` lisent via `clientA` (anon/auth) — L102, L109. `adminClient()` (service_role) UNIQUEMENT en beforeAll/afterAll (fixtures/cleanup), jamais dans une assertion. Invariants: non-abonné → 0 trade_setups; A ne lit aucun payment de B. Runtime = Manual-Only (skipIf). |
| 4 | D-05: commissions calculées via RPC uniquement, jamais en JS | ✓ VERIFIED | affiliation.ts: `computeCommissions(client, period)` (L148) → RPC `compute_affiliate_commissions` (commissions.ts L39). payouts via `markCommissionPaid` RPC (L166). Zéro arithmétique de commission en TS. amount_atomic passé en string (L169, CR-02). |
| 5 | FK cohérence: chaîne analyses→trade_setups→prediction_outcomes sur ids réels; instruments réutilisés | ✓ VERIFIED | analyses insérées `.select('id')` → ids réutilisés pour trade_setups.analysis_id (signals.ts L164); setups `.select('id')` → prediction_outcomes.setup_id (L211). `readInstrumentIds` LIT les instruments (L89-97), throw si vide — JAMAIS de re-seed. |
| 6 | Sécurité: service_role confiné apps/jobs, fail-fast secrets, emails .invalid | ✓ VERIFIED | service_role lu depuis apps/jobs/.env (seed.ts L39-50); fail-fast si SUPABASE_URL/SERVICE_ROLE_KEY absent (L52-58); clé jamais loggée (commentaire L56 respecté). Emails `seed-{i}@demo.nexa.invalid` (config.ts L35,41 — RFC 2606). |
| 7 | SEED-01: mécanique idempotente (purge en tête, faker déterministe) | ✓ VERIFIED (structural) | purge() appelée en #1 de main() (seed.ts L71); FAKER_SEED=42 figé (config.ts L23); ordre de génération stable par index. seed.test.ts prouve COUNT stable 2 runs à SEED_SCALE=0.005 — skipIf(!HAS_ENV). At-scale = Manual-Only. |
| 8 | typecheck + suite de tests verts | ✓ VERIFIED | `pnpm typecheck` (tsc -b --noEmit) = 0 erreur. `pnpm test` = **621 passed, 9 skipped** (3 fichiers skipIf: affiliate-rls, seed-rls, seed.test — skip propre, attendu sans .env.test). |

**Score:** 8/8 structural truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0018_seed_source_column.sql` | colonne source + CHECK sur 8 tables; Part B index CONCURRENTLY commentés | ✓ VERIFIED | DDL Part A: 8 `alter table ... add column source text not null default 'live' check (...)`. Aucune policy RLS créée (T-18-01 respecté). Appliqué LIVE via MCP (commit 949111a). |
| `packages/supabase/src/database.types.ts` | source sur Row des 8 tables (preuve migration LIVE) | ✓ VERIFIED | Les 8 tables portent `source: string` en Row (régen depuis schéma LIVE). prediction_outcomes sans champ perf. |
| `apps/jobs/scripts/seed.ts` | orchestrateur ordre topologique, fail-fast | ✓ VERIFIED | purge→users→subs→payments→signals→affiliation→refresh_mv_mrr. fail-fast secrets. |
| `apps/jobs/scripts/seed/*.ts` | 7 modules (config/purge/users/subs/payments/signals/affiliation) | ✓ VERIFIED | Tous présents, substantifs, câblés dans seed.ts. |
| `apps/web/test/no-perf-seed-claims.test.ts` | scan statique SEED-02 + contrôle | ✓ VERIFIED | GREEN, détecteur non trivial. |
| `seed-rls.test.ts` / `seed.test.ts` | preuves RLS anon + idempotence (skipIf) | ✓ VERIFIED (structure) | Skip propre en CI; structure d'assertion complète et correcte. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| seed.ts | purge/users/subs/payments/signals/affiliation | imports + appels séquentiels | ✓ WIRED | main() L71-124 enchaîne les 7 étapes |
| affiliation.ts | RPC compute_affiliate_commissions | computeCommissions wrapper | ✓ WIRED | commissions.ts L39 |
| affiliation.ts | RPC mark_commission_paid | markCommissionPaid wrapper | ✓ WIRED | commissions.ts L66+ |
| signals.ts | instruments (réutilisés) | readInstrumentIds (SELECT, throw si vide) | ✓ WIRED | L89-97 |
| seed.ts | refresh_mv_mrr | rpc cast (EN DERNIER, warn si index absent) | ✓ WIRED | L112-124 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck monorepo | `pnpm typecheck` | 0 erreur | ✓ PASS |
| Suite complète | `pnpm test` | 621 passed / 9 skipped / 0 failed | ✓ PASS |
| Garde no-perf-seed (contrôle actif) | inclus dans suite | détecteur attrape win_rate/success_rate/expectancy/winRatePct | ✓ PASS |
| Seed à l'échelle LIVE | `pnpm seed` | non exécuté (Manual-Only par design) | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEED-01 | 18-02 | seed idempotent FK-cohérent, faker déterministe | MET (structural) | purge-en-tête + FAKER_SEED=42 + seed.test mécanique. At-scale = UAT. |
| SEED-02 | 18-01/03 | labellisation source + zéro % de perf fabriqué | MET | source='demo' partout; prediction_outcomes = outcomes bruts; scan statique GREEN. |
| SEED-03 | 18-01 | RLS re-testée depuis client anon | MET (structural) | seed-rls.test lecture anon-only; runtime = UAT. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Aucun TBD/FIXME/XXX; aucun stub; aucun secret hardcodé | ℹ️ Info | Code propre. `console.log` présents = logs CLI d'un script de seed (légitime, pas du code prod web). |

### Human Verification Required (Manual-Only UAT — attendu, NON pénalisant)

1. **Seed LIVE à l'échelle** — `pnpm seed` (~10k users). Attendu: succès, source='demo' > 0 sur les 8 tables, service_role jamais loggé.
2. **Idempotence à l'échelle** — re-run `pnpm seed`, COUNT(source='demo') identique run#1/run#2; COUNT(source='live') inchangé.
3. **Preuve RLS runtime** — fournir `.env.test` puis `pnpm test -- seed-rls`: non-abonné lit 0 trade_setups, A ne lit pas les payments de B.
4. **MRR mesuré** — REFRESH mv_mrr post-seed (index mv_mrr_month_idx requis), vérifier MRR > 0.

### Gaps Summary

Aucun gap bloquant. Toutes les garanties structurelles de SEED-01/02/03 sont vérifiées dans le code et confirmées par typecheck (0 erreur) + suite verte (621 passed). La colonne `source` existe LIVE sur les 8 tables (preuve: types régénérés). Le calcul de commissions est délégué au RPC (jamais JS, D-05). prediction_outcomes ne stocke que des outcomes bruts (`outcome`+`realized_r`) — zéro % de perf (SEED-02). La purge est sûre (source='demo' uniquement, jamais TRUNCATE, jamais live). Les lectures RLS assertées passent exclusivement par un client anon (SEED-03).

Le SEUL reste avant signature complète de la phase = les 4 vérifications **Manual-Only** documentées dans VALIDATION.md (exécution réelle du seed à l'échelle + idempotence + RLS runtime + MRR), délibérément différées hors CI (coût auth.admin.createUser à 10k users). Statut = `human_needed`, conforme au contrat de la phase — ce n'est PAS un échec.

---

_Verified: 2026-06-25T18:05:00Z_
_Verifier: Claude (gsd-verifier)_
