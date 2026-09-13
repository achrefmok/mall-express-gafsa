-- La catégorie Animaux, et ses sous-catégories.
--
-- Rien à construire : `categories.parent_id` existe depuis le premier schéma,
-- et la Mode s'en sert déjà pour Femme, Homme, Enfant et Accessoires. Une
-- catégorie de plus est donc une ligne de plus, et elle apparaît d'elle-même
-- partout où les catégories sont lues — l'accueil, le marketplace, l'éditeur
-- de produit, l'ouverture de boutique.
--
-- La teinte, 190, est un bleu-vert qu'aucune catégorie n'occupe : la règle
-- du design veut qu'une teinte suffise à distinguer une famille, et deux
-- catégories voisines de même couleur se confondraient sur l'accueil.
--
-- `on conflict do nothing` : rejouer le fichier est sans effet, et une
-- catégorie déjà créée à la main depuis l'administration n'est pas écrasée.

insert into public.categories (slug, name_fr, name_ar, hue, monogram, sort_order, is_active)
values ('animaux', 'Animaux', 'حيوانات', 190, 'AN',
        coalesce((select max(sort_order) + 1 from public.categories where parent_id is null), 20),
        true)
on conflict (slug) do nothing;

/*
  Les sous-catégories, rattachées par le slug du parent plutôt que par un
  identifiant écrit en dur : l'identifiant change d'une base à l'autre, le
  slug non.
*/
insert into public.categories (slug, name_fr, name_ar, hue, monogram, parent_id, sort_order, is_active)
select v.slug, v.name_fr, v.name_ar, 190, v.monogram, p.id, v.ordre, true
from public.categories p
cross join (values
  ('animaux-chiens',       'Chiens',                 'كلاب',              'CH', 1),
  ('animaux-chats',        'Chats',                  'قطط',               'CA', 2),
  ('animaux-oiseaux',      'Oiseaux',                'طيور',              'OI', 3),
  ('animaux-poissons',     'Poissons & aquariums',   'أسماك وأحواض',       'PO', 4),
  ('animaux-nourriture',   'Nourriture',             'أغذية الحيوانات',    'NO', 5),
  ('animaux-accessoires',  'Accessoires',            'إكسسوارات',          'AC', 6),
  ('animaux-toilettage',   'Toilettage',             'العناية والتجميل',   'TO', 7),
  ('animaux-veterinaire',  'Produits vétérinaires',  'منتجات بيطرية',      'VE', 8)
) as v(slug, name_fr, name_ar, monogram, ordre)
where p.slug = 'animaux'
on conflict (slug) do nothing;

/* Marche arrière :
     delete from public.categories where slug like 'animaux-%';
     delete from public.categories where slug = 'animaux';
   Les produits et boutiques qui y étaient rattachés passent à `null` — la
   clé étrangère est en `on delete set null`, rien n'est perdu d'autre. */
