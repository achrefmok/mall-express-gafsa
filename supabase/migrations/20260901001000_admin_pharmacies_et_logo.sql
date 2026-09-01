-- Pharmacies de garde : position pour la carte, et logo de l'application
--
-- Deux besoins d'administration, une migration :
--
--   1. Une pharmacie de garde se trouve, pas seulement se nomme.
--      On ajoute la latitude et la longitude à `pharmacies_on_duty` pour
--      pouvoir la placer sur la carte Leaflet de l'écran Services, et y
--      ajouter un itinéraire.
--
--   2. Le logo de l'application se change depuis l'administration.
--      Jusqu'ici le logo était une icône statique dans `public/icons/`, qu'il
--      fallait redéployer pour changer. Une table à une seule ligne tient
--      l'URL du logo courant ; l'administration la modifie, l'en-tête et
--      l'écran de bienvenue la lisent, sans redéploiement.
--
-- La lecture est ouverte à tous, l'écriture réservée aux administrateurs,
-- comme partout ailleurs sur les tables de services.

-- ─── 1 · Position des pharmacies ────────────────────────────────────────

alter table public.pharmacies_on_duty
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

comment on column public.pharmacies_on_duty.latitude is
  'Latitude du lieu de la pharmacie, pour la carte des gardes.';
comment on column public.pharmacies_on_duty.longitude is
  'Longitude du lieu de la pharmacie, pour la carte des gardes.';

-- ─── 2 · Logo de l'application ──────────────────────────────────────────

/*
  Le réglage vit dans sa propre table, pas dans `app_settings`.

  `app_settings` existe déjà — `key`/`value`, réservée aux secrets serveur de
  notification et illisible depuis le client. Le logo, lui, doit être LU par
  chaque visiteur : il a besoin de sa propre table, publique en lecture.
*/
create table if not exists public.app_brand (
  id            boolean primary key default true check (id),
  app_logo_url  text,
  updated_at    timestamptz not null default now()
);

alter table public.app_brand enable row level security;

insert into public.app_brand (id) values (true)
on conflict (id) do nothing;

drop policy if exists app_brand_public_select on public.app_brand;
create policy app_brand_public_select on public.app_brand
  for select using (true);

drop policy if exists app_brand_admin on public.app_brand;
create policy app_brand_admin on public.app_brand
  for all using (public.is_admin()) with check (public.is_admin());
