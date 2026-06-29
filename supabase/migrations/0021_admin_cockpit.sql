-- Migration 0021 : fondation données/sécurité du cockpit superadmin (Phase 20).
-- Source unique de vérité = RLS + helpers security-definer. Le front lit en anon-client
-- (Pitfall 1) : SEULE la RLS tranche. 5 couches, calques exacts du codebase.
--
-- Calques (lire avant de modifier un bloc) :
--   - is_superadmin()              → 0008 L.29-47 (helper gate, search_path figé)
--   - has_active_subscription()    → 0009 L.63-77 (def canonique « actif »)
--   - policy « superadmin voit tout » → 0009 L.46-50 (forme) + 0017 (wrap InitPlan)
--   - RPC atomique + audit         → 0016 mark_commission_paid L.331-362
--   - wrapper KPI gated            → 0017 get_mrr() L.262-273
--
-- Conventions verrouillées :
--   - wrap InitPlan dès l'écriture : using ((select public.is_superadmin())) — 0 alerte
--     auth_rls_initplan (advisor performance).
--   - chaque fonction : security definer set search_path = public (figé, Pitfall 6 /
--     function_search_path_mutable) + revoke execute from public, anon + grant authenticated.
--   - écriture sensible : insert admin_audit_log DANS la même transaction (atomicité, D-04).
--
-- ⚠️ Migration NON appliquée par ce commit (Task 1 seulement). L'apply LIVE via MCP
--    apply_migration est la Task 2 (gate human-action bloquant). Jamais `db push` (D-02).

-- ═════════════════════════════════════════════════════════════════════════════
-- LAYER A — Policies SELECT « superadmin voit tout »
-- Tables non couvertes par 0017 pour le superadmin. profiles/telegram_posts/candles
-- = manquantes (RESEARCH §Migration Mapping). trade_setups/analyses = ajoutées par
-- cohérence cockpit (assumption A1 : le superadmin n'est pas garanti abonné). Si le
-- superadmin de prod reste toujours abonné, ces 2 dernières sont superflues mais
-- INOFFENSIVES (policies permissives OR'd avec « abonnés actifs » de 0009).
-- Toutes les autres tables admin sont déjà gérées par 0017 (ne rien ajouter).
-- ═════════════════════════════════════════════════════════════════════════════

create policy "profiles: superadmin voit tout"
  on public.profiles
  for select to authenticated
  using ((select public.is_superadmin()));

create policy "telegram_posts: superadmin voit tout"
  on public.telegram_posts
  for select to authenticated
  using ((select public.is_superadmin()));

create policy "candles: superadmin voit tout"
  on public.candles
  for select to authenticated
  using ((select public.is_superadmin()));

-- A1 — cohérence cockpit (superadmin non garanti abonné). Inoffensif si déjà abonné.
create policy "trade_setups: superadmin voit tout"
  on public.trade_setups
  for select to authenticated
  using ((select public.is_superadmin()));

create policy "analyses: superadmin voit tout"
  on public.analyses
  for select to authenticated
  using ((select public.is_superadmin()));

-- ═════════════════════════════════════════════════════════════════════════════
-- LAYER B — Table admin_audit_log (traçabilité écritures admin, D-04)
-- Écriture UNIQUEMENT via RPC SECURITY DEFINER (bypass RLS) — miroir 0016 :
-- AUCUNE policy insert/update/delete. Lecture = superadmin seul (panneau Conformité).
-- ═════════════════════════════════════════════════════════════════════════════

create table public.admin_audit_log (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        not null references public.profiles(id),   -- = auth.uid() capturé DANS le RPC
  action      text        not null check (action in
                ('grant_subscription_time', 'suspend_account', 'unsuspend_account', 'mark_commission_paid')),
  target_type text        not null check (target_type in ('user', 'commission')),
  target_id   uuid        not null,                                  -- user_id ou commission_id
  payload     jsonb       not null default '{}'::jsonb,              -- {interval, reason, amount_atomic, tx_hash}
  created_at  timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

-- Lecture : superadmin uniquement (wrap InitPlan). Calque affiliate_applications.
create policy "admin_audit_log: superadmin voit tout"
  on public.admin_audit_log
  for select to authenticated
  using ((select public.is_superadmin()));

-- AUCUNE policy insert/update/delete → écriture seulement via SECURITY DEFINER (miroir 0016).

-- ═════════════════════════════════════════════════════════════════════════════
-- LAYER C — profiles.suspended + extension de has_active_subscription()
-- Suspension = VRAIE barrière RLS (D-17), source unique de vérité. Un suspendu lit
-- 0 ligne partout où has_active_subscription() garde (trade_setups/analyses/candles).
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.profiles add column suspended boolean not null default false;
alter table public.profiles add column suspended_reason text;
alter table public.profiles add column suspended_at timestamptz;

-- create OR replace (PAS drop) : la fonction est référencée par les policies
-- trade_setups/analyses/candles (0009/0011) → un drop échouerait sur la dépendance.
-- Replace préserve la signature, donc les dépendances ET les grants (revoke/grant
-- ré-émis ci-dessous par sécurité). Re-wrap InitPlan préservé (auth.uid() via select).
-- Calque 0009 L.63-77 + extension « and not suspended ».
create or replace function public.has_active_subscription()
  returns boolean
  language sql
  stable
  security definer set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
      and s.current_period_end > now()
  )
  and not exists (
    -- D-17 : un compte suspendu perd la lecture (barrière unique, réversible).
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.suspended
  );
$$;

revoke execute on function public.has_active_subscription() from public, anon;
grant execute on function public.has_active_subscription() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- LAYER D — 4 RPC d'écriture SECURITY DEFINER gated + audit atomique
-- Pattern figé (calque 0016 mark_commission_paid + garde 0008) :
--   1. security definer + plpgsql + search_path = public (figé).
--   2. garde EN TÊTE : if not (select is_superadmin()) then raise 'forbidden' (D-03).
--   3. action + insert admin_audit_log dans la MÊME transaction (D-04).
--   4. revoke execute from public, anon + grant to authenticated (la garde interne
--      fait le vrai gating ; le grant suit le calque get_mrr/is_superadmin).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── grant_subscription_time (D-16) ────────────────────────────────────────────
-- Offre du temps d'abonnement. p_interval whitelisté (anti-injection valeur, T-20-10) :
-- whitelist stricte {'7 days','1 month','3 months'} avant cast interval. Upsert : si un
-- abonnement actif existe (def canonique 0009) → prolonge depuis le max(fin, now()) ;
-- sinon crée un abonnement active (plan 'standard' par défaut).
create function public.grant_subscription_time(p_user_id uuid, p_interval text)
  returns void
  language plpgsql
  security definer set search_path = public
as $$
declare
  v_updated int;
begin
  if not (select public.is_superadmin()) then
    raise exception 'forbidden';
  end if;

  -- Whitelist stricte (T-20-10) : aucune valeur hors liste n'atteint le cast interval.
  if p_interval not in ('7 days', '1 month', '3 months') then
    raise exception 'invalid interval: %', p_interval;
  end if;

  -- Prolonge l'abonnement actif existant depuis le max(fin courante, now()).
  update public.subscriptions
     set current_period_end = greatest(current_period_end, now()) + p_interval::interval
   where user_id = p_user_id
     and status = 'active'
     and current_period_end > now();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    -- Aucun actif → crée un abonnement active (réplique la def canonique 0009).
    insert into public.subscriptions (user_id, status, plan, current_period_end)
    values (p_user_id, 'active', 'standard', now() + p_interval::interval);
  end if;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, payload)
  values ((select auth.uid()), 'grant_subscription_time', 'user', p_user_id,
          jsonb_build_object('interval', p_interval));
end;
$$;

revoke execute on function public.grant_subscription_time(uuid, text) from public, anon;
grant execute on function public.grant_subscription_time(uuid, text) to authenticated;

-- ── suspend_account (D-17) ────────────────────────────────────────────────────
create function public.suspend_account(p_user_id uuid, p_reason text)
  returns void
  language plpgsql
  security definer set search_path = public
as $$
begin
  if not (select public.is_superadmin()) then
    raise exception 'forbidden';
  end if;

  update public.profiles
     set suspended = true,
         suspended_reason = p_reason,
         suspended_at = now()
   where id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, payload)
  values ((select auth.uid()), 'suspend_account', 'user', p_user_id,
          jsonb_build_object('reason', p_reason));
end;
$$;

revoke execute on function public.suspend_account(uuid, text) from public, anon;
grant execute on function public.suspend_account(uuid, text) to authenticated;

-- ── unsuspend_account (D-17, réversible) ──────────────────────────────────────
create function public.unsuspend_account(p_user_id uuid)
  returns void
  language plpgsql
  security definer set search_path = public
as $$
begin
  if not (select public.is_superadmin()) then
    raise exception 'forbidden';
  end if;

  update public.profiles
     set suspended = false,
         suspended_reason = null,
         suspended_at = null
   where id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, payload)
  values ((select auth.uid()), 'unsuspend_account', 'user', p_user_id, '{}'::jsonb);
end;
$$;

revoke execute on function public.unsuspend_account(uuid) from public, anon;
grant execute on function public.unsuspend_account(uuid) to authenticated;

-- ── admin_mark_commission_paid (D-03/ADASH-05) ────────────────────────────────
-- Réplique mark_commission_paid (0016 L.344-357) MAIS gated is_superadmin() (grant
-- authenticated) au lieu de service_role-only. Anti double-payout (T-20-09) :
-- update due→paid WHERE status='due' + raise si row_count=0 ; payout inséré APRÈS la
-- transition garantie unique ; audit dans la même tx.
create function public.admin_mark_commission_paid(
  p_commission_id uuid,
  p_tx_hash       text,
  p_amount_atomic bigint
)
  returns void
  language plpgsql
  security definer set search_path = public
as $$
declare
  v_updated int;
begin
  if not (select public.is_superadmin()) then
    raise exception 'forbidden';
  end if;

  -- commission due -> paid (uniquement si encore due : anti double-payout)
  update public.commissions
     set status = 'paid'
   where id = p_commission_id
     and status = 'due';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'admin_mark_commission_paid: commission % introuvable ou déjà payée', p_commission_id;
  end if;

  -- payout tracé (insert seulement après la transition garantie unique)
  insert into public.payouts (commission_id, tx_hash, amount_atomic)
  values (p_commission_id, p_tx_hash, p_amount_atomic);

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, payload)
  values ((select auth.uid()), 'mark_commission_paid', 'commission', p_commission_id,
          jsonb_build_object('tx_hash', p_tx_hash, 'amount_atomic', p_amount_atomic));
end;
$$;

revoke execute on function public.admin_mark_commission_paid(uuid, text, bigint) from public, anon;
grant execute on function public.admin_mark_commission_paid(uuid, text, bigint) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- LAYER E — Wrappers KPI gated (funnel/churn/mix), à-la-volée (D-10, PAS de matview)
-- Calque get_mrr() 0017 : where (select is_superadmin()) en OUTER → 0 ligne pour un
-- non-superadmin (jamais throw). Le filtre est appliqué APRÈS l'agrégat (sous-requête
-- englobante) pour que la garde supprime la ligne entière (un agrégat non groupé
-- renvoie toujours 1 ligne — l'outer where la retire).
-- NOTE : params avec DEFAULT — la barrière RLS (admin-rls.test) appelle ces RPC SANS
-- argument en rôle member ; sans default, PostgREST renverrait une erreur de signature
-- au lieu des 0 lignes gated attendues. kpis.ts passe les args explicites côté front.
-- D-10 : à-la-volée par défaut ; bascule matview décidée par EXPLAIN en Task 2.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── get_acquisition_funnel (D-11) ─────────────────────────────────────────────
-- 3 étapes segmentées par profiles.source (0018) : inscription → activation (1er
-- paiement verified) → rétention (≥2 paiements verified dans la fenêtre).
create function public.get_acquisition_funnel(
  p_from date default (current_date - interval '30 days')::date,
  p_to   date default current_date
)
  returns table (stage text, n bigint, source text)
  language sql
  stable
  security definer set search_path = public
as $$
  select q.stage, q.n, q.source
  from (
    -- (1) inscription
    select 'inscription'::text as stage,
           count(distinct p.id)::bigint as n,
           p.source
    from public.profiles p
    where p.created_at::date >= p_from
      and p.created_at::date <= p_to
    group by p.source

    union all

    -- (2) activation : 1er paiement verified
    select 'activation'::text,
           count(distinct pay.user_id)::bigint,
           pr.source
    from public.payments pay
    join public.profiles pr on pr.id = pay.user_id
    where pay.status = 'verified'
      and pay.verified_at::date >= p_from
      and pay.verified_at::date <= p_to
    group by pr.source

    union all

    -- (3) rétention : ≥2 paiements verified (renouvellement)
    select 'retention'::text,
           count(distinct t.user_id)::bigint,
           t.source
    from (
      select pay.user_id, pr.source
      from public.payments pay
      join public.profiles pr on pr.id = pay.user_id
      where pay.status = 'verified'
        and pay.verified_at::date >= p_from
        and pay.verified_at::date <= p_to
      group by pay.user_id, pr.source
      having count(*) >= 2
    ) t
    group by t.source
  ) q
  where (select public.is_superadmin());   -- 0 ligne pour non-superadmin (jamais throw)
$$;

revoke execute on function public.get_acquisition_funnel(date, date) from public, anon;
grant execute on function public.get_acquisition_funnel(date, date) to authenticated;

-- ── get_churn (D-12) ──────────────────────────────────────────────────────────
-- Churn mensuel sur subscriptions.current_period_end : (abonnés expirés dans le mois
-- sans renouvellement actif au-delà) ÷ (actifs en début de mois). Agrégat non groupé
-- → garde en OUTER pour renvoyer 0 ligne au non-superadmin.
create function public.get_churn(
  p_month date default date_trunc('month', current_date)::date
)
  returns table (churn_count bigint, active_start bigint)
  language sql
  stable
  security definer set search_path = public
as $$
  select agg.churn_count, agg.active_start
  from (
    with bounds as (
      select date_trunc('month', p_month)                          as m_start,
             date_trunc('month', p_month) + interval '1 month'      as m_end
    )
    select
      count(distinct s.user_id) filter (
        where s.current_period_end >= b.m_start
          and s.current_period_end <  b.m_end
          and not exists (
            select 1
            from public.subscriptions s2
            where s2.user_id = s.user_id
              and s2.status = 'active'
              and s2.current_period_end >= b.m_end
          )
      )::bigint as churn_count,
      count(distinct s.user_id) filter (
        where s.current_period_end >= b.m_start
      )::bigint as active_start
    from public.subscriptions s
    cross join bounds b
  ) agg
  where (select public.is_superadmin());   -- 0 ligne pour non-superadmin (jamais throw)
$$;

revoke execute on function public.get_churn(date) from public, anon;
grant execute on function public.get_churn(date) to authenticated;

-- ── get_plan_mix (D-13/ADASH-02) ──────────────────────────────────────────────
-- Répartition des plans actifs (status='active' AND current_period_end>now()).
create function public.get_plan_mix()
  returns table (plan text, n bigint)
  language sql
  stable
  security definer set search_path = public
as $$
  select q.plan, q.n
  from (
    select s.plan, count(*)::bigint as n
    from public.subscriptions s
    where s.status = 'active'
      and s.current_period_end > now()
    group by s.plan
  ) q
  where (select public.is_superadmin());   -- 0 ligne pour non-superadmin (jamais throw)
$$;

revoke execute on function public.get_plan_mix() from public, anon;
grant execute on function public.get_plan_mix() to authenticated;

-- NE PAS toucher mv_mrr / get_mrr (0017) : réutilisés tels quels par le cockpit.
