-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 03 · Fonctions et triggers
-- Toute fonction SECURITY DEFINER fixe `search_path` : sans cela un rôle
-- appelant peut détourner la résolution de noms.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Utilitaires ───────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','shops','products','orders','lives','deals','cart_items','service_requests'
  ] loop
    execute format('drop trigger if exists trg_%1$s_touch on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_touch before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Rôle de l'appelant, lu sans déclencher les policies de `profiles`
-- (sinon récursion infinie : une policy de profiles interrogerait profiles).
create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Boutique approuvée appartenant à l'appelant (null s'il n'est pas vendeur).
create or replace function public.my_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.shops where owner_id = auth.uid();
$$;

create or replace function public.owns_shop(target_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.shops
    where id = target_shop_id and owner_id = auth.uid()
  );
$$;

-- Slug ASCII stable, désaccentué. « Café Oasis » → « cafe-oasis ».
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(extensions.unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- ─── Création de compte ────────────────────────────────────────────────
-- Écran 13 : un seul écran pour client et vendeur. Le rôle et les deux
-- champs boutique arrivent dans raw_user_meta_data à l'inscription.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta            jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted_role     public.user_role;
  shop_name       text := nullif(btrim(meta ->> 'shop_name'), '');
  shop_location   text := nullif(btrim(meta ->> 'shop_location'), '');
  base_slug       text;
  final_slug      text;
  suffix          integer := 0;
  referrer        uuid;
begin
  -- Le rôle `admin` ne peut jamais être auto-attribué depuis le client.
  wanted_role := case
    when (meta ->> 'role') = 'vendor' then 'vendor'::public.user_role
    else 'client'::public.user_role
  end;

  select id into referrer
  from public.profiles
  where referral_code = upper(nullif(btrim(meta ->> 'referral_code'), ''));

  insert into public.profiles (
    id, role, first_name, last_name, phone, avatar_url, locale, referral_code, referred_by
  )
  values (
    new.id,
    wanted_role,
    coalesce(nullif(btrim(meta ->> 'first_name'), ''), split_part(coalesce(meta ->> 'full_name', meta ->> 'name', ''), ' ', 1)),
    coalesce(nullif(btrim(meta ->> 'last_name'), ''),  nullif(substr(coalesce(meta ->> 'full_name', meta ->> 'name', ''), strpos(coalesce(meta ->> 'full_name', meta ->> 'name', ''), ' ') + 1), '')),
    nullif(btrim(coalesce(meta ->> 'phone', new.phone)), ''),
    nullif(btrim(coalesce(meta ->> 'avatar_url', meta ->> 'picture')), ''),
    case when (meta ->> 'locale') = 'ar' then 'ar'::public.app_locale else 'fr'::public.app_locale end,
    upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8)),
    referrer
  )
  on conflict (id) do nothing;

  if referrer is not null then
    insert into public.referrals (referrer_id, referred_id)
    values (referrer, new.id)
    on conflict (referred_id) do nothing;
  end if;

  -- Vendeur : la boutique est créée immédiatement en `pending`. Il peut la
  -- préparer tout de suite ; elle devient visible à l'approbation admin.
  if wanted_role = 'vendor' and shop_name is not null then
    base_slug := public.slugify(shop_name);
    if base_slug = '' then base_slug := 'boutique'; end if;
    final_slug := base_slug;

    while exists (select 1 from public.shops where slug = final_slug) loop
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix;
    end loop;

    insert into public.shops (owner_id, slug, name, address, status)
    values (new.id, final_slug, shop_name, shop_location, 'pending')
    on conflict (owner_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Fidélité ──────────────────────────────────────────────────────────

create or replace function public.award_points(
  target_user uuid, amount integer, why text, ref_kind text default null, ref uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if amount = 0 or target_user is null then
    return;
  end if;

  insert into public.loyalty_transactions (user_id, points, reason, ref_type, ref_id)
  values (target_user, amount, why, ref_kind, ref);

  update public.profiles
  set loyalty_points = greatest(0, loyalty_points + amount)
  where id = target_user;
end;
$$;

-- ─── Compteurs boutique ────────────────────────────────────────────────

create or replace function public.sync_shop_followers()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.shops set followers_count = followers_count + 1 where id = new.shop_id;
  else
    update public.shops set followers_count = greatest(0, followers_count - 1) where id = old.shop_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_shop_follows_count on public.shop_follows;
create trigger trg_shop_follows_count
  after insert or delete on public.shop_follows
  for each row execute function public.sync_shop_followers();

create or replace function public.sync_shop_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.shops
    set rating_sum = rating_sum + new.rating, rating_count = rating_count + 1
    where id = new.shop_id;
  elsif tg_op = 'UPDATE' then
    update public.shops
    set rating_sum = rating_sum - old.rating + new.rating
    where id = new.shop_id;
  else
    update public.shops
    set rating_sum = greatest(0, rating_sum - old.rating),
        rating_count = greatest(0, rating_count - 1)
    where id = old.shop_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_reviews_rating on public.reviews;
create trigger trg_reviews_rating
  after insert or update or delete on public.reviews
  for each row execute function public.sync_shop_rating();

-- ─── Bons plans : votes et vérification ────────────────────────────────
-- Règle métier du handoff : trois confirmations « Ça marche » ⇒ badge
-- « Vérifié » et 20 points à l'auteur, une seule fois.

create or replace function public.sync_deal_votes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target       uuid := coalesce(new.deal_id, old.deal_id);
  ups          integer;
  downs        integer;
  deal_author  uuid;
  already      boolean;
begin
  select count(*) filter (where value = 1), count(*) filter (where value = -1)
  into ups, downs
  from public.deal_votes where deal_id = target;

  update public.deals
  set upvotes = ups, downvotes = downs
  where id = target
  returning author_id, is_verified into deal_author, already;

  if ups >= 3 and not coalesce(already, true) then
    update public.deals
    set is_verified = true, verified_at = now()
    where id = target and not is_verified;

    if found then
      perform public.award_points(deal_author, 20, 'Bon plan vérifié', 'deal', target);

      insert into public.notifications (user_id, kind, title, body, link)
      values (
        deal_author, 'deal_verified',
        'Votre bon plan est vérifié',
        'Trois membres l''ont confirmé. Vous gagnez 20 points.',
        '/bons-plans/' || target
      );
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_deal_votes_sync on public.deal_votes;
create trigger trg_deal_votes_sync
  after insert or update or delete on public.deal_votes
  for each row execute function public.sync_deal_votes();

create or replace function public.sync_deal_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.deals set comments_count = comments_count + 1 where id = new.deal_id;
  else
    update public.deals set comments_count = greatest(0, comments_count - 1) where id = old.deal_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_deal_comments_count on public.deal_comments;
create trigger trg_deal_comments_count
  after insert or delete on public.deal_comments
  for each row execute function public.sync_deal_comments_count();

-- Compteur de signalements + remontée automatique à l'écran admin.
create or replace function public.sync_reports_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.target_type = 'deal' then
    update public.deals
    set reports_count = (
      select count(*) from public.reports
      where target_type = 'deal' and target_id = new.target_id and status = 'open'
    )
    where id = new.target_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_reports_count on public.reports;
create trigger trg_reports_count
  after insert or update on public.reports
  for each row execute function public.sync_reports_count();

-- ─── Lives ─────────────────────────────────────────────────────────────

create or replace function public.sync_live_likes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.lives set likes_count = likes_count + 1 where id = new.live_id;
  else
    update public.lives set likes_count = greatest(0, likes_count - 1) where id = old.live_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_live_likes_count on public.live_likes;
create trigger trg_live_likes_count
  after insert or delete on public.live_likes
  for each row execute function public.sync_live_likes();

-- Appelée par le client à intervalle régulier depuis le canal Presence.
create or replace function public.set_live_viewers(target_live uuid, count_now integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.lives
  set viewers_count = greatest(0, count_now),
      peak_viewers  = greatest(peak_viewers, greatest(0, count_now))
  where id = target_live and status = 'live';
end;
$$;

-- Le vendeur passe son live à l'antenne. `peer` n'est renseigné qu'en
-- source `camera` : c'est l'identifiant de signalisation WebRTC.
create or replace function public.start_live(target_live uuid, peer text default null)
returns public.lives
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.lives;
begin
  update public.lives
  set status = 'live',
      started_at = coalesce(started_at, now()),
      broadcaster_peer_id = peer
  where id = target_live
    and public.owns_shop(shop_id)
    and status in ('scheduled', 'live')
  returning * into result;

  if result.id is null then
    raise exception 'Live introuvable ou non autorisé' using errcode = '42501';
  end if;

  -- Prévenir les abonnés de la boutique
  insert into public.notifications (user_id, kind, title, body, link)
  select f.user_id, 'live_starting', s.name || ' est en direct', result.title, '/lives/' || result.id
  from public.shop_follows f
  join public.shops s on s.id = f.shop_id
  where f.shop_id = result.shop_id;

  return result;
end;
$$;

create or replace function public.end_live(target_live uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.lives
  set status = 'ended', ended_at = now(), viewers_count = 0, broadcaster_peer_id = null
  where id = target_live and public.owns_shop(shop_id);

  if not found then
    raise exception 'Live introuvable ou non autorisé' using errcode = '42501';
  end if;
end;
$$;

-- ─── Passage de commande ───────────────────────────────────────────────
-- Décrément de stock et création de la commande dans une seule transaction.
-- `for update` sérialise deux acheteurs qui visent la dernière pièce.

create or replace function public.place_order(
  p_shop_id          uuid,
  p_items            jsonb,          -- [{ product_id, quantity, color, size }]
  p_payment_method   public.payment_method default 'cod',
  p_delivery_method  public.delivery_method default 'delivery',
  p_contact_phone    text default null,
  p_delivery_address text default null,
  p_note             text default null,
  p_live_id          uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  buyer         uuid := auth.uid();
  item          jsonb;
  prod          public.products;
  qty           integer;
  unit          numeric(10,3);
  running_total numeric(10,3) := 0;
  new_order     public.orders;
  live_discount smallint := 0;
  order_ref     text;
begin
  if buyer is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Panier vide' using errcode = '22023';
  end if;

  if not exists (select 1 from public.shops where id = p_shop_id and status = 'approved') then
    raise exception 'Boutique indisponible' using errcode = '22023';
  end if;

  -- Remise « prix live » si la commande part d'un direct en cours
  if p_live_id is not null then
    select coalesce(live_percent_off, 0) into live_discount
    from public.lives
    where id = p_live_id
      and status = 'live'
      and (offer_ends_at is null or offer_ends_at > now());
    live_discount := coalesce(live_discount, 0);
  end if;

  order_ref := 'MEG-' || to_char(now(), 'YYMMDD') || '-' ||
               upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 5));

  insert into public.orders (
    order_number, user_id, shop_id, live_id, status,
    payment_method, delivery_method,
    subtotal, total, contact_phone, delivery_address, note
  )
  values (
    order_ref, buyer, p_shop_id, p_live_id, 'pending',
    p_payment_method, p_delivery_method,
    0, 0,
    coalesce(p_contact_phone, (select phone from public.profiles where id = buyer), ''),
    p_delivery_address, p_note
  )
  returning * into new_order;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := greatest(1, coalesce((item ->> 'quantity')::integer, 1));

    select * into prod
    from public.products
    where id = (item ->> 'product_id')::uuid
      and shop_id = p_shop_id
      and is_online
      and not is_draft
    for update;

    if prod.id is null then
      raise exception 'Produit indisponible' using errcode = '22023';
    end if;

    if prod.stock < qty then
      raise exception 'Stock insuffisant pour %  (reste %)', prod.name, prod.stock
        using errcode = '22023';
    end if;

    unit := round(prod.price * (100 - live_discount) / 100.0, 3);
    running_total := running_total + unit * qty;

    insert into public.order_items (
      order_id, product_id, product_name, product_image, unit_price, quantity, color, size
    )
    values (
      new_order.id, prod.id, prod.name,
      case when array_length(prod.images, 1) > 0 then prod.images[1] end,
      unit, qty, nullif(item ->> 'color', ''), nullif(item ->> 'size', '')
    );

    update public.products
    set stock = stock - qty, sold_count = sold_count + qty
    where id = prod.id;
  end loop;

  update public.orders
  set subtotal = running_total,
      total = running_total + delivery_fee - discount
  where id = new_order.id
  returning * into new_order;

  -- Le panier ne garde que ce qui n'a pas été commandé.
  delete from public.cart_items
  where user_id = buyer
    and product_id in (
      select (i ->> 'product_id')::uuid from jsonb_array_elements(p_items) i
    );

  if p_live_id is not null then
    update public.lives set purchases_count = purchases_count + 1 where id = p_live_id;
  end if;

  -- 1 point par dinar dépensé
  perform public.award_points(buyer, floor(new_order.total)::integer, 'Achat', 'order', new_order.id);

  insert into public.notifications (user_id, kind, title, body, link)
  select s.owner_id, 'order_update', 'Nouvelle commande', new_order.order_number, '/vendeur/commandes'
  from public.shops s where s.id = p_shop_id;

  return new_order;
end;
$$;

-- ─── Approbation des boutiques (écran 14) ──────────────────────────────

create or replace function public.approve_shop(target_shop uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare owner uuid;
begin
  if not public.is_admin() then
    raise exception 'Réservé à l''administration' using errcode = '42501';
  end if;

  update public.shops
  set status = 'approved', approved_at = now(), approved_by = auth.uid(),
      rejection_reason = null, missing_document = null
  where id = target_shop
  returning owner_id into owner;

  if owner is null then
    raise exception 'Boutique introuvable' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (owner, 'shop_approved', 'Votre boutique est en ligne',
          'Elle est désormais visible par tous les visiteurs.', '/vendeur');

  -- Le parrain touche ses 50 points quand le filleul devient actif.
  update public.referrals r
  set validated_at = now(), points_awarded = 50
  where r.referred_id = owner and r.validated_at is null;

  if found then
    perform public.award_points(
      (select referrer_id from public.referrals where referred_id = owner),
      50, 'Parrainage validé', 'referral', owner
    );
  end if;
end;
$$;

create or replace function public.reject_shop(target_shop uuid, reason text, missing_doc text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare owner uuid;
begin
  if not public.is_admin() then
    raise exception 'Réservé à l''administration' using errcode = '42501';
  end if;

  update public.shops
  set status = case when missing_doc is not null then 'pending' else 'rejected' end,
      rejection_reason = reason,
      missing_document = missing_doc
  where id = target_shop
  returning owner_id into owner;

  insert into public.notifications (user_id, kind, title, body, link)
  values (owner, 'shop_rejected',
          coalesce('Document manquant : ' || missing_doc, 'Dossier à compléter'),
          reason, '/vendeur/reglages');
end;
$$;

-- ─── Expiration des bons plans ─────────────────────────────────────────
-- Appelée par /api/cron/expire-deals (Vercel Cron) ou par pg_cron.

create or replace function public.expire_stale_deals()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare affected integer;
begin
  update public.deals
  set status = 'expired'
  where status = 'active' and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ─── Ouverture des boutiques ───────────────────────────────────────────
-- Recalcule `is_open_now` à partir de shop_hours. Heure de Tunis (UTC+1,
-- pas d'heure d'été depuis 2009).

create or replace function public.refresh_shops_open_state()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected  integer;
  local_now timestamp := (now() at time zone 'Africa/Tunis');
  dow       smallint  := ((extract(isodow from local_now)::integer + 6) % 7)::smallint; -- 0 = lundi
  t         time      := local_now::time;
begin
  update public.shops s
  set is_open_now = coalesce((
    select not h.is_closed and t >= h.opens_at and t < h.closes_at
    from public.shop_hours h
    where h.shop_id = s.id and h.weekday = dow
  ), false)
  where s.status = 'approved';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ─── Recherche plein texte simple (barre de recherche écrans 1, 2, 9) ──

create or replace function public.search_catalog(q text, limit_count integer default 20)
returns table (
  kind        text,
  id          uuid,
  title       text,
  subtitle    text,
  image       text,
  price       numeric,
  slug        text,
  hue         smallint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with needle as (select extensions.unaccent(lower(btrim(coalesce(q, '')))) as v)
  (
    select 'product'::text, p.id, p.name, s.name,
           case when array_length(p.images,1) > 0 then p.images[1] end,
           p.price, s.slug, c.hue
    from public.products p
    join public.shops s on s.id = p.shop_id
    left join public.categories c on c.id = p.category_id, needle
    where s.status = 'approved' and p.is_online and not p.is_draft
      and needle.v <> ''
      and extensions.unaccent(lower(p.name)) like '%' || needle.v || '%'
    order by p.sold_count desc
    limit limit_count
  )
  union all
  (
    select 'shop'::text, s.id, s.name, c.name_fr, s.logo_url, null::numeric, s.slug, c.hue
    from public.shops s
    left join public.categories c on c.id = s.category_id, needle
    where s.status = 'approved'
      and needle.v <> ''
      and extensions.unaccent(lower(s.name)) like '%' || needle.v || '%'
    order by s.followers_count desc
    limit limit_count
  );
$$;
