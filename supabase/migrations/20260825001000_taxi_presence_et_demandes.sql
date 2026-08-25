-- Présence du chauffeur, places disponibles, et demandes de course.
--
-- ════════════════════════════════════════════════════════════════════════
-- Le problème : « application fermée » ne veut pas dire « hors ligne »
-- ════════════════════════════════════════════════════════════════════════
--
-- Jusqu'ici, l'état d'un chauffeur se déduisait de la fraîcheur de sa position :
-- au-delà de dix minutes sans relevé, il disparaissait de la carte et passait
-- « hors ligne ». Or un chauffeur ferme l'application dès qu'il démarre — il
-- répond sur WhatsApp, il conduit. Dix minutes plus tard, un homme parfaitement
-- disponible était invisible pour tout le monde.
--
-- La correction sépare deux choses que le code confondait :
--
--   · ce que le chauffeur **déclare** — libre, occupé, des places — qui est une
--     décision, et qui n'a aucune raison de s'effacer parce qu'il a changé
--     d'écran. Elle vit ici, dans la base, et le serveur en est le gardien ;
--   · où il **était** la dernière fois qu'on l'a su, qui vieillit et qu'il faut
--     dater honnêtement.
--
-- Une déclaration ne se périme donc plus toute seule. Elle expire après un
-- délai long et explicite — douze heures — parce qu'un chauffeur qui s'est
-- déclaré libre avant-hier soir ne l'est plus, et que personne ne pense à se
-- déclarer occupé en rentrant chez soi.

/* ─── L'état déclaré ───────────────────────────────────────────────────── */

alter table public.taxi_drivers
  -- Quatre états, dont un que l'ancien modèle ne savait pas exprimer :
  -- « en course mais il me reste des places ». C'est le louage urbain, la
  -- pratique la plus courante à Gafsa, et l'application la rendait invisible.
  add column if not exists status text not null default 'hors_ligne'
    check (status in ('libre', 'places', 'occupe', 'hors_ligne')),

  -- Quand cette déclaration a été faite. Sert à la faire expirer, et à dire au
  -- client « libre depuis 3 minutes » plutôt qu'un « libre » hors du temps.
  add column if not exists status_since timestamptz not null default now(),

  -- Dernier signe de vie de l'application. Distinct de la position : le
  -- chauffeur peut ouvrir l'écran sans autoriser le GPS.
  add column if not exists last_seen_at timestamptz;

comment on column public.taxi_drivers.status is
  'État déclaré par le chauffeur. Ne dépend pas de la fraîcheur de sa position : une application fermée ne rend personne indisponible.';

/*
  Reprise des comptes existants.

  `is_available` reste en place et continue de dire « peut prendre un client » —
  l'administration et les anciennes requêtes s'en servent. On y aligne le
  nouveau statut une fois, pour que personne ne se retrouve « hors ligne » du
  jour au lendemain sans avoir rien fait.
*/
update public.taxi_drivers
set status = case when is_available then 'libre' else 'occupe' end,
    status_since = coalesce(updated_at, now())
where status = 'hors_ligne';

/* ─── Les demandes de course ───────────────────────────────────────────── */

create table if not exists public.taxi_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  driver_id uuid not null references public.taxi_drivers (id) on delete cascade,

  -- Le trajet, figé au moment de la demande. On ne le recalcule pas plus tard :
  -- le chauffeur doit répondre sur ce qu'on lui a montré, pas sur une position
  -- qui a bougé entre-temps.
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  pickup_label text,
  dest_lat double precision,
  dest_lng double precision,
  dest_label text,

  distance_m integer check (distance_m is null or distance_m >= 0),
  duration_min integer check (duration_min is null or duration_min >= 0),

  -- Combien de personnes. Sert à décrémenter les places du chauffeur quand il
  -- accepte.
  seats smallint not null default 1 check (seats between 1 and 8),

  status text not null default 'en_attente'
    check (status in ('en_attente', 'acceptee', 'refusee', 'expiree', 'annulee')),

  /*
    L'expiration est portée par la ligne, pas par une minuterie.

    Une minuterie côté application meurt avec l'onglet ; un champ de date reste
    vrai que le serveur redémarre ou non. La demande est donc « expirée » par sa
    propre échéance, et le nettoyage périodique ne fait qu'entériner ce que la
    date dit déjà.
  */
  expires_at timestamptz not null default now() + interval '3 minutes',

  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists taxi_requests_driver_idx
  on public.taxi_requests (driver_id, status, created_at desc);

create index if not exists taxi_requests_client_idx
  on public.taxi_requests (client_id, created_at desc);

/*
  Une seule demande en attente à la fois entre un client et un chauffeur.

  Sans cela, un client impatient qui touche trois fois le bouton fait sonner le
  téléphone du chauffeur trois fois pour la même course.
*/
create unique index if not exists taxi_requests_une_en_attente
  on public.taxi_requests (client_id, driver_id)
  where status = 'en_attente';

alter table public.taxi_requests enable row level security;

-- Les deux extrémités voient la demande, et personne d'autre.
drop policy if exists taxi_requests_select on public.taxi_requests;
create policy taxi_requests_select on public.taxi_requests
  for select using (client_id = auth.uid() or driver_id = auth.uid());

-- Un client crée ses propres demandes, à un chauffeur approuvé.
drop policy if exists taxi_requests_insert on public.taxi_requests;
create policy taxi_requests_insert on public.taxi_requests
  for insert with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.taxi_drivers d
      where d.id = driver_id and d.is_approved
    )
  );

-- Le chauffeur répond ; le client peut annuler. Chacun de son côté.
drop policy if exists taxi_requests_update on public.taxi_requests;
create policy taxi_requests_update on public.taxi_requests
  for update using (driver_id = auth.uid() or client_id = auth.uid())
  with check (driver_id = auth.uid() or client_id = auth.uid());

/* ─── L'expiration, entérinée périodiquement ───────────────────────────── */

create or replace function public.expire_taxi_requests()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare touchees integer;
begin
  update public.taxi_requests
  set status = 'expiree', responded_at = now()
  where status = 'en_attente' and expires_at <= now();

  get diagnostics touchees = row_count;

  /*
    Un chauffeur qui laisse expirer une demande n'est pas fautif — il conduisait.
    Mais le déclarer encore « libre » ferait sonner tous les clients suivants
    dans le vide. On ne touche donc pas à son état ici : c'est le délai de
    déclaration, ci-dessous, qui s'en charge, et lui seul.
  */

  /*
    Une déclaration de plus de douze heures ne veut plus rien dire.

    Le chauffeur s'est déclaré libre hier soir et a fermé l'application. Le
    serveur ne peut pas savoir s'il dort ou s'il travaille : entre laisser un
    fantôme sur la carte et le rendre injoignable, on choisit de le retirer, et
    il lui suffira d'un geste pour revenir.
  */
  update public.taxi_drivers
  set status = 'hors_ligne', status_since = now()
  where status <> 'hors_ligne'
    and status_since < now() - interval '12 hours';

  return touchees;
end;
$$;

comment on function public.expire_taxi_requests() is
  'Passe les demandes échues en « expiree » et retire les déclarations de plus de douze heures. À appeler périodiquement.';

/* ─── Reprise ──────────────────────────────────────────────────────────── */

-- Tout est additif. `is_available` n'est pas touché, aucune ligne n'est
-- supprimée, et un chauffeur qui n'ouvre jamais le nouvel écran garde le
-- comportement qu'il avait.
--
-- Marche arrière :
--   drop function public.expire_taxi_requests();
--   drop table public.taxi_requests;
--   alter table public.taxi_drivers
--     drop column status, drop column status_since, drop column last_seen_at;
