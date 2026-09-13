-- Le profil du chauffeur : sa présentation, son véhicule, son métier.
--
-- ════════════════════════════════════════════════════════════════════════
-- Ce qui est public, ce qui ne l'est pas
-- ════════════════════════════════════════════════════════════════════════
--
-- `taxi_drivers` est lisible par tous pour les chauffeurs approuvés — c'est
-- ce qui permet à un client de trouver un taxi. Tout ce qu'on y ajoute
-- devient donc public, **quelle que soit la façon dont l'écran l'affiche**.
--
-- D'où deux tables :
--
--   · `taxi_drivers` reçoit ce qu'un client a légitimement le droit de voir :
--     le véhicule, la présentation, les langues, les quartiers servis ;
--   · `taxi_driver_private` reçoit le numéro de permis, que seuls le
--     chauffeur et l'administration lisent.
--
-- Pourquoi pas des droits de colonne, comme pour `profiles` : l'application
-- lit `taxi_drivers` en `select("*")` à une dizaine d'endroits, délibérément
-- (voir `app/(client)/taxi/page.tsx`). Retirer le droit sur une colonne ferait
-- échouer chacune de ces lectures. Une table séparée ne casse rien.

alter table public.taxi_drivers
  add column if not exists photo_url text,
  add column if not exists bio text check (bio is null or char_length(bio) <= 400),
  add column if not exists vehicle_brand text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_color text,
  add column if not exists vehicle_year smallint
    check (vehicle_year is null or vehicle_year between 1980 and 2100),
  add column if not exists service_zones text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists experience_years smallint
    check (experience_years is null or experience_years between 0 and 60),
  /*
    Afficher ou non le numéro sur la fiche publique.

    Honnêtement : ce réglage gouverne l'**affichage**, pas l'accès. La colonne
    `phone` reste lisible par l'API pour tout chauffeur approuvé, parce que
    c'est d'elle que dépendent l'appel et WhatsApp depuis la carte. Le
    réglage respecte le souhait du chauffeur à l'écran ; il ne cache pas le
    numéro à quelqu'un qui interrogerait la base directement.
  */
  add column if not exists show_phone boolean not null default true;

/* ─── Le privé ────────────────────────────────────────────────────────── */

create table if not exists public.taxi_driver_private (
  id uuid primary key references public.taxi_drivers (id) on delete cascade,
  license_number text check (license_number is null or char_length(license_number) <= 40),
  updated_at timestamptz not null default now()
);

alter table public.taxi_driver_private enable row level security;

drop policy if exists taxi_private_own on public.taxi_driver_private;
create policy taxi_private_own on public.taxi_driver_private
  for all using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

/* ─── La fiche publique, avec ses chiffres ────────────────────────────── */

/*
  Ce qu'un client voit d'un chauffeur, en une lecture.

  `security definer` pour une seule raison : le nombre de courses terminées.
  `taxi_requests` n'est lisible que de ses deux extrémités, et un client qui
  consulte une fiche n'en est pas une. La fonction compte pour lui, et ne rend
  que le compte — jamais une course.

  Le téléphone n'est rendu que si le chauffeur l'a autorisé. Les chauffeurs
  non approuvés n'ont pas de fiche : la fonction répond `null`.
*/
create or replace function public.taxi_profil_public(p_chauffeur uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', d.id,
    'display_name', d.display_name,
    'photo_url', d.photo_url,
    'bio', d.bio,
    'vehicle', d.vehicle,
    'plate', d.plate,
    'vehicle_brand', d.vehicle_brand,
    'vehicle_model', d.vehicle_model,
    'vehicle_color', d.vehicle_color,
    'vehicle_year', d.vehicle_year,
    'service_zones', d.service_zones,
    'languages', d.languages,
    'experience_years', d.experience_years,
    'status', d.status,
    'status_since', d.status_since,
    'seats_total', d.seats_total,
    'seats_free', d.seats_free,
    'phone', case when d.show_phone then d.phone end,
    'courses_terminees', (
      select count(*) from public.taxi_requests r
      where r.driver_id = d.id and r.status = 'completed'
    ),
    'membre_depuis', d.created_at
  )
  from public.taxi_drivers d
  where d.id = p_chauffeur and d.is_approved;
$$;

grant execute on function public.taxi_profil_public(uuid) to anon, authenticated;

/* Marche arrière :
     drop function public.taxi_profil_public(uuid);
     drop table public.taxi_driver_private;
     alter table public.taxi_drivers
       drop column photo_url, drop column bio, drop column vehicle_brand,
       drop column vehicle_model, drop column vehicle_color, drop column vehicle_year,
       drop column service_zones, drop column languages, drop column experience_years,
       drop column show_phone;
*/
