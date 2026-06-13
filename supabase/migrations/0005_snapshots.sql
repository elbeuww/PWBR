-- Migration 0005 : tables snapshots + asset_drivers — frontière de persistance Phase 3
-- snapshots : un snapshot daté par instrument × style × kind (technical/fundamental/news)
-- asset_drivers : drivers macro par actif, data-not-code extensible par UPDATE SQL
--
-- Décisions : D-41 (content_hash = raw_indicators_ref, idempotence), D-38 (asset_drivers data-not-code)
-- D-36 (timeframe_set ex 'H4/H1'), D-05 (écriture service_role bypass — AUCUNE policy write)
-- RLS : lecture authenticated, écriture service_role bypass — AUCUNE policy write (D-05)
-- Index uniques = clé d'upsert idempotent (référencés par nom dans les repositories)

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : snapshots (D-41)
-- Un snapshot calculé par (instrument_id, style, kind, computed_for_ts).
-- content_hash = raw_indicators_ref (sha256 du payload canonique) → référencé Phase 4.
-- payload jsonb = forme §3, validée Zod AVANT insert (côté job).
-- clé unique d'upsert : (instrument_id, style, kind, computed_for_ts) → index snapshots_uniq
-- ─────────────────────────────────────────────────────────────────────────────

create table public.snapshots (
  id                uuid        primary key default gen_random_uuid(),
  instrument_id     uuid        not null references public.instruments(id) on delete cascade,
  style             text        not null check (style in ('day','swing')),
  timeframe_set     text        not null,            -- ex 'H4/H1' (D-36)
  kind              text        not null check (kind in ('technical','fundamental','news')),
  computed_for_ts   timestamptz not null,            -- dernière bougie LTF clôturée
  content_hash      text        not null,            -- = raw_indicators_ref (D-41)
  payload           jsonb       not null,            -- forme §3, Zod-validée avant insert
  partial           boolean     not null default false,  -- gestion gap EMA200
  created_at        timestamptz not null default now()
);

alter table public.snapshots enable row level security;

create policy "snapshots: lecture authentifiés"
  on public.snapshots
  for select
  to authenticated
  using (true);

-- AUCUNE policy insert/update/delete → écriture service_role bypass (T-03-01, D-05)

-- Index unique d'upsert (DATA-06) — nommé snapshots_uniq car référencé dans les repositories
create unique index snapshots_uniq
  on public.snapshots (instrument_id, style, kind, computed_for_ts);

-- Index de lecture performant (latest-lookup, tri desc)
create index snapshots_read_idx
  on public.snapshots (instrument_id, style, kind, computed_for_ts desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : asset_drivers (D-38, data-not-code)
-- Drivers macro par actif : extensible par UPDATE/INSERT SQL, sans changer le code.
-- driver_code : 'DXY' | 'REAL_YIELDS' | 'RATE_DIFF' | 'RISK_SENTIMENT'
-- direction : +1 (corrélé positif) / -1 (corrélé inverse)
-- weight : poids du driver (défaut 1)
-- clé unique d'upsert : (instrument_id, driver_code) → index asset_drivers_uniq
-- ─────────────────────────────────────────────────────────────────────────────

create table public.asset_drivers (
  id            uuid    primary key default gen_random_uuid(),
  instrument_id uuid    not null references public.instruments(id) on delete cascade,
  driver_code   text    not null,        -- 'DXY','REAL_YIELDS','RATE_DIFF','RISK_SENTIMENT'
  direction     int     not null,        -- +1 / -1
  weight        numeric not null default 1
);

alter table public.asset_drivers enable row level security;

create policy "asset_drivers: lecture authentifiés"
  on public.asset_drivers
  for select
  to authenticated
  using (true);

-- AUCUNE policy insert/update/delete → écriture service_role bypass (T-03-02, D-05)

create unique index asset_drivers_uniq
  on public.asset_drivers (instrument_id, driver_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED : asset_drivers par actif (D-38)
-- Jointure sur instruments.symbol pour résoudre instrument_id.
--   Or (XAU_USD)  ↔ DXY(-1) + REAL_YIELDS(-1)  (or inversement corrélé au dollar et aux taux réels)
--   JPY (USD_JPY) ↔ RATE_DIFF(+1)              (différentiel de taux US-JP)
--   Crypto (BTC/ETH/SOL/BNB/XRP) ↔ RISK_SENTIMENT(+1) + DXY(-1)
-- Insert idempotent via on conflict (instrument_id, driver_code) do update (style 0003).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.asset_drivers (instrument_id, driver_code, direction, weight)
select i.id, d.driver_code, d.direction, d.weight
from public.instruments i
join (
  values
    -- Or : inversement corrélé au dollar et aux taux réels
    ('XAU_USD', 'DXY',            -1, 1.0),
    ('XAU_USD', 'REAL_YIELDS',    -1, 1.0),
    -- Yen : porté par le différentiel de taux US-JP
    ('USD_JPY', 'RATE_DIFF',      +1, 1.0),
    -- Crypto : risk-on (sentiment) et inversement corrélée au dollar
    ('BTCUSDT', 'RISK_SENTIMENT', +1, 1.0),
    ('BTCUSDT', 'DXY',            -1, 1.0),
    ('ETHUSDT', 'RISK_SENTIMENT', +1, 1.0),
    ('ETHUSDT', 'DXY',            -1, 1.0),
    ('SOLUSDT', 'RISK_SENTIMENT', +1, 1.0),
    ('SOLUSDT', 'DXY',            -1, 1.0),
    ('BNBUSDT', 'RISK_SENTIMENT', +1, 1.0),
    ('BNBUSDT', 'DXY',            -1, 1.0),
    ('XRPUSDT', 'RISK_SENTIMENT', +1, 1.0),
    ('XRPUSDT', 'DXY',            -1, 1.0)
) as d(symbol, driver_code, direction, weight)
  on d.symbol = i.symbol
on conflict (instrument_id, driver_code) do update set
  direction = excluded.direction,
  weight    = excluded.weight;
