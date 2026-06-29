-- Migration 0017 : fondation DB scalable (perf avant charge, Phase 17, milestone v3.0).
-- Durcit la couche données pour 10k+ utilisateurs PAR CONCEPTION (aucun load-test ici).
-- Trois axes en Partie A (transactionnel) + un axe en Partie B (CONCURRENTLY hors tx).
--
-- CONVENTION REPO (CRITIQUE) : appliquée via MCP `apply_migration` (canal 0006/0008/
-- 0009/0011/0012/0014/0015/0016), JAMAIS `supabase db push`. Le projet n'est pas `link`é
-- localement (D-01-01-D / D-05-02-D) → `supabase gen types --linked` échoue par design ;
-- `database.types.ts` est édité à la main APRÈS `generate_typescript_types` (ré-application
-- des alias maison + override string `*_atomic`, Pitfall 5). La matview `mv_mrr` et le
-- wrapper `get_mrr()` ajoutent de nouveaux types à réintégrer (montants `*_atomic` → string).
--
-- ⚠️ NUMÉRO = 0017 (0016 = dernière migration sur disque ; 0013 est ABSENTE — réservée
--    au cluster paiement P4 différé, NE PAS la réutiliser).
--
-- ⚠️ DÉCOUPAGE APPLICATION (D-05, Pitfall 1) :
--    - Partie A (ce corps SQL, sections 1-3) = DDL transactionnel → `apply_migration`.
--    - Partie B (commentée en fin de fichier) = `CREATE INDEX CONCURRENTLY` → EXÉCUTÉE
--      VIA `execute_sql` UN STATEMENT À LA FOIS (plan 17-03), JAMAIS dans `apply_migration`
--      (CONCURRENTLY interdit en transaction → erreur 25001).
--
-- Décisions couvertes :
--   D-01 (SCALE-01) : optimiser TOUTES les policies RLS existantes — wrap
--                     (select auth.uid()) / (select has_active_subscription()) /
--                     (select is_superadmin()) → InitPlan évalué 1×/requête (gain >100×).
--                     Critère d'arrêt : get_advisors(performance) → 0 auth_rls_initplan.
--   D-02 (SCALE-03) : infra matview réutilisable, prouvée sur 1 matview de référence MRR
--                     (unique index → REFRESH CONCURRENTLY + wrapper is_superadmin()).
--   D-03 (SCALE-02) : index composites keyset (created_at desc, id desc) alignés ORDER BY
--                     (signaux/users/paiements), prêts pour la pagination curseur (Phase 19/20).
--   D-04 (SCALE-05) : bascule du flux Realtime trade_setups postgres_changes → Broadcast
--                     (trigger realtime.broadcast_changes + RLS realtime.messages).
--   D-05 (SCALE-04) : application LIVE via MCP ; CONCURRENTLY hors tx ; gestion INVALID.
--
-- Patterns (miroir codebase) :
--   - drop/recreate policy par NOM EXACT (un nom erroné fait échouer la migration —
--     pattern 0009 L.83-91 / 0011 L.59-66). Les noms ci-dessous sont LUS dans les
--     migrations d'origine (0001/0009/0011/0012/0016).
--   - fonction SECURITY DEFINER set search_path = public figé + revoke/grant
--     (forme canonique is_superadmin 0008 L.29-47, has_active_subscription 0009 L.63-80).
--   - wrap (select fn()) = InitPlan natif du planner (advisor auth_rls_initplan).
--   - wrap UNIQUEMENT la fonction non corrélée à la ligne ; JAMAIS la comparaison de
--     colonne (user_id = (select auth.uid()), pas (select user_id = auth.uid())) — Pitfall 3.
--
-- STRIDE :
--   T-17-RLS (Elevation/Info Disclosure) : drop/recreate par NOM EXACT ; le wrap n'ouvre
--            jamais la lecture (même expression, juste un InitPlan) ; re-run tests
--            anon-client (non-abonné→0 ligne) + get_advisors(security) au gate (plan 17-03).
--   T-17-MV  (Info Disclosure) : mv_mrr n'a PAS de RLS → wrapper get_mrr() SECURITY DEFINER
--            gated (select is_superadmin()) + revoke public/anon + grant authenticated ;
--            JAMAIS de GRANT SELECT direct sur la matview.
--   T-17-BC  (Info Disclosure) : policy RLS sur realtime.messages répliquant
--            (select has_active_subscription()) — parité avec le filtre postgres_changes
--            retiré ; un non-abonné ne reçoit aucun event.
--   T-17-SP  (Tampering/Elevation) : set search_path = public figé sur get_mrr /
--            refresh_mv_mrr / broadcast_trade_setup_changes (advisor function_search_path_mutable).
--   T-17-RF  (Tampering) : revoke execute on refresh_mv_mrr() from public, anon,
--            authenticated → service_role/job uniquement (bypass).

-- ═════════════════════════════════════════════════════════════════════════════
-- PARTIE A — DDL TRANSACTIONNEL (via apply_migration)
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Wrap RLS InitPlan de TOUTES les policies existantes (D-01, SCALE-01)
-- Chaque policy est drop/recreate à l'IDENTIQUE, en wrappant UNIQUEMENT la fonction
-- non corrélée à la ligne dans un (select ...). Règle Pitfall 3 :
--   has_active_subscription()  → (select public.has_active_subscription())
--   is_superadmin()            → (select public.is_superadmin())
--   id|user_id = auth.uid()    → id|user_id = (select auth.uid())   (colonne NON wrappée)
-- Le reste (to authenticated, for select/insert/update, expressions) est conservé tel quel.
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles — 0001 L.19-27 (deux policies, toutes deux corrélées colonne id = auth.uid()).
-- NOTE D-01 : l'inventaire du plan ne cite que "lire le sien" mais "modifier le sien"
-- référence aussi auth.uid() non wrappée → wrappée également pour atteindre le critère
-- d'arrêt « get_advisors ne signale plus AUCUNE policy réévaluée par ligne » (vert complet).
drop policy "profiles: lire le sien" on public.profiles;
create policy "profiles: lire le sien"
  on public.profiles
  for select
  using (id = (select auth.uid()));

drop policy "profiles: modifier le sien" on public.profiles;
create policy "profiles: modifier le sien"
  on public.profiles
  for update
  using (id = (select auth.uid()));

-- trade_setups — 0009 L.88-91 (gated has_active_subscription()).
drop policy "trade_setups: abonnés actifs" on public.trade_setups;
create policy "trade_setups: abonnés actifs"
  on public.trade_setups
  for select to authenticated
  using ((select public.has_active_subscription()));

-- analyses — 0009 L.94-97 (gated has_active_subscription()).
drop policy "analyses: abonnés actifs" on public.analyses;
create policy "analyses: abonnés actifs"
  on public.analyses
  for select to authenticated
  using ((select public.has_active_subscription()));

-- candles — 0011 L.63-66 (gated has_active_subscription()).
drop policy "candles: abonnés actifs" on public.candles;
create policy "candles: abonnés actifs"
  on public.candles
  for select to authenticated
  using ((select public.has_active_subscription()));

-- payments — 0012 L.92-105 (3 policies : insert self pending, lecture self, superadmin).
drop policy "payments: insérer la sienne en pending" on public.payments;
create policy "payments: insérer la sienne en pending"
  on public.payments
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

drop policy "payments: lire les siennes" on public.payments;
create policy "payments: lire les siennes"
  on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy "payments: superadmin voit tout" on public.payments;
create policy "payments: superadmin voit tout"
  on public.payments
  for select to authenticated
  using ((select public.is_superadmin()));

-- subscriptions — 0009 L.41-50 (lecture self, superadmin).
drop policy "subscriptions: lire les siennes" on public.subscriptions;
create policy "subscriptions: lire les siennes"
  on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy "subscriptions: superadmin voit tout" on public.subscriptions;
create policy "subscriptions: superadmin voit tout"
  on public.subscriptions
  for select to authenticated
  using ((select public.is_superadmin()));

-- prediction_outcomes — 0014 L.39-42 (using (true), AUCUNE fonction corrélée).
-- Rien à wrapper : using (true) n'invoque ni auth.uid() ni helper → l'advisor
-- auth_rls_initplan ne la signale PAS. Laissée TELLE QUELLE (pas de drop/recreate).
-- VÉRIFIER au gate (plan 17-03) que get_advisors(performance) ne la liste pas.

-- ── Tables d'affiliation — 0016 L.68-227 (6 tables, policies "lire les siens" +
--    "superadmin voit tout"). Les "superadmin" wrappent is_superadmin(). Les "lire"
--    utilisent une sous-requête `... in (select id from public.affiliates where
--    user_id = auth.uid())` → on wrappe auth.uid() À L'INTÉRIEUR de la sous-requête.

-- affiliates — 0016 L.68-76.
drop policy "affiliates: lire la sienne" on public.affiliates;
create policy "affiliates: lire la sienne"
  on public.affiliates
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy "affiliates: superadmin voit tout" on public.affiliates;
create policy "affiliates: superadmin voit tout"
  on public.affiliates
  for select to authenticated
  using ((select public.is_superadmin()));

-- affiliate_codes — 0016 L.93-101.
drop policy "affiliate_codes: lire les siens" on public.affiliate_codes;
create policy "affiliate_codes: lire les siens"
  on public.affiliate_codes
  for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = (select auth.uid())));

drop policy "affiliate_codes: superadmin voit tout" on public.affiliate_codes;
create policy "affiliate_codes: superadmin voit tout"
  on public.affiliate_codes
  for select to authenticated
  using ((select public.is_superadmin()));

-- affiliate_applications — 0016 L.127-130 (superadmin uniquement).
drop policy "affiliate_applications: superadmin voit tout" on public.affiliate_applications;
create policy "affiliate_applications: superadmin voit tout"
  on public.affiliate_applications
  for select to authenticated
  using ((select public.is_superadmin()));

-- referrals — 0016 L.148-156.
drop policy "referrals: lire les siens" on public.referrals;
create policy "referrals: lire les siens"
  on public.referrals
  for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = (select auth.uid())));

drop policy "referrals: superadmin voit tout" on public.referrals;
create policy "referrals: superadmin voit tout"
  on public.referrals
  for select to authenticated
  using ((select public.is_superadmin()));

-- commissions — 0016 L.187-195.
drop policy "commissions: lire les siennes" on public.commissions;
create policy "commissions: lire les siennes"
  on public.commissions
  for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = (select auth.uid())));

drop policy "commissions: superadmin voit tout" on public.commissions;
create policy "commissions: superadmin voit tout"
  on public.commissions
  for select to authenticated
  using ((select public.is_superadmin()));

-- payouts — 0016 L.214-227.
drop policy "payouts: lire les siens" on public.payouts;
create policy "payouts: lire les siens"
  on public.payouts
  for select to authenticated
  using (commission_id in (
    select c.id
    from public.commissions c
    join public.affiliates a on a.id = c.affiliate_id
    where a.user_id = (select auth.uid())
  ));

drop policy "payouts: superadmin voit tout" on public.payouts;
create policy "payouts: superadmin voit tout"
  on public.payouts
  for select to authenticated
  using ((select public.is_superadmin()));

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Matview de référence MRR + wrapper gated + refresh (D-02, SCALE-03)
-- Infra réutilisable prouvée sur 1 matview (mv_mrr). Les matviews N'ONT PAS de RLS :
-- la lecture est OBLIGATOIREMENT gardée par un wrapper SECURITY DEFINER gated
-- is_superadmin() ; AUCUN GRANT SELECT direct sur la matview.
--
-- ⚠️ DÉFINITION MÉTIER VERROUILLÉE (checkpoint A1, décision fondateur — Option B) :
--    « cash encaissé par mois », PAS un MRR récurrent dédupliqué.
--    MRR(mois) = Σ payments.amount_atomic WHERE status='verified'
--                GROUP BY date_trunc('month', verified_at).
--    - Source de vérité = amount_atomic (montant constaté on-chain), PAS expected_amount_atomic.
--    - Période = mois de verified_at (date d'encaissement), PAS current_period_end.
--    - Plans inclus = les DEUX (discovery ET standard) ; aucun filtre par plan.
--    - PAS de déduplication : plusieurs paiements verified d'un même user dans le mois
--      s'additionnent (comportement voulu — mesure du cash réel encaissé).
--
-- Note types : month = date (PostgREST string), revenue_atomic = bigint → override
-- string en TS (database.types.ts édité main, comme les autres *_atomic).
-- ⚠️ Le UNIQUE index requis pour REFRESH CONCURRENTLY (mv_mrr_month_idx) est posé en
--    PARTIE B (CONCURRENTLY hors tx). Il DOIT exister avant le premier refresh concurrent.
-- ─────────────────────────────────────────────────────────────────────────────
create materialized view public.mv_mrr as
  select
    date_trunc('month', p.verified_at)::date as month,                    -- mois d'encaissement (A1)
    count(*)                                 as payments_count,           -- nb de paiements verified du mois
    coalesce(sum(p.amount_atomic), 0)::bigint as revenue_atomic           -- cash encaissé (constaté on-chain), string en TS
  from public.payments p
  where p.status = 'verified'
    and p.verified_at is not null
  group by date_trunc('month', p.verified_at);

-- Lecture gated (matview sans RLS) — calque EXACT du contrat is_superadmin() (0008 L.29-47).
-- La garde where (select is_superadmin()) renvoie 0 ligne à un non-superadmin (pas d'erreur).
create function public.get_mrr()
  returns setof public.mv_mrr
  language sql
  stable
  security definer
  set search_path = public                                               -- figé (Pitfall 6 / function_search_path_mutable)
as $$
  select * from public.mv_mrr where (select public.is_superadmin());
$$;

revoke execute on function public.get_mrr() from public, anon;           -- miroir 0008 L.46
grant execute on function public.get_mrr() to authenticated;             -- miroir 0008 L.47

-- T-17-MV (Info Disclosure) : Supabase grant SELECT par défaut anon/authenticated sur
-- les objets public → la matview serait lisible via PostgREST (advisor materialized_view_in_api),
-- contournant get_mrr(). On RÉVOQUE l'accès direct ; la seule lecture passe par get_mrr() gated.
revoke all on public.mv_mrr from anon, authenticated;

-- Refresh sans verrou de lecture (exige le UNIQUE index mv_mrr_month_idx de la Partie B).
-- Lockée service_role : revoke à TOUS les rôles client (seul service_role bypass — miroir 0016 L.362).
-- L'ordonnanceur du refresh (pg_cron/Edge/job) est HORS scope P17 (Open Question 1).
create function public.refresh_mv_mrr()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_mrr;
end;
$$;

revoke execute on function public.refresh_mv_mrr() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Broadcast from Database : trigger + policy realtime.messages (D-04, SCALE-05)
-- Remplace le flux postgres_changes de 0011 (badge « N nouveaux signaux ») par Broadcast :
-- 1 change × chaque subscriber = goulot mono-thread + WAL alourdi à 10k (Pitfall 8) →
-- un trigger DB pousse UNE FOIS sur un topic FIXE partagé, fan-out servi par realtime.messages.
--
-- Open Question 2 tranchée : topic FIXE 'topic:new-signals' (fan-out global du badge,
-- pas par-record) + canal PRIVÉ (Realtime Authorization via RLS sur realtime.messages).
--
-- Parité sécurité (Pitfall 4) : la policy realtime.messages réplique la barrière abonné de
-- l'ancien filtre RLS postgres_changes → un non-abonné ne reçoit AUCUN event. Le wrap
-- (select has_active_subscription()) est cohérent avec la Section 1.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.broadcast_trade_setup_changes()
  returns trigger
  security definer
  language plpgsql
  set search_path = public                                               -- figé (Pitfall 6), miroir 0008 L.34
as $$
begin
  perform realtime.broadcast_changes(
    'topic:new-signals',          -- topic FIXE partagé (fan-out global, Open Question 2)
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );
  return null;
end;
$$;

-- T-17-BC (Info Disclosure / surface RPC) : une fonction de trigger ne doit jamais être
-- appelable en RPC (advisor anon/authenticated_security_definer_function_executable).
-- Convention repo (migration 0002 revoke_execute_trigger_functions) → révoquer execute.
revoke execute on function public.broadcast_trade_setup_changes() from public, anon, authenticated;

create trigger trg_trade_setups_broadcast
  after insert or update on public.trade_setups
  for each row execute function public.broadcast_trade_setup_changes();

-- Realtime Authorization : qui peut écouter le canal privé (RLS sur realtime.messages).
-- Restreint aux abonnés actifs = parité avec le filtre postgres_changes retiré (T-17-BC).
create policy "broadcast: abonnés actifs écoutent new-signals"
  on realtime.messages
  for select to authenticated
  using ((select public.has_active_subscription()));

-- ⚠️ RÉÉVALUATION REPLICA IDENTITY FULL + publication (D-04) — NE PAS EXÉCUTER ICI.
-- Une fois sur Broadcast, REPLICA IDENTITY FULL (0011 L.37) et l'appartenance de
-- trade_setups à la publication supabase_realtime (0011 L.44-55) deviennent superflus
-- pour CE flux (Broadcast lit realtime.messages, pas le WAL postgres_changes). MAIS :
-- vérifier LIVE (Assumption A3) qu'AUCUN autre consommateur postgres_changes n'en dépend
-- AVANT de retirer. Statements à exécuter SEULEMENT au plan 17-03, APRÈS cette vérif
-- (execute_sql sur pg_publication_tables) :
--   alter publication supabase_realtime drop table public.trade_setups;
--   alter table public.trade_setups replica identity default;

-- ═════════════════════════════════════════════════════════════════════════════
-- PARTIE B — CONCURRENTLY HORS TRANSACTION
-- ⚠️ NE PAS dans apply_migration — Pitfall 1, erreur 25001
--    « CREATE INDEX CONCURRENTLY cannot run inside a transaction block ».
-- Exécuter via MCP execute_sql UN STATEMENT À LA FOIS (plan 17-03), JAMAIS groupés.
-- Après CHAQUE statement : vérifier indisvalid (script de gate ci-dessous). Si INVALID
-- → drop index concurrently if exists <name> puis relancer.
-- Avant CHAQUE create : confirmer LIVE qu'aucun index dédié ne couvre déjà la colonne
-- (FK auto-index ? Assumption A5) — ne pas dupliquer ; get_advisors(performance) rattrape
-- les manquants. Le sens DESC DOIT matcher l'ORDER BY réel des listes Phase 19/20
-- (Open Question 3) ; l'EXPLAIN du gate valide l'absence de nœud Sort.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 1. UNIQUE matview — requis pour REFRESH MATERIALIZED VIEW CONCURRENTLY (D-02).
--    DOIT être créé AVANT le premier refresh concurrent de refresh_mv_mrr().
-- create unique index concurrently mv_mrr_month_idx on public.mv_mrr (month);
--
-- 2. Keyset feed signaux « plus récents » (D-03/SCALE-02).
--    trade_setups_score_idx (0006 L.86-87) = (opportunity_score desc, created_at desc),
--    SANS id en tiebreaker → ajouter le composite keyset dédié.
-- create index concurrently trade_setups_keyset_idx on public.trade_setups (created_at desc, id desc);
--
-- 3. Keyset liste users (D-03/SCALE-02).
-- create index concurrently profiles_keyset_idx on public.profiles (created_at desc, id desc);
--
-- 4. Keyset liste paiements (D-03/SCALE-02).
--    payments_status_created_idx (0012 L.82-83) = (status, created_at desc), SANS id.
-- create index concurrently payments_keyset_idx on public.payments (created_at desc, id desc);
--
-- 5. Colonne de policy payments.user_id (D-01/SCALE-01, Assumption A5) — si non couverte
--    par un index dédié (la FK n'auto-indexe PAS la colonne référençante en Postgres).
-- create index concurrently payments_user_id_idx on public.payments (user_id);
--
-- 6. Colonne de policy subscriptions.user_id (D-01/SCALE-01) — subscriptions_active_idx
--    (0009 L.55-56) = (user_id, status, current_period_end) couvre DÉJÀ user_id en tête :
--    confirmer LIVE qu'un index dédié n'est PAS nécessaire (préfixe d'index composite
--    suffit pour les égalités user_id) avant de créer celui-ci ; ne pas dupliquer.
-- create index concurrently subscriptions_user_id_idx on public.subscriptions (user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- SCRIPT DE GATE RÉUTILISABLE (via MCP execute_sql, plan 17-03)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- (a) DÉTECTION DES INDEX INVALID (après chaque CREATE CONCURRENTLY — Pitfall 2).
--     Un CONCURRENTLY interrompu laisse un index indisvalid=false (pas de rollback
--     propre) qui bloque la recréation du même nom et n'est pas utilisé par le planner.
-- select c.relname as index_name, t.relname as table_name
-- from pg_index i
-- join pg_class c on c.oid = i.indexrelid
-- join pg_class t on t.oid = i.indrelid
-- where not i.indisvalid and c.relnamespace = 'public'::regnamespace;
--     Remédiation (hors tx également), puis relancer le CREATE INDEX CONCURRENTLY :
-- drop index concurrently if exists mv_mrr_month_idx;
-- drop index concurrently if exists trade_setups_keyset_idx;
-- drop index concurrently if exists profiles_keyset_idx;
-- drop index concurrently if exists payments_keyset_idx;
-- drop index concurrently if exists payments_user_id_idx;
-- drop index concurrently if exists subscriptions_user_id_idx;
--
-- (b) EXPLAIN GABARIT PAR LISTE KEYSET (D-03/SCALE-02) — attendu : « Index Scan »,
--     PAS « Seq Scan » + « Sort ». Adapter l'ORDER BY au câblage curseur réel (Phase 19/20).
-- explain select * from public.trade_setups order by created_at desc, id desc limit 20;
-- explain select * from public.profiles     order by created_at desc, id desc limit 20;
-- explain select * from public.payments     order by created_at desc, id desc limit 20;
--
-- (c) GATE MATVIEW (D-02) — le REFRESH CONCURRENTLY exige mv_mrr_month_idx (UNIQUE) :
-- refresh materialized view concurrently public.mv_mrr;
--
-- (d) GATE ADVISORS (D-01/D-05) — via MCP get_advisors :
--     get_advisors(performance) → 0 auth_rls_initplan (critère d'arrêt D-01).
--     get_advisors(security)    → pas de NOUVELLE alerte (les 2 WARN security-definer
--     helpers is_superadmin/has_active_subscription restent EXPECTED, cf. STATE D-01-01-D).
