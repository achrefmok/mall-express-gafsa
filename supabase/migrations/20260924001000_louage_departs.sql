-- Le louage : un chauffeur annonce son départ, les voyageurs réservent leur place.
--
-- ════════════════════════════════════════════════════════════════════════
-- Ce que ce module remplace
-- ════════════════════════════════════════════════════════════════════════
--
-- La page `/louage` ne montrait que des numéros de station. Pour savoir s'il
-- restait une place vers Tunis à 14 h, il fallait appeler — et souvent
-- descendre à la station pour l'apprendre. C'est le trajet le plus courant de
-- la région, et le seul renseignement qui compte tient en trois mots : où, à
-- quelle heure, combien de places.
--
-- ════════════════════════════════════════════════════════════════════════
-- Le sur-remplissage, et le verrou qui l'empêche
-- ════════════════════════════════════════════════════════════════════════
--
-- Deux voyageurs qui réservent la dernière place à la même seconde lisent
-- tous deux « une place restante » et repartent tous deux avec. Ils se
-- présentent ensemble à la station, et c'est le chauffeur qui en renvoie un.
--
-- La réservation passe donc par `louage_reserver`, qui verrouille la ligne du
-- départ le temps de compter. L'écriture directe dans la table est refusée —
-- aucune policy d'insertion — pour qu'il n'existe aucun chemin sans verrou,
-- pas même depuis PostgREST.
--
-- ════════════════════════════════════════════════════════════════════════
-- Pourquoi aucun rôle « chauffeur de louage »
-- ════════════════════════════════════════════════════════════════════════
--
-- Un rôle demande une approbation, donc quelqu'un pour approuver, donc un
-- délai — quand le besoin est d'annoncer un départ dans vingt minutes. Le
-- chauffeur publie sous son compte, avec son nom et son numéro visibles : le
-- voyageur appelle avant de se déplacer, et un chauffeur fantaisiste se
-- signale comme n'importe quel contenu.

do $$ begin
  create type public.louage_statut as enum ('ouvert', 'complet', 'parti', 'annule');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.louage_place_statut as enum ('reservee', 'annulee');
exception when duplicate_object then null; end $$;

/* ─── 1 · Le départ annoncé ───────────────────────────────────────────── */

create table if not exists public.louage_departures (
  id uuid primary key default gen_random_uuid(),

  driver_id uuid not null references public.profiles (id) on delete cascade,

  -- Recopiés, pas lus : le voyageur doit pouvoir appeler même si le chauffeur
  -- change son profil entre-temps.
  driver_name text not null check (btrim(driver_name) <> ''),
  phone text not null check (btrim(phone) <> ''),

  -- « Gafsa → Tunis ». Le point de départ est libre : « station Gafsa sud ».
  destination text not null check (btrim(destination) <> ''),
  departure_point text,

  seats_total integer not null check (seats_total between 1 and 9),
  departs_at timestamptz not null,

  price_per_seat numeric(10, 2) check (price_per_seat is null or price_per_seat >= 0),
  note text,

  status public.louage_statut not null default 'ouvert',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.louage_departures is
  'Un départ de louage annoncé : destination, heure approximative, places.';

/* Les départs à venir, dans l'ordre où ils partent : la seule lecture utile. */
create index if not exists louage_departs_a_venir_idx
  on public.louage_departures (departs_at) where status in ('ouvert', 'complet');
create index if not exists louage_departs_chauffeur_idx
  on public.louage_departures (driver_id, departs_at desc);

/* ─── 2 · Les places réservées ────────────────────────────────────────── */

create table if not exists public.louage_seats (
  id uuid primary key default gen_random_uuid(),

  departure_id uuid not null references public.louage_departures (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,

  full_name text not null check (btrim(full_name) <> ''),
  phone text not null check (btrim(phone) <> ''),
  seats integer not null default 1 check (seats between 1 and 9),

  status public.louage_place_statut not null default 'reservee',

  created_at timestamptz not null default now()
);

create index if not exists louage_places_depart_idx
  on public.louage_seats (departure_id, status);
create index if not exists louage_places_voyageur_idx
  on public.louage_seats (user_id, created_at desc);

/* ─── 3 · Qui voit quoi ───────────────────────────────────────────────── */

alter table public.louage_departures enable row level security;
alter table public.louage_departures force  row level security;
alter table public.louage_seats      enable row level security;
alter table public.louage_seats      force  row level security;

/*
  Un départ est public tant qu'il n'est pas vieux de deux heures.

  Pas « jusqu'à l'heure du départ » : un louage part avec du retard, et le
  voyageur qui arrive à l'heure dite doit encore le voir. Deux heures après,
  il n'intéresse plus personne et encombrerait la liste.
*/
drop policy if exists louage_departs_select on public.louage_departures;
create policy louage_departs_select on public.louage_departures
  for select using (
    driver_id = auth.uid()
    or public.is_admin()
    or (status in ('ouvert', 'complet') and departs_at > now() - interval '2 hours')
  );

drop policy if exists louage_departs_insert on public.louage_departures;
create policy louage_departs_insert on public.louage_departures
  for insert with check (
    driver_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
  );

drop policy if exists louage_departs_update on public.louage_departures;
create policy louage_departs_update on public.louage_departures
  for update using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

drop policy if exists louage_departs_delete on public.louage_departures;
create policy louage_departs_delete on public.louage_departures
  for delete using (driver_id = auth.uid() or public.is_admin());

/*
  Les places : le voyageur voit la sienne, le chauffeur voit celles de son
  départ. Personne ne les insère directement — il n'y a pas de policy
  d'insertion, et c'est voulu : `louage_reserver` est le seul chemin, parce
  qu'il est le seul à verrouiller.
*/
drop policy if exists louage_places_select on public.louage_seats;
create policy louage_places_select on public.louage_seats
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.louage_departures d
      where d.id = departure_id and d.driver_id = auth.uid()
    )
  );

/* Le voyageur annule la sienne ; le chauffeur annule celles de son départ. */
drop policy if exists louage_places_update on public.louage_seats;
create policy louage_places_update on public.louage_seats
  for update using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.louage_departures d
      where d.id = departure_id and d.driver_id = auth.uid()
    )
  ) with check (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.louage_departures d
      where d.id = departure_id and d.driver_id = auth.uid()
    )
  );

/* ─── 4 · Les départs à venir, avec leurs places restantes ────────────── */

create or replace function public.louage_a_venir()
returns table (
  id uuid,
  destination text,
  departure_point text,
  driver_name text,
  phone text,
  departs_at timestamptz,
  price_per_seat numeric,
  note text,
  seats_total integer,
  seats_left integer,
  mine boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    d.id, d.destination, d.departure_point, d.driver_name, d.phone,
    d.departs_at, d.price_per_seat, d.note, d.seats_total,
    greatest(
      0,
      d.seats_total - coalesce(
        (select sum(s.seats) from public.louage_seats s
          where s.departure_id = d.id and s.status = 'reservee'),
        0
      )
    )::integer,
    d.driver_id = auth.uid()
  from public.louage_departures d
  where d.status in ('ouvert', 'complet')
    and d.departs_at > now() - interval '2 hours'
  order by d.departs_at
  limit 60;
$$;

revoke all on function public.louage_a_venir() from public;
grant execute on function public.louage_a_venir() to anon, authenticated;

/* ─── 5 · Réserver, sous verrou ───────────────────────────────────────── */

create or replace function public.louage_reserver(
  p_departure uuid,
  p_seats integer,
  p_name text,
  p_phone text
)
returns table (seat_id uuid, seats_left integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  depart  public.louage_departures%rowtype;
  prises  integer;
  restant integer;
  demande integer := greatest(1, least(coalesce(p_seats, 1), 9));
  nouvelle uuid;
begin
  if auth.uid() is null then
    raise exception 'LOUAGE_CONNEXION' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_phone), '') = '' then
    raise exception 'LOUAGE_COORDONNEES' using errcode = 'check_violation';
  end if;

  -- Le verrou : sans lui, deux voyageurs emportent la même dernière place.
  select * into depart from public.louage_departures where id = p_departure for update;

  if not found or depart.status not in ('ouvert', 'complet') then
    raise exception 'LOUAGE_FERME' using errcode = 'check_violation';
  end if;
  if depart.departs_at <= now() - interval '2 hours' then
    raise exception 'LOUAGE_FERME' using errcode = 'check_violation';
  end if;
  if depart.driver_id = auth.uid() then
    raise exception 'LOUAGE_SOI_MEME' using errcode = 'check_violation';
  end if;

  select coalesce(sum(seats), 0) into prises
  from public.louage_seats
  where departure_id = p_departure and status = 'reservee';

  restant := depart.seats_total - prises;

  if restant < demande then
    raise exception 'LOUAGE_COMPLET' using errcode = 'check_violation';
  end if;

  insert into public.louage_seats (departure_id, user_id, full_name, phone, seats)
  values (p_departure, auth.uid(), btrim(p_name), btrim(p_phone), demande)
  returning id into nouvelle;

  restant := restant - demande;

  /* Le statut suit le remplissage : le chauffeur n'a rien à basculer. */
  if restant = 0 and depart.status = 'ouvert' then
    update public.louage_departures set status = 'complet' where id = p_departure;
  end if;

  return query select nouvelle, restant;
end;
$$;

revoke all on function public.louage_reserver(uuid, integer, text, text) from public, anon;
grant execute on function public.louage_reserver(uuid, integer, text, text) to authenticated;

/* ─── 6 · Annuler une place, et rouvrir le départ ─────────────────────── */

create or replace function public.louage_annuler_place(p_seat uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  place public.louage_seats%rowtype;
begin
  select * into place from public.louage_seats where id = p_seat for update;
  if not found then
    raise exception 'LOUAGE_INTROUVABLE' using errcode = 'no_data_found';
  end if;

  if place.user_id <> auth.uid()
     and not public.is_admin()
     and not exists (
       select 1 from public.louage_departures d
       where d.id = place.departure_id and d.driver_id = auth.uid()
     )
  then
    raise exception 'LOUAGE_PAS_A_VOUS' using errcode = 'insufficient_privilege';
  end if;

  update public.louage_seats set status = 'annulee' where id = p_seat;

  -- La place libérée rouvre le départ : sinon il resterait « complet » à tort.
  update public.louage_departures
  set status = 'ouvert'
  where id = place.departure_id and status = 'complet';
end;
$$;

revoke all on function public.louage_annuler_place(uuid) from public, anon;
grant execute on function public.louage_annuler_place(uuid) to authenticated;

drop trigger if exists trg_louage_departs_touch on public.louage_departures;
create trigger trg_louage_departs_touch before update on public.louage_departures
  for each row execute function public.touch_updated_at();

grant select on public.louage_departures, public.louage_seats to anon, authenticated;
grant insert, update, delete on public.louage_departures to authenticated;
grant update on public.louage_seats to authenticated;
