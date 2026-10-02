-- Zones de livraison : tarifs par zone pour une boutique de type Services
-- (livraison de colis, courses, documents — voir `ServiceLayout`).
--
-- Donnée propre à chaque boutique, saisie par le vendeur depuis
-- `/vendeur/livraison` — jamais une grille de tarifs partagée inventée pour
-- toutes les boutiques "Services", qui n'ont pas forcément la même zone de
-- couverture ni les mêmes prix. Même patron que `product_packs` : une table
-- additive, vide à la création, RLS sur le propriétaire de la boutique.

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  name_ar text,
  price numeric(10, 2) not null check (price >= 0),
  delay_minutes smallint not null check (delay_minutes > 0),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_zones_shop_idx
  on public.delivery_zones (shop_id);

alter table public.delivery_zones enable row level security;

drop policy if exists "zones lisibles" on public.delivery_zones;
create policy "zones lisibles" on public.delivery_zones
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    or public.owns_shop(shop_id)
    or public.is_admin()
  );

drop policy if exists "zones du commercant" on public.delivery_zones;
create policy "zones du commercant" on public.delivery_zones
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

/* ─── Reprise ──────────────────────────────────────────────────────────── */

-- Table additive et vide à la création : aucune boutique existante n'a de
-- zone tant qu'elle n'en crée pas depuis son espace vendeur — `ServiceLayout`
-- affiche alors le formulaire de demande sans la liste de tarifs ni
-- l'estimation de prix/délai.
--
-- Marche arrière : `drop table public.delivery_zones;`
