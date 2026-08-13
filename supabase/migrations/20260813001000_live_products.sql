-- ════════════════════════════════════════════════════════════════════════
-- Les produits présentés pendant un direct
-- ════════════════════════════════════════════════════════════════════════
--
-- Jusqu'ici un direct ne portait qu'un seul article, `lives.pinned_product_id`.
-- Un vendeur qui présente dix pièces devait donc rééditer son direct entre
-- chaque, et le spectateur n'avait jamais qu'un bouton d'achat à l'écran.
--
-- Cette table donne à chaque direct sa propre liste, ordonnée par le vendeur.
-- `pinned_product_id` reste : il désigne l'article dont on parle à l'instant,
-- mis en avant au-dessus de la liste. Les deux se complètent.
--
-- Pourquoi une table de liaison plutôt qu'une colonne sur `products` : un même
-- article peut revenir dans plusieurs directs, et sa position n'a de sens que
-- dans un direct donné.

create table if not exists public.live_products (
  live_id    uuid not null references public.lives (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,

  -- Ordre d'affichage voulu par le vendeur. Les égalités sont départagées par
  -- l'ordre d'ajout, pour que la liste ne saute jamais d'un rendu à l'autre.
  position   integer not null default 0,
  added_at   timestamptz not null default now(),

  primary key (live_id, product_id)
);

comment on table public.live_products is
  'Articles présentés pendant un direct, dans l''ordre choisi par le vendeur.';

create index if not exists live_products_live_idx
  on public.live_products (live_id, position, added_at);

-- ─── Sécurité ──────────────────────────────────────────────────────────
alter table public.live_products enable row level security;

-- Lecture publique : la liste accompagne un direct, lui-même public. Ce qui
-- protège le catalogue reste la policy de `products`, qui décide seule si un
-- article est visible — une ligne ici ne révèle rien d'autre qu'un lien.
drop policy if exists live_products_select on public.live_products;
create policy live_products_select on public.live_products
  for select using (true);

/*
  Écriture réservée au vendeur du direct, et à l'admin.

  Le `with check` vérifie en plus que l'article appartient à la boutique qui
  diffuse. Sans cette condition, un vendeur pourrait accrocher à son direct le
  produit d'une autre boutique — et vendre ce qui ne lui appartient pas.
*/
drop policy if exists live_products_manage on public.live_products;
create policy live_products_manage on public.live_products
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.lives l
      where l.id = live_id and public.owns_shop(l.shop_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.lives l
      join public.products p on p.id = product_id
      where l.id = live_id
        and public.owns_shop(l.shop_id)
        and p.shop_id = l.shop_id
    )
  );

-- ─── Temps réel ────────────────────────────────────────────────────────
-- Un article ajouté pendant le direct doit apparaître chez les spectateurs
-- sans rechargement : c'est tout l'intérêt de l'ajouter pendant qu'on en parle.
alter table public.live_products replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_products'
  ) then
    execute 'alter publication supabase_realtime add table public.live_products';
  end if;
end $$;
