-- Matching par trajet : zones prédéfinies, budget proposé, diffusion.
--
-- ════════════════════════════════════════════════════════════════════════
-- Ce que cette migration change, et pourquoi
-- ════════════════════════════════════════════════════════════════════════
--
-- Jusqu'ici, une course se demandait à un chauffeur précis : le client
-- choisissait une fiche sur la liste et `taxi_requests` enregistrait la
-- demande à son intention. La pratique courante à Gafsa va dans l'autre sens —
-- le client annonce où il va et ce qu'il propose, et plusieurs chauffeurs
-- compatibles voient la demande, la demandant au premier qui accepte.
--
-- On garde l'ancien chemin — un client peut toujours s'adresser à un chauffeur
-- précis — et on ajoute l'autre, par-dessus :
--
--   · le chauffeur **déclare son trajet** (zone de départ → zone de
--     destination) et le fait savoir s'il accepte les destinations
--     personnalisées ;
--   · le client **annonce sa destination** — une zone prédéfinie ou « autre »,
--     le nom exact en toutes lettres dans ce cas —, **son budget** et le nombre
--     de passagers ;
--   · le serveur **calcule les chauffeurs compatibles** (trajet, disponibilité,
--     places) et leur **diffuse** la demande via une table légère
--     `taxi_request_matches`, diffusée en temps réel ;
--   · l'**acceptation est atomique** : un seul chauffeur gagne, les autres
--     voient la demande disparaître instantanément.
--
-- Pourquoi une table de diffusion plutôt que de rendre `taxi_requests` lisible
-- par tous les chauffeurs ?
--
--   · la compatibilité est calculée côté serveur, au moment de la demande — un
--     chauffeur ne filtre pas à la main une liste de demandes qui ne le
--     concernent pas ;
--   · les demandes des autres ne sont jamais visibles que par ceux qu'elles
--     concernent (les deux extrémités d'une demande : le client, les
--     chauffeurs qu'on lui a appariés) ;
--   · le volume temps réel reste borné : quelques lignes par demande, là où la
--     position GPS épuisait le quota en une journée.
--
-- `taxi_requests.driver_id` devient **nullable** : il est nul tant qu'aucun
-- chauffeur n'a accepté, et n'est renseigné qu'à l'acceptation. C'est la ligne
-- qui porte l'expiration et les statuts anciens (`en_attente`, `acceptee`,
-- ...) ; le nouveau chemin ne fait que changer *qui* peut répondre.

/* ─── Le trajet déclaré du chauffeur ──────────────────────────────────── */

alter table public.taxi_drivers
  -- Sa route déclarée, en zones de Gafsa. Nuls tant qu'il ne l'a pas dite :
  -- sans route, il ne reçoit que les demandes personnalisées, et seulement
  -- s'il le demande.
  add column if not exists origin_zone text
    check (origin_zone is null or origin_zone in
      ('gafsa_centre', 'ksar', 'hay_nour', 'hay_sourour', 'hay_chabeb', 'dwali', 'lella')),
  add column if not exists destination_zone text
    check (destination_zone is null or destination_zone in
      ('gafsa_centre', 'ksar', 'hay_nour', 'hay_sourour', 'hay_chabeb', 'dwali', 'lella')),

  -- Accepte-t-il les destinations personnalisées ? C'est une offre du
  -- chauffeur, jamais une hypothèse de la plateforme.
  add column if not exists accepts_custom boolean not null default false;

comment on column public.taxi_drivers.origin_zone is
  'Zone de départ du trajet que le chauffeur a choisi de servir. Sans lui, pas de matching par trajet.';
comment on column public.taxi_drivers.accepts_custom is
  'Le chauffeur accepte de recevoir les demandes à destination libre.';

-- La diffusion interroge cette liste à chaque demande : la rendre rapide.
create index if not exists taxi_drivers_matching_idx
  on public.taxi_drivers (origin_zone, destination_zone, is_available)
  where status = 'libre' and is_approved;

/* ─── La demande diffusée ─────────────────────────────────────────────── */

alter table public.taxi_requests
  -- Nul tant qu'aucun chauffeur n'a accepté : la demande est alors offerte à
  -- plusieurs chauffeurs à la fois, et l'heureux élu est écrit ici.
  alter column driver_id drop not null,

  -- Le trajet, en zones et en mots. « Autre » garde le nom exact que le client
  -- a tapé : c'est ce que le chauffeur doit voir avant d'accepter.
  add column if not exists origin_zone text
    check (origin_zone is null or origin_zone in
      ('gafsa_centre', 'ksar', 'hay_nour', 'hay_sourour', 'hay_chabeb', 'dwali', 'lella')),
  add column if not exists destination_zone text
    check (destination_zone is null or destination_zone in
      ('gafsa_centre', 'ksar', 'hay_nour', 'hay_sourour', 'hay_chabeb', 'dwali', 'lella')),
  add column if not exists destination_type text not null default 'zone'
    check (destination_type in ('zone', 'autre')),
  add column if not exists destination_name text,

  -- La proposition du client. Ce n'est jamais un tarif imposé : le chauffeur
  -- l'accepte, la refuse, ou en discute par téléphone ou par messages.
  add column if not exists proposed_price integer
    check (proposed_price is null or proposed_price between 0 and 999),
  -- Le prix entériné à l'acceptation. Le budget proposé par défaut.
  add column if not exists accepted_price integer
    check (accepted_price is null or accepted_price between 0 and 999);

comment on column public.taxi_requests.driver_id is
  'Le chauffeur qui a accepté. Nul tant que la demande est en diffusion : plusieurs chauffeurs la voient, un seul la prend.';

/*
  Une seule demande ouverte par client, qu'elle soit diffusée ou adressée à un
  chauffeur précis.

  L'ancien garde-fou restreignait par couple (client, chauffeur) ; la
  diffusion, elle, ne connaît pas de chauffeur fixé à l'avance. Sans cette
  contrainte, un client impatient toucherait dix fois « Rechercher » et
  ferait sonner dix chauffeurs pour la même course.
*/
create unique index if not exists taxi_requests_une_ouverte_par_client
  on public.taxi_requests (client_id)
  where status = 'en_attente';

/* ─── La diffusion aux chauffeurs compatibles ─────────────────────────── */

create table if not exists public.taxi_request_matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.taxi_requests (id) on delete cascade,
  driver_id uuid not null references public.taxi_drivers (id) on delete cascade,

  /*
    Un instantané de ce que le chauffeur doit voir, pris à la demande.

    Les policies de `taxi_requests` ne montrent une demande qu'à ses deux
    extrémités — et un chauffeur n'y est pas tant que `driver_id` est nul.
    Ces colonnes portent donc ce qui lui est nécessaire pour décider, sans
    qu'il ait à lire la demande elle-même, et sans exposer l'identité du
    client ni son départ précis.
  */
  pickup_label text,
  origin_zone text,
  destination_zone text,
  destination_type text not null default 'zone'
    check (destination_type in ('zone', 'autre')),
  destination_name text,
  proposed_price integer,
  seats smallint check (seats is null or seats between 1 and 8),
  expires_at timestamptz,

  created_at timestamptz not null default now(),

  unique (request_id, driver_id)
);

create index if not exists taxi_request_matches_driver_idx
  on public.taxi_request_matches (driver_id, created_at desc);

alter table public.taxi_request_matches enable row level security;

-- Un chauffeur ne voit que ses propres correspondances.
drop policy if exists taxi_request_matches_select on public.taxi_request_matches;
create policy taxi_request_matches_select on public.taxi_request_matches
  for select using (driver_id = auth.uid());

-- Personne n'écrit de correspondance depuis un navigateur : seul le serveur
-- (clé de service) les crée au moment du matching.

-- Refuser, c'est retirer sa propre correspondance : la demande continue vers
-- les autres chauffeurs, elle ne s'éteint pas pour tout le monde.
drop policy if exists taxi_request_matches_delete on public.taxi_request_matches;
create policy taxi_request_matches_delete on public.taxi_request_matches
  for delete using (driver_id = auth.uid());

/*
  La diffusion en temps réel.

  `taxi_request_matches` porte peu de lignes (une demande = quelques lignes) et
  ne change que sur insert/delete : la rafale GPS qui a fait sortir les
  positions du temps réel n'a rien à voir ici. On l'ajoute donc à la
  publication, ainsi que `taxi_requests` — le client suit l'évolution de sa
  demande sans recharger.
*/
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'taxi_request_matches'
  ) then
    alter publication supabase_realtime add table public.taxi_request_matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'taxi_requests'
  ) then
    alter publication supabase_realtime add table public.taxi_requests;
  end if;
end $$;

/* ─── Expiration : nettoie aussi la diffusion ─────────────────────────── */

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

  update public.taxi_drivers
  set status = 'hors_ligne', status_since = now()
  where status <> 'hors_ligne'
    and status_since < now() - interval '12 hours';

  /*
    Une demande n'est plus en diffusion dès qu'elle a changé d'état : acceptée,
    expirée, annulée. Retirer les correspondances qui restent — on a déjà
    accepté l'acceptée et l'annulée à l'action — empêche une demande périmée de
    faire sonner un chauffeur qui rouvre l'écran.
  */
  delete from public.taxi_request_matches m
  using public.taxi_requests r
  where m.request_id = r.id and r.status <> 'en_attente';

  return touchees;
end;
$$;

/* ─── Le genre de notification des courses ──────────────────────────────

   Le code insère déjà `kind = 'taxi_request'` ; si l'énum n'a pas encore été
   étendue à la main, ce passage l'ajoute sans bruit. `IF NOT EXISTS` n'existe
   que pour ce cas : l'énum peut très bien l'avoir reçue entre-temps. */
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'notification_kind' and e.enumlabel = 'taxi_request'
  ) then
    alter type public.notification_kind add value 'taxi_request';
  end if;
end $$;

/* ─── Reprise ────────────────────────────────────────────────────────────

   Tout est additif. `is_available`, `status`, les places et l'ancienne
   demande par chauffeur précis continuent de vivre ; on les fait coexister
   avec la diffusion plutôt que de les remplacer.

   Marche arrière :
     drop table public.taxi_request_matches;
     drop index public.taxi_requests_une_ouverte_par_client;
     alter table public.taxi_requests
       drop column origin_zone, drop column destination_zone,
       drop column destination_type, drop column destination_name,
       drop column proposed_price, drop column accepted_price;
     alter table public.taxi_drivers
       drop column origin_zone, drop column destination_zone,
       drop column accepts_custom;
     alter table public.taxi_requests alter column driver_id set not null;
*/