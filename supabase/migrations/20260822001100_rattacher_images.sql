-- Rattache les vignettes livrées aux catégories et aux services
--
-- À exécuter APRÈS `20260822001000_images_categories_services.sql`, qui crée la
-- colonne. Les fichiers sont servis par l'application depuis `public/images/` :
-- la politique de sécurité du site n'autorise les images que depuis son propre
-- domaine, Supabase et les tuiles de carte — une adresse externe serait bloquée
-- par le navigateur, pas par la base.
--
-- Chemins relatifs et non absolus : le même enregistrement fonctionne en local,
-- en préversion et en production, sans dépendre du domaine.
--
-- Les `where` portent sur le slug et sur le type : une ligne absente n'est pas
-- une erreur, la requête ne fait simplement rien pour elle.

update public.categories set image_url = '/images/cat-mode.webp'    where slug = 'mode';
update public.categories set image_url = '/images/cat-beaute.webp'  where slug = 'beaute';
update public.categories set image_url = '/images/cat-maison.webp'  where slug = 'maison';
update public.categories set image_url = '/images/cat-sport.webp'   where slug = 'sport';
update public.categories set image_url = '/images/cat-alim.webp'    where slug = 'alimentation';
update public.categories set image_url = '/images/cat-electro.webp' where slug in ('electro', 'electronique');
update public.categories set image_url = '/images/cat-cafes.webp'   where slug = 'cafes';

update public.practical_services set image_url = '/images/svc-priere.webp'    where kind = 'prayer';
update public.practical_services set image_url = '/images/svc-pharmacie.webp' where kind = 'pharmacy';

-- `taxi` et `louage` restent sans image : une photo de taxi new-yorkais ou de
-- fourgon générique ne représenterait pas un taxi de Gafsa ni un louage
-- tunisien. Tant que la colonne est vide, l'écran garde le monogramme — c'est
-- le repli prévu. Déposer les fichiers dans `public/images/` sous les noms
-- `svc-taxi.webp` et `svc-louage.webp`, puis exécuter :
--
--   update public.practical_services set image_url = '/images/svc-taxi.webp'   where kind = 'taxi';
--   update public.practical_services set image_url = '/images/svc-louage.webp' where kind = 'louage';

-- Contrôle : ce qui porte désormais une image.
select 'categorie' as table_, slug as cle, image_url from public.categories where image_url is not null
union all
select 'service', kind::text, image_url from public.practical_services where image_url is not null
order by table_, cle;
