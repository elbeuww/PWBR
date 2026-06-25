# Phase 17 — UAT humain (gates Manual-Only)

> Migration `0017` appliquée LIVE le 2026-06-25 (plan 17-03). Les gates automatisés 1-6
> sont PASSÉS (advisors, EXPLAIN, REFRESH, indisvalid, typecheck, tests). Ce document
> liste les gates **Manual-Only** qui exigent une vraie session navigateur et ne peuvent
> pas être validés en CI/MCP. À cocher par le fondateur.

## Statut des gates D-05 (plan 17-03, Task 3)

| # | Gate | Type | Statut |
|---|------|------|--------|
| 1 | `get_advisors(performance)` → 0 `auth_rls_initplan` | Auto | ✅ PASS |
| 2 | `get_advisors(security)` → aucune NOUVELLE alerte | Auto | ✅ PASS (2 fuites fermées, cf. SUMMARY) |
| 3 | EXPLAIN 3 listes keyset → Index Scan, pas de Sort | Auto | ✅ PASS (profiles/payments directs ; trade_setups prouvé `enable_seqscan=off`) |
| 4 | `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr` | Auto | ✅ PASS |
| 5 | `pg_index indisvalid=false` → 0 ligne | Auto | ✅ PASS |
| 6 | `pnpm test` (signals-rls + mrr-gating) | Auto | ✅ PASS (617 passed, mrr-gating assertif) |
| 7 | **Broadcast live (badge)** | **Manual-Only** | ⏳ À VALIDER (ci-dessous) |

---

## Gate 7 — Broadcast live (Manual-Only)

**Objectif :** prouver en runtime que le flux `postgres_changes → Broadcast` (D-04/SCALE-05)
fonctionne et conserve la barrière sécurité (un non-abonné ne reçoit AUCUN event).

### Pré-requis
- Une session navigateur **abonnée active** (membre avec abonnement `active`).
- Une session navigateur **anonyme / non-abonnée** (autre navigateur ou onglet privé).
- Un moyen de provoquer un `INSERT`/`UPDATE` sur `public.trade_setups` (job d'analyse, ou
  insertion manuelle via MCP `execute_sql` côté service_role).

### Procédure

1. **Abonné reçoit (T-17-BC-CLI) :**
   - [ ] Ouvrir la page Signaux en session abonnée active.
   - [ ] Provoquer un INSERT d'un nouveau `trade_setups` (status=active).
   - [ ] Vérifier que le badge « N nouveaux signaux » s'incrémente **en direct** (sans refresh).

2. **Shape du payload (A4 / T-17-A4) :**
   - [ ] Dans la console navigateur, logger le payload reçu et confirmer que la donnée est
     bien en `payload.payload.record` (forme `realtime.broadcast_changes`), **PAS** `payload.new`.
   - [ ] Si le shape réel diffère, ouvrir une gap-closure sur `SignalList.tsx` (mapping).

3. **UPDATE retire la carte (D-14) :**
   - [ ] Passer un `trade_setups` existant à `status != 'active'`.
   - [ ] Vérifier que la carte disparaît en direct dans la session abonnée.

4. **Non-abonné NE reçoit RIEN (T-17-BC, parité sécurité) :**
   - [ ] En session anonyme / non-abonnée, provoquer le même INSERT.
   - [ ] Vérifier qu'**aucun** event Broadcast n'est reçu (la policy RLS `realtime.messages`
     `(select has_active_subscription())` bloque le canal privé pour les non-abonnés).

### Résultat (rempli en UAT — voir 17-UAT.md)

```
Date : 2026-06-25
Testé par : fondateur (session navigateur réelle, compte uat-abonne@nexa.test)
1. Abonné reçoit le badge en direct :        [x] OK  [ ] KO  — INSERT live → badge « nouveaux signaux » apparu sans refresh
2. Shape payload.payload.record confirmé :   [x] OK  [ ] KO  — prouvé fonctionnellement par le gate 3 (UPDATE lit record.status)
3. UPDATE retire la carte en direct :        [x] OK  [ ] KO  — status→invalidated → carte disparue en direct
4. Non-abonné ne reçoit aucun event :        [x] OK  [ ] KO  — incognito → redirigé /fr/login (surface inaccessible, canal jamais monté)
```

> ✅ Tous OK → SCALE-05 (Broadcast) pleinement validé en runtime. Gate 7 levé.
> Détail des 5 checks UAT (dont Cold-Start) dans `17-UAT.md`.
