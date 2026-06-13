-- Migration 0004 : correction heuristique week-end FX dans v_data_freshness
--
-- WR-05 fix : la vue 0003 utilisait une heuristique UTC avec deux trous :
--   1. Vendredi 21:00 UTC → samedi 00:00 UTC : marché fermé mais is_weekend_fx=false
--      (faux stale jusqu'à 3h chaque vendredi soir)
--   2. Dimanche 21:00–22:00 UTC en hiver (EST) : marché encore fermé mais is_weekend_fx=false
--      (faux stale 1h chaque dimanche en hiver)
--
-- Fix : raisonner directement en America/New_York (DST géré nativement par Postgres).
-- Fermeture FX = vendredi ≥ 17h NY (DOW=5, hour≥17) + samedi entier (DOW=6)
--                + dimanche avant 17h NY (DOW=0, hour<17).
--
-- ⚠️  DO NOT APPLY manually — apply via Supabase MCP tool (apply_migration).
--     Ce fichier est écrit par le fixer (phase 02) et doit être validé avant
--     application en production.

-- Recréer la vue avec le CTE market_state corrigé
-- (drop + create car Postgres ne supporte pas CREATE OR REPLACE sur les vues avec WITH options)
drop view if exists public.v_data_freshness;

create view public.v_data_freshness
  with (security_invoker = true)
as
with latest_candles as (
  select distinct on (instrument_id, timeframe)
    instrument_id,
    timeframe,
    ts as last_ts
  from public.candles
  order by instrument_id, timeframe, ts desc
),
timeframe_config as (
  select 'H1' as timeframe, 1  as tf_hours union all
  select 'H4',              4             union all
  select 'D',               24
),
market_state as (
  -- Week-end FX raisonné en America/New_York (DST géré par Postgres).
  -- Fermeture : vendredi ≥ 17h NY → dimanche < 17h NY.
  --   DOW 5 = vendredi, DOW 6 = samedi, DOW 0 = dimanche.
  select
    case
      when extract(dow  from now() at time zone 'America/New_York') = 6
        then true   -- samedi entier NY = week-end FX
      when extract(dow  from now() at time zone 'America/New_York') = 5
           and extract(hour from now() at time zone 'America/New_York') >= 17
        then true   -- vendredi ≥ 17h NY = marché fermé FX
      when extract(dow  from now() at time zone 'America/New_York') = 0
           and extract(hour from now() at time zone 'America/New_York') < 17
        then true   -- dimanche avant 17h NY = marché encore fermé FX
      else false
    end as is_weekend_fx
)
select
  lc.instrument_id,
  lc.timeframe,
  lc.last_ts,
  i.canonical_symbol,
  i.quote_hours,
  case
    when i.quote_hours = '24/7' then
      (now() - lc.last_ts) > (tc.tf_hours * 2 || ' hours')::interval
    when i.quote_hours = 'fx' and ms.is_weekend_fx = true then
      false
    else
      (now() - lc.last_ts) > (tc.tf_hours * 2 || ' hours')::interval
  end as is_stale
from latest_candles lc
join public.instruments i on i.id = lc.instrument_id
join timeframe_config tc on tc.timeframe = lc.timeframe
cross join market_state ms;

comment on view public.v_data_freshness is
  'Staleness par (instrument_id, timeframe). is_stale respecte les horaires de cotation : '
  'crypto (24/7) = toujours evaluable ; forex/commodities (fx) = jamais stale le week-end FX '
  '(vendredi 17:00 NY → dimanche 17:00 NY). DST gere nativement par Postgres via America/New_York. '
  'Seuil = 2x la duree du timeframe (D-26).';
