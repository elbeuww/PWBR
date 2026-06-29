-- Migration 0018 : colonne `source` de provenance (Phase 18, milestone v3.0, seed à l'échelle).
-- Ancre TESTABLE de SEED-02 (labellisation requêtable) et clé de purge sûre de D-06
-- (delete WHERE source='demo' n'efface JAMAIS d'éventuelles lignes 'live'). Pose la
-- fondation gatée : rien ne peut être seedé tant que la colonne n'existe pas LIVE.
--
-- CONVENTION REPO (CRITIQUE) : appliquée via MCP `apply_migration` (canal 0006/0008/
-- 0009/0011/0012/0014/0015/0016/0017), JAMAIS `supabase db push`. Le projet n'est pas
-- `link`é localement (D-01-01-D / D-05-02-D) → `supabase gen types --linked` échoue par
-- design ; `database.types.ts` est édité à la main APRÈS `generate_typescript_types`
-- (ré-application des alias maison + override string `*_atomic`, Pitfall 5).
--
-- ⚠️ NUMÉRO = 0018 (0017 = dernière migration sur disque ; 0013 est ABSENTE — réservée
--    au cluster paiement P4 différé, NE PAS la réutiliser).
--
-- ⚠️ DÉCOUPAGE APPLICATION (Pitfall 1) :
--    - Partie A (ce corps SQL) = DDL transactionnel → `apply_migration`.
--    - Partie B (commentée en fin de fichier) = `CREATE INDEX CONCURRENTLY` → EXÉCUTÉE
--      VIA `execute_sql` UN STATEMENT À LA FOIS (plan 18-02), JAMAIS dans `apply_migration`
--      (CONCURRENTLY interdit en transaction → erreur 25001).
--
-- Décisions couvertes :
--   D-01 : colonne `source` ∈ {live,demo,backtest} sur les 8 tables seedées en racine de
--          cohorte, `default 'live'` (les lignes existantes deviennent 'live', future-proof ;
--          le futur branchement réel écrira 'live', le seed écrit 'demo').
--   Périmètre 8 tables (RESEARCH §"Détermination du périmètre exact") : profiles,
--          subscriptions, payments, analyses, trade_setups, prediction_outcomes,
--          affiliates, commissions. Les tables filles cascadées (affiliate_codes,
--          referrals, payouts) sont purgées par cascade FK depuis une table colonnée →
--          PAS de colonne. Les tables volume (candles, snapshots, job_runs,
--          telegram_posts) ne sont PAS seedées en P18 → PAS de colonne (réduit la surface
--          0018 ; tranche Open Question 1 / A4 vers le périmètre minimal).
--
-- ⚠️ ANTI-PATTERN BLOQUANT (V4 / T-18-01) : `source` est un LABEL de provenance, JAMAIS un
--    gate de lecture. AUCUNE policy `using (source = …)`. Cette migration ne crée/modifie
--    AUCUNE policy RLS. `get_advisors(security)` post-apply (plan 18-02) confirme l'absence
--    de nouvelle fuite.
--
-- Patterns (miroir codebase) :
--   - text + check(... in (...)) plutôt qu'enum natif (cohérent 0001/0008/0009/0012/0016).
--   - forme exacte colonne+CHECK : miroir 0008 L.20-22 (profiles.role).

-- ═════════════════════════════════════════════════════════════════════════════
-- PARTIE A — DDL TRANSACTIONNEL (via apply_migration)
-- Colonne `source` sur les 8 tables seedées en racine de cohorte.
-- `not null default 'live'` : couvre les lignes existantes ET les futurs inserts non
-- labellisés ; le seed force explicitement 'demo'.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));

alter table public.subscriptions
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));

alter table public.payments
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));

alter table public.analyses
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));

alter table public.trade_setups
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));

alter table public.prediction_outcomes
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));

alter table public.affiliates
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));

alter table public.commissions
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));

-- ═════════════════════════════════════════════════════════════════════════════
-- PARTIE B — INDEX PARTIELS CONCURRENTLY HORS TRANSACTION
-- ⚠️ NE PAS dans apply_migration — Pitfall 1, erreur 25001
--    « CREATE INDEX CONCURRENTLY cannot run inside a transaction block ».
-- Exécuter via MCP execute_sql UN STATEMENT À LA FOIS (plan 18-02), JAMAIS groupés.
-- Après CHAQUE statement : vérifier indisvalid=true (gate INVALID, miroir 0017 Partie B).
-- Si INVALID → drop index concurrently if exists <name> puis relancer.
--
-- Index PARTIELS `WHERE source = 'demo'` : accélèrent le delete ciblé D-06 sur les grosses
-- tables purgées DIRECTEMENT (RESEARCH §"La migration 0018 doit-elle indexer source ?").
-- Bornés à 'demo' → empreinte minimale (les lignes 'live' n'y figurent pas). Miroir
-- 0017 L.350-361. analyses/trade_setups/payments = les 3 tables au plus gros volume
-- purgé sans cascade user directe.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- create index concurrently analyses_source_demo_idx on public.analyses (source) where source = 'demo';
-- create index concurrently trade_setups_source_demo_idx on public.trade_setups (source) where source = 'demo';
-- create index concurrently payments_source_demo_idx on public.payments (source) where source = 'demo';
--
-- ─────────────────────────────────────────────────────────────────────────────
-- GATE INVALID (après chaque CREATE CONCURRENTLY, via MCP execute_sql) :
-- select c.relname as index_name, t.relname as table_name
-- from pg_index i
-- join pg_class c on c.oid = i.indexrelid
-- join pg_class t on t.oid = i.indrelid
-- where not i.indisvalid and c.relnamespace = 'public'::regnamespace;
--   Remédiation (hors tx), puis relancer le CREATE INDEX CONCURRENTLY :
-- drop index concurrently if exists analyses_source_demo_idx;
-- drop index concurrently if exists trade_setups_source_demo_idx;
-- drop index concurrently if exists payments_source_demo_idx;
