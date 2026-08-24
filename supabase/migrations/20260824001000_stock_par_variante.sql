-- Stock, référence et prix par déclinaison — couleur × taille.
--
-- Jusqu'ici, un produit portait un seul entier de stock et le panier retenait la
-- couleur et la taille en texte libre. Un commerçant qui n'a plus que du rouge en
-- L ne pouvait pas le dire : le client commandait du bleu en M, et la rupture se
-- découvrait au moment de préparer le colis.
--
-- La table est **additive**. Rien n'est supprimé, `products.stock` reste en place
-- et continue de faire foi tant qu'aucune déclinaison n'existe pour l'article :
-- un catalogue qui n'a jamais déclaré de variantes fonctionne exactement comme
-- avant, et le passage se fait produit par produit.

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,

  -- Nulles toutes les deux pour un article sans déclinaison. Une couleur sans
  -- taille (un sac) et une taille sans couleur (un jean uni) sont deux cas
  -- courants : ni l'un ni l'autre ne doit être forcé d'inventer l'autre axe.
  color text,
  size text,

  sku text,
  stock integer not null default 0 check (stock >= 0),

  -- Prix propres à la déclinaison, facultatifs. Nuls : ceux du produit
  -- s'appliquent. Un XXL plus cher que le S est fréquent ; l'imposer partout ne
  -- l'est pas.
  price numeric(10, 3) check (price is null or price >= 0),
  compare_at_price numeric(10, 3) check (compare_at_price is null or compare_at_price >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Une seule ligne par combinaison. `coalesce` parce que deux NULL ne sont pas
  -- égaux en SQL : sans lui, on pourrait créer dix fois la même déclinaison sans
  -- couleur.
  constraint product_variants_combinaison_unique
    unique (product_id, color, size)
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id);

create unique index if not exists product_variants_sku_idx
  on public.product_variants (sku) where sku is not null;

-- Le panier retient la déclinaison, pas seulement son libellé.
--
-- `color` et `size` restent en place : ils portent l'historique des lignes déjà
-- enregistrées, et une commande passée avant cette migration doit continuer de
-- dire ce qui avait été commandé.
alter table public.cart_items
  add column if not exists variant_id uuid references public.product_variants (id) on delete set null;

create index if not exists cart_items_variant_idx
  on public.cart_items (variant_id) where variant_id is not null;

/* ─── Lecture et écriture ──────────────────────────────────────────────── */

alter table public.product_variants enable row level security;

-- Tout le monde lit les déclinaisons d'un produit visible : c'est la condition
-- pour afficher « il reste 2 rouges en M » sur la fiche.
drop policy if exists "variantes lisibles" on public.product_variants;
create policy "variantes lisibles" on public.product_variants
  for select using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.is_online and not p.is_draft
    )
  );

-- Seul le commerçant propriétaire écrit les siennes.
drop policy if exists "variantes du commercant" on public.product_variants;
create policy "variantes du commercant" on public.product_variants
  for all using (
    exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_id and s.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_id and s.owner_id = auth.uid()
    )
  );

/* ─── Reprise ──────────────────────────────────────────────────────────── */

-- Aucune donnée n'est déplacée : la table naît vide, et `products.stock` reste
-- la source de vérité pour tous les articles existants. Le commerçant qui veut
-- du stock par déclinaison le déclare depuis son espace ; les autres ne voient
-- aucun changement.
--
-- Marche arrière, si besoin : `drop table public.product_variants cascade;` puis
-- `alter table public.cart_items drop column variant_id;`. Le catalogue et les
-- paniers retrouvent leur état d'avant, puisque rien n'en a été retiré.
