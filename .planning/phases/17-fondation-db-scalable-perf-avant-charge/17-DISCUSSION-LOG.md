# Phase 17: Fondation DB scalable (perf avant charge) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 17-fondation-db-scalable-perf-avant-charge
**Areas discussed:** Périmètre RLS, Portée matviews, Frontière keyset, Realtime Broadcast, Application migration

---

## Périmètre RLS (SCALE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Toutes les policies | Wrap `(select …)` + index policy sur TOUTES les tables RLS existantes ; get_advisors 100 % vert requis | ✓ |
| Tables chaudes seulement | Optimiser uniquement signaux/users/paiements ; dette + 2e migration | |

**User's choice:** Toutes les policies (recommandé)
**Notes:** SCALE-01 exige que get_advisors ne signale plus aucune policy réévaluée par ligne → balayage complet de toute façon.

---

## Portée matviews KPIs (SCALE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Pattern + 1 matview de référence | Infra réutilisable (unique index + REFRESH CONCURRENTLY + wrapper is_superadmin()) prouvée sur 1 KPI (MRR) | ✓ |
| Toutes les matviews KPI maintenant | Construire tout le cockpit dès 0017 ; risque de re-travail si KPI bougent en Phase 20 | |

**User's choice:** Pattern + 1 matview de référence (recommandé)
**Notes:** KPI exacts (churn, funnel, mix) définis en Phase 20 ; éviter le couplage/re-travail. Matview de référence = MRR.

---

## Frontière keyset (SCALE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Index composites seulement | Créer les index alignés ORDER BY (EXPLAIN = index scan) ; câblage curseur en Phase 19/20 | ✓ |
| Index + refactor des requêtes existantes | Migrer aussi les requêtes de liste actuelles vers le curseur maintenant | |

**User's choice:** Index composites seulement (recommandé)
**Notes:** Séparation DB-fondation vs UI ; validation keyset réelle exige le seed (Phase 21).

---

## Realtime / Broadcast (SCALE-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Migrer le flux signaux vers Broadcast maintenant | Migration 0011 (badge « N nouveaux signaux » postgres_changes) → Broadcast = implémentation de référence | ✓ |
| Convention seulement, bascule différée en Phase 21 | Garder postgres_changes jusqu'à preuve de saturation à l'audit | |

**User's choice:** Migrer ce flux vers Broadcast maintenant (recommandé)
**Notes:** C'est exactement le flux fan-out 10k visé par SCALE-05 (Pitfall 8). Seuils chiffrés confirmés en Phase 21.

---

## Application de la migration (SCALE-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Apply LIVE via MCP, segments hors-tx, checkpoint humain | Même modèle que 0011/0012/0014 ; CONCURRENTLY en statements séparés hors transaction + gen-types + get_advisors | ✓ |
| Local supabase d'abord, puis push | Tester en local avant remote | |
| Je suis prêt pour le CONTEXT.md | Laisser le planner décider | |

**User's choice:** Apply LIVE via MCP, segments hors-tx, checkpoint humain (recommandé)
**Notes:** Cohérent avec l'historique du projet ; `CONCURRENTLY` interdit en transaction → ne pas wrapper.

---

## Claude's Discretion

- Mécanique SQL précise du wrap RLS, ordre des colonnes des index composites, définition exacte de la matview MRR, choix canal privé vs topic léger pour Broadcast.

## Deferred Ideas

- Audit chiffré de scalabilité (EXPLAIN ANALYZE + get_advisors + pg_stat_statements ~10k) → Phase 21 (SCALE-06).
- Câblage curseur (keyset) des requêtes de liste → Phase 19/20.
- Définition des matviews KPI restantes (churn, funnel, mix) → Phase 20.
- Confirmation des seuils chiffrés OFFSET→keyset et postgres_changes→Broadcast → Phase 21.
