-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 04 · Row Level Security
--
-- Principe : RLS activée partout, aucune policy permissive par défaut.
-- Le navigateur n'utilise que la clé `anon` ; tout ce qui suit est donc la
-- seule barrière réelle entre un visiteur et les données.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','shops','shop_hours','shop_categories','shop_follows',
    'products','promotions','favorites','cart_items','reviews',
    'orders','order_items','lives','live_comments','live_likes',
    'deals','deal_votes','deal_comments','reports',
    'conversations','messages','notifications',
    'loyalty_transactions','referrals','sponsored_slots',
    'city_infos','city_alerts','practical_services','prayer_times',
    'pharmacies_on_duty','service_requests'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ─── profiles ──────────────────────────────────────────────────────────
-- Un profil est public en lecture : le nom et l'avatar de l'auteur d'un bon
-- plan ou d'un commentaire doivent être lisibles par tous.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Le rôle et les points ne sont pas modifiables par leur porteur : un client
-- ne se promeut pas vendeur ni admin, et ne s'offre pas de points.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.role           := old.role;
  new.loyalty_points := old.loyalty_points;
  new.is_banned      := old.is_banned;
  new.referral_code  := old.referral_code;
  new.referred_by    := old.referred_by;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ─── categories · référentiel public ───────────────────────────────────

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select using (is_active or public.is_admin());

drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── shops ─────────────────────────────────────────────────────────────

drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops
  for select using (
    status = 'approved' or owner_id = auth.uid() or public.is_admin()
  );

-- La boutique est créée par handle_new_user ; cette policy couvre le cas
-- d'un client qui passe vendeur plus tard.
drop policy if exists shops_insert_own on public.shops;
create policy shops_insert_own on public.shops
  for insert with check (owner_id = auth.uid());

drop policy if exists shops_update_own on public.shops;
create policy shops_update_own on public.shops
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists shops_admin on public.shops;
create policy shops_admin on public.shops
  for all using (public.is_admin()) with check (public.is_admin());

-- Un vendeur ne s'auto-approuve pas et ne se met pas à la une.
create or replace function public.guard_shop_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.status           := old.status;
  new.approved_at      := old.approved_at;
  new.approved_by      := old.approved_by;
  new.is_featured      := old.is_featured;
  new.rejection_reason := old.rejection_reason;
  new.missing_document := old.missing_document;
  new.rating_sum       := old.rating_sum;
  new.rating_count     := old.rating_count;
  new.followers_count  := old.followers_count;
  return new;
end;
$$;

drop trigger if exists trg_shops_guard on public.shops;
create trigger trg_shops_guard
  before update on public.shops
  for each row execute function public.guard_shop_privileges();

-- ─── shop_hours · shop_categories ──────────────────────────────────────

drop policy if exists shop_hours_select on public.shop_hours;
create policy shop_hours_select on public.shop_hours for select using (true);

drop policy if exists shop_hours_owner on public.shop_hours;
create policy shop_hours_owner on public.shop_hours
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

drop policy if exists shop_categories_select on public.shop_categories;
create policy shop_categories_select on public.shop_categories for select using (true);

drop policy if exists shop_categories_owner on public.shop_categories;
create policy shop_categories_owner on public.shop_categories
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

-- ─── shop_follows ──────────────────────────────────────────────────────

drop policy if exists shop_follows_select on public.shop_follows;
create policy shop_follows_select on public.shop_follows
  for select using (user_id = auth.uid() or public.owns_shop(shop_id) or public.is_admin());

drop policy if exists shop_follows_write on public.shop_follows;
create policy shop_follows_write on public.shop_follows
  for insert with check (user_id = auth.uid());

drop policy if exists shop_follows_delete on public.shop_follows;
create policy shop_follows_delete on public.shop_follows
  for delete using (user_id = auth.uid());

-- ─── products ──────────────────────────────────────────────────────────
-- Un brouillon ou un produit hors ligne n'est visible que de son vendeur.

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (
    (
      is_online and not is_draft
      and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    )
    or public.owns_shop(shop_id)
    or public.is_admin()
  );

drop policy if exists products_owner_write on public.products;
create policy products_owner_write on public.products
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

-- ─── promotions ────────────────────────────────────────────────────────

drop policy if exists promotions_select on public.promotions;
create policy promotions_select on public.promotions
  for select using (is_active or public.owns_shop(shop_id) or public.is_admin());

drop policy if exists promotions_owner on public.promotions;
create policy promotions_owner on public.promotions
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

-- ─── favorites · cart_items · strictement privés ───────────────────────

drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists cart_items_own on public.cart_items;
create policy cart_items_own on public.cart_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── reviews ───────────────────────────────────────────────────────────

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select using (true);

drop policy if exists reviews_write_own on public.reviews;
create policy reviews_write_own on public.reviews
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ─── orders ────────────────────────────────────────────────────────────
-- Création par la fonction place_order uniquement (aucune policy INSERT) :
-- le client ne fixe pas lui-même le total ni le stock.

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (
    user_id = auth.uid() or public.owns_shop(shop_id) or public.is_admin()
  );

-- Le vendeur fait avancer le statut ; l'acheteur peut annuler tant que rien
-- n'est parti.
drop policy if exists orders_shop_update on public.orders;
create policy orders_shop_update on public.orders
  for update using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

drop policy if exists orders_buyer_cancel on public.orders;
create policy orders_buyer_cancel on public.orders
  for update using (user_id = auth.uid() and status in ('pending', 'to_prepare'))
  with check (user_id = auth.uid() and status = 'cancelled');

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.owns_shop(o.shop_id) or public.is_admin())
    )
  );

-- ─── lives ─────────────────────────────────────────────────────────────

drop policy if exists lives_select on public.lives;
create policy lives_select on public.lives
  for select using (
    status in ('live', 'scheduled', 'ended') or public.owns_shop(shop_id) or public.is_admin()
  );

drop policy if exists lives_owner on public.lives;
create policy lives_owner on public.lives
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

drop policy if exists live_comments_select on public.live_comments;
create policy live_comments_select on public.live_comments
  for select using (not is_hidden or public.is_admin());

drop policy if exists live_comments_insert on public.live_comments;
create policy live_comments_insert on public.live_comments
  for insert with check (
    user_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
    and exists (select 1 from public.lives l where l.id = live_id and l.status = 'live')
  );

-- Le vendeur du live et l'admin peuvent masquer un commentaire.
drop policy if exists live_comments_moderate on public.live_comments;
create policy live_comments_moderate on public.live_comments
  for update using (
    public.is_admin()
    or exists (select 1 from public.lives l where l.id = live_id and public.owns_shop(l.shop_id))
  )
  with check (true);

drop policy if exists live_comments_delete_own on public.live_comments;
create policy live_comments_delete_own on public.live_comments
  for delete using (user_id = auth.uid() or public.is_admin());

drop policy if exists live_likes_select on public.live_likes;
create policy live_likes_select on public.live_likes for select using (true);

drop policy if exists live_likes_own on public.live_likes;
create policy live_likes_own on public.live_likes
  for insert with check (user_id = auth.uid());

drop policy if exists live_likes_delete on public.live_likes;
create policy live_likes_delete on public.live_likes
  for delete using (user_id = auth.uid());

-- ─── deals (bons plans) ────────────────────────────────────────────────

drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals
  for select using (
    status in ('active', 'expired') or author_id = auth.uid() or public.is_admin()
  );

drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals
  for insert with check (
    author_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
  );

drop policy if exists deals_update_own on public.deals;
create policy deals_update_own on public.deals
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists deals_delete_own on public.deals;
create policy deals_delete_own on public.deals
  for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists deals_admin on public.deals;
create policy deals_admin on public.deals
  for all using (public.is_admin()) with check (public.is_admin());

-- L'auteur ne décerne pas son propre badge « Vérifié » ni ses compteurs.
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
  new.is_verified    := old.is_verified;
  new.verified_at    := old.verified_at;
  new.upvotes        := old.upvotes;
  new.downvotes      := old.downvotes;
  new.comments_count := old.comments_count;
  new.reports_count  := old.reports_count;
  new.author_id      := old.author_id;
  return new;
end;
$$;

drop trigger if exists trg_deals_guard on public.deals;
create trigger trg_deals_guard
  before update on public.deals
  for each row execute function public.guard_deal_privileges();

-- Un membre ne confirme pas son propre bon plan : sinon trois faux comptes
-- suffiraient, mais surtout l'auteur ne doit pas s'auto-vérifier.
drop policy if exists deal_votes_select on public.deal_votes;
create policy deal_votes_select on public.deal_votes for select using (true);

drop policy if exists deal_votes_write on public.deal_votes;
create policy deal_votes_write on public.deal_votes
  for insert with check (
    user_id = auth.uid()
    and not exists (select 1 from public.deals d where d.id = deal_id and d.author_id = auth.uid())
  );

drop policy if exists deal_votes_update on public.deal_votes;
create policy deal_votes_update on public.deal_votes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists deal_votes_delete on public.deal_votes;
create policy deal_votes_delete on public.deal_votes
  for delete using (user_id = auth.uid());

drop policy if exists deal_comments_select on public.deal_comments;
create policy deal_comments_select on public.deal_comments
  for select using (not is_hidden or public.is_admin());

drop policy if exists deal_comments_insert on public.deal_comments;
create policy deal_comments_insert on public.deal_comments
  for insert with check (
    user_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
  );

drop policy if exists deal_comments_delete on public.deal_comments;
create policy deal_comments_delete on public.deal_comments
  for delete using (user_id = auth.uid() or public.is_admin());

drop policy if exists deal_comments_admin on public.deal_comments;
create policy deal_comments_admin on public.deal_comments
  for update using (public.is_admin()) with check (public.is_admin());

-- ─── reports ───────────────────────────────────────────────────────────
-- Signaler oui, relire les signalements non : seul l'admin voit la file.

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (reporter_id = auth.uid());

drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── conversations · messages ──────────────────────────────────────────

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (user_id = auth.uid() or public.owns_shop(shop_id) or public.is_admin());

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (user_id = auth.uid());

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update using (user_id = auth.uid() or public.owns_shop(shop_id))
  with check (user_id = auth.uid() or public.owns_shop(shop_id));

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or public.owns_shop(c.shop_id) or public.is_admin())
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or public.owns_shop(c.shop_id))
    )
  );

drop policy if exists messages_update_read on public.messages;
create policy messages_update_read on public.messages
  for update using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or public.owns_shop(c.shop_id))
    )
  ) with check (true);

-- ─── notifications ─────────────────────────────────────────────────────
-- Écrites par des fonctions SECURITY DEFINER : aucune policy INSERT.

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete using (user_id = auth.uid());

-- ─── fidélité · parrainage · lecture seule côté client ─────────────────

drop policy if exists loyalty_own on public.loyalty_transactions;
create policy loyalty_own on public.loyalty_transactions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists referrals_own on public.referrals;
create policy referrals_own on public.referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

-- ─── régie et contenus municipaux ──────────────────────────────────────

drop policy if exists sponsored_select on public.sponsored_slots;
create policy sponsored_select on public.sponsored_slots
  for select using (
    (is_active and now() between starts_at and ends_at) or public.is_admin()
  );

drop policy if exists sponsored_admin on public.sponsored_slots;
create policy sponsored_admin on public.sponsored_slots
  for all using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['city_infos','city_alerts','practical_services','prayer_times','pharmacies_on_duty'] loop
    execute format('drop policy if exists %1$s_public_select on public.%1$s', t);
    execute format('create policy %1$s_public_select on public.%1$s for select using (true)', t);
    execute format('drop policy if exists %1$s_admin on public.%1$s', t);
    execute format(
      'create policy %1$s_admin on public.%1$s for all
       using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ─── service_requests ──────────────────────────────────────────────────

drop policy if exists service_requests_own on public.service_requests;
create policy service_requests_own on public.service_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists service_requests_insert on public.service_requests;
create policy service_requests_insert on public.service_requests
  for insert with check (user_id = auth.uid());

drop policy if exists service_requests_admin on public.service_requests;
create policy service_requests_admin on public.service_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── Droits d'exécution ────────────────────────────────────────────────

revoke all on function public.place_order(uuid, jsonb, public.payment_method, public.delivery_method, text, text, text, uuid) from public;
grant execute on function public.place_order(uuid, jsonb, public.payment_method, public.delivery_method, text, text, text, uuid) to authenticated;

revoke all on function public.approve_shop(uuid) from public;
revoke all on function public.reject_shop(uuid, text, text) from public;
grant execute on function public.approve_shop(uuid) to authenticated;
grant execute on function public.reject_shop(uuid, text, text) to authenticated;

revoke all on function public.start_live(uuid, text) from public;
revoke all on function public.end_live(uuid) from public;
revoke all on function public.set_live_viewers(uuid, integer) from public;
grant execute on function public.start_live(uuid, text) to authenticated;
grant execute on function public.end_live(uuid) to authenticated;
grant execute on function public.set_live_viewers(uuid, integer) to authenticated;

-- award_points ne doit jamais être appelable depuis le navigateur.
revoke all on function public.award_points(uuid, integer, text, text, uuid) from public, anon, authenticated;

revoke all on function public.expire_stale_deals() from public, anon, authenticated;
revoke all on function public.refresh_shops_open_state() from public, anon, authenticated;

grant execute on function public.search_catalog(text, integer) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.owns_shop(uuid) to anon, authenticated;
grant execute on function public.my_shop_id() to anon, authenticated;
