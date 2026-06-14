-- Migration 0008 : profiles.role (source de vérité du rôle hors JWT) + is_superadmin()
-- D-05 / D-V2-05 : le rôle vit en DB, JAMAIS dans le JWT (token périmé/forgé ne doit
-- jamais déduire un privilège — Pitfall #7 / T-01-02). is_superadmin() lit profiles
-- APRÈS auth.uid().
--
-- Patterns (miroir codebase) :
--   - text + check(... in (...)) plutôt qu'enum natif (cohérent 0001 broker/asset_class)
--   - security definer set search_path = public (miroir handle_new_user 0001 ; figé = Pitfall 6)
--   - revoke execute from public,anon + grant to authenticated (pattern défensif 0002)
--
-- AUCUNE nouvelle policy profiles : l'user lit déjà sa ligne via 0001
-- ("profiles: lire le sien"). AUCUNE policy ne permet à l'user d'UPDATE son role
-- (write réservé service_role bypass — T-01-02).

-- ────────────────────────────────────────────
-- COLONNE : profiles.role
-- DEFAULT 'member' couvre les lignes existantes ET les nouveaux users
-- (handle_new_user n'écrit PAS role).
-- ────────────────────────────────────────────
alter table public.profiles
  add column role text not null default 'member'
  check (role in ('member', 'affiliate', 'superadmin'));

-- ────────────────────────────────────────────
-- HELPER RLS : is_superadmin() — security definer, search_path figé (Pitfall 6)
-- language sql stable : helper de lecture pure réutilisable dans les policies.
-- search_path = public : référence public.profiles directement (≠ '' du trigger plpgsql).
-- ────────────────────────────────────────────
create function public.is_superadmin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'superadmin'
  );
$$;

-- Surface RPC défensive : seuls les utilisateurs authentifiés peuvent l'appeler
-- (les policies l'invoquent dans le contexte authenticated). anon/public exclus.
revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;
