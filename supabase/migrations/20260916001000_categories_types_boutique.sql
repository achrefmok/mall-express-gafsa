-- ════════════════════════════════════════════════════════════════════════
-- Catégories : sous-catégories manquantes, et deux nouvelles familles
-- ════════════════════════════════════════════════════════════════════════
--
-- Données seulement : aucune table, aucune colonne, aucune policy ne change.
--
-- Pourquoi ces lignes
-- ───────────────────
-- L'écran « Ajouter un produit » ne propose plus toutes les catégories du mall
-- mêlées : il propose la famille de la boutique (sa catégorie principale et ses
-- « catégories vendues »), c'est-à-dire la catégorie parente et ses enfants.
-- Une boutique d'électronique ne voyait donc que « Électronique », faute de
-- sous-catégories : elles sont ajoutées ici, comme « Chaussures » pour la mode.
--
-- Deux familles nouvelles, qui regroupent des lieux plutôt que des produits :
-- « Fête & Événements » et « Sport & Loisirs ». Un établissement s'y range
-- comme n'importe quelle boutique — catégorie principale ou catégorie vendue —,
-- et apparaît alors dans l'annuaire /evenements ou /sport-loisirs.
--
-- Idempotente : `on conflict (slug) do nothing`. Collée deux fois, elle ne
-- change rien la seconde.
-- ════════════════════════════════════════════════════════════════════════

/* ─── Électronique : les sous-catégories ─────────────────────────────── */

insert into public.categories (slug, name_fr, name_ar, hue, monogram, parent_id, sort_order, is_active)
select v.slug, v.name_fr, v.name_ar, p.hue, v.monogram, p.id, v.ordre, true
from public.categories p
cross join (values
  ('electronique-telephones',   'Téléphones',                'هواتف',              'TE', 1),
  ('electronique-ordinateurs',  'Ordinateurs',               'حواسيب',             'OR', 2),
  ('electronique-audio',        'Audio',                     'صوتيات',             'AU', 3),
  ('electronique-accessoires',  'Accessoires électroniques', 'ملحقات إلكترونية',    'AE', 4),
  ('electronique-electromenager','Électroménager',           'أجهزة منزلية',        'EM', 5)
) as v(slug, name_fr, name_ar, monogram, ordre)
where p.slug = 'electronique'
on conflict (slug) do nothing;

/* ─── Mode : les chaussures ──────────────────────────────────────────── */

insert into public.categories (slug, name_fr, name_ar, hue, monogram, parent_id, sort_order, is_active)
select 'mode-chaussures', 'Chaussures', 'أحذية', p.hue, 'CS', p.id, 5, true
from public.categories p
where p.slug = 'mode'
on conflict (slug) do nothing;

/* ─── Fête & Événements ──────────────────────────────────────────────── */

insert into public.categories (slug, name_fr, name_ar, hue, monogram, sort_order, is_active)
values ('fete-evenements', 'Fête & Événements', 'أفراح ومناسبات', 330, 'FE',
        coalesce((select max(sort_order) + 1 from public.categories where parent_id is null), 30),
        true)
on conflict (slug) do nothing;

insert into public.categories (slug, name_fr, name_ar, hue, monogram, parent_id, sort_order, is_active)
select v.slug, v.name_fr, v.name_ar, 330, v.monogram, p.id, v.ordre, true
from public.categories p
cross join (values
  ('fete-salles-fetes',      'Salles des fêtes',        'قاعات الأفراح',        'SF', 1),
  ('fete-salles-mariage',    'Salles de mariage',       'قاعات الزفاف',         'SM', 2),
  ('fete-salles-reception',  'Salles de réception',     'قاعات الاستقبال',      'SR', 3),
  ('fete-espaces',           'Espaces événementiels',   'فضاءات التظاهرات',     'EE', 4),
  ('fete-anniversaires',     'Anniversaires',           'أعياد الميلاد',        'AN', 5)
) as v(slug, name_fr, name_ar, monogram, ordre)
where p.slug = 'fete-evenements'
on conflict (slug) do nothing;

/* ─── Sport & Loisirs ────────────────────────────────────────────────── */

insert into public.categories (slug, name_fr, name_ar, hue, monogram, sort_order, is_active)
values ('sport-loisirs', 'Sport & Loisirs', 'رياضة وترفيه', 150, 'SL',
        coalesce((select max(sort_order) + 1 from public.categories where parent_id is null), 31),
        true)
on conflict (slug) do nothing;

insert into public.categories (slug, name_fr, name_ar, hue, monogram, parent_id, sort_order, is_active)
select v.slug, v.name_fr, v.name_ar, 150, v.monogram, p.id, v.ordre, true
from public.categories p
cross join (values
  ('loisirs-salles-sport',  'Salles de sport',         'قاعات الرياضة',        'SS', 1),
  ('loisirs-fitness',       'Fitness & musculation',   'لياقة وكمال أجسام',    'FI', 2),
  ('loisirs-terrains',      'Terrains de sport',       'ملاعب رياضية',         'TS', 3),
  ('loisirs-clubs',         'Clubs sportifs',          'نوادٍ رياضية',          'CL', 4),
  ('loisirs-parcs-jeux',    'Parcs de jeux',           'فضاءات الألعاب',       'PJ', 5),
  ('loisirs-enfants',       'Espaces enfants',         'فضاءات الأطفال',       'EN', 6),
  ('loisirs-familles',      'Activités familiales',    'أنشطة عائلية',         'AF', 7)
) as v(slug, name_fr, name_ar, monogram, ordre)
where p.slug = 'sport-loisirs'
on conflict (slug) do nothing;

/* Marche arrière :
     delete from public.categories where slug like 'electronique-%' or slug = 'mode-chaussures'
       or slug like 'fete-%' or slug like 'loisirs-%'
       or slug in ('fete-evenements', 'sport-loisirs');
   Les produits et boutiques rattachés passent à `null` (on delete set null). */
