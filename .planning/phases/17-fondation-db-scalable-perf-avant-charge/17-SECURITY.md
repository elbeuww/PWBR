---
phase: 17
slug: fondation-db-scalable-perf-avant-charge
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-25
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (3 PLAN files with `<threat_model>` blocks) — verified CLOSED via the 17-03 LIVE gates (`get_advisors`, anon-client tests) and the 17-HUMAN-UAT Gate 7 (Broadcast, levé le 2026-06-25).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client anon → RLS Postgres | tout fetch front passe en client anon ; la RLS est la seule barrière non contournable | données de marché + journal privé (sensible) |
| matview → wrapper `get_mrr()` | les matviews n'ont PAS de RLS ; la garde `is_superadmin()` est dans la fonction SECURITY DEFINER | CA / MRR (confidentiel business) |
| `trade_setups` change → `realtime.messages` | fan-out Broadcast ; l'écoute est filtrée par RLS sur `realtime.messages` (`has_active_subscription()`) | signaux de trade (réservé abonnés) |
| navigateur → canal privé Broadcast | l'écoute du badge passe par un canal privé ; autorisation filtrée par la policy `realtime.messages` | events signaux (réservé abonnés actifs) |
| opérateur MCP → DB LIVE | application via `apply_migration`/`execute_sql` ; jamais `db push` ; jamais `service_role` côté pages | migration SQL 0017 |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-RLS | Elevation/Info Disclosure | drop/recreate policies (plan 17-01) | mitigate | drop/recreate par nom exact ; wrap n'ouvre jamais la lecture ; tests anon-client + `get_advisors(security)` verts post-migration (17-03) | closed |
| T-17-MV | Info Disclosure | `mv_mrr` (pas de RLS) | mitigate | wrapper `get_mrr()` SECURITY DEFINER gated `is_superadmin()` + `revoke all on mv_mrr from anon, authenticated` (gap-closure 17-03, advisor `materialized_view_in_api` levé) | closed |
| T-17-BC | Info Disclosure | `realtime.messages` (Broadcast) | mitigate | policy RLS `(select has_active_subscription())` ; non-abonné ne reçoit aucun event — prouvé UAT Gate 7 (session anon → 0 event) | closed |
| T-17-SP | Tampering/Elevation | nouvelles fonctions SECURITY DEFINER | mitigate | `set search_path = public` figé sur `get_mrr`/`refresh_mv_mrr`/`broadcast_trade_setup_changes` ; advisor `function_search_path_mutable` clean | closed |
| T-17-RF | Tampering | `refresh_mv_mrr()` appelable client | mitigate | `revoke execute from public, anon, authenticated` (service_role/job uniquement) | closed |
| T-17-BC-CLI | Info Disclosure | SignalList abonnement Broadcast | mitigate | canal privé + `setAuth` ; jamais `service_role` côté front ; filtrage abonné garanti par la policy `realtime.messages` ; vérifié UAT Gate 7 (abonné reçoit en direct) | closed |
| T-17-MV-TEST | Info Disclosure | `mrr-gating` test | mitigate | test anon-client nu (ANON_KEY) prouve `get_mrr()` → 0 ligne pour non-superadmin ; test assertif (plus de SKIP) — 617 passed (17-03) | closed |
| T-17-A4 | Tampering | mapping payload Broadcast | mitigate | lecture `payload.payload.record` (forme `broadcast_changes`) ; shape confirmé runtime UAT Gate 7 (UPDATE lit `record.status`) | closed |
| T-17-RLS-LIVE | Elevation/Info Disclosure | drop/recreate policies appliquées LIVE | mitigate | `get_advisors(security)` sans nouvelle alerte + tests anon-client (signals-rls/gating-rls) verts post-migration (gate 2 PASS) | closed |
| T-17-MV-LIVE | Info Disclosure | `mv_mrr` en prod | mitigate | `mrr-gating` test (non-superadmin → 0 ligne) vert + `get_mrr()` revoke public/anon confirmé LIVE | closed |
| T-17-BC-LIVE | Info Disclosure | Broadcast `realtime.messages` en prod | mitigate | UAT manuel : session anon ne reçoit aucun event ; policy active (Gate 7 ✅) | closed |
| T-17-IDX | Availability | index `CONCURRENTLY` échoue (INVALID) | mitigate | détection `indisvalid=false` après chaque `execute_sql` ; 0 INVALID en fin (gate 5 PASS) | closed |
| T-17-PUB | Availability | retrait publication casse un autre flux | mitigate | vérif A3 (`pg_publication_tables` + grep client) AVANT drop ; `trade_setups` = seul consommateur, migré vers Broadcast en 17-02 | closed |
| T-17-SC (17-01) | Tampering | installs npm/pip | accept | aucun install dans la phase (SQL natif) ; surface nulle | closed |
| T-17-SC (17-02/17-03) | Tampering | installs npm | accept | aucun install (`@supabase/supabase-js` + `vitest` déjà présents) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-SC | T-17-SC | Phase 100 % SQL/MCP — aucun nouvel install npm/pip, surface chaîne d'appro nulle | fondateur (Elbeuw) | 2026-06-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-25 | 15 | 15 | 0 | gsd-secure-phase (orchestrateur, short-circuit register-authored-at-plan-time) |

**Notes d'audit :**
- Registre construit au plan (3 blocs `<threat_model>` dans 17-01/17-02/17-03) → `register_authored_at_plan_time: true`.
- 2 fuites introduites par la migration 0017 ont été détectées par le gate `get_advisors(security)` (17-03) et fermées LIVE : (1) `mv_mrr` exposée via PostgREST (T-17-MV) → `revoke all` ; (2) `broadcast_trade_setup_changes()` appelable en RPC (T-17-SP / convention 0002) → `revoke execute`. Le fichier 0017 reflète l'état LIVE.
- Gate 7 (Broadcast Manual-Only) levé le 2026-06-25 : abonné reçoit en direct, non-abonné ne reçoit rien, shape `payload.payload.record` confirmé.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-25
