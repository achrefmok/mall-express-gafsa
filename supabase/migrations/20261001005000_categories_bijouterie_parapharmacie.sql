-- Bijouterie et Parapharmacie — deux familles de plus, sans boutique encore
-- inscrite dessus.
--
-- Teintes vérifiées contre `select slug, hue from categories order by hue`
-- avant d'écrire ce fichier (voir le plan correspondant) : les teintes
-- occupées sont 25, 40, 45, 70, 110, 145, 150, 155, 190, 250, 255, 280, 300,
-- 330, 350. Bijouterie prend 210 (entre Santé 190 et Enseignement 250,
-- aucune des deux à moins de 20°) ; Parapharmacie prend 130 (entre
-- Alimentation 110 et Immobilier 145, même marge).

insert into public.categories (slug, name_fr, name_ar, hue, monogram, sort_order, is_active)
values
  ('bijouterie', 'Bijouterie', 'مجوهرات', 210, 'BI',
   coalesce((select max(sort_order) + 1 from public.categories where parent_id is null), 20),
   true),
  ('parapharmacie', 'Parapharmacie', 'شبه صيدلية', 130, 'PA',
   coalesce((select max(sort_order) + 1 from public.categories where parent_id is null), 21),
   true)
on conflict (slug) do nothing;

/* Marche arrière :
     delete from public.categories where slug in ('bijouterie', 'parapharmacie');
   Aucun produit ni boutique n'y est encore rattaché : rien d'autre à
   nettoyer. */
