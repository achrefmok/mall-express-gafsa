-- ════════════════════════════════════════════════════════════════════════
-- Directs : la source « tiktok »
-- ════════════════════════════════════════════════════════════════════════
--
-- TikTok ne fournit aucun lecteur intégrable pour un direct. Le commerçant
-- diffuse sur TikTok ; G-Mall garde le lien du direct et invite le
-- spectateur à l'ouvrir dans TikTok, en conservant ici la couche commerce
-- (produit épinglé, remise, commentaires, panier).
--
--   source = 'tiktok' : tiktok_url = https://www.tiktok.com/@<compte>/live
--
-- Tant que cette migration n'est pas collée, le choix « Direct TikTok »
-- échoue à l'enregistrement avec un message clair ; rien d'autre ne change.
--
-- Idempotente : `if not exists` partout. Collée deux fois, elle ne change
-- rien la seconde.
-- ════════════════════════════════════════════════════════════════════════

alter type public.live_source add value if not exists 'tiktok';

alter table public.lives add column if not exists tiktok_url text;
