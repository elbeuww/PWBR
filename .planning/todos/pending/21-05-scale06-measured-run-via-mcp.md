# SCALE-06 — exécution mesurée de l'audit via canal MCP Supabase

**Origine :** Plan 21-05 (Phase 21). L'exécuteur séquentiel n'avait PAS accès au canal MCP
Supabase (`mcp__supabase__*` absents du schéma ; HTTP inline bloqué ; ni `psql`/`pg`/chaîne PG).
Le harnais d'audit `21-AUDIT.md` a été produit en mode méthodologie (fallback `<mcp_tools>` du plan,
honnêteté T-21-16 : aucune mesure fabriquée). **VERDICT D-06 = `PENDING-MEASUREMENT`.**

## À faire (session outillée MCP / orchestrateur)

1. Vérifier le seed ~10k `source='demo'` (§2.1 de `21-AUDIT.md`) ; relancer `pnpm --filter jobs seed` si insuffisant.
2. Vérifier `pg_stat_statements` (§2.2) ; sinon fallback A3 (EXPLAIN + advisors).
3. Capturer la **baseline** `get_advisors(performance)` + `get_advisors(security)` (§3).
4. Exécuter le catalogue **Q1–Q11** (§4) via `mcp__supabase__execute_sql` :
   - Q1–Q5 paginations keyset → asserter `Index Scan` (jamais `Seq Scan` chaud).
   - Q6–Q7 RLS wrappées sous `set local role authenticated` + `request.jwt.claims` → asserter `InitPlan 1×`.
   - Q8–Q11 RPC KPI gated (lecture) → consigner le plan + médiane.
   - N=5, jeter le run froid, médiane des 4, seuil ×3.
5. Re-capturer advisors → **delta** (§5) ; 0 nouvel advisor (ou faux positif Pitfall 5 justifié).
6. Remplacer chaque `[À MESURER — canal MCP]` par la valeur réelle ; émettre le **VERDICT D-06 PASS/FAIL** (§7).
7. Si PASS : la preuve de scalabilité v3.0 (SCALE-06) est close. Si FAIL : lister les régressions, `/gsd:plan-phase 21 --gaps`.

## Contraintes
- Lectures uniquement (Pitfall 4) — aucun `EXPLAIN ANALYZE` sur RPC d'écriture ; `begin; … rollback;` si besoin.
- Ne modifier aucune policy/migration (T-21-15) ; `rls-unchanged.test.ts` reste vert.
- D-08 : les 6 RPC de 0022 restent HORS audit (check ciblé au solde de la dette).
