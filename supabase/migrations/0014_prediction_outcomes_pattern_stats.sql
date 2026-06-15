-- Migration 0014 : prediction_outcomes + vue pattern_stats — track record mesuré Phase 5
-- TRACK-01 : table prediction_outcomes (issue rejouée d'un setup expiré, écrite par le job
--            outcome-tracker via service_role bypass — AUCUNE policy write, frontière D-05).
-- TRACK-02 : vue pattern_stats (agrégats win_rate + R moyen gagnants + expectancy + N brut),
--            lecture PUBLIQUE anon — PREMIÈRE policy/grant anon du projet.
--
-- Décisions :
--   D-17 : appliquer via MCP apply_migration, JAMAIS `supabase db push` (en-tête 0006).
--   D-05 : écriture service_role bypass — AUCUNE policy insert/update/delete sur prediction_outcomes.
--   D-06 : dimensions overall / style / asset / asset_class / score_band / risk.
--   D-10 : expectancy = AVG(realized_r) sur TOUS les trades ; win_rate = part de hit_tp.
--   D-11 : périodes all_time + 90d (resolved_at > now() - interval '90 days').
--   D-12 : N exposé BRUT (jamais masqué en DB ; le seuil N≥30 est appliqué côté front).
--   A1   : setups 'invalidated' rejoués pleinement (le job décide hit_tp/hit_sl/flat).
--   A2   : avg_r = AVG(realized_r) des GAGNANTS (outcome='hit_tp') uniquement ;
--          expectancy = AVG(realized_r) sur TOUS (gagnants + perdants + flat).
--
-- ⚠️ NUMÉRO = 0014 (PAS 0013, réservé au cluster paiement P4 différé).
-- ⚠️ get_advisors (security) DOIT confirmer que prediction_outcomes reste inaccessible
--    à anon (seuls les agrégats pattern_stats fuient) — gate phase obligatoire (Task 4).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : prediction_outcomes (TRACK-01, frontière producteur-unique D-05)
-- Une ligne par setup rejoué (PK setup_id = filet idempotence, Pitfall 3).
-- Minimisation des données : aucune colonne au-delà du strict nécessaire.
-- RLS : lecture authenticated ; écriture service_role bypass — AUCUNE policy write.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.prediction_outcomes (
  setup_id     uuid        primary key references public.trade_setups(id) on delete cascade,
  outcome      text        not null check (outcome in ('hit_tp','hit_sl','flat')),
  realized_r   numeric     not null,
  resolved_at  timestamptz not null default now(),
  candle_count int                                  -- traçabilité minimale (nb de bougies rejouées)
);

alter table public.prediction_outcomes enable row level security;

create policy "prediction_outcomes: lecture authentifiés"
  on public.prediction_outcomes
  for select to authenticated
  using (true);

-- AUCUNE policy insert/update/delete → écriture service_role bypass (frontière D-05, T-05-04)

-- ─────────────────────────────────────────────────────────────────────────────
-- VUE : pattern_stats (TRACK-02, PREMIÈRE lecture anon du projet)
-- Agrégats anonymes par (dimension, bucket, period). security_invoker=false :
-- la vue lit prediction_outcomes en bypass RLS pour exposer SEULEMENT les agrégats
-- à anon — jamais les lignes par setup (Pitfall 1, T-05-03).
--   n          : COUNT brut (jamais masqué — D-12).
--   win_rate   : part de hit_tp (AVG((outcome='hit_tp')::int)).
--   avg_r      : AVG(realized_r) FILTER (WHERE outcome='hit_tp') — R moyen des GAGNANTS (A2).
--   expectancy : AVG(realized_r) sur TOUS les trades (A2).
-- Dimensions D-06 × périodes D-11 (all_time + 90d) en UNION ALL.
-- ─────────────────────────────────────────────────────────────────────────────

create view public.pattern_stats
with (security_invoker = false) as
with resolved as (
  select
    o.outcome,
    o.realized_r,
    o.resolved_at,
    ts.style,
    ts.instrument_id,
    ts.opportunity_score,
    ts.risk_level,
    i.asset_class,
    case
      when ts.opportunity_score >= 80 then '80-100'
      when ts.opportunity_score >= 60 then '60-79'
      else '<60'
    end as score_band
  from public.prediction_outcomes o
  join public.trade_setups ts on ts.id = o.setup_id
  join public.instruments i on i.id = ts.instrument_id
),
periods as (
  select r.*, 'all_time'::text as period from resolved r
  union all
  select r.*, '90d'::text as period from resolved r
  where r.resolved_at > now() - interval '90 days'
)
-- overall
select 'overall'::text as dimension, 'all'::text as bucket, p.period,
       count(*)::int as n,
       avg((p.outcome = 'hit_tp')::int)::numeric as win_rate,
       avg(p.realized_r) filter (where p.outcome = 'hit_tp') as avg_r,
       avg(p.realized_r) as expectancy
from periods p
group by p.period
union all
-- style (day / swing)
select 'style', p.style, p.period,
       count(*)::int,
       avg((p.outcome = 'hit_tp')::int)::numeric,
       avg(p.realized_r) filter (where p.outcome = 'hit_tp'),
       avg(p.realized_r)
from periods p
group by p.style, p.period
union all
-- asset (par instrument)
select 'asset', p.instrument_id::text, p.period,
       count(*)::int,
       avg((p.outcome = 'hit_tp')::int)::numeric,
       avg(p.realized_r) filter (where p.outcome = 'hit_tp'),
       avg(p.realized_r)
from periods p
group by p.instrument_id, p.period
union all
-- asset_class (classe d'actif)
select 'asset_class', p.asset_class, p.period,
       count(*)::int,
       avg((p.outcome = 'hit_tp')::int)::numeric,
       avg(p.realized_r) filter (where p.outcome = 'hit_tp'),
       avg(p.realized_r)
from periods p
group by p.asset_class, p.period
union all
-- score_band (tranche de score)
select 'score_band', p.score_band, p.period,
       count(*)::int,
       avg((p.outcome = 'hit_tp')::int)::numeric,
       avg(p.realized_r) filter (where p.outcome = 'hit_tp'),
       avg(p.realized_r)
from periods p
group by p.score_band, p.period
union all
-- risk (risk_level)
select 'risk', p.risk_level, p.period,
       count(*)::int,
       avg((p.outcome = 'hit_tp')::int)::numeric,
       avg(p.realized_r) filter (where p.outcome = 'hit_tp'),
       avg(p.realized_r)
from periods p
group by p.risk_level, p.period;

-- PREMIÈRE lecture publique du projet : agrégats anonymes uniquement (⚠️ get_advisors Task 4).
grant select on public.pattern_stats to anon, authenticated;
