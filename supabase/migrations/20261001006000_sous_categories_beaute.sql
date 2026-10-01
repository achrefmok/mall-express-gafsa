-- Les trois univers de Beauté : Maquillage, Parfums, Soin.
--
-- Nécessaires pour que la mise en page Beauté (trois onglets internes,
-- voir le plan de l'expérience par métier) sache dans quel onglet ranger
-- chaque produit — sur la même donnée réelle que les sous-catégories de
-- Mode (femme/homme/enfant/chaussures/accessoires), pas un attribut
-- inventé qu'aucun vendeur ne peut renseigner aujourd'hui.
--
-- Même teinte que leur parent (350) : ce sont des nuances d'un seul métier,
-- pas trois familles à distinguer sur l'accueil.

insert into public.categories (slug, name_fr, name_ar, hue, monogram, parent_id, sort_order, is_active)
select v.slug, v.name_fr, v.name_ar, 350, v.monogram, p.id, v.ordre, true
from public.categories p
cross join (values
  ('beaute-maquillage', 'Maquillage', 'مكياج',        'MA', 1),
  ('beaute-parfums',    'Parfums',    'عطور',          'PA', 2),
  ('beaute-soin',       'Soin',       'العناية بالبشرة', 'SO', 3)
) as v(slug, name_fr, name_ar, monogram, ordre)
where p.slug = 'beaute'
on conflict (slug) do nothing;

/* Marche arrière :
     delete from public.categories where slug like 'beaute-%'; */
