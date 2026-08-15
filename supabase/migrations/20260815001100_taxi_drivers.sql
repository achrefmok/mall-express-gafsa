-- ════════════════════════════════════════════════════════════════════════
-- Chauffeurs de taxi
-- ════════════════════════════════════════════════════════════════════════
--
-- Première version, volontairement modeste : trouver un taxi libre maintenant,
-- et l'appeler. Pas de mise en relation automatique, pas de suivi de course, pas
-- de tarification — ces briques engagent une responsabilité (accidents, argent,
-- réglementation du transport de personnes) qui ne se décide pas dans du code.
--
-- Pas de nouveau rôle : un profil qui possède une ligne ici est chauffeur. Une
-- valeur de plus dans l'énumération `app_role` aurait obligé à revoir chaque
-- garde de permission du projet pour un besoin que cette table couvre seule.

create table if not exists public.taxi_drivers (
  id uuid primary key references public.profiles (id) on delete cascade,

  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  phone        text not null check (char_length(btrim(phone)) between 6 and 20),
  vehicle      text,
  plate        text,

  -- Le chauffeur bascule lui-même. Personne d'autre ne sait s'il est libre.
  is_available boolean not null default false,

  /*
    Dernière position connue, publiée par le chauffeur depuis son téléphone.

    Deux colonnes plutôt qu'un type géographique : PostGIS n'est pas activé, et
    à l'échelle d'une ville deux nombres suffisent largement. Le jour où il
    faudra chercher « les chauffeurs dans un rayon de 2 km », la migration vers
    `geography` se fera sans toucher à l'interface.
  */
  lat double precision,
  lng double precision,
  position_updated_at timestamptz,

  -- Un chauffeur n'apparaît qu'une fois vérifié par l'administration : permis,
  -- carte grise, identité. La plateforme met en avant des inconnus à des
  -- clients, elle doit savoir qui ils sont.
  is_approved boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.taxi_drivers is
  'Chauffeurs de taxi : coordonnées, disponibilité et dernière position connue.';

create index if not exists taxi_drivers_available_idx
  on public.taxi_drivers (is_available, position_updated_at desc)
  where is_approved;

-- ─── Sécurité ──────────────────────────────────────────────────────────
alter table public.taxi_drivers enable row level security;

/*
  Lecture publique des seuls chauffeurs approuvés.

  La position et le téléphone d'un chauffeur approuvé sont précisément ce qu'un
  client vient chercher — les cacher viderait la fonctionnalité. En revanche un
  chauffeur non encore vérifié reste invisible : tant que l'administration ne
  l'a pas validé, il n'existe pas pour les clients.
*/
drop policy if exists taxi_drivers_select on public.taxi_drivers;
create policy taxi_drivers_select on public.taxi_drivers
  for select using (is_approved or id = auth.uid() or public.is_admin());

-- Le chauffeur crée sa propre fiche, et seulement la sienne.
drop policy if exists taxi_drivers_insert on public.taxi_drivers;
create policy taxi_drivers_insert on public.taxi_drivers
  for insert with check (
    id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
  );

/*
  Le chauffeur modifie sa fiche, jamais son approbation.

  Sans cette garde, il lui suffirait d'une requête pour se déclarer vérifié et
  apparaître auprès des clients sans contrôle. `is_approved` reste donc figé sur
  sa valeur courante, et seule l'administration en dispose.
*/
drop policy if exists taxi_drivers_update_own on public.taxi_drivers;
create policy taxi_drivers_update_own on public.taxi_drivers
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_approved = (select d.is_approved from public.taxi_drivers d where d.id = auth.uid())
  );

drop policy if exists taxi_drivers_admin on public.taxi_drivers;
create policy taxi_drivers_admin on public.taxi_drivers
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── Temps réel ────────────────────────────────────────────────────────
-- Un chauffeur qui se déclare libre doit apparaître chez les clients sans
-- rechargement : c'est toute la différence avec un annuaire.
alter table public.taxi_drivers replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'taxi_drivers'
  ) then
    execute 'alter publication supabase_realtime add table public.taxi_drivers';
  end if;
end $$;
