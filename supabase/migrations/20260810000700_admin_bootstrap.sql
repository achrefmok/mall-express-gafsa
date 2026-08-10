-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 07 · Amorçage de l'administration
--
-- Quatre choses :
--   1. Un premier compte administrateur créé directement dans la base,
--      avec son mot de passe — sans dépendre de l'API d'administration.
--   2. La levée du conflit entre FORCE RLS et les fonctions SECURITY DEFINER.
--   3. Les fonctions qui permettent à cet administrateur d'en nommer
--      d'autres depuis l'interface, sans jamais toucher au SQL.
--   4. La finition du seed de démonstration, que les gardes avaient bloquée.
--
-- Rejouable : passer ce fichier deux fois ne change rien de plus.
--
-- ⚠ PRÉREQUIS : appliquer d'abord 20260810000600_fix_privilege_guards.sql.
-- ═══════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.is_service_context()') is null then
    raise exception
      'Appliquez d''abord supabase/migrations/20260810000600_fix_privilege_guards.sql — '
      'sans lui, les gardes annulent silencieusement la promotion.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · Le premier administrateur
--
-- On écrit dans auth.users, ce que fait GoTrue lui-même : mot de passe
-- haché en bcrypt, e-mail confirmé, identité « email » associée.
--
-- ┌───────────────────────────────────────────────────────────────────┐
-- │  RENSEIGNEZ CES VALEURS AVANT D'EXÉCUTER, DANS L'ÉDITEUR SQL.     │
-- │                                                                   │
-- │  Ne les enregistrez jamais ici : ce fichier est versionné, et un  │
-- │  mot de passe dans un dépôt Git y reste — même effacé plus tard,  │
-- │  il demeure dans l'historique des commits.                        │
-- │                                                                   │
-- │  Changez-le ensuite depuis /profil/reglages.                       │
-- └───────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  v_email    text := lower(btrim('CHANGEZ-MOI@exemple.com'));
  v_password text := 'CHANGEZ-MOI';
  v_first    text := 'Prénom';
  v_last     text := 'Nom';

  v_id       uuid;
  v_created  boolean := false;
  v_identity jsonb;
  v_columns  text[];
  v_values   text[];
begin
  select u.id into v_id from auth.users u where lower(u.email) = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    v_created := true;

    -- Les colonnes de jetons doivent valoir '' et non NULL : GoTrue les lit
    -- dans des chaînes Go non nullables, et un seul NULL casse l'API
    -- d'administration pour tout le projet. Voir migration 06.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('first_name', v_first, 'last_name', v_last),
      now(), now(),
      '', '', '', '', '', '', '', ''
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        banned_until       = null,
        updated_at         = now()
    where id = v_id;
  end if;

  -- Identité « email ». Sans elle, le compte existe mais le tableau de bord
  -- Supabase l'affiche sans méthode de connexion.
  --
  -- `id` et `provider_id` ont été ajoutées à auth.identities au fil des
  -- versions de GoTrue : on construit l'insertion d'après les colonnes
  -- réellement présentes, plutôt que de parier sur une version.
  if not exists (
    select 1 from auth.identities i where i.user_id = v_id and i.provider = 'email'
  ) then
    v_identity := jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true);

    v_columns := array['user_id', 'identity_data', 'provider',
                       'last_sign_in_at', 'created_at', 'updated_at'];
    v_values   := array[quote_literal(v_id), quote_literal(v_identity::text) || '::jsonb',
                        '''email''', 'now()', 'now()', 'now()'];

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'id'
    ) then
      v_columns := array_prepend('id', v_columns);
      v_values  := array_prepend('gen_random_uuid()', v_values);
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
    ) then
      v_columns := v_columns || 'provider_id';
      v_values  := v_values  || quote_literal(v_id::text);
    end if;

    execute format(
      'insert into auth.identities (%s) values (%s)',
      array_to_string(v_columns, ', '),
      array_to_string(v_values, ', ')
    );
  end if;

  -- Le trigger handle_new_user a créé le profil au rôle « client » : il
  -- neutralise « admin » par construction, pour que personne ne se promeuve
  -- seul. C'est ici, et seulement ici, que le premier rôle est accordé.
  alter table public.profiles disable trigger trg_profiles_guard;

  insert into public.profiles (id, role, first_name, last_name, referral_code)
  values (
    v_id, 'admin', v_first, v_last,
    upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8))
  )
  on conflict (id) do update
    set role       = 'admin',
        is_banned  = false,
        first_name = coalesce(nullif(btrim(profiles.first_name), ''), excluded.first_name),
        last_name  = coalesce(nullif(btrim(profiles.last_name), ''),  excluded.last_name),
        updated_at = now();

  alter table public.profiles enable trigger trg_profiles_guard;

  raise notice '% : administrateur % (%)',
    v_email, case when v_created then 'créé' else 'promu' end, v_id;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · RLS et fonctions SECURITY DEFINER
--
-- La migration 04 pose `force row level security` sur les 32 tables. Utile
-- en principe : même le propriétaire des tables reste soumis aux policies.
-- Mais toute l'écriture passe par des fonctions SECURITY DEFINER —
-- place_order, approve_shop, award_points, celles ci-dessous — qui
-- s'exécutent au nom de `postgres` et portent leur propre contrôle d'accès.
-- Plusieurs écrivent dans des tables volontairement dépourvues de policy
-- d'insertion (`orders`, `notifications`) : c'est justement ce qui garantit
-- qu'on ne peut pas les contourner.
--
-- Si `postgres` n'a pas l'attribut BYPASSRLS sur ce projet, FORCE RLS
-- neutralise ces fonctions en silence — une commande passée qui n'insère
-- rien, une boutique approuvée sans notification.
--
-- On lève donc l'ambiguïté : une policy nominative pour `postgres`, et pour
-- lui seul. Elle n'élargit rien pour `anon`, `authenticated` ni
-- `service_role`, qui gardent exactement les mêmes droits qu'avant.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  rel record;
begin
  for rel in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists %I on public.%I', rel.relname || '_definer', rel.relname);
    execute format(
      'create policy %I on public.%I for all to postgres using (true) with check (true)',
      rel.relname || '_definer', rel.relname
    );
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3 · Gestion de l'équipe depuis l'interface
--
-- Trois fonctions SECURITY DEFINER, réservées aux administrateurs. Elles
-- existent parce que `auth.users` n'est pas exposé par PostgREST : sans
-- elles, nommer un collègue par son adresse imposerait de manipuler la clé
-- secrète, ou de rouvrir l'éditeur SQL à chaque fois.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.require_admin()
returns void
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_service_context()) then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;
end;
$$;

-- ─── Annuaire des membres, adresses e-mail comprises ───────────────────

create or replace function public.admin_members(
  search    text    default null,
  max_rows  integer default 200
)
returns table (
  id              uuid,
  email           text,
  first_name      text,
  last_name       text,
  avatar_url      text,
  role            public.user_role,
  city            text,
  loyalty_points  integer,
  is_banned       boolean,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  shop_name       text,
  shop_status     public.shop_status
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  needle text := nullif(btrim(coalesce(search, '')), '');
begin
  perform public.require_admin();

  return query
  select
    p.id, u.email::text, p.first_name, p.last_name, p.avatar_url, p.role, p.city,
    p.loyalty_points, p.is_banned, p.created_at, u.last_sign_in_at,
    s.name, s.status
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.shops s on s.owner_id = p.id
  where needle is null
     or u.email ilike '%' || needle || '%'
     or btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike '%' || needle || '%'
  order by
    -- Les administrateurs d'abord : c'est l'équipe, elle se consulte en tête.
    case p.role when 'admin' then 0 when 'vendor' then 1 else 2 end,
    p.created_at desc
  limit greatest(1, least(coalesce(max_rows, 200), 500));
end;
$$;

-- ─── Nommer un administrateur à partir de son adresse ──────────────────

create or replace function public.grant_admin_by_email(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  needle text := lower(btrim(coalesce(target_email, '')));
  v_id   uuid;
begin
  perform public.require_admin();

  if needle = '' or needle not like '%@%' then
    raise exception 'Adresse e-mail invalide' using errcode = 'P0001';
  end if;

  select u.id into v_id from auth.users u where lower(u.email) = needle;

  if v_id is null then
    raise exception
      'Aucun compte pour cette adresse. La personne doit d''abord s''inscrire sur l''application.'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set role = 'admin', is_banned = false, updated_at = now()
  where id = v_id;

  return v_id;
end;
$$;

-- ─── Changer le rôle d'un membre ───────────────────────────────────────

create or replace function public.set_member_role(
  target   uuid,
  new_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_role_of_target public.user_role;
  admin_count            integer;
begin
  perform public.require_admin();

  select p.role into current_role_of_target from public.profiles p where p.id = target;
  if current_role_of_target is null then
    raise exception 'Membre introuvable' using errcode = 'P0001';
  end if;

  if current_role_of_target = new_role then
    return;
  end if;

  -- Deux verrous contre l'enfermement dehors : on ne se retire pas soi-même,
  -- et il reste toujours au moins un administrateur.
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'Vous ne pouvez pas retirer votre propre rôle d''administrateur'
      using errcode = 'P0001';
  end if;

  if current_role_of_target = 'admin' and new_role <> 'admin' then
    select count(*) into admin_count from public.profiles p where p.role = 'admin';
    if admin_count <= 1 then
      raise exception 'Il doit rester au moins un administrateur' using errcode = 'P0001';
    end if;
  end if;

  update public.profiles
  set role = new_role, updated_at = now()
  where id = target;
end;
$$;

revoke execute on function public.require_admin()                 from public, anon;
revoke execute on function public.admin_members(text, integer)    from public, anon;
revoke execute on function public.grant_admin_by_email(text)      from public, anon;
revoke execute on function public.set_member_role(uuid, public.user_role) from public, anon;

grant execute on function public.admin_members(text, integer)     to authenticated;
grant execute on function public.grant_admin_by_email(text)       to authenticated;
grant execute on function public.set_member_role(uuid, public.user_role) to authenticated;

comment on function public.admin_members(text, integer) is
  'Annuaire des membres avec adresse e-mail. Réservé aux administrateurs.';
comment on function public.grant_admin_by_email(text) is
  'Nomme administrateur un compte existant, désigné par son adresse.';
comment on function public.set_member_role(uuid, public.user_role) is
  'Change le rôle d''un membre. Refuse de supprimer le dernier administrateur.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4 · Rattrapage du seed de démonstration
--
-- La partie B du seed approuvait ses six boutiques ; le garde
-- guard_shop_privileges annulait l'écriture sans rien signaler, et l'accueil
-- restait vide.
--
-- Liste nominative des propriétaires de démonstration : les vraies boutiques
-- passent par /admin, à la main. En production sans seed, ce bloc ne touche
-- rien.
-- ═══════════════════════════════════════════════════════════════════════

update public.shops
set status      = 'approved',
    approved_at = coalesce(approved_at, now())
where status = 'pending'
  and owner_id in (
    '44444444-4444-4444-8444-444444444444',  -- Zara — Mall Gafsa
    '55555555-5555-4555-8555-555555555555',  -- Café Oasis
    '66666666-6666-4666-8666-666666666666',  -- Sport+
    '77777777-7777-4777-8777-777777777777',  -- L. Cosmétiques
    '88888888-8888-4888-8888-888888888888',  -- Maison Gafsa — Décoration
    '99999999-9999-4999-8999-999999999999'   -- Épicerie Ennour
  );
