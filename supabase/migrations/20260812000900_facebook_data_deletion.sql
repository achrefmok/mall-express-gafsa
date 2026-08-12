-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 09 · Rappel de suppression des données Facebook
--
-- Quand un commerçant retire notre application depuis les paramètres de son
-- compte Facebook, Meta appelle /api/facebook/data-deletion. Sa charge ne
-- porte qu'un identifiant : celui du compte Facebook. Sans lui de notre côté,
-- impossible de savoir quelle liaison effacer.
--
-- Meta exige ce mécanisme en revue pour toute application utilisant Facebook
-- Login, et le préfère à une simple page d'instructions.
--
-- Migration distincte de la 08, qui est déjà appliquée : on ne réécrit pas une
-- migration passée, sinon les bases installées avant divergent en silence de
-- celles installées après.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.shop_facebook_pages
  add column if not exists facebook_user_id text;

comment on column public.shop_facebook_pages.facebook_user_id is
  'Compte Facebook ayant relié la page. Sert au rappel de suppression : c''est le seul identifiant que Meta transmet.';

-- Le rappel cherche par cet identifiant, jamais par la boutique.
create index if not exists shop_facebook_pages_facebook_user_id_idx
  on public.shop_facebook_pages (facebook_user_id)
  where facebook_user_id is not null;
