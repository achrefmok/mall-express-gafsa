-- ════════════════════════════════════════════════════════════════════════
-- SOS — dépannage d'urgence
-- ════════════════════════════════════════════════════════════════════════
--
-- Même forme que `taxi_drivers`, et c'est délibéré : un métier, une
-- disponibilité, une position, un numéro. Le besoin est identique — trouver
-- quelqu'un de compétent, tout de suite, et l'appeler.
--
-- Une table distincte plutôt qu'une colonne `métier` ajoutée aux chauffeurs :
-- un taxi transporte des personnes, ce qui relève d'une réglementation et de
-- pièces (permis, carte grise) que ne partage aucun plombier. Mélanger les deux
-- aurait obligé chaque écran à filtrer, et chaque contrôle à se demander quelles
-- pièces vérifier.
--
-- Pas de nouveau rôle : posséder une ligne ici suffit à désigner un dépanneur.

create table if not exists public.sos_providers (
  id uuid primary key references public.profiles (id) on delete cascade,

  /*
    Le métier, contraint en base et non laissé au texte libre.

    C'est ce qui rend le filtre possible : « électricien », « electricien » et
    « Électricité » saisis à la main auraient produit trois catégories pour un
    seul métier, et un filtre qui ne trouve rien. La liste est reprise à
    l'identique dans `src/lib/sos.ts` — la modifier ici oblige à l'y modifier
    aussi, ce que la contrainte fera remarquer dès le premier enregistrement.
  */
  trade text not null check (
    trade in (
      'mecanicien',
      'electricien',
      'plombier',
      'remorquage',
      'transporteur',
      'serrurier',
      'pneumatique',
      'climatisation'
    )
  ),

  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  phone        text not null check (char_length(btrim(phone)) between 6 and 20),

  -- Ce que la personne fait précisément, dans ses mots : « dépannage à domicile,
  -- nuit et week-end ». Le métier classe, cette ligne distingue.
  description text check (char_length(description) <= 200),

  -- Se déplace-t-il, ou reçoit-il en atelier ? La question change tout pour
  -- quelqu'un dont la voiture ne démarre pas.
  travels boolean not null default true,

  is_available boolean not null default false,

  lat double precision,
  lng double precision,
  position_updated_at timestamptz,

  -- Vérifié par l'administration avant d'apparaître : la plateforme envoie des
  -- inconnus au domicile de ses clients.
  is_approved boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sos_providers is
  'Dépanneurs SOS : métier, disponibilité, position et numéro d''appel.';

-- L'écran client filtre par métier puis trie les disponibles en tête : l'index
-- suit cet ordre, et ne porte que sur les fiches approuvées, seules affichées.
create index if not exists sos_providers_trade_idx
  on public.sos_providers (trade, is_available, position_updated_at desc)
  where is_approved;

-- ─── Sécurité ──────────────────────────────────────────────────────────
alter table public.sos_providers enable row level security;

/*
  Lecture publique des seules fiches approuvées.

  Le téléphone d'un dépanneur approuvé est ce que le client vient chercher. Une
  fiche non vérifiée, elle, n'existe pour personne d'autre que son auteur et
  l'administration.
*/
drop policy if exists sos_providers_select on public.sos_providers;
create policy sos_providers_select on public.sos_providers
  for select using (is_approved or id = auth.uid() or public.is_admin());

drop policy if exists sos_providers_insert on public.sos_providers;
create policy sos_providers_insert on public.sos_providers
  for insert with check (
    id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
  );

/*
  Le dépanneur modifie sa fiche, jamais son approbation.

  Sans cette garde, une seule requête lui suffirait pour se déclarer vérifié et
  apparaître auprès des clients sans qu'on ait regardé qui il est.
*/
drop policy if exists sos_providers_update_own on public.sos_providers;
create policy sos_providers_update_own on public.sos_providers
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_approved = (select p.is_approved from public.sos_providers p where p.id = auth.uid())
  );

drop policy if exists sos_providers_admin on public.sos_providers;
create policy sos_providers_admin on public.sos_providers
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── Temps réel ────────────────────────────────────────────────────────
-- Un dépanneur qui se déclare libre doit apparaître sans rechargement : sur une
-- panne, cinq minutes d'écart décident de l'appel.
alter table public.sos_providers replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sos_providers'
  ) then
    execute 'alter publication supabase_realtime add table public.sos_providers';
  end if;
end $$;
