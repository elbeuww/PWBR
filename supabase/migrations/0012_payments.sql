-- Migration 0012 : table payments + RLS producteur-unique + UNIQUE(tx_hash) GLOBAL
-- anti-replay + réservation d'offset (D-05) + RPC atomique d'activation.
--
-- CONVENTION REPO (CRITIQUE) : appliquée via MCP `apply_migration` (canal 0006/0008/
-- 0009/0011), JAMAIS `supabase db push`. Le projet n'est pas `link`é localement
-- (D-01-01-D / D-03-01-C) → `supabase gen types --linked` échoue par design ;
-- `database.types.ts` est édité à la main après application.
--
-- Décisions couvertes :
--   D-01  : adresse de réception cold wallet en .env, clé privée JAMAIS en code/DB.
--           Aucune adresse/secret n'est stocké dans cette table — uniquement tx_hash public.
--   D-05  : montant attendu UNIQUE (nominal + offset) réservé côté service_role, jamais
--           choisi par le client (index unique partiel `payments_expected_amount_active_idx`).
--   D-08  : transitions verified/rejected/ambiguous réservées service_role bypass —
--           AUCUNE policy update/delete pour authenticated.
--   D-11  : renouvellement = prolongation (greatest(current_period_end, now()) + period).
--
-- Patterns (miroir codebase) :
--   - text + check(... in (...)) plutôt qu'enum natif (cohérent 0001/0006/0009).
--   - lecture scopée user_id = auth.uid() + superadmin (miroir 0009 l.41-50).
--   - index unique partiel = filet DB contre une race concurrente (miroir 0006 l.93-95).
--   - RPC security definer set search_path = public + revoke execute (miroir 0008 l.29-47).
--
-- STRIDE : T-04-REPLAY (UNIQUE tx_hash GLOBAL — filet inviolable, le check applicatif a
--          une TOCTOU), T-04-RLS-ELEV (INSERT pending+self only, 0 update/delete),
--          T-04-INCONSIST (RPC atomique : payment->verified ET sub->active en 1 transaction).

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : payments (PAY-03/04/06, ADMIN-01/02)
-- status : pending (créé par l'user) → verified | rejected | ambiguous (service_role).
-- expected_amount_atomic : montant attendu UNIQUE réservé serveur (D-05), BigInt atomique
--   (USDT 6 décimales) — JAMAIS dérivé d'une entrée client.
-- amount_atomic : montant réellement constaté on-chain (null tant que pending).
-- reservation_expires_at : fin de réservation de l'offset (D-05), null hors fenêtre active.
-- tx_hash : hash de transaction public TRON ; AUCUN secret/adresse privée ici (D-01).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.payments (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references public.profiles(id) on delete cascade,
  tx_hash                 text        not null,
  plan                    text        not null check (plan in ('discovery', 'standard')),
  expected_amount_atomic  bigint      not null,
  amount_atomic           bigint,                 -- null tant que pending
  status                  text        not null default 'pending'
                                      check (status in ('pending', 'verified', 'rejected', 'ambiguous')),
  reject_reason           text,
  screenshot_url          text,
  reservation_expires_at  timestamptz,            -- D-05 (offset réservation)
  created_at              timestamptz not null default now(),
  verified_at             timestamptz
);

alter table public.payments enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- (a) Anti-replay GLOBAL (PAY-04, T-04-REPLAY) : le MÊME tx_hash ne peut jamais
-- exister deux fois, même en course concurrente entre deux INSERT simultanés.
-- C'est le SEUL garde-fou inviolable contre le double-crédit (le check applicatif
-- `getByHash` a une TOCTOU). La violation 23505 est mappée 'replay' côté repo.
create unique index payments_tx_hash_global_idx
  on public.payments (tx_hash);

-- (b) Réservation d'offset (D-05) : un seul montant attendu actif à la fois.
-- D-05 : durée de réservation = OFFSET_RESERVATION_MINUTES (60 min), valeur canonique partagée avec packages/supabase/repositories/payments.ts et Plan 05
-- L'index unique partiel garantit qu'un même `expected_amount_atomic` ne peut être
-- réservé par deux lignes `pending` simultanément (unicité GLOBALE du montant attendu).
-- NOTE (fix 0012) : le prédicat ne peut PAS référencer `now()` — Postgres exige un
-- prédicat IMMUTABLE (`42P17: functions in index predicate must be marked IMMUTABLE`).
-- La fenêtre d'expiration (`reservation_expires_at`) reste portée par la COLONNE et
-- libérée par un SWEEP applicatif explicite : les réservations `pending` expirées sont
-- transitionnées hors de `pending` (job `subscription-expiry`, Plan 06) → le montant
-- redevient réservable. Saturation (offsets pris) → `reserveOffset` boucle sur l'offset
-- suivant en micro-unités (Open Question 1) ; si saturé, réessayer après le sweep.
create unique index payments_expected_amount_active_idx
  on public.payments (expected_amount_atomic)
  where status = 'pending';

-- Index de lecture admin/back-office (superadmin liste tout, plus récent d'abord).
create index payments_status_created_idx
  on public.payments (status, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : producteur-unique (T-04-RLS-ELEV)
-- INSERT : l'user ne peut insérer QU'une ligne pending POUR LUI-MÊME.
-- SELECT : l'user lit les siennes ; le superadmin lit tout (ADMIN-01/02).
-- AUCUNE policy update/delete → transitions verified/rejected/ambiguous réservées
-- au service_role (bypass RLS), D-08.
-- ─────────────────────────────────────────────────────────────────────────────
create policy "payments: insérer la sienne en pending"
  on public.payments
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "payments: lire les siennes"
  on public.payments
  for select to authenticated
  using (user_id = auth.uid());

create policy "payments: superadmin voit tout"
  on public.payments
  for select to authenticated
  using (public.is_superadmin());

-- AUCUNE policy insert/update/delete supplémentaire → service_role bypass (D-08).

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC ATOMIQUE : activate_subscription_for_payment (T-04-INCONSIST)
-- Transitionne payment->verified ET subscription->active dans UNE SEULE transaction :
-- un paiement vérifié et un abonnement activé ne peuvent jamais diverger.
--   1. UPDATE payment status='verified', verified_at=now() WHERE id=p_payment_id AND
--      status='pending' (raise si la ligne n'existe pas / déjà transitionnée → idempotence
--      protégée : pas de double activation).
--   2. UPSERT subscriptions : si une ligne user existe, on la prolonge (D-11) ; sinon
--      on en crée une active. current_period_end = greatest(coalesce(end, now()), now()) + period.
-- security definer + search_path figé (Pitfall 6) ; revoke execute (service_role bypass).
-- ─────────────────────────────────────────────────────────────────────────────
create function public.activate_subscription_for_payment(
  p_payment_id uuid,
  p_user_id    uuid,
  p_plan       text,
  p_period     interval
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_updated int;
  v_sub_id  uuid;
begin
  -- 1. payment -> verified (uniquement si encore pending : anti double-activation)
  update public.payments
     set status      = 'verified',
         verified_at = now()
   where id = p_payment_id
     and status = 'pending';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'activate_subscription_for_payment: payment % introuvable ou non pending', p_payment_id;
  end if;

  -- 2. subscription -> active (prolongation si renouvellement, D-11)
  select id into v_sub_id
    from public.subscriptions
   where user_id = p_user_id
   order by created_at desc
   limit 1;

  if v_sub_id is null then
    insert into public.subscriptions (user_id, status, plan, current_period_end)
    values (p_user_id, 'active', p_plan, now() + p_period);
  else
    update public.subscriptions
       set status             = 'active',
           plan               = p_plan,
           current_period_end = greatest(coalesce(current_period_end, now()), now()) + p_period
     where id = v_sub_id;
  end if;
end;
$$;

-- Lockdown (A8) : seul le service_role (bypass) peut activer. public/anon/authenticated
-- ne doivent JAMAIS appeler cette RPC depuis le client.
revoke execute on function public.activate_subscription_for_payment(uuid, uuid, text, interval) from public, anon, authenticated;
