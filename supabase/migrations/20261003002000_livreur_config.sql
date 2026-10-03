-- ═══════════════════════════════════════════════════════════════════════
-- Livraison : le livreur (boutique « SADEN DELIVERY ») prend en charge les
-- commandes prêtes à livrer de toutes les boutiques.
--
-- Le livreur n'est pas un nouveau rôle de compte : c'est une boutique comme
-- une autre, désignée par une ligne de configuration plutôt qu'en dur dans
-- le code — changeable sans redéploiement si le prestataire change un jour.
-- Même table, même patron que `push_endpoint`/`push_secret` déjà en place.
-- ═══════════════════════════════════════════════════════════════════════

insert into public.app_settings (key, value)
select 'courier_shop_id', id::text
from public.shops
where name ilike 'SADEN DELIVERY'
limit 1
on conflict (key) do update set value = excluded.value;

-- Vérification à faire après la pose de cette migration :
--   select * from public.app_settings where key = 'courier_shop_id';
-- Doit renvoyer une ligne. Si le nom exact en production diffère, relancer
-- le insert ci-dessus avec la bonne valeur de `name ilike`.

-- Vrai si l'appelant possède la boutique désignée comme livreur. Même
-- patron que `owns_shop()`/`is_admin()` (20260809000300_functions_triggers.sql).
create or replace function public.is_courier()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.app_settings a
    join public.shops s on s.id = a.value::uuid
    where a.key = 'courier_shop_id' and s.owner_id = auth.uid()
  );
$$;

grant execute on function public.is_courier() to anon, authenticated;

-- Prévient le livreur qu'une commande est prête à livrer. Appelée par le
-- vendeur (via advanceOrder) au moment où il passe une commande en
-- livraison au statut `ready`. `security definer` car `app_settings` et
-- `notifications` n'ont pas de policy d'écriture/lecture ouverte au client
-- — même raison que `place_order`/`approve_shop` plus haut dans le projet.
create or replace function public.notify_courier_ready(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order        public.orders;
  v_courier_user uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    return;
  end if;

  -- Seul le propriétaire de la boutique concernée peut déclencher cet envoi
  -- (cette fonction contourne RLS, elle doit donc vérifier elle-même).
  if not public.owns_shop(v_order.shop_id) then
    raise exception 'Non autorisé' using errcode = '42501';
  end if;

  if v_order.delivery_method <> 'delivery' then
    return;
  end if;

  select s.owner_id into v_courier_user
  from public.app_settings a
  join public.shops s on s.id = a.value::uuid
  where a.key = 'courier_shop_id';

  if v_courier_user is null then
    return;
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    v_courier_user,
    'order_update',
    'Commande prête à livrer',
    v_order.order_number
      || coalesce(' — ' || nullif(v_order.contact_phone, ''), '')
      || coalesce(', ' || nullif(v_order.delivery_address, ''), ''),
    '/vendeur/livraisons'
  );
end;
$$;

revoke all on function public.notify_courier_ready(uuid) from public;
grant execute on function public.notify_courier_ready(uuid) to authenticated;
