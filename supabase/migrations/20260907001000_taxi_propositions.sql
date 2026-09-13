-- Propositions de destination, recherche de clients par le chauffeur,
-- et sortie d'une course acceptée.
--
-- ════════════════════════════════════════════════════════════════════════
-- Ce que cette migration ajoute, et pourquoi
-- ════════════════════════════════════════════════════════════════════════
--
-- Trois manques, tous constatés à l'usage :
--
--   1. **La destination du client était une contrainte.** Le matching ne
--      retenait qu'un chauffeur dont la zone d'arrivée était exactement celle
--      demandée. La pratique de Gafsa est l'inverse : le chauffeur dit « je
--      vais vers Lella, ça vous arrange ? », et on s'entend. La destination
--      devient donc une *préférence*, et une contre-proposition est possible.
--
--   2. **Le chauffeur ne pouvait pas chercher.** Il attendait qu'une demande
--      lui soit diffusée. Or `taxi_requests` n'est lisible que de ses deux
--      extrémités — et un chauffeur n'en est pas une tant que `driver_id` est
--      nul. Il lui fallait donc une porte, filtrante et contrôlée : c'est
--      `taxi_demandes_proches`.
--
--   3. **Une course acceptée n'avait aucune sortie.** Les deux fonctions
--      d'annulation existantes filtrent sur `status = 'en_attente'` ; passé
--      l'acceptation, ni le client ni le chauffeur ne pouvaient renoncer, et
--      les places consommées n'étaient jamais rendues.
--
-- Tout est **additif**. Aucune colonne n'est supprimée, aucune policy n'est
-- retirée, et le chemin de course existant continue de fonctionner à
-- l'identique pour qui n'utilise pas les propositions.

/* ─── 1 · La contre-proposition de destination ────────────────────────── */

alter table public.taxi_requests
  -- Ce que le chauffeur propose à la place. Nuls tant que personne n'a rien
  -- proposé, ce qui est le cas ordinaire.
  add column if not exists proposed_dest_label text,
  add column if not exists proposed_dest_lat double precision,
  add column if not exists proposed_dest_lng double precision,

  -- Qui propose. Le chauffeur aujourd'hui ; la colonne existe pour que le
  -- client puisse un jour proposer en retour sans changer le schéma.
  add column if not exists proposal_by uuid references public.profiles (id) on delete set null,

  add column if not exists proposal_status text
    check (proposal_status is null or proposal_status in ('pending', 'accepted', 'refused')),
  add column if not exists proposal_at timestamptz;

comment on column public.taxi_requests.proposed_dest_label is
  'Destination proposée par le chauffeur, en toutes lettres. La course ne bascule dessus qu''après acceptation du client.';

/* ─── 2 · Chercher les clients autour de soi ──────────────────────────── */

/*
  L'index qui rend la recherche géographique tenable.

  Pas de PostGIS ici — il n'est pas activé, et à l'échelle d'une ville deux
  colonnes suffisent. La fonction ci-dessous pré-filtre par une boîte
  englobante (qui utilise cet index) avant de calculer la vraie distance sur
  le petit nombre de lignes restantes.
*/
create index if not exists taxi_requests_ouvertes_geo_idx
  on public.taxi_requests (status, expires_at, pickup_lat, pickup_lng)
  where status = 'en_attente';

/*
  Les demandes ouvertes autour d'un point.

  `SECURITY DEFINER` parce que c'est la seule façon honnête de faire : les
  policies de `taxi_requests` ne montrent une demande qu'à ses deux extrémités,
  et un chauffeur n'en est pas une tant que personne n'a accepté. Ouvrir la
  table en lecture à tous les chauffeurs serait exposer les déplacements de
  toute la ville ; cette fonction rend exactement ce qu'il faut pour décider, et
  rien de plus.

  Ce qu'elle ne rend PAS, délibérément : l'identité du client, son téléphone,
  et les coordonnées exactes du point de départ. Le chauffeur voit une distance
  et un libellé — de quoi juger la course. Le reste n'apparaît qu'à
  l'acceptation, quand il devient une extrémité de la demande.

  L'appelant doit être un chauffeur approuvé : la fonction le vérifie
  elle-même, puisqu'elle contourne RLS.
*/
create or replace function public.taxi_demandes_proches(
  p_lat double precision,
  p_lng double precision,
  p_rayon_m integer default 8000,
  p_limite integer default 20
)
returns table (
  id uuid,
  pickup_label text,
  origin_zone text,
  destination_zone text,
  destination_type text,
  destination_name text,
  dest_label text,
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
  -- Un degré de latitude vaut ~111 km partout ; un degré de longitude vaut
  -- 111 km × cos(latitude). À Gafsa (34,4°) cela fait ~91,6 km.
  delta_lat double precision;
  delta_lng double precision;
  rayon integer := greatest(200, least(50000, coalesce(p_rayon_m, 8000)));
begin
  -- Réservé aux chauffeurs approuvés. La fonction traverse RLS : c'est ici, et
  -- nulle part ailleurs, que se décide qui a le droit de voir cette liste.
  if not exists (
    select 1 from public.taxi_drivers d
    where d.id = auth.uid() and d.is_approved
  ) then
    return;
  end if;

  if p_lat is null or p_lng is null then
    return;
  end if;

  delta_lat := rayon / 111000.0;
  delta_lng := rayon / (111000.0 * greatest(0.1, cos(radians(p_lat))));

  return query
  select
    r.id,
    r.pickup_label,
    r.origin_zone,
    r.destination_zone,
    r.destination_type,
    r.destination_name,
    r.dest_label,
    r.proposed_price,
    r.seats,
    r.expires_at,
    r.created_at,
    -- Haversine, arrondi au mètre.
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
  where r.status = 'en_attente'
    and r.driver_id is null
    and r.expires_at > now()
    -- Boîte englobante : c'est elle qui utilise l'index.
    and r.pickup_lat between p_lat - delta_lat and p_lat + delta_lat
    and r.pickup_lng between p_lng - delta_lng and p_lng + delta_lng
    -- Le client ne se voit pas lui-même s'il est aussi chauffeur.
    and r.client_id <> auth.uid()
  order by distance_m asc
  limit greatest(1, least(50, coalesce(p_limite, 20)));
end;
$$;

comment on function public.taxi_demandes_proches(double precision, double precision, integer, integer) is
  'Demandes de course ouvertes autour d''un point, pour un chauffeur approuvé. Ne rend ni l''identité du client ni son téléphone.';

revoke all on function public.taxi_demandes_proches(double precision, double precision, integer, integer) from public, anon;
grant execute on function public.taxi_demandes_proches(double precision, double precision, integer, integer) to authenticated;

/* ─── 3 · Proposer une destination, et y répondre ─────────────────────── */

/*
  Le chauffeur propose autre chose.

  Écrit sur la demande plutôt que dans une table à part : il n'y a jamais
  qu'une proposition en cours, elle appartient à la course, et la lire suppose
  déjà de lire la course. Une table de plus n'apporterait qu'une jointure.

  La proposition ne change RIEN à la destination : elle attend. C'est
  `taxi_repondre_proposition` qui bascule, et seulement sur un « oui ».
*/
create or replace function public.taxi_proposer_destination(
  p_demande uuid,
  p_label text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ligne public.taxi_requests;
  nom   text := nullif(btrim(p_label), '');
begin
  if nom is null or char_length(nom) > 80 then
    raise exception 'Écrivez la destination en quelques mots' using errcode = 'P0001';
  end if;

  select * into ligne from public.taxi_requests where id = p_demande;

  if ligne.id is null then
    raise exception 'Demande introuvable' using errcode = 'P0001';
  end if;

  /*
    Qui a le droit de proposer, et quand.

    Le chauffeur de la course, ou — tant que personne n'a accepté — un
    chauffeur approuvé à qui la demande a été diffusée. C'est ce qui permet la
    négociation *avant* l'acceptation, qui est tout l'objet de la
    fonctionnalité : « je vais vers Lella, ça vous arrange ? » se dit avant de
    s'engager, pas après.
  */
  if ligne.driver_id is not null then
    if ligne.driver_id <> auth.uid() then
      raise exception 'Cette course ne vous est pas adressée' using errcode = 'P0001';
    end if;
  else
    if not exists (
      select 1 from public.taxi_request_matches m
      where m.request_id = p_demande and m.driver_id = auth.uid()
    ) then
      raise exception 'Cette demande ne vous a pas été proposée' using errcode = 'P0001';
    end if;
  end if;

  if ligne.status not in ('en_attente', 'acceptee', 'driver_arriving') then
    raise exception 'Cette course est trop avancée pour changer de destination' using errcode = 'P0001';
  end if;

  update public.taxi_requests
  set proposed_dest_label = nom,
      proposed_dest_lat   = p_lat,
      proposed_dest_lng   = p_lng,
      proposal_by         = auth.uid(),
      proposal_status     = 'pending',
      proposal_at         = now()
  where id = p_demande;

  -- Le client doit le savoir même application fermée : c'est une question qui
  -- attend une réponse, pas une information de plus.
  insert into public.notifications (user_id, kind, title, body, link)
  values (
    ligne.client_id,
    'taxi_request',
    'Nouvelle destination proposée',
    nom || ' — acceptez ou refusez depuis la discussion.',
    '/taxi'
  );
end;
$$;

/*
  Le client tranche.

  « Oui » remplace la destination et efface la proposition. « Non » la marque
  refusée et laisse la course telle quelle — le chauffeur peut en proposer une
  autre, ou renoncer.
*/
create or replace function public.taxi_repondre_proposition(
  p_demande uuid,
  p_accepte boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ligne public.taxi_requests;
begin
  select * into ligne from public.taxi_requests where id = p_demande;

  if ligne.id is null or ligne.client_id <> auth.uid() then
    raise exception 'Demande introuvable' using errcode = 'P0001';
  end if;

  if ligne.proposal_status is distinct from 'pending' then
    raise exception 'Aucune proposition en attente' using errcode = 'P0001';
  end if;

  if p_accepte then
    update public.taxi_requests
    set dest_label       = ligne.proposed_dest_label,
        dest_lat         = coalesce(ligne.proposed_dest_lat, dest_lat),
        dest_lng         = coalesce(ligne.proposed_dest_lng, dest_lng),
        -- La destination devient libre : elle ne correspond plus à une zone
        -- du répertoire, et prétendre le contraire fausserait le matching.
        destination_type = 'autre',
        destination_name = ligne.proposed_dest_label,
        destination_zone = null,
        proposal_status  = 'accepted'
    where id = p_demande;
  else
    update public.taxi_requests
    set proposal_status = 'refused'
    where id = p_demande;
  end if;

  if ligne.proposal_by is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      ligne.proposal_by,
      'taxi_request',
      case when p_accepte then 'Destination acceptée' else 'Destination refusée' end,
      case
        when p_accepte then coalesce(ligne.proposed_dest_label, '') || ' — vous pouvez démarrer.'
        else 'Le client préfère sa destination initiale.'
      end,
      '/taxi/chauffeur'
    );
  end if;
end;
$$;

revoke all on function public.taxi_proposer_destination(uuid, text, double precision, double precision) from public, anon;
revoke all on function public.taxi_repondre_proposition(uuid, boolean) from public, anon;
grant execute on function public.taxi_proposer_destination(uuid, text, double precision, double precision) to authenticated;
grant execute on function public.taxi_repondre_proposition(uuid, boolean) to authenticated;

/* ─── 4 · Sortir d'une course acceptée ────────────────────────────────── */

/*
  L'annulation qui manquait, et la restitution qui va avec.

  Les deux fonctions d'annulation existantes filtrent sur `en_attente` : passé
  l'acceptation, personne ne pouvait plus renoncer. Un chauffeur qui accepte
  puis s'éteint laissait une course ouverte pour toujours, et des places
  consommées que rien ne rendait.

  Ouverte aux deux parties, parce que les deux ont de bonnes raisons : le
  client qui a trouvé un autre moyen, le chauffeur qui a crevé.
*/
create or replace function public.taxi_annuler_course(
  p_demande uuid,
  p_motif text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ligne     public.taxi_requests;
  par_client boolean;
  places    smallint;
  total     smallint;
begin
  select * into ligne from public.taxi_requests where id = p_demande;

  if ligne.id is null then
    raise exception 'Demande introuvable' using errcode = 'P0001';
  end if;

  par_client := ligne.client_id = auth.uid();

  if not par_client and ligne.driver_id is distinct from auth.uid() then
    raise exception 'Cette course ne vous concerne pas' using errcode = 'P0001';
  end if;

  -- Une course terminée ne s'annule pas : elle a eu lieu.
  if ligne.status in ('completed', 'annulee', 'refusee', 'expiree') then
    raise exception 'Cette course est déjà close' using errcode = 'P0001';
  end if;

  update public.taxi_requests
  set status = 'annulee',
      responded_at = now()
  where id = p_demande;

  -- La diffusion s'éteint : un chauffeur ne doit pas voir une course annulée.
  delete from public.taxi_request_matches where request_id = p_demande;

  /*
    Rendre les places, et rouvrir le véhicule.

    Seulement si la course avait été acceptée — avant, rien n'avait été pris.
    Le plafond est `seats_total`, sans quoi une annulation répétée gonflerait
    le nombre de places au-delà du nombre de sièges.
  */
  if ligne.driver_id is not null and ligne.status <> 'en_attente' then
    select seats_free, seats_total into places, total
    from public.taxi_drivers where id = ligne.driver_id;

    update public.taxi_drivers
    set seats_free = case
          when places is null then null
          else least(coalesce(total, 4), places + coalesce(ligne.seats, 1))
        end,
        status = 'libre',
        status_since = now(),
        is_available = true,
        updated_at = now()
    where id = ligne.driver_id;
  end if;

  -- Prévenir l'autre partie, jamais soi-même.
  if par_client and ligne.driver_id is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (ligne.driver_id, 'taxi_request', 'Course annulée par le client',
            coalesce(p_motif, 'Vous êtes de nouveau disponible.'), '/taxi/chauffeur');
  elsif not par_client then
    insert into public.notifications (user_id, kind, title, body, link)
    values (ligne.client_id, 'taxi_request', 'Course annulée par le chauffeur',
            coalesce(p_motif, 'Relancez une recherche pour trouver un autre taxi.'), '/taxi');
  end if;
end;
$$;

revoke all on function public.taxi_annuler_course(uuid, text) from public, anon;
grant execute on function public.taxi_annuler_course(uuid, text) to authenticated;

/* ─── Reprise ──────────────────────────────────────────────────────────

   Tout est additif : colonnes nulles par défaut, fonctions nouvelles, index
   supplémentaire. Le chemin de course existant est inchangé, et une
   application qui ignore les propositions fonctionne exactement comme avant.

   Marche arrière :
     drop function public.taxi_annuler_course(uuid, text);
     drop function public.taxi_repondre_proposition(uuid, boolean);
     drop function public.taxi_proposer_destination(uuid, text, double precision, double precision);
     drop function public.taxi_demandes_proches(double precision, double precision, integer, integer);
     drop index public.taxi_requests_ouvertes_geo_idx;
     alter table public.taxi_requests
       drop column proposed_dest_label, drop column proposed_dest_lat,
       drop column proposed_dest_lng, drop column proposal_by,
       drop column proposal_status, drop column proposal_at;

   ─── Reste à faire, hors de cette migration ───────────────────────────

   La policy `taxi_requests_update` autorise encore un client à écrire
   n'importe quel statut et n'importe quel `driver_id` sur sa propre demande
   (constat SEC-01 de l'audit du 7 septembre). Les fonctions ci-dessus ne le
   corrigent pas : elles ajoutent des portes sûres, elles ne ferment pas
   l'ancienne. La fermeture demande de router les quatre transitions de course
   existantes par des fonctions équivalentes, puis :

     revoke update on public.taxi_requests from authenticated;

   À faire en trois temps, une fois les journaux confirmant qu'aucune écriture
   directe ne subsiste.
*/
