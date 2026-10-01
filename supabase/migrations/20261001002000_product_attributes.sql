-- Attributs libres par produit — clé/valeur, un métier à la fois.
--
-- `products` ne porte que ce que tous les métiers ont en commun (nom, prix,
-- stock, images, couleurs, tailles). Le stockage d'un téléphone, la note de
-- tête d'un parfum, la pièce d'un meuble n'ont de sens que pour une poignée
-- de familles chacun — leur ajouter une colonne chacun à `products`
-- alourdirait la table principale pour des champs que la grande majorité des
-- produits n'utiliseront jamais. TODO.md proposait déjà cette direction pour
-- Immobilier/Voitures ; elle sert maintenant aussi Électronique, Beauté,
-- Maison et Bijouterie plutôt que d'inventer un deuxième mécanisme.
--
-- Volontairement en clé/valeur texte, pas une colonne par champ : un attribut
-- de plus (demain, peut-être une « pointure » pour une future famille
-- Chaussures) est une ligne de données, jamais une migration.

create table if not exists public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Une seule valeur par clé et par produit : pas deux lignes "stockage"
  -- qui se contredisent.
  constraint product_attributes_cle_unique unique (product_id, key)
);

create index if not exists product_attributes_product_idx
  on public.product_attributes (product_id);

/* ─── Lecture et écriture ──────────────────────────────────────────────── */

alter table public.product_attributes enable row level security;

-- Même condition de visibilité que `products_select` — un attribut d'un
-- produit que personne ne peut voir n'a pas à être lisible non plus.
drop policy if exists "attributs lisibles" on public.product_attributes;
create policy "attributs lisibles" on public.product_attributes
  for select using (
    exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_id
        and ((p.is_online and not p.is_draft and s.status = 'approved') or public.owns_shop(p.shop_id))
    )
    or public.is_admin()
  );

drop policy if exists "attributs du commercant" on public.product_attributes;
create policy "attributs du commercant" on public.product_attributes
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.owns_shop(p.shop_id)
    )
    or public.is_admin()
  ) with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.owns_shop(p.shop_id)
    )
    or public.is_admin()
  );

/* ─── Reprise ──────────────────────────────────────────────────────────── */

-- Table additive et vide à la création : aucun produit existant n'est
-- affecté, chaque mise en page dégrade proprement en l'absence de tout
-- attribut (voir le plan de l'étape "productLayout" pour le détail par
-- métier).
--
-- Marche arrière : `drop table public.product_attributes;` — rien d'autre
-- n'en dépend.
