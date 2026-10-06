-- Stories de boutique — rail sous l'en-tête, visionneuse plein écran.
--
-- Même patron RLS que delivery_zones (20261002001000) : lecture publique si
-- la story est dans sa fenêtre et la boutique approuvée, écriture réservée
-- au propriétaire/admin. `expires_at` nullable = story permanente (ex. un
-- modèle "Avis" qui ne périme jamais).

create table if not exists public.shop_stories (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  kind        text not null check (kind in ('nouveautes', 'promo', 'tuto', 'avis', 'evenement', 'libre')),
  label       text not null,
  title       text not null,
  subtitle    text,
  image_url   text,
  cta_label   text,
  cta_target  text,
  sort_order  smallint not null default 0,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists shop_stories_shop_idx on public.shop_stories (shop_id, sort_order);

alter table public.shop_stories enable row level security;

drop policy if exists "stories lisibles" on public.shop_stories;
create policy "stories lisibles" on public.shop_stories
  for select using (
    (
      now() >= starts_at
      and now() < coalesce(expires_at, 'infinity'::timestamptz)
      and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    )
    or public.owns_shop(shop_id)
    or public.is_admin()
  );

drop policy if exists "stories du commercant" on public.shop_stories;
create policy "stories du commercant" on public.shop_stories
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

drop trigger if exists trg_shop_stories_touch on public.shop_stories;
create trigger trg_shop_stories_touch
  before update on public.shop_stories
  for each row execute function public.touch_updated_at();

/* Marche arrière :
     drop table if exists public.shop_stories; */
