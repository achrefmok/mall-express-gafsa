-- ═══════════════════════════════════════════════════════════════════════
-- Compte exposant : un stand Lelma3ardh se pilote désormais par son
-- titulaire, pas seulement par l'administration Dahmani.
--
-- À coller après 20260927001000 (la valeur d'énumération doit être validée
-- avant qu'une politique ne s'en serve).
-- ═══════════════════════════════════════════════════════════════════════

alter table public.expo_exhibitors
  add column if not exists user_id uuid references auth.users (id) on delete set null;

comment on column public.expo_exhibitors.user_id is
  'Le compte du titulaire du stand, créé par l''administration Dahmani. Nul tant que personne ne s''est vu attribuer ce stand.';

-- Un compte ne tient qu'un seul stand — la relation inverse de `owns_shop`,
-- où c'est la boutique qui pointe vers un propriétaire unique.
create unique index if not exists expo_exhibitors_user_id_key
  on public.expo_exhibitors (user_id) where user_id is not null;

/* ─── Qui possède quel stand ─────────────────────────────────────────── */

create or replace function public.my_exhibitor_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.expo_exhibitors where user_id = auth.uid();
$$;

create or replace function public.owns_exhibitor(target_exhibitor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.expo_exhibitors
    where id = target_exhibitor_id and user_id = auth.uid()
  );
$$;

grant execute on function public.my_exhibitor_id() to anon, authenticated;
grant execute on function public.owns_exhibitor(uuid) to anon, authenticated;

/*
  Un titulaire de stand peut changer sa vitrine, jamais son statut ni le
  stand auquel il est rattaché — mêmes bornes que `guard_shop_privileges`
  pour un vendeur.
*/
create or replace function public.guard_exhibitor_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_dahmani_admin() or public.is_service_context() then
    return new;
  end if;

  new.expo_id  := old.expo_id;
  new.user_id  := old.user_id;
  new.status   := old.status;
  return new;
end;
$$;

drop trigger if exists trg_expo_exhibitors_guard on public.expo_exhibitors;
create trigger trg_expo_exhibitors_guard
  before update on public.expo_exhibitors
  for each row execute function public.guard_exhibitor_privileges();

/* ─── Politiques : le titulaire rejoint l'administration Dahmani ───────── */

drop policy if exists expo_exhibitors_select on public.expo_exhibitors;
create policy expo_exhibitors_select on public.expo_exhibitors
  for select using (
    public.is_dahmani_admin()
    or user_id = auth.uid()
    or (
      status = 'approved'
      and exists (select 1 from public.expos e where e.id = expo_id and e.is_published)
    )
  );

-- Remplace l'ancienne `expo_exhibitors_ecrire`, réservée à l'administration :
-- le titulaire peut désormais écrire sa propre ligne, le déclencheur
-- ci-dessus l'empêchant de toucher à son statut ou de changer de stand.
drop policy if exists expo_exhibitors_ecrire on public.expo_exhibitors;
drop policy if exists expo_exhibitors_owner_write on public.expo_exhibitors;
create policy expo_exhibitors_owner_write on public.expo_exhibitors
  for all
  using (public.is_dahmani_admin() or user_id = auth.uid())
  with check (public.is_dahmani_admin() or user_id = auth.uid());

drop policy if exists expo_products_select on public.expo_products;
create policy expo_products_select on public.expo_products
  for select using (
    public.is_dahmani_admin()
    or exists (select 1 from public.expo_exhibitors x where x.id = exhibitor_id and x.user_id = auth.uid())
    or exists (
      select 1
      from public.expo_exhibitors x
      join public.expos e on e.id = x.expo_id
      where x.id = exhibitor_id and x.status = 'approved' and e.is_published
    )
  );

-- Remplace l'ancienne `expo_products_ecrire`, réservée à l'administration :
-- un exposant gère désormais ses propres produits, jamais ceux d'un autre
-- stand — `owns_exhibitor` vérifie la propriété ligne par ligne, pas
-- seulement au moment d'ouvrir l'écran.
drop policy if exists expo_products_ecrire on public.expo_products;
drop policy if exists expo_products_owner_write on public.expo_products;
create policy expo_products_owner_write on public.expo_products
  for all
  using (public.is_dahmani_admin() or public.owns_exhibitor(exhibitor_id))
  with check (public.is_dahmani_admin() or public.owns_exhibitor(exhibitor_id));
