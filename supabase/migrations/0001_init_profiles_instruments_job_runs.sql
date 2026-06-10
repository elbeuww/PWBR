-- Migration 0001 : walking skeleton — profiles, instruments, job_runs
-- D-04 : schéma minimum (profiles/instruments/job_runs uniquement)
-- D-05 : RLS active sur TOUTES les tables + policies explicites (Pitfall 3)
-- D-06 : profiles = champs minimaux id/email/created_at + trigger handle_new_user
-- Source: 01-RESEARCH.md §Code Examples

-- ────────────────────────────────────────────
-- TABLE : profiles
-- ────────────────────────────────────────────
create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- chaque utilisateur lit/modifie uniquement sa propre ligne (D-05)
create policy "profiles: lire le sien"
  on public.profiles
  for select
  using (id = auth.uid());

create policy "profiles: modifier le sien"
  on public.profiles
  for update
  using (id = auth.uid());

-- ────────────────────────────────────────────
-- TABLE : instruments
-- ────────────────────────────────────────────
create table public.instruments (
  id           uuid        primary key default gen_random_uuid(),
  symbol       text        unique not null,
  broker       text        not null check (broker in ('oanda', 'binance')),
  asset_class  text        not null check (asset_class in ('crypto', 'forex', 'metal', 'energy')),
  display_name text        not null,
  pip_size     numeric,
  min_size     numeric,
  precision    int,
  active       boolean     not null default true
);

alter table public.instruments enable row level security;

-- lecture pour les utilisateurs authentifiés (D-05)
create policy "instruments: lecture authentifiés"
  on public.instruments
  for select
  to authenticated
  using (true);

-- AUCUNE policy insert/update/delete pour authenticated →
-- modifications réservées à service_role (bypass RLS)

-- ────────────────────────────────────────────
-- TABLE : job_runs
-- ────────────────────────────────────────────
create table public.job_runs (
  id          uuid        primary key default gen_random_uuid(),
  job_name    text        not null,
  status      text        not null check (status in ('running', 'success', 'error')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  error       text,
  stats       jsonb
);

alter table public.job_runs enable row level security;

-- lecture pour les utilisateurs authentifiés (D-05)
create policy "job_runs: lecture authentifiés"
  on public.job_runs
  for select
  to authenticated
  using (true);

-- AUCUNE policy insert/update pour authenticated →
-- écriture via service_role uniquement (bypass RLS) — JOB-04

-- ────────────────────────────────────────────
-- TRIGGER : handle_new_user — auto-création du profil
-- D-06 : atomique avec l'insert auth.users
-- CRITIQUE : set search_path = '' obligatoire (Pitfall 4 / T-04)
-- ────────────────────────────────────────────
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''         -- CRITIQUE : évite le détournement via search_path (T-04)
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────
-- SEED : quelques instruments pour la lecture UI
-- ────────────────────────────────────────────
insert into public.instruments (symbol, broker, asset_class, display_name, pip_size, min_size, precision, active)
values
  ('XAU_USD',  'oanda',   'metal',  'Or / USD',          0.01,  0.1,   2, true),
  ('EUR_USD',  'oanda',   'forex',  'Euro / USD',         0.0001,1000,  5, true),
  ('BTCUSDT',  'binance', 'crypto', 'Bitcoin / USDT',     1.0,   0.001, 2, true);
