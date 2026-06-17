-- Migration 0015 : table telegram_posts — idempotence des publications Telegram (TG-03)
--
-- CONVENTION REPO (CRITIQUE) : appliquée via MCP `apply_migration`, JAMAIS
-- `supabase db push`. Le projet n'est pas `link`é localement (D-01-01-D / D-05-02-D)
-- → `supabase gen types --linked` échoue par design ; `database.types.ts` est édité
-- à la main (ré-application des alias maison) après `generate_typescript_types`.
--
-- ⚠️ NUMÉRO = 0015 (PAS 0013, réservé au cluster paiement P4 différé ; 0014 = dernière
--    migration sur disque, prediction_outcomes / pattern_stats Phase 5).
--
-- Décisions couvertes :
--   D-05  : frontière producteur-unique — seul le job (service_role bypass RLS) écrit
--           telegram_posts. AUCUNE policy insert/update/delete (RLS active, write = bypass).
--   TG-03 : UNIQUE(dedupe_key) GLOBAL = filet anti double-post inviolable (miroir exact
--           de UNIQUE(tx_hash) P4 / 0012 l.63-64). Un même événement publiable ne peut
--           être inséré qu'une fois quel que soit le nombre de re-runs du job.
--
-- Patterns (miroir codebase) :
--   - text + check(... in (...)) plutôt qu'enum natif (cohérent 0001/0012).
--   - RLS active SANS policy write = écriture service_role bypass (miroir 0014 l.44).
--   - AUCUN secret (bot token, channel_id) ici — uniquement métadonnées de traçabilité.
--
-- dedupe_key (Pattern 4) — clé d'idempotence applicative :
--   - recap quotidien   → `recap:<YYYY-MM-DD UTC>`
--   - notable intraday  → `notable:<setup_id>`
--   - winrate vendredi  → `winrate:<YYYY-MM-DD UTC>`
--
-- STRIDE : T-06-DUP (UNIQUE dedupe_key GLOBAL — filet inviolable, le check applicatif a
--          une TOCTOU), T-06-RLS (RLS active + 0 policy write → inaccessible anon,
--          get_advisors security le confirme au gate phase).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : telegram_posts (TG-03, frontière producteur-unique D-05)
-- Une ligne par publication réussie. Minimisation des données : aucune colonne
-- au-delà du strict nécessaire (ni niveaux de trade, ni secret).
-- RLS : active, AUCUNE policy write → écriture service_role bypass uniquement.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.telegram_posts (
  id            uuid        primary key default gen_random_uuid(),
  dedupe_key text not null unique,                                             -- filet idempotence GLOBAL (TG-03)
  post_type     text        not null check (post_type in ('recap','notable','winrate')),
  posted_at     timestamptz not null default now(),
  tg_message_id bigint,                                                        -- id sendMessage (traçabilité)
  run_id        uuid        references public.job_runs(id) on delete set null  -- run du job ayant publié
);

alter table public.telegram_posts enable row level security;

-- AUCUNE policy insert/update/delete → write = service_role bypass, no policy by design
-- (D-05 / producer-boundary). Aucun client anon/authenticated n'écrit ni ne lit cette table.
