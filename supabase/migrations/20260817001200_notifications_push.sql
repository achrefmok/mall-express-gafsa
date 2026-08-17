-- ════════════════════════════════════════════════════════════════════════
-- Notifications poussées — abonnements et déclencheur
-- ════════════════════════════════════════════════════════════════════════
--
-- Le problème à résoudre : les notifications de ce projet sont créées par des
-- déclencheurs SQL — commande passée, boutique approuvée, direct démarré. Le code
-- de l'application ne voit jamais passer l'insertion, et ne peut donc pas
-- prévenir le téléphone. Une notification n'existait que pour qui pensait à
-- ouvrir le site et à regarder la cloche : exactement l'inverse de ce qu'on
-- attend d'une notification.
--
-- Le chemin retenu : à chaque insertion dans `notifications`, Postgres appelle
-- une adresse de l'application, qui se charge de l'envoi chiffré vers les
-- navigateurs abonnés. C'est ce que font les « Database Webhooks » de Supabase,
-- écrit ici à la main pour que le mécanisme soit lisible et versionné avec le
-- reste du schéma.
--
-- Deux exigences ont guidé la forme :
--
--   1. Une insertion de notification ne doit JAMAIS échouer à cause de l'envoi.
--      Un client dont la commande n'est pas enregistrée parce qu'un serveur de
--      notifications ne répond pas serait un désastre sans commune mesure avec le
--      service rendu. Tout est donc enveloppé et l'erreur avalée.
--   2. L'appel est asynchrone. `pg_net` place la requête dans une file et rend la
--      main immédiatement : la transaction n'attend pas le réseau.

-- ─── L'extension qui permet d'appeler du HTTP depuis Postgres ───────────
create extension if not exists pg_net with schema extensions;

-- ─── Les réglages, hors du code ────────────────────────────────────────
/*
  L'adresse à appeler et le secret partagé ne peuvent pas être écrits dans la
  fonction : ils changent d'un déploiement à l'autre, et le secret n'a rien à
  faire dans un fichier versionné.

  Aucune policy n'est créée sur cette table, et RLS est activée : elle devient
  donc illisible pour `anon` comme pour `authenticated`. Seules les fonctions
  `security definer` la lisent — c'est le comportement voulu.
*/
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

alter table public.app_settings enable row level security;

comment on table public.app_settings is
  'Réglages serveur (adresse d''envoi des notifications, secret partagé). Illisible depuis le client.';

-- ─── Les abonnements des navigateurs ───────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  /*
    L'adresse que le navigateur nous confie, propre à cet appareil et à ce
    navigateur. Elle est unique : un même téléphone qui redemande un abonnement
    doit remplacer le précédent, sinon la personne recevrait la notification en
    double à chaque fois.
  */
  endpoint text not null unique,

  -- Les deux clés du chiffrement. Sans elles, impossible d'écrire un message que
  -- ce navigateur saura ouvrir : le contenu ne transite jamais en clair.
  p256dh text not null,
  auth   text not null,

  -- Pour distinguer les appareils d'une même personne dans les réglages.
  user_agent text,

  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is
  'Navigateurs abonnés aux notifications poussées, un enregistrement par appareil.';

alter table public.push_subscriptions enable row level security;

-- Chacun ne voit et ne gère que ses propres appareils.
drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Le déclencheur ────────────────────────────────────────────────────
create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target  text;
  secret  text;
begin
  /*
    Tout est dans un bloc protégé, et c'est le point le plus important de ce
    fichier. Une adresse absente, l'extension retirée, un réseau en panne : rien
    de tout cela ne doit empêcher l'enregistrement de la notification, encore
    moins celui de la commande qui l'a provoquée.
  */
  begin
    select value into target from public.app_settings where key = 'push_endpoint';
    select value into secret from public.app_settings where key = 'push_secret';

    -- Pas configuré : le site fonctionne, simplement sans notifications poussées.
    if target is null or secret is null then
      return new;
    end if;

    -- Rien à envoyer pour une notification déjà lue à sa création : la colonne
    -- est `read_at`, un horodatage, et non un booléen.
    if new.read_at is not null then
      return new;
    end if;

    perform net.http_post(
      url     := target,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-push-secret', secret
      ),
      body    := jsonb_build_object(
        'userId', new.user_id,
        'title',  new.title,
        'body',   new.body,
        'link',   new.link
      ),
      timeout_milliseconds := 5000
    );
  exception
    when others then
      -- Consigné dans les journaux de Postgres, invisible pour l'utilisateur.
      raise warning 'notify_push a échoué : %', sqlerrm;
  end;

  return new;
end;
$$;

comment on function public.notify_push() is
  'Prévient l''application qu''une notification vient d''être créée, pour envoi vers les navigateurs abonnés.';

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.notify_push();

-- ════════════════════════════════════════════════════════════════════════
-- À FAIRE APRÈS AVOIR EXÉCUTÉ CE FICHIER
-- ════════════════════════════════════════════════════════════════════════
--
-- Renseigner l'adresse et le secret, en remplaçant les deux valeurs :
--
--   insert into public.app_settings (key, value) values
--     ('push_endpoint', 'https://mall-express-gafsa-62y6.vercel.app/api/push/send'),
--     ('push_secret',   'LE_MEME_SECRET_QUE_DANS_VERCEL')
--   on conflict (key) do update set value = excluded.value;
--
-- Le secret doit être identique à la variable `PUSH_SECRET` des deux projets
-- Vercel. Sans lui, l'adresse d'envoi répondrait à n'importe qui — et n'importe
-- qui pourrait faire sonner le téléphone de tes clients.
