-- Migration 0020 : watchlist membre `user_followed_setups` (Phase 19, milestone v3.0).
-- 1re ÉCRITURE FRONT MEMBRE du milestone : l'user suit/dé-suit des trade_setups.
-- La RLS with-check scopée `auth.uid()` EST la barrière anti-IDOR
-- (V4 Access Control prioritaire) — `user_id` n'est JAMAIS reçu du client (default
-- (select auth.uid())). Couvre UDASH-03 (watchlist + revue IDOR) et UDASH-02
-- (index keyset pour pagination des suivis/historique).
--
-- CONVENTION REPO (CRITIQUE) : appliquée via MCP `apply_migration` (canal 0006/0008/
-- 0009/0011/0012/0014/0015/0016/0017/0018/0019), JAMAIS `supabase db push`. Le projet
-- n'est pas `link`é localement (D-01-01-D) → `supabase gen types --linked` échoue par
-- design ; `database.types.ts` est édité à la main APRÈS `generate_typescript_types`
-- (ré-application des alias maison + ajout des alias UserFollowedSetup{Row,Insert,Update}).
--
-- NUMÉRO = 0020 (0019 = dernière migration sur disque ; 0013 est ABSENTE — réservée
--   au cluster paiement P4 différé, NE PAS la réutiliser).
--
-- DÉCOUPAGE APPLICATION (D-05, Pitfall 1/2) :
--   - Partie A (ce corps SQL) = DDL transactionnel → `apply_migration`.
--   - Partie B (commentée en fin de fichier) = `CREATE INDEX CONCURRENTLY` → EXÉCUTÉE
--     VIA `execute_sql` UN STATEMENT À LA FOIS (plan 19-01 Task 2), JAMAIS dans
--     `apply_migration` (CONCURRENTLY interdit en transaction → erreur 25001).
--
-- DÉCISION tiebreaker keyset (RESEARCH §389 tranchée) : colonne `id` dédiée
--   (uuid not null default gen_random_uuid(), unique) en plus de la PK composite
--   (user_id, setup_id) — aligne le helper keyset générique (created_at desc, id desc).
--
-- Pattern RLS (miroir 0012/0017 payments, Pitfall 3) :
--   - INSERT = `with check` SEUL ; SELECT/DELETE = `using`.
--   - wrap UNIQUEMENT la fonction non corrélée à la ligne (la colonne de gauche
--     n'est JAMAIS wrappée — voir les policies de Partie A pour la forme exacte).
--   - AUCUNE policy write service_role : l'user EST le producteur de sa watchlist
--     (contrairement à trade_setups où l'écriture est service_role bypass, D-05).
--
-- STRIDE :
--   T-19-01 (Tampering/Elevation, IDOR) : with-check scopée auth.uid()
--           + default (select auth.uid()) ; insert usurpé (user_id d'autrui) rejeté
--           (erreur 42501). Prouvé par anon-client (user-followed-rls.test.ts).
--   T-19-02 (Info Disclosure) : using scopée auth.uid() ; B ne lit
--           pas la watchlist de A.
--   T-19-04 (DoS) : index keyset CONCURRENTLY (Partie B) ; EXPLAIN = Index Scan.

-- ═════════════════════════════════════════════════════════════════════════════
-- PARTIE A — DDL TRANSACTIONNEL (via apply_migration)
-- ═════════════════════════════════════════════════════════════════════════════

create table public.user_followed_setups (
  id         uuid        not null default gen_random_uuid(),                       -- tiebreaker keyset dédié
  user_id    uuid        not null default (select auth.uid()) references auth.users(id) on delete cascade,
  setup_id   uuid        not null references public.trade_setups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, setup_id),          -- idempotence : un seul follow par couple (user, setup)
  unique (id)                               -- support du tiebreaker keyset (created_at desc, id desc)
);

alter table public.user_followed_setups enable row level security;

-- 3 policies `to authenticated`. La colonne `user_id` n'est JAMAIS wrappée (Pitfall 3).
-- AUCUNE policy write service_role : l'user EST le producteur de sa watchlist.

create policy "ufs: lire les siens"
  on public.user_followed_setups
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "ufs: insérer la sienne"
  on public.user_followed_setups
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "ufs: supprimer la sienne"
  on public.user_followed_setups
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ═════════════════════════════════════════════════════════════════════════════
-- PARTIE B — CONCURRENTLY HORS TRANSACTION
-- ⚠️ NE PAS dans apply_migration — Pitfall 2, erreur 25001
--    « CREATE INDEX CONCURRENTLY cannot run inside a transaction block ».
-- Exécuter via MCP execute_sql UN STATEMENT À LA FOIS (plan 19-01 Task 2).
-- Après le statement : vérifier indisvalid (script de gate de 0017 §(a)). Si INVALID
-- → drop index concurrently if exists user_followed_setups_keyset_idx puis relancer.
-- Le sens DESC matche l'ORDER BY des listes suivis/historique (UDASH-02) ; l'EXPLAIN
-- du gate valide l'absence de nœud Sort (Index Scan).
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Keyset suivis/historique (UDASH-02 / D-03 SCALE-02) : (user_id, created_at desc, id desc)
--   — égalité sur user_id (scope RLS) + ORDER BY created_at desc, id desc (curseur).
-- create index concurrently user_followed_setups_keyset_idx
--   on public.user_followed_setups (user_id, created_at desc, id desc);
--
-- ─────────────────────────────────────────────────────────────────────────────
-- GATE (via MCP execute_sql, Task 2) — réutilise les scripts de 0017 :
--   (a) indisvalid : select c.relname from pg_index i join pg_class c on c.oid = i.indexrelid
--       where not i.indisvalid and c.relname = 'user_followed_setups_keyset_idx';  -- attendu : 0 ligne
--   (b) EXPLAIN keyset : explain select * from public.user_followed_setups
--       where user_id = '<uuid>' order by created_at desc, id desc limit 21;
--       attendu : « Index Scan using user_followed_setups_keyset_idx », PAS « Seq Scan » + « Sort ».
--   (c) advisors : get_advisors(performance) → 0 auth_rls_initplan sur user_followed_setups ;
--       get_advisors(security) → aucune NOUVELLE alerte.
-- ─────────────────────────────────────────────────────────────────────────────
