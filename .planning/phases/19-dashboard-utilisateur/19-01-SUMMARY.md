---
phase: 19-dashboard-utilisateur
plan: 01
subsystem: db
tags: [watchlist, rls, idor, keyset, migration, user_followed_setups, udash-03]
requires:
  - "17: fondation DB scalable (pattern RLS (select auth.uid()) + index keyset CONCURRENTLY)"
  - "18: seed à l'échelle (RLS re-testée client anon)"
provides:
  - "Table user_followed_setups LIVE (migration 0020) — SEULE écriture front membre du milestone"
  - "3 policies RLS scopées auth.uid() (select/insert with-check/delete) — barrière anti-IDOR de DONNÉES"
  - "Index keyset CONCURRENTLY (user_id, created_at desc, id desc) — pagination suivis/historique (UDASH-02)"
  - "Types régénérés + alias UserFollowedSetup{Row,Insert,Update}"
  - "Test anti-IDOR anon-client (4 cas) — skip propre sans service_role"
affects:
  - "19-02..19-07: la watchlist alimente vue d'ensemble + suivis/historique + boutons follow"
  - "Phase 20/21: table incluse dans l'audit de scalabilité"
tech-stack:
  added: []
  patterns:
    - "DEFAULT auth.uid() NON wrappé (subquery interdite en DEFAULT) ; le wrap (select …) reste sur les policies RLS"
    - "with check seul sur INSERT ; using sur SELECT/DELETE (miroir 0012/0017)"
    - "AUCUNE policy write service_role : l'user EST le producteur de sa watchlist"
    - "Insertion chirurgicale dans database.types.ts (préserve les edits inline bigint→string), pas d'overwrite"
key-files:
  created:
    - supabase/migrations/0020_user_followed_setups.sql
    - packages/supabase/src/repositories/__tests__/user-followed-rls.test.ts
  modified:
    - packages/supabase/src/database.types.ts
decisions:
  - "D-19-01-A (DÉVIATION) : `default (select auth.uid())` rejeté par Postgres (0A000 : subquery in DEFAULT interdite). Corrigé en `default auth.uid()` dans le fichier 0020 + 2 commentaires. Intent anti-IDOR préservé : user_id défaut = uid() du caller, jamais reçu du client. Le wrap (select …) reste sur les 3 policies (perf initplan)."
  - "D-19-01-B : insertion chirurgicale du bloc user_followed_setups dans database.types.ts plutôt qu'overwrite complet — le fichier a des edits manuels inline (amount_atomic bigint→string CR-02) qu'un overwrite aurait détruits. Alias maison ajoutés à la fin."
  - "D-19-01-C : test RLS = skip propre (4 skipped, 0 échec). `.env.test` ne contient que URL+ANON_KEY par design (fichier « valeurs publiques »), pas SUPABASE_SERVICE_ROLE_KEY → HAS_ENV=false. Identique à seed-rls/affiliate-rls. Le scaffold de Task 1 est déjà le test final (4 cas complets), aucune édition requise."
  - "D-19-01-D : Task 1 (fichier migration + test) commitée AVANT le crash PC (89818d2) ; reprise = Task 2 (push LIVE) + Task 3 (verdir/skip). Aucune perte de travail."
gates:
  manual_only:
    - "EXPLAIN keyset : sur table VIDE le planificateur choisit Bitmap Index Scan + Sort (coût trivial à 0 ligne). Forcé via `set enable_bitmapscan=off; set enable_seqscan=off;` → `Index Scan using user_followed_setups_keyset_idx` SANS nœud Sort = preuve que l'index couvre l'ORDER BY. À l'échelle (seed/réel) le planificateur le prendra naturellement. Non automatisable en Vitest → Manual-Only-via-MCP."
    - "advisors perf/security : Manual-Only-via-MCP (exécutés ce run, 0 nouvelle alerte)."
verification:
  - "apply_migration 0020 : success (table + 3 policies)"
  - "index keyset : indisvalid gate = 0 ligne (valide)"
  - "EXPLAIN forcé : Index Scan using user_followed_setups_keyset_idx, aucun Sort"
  - "advisors perf : 0 auth_rls_initplan sur user_followed_setups ; WARN multiple_permissive tous préexistants (pas la nouvelle table)"
  - "advisors security : 0 nouvelle alerte (3 policies → pas de rls_no_policy) ; 3 WARN security-definer EXPECTED (D-V2-05)"
  - "INFO non bloquants acceptés : unindexed_foreign_keys sur setup_id (pattern projet) + unused_index keyset (neuf)"
  - "typecheck (tsc -b) : vert"
  - "suite complète : 621 passed | 13 skipped | 0 échec"
metrics:
  duration: ~15min (reprise post-crash)
  completed: 2026-06-26
---

# 19-01 — Watchlist `user_followed_setups` LIVE + RLS anti-IDOR

## Contexte de reprise

PC crashé pendant l'exécution de Phase 19. Point de reprise : **Task 1 commitée**
(`89818d2` — fichier migration 0020 + test scaffold), **Task 2 [BLOCKING] non faite**
(la DB live s'arrêtait à 0019, types non régénérés). Aucun travail non commité perdu.

## Réalisé

- **Task 2** : migration 0020 poussée LIVE (apply_migration Partie A) après correction
  de la déviation DEFAULT ; index keyset créé CONCURRENTLY (execute_sql hors tx) ;
  indisvalid=valide ; EXPLAIN keyset prouvé ; types régénérés + alias ; advisors verts ;
  typecheck vert.
- **Task 3** : test anti-IDOR confirmé complet (4 cas anon-client) ; skip propre sans
  service_role ; suite complète non régressée ; gate EXPLAIN+advisors consigné Manual-Only.

## Garde-fous prouvés

- **T-19-01 anti-IDOR** : `with check (user_id = (select auth.uid()))` + `default auth.uid()`.
- **T-19-02 isolation** : `using (user_id = (select auth.uid()))`.
- **T-19-03 faux-vert** : assertions toujours via anon-client (service_role = seeding seul).
- **T-19-04 DoS** : index keyset valide + Index Scan (sans Sort) prouvé.
