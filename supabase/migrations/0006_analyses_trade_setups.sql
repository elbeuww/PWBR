-- Migration 0006 : tables analyses + trade_setups — fondation persistante Phase 4
-- analyses     : trace d'une analyse IA (snapshot + traçabilité version model/prompt/schema/run_id)
-- trade_setups : plan de trade dérivé (JSON §3 + score/risque), 1 actif par clé d'immuabilité
--
-- Décisions : D-17 (appliquée via MCP apply_migration, PAS db push), D-05 (écriture
-- service_role bypass — AUCUNE policy write), D-45/SCORE-05 (immuabilité : seul status
-- transitionne, jamais les champs de prédiction), D-51 (traçabilité version), A2
-- (dénormalisation style/session sur trade_setups pour l'index d'expiry direct).
-- RLS : lecture authenticated, écriture service_role bypass — AUCUNE policy write (D-05).
--
-- Concern revue #1 (HIGH consensus) : la clé d'immuabilité D-45 « (instrument, style,
-- session, jour) » est matérialisée par une colonne session_day date (dérivée
-- déterministe de generated_at en UTC côté persist.ts), incluse dans l'index unique
-- partiel ET dans la signature de expirePriorSetups (miroir exact).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : analyses (D-51 traçabilité version)
-- Une analyse IA datée par run_id × session × style × instrument. snapshot jsonb =
-- forme §3 consommée pour traçabilité. model/prompt_version/schema_version/run_id
-- permettent de rejouer/auditer toute prédiction (D-51).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.analyses (
  id              uuid        primary key default gen_random_uuid(),
  run_id          text        not null,
  session         text        not null check (session in ('asia','london','newyork','eod-swing')),
  style           text        not null check (style in ('day','swing')),
  instrument_id   uuid        not null references public.instruments(id) on delete cascade,
  snapshot        jsonb       not null,            -- forme §3 (traçabilité)
  model           text        not null,            -- ex 'claude-...' (D-51)
  prompt_version  text        not null,            -- version du prompt vétéran (D-51)
  schema_version  text        not null,            -- version du contrat §3 (D-51)
  created_at      timestamptz not null default now()
);

alter table public.analyses enable row level security;

create policy "analyses: lecture authentifiés"
  on public.analyses
  for select to authenticated
  using (true);

-- AUCUNE policy insert/update/delete → écriture service_role bypass (T-04-01, D-05)

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : trade_setups (D-45 immuabilité, A2 dénormalisation)
-- Plan de trade dérivé d'une analyse. payload jsonb = JSON §3 complet.
-- style/session dénormalisés (A2) : permettent l'index d'expiry direct sans jointure.
-- session_day date (concern revue #1) : dimension « jour » de la clé d'immuabilité
-- D-45, dérivée déterministe de generated_at en UTC côté persist.ts.
-- Immuabilité (D-45/SCORE-05) : un seul setup 'active' par clé ; seul status
-- transitionne (active→expired/invalidated), jamais les champs de prédiction.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.trade_setups (
  id                uuid        primary key default gen_random_uuid(),
  analysis_id       uuid        not null references public.analyses(id) on delete cascade,
  instrument_id     uuid        not null references public.instruments(id) on delete cascade,
  style             text        not null check (style in ('day','swing')),                 -- A2 dénormalisé
  session           text        not null check (session in ('asia','london','newyork','eod-swing')), -- A2 dénormalisé
  session_day date not null,          -- clé immuabilité D-45 (jour UTC, concern revue #1)
  direction         text        not null check (direction in ('long','short')),
  opportunity_score int         not null,          -- produit par le code (D-42)
  risk_level        text        not null check (risk_level in ('low','medium','high','extreme')),
  confidence        text        not null check (confidence in ('low','moderate','high')),
  entry_price       numeric     not null,
  stop_loss         numeric     not null,
  take_profits      jsonb       not null,
  risk_reward       numeric     not null,          -- recalculé par le code (D-50)
  payload           jsonb       not null,          -- JSON §3 complet
  status            text        not null default 'active' check (status in ('active','invalidated','expired')),
  valid_until       timestamptz not null,
  created_at        timestamptz not null default now()
);

alter table public.trade_setups enable row level security;

create policy "trade_setups: lecture authentifiés"
  on public.trade_setups
  for select to authenticated
  using (true);

-- AUCUNE policy insert/update/delete → écriture service_role bypass (T-04-01, D-05)

-- Index de lecture dashboard (§4) : meilleures opportunités d'abord
create index trade_setups_score_idx
  on public.trade_setups (opportunity_score desc, created_at desc);

-- Clé d'immuabilité D-45 AVEC session_day (concern revue #1).
-- UNIQUE partiel = filet DB contre la race expire→insert P1 (D-43) : deux 'active'
-- pour la même clé sont impossibles. RPC atomique reportée P1 (risque résiduel
-- documenté, concern archi [HIGH] race). Miroir exact de expirePriorSetups.
create unique index trade_setups_versionkey_idx
  on public.trade_setups (instrument_id, style, session, session_day)
  where status = 'active';
