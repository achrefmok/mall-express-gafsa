-- Trois espaces nouveaux : partenaires, Free Shop, Lelma3ardh.
--
-- ════════════════════════════════════════════════════════════════════════
-- Ce que ce fichier réutilise, et ce qu'il crée
-- ════════════════════════════════════════════════════════════════════════
--
-- Free Shop reprend `deals`. C'est la même chose : un membre publie une
-- annonce, avec un titre, des photos, une catégorie et une date de fin. Lui
-- donner une seconde table aurait dupliqué les votes, les commentaires, les
-- signalements et la tâche d'expiration — quatre mécanismes déjà écrits et
-- déjà éprouvés. Ce fichier ajoute ce qui manquait : un prix, un contact, une
-- modération et deux limites contre le spam.
--
-- Les partenaires reprennent `shops`. Dar Elhout est un vrai commerce : des
-- produits, des photos, des prix, des promotions, des horaires, un espace
-- vendeur pour tout tenir. Un drapeau suffit à le distinguer.
--
-- Les exposants de Lelma3ardh, eux, ont leurs propres tables. Les loger dans
-- `shops` aurait cassé `my_shop_id()`, qui rend **une** boutique par compte :
-- un administrateur Dahmani en gérant dix aurait fait échouer la fonction, et
-- avec elle tout l'espace vendeur de l'application. Un exposant n'a d'ailleurs
-- ni panier, ni stock, ni commande, ni direct : c'est une vitrine que
-- l'événement laisse derrière lui, pas un commerce en ligne.

/* ═══════════════════════════════════════════════════════════════════════
   1 · FREE SHOP
   ═══════════════════════════════════════════════════════════════════════ */

do $$ begin
  create type public.moderation_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

alter table public.deals
  add column if not exists price numeric(10, 2) check (price is null or price >= 0),
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists moderation public.moderation_status not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references public.profiles (id) on delete set null;

comment on column public.deals.moderation is
  'Free Shop : toute annonce passe par un administrateur avant d''être publique.';

-- Les annonces déjà en ligne restent en ligne : elles ont été publiées sous
-- un régime sans modération, les faire disparaître serait les perdre.
update public.deals set moderation = 'approved' where moderation = 'pending' and created_at < now();

-- Quatre photos, pas cinq. La contrainte vit ici et non dans le formulaire :
-- une limite qu'on peut contourner en rejouant la requête n'est pas une limite.
alter table public.deals drop constraint if exists deals_quatre_photos;
alter table public.deals add constraint deals_quatre_photos
  check (coalesce(array_length(images, 1), 0) <= 4);

create index if not exists deals_moderation_idx
  on public.deals (moderation, status, created_at desc);
create index if not exists deals_auteur_mois_idx
  on public.deals (author_id, created_at desc);

/* ─── Trois annonces par mois et par membre ──────────────────────────────
   Comptées côté base, dans le déclencheur d'insertion. Le compteur affiché
   à l'écran n'est qu'une courtoisie : c'est celui-ci qui décide.

   Une annonce refusée ne compte pas. Punir quelqu'un d'un refus en lui
   mangeant son quota, c'est le punir deux fois — et le pousser à republier
   sous un autre compte, exactement ce qu'on cherche à éviter. */
create or replace function public.freeshop_limite_mensuelle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deja integer;
begin
  -- L'administration et le service publient sans quota (reprise, import).
  if public.is_admin() or public.is_service_context() then
    return new;
  end if;

  select count(*) into deja
  from public.deals
  where author_id = new.author_id
    and moderation <> 'rejected'
    and created_at >= date_trunc('month', now());

  if deja >= 3 then
    raise exception 'FREESHOP_LIMITE_MOIS' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_freeshop_limite on public.deals;
create trigger trg_freeshop_limite
  before insert on public.deals
  for each row execute function public.freeshop_limite_mensuelle();

/* ─── Le quota, tel que l'écran doit l'annoncer ────────────────────────── */
create or replace function public.freeshop_quota()
returns table (utilisees integer, plafond integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*)::integer from public.deals
      where author_id = auth.uid()
        and moderation <> 'rejected'
        and created_at >= date_trunc('month', now())),
    3;
$$;

revoke all on function public.freeshop_quota() from public, anon;
grant execute on function public.freeshop_quota() to authenticated;

/* ─── L'auteur ne se modère pas lui-même ─────────────────────────────────
   `guard_deal_privileges` gelait déjà le badge « Vérifié » et les compteurs
   pour qui n'est pas administrateur. La modération rejoint cette liste :
   sans cela, un auteur passerait son annonce en « approved » d'une requête. */
create or replace function public.guard_deal_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.is_verified       := old.is_verified;
  new.verified_at       := old.verified_at;
  new.upvotes           := old.upvotes;
  new.downvotes         := old.downvotes;
  new.comments_count    := old.comments_count;
  new.reports_count     := old.reports_count;
  new.author_id         := old.author_id;
  new.moderation        := old.moderation;
  new.rejection_reason  := old.rejection_reason;
  new.moderated_at      := old.moderated_at;
  new.moderated_by      := old.moderated_by;
  return new;
end;
$$;

-- Le public ne voit que ce qui est approuvé. L'auteur voit toujours la
-- sienne, sans quoi il croirait l'avoir perdue pendant l'attente.
drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals
  for select using (
    (status in ('active', 'expired') and moderation = 'approved')
    or author_id = auth.uid()
    or public.is_admin()
  );

/* ─── La décision de l'administration, en une fonction ─────────────────── */
create or replace function public.freeshop_moderer(
  p_deal uuid,
  p_decision public.moderation_status,
  p_motif text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'FREESHOP_INTERDIT' using errcode = 'insufficient_privilege';
  end if;
  if p_decision = 'rejected' and coalesce(btrim(p_motif), '') = '' then
    raise exception 'FREESHOP_MOTIF' using errcode = 'check_violation';
  end if;

  update public.deals
  set moderation       = p_decision,
      rejection_reason = case when p_decision = 'rejected' then btrim(p_motif) else null end,
      moderated_at     = now(),
      moderated_by     = auth.uid()
  where id = p_deal;

  if not found then
    raise exception 'FREESHOP_INTROUVABLE' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.freeshop_moderer(uuid, public.moderation_status, text) from public, anon;
grant execute on function public.freeshop_moderer(uuid, public.moderation_status, text) to authenticated;

/* ═══════════════════════════════════════════════════════════════════════
   2 · PARTENAIRES ET RÉSERVATIONS
   ═══════════════════════════════════════════════════════════════════════ */

alter table public.shops
  add column if not exists is_partner boolean not null default false,
  add column if not exists partner_rank integer,
  add column if not exists partner_tagline text,
  add column if not exists partner_tagline_ar text,
  add column if not exists accepts_reservations boolean not null default false;

comment on column public.shops.is_partner is
  'Partenaire mis en avant sur l''accueil. Posé par l''administration seule.';

create index if not exists shops_partenaires_idx
  on public.shops (is_partner, partner_rank) where is_partner;

/* ─── Un commerçant ne se déclare pas partenaire ─────────────────────────
   Le drapeau vaut une place sur l'accueil : le laisser au vendeur, c'est
   l'offrir à tous. Il revient à l'administration, comme `is_featured`. */
create or replace function public.guard_shop_partenaire()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_service_context() then
    return new;
  end if;
  new.is_partner         := old.is_partner;
  new.partner_rank       := old.partner_rank;
  new.partner_tagline    := old.partner_tagline;
  new.partner_tagline_ar := old.partner_tagline_ar;
  return new;
end;
$$;

drop trigger if exists trg_shops_partenaire on public.shops;
create trigger trg_shops_partenaire
  before update on public.shops
  for each row execute function public.guard_shop_partenaire();

do $$ begin
  create type public.reservation_status as enum
    ('pending', 'accepted', 'refused', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),

  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- Une réservation peut viser un produit précis (une table, un plat, un
  -- service) ou la boutique seule. Le produit disparu, la réservation reste :
  -- le commerçant doit encore pouvoir honorer ce qu'il a accepté.
  product_id uuid references public.products (id) on delete set null,

  full_name    text not null check (btrim(full_name) <> ''),
  phone        text not null check (btrim(phone) <> ''),
  party_size   integer not null default 1 check (party_size between 1 and 100),
  desired_at   timestamptz not null,
  note         text,

  status public.reservation_status not null default 'pending',
  -- Pourquoi l'un refuse : le client doit lire autre chose que « refusé ».
  refusal_reason text,

  handled_at timestamptz,
  handled_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reservations is
  'Réservations chez un partenaire : le client demande, le commerçant accepte ou refuse.';

create index if not exists reservations_boutique_idx
  on public.reservations (shop_id, status, desired_at desc);
create index if not exists reservations_client_idx
  on public.reservations (user_id, created_at desc);

alter table public.reservations enable row level security;
alter table public.reservations force row level security;

drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select using (
    user_id = auth.uid() or public.owns_shop(shop_id) or public.is_admin()
  );

-- On ne réserve que pour soi, et que dans une boutique ouverte aux
-- réservations : sinon le commerçant reçoit des demandes qu'il n'attend pas.
drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations
  for insert with check (
    user_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.status = 'approved' and s.accepts_reservations
    )
  );

-- Le client annule la sienne tant qu'elle attend ; le commerçant décide.
drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations
  for update using (
    public.owns_shop(shop_id) or public.is_admin()
    or (user_id = auth.uid() and status = 'pending')
  ) with check (
    public.owns_shop(shop_id) or public.is_admin()
    or (user_id = auth.uid() and status = 'cancelled')
  );

drop policy if exists reservations_delete on public.reservations;
create policy reservations_delete on public.reservations
  for delete using (public.is_admin());

drop trigger if exists trg_reservations_touch on public.reservations;
create trigger trg_reservations_touch
  before update on public.reservations
  for each row execute function public.touch_updated_at();

/* ═══════════════════════════════════════════════════════════════════════
   3 · SOCIÉTÉ DAHMANI — LELMA3ARDH
   ═══════════════════════════════════════════════════════════════════════ */

-- Le rôle `dahmani_admin` arrive par la migration précédente : PostgreSQL
-- refuse qu'une valeur d'énumération serve dans la transaction qui l'ajoute.
-- Il n'hérite de rien — `is_admin()` ne le reconnaît pas. Ce qu'il peut, il
-- le peut par les politiques écrites plus bas, une par une.

create table if not exists public.expos (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,
  name text not null,
  name_ar text,
  description text,
  description_ar text,

  place text,
  cover_url text,

  starts_on date not null,
  ends_on   date not null,

  is_published boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expos_fenetre check (ends_on >= starts_on)
);

comment on table public.expos is
  'Une édition de l''exposition : un lieu, des dates, des exposants.';

create table if not exists public.expo_exhibitors (
  id uuid primary key default gen_random_uuid(),

  expo_id uuid not null references public.expos (id) on delete cascade,

  slug text not null unique,
  name text not null,
  name_ar text,
  description text,
  description_ar text,

  logo_url text,
  cover_url text,
  -- Les photos du stand. Même plafond que Free Shop : au-delà, personne ne
  -- fait défiler.
  images text[] not null default '{}',

  stand_no text,
  phone text,
  whatsapp text,
  facebook_url text,
  instagram text,
  address text,
  latitude double precision,
  longitude double precision,

  -- Approuvé par l'administration Dahmani avant d'être public.
  status public.shop_status not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expo_exhibitors_photos check (coalesce(array_length(images, 1), 0) <= 8)
);

comment on table public.expo_exhibitors is
  'Le stand d''un exposant, devenu vitrine permanente une fois l''exposition finie.';

create index if not exists expo_exhibitors_expo_idx
  on public.expo_exhibitors (expo_id, status, name);

create table if not exists public.expo_products (
  id uuid primary key default gen_random_uuid(),

  exhibitor_id uuid not null references public.expo_exhibitors (id) on delete cascade,

  name text not null check (btrim(name) <> ''),
  name_ar text,
  description text,
  description_ar text,

  images text[] not null default '{}',

  price numeric(10, 2) check (price is null or price >= 0),
  -- Le prix barré : la promotion d'un exposant, sans machinerie de campagne.
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),

  category_id uuid references public.categories (id) on delete set null,

  is_available boolean not null default true,
  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expo_products_photos check (coalesce(array_length(images, 1), 0) <= 6),
  -- Un prix barré au-dessous du prix courant n'est pas une promotion.
  constraint expo_products_promo check (
    compare_at_price is null or price is null or compare_at_price > price
  )
);

create index if not exists expo_products_exposant_idx
  on public.expo_products (exhibitor_id, position, created_at);

/* ─── Qui est administrateur de Lelma3ardh ───────────────────────────── */
create or replace function public.is_dahmani_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role in ('dahmani_admin', 'admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.is_dahmani_admin() is
  'Vrai pour l''administration Dahmani et pour l''administration générale, qui garde tous les droits.';

alter table public.expos            enable row level security;
alter table public.expos            force  row level security;
alter table public.expo_exhibitors  enable row level security;
alter table public.expo_exhibitors  force  row level security;
alter table public.expo_products    enable row level security;
alter table public.expo_products    force  row level security;

-- Le public lit ce qui est publié ; l'administration Dahmani lit et écrit
-- tout, mais seulement ici. Rien dans ces politiques ne lui ouvre les
-- boutiques, les chauffeurs, les membres ni les réglages.
drop policy if exists expos_select on public.expos;
create policy expos_select on public.expos
  for select using (is_published or public.is_dahmani_admin());

drop policy if exists expos_ecrire on public.expos;
create policy expos_ecrire on public.expos
  for all using (public.is_dahmani_admin()) with check (public.is_dahmani_admin());

drop policy if exists expo_exhibitors_select on public.expo_exhibitors;
create policy expo_exhibitors_select on public.expo_exhibitors
  for select using (
    public.is_dahmani_admin()
    or (
      status = 'approved'
      and exists (select 1 from public.expos e where e.id = expo_id and e.is_published)
    )
  );

drop policy if exists expo_exhibitors_ecrire on public.expo_exhibitors;
create policy expo_exhibitors_ecrire on public.expo_exhibitors
  for all using (public.is_dahmani_admin()) with check (public.is_dahmani_admin());

drop policy if exists expo_products_select on public.expo_products;
create policy expo_products_select on public.expo_products
  for select using (
    public.is_dahmani_admin()
    or exists (
      select 1
      from public.expo_exhibitors x
      join public.expos e on e.id = x.expo_id
      where x.id = exhibitor_id and x.status = 'approved' and e.is_published
    )
  );

drop policy if exists expo_products_ecrire on public.expo_products;
create policy expo_products_ecrire on public.expo_products
  for all using (public.is_dahmani_admin()) with check (public.is_dahmani_admin());

drop trigger if exists trg_expos_touch on public.expos;
create trigger trg_expos_touch before update on public.expos
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_expo_exhibitors_touch on public.expo_exhibitors;
create trigger trg_expo_exhibitors_touch before update on public.expo_exhibitors
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_expo_products_touch on public.expo_products;
create trigger trg_expo_products_touch before update on public.expo_products
  for each row execute function public.touch_updated_at();

/* ─── Les droits de table ────────────────────────────────────────────── */
grant select on public.expos, public.expo_exhibitors, public.expo_products to anon, authenticated;
grant insert, update, delete on public.expos, public.expo_exhibitors, public.expo_products to authenticated;
grant select, insert, update on public.reservations to authenticated;
grant delete on public.reservations to authenticated;
