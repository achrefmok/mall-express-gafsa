-- ═══════════════════════════════════════════════════════════════════════
-- Livraison : droits de lecture et de mise à jour du livreur sur les
-- commandes des AUTRES boutiques.
--
-- Policies additives : Postgres combine en OU les policies permissives
-- d'une même commande sur une même table, donc on ajoute ces deux-là sans
-- toucher à `orders_select`/`orders_shop_update`/`order_items_select`
-- existantes (20260809000400_rls.sql).
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists orders_courier_select on public.orders;
create policy orders_courier_select on public.orders
  for select using (
    delivery_method = 'delivery'
    and status in ('ready', 'shipped', 'delivered')
    and public.is_courier()
  );

-- Le livreur accepte (ready → shipped) puis termine (shipped → delivered) ;
-- il ne touche jamais une commande qui n'est pas encore prête ni une
-- commande de retrait en boutique.
drop policy if exists orders_courier_update on public.orders;
create policy orders_courier_update on public.orders
  for update using (
    delivery_method = 'delivery'
    and status in ('ready', 'shipped')
    and public.is_courier()
  )
  with check (
    delivery_method = 'delivery'
    and status in ('shipped', 'delivered')
    and public.is_courier()
  );

drop policy if exists order_items_courier_select on public.order_items;
create policy order_items_courier_select on public.order_items
  for select using (
    public.is_courier()
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.delivery_method = 'delivery'
        and o.status in ('ready', 'shipped', 'delivered')
    )
  );
