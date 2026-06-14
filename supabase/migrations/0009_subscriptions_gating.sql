-- Migration 0009 : subscriptions (squelette RÉEL P1, PAS un stub) + has_active_subscription()
-- + drop/recreate des policies de lecture trade_setups/analyses (barrière de données).
--
-- D-04 : subscriptions est une table RÉELLE dès P1 (activation = service_role en P4 →
--        AUCUNE policy insert/update/delete pour authenticated).
-- D-V2-04 : gating = défense en profondeur. La RLS has_active_subscription() est la
--           SEULE barrière non contournable (le front lit en anon-client — Pitfall #5).
-- A6 (TRANCHÉ) : la colonne d'expiration est `current_period_end` (D-05/CONTEXT),
--                PAS `expires_at` (ARCHITECTURE) ; le helper RLS référence ce même nom.
--
-- Patterns (miroir codebase) :
--   - table + enable RLS + policy for select to authenticated, AUCUNE policy write (0006)
--   - lecture scopée user_id = auth.uid() (miroir profiles 0001 "lire le sien")
--   - has_active_subscription() : security definer set search_path = public (miroir
--     is_superadmin 0008 / handle_new_user 0001 — Pitfall 6)
--   - drop/recreate policy par NOM EXACT (lus dans 0006 : un nom erroné fait échouer la migration)
--
-- Invariant producteur-unique préservé : AUCUNE écriture front introduite ; le
-- service_role bypass RLS pour les écritures (inchangé).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : subscriptions (D-04 — squelette réel)
-- status : pending (créé) → active (payé/vérifié service_role P4) → expired/canceled
-- plan   : discovery (offre découverte) / standard
-- current_period_end : fin de période courante (A6) ; nullable tant que pending
-- ─────────────────────────────────────────────────────────────────────────────
create table public.subscriptions (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  status              text        not null default 'pending'
                                  check (status in ('pending', 'active', 'expired', 'canceled')),
  plan                text        not null default 'standard'
                                  check (plan in ('discovery', 'standard')),
  current_period_end  timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Lecture scopée : chaque user ne lit QUE ses propres abonnements (T-01-04 isolation).
create policy "subscriptions: lire les siennes"
  on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

-- Le superadmin voit tous les abonnements (back-office P8).
create policy "subscriptions: superadmin voit tout"
  on public.subscriptions
  for select to authenticated
  using (public.is_superadmin());

-- AUCUNE policy insert/update/delete → activation/transition réservée service_role (P4, D-04).

-- Index de filtrage du gate (user_id + status + fenêtre d'expiry).
create index subscriptions_active_idx
  on public.subscriptions (user_id, status, current_period_end);

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER RLS : has_active_subscription() — security definer, search_path figé
-- Vrai SSI l'user courant a un abonnement status='active' ET current_period_end > now().
-- Référence current_period_end (A6) — DOIT matcher le nom de colonne ci-dessus.
-- ─────────────────────────────────────────────────────────────────────────────
create function public.has_active_subscription()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status = 'active'
      and s.current_period_end > now()
  );
$$;

revoke execute on function public.has_active_subscription() from public, anon;
grant execute on function public.has_active_subscription() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- DROP / RECREATE des policies de lecture (barrière de données = gating signaux)
-- NOMS EXACTS lus dans 0006 (l.38 et l.78) — un nom erroné fait échouer la migration.
-- Lecture conditionnée à un abonnement actif ; écriture service_role inchangée.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy "trade_setups: lecture authentifiés" on public.trade_setups;
create policy "trade_setups: abonnés actifs"
  on public.trade_setups
  for select to authenticated
  using (public.has_active_subscription());

drop policy "analyses: lecture authentifiés" on public.analyses;
create policy "analyses: abonnés actifs"
  on public.analyses
  for select to authenticated
  using (public.has_active_subscription());
