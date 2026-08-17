-- ════════════════════════════════════════════════════════════════════════
-- Retirer les positions de la diffusion en temps réel
-- ════════════════════════════════════════════════════════════════════════
--
-- Mesuré avant cette migration : chaque position publiée par un chauffeur était
-- diffusée à tous les clients regardant la carte, et chacun relisait ensuite la
-- liste entière. Le coût croissait comme le produit des chauffeurs par les
-- spectateurs.
--
--   5 chauffeurs · 30 spectateurs · position toutes les 2 s
--     → 2 160 000 messages par jour
--     → quota mensuel de 2 000 000 épuisé en 22 heures
--
-- Même bridée à trente secondes, la diffusion épuisait le quota en trois jours :
-- le facteur multiplicateur reste le nombre de spectateurs. Les écrans Taxi et
-- SOS relisent donc la liste toutes les trente secondes, ce qui coûte un appel
-- par spectateur et par demi-minute, indépendamment du nombre de chauffeurs.
--
-- Cette migration ne fait que retirer le filet : plus aucune souscription ne peut
-- être ouverte par mégarde sur ces deux tables. Le code applicatif n'en a plus
-- besoin, mais un abonnement oublié — ou ajouté plus tard sans y penser —
-- suffirait à ramener la panne. Autant que la base le refuse.
--
-- `replica identity full` est également abandonnée : elle faisait écrire dans le
-- journal l'intégralité de l'ancienne ligne à chaque changement de position, pour
-- un seul usage — la diffusion, qui n'existe plus.
--
-- Pour revenir en arrière (le jour d'un plan payant), rejouer :
--   alter publication supabase_realtime add table public.taxi_drivers;
--   alter table public.taxi_drivers replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'taxi_drivers'
  ) then
    execute 'alter publication supabase_realtime drop table public.taxi_drivers';
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sos_providers'
  ) then
    execute 'alter publication supabase_realtime drop table public.sos_providers';
  end if;
end $$;

alter table public.taxi_drivers  replica identity default;
alter table public.sos_providers replica identity default;

-- Les directs gardent leur diffusion : un spectateur qui voit un article
-- apparaître pendant qu'on le présente, c'est la fonctionnalité elle-même, et le
-- volume n'a rien de comparable — un vendeur publie quelques articles par heure,
-- là où un GPS publiait plusieurs positions par seconde.
