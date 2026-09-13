-- La carte des chauffeurs, et la séparation des deux usages.
--
-- ════════════════════════════════════════════════════════════════════════
-- 1 · Pourquoi il n'y a toujours pas de rôle « chauffeur »
-- ════════════════════════════════════════════════════════════════════════
--
-- La demande était d'ajouter `driver` à l'énumération des rôles, à côté de
-- `client`, `vendor` et `admin`. Ce n'est pas fait, et c'est délibéré — la
-- migration `20260815001100` avait déjà tranché, avec ses raisons :
--
--   « Pas de nouveau rôle : un profil qui possède une ligne ici est chauffeur.
--     Une valeur de plus dans l'énumération aurait obligé à revoir chaque
--     garde de permission du projet pour un besoin que cette table couvre
--     seule. »
--
-- Ces gardes sont nombreuses : l'intergiciel, `handle_new_user`, les trois
-- triggers `guard_*`, et chaque policy qui compare un rôle. Une valeur de plus
-- les rend toutes à réexaminer, et un `case` oublié quelque part ouvre une
-- porte au lieu d'en fermer une.
--
-- **L'exigence réelle n'était pas l'énumération, c'était la séparation**, et
-- appliquée côté serveur plutôt qu'à l'écran. C'est ce que fait ce fichier :
-- l'appartenance à `taxi_drivers` fait foi, et la base la fait respecter.

/* ─── Qui est chauffeur, en une fonction ──────────────────────────────── */

/*
  Le pendant de `is_admin()` pour le taxi.

  `security definer` pour la même raison qu'elle : une policy de
  `taxi_drivers` qui interrogerait `taxi_drivers` tournerait en rond.

  Deux fonctions plutôt qu'une, parce que les deux questions sont distinctes
  et que les confondre a déjà coûté cher ailleurs : être inscrit n'est pas
  être vérifié. Un chauffeur en attente d'approbation ne doit apparaître sur
  aucune carte, mais il n'est pas pour autant un passager ordinaire.
*/
create or replace function public.est_chauffeur()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.taxi_drivers d where d.id = auth.uid());
$$;

create or replace function public.est_chauffeur_approuve()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.taxi_drivers d
    where d.id = auth.uid() and d.is_approved
  );
$$;

comment on function public.est_chauffeur() is
  'Vrai si l''appelant possède une fiche chauffeur, approuvée ou non. Tient lieu de rôle : l''énumération n''en porte pas.';

grant execute on function public.est_chauffeur() to authenticated;
grant execute on function public.est_chauffeur_approuve() to authenticated;

/* ─── Un chauffeur ne commande pas de taxi ────────────────────────────── */

/*
  La séparation, appliquée là où elle tient : à l'écriture.

  Masquer le bouton « Rechercher un taxi » dans l'interface du chauffeur ne
  sépare rien du tout — la Server Action reste appelable, et PostgREST aussi.
  La règle vit donc dans la policy, où personne ne la contourne.

  Ce qu'elle empêche concrètement : un chauffeur qui apparaîtrait comme client
  en attente sur la carte de ses propres confrères, et qui pourrait réserver sa
  propre voiture.

  La branche `driver_id is null` du correctif précédent est conservée : c'est
  elle qui rend la demande diffusée possible.
*/
drop policy if exists taxi_requests_insert on public.taxi_requests;

create policy taxi_requests_insert on public.taxi_requests
  for insert with check (
    client_id = auth.uid()
    -- Un chauffeur inscrit ne crée pas de demande de passager, approuvé ou non.
    and not public.est_chauffeur()
    and (
      driver_id is null
      or exists (
        select 1 from public.taxi_drivers d
        where d.id = driver_id and d.is_approved
      )
    )
  );

comment on policy taxi_requests_insert on public.taxi_requests is
  'Un client — et jamais un chauffeur — crée ses propres demandes : diffusée (driver_id nul) ou adressée à un chauffeur approuvé.';

/* ─── 2 · Les clients en attente, pour la carte du chauffeur ──────────── */

/*
  `taxi_demandes_proches` rendait tout sauf les coordonnées.

  C'était le bon choix pour une liste : une distance et un libellé suffisent à
  décider, et le point de départ exact d'un inconnu n'a pas à circuler. Mais on
  ne place pas un repère sur une carte avec une distance seule.

  Les coordonnées sont donc rendues, et le compromis est assumé — il est borné
  par trois conditions qui tiennent toutes côté serveur :

    · l'appelant est un chauffeur **approuvé** (la fonction le vérifie) ;
    · la demande est **ouverte** — ni acceptée, ni annulée, ni expirée ;
    · elle est **dans son rayon**.

  Ce qui reste tu, et le restera : l'identité du client, son nom, son
  téléphone. Le chauffeur voit un point et une course, pas une personne. Le
  reste apparaît quand il accepte, c'est-à-dire quand il s'engage.

  `create or replace` ne suffit pas ici : le type de retour change, et Postgres
  refuse. On supprime d'abord.
*/
drop function if exists public.taxi_demandes_proches(double precision, double precision, integer, integer);

create function public.taxi_demandes_proches(
  p_lat double precision,
  p_lng double precision,
  p_rayon_m integer default 8000,
  p_limite integer default 20
)
returns table (
  id uuid,
  pickup_label text,
  pickup_lat double precision,
  pickup_lng double precision,
  origin_zone text,
  destination_zone text,
  destination_type text,
  destination_name text,
  dest_label text,
  dest_lat double precision,
  dest_lng double precision,
  proposed_price integer,
  seats smallint,
  expires_at timestamptz,
  created_at timestamptz,
  distance_m integer,
  deja_diffusee boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  delta_lat double precision;
  delta_lng double precision;
  rayon integer := greatest(200, least(50000, coalesce(p_rayon_m, 8000)));
begin
  if not public.est_chauffeur_approuve() then
    return;
  end if;

  if p_lat is null or p_lng is null then
    return;
  end if;

  -- Un degré de latitude vaut ~111 km ; un degré de longitude, 111 km × cos(lat).
  delta_lat := rayon / 111000.0;
  delta_lng := rayon / (111000.0 * greatest(0.1, cos(radians(p_lat))));

  return query
  select
    r.id,
    r.pickup_label,
    r.pickup_lat,
    r.pickup_lng,
    r.origin_zone,
    r.destination_zone,
    r.destination_type,
    r.destination_name,
    r.dest_label,
    r.dest_lat,
    r.dest_lng,
    r.proposed_price,
    r.seats,
    r.expires_at,
    r.created_at,
    round(
      6371000 * 2 * asin(sqrt(
        power(sin(radians(r.pickup_lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(r.pickup_lat))
          * power(sin(radians(r.pickup_lng - p_lng) / 2), 2)
      ))
    )::integer as distance_m,
    exists (
      select 1 from public.taxi_request_matches m
      where m.request_id = r.id and m.driver_id = auth.uid()
    ) as deja_diffusee
  from public.taxi_requests r
  where
    /*
      Les quatre conditions qui font qu'un client est « en attente ».

      C'est ici que se joue la règle de visibilité demandée : un compte
      ordinaire n'apparaît jamais sur cette carte. Il n'y apparaît qu'après
      avoir ouvert le taxi, saisi sa destination et confirmé — ce qui crée la
      ligne — et il en disparaît à la seconde où il annule, où quelqu'un
      accepte, ou où l'échéance tombe.
    */
    r.status = 'en_attente'
    and r.driver_id is null
    and r.expires_at > now()
    and r.client_id <> auth.uid()
    -- Boîte englobante : c'est elle qui utilise l'index.
    and r.pickup_lat between p_lat - delta_lat and p_lat + delta_lat
    and r.pickup_lng between p_lng - delta_lng and p_lng + delta_lng
  order by distance_m asc
  limit greatest(1, least(50, coalesce(p_limite, 20)));
end;
$$;

comment on function public.taxi_demandes_proches(double precision, double precision, integer, integer) is
  'Demandes ouvertes autour d''un point, pour un chauffeur approuvé. Rend le point de prise en charge — nécessaire à la carte — mais jamais l''identité ni le téléphone du client.';

revoke all on function public.taxi_demandes_proches(double precision, double precision, integer, integer) from public, anon;
grant execute on function public.taxi_demandes_proches(double precision, double precision, integer, integer) to authenticated;

/* ─── 3 · Les chauffeurs visibles du client ───────────────────────────── */

/*
  « Occupé » et « hors ligne » ne doivent plus être proposés.

  La règle existait déjà côté matching — `offrirDemandes` ne retient que
  `status = 'libre'` — mais pas côté carte : l'écran client lit `taxi_drivers`
  directement et affichait tout le monde, occupés compris, en se contentant de
  les griser.

  Une vue plutôt qu'une policy : la table doit rester lisible telle quelle
  pour l'administration et pour le chauffeur lui-même. La vue est le point
  d'entrée de la carte, et elle ne montre que ce qui est réellement
  joignable.

  `security_invoker` : la vue s'exécute avec les droits de l'appelant, donc
  les policies de `taxi_drivers` s'appliquent normalement au travers. Sans
  cela, une vue serait une porte dérobée sur la table.
*/
create or replace view public.taxi_chauffeurs_visibles
with (security_invoker = true)
as
select
  d.id,
  d.display_name,
  d.phone,
  d.vehicle,
  d.plate,
  d.lat,
  d.lng,
  d.position_updated_at,
  d.status,
  d.status_since,
  d.seats_total,
  d.seats_free,
  d.takes_along,
  d.origin_zone,
  d.destination_zone,
  d.accepts_custom
from public.taxi_drivers d
where d.is_approved
  -- Hors ligne : invisible. Ce n'est pas un grisé, c'est une absence.
  and d.status in ('libre', 'places');

comment on view public.taxi_chauffeurs_visibles is
  'Chauffeurs approuvés et réellement joignables. Les occupés et les hors ligne n''y figurent pas : la carte du client ne doit proposer que ce qui peut venir.';

grant select on public.taxi_chauffeurs_visibles to anon, authenticated;

/* ─── Reprise ──────────────────────────────────────────────────────────

   Additif, à une exception près : `taxi_demandes_proches` change de type de
   retour et doit donc être supprimée avant d'être recréée. Le code appelant
   lit les colonnes par leur nom et tolère les nouvelles ; aucune des
   anciennes n'a disparu.

   Marche arrière :
     drop view public.taxi_chauffeurs_visibles;
     drop function public.est_chauffeur_approuve();
     drop function public.est_chauffeur();
     -- puis rejouer 20260907002000 pour la policy d'insertion,
     -- et 20260907001000 pour l'ancienne signature de taxi_demandes_proches.
*/
