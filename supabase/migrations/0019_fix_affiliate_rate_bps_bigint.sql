-- Migration 0019 : corrige compute_affiliate_commissions (Phase 18, milestone v3.0).
--
-- BUG (révélé par le seed P18, 1er appel du RPC avec données réelles) :
--   `compute_affiliate_commissions` appelle `affiliate_rate_bps(cnt.signups)` où
--   `cnt.signups = count(*)` renvoie un `bigint`. La fonction n'existe qu'en
--   `affiliate_rate_bps(integer)` (0016) et Postgres ne caste PAS implicitement
--   bigint→integer pour la résolution de fonction → erreur :
--     « function public.affiliate_rate_bps(bigint) does not exist ».
--   Le bug touche la VRAIE affiliation autant que le seed (tout appel du RPC avec
--   ≥1 referral réel le déclenche).
--
-- FIX : caster `count(*)::int` dans la sous-requête latérale (un seul point, corrige
--   les deux appels `affiliate_rate_bps`). signups = nb de filleuls d'un affilié
--   (≪ int max) → cast sûr. Signature du RPC inchangée (p_period text → jsonb) →
--   `database.types.ts` non impacté.
--
-- CONVENTION REPO : appliquée via MCP `apply_migration`, JAMAIS `supabase db push`.
-- SECURITY DEFINER + search_path='public' conservés à l'identique (0016).

create or replace function public.compute_affiliate_commissions(p_period text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_rows        int := 0;
  v_period_start timestamptz := (p_period || '-01')::date;
  v_period_end   timestamptz := ((p_period || '-01')::date + interval '1 month');
begin
  insert into public.commissions
    (affiliate_id, referral_id, period, rate_bps, base_atomic, amount_atomic, status)
  select
    a.id,
    r.user_id,
    p_period,
    public.affiliate_rate_bps(cnt.signups)                                                  as rate_bps,
    coalesce(sum(p.amount_atomic), 0)                                                        as base_atomic,
    (coalesce(sum(p.amount_atomic), 0) * public.affiliate_rate_bps(cnt.signups)) / 10000     as amount_atomic,
    'due'
  from public.affiliates a
  join public.referrals r
    on r.affiliate_id = a.id
    and r.user_id <> a.user_id
  join lateral (
    select count(*)::int as signups
    from public.referrals rr
    where rr.affiliate_id = a.id
  ) cnt on true
  join public.payments p
    on p.user_id = r.user_id
    and p.status = 'verified'
    and p.verified_at >= v_period_start
    and p.verified_at <  v_period_end
  join public.subscriptions s
    on s.user_id = r.user_id
    and s.status = 'active'
    and s.current_period_end > now()
  group by a.id, r.user_id, cnt.signups
  on conflict (affiliate_id, referral_id, period) do update
    set rate_bps      = excluded.rate_bps,
        base_atomic   = excluded.base_atomic,
        amount_atomic = excluded.amount_atomic
    where public.commissions.status = 'due';

  get diagnostics v_rows = row_count;
  return jsonb_build_object('period', p_period, 'rows', v_rows);
end;
$function$;
