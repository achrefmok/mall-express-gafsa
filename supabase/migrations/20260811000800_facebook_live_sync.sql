-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 08 · Relais automatique des directs Facebook
--
-- Une boutique relie sa page Facebook une fois. Ensuite, dès qu'elle lance
-- un direct depuis Facebook, il apparaît ici — avec les commentaires, les
-- réactions, le produit épinglé et l'achat. Plus rien à coller.
--
-- Trois pièces :
--   1. `lives.facebook_video_id` — pour reconnaître un direct déjà relayé et
--      ne pas le créer deux fois à chaque notification.
--   2. `shop_facebook_pages` — le lien boutique ↔ page, avec le jeton d'accès.
--   3. `sync_facebook_live()` — la fonction qu'appelle le serveur quand
--      Facebook signale un début ou une fin de direct.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1 · Identifiant de la vidéo Facebook ──────────────────────────────

alter table public.lives
  add column if not exists facebook_video_id text;

comment on column public.lives.facebook_video_id is
  'Identifiant de la vidéo chez Facebook. Sert à ne relayer qu''une fois un même direct.';

-- Un direct Facebook donné ne correspond qu'à une seule ligne ici.
create unique index if not exists lives_facebook_video_id_key
  on public.lives (facebook_video_id)
  where facebook_video_id is not null;

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · Lien boutique ↔ page Facebook
--
-- ⚠ `page_token` est un secret : il permet de lire la page au nom du
-- commerçant. Cette table n'a donc AUCUNE policy pour `anon` ni pour
-- `authenticated` — avec RLS forcée, cela vaut refus total via PostgREST,
-- même pour le propriétaire de la boutique. Seul le serveur y accède, avec
-- la clé secrète.
--
-- Ce que l'interface vendeur doit afficher — le nom de la page, la date de
-- connexion, la dernière erreur — passe par `facebook_page_status()`, qui ne
-- renvoie jamais le jeton.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.shop_facebook_pages (
  shop_id         uuid primary key references public.shops (id) on delete cascade,
  page_id         text not null,
  page_name       text not null,
  page_token      text not null,
  -- L'abonnement au webhook `live_videos` a-t-il été accepté par Facebook ?
  -- Sans lui, on retombe sur la vérification manuelle depuis la console.
  is_subscribed   boolean not null default false,
  connected_at    timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error      text,
  updated_at      timestamptz not null default now()
);

create index if not exists shop_facebook_pages_page_id_idx
  on public.shop_facebook_pages (page_id);

alter table public.shop_facebook_pages enable row level security;
alter table public.shop_facebook_pages force row level security;

-- Contrepartie de la migration 07 : les fonctions SECURITY DEFINER
-- s'exécutent au nom de `postgres` et doivent pouvoir écrire ici.
drop policy if exists shop_facebook_pages_definer on public.shop_facebook_pages;
create policy shop_facebook_pages_definer on public.shop_facebook_pages
  for all to postgres using (true) with check (true);

-- Aucune autre policy : `anon` et `authenticated` n'ont ni lecture ni écriture.

-- ─── État de la connexion, sans le jeton ───────────────────────────────

create or replace function public.facebook_page_status(target_shop uuid)
returns table (
  page_name       text,
  is_subscribed   boolean,
  connected_at    timestamptz,
  last_checked_at timestamptz,
  last_error      text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.owns_shop(target_shop) or public.is_admin() or public.is_service_context()) then
    raise exception 'Accès réservé au propriétaire de la boutique' using errcode = '42501';
  end if;

  return query
  select f.page_name, f.is_subscribed, f.connected_at, f.last_checked_at, f.last_error
  from public.shop_facebook_pages f
  where f.shop_id = target_shop;
end;
$$;

revoke execute on function public.facebook_page_status(uuid) from public, anon;
grant execute on function public.facebook_page_status(uuid) to authenticated;

comment on function public.facebook_page_status(uuid) is
  'État de la liaison Facebook d''une boutique. Ne renvoie jamais le jeton d''accès.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3 · Début et fin d'un direct relayé
--
-- Appelée par le serveur à la réception d'un webhook Facebook, ou lors d'une
-- vérification manuelle. Réservée au contexte de service : c'est le serveur
-- qui parle, jamais le navigateur.
--
-- Idempotente : Facebook renvoie plusieurs fois le même événement, et une
-- vérification manuelle peut tomber sur un direct déjà relayé.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.sync_facebook_live(
  target_shop  uuid,
  video_id     text,
  permalink    text,
  video_title  text,
  live_now     boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.lives;
  shop_name text;
begin
  if not public.is_service_context() then
    raise exception 'Réservé au serveur' using errcode = '42501';
  end if;

  select * into existing from public.lives where facebook_video_id = video_id;

  -- ─── Fin de direct ───────────────────────────────────────────────────
  if not live_now then
    if existing.id is null then
      return null;
    end if;

    update public.lives
    set status   = 'ended',
        ended_at = coalesce(ended_at, now())
    where id = existing.id and status <> 'ended';

    return existing.id;
  end if;

  -- ─── Direct déjà relayé : on rafraîchit ce qui peut changer ──────────
  if existing.id is not null then
    update public.lives
    set status       = 'live',
        started_at   = coalesce(started_at, now()),
        facebook_url = permalink,
        title        = coalesce(nullif(btrim(video_title), ''), title)
    where id = existing.id;

    return existing.id;
  end if;

  -- ─── Nouveau direct ──────────────────────────────────────────────────
  select s.name into shop_name from public.shops s where s.id = target_shop;
  if shop_name is null then
    raise exception 'Boutique introuvable' using errcode = '22023';
  end if;

  insert into public.lives (
    shop_id, title, source, facebook_url, facebook_video_id,
    status, scheduled_at, started_at
  )
  values (
    target_shop,
    coalesce(nullif(btrim(video_title), ''), 'Direct de ' || shop_name),
    'facebook', permalink, video_id,
    'live', now(), now()
  )
  returning id into existing.id;

  -- Mêmes notifications qu'un direct lancé depuis la console : les abonnés
  -- de la boutique ne doivent pas manquer un direct selon la façon dont il
  -- a été démarré.
  insert into public.notifications (user_id, kind, title, body, link)
  select f.user_id, 'live_starting', shop_name || ' est en direct',
         coalesce(nullif(btrim(video_title), ''), 'Rejoignez le direct'),
         '/lives/' || existing.id
  from public.shop_follows f
  where f.shop_id = target_shop;

  return existing.id;
end;
$$;

revoke execute on function public.sync_facebook_live(uuid, text, text, text, boolean)
  from public, anon, authenticated;

comment on function public.sync_facebook_live(uuid, text, text, text, boolean) is
  'Ouvre ou ferme le direct correspondant à une vidéo Facebook. Serveur uniquement.';
