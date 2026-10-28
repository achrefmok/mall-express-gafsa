-- ════════════════════════════════════════════════════════════════════════
-- Directs TikTok : la contrainte `lives_source_payload`
-- ════════════════════════════════════════════════════════════════════════
--
-- Complète 20261028001000_live_source_tiktok.sql, qui ajoutait la valeur
-- `tiktok` et la colonne `tiktok_url` sans toucher à cette contrainte : elle
-- n'admettait que `facebook`, `hls` et `camera`, et refusait donc tout direct
-- TikTok (erreur 23514), migration collée ou non.
--
-- Même règle que pour Facebook : un direct TikTok porte son lien.
--
-- À coller APRÈS 20261028001000 (la valeur d'énumération doit exister).
-- Idempotente : collée deux fois, elle ne change rien la seconde.
-- ════════════════════════════════════════════════════════════════════════

alter table public.lives drop constraint if exists lives_source_payload;

alter table public.lives add constraint lives_source_payload check (
  (source = 'facebook' and facebook_url is not null)
  or (source = 'hls' and hls_url is not null)
  or (source = 'tiktok' and tiktok_url is not null)
  or (source = 'camera')
);
