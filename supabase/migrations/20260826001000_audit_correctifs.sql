-- Correctifs de l'audit du 26 août 2026 — constats S2, P1 et O2.
--
-- Trois choses sans rapport entre elles, réunies parce qu'elles sont toutes
-- brèves et qu'un collage à la main de moins vaut mieux qu'un de plus.

/* ══════════════════════════════════════════════════════════════════════
   S2 — Les colonnes sensibles d'un profil ne sont plus lisibles par tous
   ══════════════════════════════════════════════════════════════════════

   La policy dit `for select using (true)`, et son commentaire annonce « le nom
   et l'avatar ». Mais une policy porte sur des **lignes** : elle ne sait rien
   des colonnes. Tout ce que la table contenait sortait avec, y compris pour un
   visiteur sans compte :

     GET /rest/v1/profiles?select=*   →  200
     … phone, referral_code, loyalty_points, is_banned, referred_by

   Les numéros de téléphone étaient moissonnables dès qu'un client en saisissait
   un, et les codes de parrainage l'étaient déjà — ce qui rendait le parrainage
   fraudable à l'échelle, avec la clé anonyme qui voyage dans le paquet
   JavaScript de tout le monde.

   La règle des lignes reste permissive : dix endroits de l'application lisent
   légitimement le prénom de quelqu'un d'autre — l'auteur d'un commentaire, le
   client d'une commande, celui qui écrit à un chauffeur. Ce sont les colonnes
   qu'on ferme, et les droits de colonne sont le seul outil qui le fasse.
*/

-- Le privilège de table est remplacé par une liste explicite. Tout ce qui n'y
-- figure pas devient invisible à ces deux rôles, quelle que soit la policy.
revoke select on public.profiles from anon, authenticated;

grant select (
  id,
  role,
  first_name,
  last_name,
  city,
  avatar_url,
  bio,
  locale,
  text_scale,
  simplified_mode,
  created_at,
  updated_at
) on public.profiles to anon, authenticated;

/*
  Reste à rendre son propre profil à son propriétaire.

  Les droits de colonne s'appliquent au rôle, pas à la ligne : ils ne savent pas
  distinguer « le téléphone d'un inconnu » de « mon téléphone ». Une fonction
  `security definer` le peut, parce qu'elle s'exécute avec les droits de son
  auteur et filtre elle-même sur `auth.uid()`.

  C'est la seule porte par laquelle les colonnes fermées ressortent, et elle ne
  rend jamais qu'une ligne : la vôtre.
*/
create or replace function public.mon_profil()
returns public.profiles
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.profiles where id = auth.uid();
$$;

comment on function public.mon_profil() is
  'Le profil complet de la personne connectée, colonnes fermées comprises. Seule porte de sortie du téléphone, du code de parrainage et des points.';

grant execute on function public.mon_profil() to authenticated;

/*
  L'administration passe par la clé de service.

  Elle a besoin du téléphone pour ouvrir un espace chauffeur ou dépanneur à un
  membre. Ses écrans de recherche interrogeaient la base depuis le navigateur,
  donc avec le rôle `authenticated`, désormais privé de la colonne. Ils passent
  maintenant par une action serveur — ce qui est de toute façon la bonne place
  pour une recherche sur les membres.
*/

/* ══════════════════════════════════════════════════════════════════════
   P1 — L'index des chauffeurs suit la façon dont on les cherche
   ══════════════════════════════════════════════════════════════════════

   L'index existant est `(is_available, position_updated_at desc)`. Il datait du
   modèle où un chauffeur disparaissait faute de position fraîche. Ce modèle est
   mort avec le commit 8110571 : on filtre sur `is_approved`, on trie sur
   `status`, et la fraîcheur de la position ne sert plus à écarter personne.
   L'index survivait à la requête qui le justifiait.
*/
create index if not exists taxi_drivers_visibles_idx
  on public.taxi_drivers (is_approved, status);

-- L'ancien reste : `is_available` continue d'être écrit et lu par les écrans
-- qui n'ont pas migré. Le supprimer maintenant serait un pari inutile.

/* ══════════════════════════════════════════════════════════════════════
   O2 — Une tâche périodique qui s'arrête doit se remarquer
   ══════════════════════════════════════════════════════════════════════

   `/api/cron/maintenance` renvoyait ses compteurs et n'en gardait rien. Si
   Vercel cessait de la déclencher, les bons plans n'expiraient plus, les
   boutiques restaient ouvertes la nuit, les demandes de course s'accumulaient
   en « en attente » — et le premier signal aurait été un client qui se plaint.

   Trois colonnes suffisent à répondre « quand a-t-elle tourné la dernière
   fois ? », qui est la seule question qu'on se pose vraiment.
*/
create table if not exists public.cron_runs (
  id bigserial primary key,
  tache text not null,
  ok boolean not null,
  detail jsonb,
  ran_at timestamptz not null default now()
);

create index if not exists cron_runs_recent_idx
  on public.cron_runs (tache, ran_at desc);

alter table public.cron_runs enable row level security;

-- Lisible par l'administration seule : la table dit à quelle heure le serveur
-- travaille, ce qui n'intéresse personne d'autre.
drop policy if exists cron_runs_admin on public.cron_runs;
create policy cron_runs_admin on public.cron_runs
  for select using (public.is_admin());

/*
  L'écriture appartient à la clé de service, et à elle seule.

  Aucune policy d'insertion n'est déclarée : la tâche périodique écrit avec le
  rôle de service, qui traverse RLS. Un navigateur ne peut donc pas fabriquer un
  faux relevé d'exécution et masquer une panne.
*/

/*
  Le journal se purge lui-même.

  Sans cela, une tâche toutes les quinze minutes dépose trente-cinq mille lignes
  par an pour une information qui ne vaut que quelques jours.
*/
create or replace function public.purge_cron_runs()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.cron_runs where ran_at < now() - interval '30 days';
$$;

/* ─── Marche arrière ────────────────────────────────────────────────────
   grant select on public.profiles to anon, authenticated;
   drop function public.mon_profil();
   drop index public.taxi_drivers_visibles_idx;
   drop function public.purge_cron_runs();
   drop table public.cron_runs;
*/
