-- Repères cliquables posés sur une photo — le lookbook Mode ('lookbook')
-- et l'ambiance par pièce Maison ('piece:Salon', 'piece:Chambre'…).
--
-- `image_url` est répétée sur chaque repère d'un même `scope` plutôt que
-- stockée une fois à part : tous les repères d'un scope sont toujours
-- écrits ensemble (on remplace le scope en entier à chaque enregistrement,
-- patron identique à `upsertProductAttributes`), donc jamais en risque de
-- diverger entre eux — et ça évite une table/jointure supplémentaire pour
-- une seule colonne.

create table if not exists public.shop_lookbook_pins (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  scope       text not null,
  image_url   text not null,
  product_id  uuid references public.products (id) on delete set null,
  x           numeric not null check (x between 0 and 100),
  y           numeric not null check (y between 0 and 100),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists shop_lookbook_pins_shop_idx on public.shop_lookbook_pins (shop_id, scope);

alter table public.shop_lookbook_pins enable row level security;

drop policy if exists "repères lisibles" on public.shop_lookbook_pins;
create policy "repères lisibles" on public.shop_lookbook_pins
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    or public.owns_shop(shop_id)
    or public.is_admin()
  );

drop policy if exists "repères du commercant" on public.shop_lookbook_pins;
create policy "repères du commercant" on public.shop_lookbook_pins
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

/* Marche arrière :
     drop table if exists public.shop_lookbook_pins; */
