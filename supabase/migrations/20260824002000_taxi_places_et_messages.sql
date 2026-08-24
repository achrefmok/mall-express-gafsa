-- Places disponibles, course en cours, et messagerie chauffeur ↔ client.
--
-- L'écran taxi montrait qui était libre et son numéro. Trois choses lui
-- manquaient pour ressembler à ce qui se passe réellement à Gafsa :
--
--   · un chauffeur en course a souvent des places libres, et prend volontiers
--     quelqu'un sur son chemin — c'est le louage urbain, et l'application le
--     rendait invisible ;
--   · savoir quand il se libère vaut mieux que « occupé », qui ferme la porte ;
--   · le prix se négocie. Un appel coupe la conversation en deux — le client
--     appelle, raccroche, rappelle. Quelques messages suffisent.
--
-- Tout est **additif** et facultatif. Un chauffeur qui ne renseigne rien
-- fonctionne exactement comme avant : libre ou occupé, et son numéro.

alter table public.taxi_drivers
  -- Combien de places le véhicule compte, et combien restent. Nuls tant que le
  -- chauffeur ne l'a pas dit : on n'affiche alors aucun chiffre plutôt qu'un
  -- chiffre supposé.
  add column if not exists seats_total smallint check (seats_total is null or seats_total between 1 and 9),
  add column if not exists seats_free smallint check (seats_free is null or seats_free >= 0),

  -- Quand il se libère. Nul : on ne sait pas, et on ne le prétend pas.
  add column if not exists free_at timestamptz,

  -- Où il va, quand il est en course. C'est ce qui permet de dire « il passe
  -- sur votre trajet » avec un vrai calcul plutôt qu'une impression.
  add column if not exists heading_lat double precision,
  add column if not exists heading_lng double precision,

  -- Accepte-t-il de prendre quelqu'un en route ? Le défaut est « non » : c'est
  -- au chauffeur de l'offrir, jamais à la plateforme de le supposer pour lui.
  add column if not exists takes_along boolean not null default false;

/* ─── Messagerie ───────────────────────────────────────────────────────── */

create table if not exists public.taxi_messages (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.taxi_drivers (id) on delete cascade,
  -- Le client de la conversation. Deux clients qui écrivent au même chauffeur
  -- ont deux fils distincts.
  client_id uuid not null references public.profiles (id) on delete cascade,

  -- Qui a écrit. Un booléen plutôt qu'un identifiant : les deux extrémités du
  -- fil sont déjà connues, et la question qui se pose à l'affichage est
  -- seulement « de quel côté aligner la bulle ».
  from_driver boolean not null,

  body text not null check (length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists taxi_messages_fil_idx
  on public.taxi_messages (driver_id, client_id, created_at);

alter table public.taxi_messages enable row level security;

-- Chacun ne voit que les fils dont il est une extrémité.
drop policy if exists "messages taxi lisibles par les deux" on public.taxi_messages;
create policy "messages taxi lisibles par les deux" on public.taxi_messages
  for select using (client_id = auth.uid() or driver_id = auth.uid());

-- On n'écrit qu'en son propre nom, et du bon côté : un client ne peut pas
-- fabriquer un message qui paraîtra venir du chauffeur.
drop policy if exists "messages taxi ecrits par leur auteur" on public.taxi_messages;
create policy "messages taxi ecrits par leur auteur" on public.taxi_messages
  for insert with check (
    (from_driver = false and client_id = auth.uid())
    or (from_driver = true and driver_id = auth.uid())
  );

-- Marquer comme lu : seul le destinataire le fait.
drop policy if exists "messages taxi marques lus" on public.taxi_messages;
create policy "messages taxi marques lus" on public.taxi_messages
  for update using (
    (from_driver = true and client_id = auth.uid())
    or (from_driver = false and driver_id = auth.uid())
  );

/* ─── Reprise ──────────────────────────────────────────────────────────── */

-- Rien n'est déplacé ni supprimé. Les colonnes naissent nulles, la table naît
-- vide, et l'écran s'accommode des deux : il affiche ce qui existe et tait le
-- reste.
--
-- Marche arrière : `drop table public.taxi_messages;` puis
-- `alter table public.taxi_drivers drop column seats_total, drop column
-- seats_free, drop column free_at, drop column heading_lat, drop column
-- heading_lng, drop column takes_along;`
