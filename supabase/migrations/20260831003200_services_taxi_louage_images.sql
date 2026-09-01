-- Rattache les vignettes taxi et louage aux services pratiques
--
-- Les services « Taxi Gafsa Centre » et « Louage Gafsa — Tunis » ont toujours
-- porté leur monogramme (TX / LG), faute d'image : une photo de taxi new-yorkais
-- ou de fourgon générique n'aurait pas représenté un taxi de Gafsa ni un louage
-- tunisien. On a donc dessiné deux illustrations (3D, teintes du service) et les
-- voici rattachées, comme l'avaient été la prière et la pharmacie.
--
-- Les fichiers sont servis par l'application depuis `public/images/` :
-- chemins relatifs, le même enregistrement fonctionne en local, en préversion
-- et en production.

update public.practical_services
   set image_url = '/images/svc-taxi.webp'
 where kind = 'taxi';

update public.practical_services
   set image_url = '/images/svc-louage.webp'
 where kind = 'louage';

-- Contrôle : ce qui porte désormais une image.
select 'service' as table_, kind::text as cle, image_url
  from public.practical_services
 where image_url is not null
 order by cle;
