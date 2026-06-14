-- Migration 0010 : has_active_subscription() — gère current_period_end NULL (CR-05)
--
-- Bug corrigé : en Postgres `NULL > now()` vaut NULL (falsy). Un abonnement
-- status='active' avec current_period_end IS NULL (abonnement perpétuel, compte
-- de test, ou ligne créée par service_role sans date de fin en P4) était donc
-- bloqué à tort par la barrière RLS et par le gate UX.
--
-- Contrat : status='active' ET (current_period_end IS NULL  -- pas d'expiration
--                               OR current_period_end > now()).
-- Direction de sécurité inchangée : un non-abonné (aucune ligne active) reste à 0.
--
-- security definer + search_path figé conservés (Pitfall 6). CREATE OR REPLACE :
-- la signature, les GRANT (revoke public/anon ; grant authenticated de 0009) et
-- les policies "abonnés actifs" qui l'invoquent restent valides.

create or replace function public.has_active_subscription()
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
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;
