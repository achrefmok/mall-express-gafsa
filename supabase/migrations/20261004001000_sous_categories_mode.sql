-- Les sous-catégories Mode : Femme, Homme, Enfant, Accessoires.
--
-- `ModeLayout` (src/components/boutique/layouts/mode-layout.tsx) dépend en
-- dur de ces quatre slugs (plus `mode-chaussures`, déjà créée par
-- 20260916001000_categories_types_boutique.sql) depuis sa première version,
-- mais elles n'existaient jusqu'ici que dans supabase/seed.sql — un fichier
-- de référentiel, pas une migration appliquée en production. Toute vraie
-- boutique Mode avait donc ses produits invisibles sur sa propre vitrine,
-- même bug que celui corrigé sur Lamartine/Beauté (product_attributes
-- Beauté, 2026-10-05) : repéré en audit avant de bâtir dessus.
--
-- Même hue que leur parent (`p.hue`), même patron que mode-chaussures
-- juste au-dessus : ce sont des rayons d'un seul métier, pas des familles
-- à distinguer sur l'accueil.

insert into public.categories (slug, name_fr, name_ar, hue, monogram, parent_id, sort_order, is_active)
select v.slug, v.name_fr, v.name_ar, p.hue, v.monogram, p.id, v.ordre, true
from public.categories p
cross join (values
  ('mode-femme',       'Femme',       'نساء',      'FE', 1),
  ('mode-homme',       'Homme',       'رجال',      'HO', 2),
  ('mode-enfant',      'Enfant',      'أطفال',     'EN', 3),
  ('mode-accessoires', 'Accessoires', 'إكسسوارات', 'AC', 4)
) as v(slug, name_fr, name_ar, monogram, ordre)
where p.slug = 'mode'
on conflict (slug) do nothing;

/* Marche arrière :
     delete from public.categories where slug in
       ('mode-femme', 'mode-homme', 'mode-enfant', 'mode-accessoires'); */
