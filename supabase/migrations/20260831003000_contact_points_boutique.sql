-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 30 · Points de contact de la boutique
--
-- La modal « Ouvrir ma boutique » du profil recueille, en plus des champs
-- déjà portés par `shops` (name, category, address, phone, position, logo,
-- cover), les moyens de joindre le commerçant sur ses comptes : WhatsApp,
-- Instagram, et son lien d'actualité Facebook.
--
-- `facebook_url` n'entre pas en conflit avec `lives.facebook_url` : ici c'est
-- la page de la boutique, là le permalien d'un direct relayé.
--
-- Les colonnes restent gardées par RLS comme le reste de la boutique
-- (`shops_update_own`), et `guard_shop_privileges` ne les neutralise pas —
-- c'est le commerçant qui les remplit, elles ne font pas partie des privilèges
-- réservés à l'administration.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.shops
  add column if not exists whatsapp text,
  add column if not exists instagram text,
  add column if not exists facebook_url text;

comment on column public.shops.whatsapp is
  'Numéro WhatsApp du commerçant, tel qu''affiché sur la fiche boutique.';
comment on column public.shops.instagram is
  'Nom d''utilisateur ou adresse du profil Instagram de la boutique.';
comment on column public.shops.facebook_url is
  'Adresse publique de la page Facebook de la boutique (distincte du permalien de direct).';
