-- Une boutique dont le catalogue ne vit que chez elle.
--
-- ════════════════════════════════════════════════════════════════════════
-- Pourquoi une colonne, et pas `is_online`
-- ════════════════════════════════════════════════════════════════════════
--
-- Dar Elhout vend du poisson au poids : « Dorade royale (1 kg) » a du sens
-- sur sa fiche, entre ses horaires et son numéro, et aucun dans une grille
-- où il voisine des écouteurs et des robes. Le commerçant veut ses produits
-- visibles chez lui, pas dans le rayon commun.
--
-- `is_online` ne sait pas dire cela : il est lu par la marketplace **et** par
-- la fiche de la boutique. Le baisser aurait vidé les deux. Il fallait donc
-- distinguer « en vente » de « listé ailleurs », et c'est une propriété de la
-- boutique, pas de chaque produit — sans quoi il faudrait la reposer à chaque
-- article ajouté, et l'oublier une fois suffirait.
--
-- Le réglage appartient au commerçant : il n'accorde aucun avantage — il en
-- retire un — donc rien à garder pour l'administration.

alter table public.shops
  add column if not exists list_in_marketplace boolean not null default true;

comment on column public.shops.list_in_marketplace is
  'Faux : les produits de cette boutique ne sortent pas de sa fiche (ni marketplace, ni accueil, ni recherche).';

create index if not exists shops_catalogue_liste_idx
  on public.shops (list_in_marketplace) where not list_in_marketplace;

/* ─── La recherche suit la même règle ─────────────────────────────────────
   Sans cela, un produit retiré du rayon commun y reviendrait par la barre de
   recherche — ce qui reviendrait à ne l'avoir retiré de nulle part. La
   boutique, elle, reste trouvable par son nom : c'est son catalogue qu'on
   réserve à sa fiche, pas son existence. */
create or replace function public.search_catalog(q text, limit_count integer default 20)
returns table (
  kind        text,
  id          uuid,
  title       text,
  subtitle    text,
  image       text,
  price       numeric,
  slug        text,
  hue         smallint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with needle as (select extensions.unaccent(lower(btrim(coalesce(q, '')))) as v)
  (
    select 'product'::text, p.id, p.name, s.name,
           case when array_length(p.images,1) > 0 then p.images[1] end,
           p.price, s.slug, c.hue
    from public.products p
    join public.shops s on s.id = p.shop_id
    left join public.categories c on c.id = p.category_id, needle
    where s.status = 'approved' and p.is_online and not p.is_draft
      and s.list_in_marketplace
      and needle.v <> ''
      and extensions.unaccent(lower(p.name)) like '%' || needle.v || '%'
    order by p.sold_count desc
    limit limit_count
  )
  union all
  (
    select 'shop'::text, s.id, s.name, c.name_fr, s.logo_url, null::numeric, s.slug, c.hue
    from public.shops s
    left join public.categories c on c.id = s.category_id, needle
    where s.status = 'approved'
      and needle.v <> ''
      and extensions.unaccent(lower(s.name)) like '%' || needle.v || '%'
    order by s.followers_count desc
    limit limit_count
  );
$$;

grant execute on function public.search_catalog(text, integer) to anon, authenticated;
