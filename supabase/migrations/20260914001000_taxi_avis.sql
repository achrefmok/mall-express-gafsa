-- ════════════════════════════════════════════════════════════════════════
-- Les avis sur les chauffeurs
-- ════════════════════════════════════════════════════════════════════════
--
-- Un client note le chauffeur d'une course qu'il a réellement faite, une
-- fois, de 1 à 5 étoiles, avec un commentaire s'il le souhaite.
--
-- ────────────────────────────────────────────────────────────────────────
-- Où sont les règles
-- ────────────────────────────────────────────────────────────────────────
--
-- Toutes ici, et aucune dans l'application :
--
--   · la table n'a **aucune** policy d'écriture. On n'y entre que par
--     `taxi_noter_course`, qui vérifie que la course existe, qu'elle
--     appartient à la personne connectée, qu'elle est terminée ;
--   · l'unicité sur `request_id` interdit deux avis pour une même course,
--     y compris quand deux onglets envoient en même temps ;
--   · la moyenne n'est stockée nulle part : `taxi_profil_public` la calcule à
--     la lecture. Un compteur tenu à jour par déclencheur peut dériver ; un
--     agrégat sur une table indexée ne le peut pas.
--
-- La table n'est lisible, ligne à ligne, que de ses deux parties et de
-- l'administration. Le public voit la moyenne, le nombre, et les cinq
-- derniers avis — avec le seul prénom du client — par la fonction publique.
--
-- Idempotente : peut être collée deux fois sans erreur.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.taxi_driver_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.taxi_requests (id) on delete cascade,
  driver_id uuid not null references public.taxi_drivers (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists taxi_driver_reviews_driver_idx
  on public.taxi_driver_reviews (driver_id, created_at desc);

alter table public.taxi_driver_reviews enable row level security;
alter table public.taxi_driver_reviews force row level security;

drop policy if exists taxi_reviews_lecture on public.taxi_driver_reviews;
create policy taxi_reviews_lecture on public.taxi_driver_reviews
  for select to authenticated
  using (client_id = auth.uid() or driver_id = auth.uid() or public.is_admin());

-- Aucune écriture directe, pour personne : la fonction ci-dessous est la
-- seule porte.
revoke insert, update, delete on public.taxi_driver_reviews from anon, authenticated;
grant select on public.taxi_driver_reviews to authenticated;

/* ─── Noter une course ───────────────────────────────────────────────── */

/*
  Les erreurs sont des clés (`AVIS_…`), pas des phrases : l'application les
  traduit dans la langue de la personne. Une phrase française levée ici
  s'afficherait telle quelle à un client arabophone.

  `for update` sur la course : deux envois simultanés de la même note se
  sérialisent, et le second tombe sur l'unicité — proprement, par
  `on conflict do nothing`, sans erreur de contrainte brute.
*/
create or replace function public.taxi_noter_course(
  p_course uuid,
  p_note integer,
  p_commentaire text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  moi uuid := auth.uid();
  course public.taxi_requests%rowtype;
  texte text := nullif(btrim(coalesce(p_commentaire, '')), '');
  nouvel uuid;
begin
  if moi is null then
    raise exception 'AVIS_CONNEXION' using errcode = 'P0001';
  end if;

  if p_note is null or p_note < 1 or p_note > 5 then
    raise exception 'AVIS_NOTE' using errcode = 'P0001';
  end if;

  select * into course from public.taxi_requests where id = p_course for update;

  if not found or course.client_id <> moi or course.driver_id is null or course.driver_id = moi then
    raise exception 'AVIS_PAS_A_VOUS' using errcode = 'P0001';
  end if;

  if course.status <> 'completed' then
    raise exception 'AVIS_NON_TERMINEE' using errcode = 'P0001';
  end if;

  insert into public.taxi_driver_reviews (request_id, driver_id, client_id, rating, comment)
  values (course.id, course.driver_id, moi, p_note, left(texte, 500))
  on conflict (request_id) do nothing
  returning id into nouvel;

  if nouvel is null then
    raise exception 'AVIS_DEJA' using errcode = 'P0001';
  end if;

  return nouvel;
end;
$$;

revoke all on function public.taxi_noter_course(uuid, integer, text) from public, anon;
grant execute on function public.taxi_noter_course(uuid, integer, text) to authenticated;

/* ─── La fiche publique, avec la note ────────────────────────────────── */

/*
  La même fonction que dans `20260913003000_profil_chauffeur.sql`, reprise à
  l'identique, plus trois champs : la moyenne arrondie au dixième, le
  nombre d'avis, et les cinq derniers.
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
    'membre_depuis', d.created_at,
    'note_moyenne', (
      select round(avg(v.rating)::numeric, 1)
      from public.taxi_driver_reviews v
      where v.driver_id = d.id
    ),
    'nb_avis', (
      select count(*) from public.taxi_driver_reviews v where v.driver_id = d.id
    ),
    'avis_recents', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select v.rating as note, v.comment as commentaire, v.created_at, p.first_name as prenom
        from public.taxi_driver_reviews v
        left join public.profiles p on p.id = v.client_id
        where v.driver_id = d.id
        order by v.created_at desc
        limit 5
      ) x
    ), '[]'::jsonb)
  )
  from public.taxi_drivers d
  where d.id = p_chauffeur and d.is_approved;
$$;

grant execute on function public.taxi_profil_public(uuid) to anon, authenticated;

/* Marche arrière :
     drop function public.taxi_noter_course(uuid, integer, text);
     drop table public.taxi_driver_reviews;
     -- puis recoller taxi_profil_public depuis 20260913003000_profil_chauffeur.sql
*/
