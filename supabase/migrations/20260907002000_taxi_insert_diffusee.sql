-- La policy d'insertion avait été oubliée en route.
--
-- ════════════════════════════════════════════════════════════════════════
-- Le défaut
-- ════════════════════════════════════════════════════════════════════════
--
-- `20260825001000` a créé `taxi_requests` avec une seule façon de demander
-- une course : à un chauffeur précis. Sa policy d'insertion dit donc, à juste
-- titre pour l'époque, que le chauffeur visé doit exister et être approuvé :
--
--     with check (
--       client_id = auth.uid()
--       and exists (select 1 from taxi_drivers d
--                   where d.id = driver_id and d.is_approved)
--     )
--
-- `20260901002000` a ajouté la diffusion : le client annonce sa course, et
-- plusieurs chauffeurs la voient. Elle a rendu `driver_id` **nullable** pour
-- cela — la demande naît sans destinataire, et le premier qui accepte s'y
-- inscrit. Mais elle n'a pas touché à la policy.
--
-- Les deux moitiés ne se parlaient plus. Une demande diffusée part avec
-- `driver_id` nul ; la sous-requête cherche alors `d.id = null`, qui ne
-- correspond à rien ; `exists(...)` est faux ; le `with check` refuse la
-- ligne. Postgres répond **42501**, que le code applicatif ne savait pas
-- nommer et rendait comme « La demande n'a pas pu être créée. »
--
-- Aucun client ne pouvait donc lancer une recherche, et le message ne disait
-- pas pourquoi.
--
-- ════════════════════════════════════════════════════════════════════════
-- Le correctif
-- ════════════════════════════════════════════════════════════════════════
--
-- Deux formes de demande légitimes, donc deux branches. Ce qui ne change pas :
-- on n'écrit jamais que pour soi (`client_id = auth.uid()`), et un chauffeur
-- nommé doit toujours être approuvé — c'est la garantie qui empêche
-- d'adresser une course à quelqu'un que la plateforme n'a pas vérifié.

drop policy if exists taxi_requests_insert on public.taxi_requests;

create policy taxi_requests_insert on public.taxi_requests
  for insert with check (
    client_id = auth.uid()
    and (
      /*
        Demande diffusée : personne n'est visé, le matching s'en charge.

        `driver_id` reste nul jusqu'à ce qu'un chauffeur accepte, et cette
        écriture-là ne passe pas par ici — elle est faite par la clé de
        service, dans `repondreDemandeDiffusee`, avec son écriture gagnante
        atomique. Autoriser le nul à l'insertion n'ouvre donc rien : cela
        rend seulement possible la demande sans destinataire.
      */
      driver_id is null

      /*
        Demande adressée : le chauffeur existe et il est vérifié.

        Condition d'origine, conservée mot pour mot. La plateforme met en
        avant des inconnus auprès de ses clients ; adresser une course à une
        fiche non approuvée reviendrait à contourner ce contrôle par la
        bande.
      */
      or exists (
        select 1 from public.taxi_drivers d
        where d.id = driver_id and d.is_approved
      )
    )
  );

comment on policy taxi_requests_insert on public.taxi_requests is
  'Un client crée ses propres demandes : diffusée (driver_id nul) ou adressée à un chauffeur approuvé.';

/* ─── Reprise ──────────────────────────────────────────────────────────

   La policy est remplacée, pas ajoutée : rejouer ce fichier est sans effet.
   Elle est strictement plus permissive que la précédente sur un seul point —
   le `driver_id` nul —, et ce point est précisément ce que la migration du
   1er septembre avait rendu nécessaire sans l'autoriser.

   Marche arrière — attention, elle recasse la recherche côté client :
     drop policy if exists taxi_requests_insert on public.taxi_requests;
     create policy taxi_requests_insert on public.taxi_requests
       for insert with check (
         client_id = auth.uid()
         and exists (select 1 from public.taxi_drivers d
                     where d.id = driver_id and d.is_approved)
       );
*/
