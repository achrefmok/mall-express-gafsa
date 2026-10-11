-- ════════════════════════════════════════════════════════════════════════
-- Catégories : la famille « Location » (voitures, fêtes, sonorisation,
-- camping)
-- ════════════════════════════════════════════════════════════════════════
--
-- Données seulement : aucune table, aucune colonne, aucune policy ne change.
--
-- Pourquoi ces lignes
-- ───────────────────
-- Le handoff de design « Boutiques G-Mall par catégorie » décrit une
-- vitrine Location (10-location : showroom bleu nuit et or, prix par jour).
-- Aucune catégorie ne permettait à une agence de location de s'y ranger :
-- « location-appartement » / « location-maison » sont de l'immobilier, pas
-- du matériel loué à la journée. `resolveVitrine` mappe déjà ces slugs
-- (src/lib/boutique-vitrines/index.ts) ; tant que cette migration n'est
-- pas collée, aucune boutique ne peut simplement les choisir.
--
-- Idempotente : `on conflict (slug) do nothing`. Collée deux fois, elle ne
-- change rien la seconde.
-- ════════════════════════════════════════════════════════════════════════

insert into public.categories (slug, name_fr, name_ar, hue, monogram, sort_order, is_active)
values ('location', 'Location', 'كراء', 230, 'LO',
        coalesce((select max(sort_order) + 1 from public.categories where parent_id is null), 32),
        true)
on conflict (slug) do nothing;

insert into public.categories (slug, name_fr, name_ar, hue, monogram, parent_id, sort_order, is_active)
select v.slug, v.name_fr, v.name_ar, 230, v.monogram, p.id, v.ordre, true
from public.categories p
cross join (values
  ('location-voitures',     'Location de voitures',  'كراء السيارات',      'LV', 1),
  ('location-fetes',        'Location pour fêtes',   'كراء لوازم الأفراح', 'LF', 2),
  ('location-sonorisation', 'Sonorisation',          'كراء الصوت',         'LS', 3),
  ('location-camping',      'Matériel de camping',   'كراء معدات التخييم', 'LC', 4)
) as v(slug, name_fr, name_ar, monogram, ordre)
where p.slug = 'location'
on conflict (slug) do nothing;

/* Marche arrière :
     delete from public.categories
     where slug in ('location-voitures', 'location-fetes', 'location-sonorisation', 'location-camping', 'location');
   Les produits et boutiques rattachés passent à `null` (on delete set null). */
