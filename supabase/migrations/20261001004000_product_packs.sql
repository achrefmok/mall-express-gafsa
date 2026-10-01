-- Packs : plusieurs produits existants regroupés avec une remise.
--
-- Un pack n'est pas un produit — c'est une sélection de produits qui existent
-- déjà, affichée et vendue ensemble. `product_attributes` (clé/valeur sur un
-- seul produit) ne peut pas exprimer un lien entre plusieurs produits ; il
-- faut une vraie relation, sur le même principe que `shop_categories` (une
-- table de jointure, une ligne par relation, RLS sur le propriétaire de la
-- boutique).
--
-- Le prix du pack n'est volontairement pas stocké ici : `discount_percent`
-- est affiché à titre indicatif, mais le prix réel facturé doit être
-- recalculé côté serveur au moment de l'ajout au panier — jamais fait
-- confiance à un montant composé côté client.

create table if not exists public.product_packs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  name_ar text,
  discount_percent smallint not null check (discount_percent between 0 and 90),
  cover_image text,
  is_online boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_packs_shop_idx
  on public.product_packs (shop_id);

create table if not exists public.pack_items (
  pack_id uuid not null references public.product_packs (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order smallint not null default 0,

  primary key (pack_id, product_id)
);

create index if not exists pack_items_product_idx
  on public.pack_items (product_id);

/* ─── Lecture et écriture ──────────────────────────────────────────────── */

alter table public.product_packs enable row level security;

drop policy if exists "packs lisibles" on public.product_packs;
create policy "packs lisibles" on public.product_packs
  for select using (
    (
      is_online
      and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    )
    or public.owns_shop(shop_id)
    or public.is_admin()
  );

drop policy if exists "packs du commercant" on public.product_packs;
create policy "packs du commercant" on public.product_packs
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

alter table public.pack_items enable row level security;

-- Un item de pack suit la visibilité de son pack — jamais besoin de relire
-- `products` séparément pour savoir si la ligne doit s'afficher.
drop policy if exists "items de pack lisibles" on public.pack_items;
create policy "items de pack lisibles" on public.pack_items
  for select using (
    exists (
      select 1 from public.product_packs pk
      join public.shops s on s.id = pk.shop_id
      where pk.id = pack_id
        and ((pk.is_online and s.status = 'approved') or public.owns_shop(pk.shop_id))
    )
    or public.is_admin()
  );

drop policy if exists "items de pack du commercant" on public.pack_items;
create policy "items de pack du commercant" on public.pack_items
  for all using (
    exists (
      select 1 from public.product_packs pk
      where pk.id = pack_id and public.owns_shop(pk.shop_id)
    )
    or public.is_admin()
  ) with check (
    public.is_admin()
    or (
      exists (
        select 1 from public.product_packs pk
        where pk.id = pack_id and public.owns_shop(pk.shop_id)
      )
      -- Le produit ajouté au pack doit aussi appartenir au même commerçant —
      -- sans quoi une boutique pourrait grouper, et donc afficher avec
      -- remise, le produit d'une autre.
      and exists (
        select 1 from public.products p
        where p.id = product_id and public.owns_shop(p.shop_id)
      )
    )
  );

/* ─── Reprise ──────────────────────────────────────────────────────────── */

-- Tables additives et vides à la création : aucune boutique existante n'a de
-- pack tant qu'elle n'en crée pas un depuis son espace. L'onglet Promos et le
-- reste du catalogue continuent de fonctionner à l'identique.
--
-- Marche arrière : `drop table public.pack_items; drop table public.product_packs;`
