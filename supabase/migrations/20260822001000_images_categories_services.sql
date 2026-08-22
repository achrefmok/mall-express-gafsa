-- Une photo pour les catégories et les services pratiques
--
-- Les deux s'affichaient en pastille de couleur portant un dessin ou deux
-- lettres. C'est lisible, mais une photo dit « vêtements » ou « pharmacie »
-- sans qu'on ait à lire — ce qui compte pour une part de la clientèle visée
-- qui lit peu le français.
--
-- La colonne est facultative : tant qu'elle est vide, l'écran garde l'icône
-- existante. Rien ne casse si personne ne téléverse d'image, et chaque photo
-- ajoutée améliore l'écran sans qu'il faille livrer du code.

alter table public.categories
  add column if not exists image_url text;

alter table public.practical_services
  add column if not exists image_url text;

comment on column public.categories.image_url is
  'Photo carrée de la catégorie (~240 px). Vide = repli sur l''icône dessinée.';

comment on column public.practical_services.image_url is
  'Photo carrée du service (~240 px). Vide = repli sur le monogramme.';

-- Les deux tables sont en lecture publique et en écriture réservée aux
-- administrateurs : les politiques existantes couvrent déjà la nouvelle
-- colonne, il n'y a rien à ajouter.
