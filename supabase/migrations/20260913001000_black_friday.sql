-- Black Friday : une campagne de vingt-quatre heures, des prix par produit.
--
-- ════════════════════════════════════════════════════════════════════════
-- Pourquoi une table d'offres, et pas les promotions existantes
-- ════════════════════════════════════════════════════════════════════════
--
-- `promotions` porte une remise **par boutique** — « −10 % sur tout » — et
-- `products.compare_at_price` un prix barré permanent. Le Black Friday
-- demande autre chose : un prix **par produit**, choisi par le commerçant,
-- valable vingt-quatre heures et pas une de plus. Aucune des deux structures
-- ne sait l'exprimer sans perdre ce qu'elle exprime déjà.
--
-- ════════════════════════════════════════════════════════════════════════
-- Où se décide le prix, et pourquoi c'est l'essentiel de ce fichier
-- ════════════════════════════════════════════════════════════════════════
--
-- Afficher 149 DT et facturer 250 DT serait le pire défaut possible pour une
-- opération commerciale : c'est exactement la catégorie « prix affiché ≠ prix
-- enregistré » que l'audit du 7 septembre vérifiait. Le prix Black Friday est
-- donc appliqué **par `place_order`**, dans la transaction de la commande,
-- d'après l'heure du serveur. Le navigateur ne transmet toujours aucun prix.
--
-- ════════════════════════════════════════════════════════════════════════
-- Le statut n'est pas stocké : il est calculé
-- ════════════════════════════════════════════════════════════════════════
--
-- « En préparation », « programmé », « actif », « terminé » se déduisent de
-- deux faits : l'offre est-elle activée, et où en est l'horloge par rapport à
-- la fenêtre de la campagne. Stocker le statut obligerait une tâche
-- périodique à le faire passer d'« actif » à « terminé » à 00:01 — et le jour
-- où elle ne passe pas (le cron de ce projet a déjà tourné une fois par jour
-- au lieu de toutes les quinze minutes), des offres resteraient actives après
-- la fin. Un statut calculé ne peut pas être en retard.

/* ─── 1 · La campagne ─────────────────────────────────────────────────── */

create table if not exists public.black_friday_campaigns (
  id uuid primary key default gen_random_uuid(),

  -- Le vendredi de la campagne. Un vendredi, et rien d'autre : la contrainte
  -- l'impose plutôt que de laisser une date mal saisie ouvrir une campagne un
  -- mardi.
  friday_date date not null unique
    check (extract(isodow from friday_date) = 5),

  -- Calculées par le déclencheur ci-dessous, jamais saisies à la main.
  starts_at timestamptz not null,
  ends_at   timestamptz not null,

  -- L'interrupteur global de l'administration.
  is_enabled boolean not null default true,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint black_friday_fenetre check (ends_at > starts_at)
);

comment on table public.black_friday_campaigns is
  'Une campagne Black Friday par vendredi : de 00:01 le vendredi à 00:01 le samedi, heure de Tunis.';

/*
  La fenêtre se déduit du vendredi, heure de Tunis.

  `(date + time) at time zone 'Africa/Tunis'` lit l'heure comme locale et rend
  l'instant absolu correspondant. La Tunisie n'a plus d'heure d'été depuis 2009
  — UTC+1 toute l'année —, mais on laisse Postgres le savoir plutôt que
  d'écrire « +1 » en dur : si la règle revenait, la fenêtre suivrait.
*/
create or replace function public.black_friday_fenetre()
returns trigger
language plpgsql
as $$
begin
  new.starts_at := (new.friday_date + time '00:01') at time zone 'Africa/Tunis';
  new.ends_at   := new.starts_at + interval '24 hours';
  return new;
end;
$$;

drop trigger if exists trg_black_friday_fenetre on public.black_friday_campaigns;
create trigger trg_black_friday_fenetre
  before insert or update of friday_date on public.black_friday_campaigns
  for each row execute function public.black_friday_fenetre();

alter table public.black_friday_campaigns enable row level security;

-- Les dates ne sont pas un secret : le compte à rebours de l'accueil en a
-- besoin pour tout le monde, visiteurs compris.
drop policy if exists bf_campaigns_select on public.black_friday_campaigns;
create policy bf_campaigns_select on public.black_friday_campaigns
  for select using (true);

drop policy if exists bf_campaigns_admin on public.black_friday_campaigns;
create policy bf_campaigns_admin on public.black_friday_campaigns
  for all using (public.is_admin()) with check (public.is_admin());

/* ─── 2 · Les offres ──────────────────────────────────────────────────── */

create table if not exists public.black_friday_offers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.black_friday_campaigns (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,

  /*
    Recopié du produit par le déclencheur, jamais accepté du navigateur.

    Il sert à la policy et aux statistiques ; le laisser saisir permettrait à
    un commerçant de rattacher une offre à la boutique d'un autre.
  */
  shop_id uuid not null references public.shops (id) on delete cascade,

  bf_price numeric(10,3) not null check (bf_price > 0),

  -- Faux tant que le commerçant ne l'a pas activée : « en préparation ».
  is_enabled boolean not null default false,

  -- Le retrait par l'administration. Le commerçant ne peut ni le poser ni
  -- l'enlever ; la note lui dit pourquoi.
  is_moderated boolean not null default false,
  moderation_note text,

  -- Combien de fois l'offre a été partagée, pour le tableau de bord.
  shares_count integer not null default 0 check (shares_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Une offre par produit et par campagne.
  constraint black_friday_offre_unique unique (campaign_id, product_id)
);

create index if not exists bf_offers_campaign_idx on public.black_friday_offers (campaign_id, is_enabled);
create index if not exists bf_offers_product_idx on public.black_friday_offers (product_id);
create index if not exists bf_offers_shop_idx on public.black_friday_offers (shop_id);

/*
  Les règles que le navigateur ne décide pas.

  Toutes côté base, parce que la Server Action n'est pas la seule porte : le
  commerçant possède une session et la clé publique, il peut écrire par
  PostgREST en direct. C'est la leçon de SEC-01, où la machine d'états de
  course n'était gardée que dans le code TypeScript.
*/
create or replace function public.black_friday_garde()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prod public.products;
  camp public.black_friday_campaigns;
  cible public.black_friday_offers;
  privilegie boolean := public.is_admin() or public.is_service_context();
begin
  cible := case when tg_op = 'DELETE' then old else new end;

  select * into camp from public.black_friday_campaigns where id = cible.campaign_id;
  if camp.id is null then
    raise exception 'Campagne introuvable' using errcode = 'P0001';
  end if;

  /*
    Une campagne terminée ne se réécrit pas.

    Ni ajout, ni modification, ni suppression : ce qui a été vendu à un prix
    doit continuer de dire à quel prix. L'administration elle-même n'y touche
    que par la modération, qui ne change pas le prix.
  */
  if now() >= camp.ends_at and not privilegie then
    raise exception 'La campagne Black Friday est terminée : les offres ne peuvent plus être modifiées.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select * into prod from public.products where id = new.product_id;
  if prod.id is null then
    raise exception 'Produit introuvable' using errcode = 'P0001';
  end if;

  -- La boutique vient du produit, quoi qu'on ait envoyé.
  new.shop_id := prod.shop_id;

  if not privilegie and not public.owns_shop(prod.shop_id) then
    raise exception 'Ce produit n''appartient pas à votre boutique.' using errcode = 'P0001';
  end if;

  /*
    Un prix Black Friday est un prix plus bas.

    Sinon ce n'est pas une offre, c'est une étiquette trompeuse — et
    `place_order` retient de toute façon le plus bas des deux, donc une offre
    plus chère n'aurait d'autre effet que d'afficher un faux rabais.
  */
  if new.bf_price >= prod.price then
    raise exception 'Le prix Black Friday doit être inférieur au prix normal (% DT).', prod.price
      using errcode = 'P0001';
  end if;

  -- La modération appartient à l'administration.
  if not privilegie then
    if tg_op = 'INSERT' then
      new.is_moderated := false;
      new.moderation_note := null;
      new.shares_count := 0;
    else
      new.is_moderated := old.is_moderated;
      new.moderation_note := old.moderation_note;
      new.shares_count := old.shares_count;
      new.campaign_id := old.campaign_id;
      new.product_id := old.product_id;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_black_friday_garde on public.black_friday_offers;
create trigger trg_black_friday_garde
  before insert or update or delete on public.black_friday_offers
  for each row execute function public.black_friday_garde();

alter table public.black_friday_offers enable row level security;

/*
  Qui voit quelle offre.

  Le commerçant voit les siennes, l'administration toutes. Le public ne voit
  que celles qui sont **en vigueur à l'heure du serveur** : activées, non
  modérées, campagne activée, et `now()` dans la fenêtre. C'est ici que la
  règle des vingt-quatre heures devient impossible à contourner — une offre
  n'est pas masquée par l'écran à 00:01 samedi, elle cesse d'exister pour le
  visiteur.
*/
drop policy if exists bf_offers_select on public.black_friday_offers;
create policy bf_offers_select on public.black_friday_offers
  for select using (
    public.owns_shop(shop_id)
    or public.is_admin()
    or (
      is_enabled
      and not is_moderated
      and exists (
        select 1 from public.black_friday_campaigns c
        where c.id = campaign_id
          and c.is_enabled
          and now() >= c.starts_at
          and now() < c.ends_at
      )
    )
  );

drop policy if exists bf_offers_owner on public.black_friday_offers;
create policy bf_offers_owner on public.black_friday_offers
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

/* ─── 3 · L'état de la campagne, à l'heure du serveur ─────────────────── */

/*
  Ce que le compte à rebours affiche, et l'heure qu'il est vraiment.

  Le navigateur ne décide pas si une offre est active — la policy s'en charge.
  Mais il affiche un décompte, et une horloge de téléphone en avance de dix
  minutes annoncerait « terminé » à des clients qui peuvent encore acheter.
  `now` est donc rendu avec le reste : l'écran calcule son décalage une fois
  et s'aligne sur le serveur.

  La campagne retenue : celle en cours, sinon la prochaine activée, sinon la
  dernière terminée.
*/
create or replace function public.black_friday_etat()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with retenue as (
    select c.*,
      case
        when now() >= c.starts_at and now() < c.ends_at then 0
        when now() < c.starts_at then 1
        else 2
      end as rang
    from public.black_friday_campaigns c
    where c.is_enabled
    order by rang,
      case when now() < c.starts_at then c.starts_at end asc,
      c.ends_at desc
    limit 1
  )
  select jsonb_build_object(
    'now', now(),
    'campagne', (
      select jsonb_build_object(
        'id', r.id,
        'friday_date', r.friday_date,
        'starts_at', r.starts_at,
        'ends_at', r.ends_at,
        'phase', case r.rang when 0 then 'actif' when 1 then 'avant' else 'termine' end
      )
      from retenue r
    )
  );
$$;

grant execute on function public.black_friday_etat() to anon, authenticated;

/* ─── 4 · Compter un partage ──────────────────────────────────────────── */

/*
  Ouverte à tous, visiteurs compris : partager ne demande pas de compte.
  Elle n'incrémente qu'une offre en vigueur, d'une unité — pas de quoi en
  fabriquer un classement sans y passer la journée.
*/
create or replace function public.black_friday_partage(p_offre uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.black_friday_offers o
  set shares_count = shares_count + 1
  where o.id = p_offre
    and o.is_enabled
    and not o.is_moderated
    and exists (
      select 1 from public.black_friday_campaigns c
      where c.id = o.campaign_id and c.is_enabled
        and now() >= c.starts_at and now() < c.ends_at
    );
$$;

grant execute on function public.black_friday_partage(uuid) to anon, authenticated;

/* ─── 5 · `place_order`, avec le prix Black Friday ────────────────────── */

/*
  La fonction d'origine, recopiée mot pour mot, plus quatre lignes.

  C'est la fonction la plus sensible du schéma : prix, stock et remise live
  dans une seule transaction, avec verrouillage de la dernière pièce. Rien
  n'y change que ceci — pour chaque article, on cherche une offre en vigueur
  **à l'heure du serveur**, et le prix unitaire retenu est le plus bas des
  deux : le prix normal (remise live comprise) ou le prix Black Friday.

  « Le plus bas », et non « le Black Friday » : une remise live de 40 % ne
  doit pas être annulée par une offre Black Friday de 20 %. Le client paie le
  meilleur prix auquel il a droit, jamais un moins bon.

  La signature est inchangée : `create or replace` conserve les droits
  d'exécution accordés par la migration 04.
*/
create or replace function public.place_order(
  p_shop_id          uuid,
  p_items            jsonb,
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
  prix_bf       numeric(10,3);
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

    -- ─── Ajout Black Friday ───────────────────────────────────────────
    prix_bf := null;
    select o.bf_price into prix_bf
    from public.black_friday_offers o
    join public.black_friday_campaigns c on c.id = o.campaign_id
    where o.product_id = prod.id
      and o.is_enabled
      and not o.is_moderated
      and c.is_enabled
      and now() >= c.starts_at
      and now() < c.ends_at
    order by o.bf_price asc
    limit 1;

    if prix_bf is not null and prix_bf < unit then
      unit := prix_bf;
    end if;
    -- ──────────────────────────────────────────────────────────────────

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

/* ─── Reprise ──────────────────────────────────────────────────────────

   Additif, à une exception près : `place_order` est remplacée. Sa version
   d'origine est dans `20260809000300_functions_triggers.sql` ; la rejouer
   rétablit exactement le comportement antérieur.

   Marche arrière :
     -- rejouer la définition de place_order de 20260809000300
     drop function public.black_friday_partage(uuid);
     drop function public.black_friday_etat();
     drop table public.black_friday_offers;
     drop table public.black_friday_campaigns;
     drop function public.black_friday_garde();
     drop function public.black_friday_fenetre();
*/
