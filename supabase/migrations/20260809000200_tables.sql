-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 02 · Tables
-- Montants en dinar tunisien : numeric(10,3) (le millime est la subdivision).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Profils ───────────────────────────────────────────────────────────
-- Étend auth.users. Alimenté par le trigger handle_new_user (migration 03).

create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              public.user_role not null default 'client',
  first_name        text,
  last_name         text,
  phone             text,
  city              text default 'Gafsa',
  avatar_url        text,
  bio               text,

  -- Préférences de session (écran 1 : barre d'accessibilité)
  locale            public.app_locale not null default 'fr',
  text_scale        numeric(3,2) not null default 1.00 check (text_scale between 1.00 and 1.60),
  simplified_mode   boolean not null default false,

  -- Fidélité et parrainage (écran 7)
  loyalty_points    integer not null default 0 check (loyalty_points >= 0),
  referral_code     text unique,
  referred_by       uuid references public.profiles (id) on delete set null,

  is_banned         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.profiles.text_scale is
  'Échelle typographique choisie via « A Texte plus grand ». 1.00 = normal, 1.30 = agrandi.';

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

-- ─── Catégories ────────────────────────────────────────────────────────
-- `hue` porte la règle systémique du design : oklch(.47 .12 <hue>) pour le
-- texte, color-mix(… 14%, #f4f1fa) pour le fond. Ajouter une catégorie =
-- choisir une teinte, rien d'autre à redessiner.

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_fr     text not null,
  name_ar     text not null,
  hue         smallint not null check (hue between 0 and 360),
  monogram    text not null check (char_length(monogram) between 1 and 2),
  parent_id   uuid references public.categories (id) on delete cascade,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists categories_parent_idx on public.categories (parent_id);
create index if not exists categories_active_sort_idx on public.categories (is_active, sort_order);

-- ─── Boutiques ─────────────────────────────────────────────────────────

create table if not exists public.shops (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles (id) on delete cascade,
  slug               text not null unique,
  name               text not null,
  name_ar            text,
  description        text,
  description_ar     text,
  category_id        uuid references public.categories (id) on delete set null,

  logo_url           text,
  cover_url          text,
  banner_url         text,

  -- Emplacement au mall (écran 3 : « Niveau 1 · Local B12 »)
  mall_level         smallint,
  mall_unit          text,
  address            text,
  latitude           double precision,
  longitude          double precision,
  phone              text,

  status             public.shop_status not null default 'pending',
  rejection_reason   text,
  missing_document   text,      -- écran 14 : « Document manquant : CIN »
  submitted_at       timestamptz not null default now(),
  approved_at        timestamptz,
  approved_by        uuid references public.profiles (id) on delete set null,

  delivers_in_gafsa  boolean not null default true,
  pickup_in_store    boolean not null default true,
  is_open_now        boolean not null default false,
  is_featured        boolean not null default false,   -- « Mettre à la une »

  -- Compteurs dénormalisés, tenus par triggers (migration 03)
  rating_sum         integer not null default 0,
  rating_count       integer not null default 0,
  followers_count    integer not null default 0,
  posts_count        integer not null default 0,
  views_count        integer not null default 0,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint shops_owner_unique unique (owner_id)
);

comment on column public.shops.rating_sum is
  'Somme des notes. La moyenne affichée est rating_sum::numeric / nullif(rating_count,0).';

create index if not exists shops_status_idx on public.shops (status);
create index if not exists shops_category_idx on public.shops (category_id);
create index if not exists shops_featured_idx on public.shops (is_featured) where is_featured;
create index if not exists shops_name_trgm_idx on public.shops using gin (name extensions.gin_trgm_ops);

-- Horaires d'ouverture (écran 10)
create table if not exists public.shop_hours (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),  -- 0 = lundi
  opens_at   time,
  closes_at  time,
  is_closed  boolean not null default false,
  constraint shop_hours_unique unique (shop_id, weekday),
  constraint shop_hours_range check (
    is_closed or (opens_at is not null and closes_at is not null)
  )
);

-- Sous-catégories vendues, affichées en chips (écrans 6 et 10)
create table if not exists public.shop_categories (
  shop_id     uuid not null references public.shops (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (shop_id, category_id)
);

create table if not exists public.shop_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  shop_id    uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

-- ─── Produits ──────────────────────────────────────────────────────────

create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  shop_id               uuid not null references public.shops (id) on delete cascade,
  category_id           uuid references public.categories (id) on delete set null,

  name                  text not null,
  name_ar               text,
  description           text,
  description_ar        text,

  price                 numeric(10,3) not null check (price >= 0),
  compare_at_price      numeric(10,3) check (compare_at_price is null or compare_at_price >= price),

  stock                 integer not null default 0 check (stock >= 0),
  low_stock_threshold   integer not null default 3 check (low_stock_threshold >= 0),

  images                text[] not null default '{}',
  colors                text[] not null default '{}',   -- couleurs hex (écran 3)
  sizes                 text[] not null default '{}',

  is_online             boolean not null default true,
  is_draft              boolean not null default false,
  mall_pickup_available boolean not null default true,  -- filtre « Retrait au mall en 30 min »

  views_count           integer not null default 0,
  sold_count            integer not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists products_shop_idx on public.products (shop_id);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_visible_idx on public.products (is_online, is_draft) where is_online and not is_draft;
create index if not exists products_pickup_idx on public.products (mall_pickup_available) where mall_pickup_available;
create index if not exists products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists products_low_stock_idx on public.products (shop_id) where stock <= 3;

-- Promotions au niveau boutique (bandeau « −30 % · Promotion Automne »)
create table if not exists public.promotions (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  title        text not null,
  title_ar     text,
  percent_off  smallint not null check (percent_off between 1 and 90),
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint promotions_dates check (ends_at > starts_at)
);

create index if not exists promotions_shop_active_idx on public.promotions (shop_id, is_active, ends_at);

create table if not exists public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity   integer not null default 1 check (quantity > 0 and quantity <= 99),
  color      text,
  size       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Une ligne par (produit, couleur, taille). coalesce car NULL ≠ NULL en UNIQUE.
  constraint cart_items_variant_unique unique (user_id, product_id, color, size)
);

create index if not exists cart_items_user_idx on public.cart_items (user_id);

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  shop_id    uuid not null references public.shops (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  rating     smallint not null check (rating between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  constraint reviews_one_per_shop unique (user_id, shop_id)
);

create index if not exists reviews_shop_idx on public.reviews (shop_id);

-- ─── Commandes ─────────────────────────────────────────────────────────

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  shop_id          uuid not null references public.shops (id) on delete restrict,
  live_id          uuid,   -- FK ajoutée après la création de `lives`

  status           public.order_status not null default 'pending',
  payment_method   public.payment_method not null default 'cod',
  delivery_method  public.delivery_method not null default 'delivery',

  subtotal         numeric(10,3) not null check (subtotal >= 0),
  delivery_fee     numeric(10,3) not null default 0 check (delivery_fee >= 0),
  discount         numeric(10,3) not null default 0 check (discount >= 0),
  total            numeric(10,3) not null check (total >= 0),

  contact_phone    text not null,
  delivery_address text,
  note             text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_shop_idx on public.orders (shop_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  -- Instantané : la commande reste lisible même si le produit change ou disparaît.
  product_name   text not null,
  product_image  text,
  unit_price     numeric(10,3) not null check (unit_price >= 0),
  quantity       integer not null check (quantity > 0),
  color          text,
  size           text
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ─── Lives ─────────────────────────────────────────────────────────────

create table if not exists public.lives (
  id                    uuid primary key default gen_random_uuid(),
  shop_id               uuid not null references public.shops (id) on delete cascade,
  title                 text not null,
  title_ar              text,
  cover_url             text,

  status                public.live_status not null default 'scheduled',
  source                public.live_source not null default 'camera',

  -- source = 'facebook' : URL publique du direct (permalien vidéo Facebook)
  facebook_url          text,
  -- source = 'hls' : flux .m3u8 fourni par un prestataire externe
  hls_url               text,
  -- source = 'camera' : identifiant du pair diffuseur pour la signalisation WebRTC
  broadcaster_peer_id   text,

  pinned_product_id     uuid references public.products (id) on delete set null,
  live_percent_off      smallint check (live_percent_off between 1 and 90),
  offer_ends_at         timestamptz,      -- alimente le compte à rebours « 02:41 »

  scheduled_at          timestamptz,
  started_at            timestamptz,
  ended_at              timestamptz,

  viewers_count         integer not null default 0 check (viewers_count >= 0),
  peak_viewers          integer not null default 0,
  likes_count           integer not null default 0,
  purchases_count       integer not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint lives_source_payload check (
    (source = 'facebook' and facebook_url is not null)
    or (source = 'hls' and hls_url is not null)
    or (source = 'camera')
  )
);

create index if not exists lives_status_idx on public.lives (status, started_at desc);
create index if not exists lives_shop_idx on public.lives (shop_id, created_at desc);

alter table public.orders
  drop constraint if exists orders_live_id_fkey;
alter table public.orders
  add constraint orders_live_id_fkey
  foreign key (live_id) references public.lives (id) on delete set null;

create table if not exists public.live_comments (
  id         uuid primary key default gen_random_uuid(),
  live_id    uuid not null references public.lives (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists live_comments_live_idx on public.live_comments (live_id, created_at desc);

create table if not exists public.live_likes (
  live_id    uuid not null references public.lives (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (live_id, user_id)
);

-- ─── Bons plans (communauté) ───────────────────────────────────────────

create table if not exists public.deals (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles (id) on delete cascade,
  shop_id         uuid references public.shops (id) on delete set null,
  category_id     uuid references public.categories (id) on delete set null,

  title           text not null check (char_length(btrim(title)) between 3 and 160),
  body            text,
  body_ar         text,
  images          text[] not null default '{}',
  location_label  text,          -- « Niveau 1 », « Café Oasis »…

  expires_at      timestamptz not null,
  status          public.deal_status not null default 'active',

  -- Trois confirmations ⇒ « Vérifié » + 20 points à l'auteur (trigger, migration 03)
  is_verified     boolean not null default false,
  verified_at     timestamptz,

  upvotes         integer not null default 0,
  downvotes       integer not null default 0,
  comments_count  integer not null default 0,
  reports_count   integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists deals_status_created_idx on public.deals (status, created_at desc);
create index if not exists deals_popular_idx on public.deals (status, upvotes desc);
create index if not exists deals_expires_idx on public.deals (expires_at) where status = 'active';
create index if not exists deals_shop_idx on public.deals (shop_id);

create table if not exists public.deal_votes (
  deal_id    uuid not null references public.deals (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (deal_id, user_id)
);

create table if not exists public.deal_comments (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deals (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists deal_comments_deal_idx on public.deal_comments (deal_id, created_at);

-- ─── Modération ────────────────────────────────────────────────────────

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  target_type  public.report_target not null,
  target_id    uuid not null,
  reason       text,
  status       public.report_status not null default 'open',
  resolved_by  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint reports_once_per_user unique (reporter_id, target_type, target_id)
);

create index if not exists reports_open_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- ─── Messagerie client ↔ boutique ──────────────────────────────────────

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  shop_id         uuid not null references public.shops (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint conversations_unique unique (user_id, shop_id)
);

create index if not exists conversations_user_idx on public.conversations (user_id, last_message_at desc);
create index if not exists conversations_shop_idx on public.conversations (shop_id, last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- ─── Notifications ─────────────────────────────────────────────────────

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

-- ─── Fidélité et parrainage ────────────────────────────────────────────

create table if not exists public.loyalty_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  points     integer not null,
  reason     text not null,
  ref_type   text,
  ref_id     uuid,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_user_idx on public.loyalty_transactions (user_id, created_at desc);

create table if not exists public.referrals (
  id             uuid primary key default gen_random_uuid(),
  referrer_id    uuid not null references public.profiles (id) on delete cascade,
  referred_id    uuid not null references public.profiles (id) on delete cascade,
  points_awarded integer not null default 0,
  validated_at   timestamptz,
  created_at     timestamptz not null default now(),
  constraint referrals_unique unique (referred_id)
);

-- ─── Régie publicitaire (écrans 1 et 14) ───────────────────────────────

create table if not exists public.sponsored_slots (
  id          uuid primary key default gen_random_uuid(),
  advertiser  text not null,
  title       text not null,
  subtitle    text,
  image_url   text,
  link_url    text,
  shop_id     uuid references public.shops (id) on delete cascade,
  position    smallint not null default 0,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  is_active   boolean not null default true,
  impressions integer not null default 0,
  clicks      integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists sponsored_active_idx on public.sponsored_slots (is_active, starts_at, ends_at, position);

-- ─── Services citoyens (écran 5) ───────────────────────────────────────

create table if not exists public.city_infos (
  id         uuid primary key default gen_random_uuid(),
  kind       public.city_info_kind not null,
  title      text not null,
  title_ar   text,
  subtitle   text,
  subtitle_ar text,
  body       text,
  hue        smallint not null default 255 check (hue between 0 and 360),
  monogram   text not null default 'IN',
  link_url   text,
  is_active  boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists city_infos_kind_idx on public.city_infos (kind, is_active, sort_order);

create table if not exists public.city_alerts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  title_ar   text,
  body       text,
  severity   public.alert_severity not null default 'warning',
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  is_active  boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists city_alerts_active_idx on public.city_alerts (is_active, starts_at desc);

create table if not exists public.practical_services (
  id         uuid primary key default gen_random_uuid(),
  kind       public.practical_service_kind not null,
  name       text not null,
  name_ar    text,
  phone      text,
  address    text,
  info       text,
  hue        smallint not null default 75 check (hue between 0 and 360),
  monogram   text not null,
  is_active  boolean not null default true,
  sort_order smallint not null default 0
);

create index if not exists practical_services_kind_idx on public.practical_services (kind, is_active, sort_order);

-- Horaires de prière du jour, pour Gafsa
create table if not exists public.prayer_times (
  on_date  date primary key,
  fajr     time not null,
  dhuhr    time not null,
  asr      time not null,
  maghrib  time not null,
  isha     time not null
);

-- Pharmacie de garde du jour
create table if not exists public.pharmacies_on_duty (
  id       uuid primary key default gen_random_uuid(),
  on_date  date not null,
  name     text not null,
  address  text,
  phone    text,
  constraint pharmacies_on_duty_unique unique (on_date, name)
);

create index if not exists pharmacies_date_idx on public.pharmacies_on_duty (on_date);

-- Démarches déposées par les habitants (écran 7 : « Mes démarches »)
create table if not exists public.service_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       public.service_request_kind not null,
  title      text not null,
  body       text,
  attachments text[] not null default '{}',
  status     public.service_request_status not null default 'submitted',
  response   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_requests_user_idx on public.service_requests (user_id, created_at desc);
create index if not exists service_requests_status_idx on public.service_requests (status);
