-- Une image par couleur, et la trace de celles qui ont été fabriquées
--
-- `products.images` est une liste à plat : rien n'y relie une photo à la
-- couleur qu'elle montre. Un client qui touchait « bleu » voyait donc la photo
-- du modèle rouge, et découvrait la vraie couleur à la livraison.
--
-- La forme retenue :
--
--   {
--     "#b0532f": { "url": "https://…/roux.webp", "generated": false },
--     "#241f2e": { "url": "https://…/noir.webp",  "generated": true,
--                  "from": "#b0532f", "at": "2026-08-22T10:00:00Z" }
--   }
--
-- La clé est la couleur telle qu'elle figure dans `products.colors` — une
-- valeur CSS, le plus souvent hexadécimale. Un objet JSON plutôt qu'une table
-- de liaison : il n'y a jamais qu'une photo par couleur, la lecture se fait
-- toujours avec le produit, et une jointure supplémentaire sur chaque fiche
-- coûterait plus qu'elle n'apporte.
--
-- `generated` est ce qui compte. Une image fabriquée par teinte automatique
-- n'est pas une photo du produit : elle en approche la couleur. La marquer
-- permet trois choses — l'annoncer au client, la remplacer sans hésiter dès
-- qu'une vraie photo arrive, et ne jamais écraser une vraie photo par une
-- fabriquée.

alter table public.products
  add column if not exists variant_images jsonb not null default '{}'::jsonb;

comment on column public.products.variant_images is
  'Photo par couleur : { "<couleur>": { url, generated, from?, at? } }. '
  '`generated` distingue une teinte fabriquée d''une photo réelle du vendeur.';

-- Un objet, jamais un tableau ni une valeur scalaire : le code lit des clés.
alter table public.products
  drop constraint if exists products_variant_images_object;

alter table public.products
  add constraint products_variant_images_object
  check (jsonb_typeof(variant_images) = 'object');

-- Les politiques existantes de `products` couvrent la nouvelle colonne :
-- lecture publique pour les articles en ligne, écriture réservée au
-- propriétaire de la boutique. Rien à ajouter.
