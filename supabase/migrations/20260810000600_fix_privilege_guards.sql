-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 06 · Correctif des gardes de privilèges
--
-- Les triggers guard_* de la migration 04 neutralisent les colonnes
-- sensibles (rôle, statut de boutique, badge « Vérifié ») pour tout appelant
-- qui n'est pas administrateur.
--
-- Défaut : `public.is_admin()` s'appuie sur `auth.uid()`, qui est NULL quand
-- il n'y a pas de JWT utilisateur — c'est-à-dire pour la clé `service_role`
-- et pour l'éditeur SQL. Résultat, les gardes bloquaient aussi l'exploitant :
--   · `update profiles set role = 'admin'` restait sans effet ;
--   · le seed n'arrivait pas à approuver les boutiques de démonstration.
--
-- On ajoute donc une notion de « contexte de service » : pas de JWT, ou un
-- JWT de rôle `service_role`. Ces deux cas supposent déjà un accès privilégié
-- à la base — la clé secrète contourne de toute façon RLS.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.is_service_context()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    -- Rôle porté par le JWT de la requête, selon la version de PostgREST.
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    -- Aucun JWT : éditeur SQL, migration, psql. Déjà privilégié.
    'service_role'
  ) = 'service_role';
$$;

comment on function public.is_service_context() is
  'Vrai pour la clé service_role et pour un accès SQL direct. Ne dit rien du rôle applicatif.';

grant execute on function public.is_service_context() to anon, authenticated;

-- ─── Profils ───────────────────────────────────────────────────────────

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_service_context() then
    return new;
  end if;

  new.role           := old.role;
  new.loyalty_points := old.loyalty_points;
  new.is_banned      := old.is_banned;
  new.referral_code  := old.referral_code;
  new.referred_by    := old.referred_by;
  return new;
end;
$$;

-- ─── Boutiques ─────────────────────────────────────────────────────────

create or replace function public.guard_shop_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_service_context() then
    return new;
  end if;

  new.status           := old.status;
  new.approved_at      := old.approved_at;
  new.approved_by      := old.approved_by;
  new.is_featured      := old.is_featured;
  new.rejection_reason := old.rejection_reason;
  new.missing_document := old.missing_document;
  new.rating_sum       := old.rating_sum;
  new.rating_count     := old.rating_count;
  new.followers_count  := old.followers_count;
  return new;
end;
$$;

-- ─── Bons plans ────────────────────────────────────────────────────────

create or replace function public.guard_deal_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_service_context() then
    return new;
  end if;

  new.is_verified    := old.is_verified;
  new.verified_at    := old.verified_at;
  new.upvotes        := old.upvotes;
  new.downvotes      := old.downvotes;
  new.comments_count := old.comments_count;
  new.reports_count  := old.reports_count;
  new.author_id      := old.author_id;
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- Réparation des comptes créés par insertion directe dans auth.users
--
-- GoTrue lit plusieurs colonnes de jetons dans des chaînes Go non nullables.
-- Une insertion manuelle qui les laisse à NULL casse l'API d'administration
-- avec « Database error finding users » — et donc la liste des utilisateurs
-- dans le tableau de bord Supabase.
--
-- La partie B du seed créait ce cas. Corrigé ici et dans seed.sql.
-- Sans effet si aucune ligne n'est concernée.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  col  text;
  cols text[] := array[
    'confirmation_token',
    'recovery_token',
    'email_change',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ];
  touched integer := 0;
  n integer;
begin
  foreach col in array cols loop
    -- Toutes ces colonnes n'existent pas dans toutes les versions de GoTrue.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users' and column_name = col
    ) then
      execute format('update auth.users set %I = %L where %I is null', col, '', col);
      get diagnostics n = row_count;
      touched := touched + n;
    end if;
  end loop;

  if touched > 0 then
    raise notice 'auth.users : % valeur(s) NULL remplacée(s) par une chaîne vide', touched;
  end if;
end $$;
