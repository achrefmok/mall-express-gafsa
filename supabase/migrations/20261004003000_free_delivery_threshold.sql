-- Palier de livraison gratuite, par boutique — panier flottant de la
-- vitrine (BoutiquePanierFlottant). Nullable = désactivé, la barre ne
-- s'affiche alors pas du tout (pas de "0 DT" ni de palier inventé pour
-- une boutique qui n'en a pas défini).

alter table public.shops
  add column if not exists free_delivery_threshold numeric check (free_delivery_threshold is null or free_delivery_threshold >= 0);
