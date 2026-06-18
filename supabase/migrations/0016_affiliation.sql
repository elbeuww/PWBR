-- Migration 0016 : socle DB de l'affiliation à paliers (Phase 7).
-- 6 tables (affiliates, affiliate_codes, affiliate_applications, referrals,
-- commissions, payouts) + RLS isolation « lis les tiens + superadmin » sans write
-- front + grille de taux SQL (basis points) + 2 RPC security definer (calcul
-- idempotent + payout atomique) + vue dashboard no-PII (revenu cumul + mois courant).
--
-- CONVENTION REPO (CRITIQUE) : appliquée via MCP `apply_migration` (canal 0006/0008/
-- 0009/0011/0012/0015), JAMAIS `supabase db push`. Le projet n'est pas `link`é
-- localement (D-01-01-D / D-05-02-D) → `supabase gen types --linked` échoue par
-- design ; `database.types.ts` est édité à la main (ré-application des alias maison +
-- override string `*_atomic`) APRÈS `generate_typescript_types` (Pitfall 5 / D-05-02-F).
--
-- ⚠️ NUMÉRO = 0016 (0015 = dernière migration sur disque ; 0013 est ABSENTE — réservée
--    au cluster paiement P4 différé, NE PAS la réutiliser).
--
-- Décisions couvertes :
--   D-01/D-02 : grille de taux à 8 paliers (plafond 20 %), dérivée du NOMBRE D'INSCRITS
--               via le code (audience), PAS des abonnés actifs → `affiliate_rate_bps`.
--   D-03      : base du montant = Σ `payments.amount_atomic` (BigInt atomique ×10⁶) des
--               filleuls ACTIFS sur la période (zéro float).
--   D-04      : découverte ET standard commissionnent (aucun filtre sur le plan).
--   D-05      : période = mois calendaire `'YYYY-MM'` ; UNIQUE(affiliate_id, referral_id,
--               period) → 1 commission/filleul/mois, re-run idempotent.
--   D-08      : candidature insérée via service_role (server action, Plan 07-06) ; AUCUNE
--               policy insert front sur `affiliate_applications` (frontière producteur-unique).
--   D-11      : attribution figée à l'inscription — UNIQUE(user_id) sur `referrals`.
--   D-12      : auto-parrainage exclu AU CALCUL (`r.user_id <> a.user_id`, inviolable).
--   D-13      : dashboard = agrégats seuls, zéro user_id de filleul exposé.
--   D-14      : métriques complètes dont revenu cumul + mois courant.
--   D-15      : payout = tx_hash + date + montant ; état due → paid reflété au dashboard.
--   A7/Q4 RESOLVED : valeurs SQL `'due'`/`'paid'` SANS accent (i18n « payée » au front).
--   A5/Q3 RESOLVED : arrondi = troncature entière Postgres (`/` sur bigint = floor).
--
-- Patterns (miroir codebase) :
--   - text + check(... in (...)) plutôt qu'enum natif (cohérent 0001/0009/0012).
--   - lecture scopée user_id = auth.uid() + superadmin (miroir payments 0012 L.97-105).
--   - RLS active SANS policy write = écriture service_role bypass (miroir 0012 L.107 / 0015 L.49).
--   - index unique = filet DB anti-doublon (miroir payments_tx_hash_global_idx 0012 L.63-64).
--   - RPC security definer set search_path = public + get diagnostics + revoke execute
--     (miroir activate_subscription_for_payment 0012 L.120-169).
--   - définition canonique d'« actif » : status='active' AND current_period_end > now()
--     (miroir has_active_subscription 0009 L.63-80), répliquée DANS le RPC (service_role,
--     pas auth.uid()).
--
-- STRIDE :
--   T-07-SELFREF   (Tampering/Fraud) : exclusion `r.user_id <> a.user_id` au calcul (D-12, inviolable).
--   T-07-DOUBLEPAY (Tampering)       : UNIQUE(affiliate_id,referral_id,period) + `on conflict do
--                                      update where status='due'` ; mark_commission_paid raise si row_count=0.
--   T-07-PII       (Info Disclosure) : vue affiliate_dashboard security_invoker=true, agrégats seuls,
--                                      zéro user_id filleul (D-13) ; get_advisors au gate.
--   T-07-RLS-ISO   (Info Disclosure/Elevation) : SELECT scopé auth.uid() + is_superadmin() ;
--                                      AUCUNE policy write (service_role bypass).
--   T-07-REFINJ    (Tampering)       : code vanity borné `^[A-Z0-9]{3,20}$` (check + PK) — filet
--                                      anti-injection sur le code attribué via cookie.

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : affiliates (un user promu affilié — D-07, miroir frontière producteur-unique)
-- RLS : l'affilié lit la sienne ; le superadmin lit tout. Création = service_role (promotion).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.affiliates (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null unique references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.affiliates enable row level security;

create policy "affiliates: lire la sienne"
  on public.affiliates
  for select to authenticated
  using (user_id = auth.uid());

create policy "affiliates: superadmin voit tout"
  on public.affiliates
  for select to authenticated
  using (public.is_superadmin());

-- AUCUNE policy insert/update/delete → promotion réservée service_role (D-07).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : affiliate_codes (code vanity — D-06, T-07-REFINJ)
-- code = PK + check charset/longueur bornés (filet inviolable contre injection/collision).
-- RLS : l'affilié lit SES codes (via propriété de l'affiliate_id) ; superadmin lit tout.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.affiliate_codes (
  code          text        primary key check (code ~ '^[A-Z0-9]{3,20}$'),  -- borne D-06 + filet
  affiliate_id  uuid        not null references public.affiliates(id) on delete cascade,
  created_at    timestamptz not null default now()
);

alter table public.affiliate_codes enable row level security;

create policy "affiliate_codes: lire les siens"
  on public.affiliate_codes
  for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()));

create policy "affiliate_codes: superadmin voit tout"
  on public.affiliate_codes
  for select to authenticated
  using (public.is_superadmin());

-- AUCUNE policy insert/update/delete → enregistrement du code réservé service_role (D-07).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : affiliate_applications (candidature — D-08)
-- status : pending → approved | rejected (revue back-office superadmin).
-- §Open Q1 RESOLVED : insert via service_role (server action, 07-06) — AUCUNE policy
-- insert front. SELECT superadmin uniquement (file de revue).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.affiliate_applications (
  id                uuid        primary key default gen_random_uuid(),
  applicant_email   text        not null,
  social_links      text,
  telegram          text,
  facebook          text,
  subscriber_count  int,
  interactions      text,
  status            text        not null default 'pending'
                                check (status in ('pending', 'approved', 'rejected')),
  reject_reason     text,
  created_at        timestamptz not null default now()
);

alter table public.affiliate_applications enable row level security;

create policy "affiliate_applications: superadmin voit tout"
  on public.affiliate_applications
  for select to authenticated
  using (public.is_superadmin());

-- AUCUNE policy insert/update/delete → candidature + transition réservées service_role (D-08).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : referrals (attribution figée à l'inscription — D-11)
-- UNIQUE(user_id) : un filleul est attribué une seule fois (last-touch figé au cookie).
-- RLS : l'affilié lit SES filleuls (agrégat seul côté UI, D-13) ; superadmin lit tout.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.referrals (
  id             uuid        primary key default gen_random_uuid(),
  affiliate_id   uuid        not null references public.affiliates(id) on delete cascade,
  user_id        uuid        not null unique references public.profiles(id) on delete cascade,
  attributed_at  timestamptz not null default now()
);

alter table public.referrals enable row level security;

create policy "referrals: lire les siens"
  on public.referrals
  for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()));

create policy "referrals: superadmin voit tout"
  on public.referrals
  for select to authenticated
  using (public.is_superadmin());

-- AUCUNE policy insert/update/delete → attribution réservée service_role (signUp, D-11).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : commissions (1 ligne par affilié × filleul × mois — D-05)
-- rate_bps : taux appliqué (basis points). base_atomic : Σ revenu du filleul (×10⁶).
-- amount_atomic : commission = (base × rate_bps) / 10000 (entier, troncature).
-- status : due → paid (A7/Q4 : valeurs SANS accent ; « payée » via i18n au front).
-- RLS : l'affilié lit ses commissions ; superadmin lit tout. Écriture = RPC service_role.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.commissions (
  id            uuid        primary key default gen_random_uuid(),
  affiliate_id  uuid        not null references public.affiliates(id) on delete cascade,
  referral_id   uuid        references public.profiles(id) on delete set null,
  period        text        not null,                       -- 'YYYY-MM' (mois calendaire UTC)
  rate_bps      int         not null,
  base_atomic   bigint      not null default 0,             -- Σ amount_atomic filleul (string en TS, CR-02)
  amount_atomic bigint      not null default 0,             -- commission (string en TS, CR-02)
  status        text        not null default 'due'
                            check (status in ('due', 'paid')),
  created_at    timestamptz not null default now()
);

alter table public.commissions enable row level security;

-- Idempotence (D-05, T-07-DOUBLEPAY) : 1 commission par (affilié, filleul, période).
-- Filet DB inviolable, miroir payments_tx_hash_global_idx (0012 L.63-64).
create unique index commissions_aff_ref_period_idx
  on public.commissions (affiliate_id, referral_id, period);

create policy "commissions: lire les siennes"
  on public.commissions
  for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()));

create policy "commissions: superadmin voit tout"
  on public.commissions
  for select to authenticated
  using (public.is_superadmin());

-- AUCUNE policy insert/update/delete → calcul/upsert réservé RPC service_role.

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : payouts (paiement manuel tracé — D-15)
-- tx_hash + montant + date. Inséré par mark_commission_paid (service_role, atomique).
-- RLS : l'affilié lit ses payouts (via la commission) ; superadmin lit tout.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.payouts (
  id             uuid        primary key default gen_random_uuid(),
  commission_id  uuid        not null references public.commissions(id) on delete cascade,
  tx_hash        text        not null,
  amount_atomic  bigint      not null,                      -- montant payé (string en TS, CR-02)
  paid_at        timestamptz not null default now()
);

alter table public.payouts enable row level security;

create policy "payouts: lire les siens"
  on public.payouts
  for select to authenticated
  using (commission_id in (
    select c.id
    from public.commissions c
    join public.affiliates a on a.id = c.affiliate_id
    where a.user_id = auth.uid()
  ));

create policy "payouts: superadmin voit tout"
  on public.payouts
  for select to authenticated
  using (public.is_superadmin());

-- AUCUNE policy insert/update/delete → payout réservé RPC service_role (D-15).

-- ─────────────────────────────────────────────────────────────────────────────
-- GRILLE DE TAUX : affiliate_rate_bps(p_signups) — D-01/D-02 (basis points)
-- Le palier (taux) est dérivé du NOMBRE D'INSCRITS via le code (audience, D-02),
-- PAS des abonnés actifs. immutable : fonction pure (mêmes entrées → même sortie).
-- ─────────────────────────────────────────────────────────────────────────────
create function public.affiliate_rate_bps(p_signups int)
  returns int
  language sql
  immutable
  set search_path = public  -- D-V2-05 : search_path figé sur toutes les fonctions (advisor function_search_path_mutable)
as $$
  select case
    when p_signups >= 50000 then 2000  -- 20.00 %
    when p_signups >= 25001 then 1800  -- 18.00 %
    when p_signups >= 10001 then 1700  -- 17.00 %
    when p_signups >= 5001  then 1600  -- 16.00 %
    when p_signups >= 1001  then 1500  -- 15.00 %
    when p_signups >= 501   then 1400  -- 14.00 %
    when p_signups >= 100   then 1200  -- 12.00 %
    when p_signups >= 1     then 800   --  8.00 %
    else 0
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC : compute_affiliate_commissions(p_period) — AFF-03/AFF-05 (miroir 0012 L.120-169)
-- Pour chaque (affilié, filleul actif, mois) : applique la grille selon le compteur
-- d'inscrits (D-02), calcule taux × Σ amount_atomic des paiements vérifiés du filleul
-- tombant dans le mois (D-03), exclut l'auto-parrainage (D-12), filtre les filleuls
-- ACTIFS (AFF-05), upsert idempotent sur UNIQUE(affiliate_id, referral_id, period) (D-05).
-- security definer + search_path figé (Pitfall 6) ; revoke execute (service_role bypass).
-- Bornes du mois en timestamptz UTC `[date_trunc, +1 month)` — PAS to_char (Pitfall 4).
-- ─────────────────────────────────────────────────────────────────────────────
create function public.compute_affiliate_commissions(p_period text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
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
    -- D-12 : EXCLUSION auto-parrainage au calcul (inviolable)
    and r.user_id <> a.user_id
  -- D-02 : compteur d'inscrits (audience) → détermine le taux
  join lateral (
    select count(*) as signups
    from public.referrals rr
    where rr.affiliate_id = a.id
  ) cnt on true
  -- D-03 : paiements vérifiés du filleul tombant dans le mois (bornes UTC, Pitfall 4)
  join public.payments p
    on p.user_id = r.user_id
    and p.status = 'verified'
    and p.verified_at >= v_period_start
    and p.verified_at <  v_period_end
  -- AFF-05 : filleul ACTIF (définition canonique 0009 — répliquée, pas auth.uid())
  join public.subscriptions s
    on s.user_id = r.user_id
    and s.status = 'active'
    and s.current_period_end > now()
  group by a.id, r.user_id, cnt.signups
  on conflict (affiliate_id, referral_id, period) do update
    set rate_bps      = excluded.rate_bps,
        base_atomic   = excluded.base_atomic,
        amount_atomic = excluded.amount_atomic
    where public.commissions.status = 'due';  -- jamais écraser une commission déjà payée (D-15)

  get diagnostics v_rows = row_count;
  return jsonb_build_object('period', p_period, 'rows', v_rows);
end;
$$;

-- Lockdown : seul le service_role (bypass) calcule les commissions.
revoke execute on function public.compute_affiliate_commissions(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC : mark_commission_paid(p_commission_id, p_tx_hash, p_amount_atomic) — AFF-04/D-15
-- Insère payouts ET transitionne la commission due→paid dans UNE SEULE transaction :
-- un payout enregistré et une commission marquée payée ne peuvent jamais diverger.
-- Anti double-payout (T-07-DOUBLEPAY) : l'UPDATE ne touche QUE les commissions encore
-- 'due' ; raise si row_count=0 (déjà payée ou inexistante). insert payouts APRÈS l'update
-- garanti unique → pas de payout orphelin sur une commission déjà payée.
-- security definer + search_path figé ; revoke execute (service_role bypass).
-- ─────────────────────────────────────────────────────────────────────────────
create function public.mark_commission_paid(
  p_commission_id uuid,
  p_tx_hash       text,
  p_amount_atomic bigint
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_updated int;
begin
  -- commission due -> paid (uniquement si encore due : anti double-payout)
  update public.commissions
     set status = 'paid'
   where id = p_commission_id
     and status = 'due';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'mark_commission_paid: commission % introuvable ou déjà payée', p_commission_id;
  end if;

  -- payout tracé (D-15) — insert seulement après la transition garantie unique
  insert into public.payouts (commission_id, tx_hash, amount_atomic)
  values (p_commission_id, p_tx_hash, p_amount_atomic);
end;
$$;

-- Lockdown : seul le service_role (bypass) marque une commission payée.
revoke execute on function public.mark_commission_paid(uuid, text, bigint) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- VUE : affiliate_dashboard — D-13/D-14, AFF-02 (no-PII, agrégats seuls)
-- security_invoker = true : hérite de la RLS de l'appelant ⇒ un affilié ne voit que SES
-- agrégats (⚠️ INVERSE de pattern_stats 0014 qui était security_invoker=false + anon).
-- ZÉRO user_id de filleul exposé (D-13). ::text sur les bigint sommés → PostgREST string
-- (CR-02, JAMAIS Number côté JS). Colonnes D-14 : inscrits, abonnés actifs, revenus
-- (cumul + mois courant), commissions dues/payées.
-- ─────────────────────────────────────────────────────────────────────────────
create view public.affiliate_dashboard with (security_invoker = true) as
select
  a.id                                                          as affiliate_id,
  count(distinct r.user_id)                                     as total_signups,        -- D-14 inscrits
  count(distinct s.user_id) filter (
    where s.status = 'active' and s.current_period_end > now()
  )                                                             as active_referrals,     -- D-14 abonnés actifs
  -- D-14 : revenus générés (revenu brut des filleuls) décomposés cumul vs mois courant
  coalesce(sum(p.amount_atomic), 0)::text                       as revenue_total_atomic,
  coalesce(sum(p.amount_atomic) filter (
    where to_char(p.verified_at, 'YYYY-MM') = to_char(now() at time zone 'utc', 'YYYY-MM')
  ), 0)::text                                                   as revenue_current_month_atomic,
  coalesce(sum(c.amount_atomic) filter (where c.status = 'due'),  0)::text as commissions_due_atomic,
  coalesce(sum(c.amount_atomic) filter (where c.status = 'paid'), 0)::text as commissions_paid_atomic
from public.affiliates a
left join public.referrals r     on r.affiliate_id = a.id
left join public.subscriptions s on s.user_id = r.user_id
left join public.payments p      on p.user_id = r.user_id and p.status = 'verified'
left join public.commissions c   on c.affiliate_id = a.id
where a.user_id = auth.uid()        -- isolation (la RLS sous-jacente la renforce)
group by a.id;
