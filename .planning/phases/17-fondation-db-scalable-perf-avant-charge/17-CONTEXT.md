# Phase 17: Fondation DB scalable (perf avant charge) - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Durcir la couche données pour 10k+ utilisateurs **par conception** (aucun load-test) AVANT d'exposer des vues lourdes à l'échelle. Migration `0017`. Couvre SCALE-01..05 : perf RLS (`wrap (select …)` + index policy), index composites keyset alignés `ORDER BY`, infra matviews KPIs superadmin (unique index + `REFRESH CONCURRENTLY` + wrapper `is_superadmin()`), migrations non bloquantes (`CONCURRENTLY` hors transaction), bascule Realtime vers Broadcast.

Arête dure : doit précéder le seed (Phase 18) et les dashboards (Phases 19-20). Indépendant du reskin (Phases 15-16).

**Hors périmètre (cadré ailleurs) :**
- L'audit chiffré (`EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements` sur ~10k) = **SCALE-06 → Phase 21** (exige le seed + les dashboards).
- Les *valeurs* de seuils OFFSET→keyset et `postgres_changes`→Broadcast se confirment post-seed (Phase 21). Phase 17 pose l'architecture, pas les chiffres.
- Le câblage curseur (keyset) des requêtes de liste = Phase 19/20 (cf. D-03).
- Le seed des données ~10k = Phase 18.

</domain>

<decisions>
## Implementation Decisions

### Périmètre RLS (SCALE-01)
- **D-01:** Optimiser **TOUTES** les policies RLS existantes dans la migration `0017` — wrap `(select auth.uid())` / `(select has_active_subscription())` / `(select is_superadmin())` + index sur les colonnes de policy. Tables concernées : signaux/`trade_setups`, `candles`, `payments`, `subscriptions`, `profiles`, `prediction_outcomes`, et les tables d'affiliation. Critère d'arrêt : **`get_advisors` ne signale plus AUCUNE policy réévaluée par ligne** (vert complet). Rationale : balayage complet requis de toute façon par SCALE-01 ; optimiser au coup par coup forcerait à rouvrir `0017`/une 2e migration plus tard.

### Portée matviews KPIs (SCALE-03)
- **D-02:** Poser l'**infra/le pattern réutilisable** (matview + **unique index** → `REFRESH CONCURRENTLY` possible + **wrapper `is_superadmin()`** car les matviews n'ont pas de RLS), prouvé sur **1 matview de référence : le MRR** (KPI le plus chargé, dépend de `payments`/`subscriptions`). Ne PAS construire toutes les matviews KPI maintenant. Rationale : les KPI exacts du cockpit (churn, funnel, mix de plans) sont définis en **Phase 20 (ADASH)** ; les construire ici = re-travail si les définitions bougent. La ROADMAP dit explicitement « infra matviews ».

### Frontière keyset (SCALE-02)
- **D-03:** Phase 17 crée **uniquement les index composites alignés `ORDER BY`** (signaux, utilisateurs, paiements), prêts pour la pagination curseur. **Vérification :** `EXPLAIN` montre un **index scan** (pas de seq scan + tri). Le **câblage curseur** des requêtes de liste se fait en **Phase 19/20** (quand l'UI existe). Rationale : séparation nette DB-fondation vs UI ; la validation keyset réelle exige le seed (Phase 21) de toute façon.

### Realtime / Broadcast (SCALE-05)
- **D-04:** **Migrer MAINTENANT** le flux Realtime existant (badge « N nouveaux signaux », migration `0011` : `REPLICA IDENTITY FULL` + publication + `postgres_changes` sur `trade_setups`) vers **Broadcast**. C'est le flux fan-out 10k que SCALE-05 vise (Pitfall 8 : 1 change × chaque subscriber = goulot mono-thread + WAL alourdi). Devient l'**implémentation de référence Broadcast** « par conception ». Les seuils chiffrés se confirment en Phase 21, mais l'architecture est posée ici. Réévaluer si `REPLICA IDENTITY FULL` reste nécessaire une fois sur Broadcast.

### Application de la migration (SCALE-04)
- **D-05:** Appliquer `0017` **LIVE via le MCP Supabase**, même modèle que `0011`/`0012`/`0014` : les `CREATE INDEX CONCURRENTLY` en **statements séparés hors transaction** (ne PAS les wrapper en tx — `CONCURRENTLY` interdit en transaction), après **confirmation humaine (checkpoint)**, puis `generate_typescript_types` → `database.types.ts` → `get_advisors`. Gérer l'état **INVALID** d'un index concurrent échoué (DROP + recréation). Rationale : cohérent avec l'historique du projet ; jamais `db push`.

### Claude's Discretion
- Mécanique SQL précise du wrap RLS, ordre des colonnes dans chaque index composite, nom/définition exacte de la matview MRR, et choix canal privé vs topic léger pour Broadcast → laissés au researcher/planner (détails d'implémentation).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre & critères de succès
- `.planning/ROADMAP.md` §"Phase 17" — Goal, Success Criteria 1-4, Notes (migration `0017`, Pitfalls #2/#4, SCALE-06 reporté en Phase 21).
- `.planning/REQUIREMENTS.md` — SCALE-01..05 (libellés verrouillés) ; SCALE-06 → Phase 21.

### Risques techniques (recherche)
- `.planning/research/PITFALLS.md` §"Pitfall 8" — Realtime `postgres_changes` + RLS à l'échelle → recommandation Broadcast (sous-tend D-04).
- `.planning/research/PITFALLS.md` §"Pitfall 9" — Migrations bloquantes (`CREATE INDEX` non concurrent, `ALTER TABLE` lockants) (sous-tend D-05).
- `.planning/research/ARCHITECTURE.md` — décisions d'architecture DB/Supabase du milestone v3.0.

### Migrations & RLS existantes (à lire avant de modifier)
- `supabase/migrations/0011_realtime_trade_setups.sql` — flux Realtime à migrer vers Broadcast (D-04).
- `supabase/migrations/0009_subscriptions_gating.sql` + `0010_has_active_subscription_null_expiry.sql` — `has_active_subscription()` (policies à wrapper, D-01).
- `supabase/migrations/0008_profiles_role.sql` — `is_superadmin()` / rôles (wrapper matview, D-02 ; policies, D-01).
- `supabase/migrations/0012_payments.sql` — RLS `payments` (D-01) + source MRR (D-02).
- `supabase/migrations/0014_prediction_outcomes_pattern_stats.sql` — RLS `prediction_outcomes` + vue `pattern_stats` (D-01).
- `supabase/migrations/0016_affiliation.sql` — RLS tables d'affiliation (D-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Fonctions SQL `has_active_subscription()` / `is_superadmin()` déjà définies (migrations 0008-0010) : à réutiliser dans le wrap `(select …)` et le wrapper matview, pas à réécrire.
- Repositories typés dans `packages/supabase` au-dessus du client Supabase typé (`database.types.ts`) : point d'intégration pour le futur câblage keyset (Phase 19/20).
- Pattern « migration LIVE via MCP + gen-types + get_advisors » rodé sur 0011/0012/0014 (cf. STATE.md).

### Established Patterns
- Migrations SQL versionnées = **source de vérité unique** (pas d'ORM). `0017` est la prochaine (dernière appliquée : `0016`).
- RLS stricte : fetch RLS jamais migré vers le client ; service_role réservé aux jobs (jamais côté pages).
- Frontière producteur-unique `persist.ts` pour l'écriture IA — ne pas la perturber.

### Integration Points
- Les index keyset (D-03) seront consommés par les listes des dashboards (Phases 19/20).
- La matview MRR (D-02) sera consommée par le cockpit superadmin (Phase 20).
- La bascule Broadcast (D-04) impacte le composant badge « N nouveaux signaux » de l'espace membre (réécriture côté client de l'abonnement Realtime).

</code_context>

<specifics>
## Specific Ideas

- Matview de référence = **MRR** (et non un KPI arbitraire) car c'est le plus chargé et il valide la chaîne `payments`/`subscriptions` → wrapper `is_superadmin()`.
- Critère de vérification concret par décision : `get_advisors` 100 % vert (D-01) ; `EXPLAIN` index scan sans tri (D-03) ; `REFRESH CONCURRENTLY` fonctionnel grâce au unique index (D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Audit chiffré de scalabilité** (`EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements` à ~10k) → **Phase 21** (SCALE-06), exige le seed.
- **Câblage curseur (keyset) des requêtes de liste** → **Phase 19/20** (UI dashboards).
- **Définition des matviews KPI restantes** (churn, funnel, mix de plans) → **Phase 20** (ADASH).
- **Confirmation des seuils chiffrés** OFFSET→keyset et `postgres_changes`→Broadcast → **Phase 21** (post-seed, compute Supabase à profiler).

None bloquant — discussion restée dans le périmètre de la phase.

</deferred>

---

*Phase: 17-fondation-db-scalable-perf-avant-charge*
*Context gathered: 2026-06-24*
