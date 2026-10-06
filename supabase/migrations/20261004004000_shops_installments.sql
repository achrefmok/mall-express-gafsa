-- Options de paiement en plusieurs fois (Électronique), déclarées par le
-- vendeur. Tableau vide par défaut : le sélecteur « Payer en X fois » reste
-- masqué tant que la boutique n'en a choisi aucune — purement indicatif,
-- aucun paiement fractionné réel n'est intégré.

alter table public.shops
  add column if not exists installments smallint[] not null default '{}';
