# SCALE-06 — compléter la mesure de l'audit à l'échelle ~10k (reste partiel)

**MISE À JOUR 2026-06-27 (orchestrateur `/gsd:execute-phase 21`)** : la mesure a été **exécutée
partiellement** via le canal MCP Supabase. **VERDICT D-06 = `PASS PARTIEL (CONDITIONNEL)`** (cf.
`21-AUDIT.md` §7). Déjà PASS et clos :
- **D-06.2** (0 nouvel advisor) — baseline perf+sécu capturée, 0 `auth_rls_initplan`.
- **D-06.3** (InitPlan 1×) — prouvé Q6 (`trade_setups`) + Q7 (`profiles`).
- **D-06.1** partiel — `profiles` (1038) → `Index Scan using profiles_keyset_idx` sans `Sort`.

**Reste à faire (bloqué par l'absence du seed ~10k dans le cloud partagé — §2.1 mesuré : `trade_setups`=5,
`payments`=0, `user_followed_setups`=0) :**

1. **Re-jouer le seed ~10k** : `pnpm --filter jobs seed` (écriture lourde sur cloud partagé — décision
   utilisateur requise ; non exécuté unilatéralement par l'orchestrateur).
2. Ré-exécuter **Q1, Q3, Q4, Q5** (paginations keyset des 3 tables actuellement vides) → asserter
   `Index Scan using *_keyset_idx`, **jamais** `Seq Scan` + `Sort` chaud.
3. (Optionnel) Q8/Q10/Q11 (RPC KPI) pour valeurs représentatives à l'échelle ; Q9 funnel déjà mesuré (20 ms, rows=0).
4. Si tous Index Scan → faire passer le verdict §7 de **PASS PARTIEL** à **PASS plein** → SCALE-06 close.
   Si une régression (Seq Scan chaud / SubPlan par ligne) → lister + `/gsd:plan-phase 21 --gaps`.

## Contraintes
- Lectures uniquement (Pitfall 4) — aucun `EXPLAIN ANALYZE` sur RPC d'écriture ; `begin; … rollback;` si besoin.
- Ne modifier aucune policy/migration (T-21-15) ; `rls-unchanged.test.ts` reste vert.
- D-08 : les 6 RPC de 0022 restent HORS audit (check ciblé au solde de la dette).
