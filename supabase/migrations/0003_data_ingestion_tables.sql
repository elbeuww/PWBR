-- Migration 0003 : tables d'ingestion — candles, news, macro_series, economic_calendar
-- Extension instruments + seed 12 instruments MVP + vue v_data_freshness
--
-- Décisions : D-14..D-20 (univers, métadonnées), D-24 (pas de purge), D-26/D-27 (stale vue)
-- RLS : lecture authenticated, écriture service_role bypass — AUCUNE policy write (D-05)
-- Tous les index uniques servent de clé d'upsert idempotent (DATA-06)

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSION TABLE instruments
-- Ajouter les colonnes de métadonnées trading (D-18/D-19)
-- canonical_symbol : identifiant lisible unifié (BTC/USD, EUR/USD, XAU/USD...)
-- source_symbol    : symbole technique par source (BTCUSDT, EUR_USD, WTICO_USD...)
-- price_decimals   : décimales d'affichage du prix
-- quote_hours      : '24/7' pour crypto (toujours évaluable), 'fx' pour forex/commodities
--                    (fermeture week-end vendredi 17:00 NY → dimanche 17:00 NY = jamais stale)
-- is_active        : flag extensibilité (D-17) — ajouter/désactiver sans changer le code
--
-- Note asset_class : la P1 utilise 'metal'/'energy' pour les commodities OANDA.
-- Décision D-19 : on conserve 'metal' et 'energy' comme valeurs distinctes (XAG_USD = metal,
-- WTICO_USD = energy, XAU_USD = metal) plutôt qu'un 'commodity' générique — plus précis
-- pour le filtrage par type d'actif. La check constraint P1 couvre déjà 'metal'/'energy'.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.instruments
  add column if not exists canonical_symbol text,
  add column if not exists source_symbol    text,
  add column if not exists price_decimals   int,
  add column if not exists quote_hours      text;  -- '24/7' | 'fx'

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED : 12 instruments MVP
-- Insert avec on conflict (symbol) do update : ne duplique pas les 3 lignes P1.
-- D-14 : 5 crypto Binance (paires USDT, mainnet public REST pour klines)
-- D-15 : 4 forex OANDA majors USD
-- D-16 : 3 commodities OANDA (XAU, XAG, WTI — pas de Brent)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.instruments
  (symbol,       canonical_symbol, source_symbol, broker,    asset_class, display_name,          price_decimals, quote_hours, pip_size,  min_size, precision, active)
values
  -- Crypto Binance (24/7)
  ('BTCUSDT',  'BTC/USD',  'BTCUSDT',  'binance', 'crypto', 'Bitcoin / USDT',         2,  '24/7', 1.0,    0.001, 2,  true),
  ('ETHUSDT',  'ETH/USD',  'ETHUSDT',  'binance', 'crypto', 'Ethereum / USDT',        2,  '24/7', 0.1,    0.01,  2,  true),
  ('SOLUSDT',  'SOL/USD',  'SOLUSDT',  'binance', 'crypto', 'Solana / USDT',          3,  '24/7', 0.01,   0.1,   3,  true),
  ('BNBUSDT',  'BNB/USD',  'BNBUSDT',  'binance', 'crypto', 'Binance Coin / USDT',    2,  '24/7', 0.1,    0.01,  2,  true),
  ('XRPUSDT',  'XRP/USD',  'XRPUSDT',  'binance', 'crypto', 'XRP / USDT',             5,  '24/7', 0.0001, 1.0,   5,  true),
  -- Forex OANDA (horaires FX : fermé vendredi 17:00 NY → dimanche 17:00 NY)
  ('EUR_USD',  'EUR/USD',  'EUR_USD',  'oanda',   'forex',  'Euro / Dollar',           5,  'fx',   0.0001, 1000,  5,  true),
  ('GBP_USD',  'GBP/USD',  'GBP_USD',  'oanda',   'forex',  'Livre Sterling / Dollar', 5,  'fx',   0.0001, 1000,  5,  true),
  ('USD_JPY',  'USD/JPY',  'USD_JPY',  'oanda',   'forex',  'Dollar / Yen Japonais',   3,  'fx',   0.01,   1000,  3,  true),
  ('AUD_USD',  'AUD/USD',  'AUD_USD',  'oanda',   'forex',  'Dollar Australien / USD', 5,  'fx',   0.0001, 1000,  5,  true),
  -- Commodities OANDA (quote_hours='fx' : même calendrier FX pour l'or/argent/pétrole)
  ('XAU_USD',  'XAU/USD',  'XAU_USD',  'oanda',   'metal',  'Or / USD',                2,  'fx',   0.01,   0.1,   2,  true),
  ('XAG_USD',  'XAG/USD',  'XAG_USD',  'oanda',   'metal',  'Argent / USD',            3,  'fx',   0.001,  50.0,  3,  true),
  ('WTICO_USD','WTI/USD',  'WTICO_USD','oanda',   'energy', 'WTI Pétrole / USD',       2,  'fx',   0.01,   25.0,  2,  true)
on conflict (symbol) do update set
  canonical_symbol = excluded.canonical_symbol,
  source_symbol    = excluded.source_symbol,
  price_decimals   = excluded.price_decimals,
  quote_hours      = excluded.quote_hours,
  broker           = excluded.broker,
  asset_class      = excluded.asset_class,
  display_name     = excluded.display_name,
  pip_size         = excluded.pip_size,
  min_size         = excluded.min_size,
  precision        = excluded.precision,
  active           = excluded.active;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : candles
-- Bougie OHLCV multi-timeframe pour chaque instrument.
-- clé unique d'upsert : (instrument_id, timeframe, ts) → index candles_uniq
-- ─────────────────────────────────────────────────────────────────────────────

create table public.candles (
  id            uuid        primary key default gen_random_uuid(),
  instrument_id uuid        not null references public.instruments(id) on delete cascade,
  timeframe     text        not null check (timeframe in ('H1','H4','D')),
  ts            timestamptz not null,
  open          numeric     not null,
  high          numeric     not null,
  low           numeric     not null,
  close         numeric     not null,
  volume        numeric
);

alter table public.candles enable row level security;

create policy "candles: lecture authentifiés"
  on public.candles
  for select
  to authenticated
  using (true);

-- AUCUNE policy insert/update/delete → écriture service_role bypass (T-02-01)

-- Index unique d'upsert (DATA-06) — nommé candles_uniq car référencé dans les repositories
create unique index candles_uniq
  on public.candles (instrument_id, timeframe, ts);

-- Index de lecture performant (tri desc pour getLastCandleTs)
create index candles_read_idx
  on public.candles (instrument_id, timeframe, ts desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : news
-- Articles + sentiment par instrument depuis Finnhub/Marketaux.
-- clé unique d'upsert : url_hash → index news_uniq
-- ─────────────────────────────────────────────────────────────────────────────

create table public.news (
  id             uuid        primary key default gen_random_uuid(),
  source         text        not null,
  url_hash       text        not null,
  title          text        not null,
  summary        text,
  published_at   timestamptz not null,
  sentiment      numeric     check (sentiment >= -1 and sentiment <= 1),
  impact         text,
  instrument_ids uuid[]      not null default '{}'
);

alter table public.news enable row level security;

create policy "news: lecture authentifiés"
  on public.news
  for select
  to authenticated
  using (true);

-- Index unique d'upsert
create unique index news_uniq
  on public.news (url_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : macro_series
-- Séries macro FRED (taux Fed, CPI, DXY proxy, taux réels).
-- clé unique d'upsert : (series_code, ts) → index macro_series_uniq
-- Séries cibles : DFF (taux Fed Funds), CPIAUCSL (CPI), DTWEXBGS (DXY proxy), DFII10 (taux réels 10 ans)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.macro_series (
  id          uuid        primary key default gen_random_uuid(),
  series_code text        not null,
  ts          timestamptz not null,
  value       numeric     not null
);

alter table public.macro_series enable row level security;

create policy "macro_series: lecture authentifiés"
  on public.macro_series
  for select
  to authenticated
  using (true);

-- Index unique d'upsert
create unique index macro_series_uniq
  on public.macro_series (series_code, ts);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : economic_calendar
-- Événements macroéconomiques (FOMC, CPI, NFP, décisions de taux...).
-- Source : FairEconomy/ForexFactory JSON (gratuit, sans clé).
-- clé unique d'upsert : event_key → index economic_calendar_uniq
-- ─────────────────────────────────────────────────────────────────────────────

create table public.economic_calendar (
  id          uuid        primary key default gen_random_uuid(),
  event_key   text        not null,
  title       text        not null,
  country     text,
  event_at    timestamptz not null,
  impact      text        check (impact in ('High','Medium','Low')),
  forecast    text,
  previous    text,
  source      text        not null
);

alter table public.economic_calendar enable row level security;

create policy "economic_calendar: lecture authentifiés"
  on public.economic_calendar
  for select
  to authenticated
  using (true);

-- Index unique d'upsert
create unique index economic_calendar_uniq
  on public.economic_calendar (event_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- VUE : v_data_freshness
-- Staleness par (instrument_id, timeframe) — D-26/D-27, Pitfall 4.
--
-- Logique :
--   seuil_stale = 2 × durée_timeframe (H1=2h, H4=8h, D=48h)
--   marché fermé (quote_hours='fx') le week-end → is_stale = false
--   Week-end FX : vendredi 17:00 NY → dimanche 17:00 NY
--     (America/New_York ; on raisonne en UTC avec offset NY≃UTC-4/UTC-5)
--   Crypto (quote_hours='24/7') → toujours évaluable
--
-- Note : la vue ne bloque pas les analyses (Phase 4). Elle expose l'état (D-27).
-- ─────────────────────────────────────────────────────────────────────────────

create view public.v_data_freshness as
with latest_candles as (
  -- Dernière bougie connue par (instrument_id, timeframe)
  select distinct on (instrument_id, timeframe)
    instrument_id,
    timeframe,
    ts as last_ts
  from public.candles
  order by instrument_id, timeframe, ts desc
),
timeframe_config as (
  -- Durée en heures par timeframe (seuil = 2×)
  select 'H1' as timeframe, 1  as tf_hours union all
  select 'H4',              4             union all
  select 'D',               24
),
market_state as (
  -- Est-ce que le marché est ouvert pour les instruments FX ?
  -- Week-end FX = samedi toute la journée UTC + dimanche avant 21:00 UTC
  --   (vendredi 17:00 NY ≈ vendredi 21:00 UTC été / 22:00 UTC hiver)
  --   (dimanche 17:00 NY ≈ dimanche 21:00 UTC été / 22:00 UTC hiver)
  -- On utilise une heuristique conservatrice : is_weekend_fx = true si
  --   extract(dow from now() at time zone 'UTC') = 6 (samedi) OU
  --   (extract(dow ...) = 0 ET extract(hour ...) < 21) (dimanche avant 21:00 UTC)
  select
    case
      when extract(dow from now() at time zone 'UTC') = 6
        then true   -- samedi entier = week-end FX
      when extract(dow from now() at time zone 'UTC') = 0
           and extract(hour from now() at time zone 'UTC') < 21
        then true   -- dimanche avant 21:00 UTC = week-end FX
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
    -- Crypto 24/7 : stale si age > 2× timeframe (en heures)
    when i.quote_hours = '24/7' then
      (now() - lc.last_ts) > (tc.tf_hours * 2 || ' hours')::interval
    -- FX/commodities : jamais stale pendant le week-end FX (Pitfall 4)
    when i.quote_hours = 'fx' and ms.is_weekend_fx = true then
      false
    -- FX/commodities hors week-end : stale si age > 2× timeframe
    else
      (now() - lc.last_ts) > (tc.tf_hours * 2 || ' hours')::interval
  end as is_stale
from latest_candles lc
join public.instruments i on i.id = lc.instrument_id
join timeframe_config tc on tc.timeframe = lc.timeframe
cross join market_state ms;

-- Commentaire d'intention (visible dans pg_catalog)
comment on view public.v_data_freshness is
  'Staleness par (instrument_id, timeframe). is_stale respecte les horaires de cotation : '
  'crypto (24/7) = toujours évaluable ; forex/commodities (fx) = jamais stale le week-end FX '
  '(vendredi 17:00 NY → dimanche 21:00 UTC). Seuil = 2× la durée du timeframe (D-26).';
