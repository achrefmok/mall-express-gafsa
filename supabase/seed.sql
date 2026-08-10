-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — jeu de données de démonstration
--
-- Deux parties :
--   A · Référentiel — catégories, services pratiques, contenus municipaux.
--       Nécessaire en production. Sûr à rejouer.
--   B · Démonstration — comptes, boutiques, produits, live, bons plans.
--       Reproduit les maquettes. À ne PAS charger sur une base de production.
--
-- Usage local  : supabase db reset          (charge tout)
-- Usage prod   : n'exécuter que la partie A (couper avant le repère PARTIE B)
--
-- Mots de passe des comptes de démonstration : « demo1234 »
-- ═══════════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  PARTIE A · RÉFÉRENTIEL                                           ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- ─── Catégories ────────────────────────────────────────────────────────
-- La teinte `hue` est la seule variable : oklch(.47 .12 <hue>).

insert into public.categories (slug, name_fr, name_ar, hue, monogram, sort_order) values
  ('mode',          'Mode',          'أزياء',      25,  'MO', 1),
  ('beaute',        'Beauté',        'تجميل',      350, 'BE', 2),
  ('maison',        'Maison',        'منزل',       70,  'MA', 3),
  ('sport',         'Sport',         'رياضة',      155, 'SP', 4),
  ('alimentation',  'Alimentation',  'مواد غذائية', 110, 'AL', 5),
  ('electronique',  'Électronique',  'إلكترونيات', 255, 'EL', 6),
  ('cafes',         'Cafés',         'مقاهي',      45,  'CA', 7),
  ('services',      'Services',      'خدمات',      300, 'SV', 8)
on conflict (slug) do update
  set name_fr = excluded.name_fr, name_ar = excluded.name_ar,
      hue = excluded.hue, monogram = excluded.monogram, sort_order = excluded.sort_order;

-- Sous-catégories mode, affichées en chips sur la fiche boutique
insert into public.categories (slug, name_fr, name_ar, hue, monogram, sort_order, parent_id)
select v.slug, v.name_fr, v.name_ar, v.hue, v.monogram, v.sort_order, p.id
from (values
  ('mode-femme',       'Femme',       'نساء',     350, 'FE', 1),
  ('mode-homme',       'Homme',       'رجال',     255, 'HO', 2),
  ('mode-enfant',      'Enfant',      'أطفال',    110, 'EN', 3),
  ('mode-accessoires', 'Accessoires', 'إكسسوارات', 70,  'AC', 4)
) as v(slug, name_fr, name_ar, hue, monogram, sort_order)
cross join lateral (select id from public.categories where slug = 'mode') p
on conflict (slug) do nothing;

-- ─── Services pratiques (écran 1 · carrousel, écran 5) ─────────────────

insert into public.practical_services (kind, name, name_ar, phone, address, info, hue, monogram, sort_order) values
  ('taxi',     'Taxi Gafsa Centre',   'تاكسي قفصة',      '+21676220100', 'Place Pasteur, Gafsa',       'Course en ville 24h/24',       75,  'TX', 1),
  ('taxi',     'Allo Taxi Gafsa',     'ألو تاكسي',        '+21676221200', 'Avenue Habib Bourguiba',     'Réservation par téléphone',    75,  'TX', 2),
  ('louage',   'Louage Gafsa — Tunis','لواج قفصة تونس',   '+21676224400', 'Station de louage, Gafsa',   'Départs toutes les 30 min',    215, 'LG', 1),
  ('louage',   'Louage Gafsa — Sfax', 'لواج قفصة صفاقس',  '+21676224500', 'Station de louage, Gafsa',   'Départs toutes les heures',    215, 'LG', 2),
  ('prayer',   'Horaires de prière',  'مواقيت الصلاة',    null,           'Gafsa',                      'Mis à jour chaque jour',       165, 'PR', 1),
  ('pharmacy', 'Pharmacies de garde', 'صيدليات المناوبة', null,           'Gafsa',                      'Nuit et jours fériés',         350, 'PH', 1)
on conflict do nothing;

-- ─── Infos municipales et démarches (écran 5) ──────────────────────────

insert into public.city_infos (kind, title, title_ar, subtitle, subtitle_ar, hue, monogram, sort_order) values
  ('works',           'Travaux Avenue Habib Bourguiba', 'أشغال شارع الحبيب بورقيبة', 'Circulation perturbée jusqu''au 15 août', 'حركة المرور مضطربة إلى غاية 15 أوت', 70,  'TR', 1),
  ('transport',       'Nouvel horaire bus ligne 3',     'توقيت جديد للحافلة رقم 3',   'En vigueur dès lundi',                     'ساري المفعول بداية من يوم الاثنين',   215, 'BU', 2),
  ('admin_procedure', 'Payer une facture',              'خلاص فاتورة',                'Eau, électricité, taxes locales',          'ماء، كهرباء، أداءات محلية',           255, 'FA', 1),
  ('admin_procedure', 'Déposer une réclamation',        'تقديم شكوى',                 'Voirie, éclairage, propreté',              'طرقات، إنارة، نظافة',                 300, 'RE', 2)
on conflict do nothing;

insert into public.city_alerts (title, title_ar, body, severity, ends_at) values
  ('Vigilance chaleur', 'تنبيه من الحرارة',
   'Restez hydratés, évitez le soleil entre 12h et 16h.',
   'warning', now() + interval '7 days')
on conflict do nothing;

-- ─── Horaires de prière et pharmacie de garde (7 jours glissants) ──────

insert into public.prayer_times (on_date, fajr, dhuhr, asr, maghrib, isha)
select
  current_date + d,
  '04:15'::time, '12:35'::time, '16:12'::time, '19:28'::time, '20:52'::time
from generate_series(0, 6) d
on conflict (on_date) do nothing;

insert into public.pharmacies_on_duty (on_date, name, address, phone)
select current_date + d,
       (array['Pharmacie Ibn Sina','Pharmacie El Amal','Pharmacie Ennour'])[1 + (d % 3)],
       'Avenue Habib Bourguiba, Gafsa',
       '+2167622' || lpad((3000 + d)::text, 4, '0')
from generate_series(0, 6) d
on conflict (on_date, name) do nothing;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  PARTIE B · DÉMONSTRATION — ne pas charger en production          ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- ─── Comptes ───────────────────────────────────────────────────────────
-- Insertion directe dans auth.users : réservé au développement local.
-- Le trigger handle_new_user crée les profils et les boutiques associées.

do $$
declare
  demo_pwd text := extensions.crypt('demo1234', extensions.gen_salt('bf'));
  u record;
begin
  for u in
    select * from (values
      ('11111111-1111-4111-8111-111111111111'::uuid, 'amira@demo.gafsa',  '{"role":"client","first_name":"Amira","last_name":"Saidi","phone":"+21698112233"}'::jsonb),
      ('22222222-2222-4222-8222-222222222222'::uuid, 'mohamed@demo.gafsa','{"role":"client","first_name":"Mohamed","last_name":"Karray","phone":"+21698445566"}'::jsonb),
      ('33333333-3333-4333-8333-333333333333'::uuid, 'ines@demo.gafsa',   '{"role":"client","first_name":"Ines","last_name":"Bouzid","phone":"+21698778899"}'::jsonb),
      ('44444444-4444-4444-8444-444444444444'::uuid, 'zara@demo.gafsa',   '{"role":"vendor","first_name":"Leila","last_name":"Trabelsi","shop_name":"Zara — Mall Gafsa","shop_location":"Niveau 1 — Local B12"}'::jsonb),
      ('55555555-5555-4555-8555-555555555555'::uuid, 'cafeoasis@demo.gafsa','{"role":"vendor","first_name":"Sami","last_name":"Gharbi","shop_name":"Café Oasis","shop_location":"Niveau 0 — Local A3"}'::jsonb),
      ('66666666-6666-4666-8666-666666666666'::uuid, 'sportplus@demo.gafsa','{"role":"vendor","first_name":"Nizar","last_name":"Hamdi","shop_name":"Sport+","shop_location":"Niveau 1 — Local C7"}'::jsonb),
      ('77777777-7777-4777-8777-777777777777'::uuid, 'lcosm@demo.gafsa',  '{"role":"vendor","first_name":"Rania","last_name":"Mejri","shop_name":"L. Cosmétiques","shop_location":"Niveau 0 — Local A9"}'::jsonb),
      ('88888888-8888-4888-8888-888888888888'::uuid, 'maisongafsa@demo.gafsa','{"role":"vendor","first_name":"Hatem","last_name":"Jebali","shop_name":"Maison Gafsa — Décoration","shop_location":"Niveau 2 — Local D4"}'::jsonb),
      ('99999999-9999-4999-8999-999999999999'::uuid, 'ennour@demo.gafsa', '{"role":"vendor","first_name":"Fathi","last_name":"Amri","shop_name":"Épicerie Ennour","shop_location":"Niveau 0 — Local A1"}'::jsonb),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'admin@demo.gafsa',  '{"role":"client","first_name":"Administration","last_name":"Gafsa"}'::jsonb)
    ) as t(id, email, meta)
  loop
    -- Les colonnes de jetons doivent valoir '' et non NULL : GoTrue les lit
    -- dans des chaînes Go non nullables, et un NULL casse l'API
    -- d'administration (« Database error finding users »).
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    )
    values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.email, demo_pwd, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, u.meta,
      '', '', '', '', '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (
      extensions.gen_random_uuid(), u.id::text, u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  end loop;
end $$;

-- Promotion du compte d'administration (le trigger interdit l'auto-attribution)
update public.profiles set role = 'admin'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

update public.profiles set loyalty_points = 320, city = 'Gafsa'
where id = '11111111-1111-4111-8111-111111111111';

-- ─── Boutiques ─────────────────────────────────────────────────────────

update public.shops s set
  status         = 'approved',
  approved_at    = now(),
  category_id    = c.id,
  mall_level     = v.level,
  mall_unit      = v.unit,
  description    = v.descr,
  description_ar = v.descr_ar,
  phone          = v.phone,
  latitude       = 34.4250,
  longitude      = 8.7842,
  is_open_now    = true,
  followers_count= v.followers,
  posts_count    = v.posts,
  rating_sum     = v.rating_sum,
  rating_count   = v.rating_count
from (values
  ('zara-mall-gafsa',           'mode',         1, 'B12', 'Nouvelle collection chaque semaine.', 'متجرك المفضل للأزياء العصرية.', '+21676230001', 12400, 248, 1200, 250),
  ('cafe-oasis',                'cafes',        0, 'A3',  'Torréfaction maison, pâtisserie tunisienne.', 'قهوة محمصة في المحل وحلويات تونسية.', '+21676230002', 3100, 96, 470, 100),
  ('sport',                     'sport',        1, 'C7',  'Équipement running, fitness et football.', 'معدات الجري واللياقة وكرة القدم.', '+21676230003', 2800, 74, 380, 80),
  ('l-cosmetiques',             'beaute',       0, 'A9',  'Soins visage et parfums.', 'مستحضرات العناية بالبشرة والعطور.', '+21676230004', 1900, 51, 235, 50)
) as v(slug, cat, level, unit, descr, descr_ar, phone, followers, posts, rating_sum, rating_count)
join public.categories c on c.slug = v.cat
where s.slug = v.slug;

-- Deux dossiers laissés en attente pour alimenter l'écran 14
update public.shops set status = 'pending', submitted_at = now() - interval '2 days'
where slug = 'maison-gafsa-decoration';

update public.shops set status = 'pending', submitted_at = now() - interval '6 hours', missing_document = 'CIN'
where slug = 'epicerie-ennour';

-- Horaires : lundi–vendredi 09–20, samedi 09–22, dimanche fermé
insert into public.shop_hours (shop_id, weekday, opens_at, closes_at, is_closed)
select s.id, d.weekday,
       case when d.weekday = 6 then null else '09:00'::time end,
       case when d.weekday = 6 then null when d.weekday = 5 then '22:00'::time else '20:00'::time end,
       d.weekday = 6
from public.shops s
cross join (select generate_series(0, 6) as weekday) d
on conflict (shop_id, weekday) do nothing;

-- Sous-catégories vendues par Zara
insert into public.shop_categories (shop_id, category_id)
select s.id, c.id
from public.shops s, public.categories c
where s.slug = 'zara-mall-gafsa'
  and c.slug in ('mode-femme', 'mode-homme', 'mode-enfant', 'mode-accessoires')
on conflict do nothing;

-- ─── Produits ──────────────────────────────────────────────────────────

insert into public.products (
  shop_id, category_id, name, name_ar, description, description_ar,
  price, compare_at_price, stock, colors, sizes, mall_pickup_available
)
select s.id, c.id, v.name, v.name_ar, v.descr, v.descr_ar,
       v.price, v.compare_at, v.stock, v.colors, v.sizes, true
from (values
  ('zara-mall-gafsa', 'mode',         'Robe automne — coupe évasée', 'فستان خريفي',   'Tissu fluide, disponible en trois couleurs.', 'متوفر بمقاسات S إلى XL.', 89.000,  125.000, 12, array['#241f2e','#b0532f','#6d4b8f'], array['S','M','L','XL']),
  ('zara-mall-gafsa', 'mode',         'Blazer laine',                'سترة صوف',      'Coupe droite, doublure satinée.',             'قصة مستقيمة.',            160.000, null,    2,  array['#241f2e','#4a4a52'],            array['S','M','L']),
  ('zara-mall-gafsa', 'mode',         'Sac cuir',                    'حقيبة جلدية',   'Cuir pleine fleur, bandoulière amovible.',    'جلد طبيعي.',              210.000, null,    7,  array['#8a5a3b','#241f2e'],            array[]::text[]),
  ('zara-mall-gafsa', 'mode',         'Chemise lin',                 'قميص كتان',     'Lin lavé, coupe décontractée.',               'كتان مغسول.',             75.000,  null,    24, array['#f0ece4','#9fb8c8'],            array['S','M','L','XL']),
  ('l-cosmetiques',   'beaute',       'Sérum visage',                'سيروم للوجه',   'Acide hyaluronique, 30 ml.',                  'حمض الهيالورونيك.',       45.000,  64.000,  18, array[]::text[],                       array[]::text[]),
  ('sport',           'sport',        'Baskets running',             'حذاء رياضي',    'Amorti réactif, semelle respirante.',         'نعل مريح.',               120.000, null,    9,  array['#1f2933','#d0455f'],            array['39','40','41','42','43']),
  ('cafe-oasis',      'cafes',        'Cafetière italienne',         'ركوة قهوة',     'Aluminium, 6 tasses.',                        'ألمنيوم، 6 فناجين.',      65.000,  null,    15, array[]::text[],                       array[]::text[]),
  ('cafe-oasis',      'alimentation', 'Café moulu — 500 g',          'قهوة مطحونة',   'Torréfaction artisanale du jour.',            'تحميص يومي.',             18.000,  null,    40, array[]::text[],                       array[]::text[])
) as v(shop_slug, cat, name, name_ar, descr, descr_ar, price, compare_at, stock, colors, sizes)
join public.shops s on s.slug = v.shop_slug
join public.categories c on c.slug = v.cat
on conflict do nothing;

-- ─── Promotion boutique (bandeau écran 6) ──────────────────────────────

insert into public.promotions (shop_id, title, title_ar, percent_off, ends_at)
select id, 'Promotion Automne', 'تخفيضات الخريف', 30, now() + interval '11 days'
from public.shops where slug = 'zara-mall-gafsa'
on conflict do nothing;

-- ─── Emplacements sponsorisés (écran 1) ────────────────────────────────

insert into public.sponsored_slots (advertiser, title, subtitle, position, ends_at) values
  ('Banque de Tunisie', 'Banque de Tunisie — carte jeune', '0 frais la première année', 1, now() + interval '30 days'),
  ('Ooredoo',           'Ooredoo — forfait data',          '20 Go à 15 DT/mois',        2, now() + interval '30 days')
on conflict do nothing;

-- ─── Live programmé (écran 4) ──────────────────────────────────────────
-- Source `camera` : le vendeur diffusera depuis son téléphone.

insert into public.lives (
  shop_id, title, title_ar, status, source,
  pinned_product_id, live_percent_off, offer_ends_at, scheduled_at
)
select s.id,
       'Collection Automne en direct', 'المجموعة الخريفية مباشرة',
       'scheduled', 'camera',
       p.id, 30, now() + interval '1 hour', now() + interval '12 minutes'
from public.shops s
join public.products p on p.shop_id = s.id and p.name = 'Robe automne — coupe évasée'
where s.slug = 'zara-mall-gafsa'
on conflict do nothing;

-- ─── Bons plans (écran 11) ─────────────────────────────────────────────

insert into public.deals (author_id, shop_id, category_id, title, body, body_ar, location_label, expires_at, created_at)
select '22222222-2222-4222-8222-222222222222', s.id, c.id,
       'Sport+ : deuxième paire à −50 %, même en soldes',
       'Vu ce matin en vitrine, l''offre marche aussi sur les modèles déjà remisés.',
       'العرض ساري إلى غاية الليلة فقط، جربوه قبل ما يخلص المخزون.',
       'Niveau 1', (current_date + 1) + time '22:00', now() - interval '25 minutes'
from public.shops s join public.categories c on c.slug = 'sport'
where s.slug = 'sport'
on conflict do nothing;

insert into public.deals (author_id, shop_id, category_id, title, body, location_label, expires_at, created_at)
select '33333333-3333-4333-8333-333333333333', s.id, c.id,
       'Petit-déjeuner à 6 DT avant 10 h, boisson comprise',
       'Testé ce matin, l''offre n''est pas affichée en vitrine — il faut la demander.',
       'Café Oasis', now() + interval '20 days', now() - interval '2 hours'
from public.shops s join public.categories c on c.slug = 'cafes'
where s.slug = 'cafe-oasis'
on conflict do nothing;

-- Trois confirmations sur le bon plan Café Oasis ⇒ le trigger le passe
-- « Vérifié » et crédite 20 points à son autrice.
insert into public.deal_votes (deal_id, user_id, value)
select d.id, u.uid, 1
from public.deals d
cross join (values
  ('11111111-1111-4111-8111-111111111111'::uuid),
  ('22222222-2222-4222-8222-222222222222'::uuid),
  ('44444444-4444-4444-8444-444444444444'::uuid)
) as u(uid)
where d.title like 'Petit-déjeuner%'
on conflict do nothing;

insert into public.deal_votes (deal_id, user_id, value)
select d.id, '11111111-1111-4111-8111-111111111111', 1
from public.deals d where d.title like 'Sport+%'
on conflict do nothing;

-- Un signalement pour alimenter la file de modération (écran 14)
insert into public.reports (reporter_id, target_type, target_id, reason)
select '33333333-3333-4333-8333-333333333333', 'deal', d.id, 'Offre expirée / trompeuse'
from public.deals d where d.title like 'Sport+%'
on conflict do nothing;

-- ─── Une commande, pour l'écran vendeur ────────────────────────────────

do $$
declare
  zara_shop uuid;
  robe      uuid;
  sac       uuid;
  o1        uuid;
begin
  select id into zara_shop from public.shops where slug = 'zara-mall-gafsa';
  if zara_shop is null then return; end if;

  select id into robe from public.products where shop_id = zara_shop and name like 'Robe automne%';
  select id into sac  from public.products where shop_id = zara_shop and name = 'Sac cuir';

  insert into public.orders (order_number, user_id, shop_id, status, payment_method, delivery_method, subtotal, total, contact_phone)
  values ('MEG-DEMO-0001', '11111111-1111-4111-8111-111111111111', zara_shop, 'to_prepare', 'cod', 'pickup', 89.000, 89.000, '+21698112233')
  on conflict (order_number) do nothing
  returning id into o1;

  if o1 is not null then
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (o1, robe, 'Robe automne — coupe évasée', 89.000, 1);
  end if;

  insert into public.orders (order_number, user_id, shop_id, status, payment_method, delivery_method, subtotal, total, contact_phone, created_at)
  values ('MEG-DEMO-0002', '22222222-2222-4222-8222-222222222222', zara_shop, 'delivered', 'cod', 'delivery', 210.000, 210.000, '+21698445566', now() - interval '1 day')
  on conflict (order_number) do nothing
  returning id into o1;

  if o1 is not null then
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (o1, sac, 'Sac cuir', 210.000, 1);
  end if;
end $$;

-- Abonnements, pour que les compteurs de l'écran 6 ne soient pas vides
insert into public.shop_follows (user_id, shop_id)
select p.id, s.id
from public.profiles p, public.shops s
where p.id in (
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333')
  and s.slug in ('zara-mall-gafsa', 'cafe-oasis')
on conflict do nothing;

select public.refresh_shops_open_state();
