-- ════════════════════════════════════════════════════════════════════════
-- Compteur de vues des boutiques
-- ════════════════════════════════════════════════════════════════════════
--
-- `shops.views_count` existe depuis la création du schéma, et le tableau de bord
-- du vendeur l'affiche déjà sous le libellé « visites ». Rien ne l'incrémentait :
-- chaque vendeur y lisait zéro, indéfiniment. Un chiffre faux est pire qu'un
-- chiffre absent — celui-ci laissait croire que personne ne venait.
--
-- Pourquoi une fonction plutôt qu'un `update` depuis l'application :
--
--   · un visiteur anonyme n'a aucun droit d'écriture sur `shops`, et il ne doit
--     pas en avoir — sinon n'importe qui pourrait renommer une boutique ;
--   · `security definer` donne à cette seule opération le droit qu'il faut, sur
--     cette seule colonne ;
--   · l'incrément se fait en une instruction, donc sans lecture préalable : deux
--     visiteurs simultanés comptent pour deux, là où un « lire puis écrire »
--     depuis l'application en aurait perdu un.
--
-- Ce que ce compteur n'est pas : une mesure d'audience. Il compte les affichages
-- de la page, robots d'indexation compris, et un rechargement compte double. Pour
-- ce qu'on en fait — montrer au vendeur que sa boutique est regardée — c'est
-- suffisant, mais il ne faudra pas le présenter comme un nombre de visiteurs.

create or replace function public.increment_shop_views(shop uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.shops
     set views_count = views_count + 1
   where id = shop
     and status = 'approved';
$$;

comment on function public.increment_shop_views(uuid) is
  'Incrémente le compteur de vues d''une boutique approuvée. Appelée à chaque affichage de sa page.';

-- Ouvert à tout le monde, y compris aux visiteurs non connectés : ce sont eux
-- qui constituent l'essentiel de l'audience d'une boutique.
grant execute on function public.increment_shop_views(uuid) to anon, authenticated;

/*
  Le pire qu'un usage malveillant puisse produire est un compteur gonflé sur sa
  propre boutique — aucune donnée n'est lue, modifiée ni divulguée. Le rapport
  entre le risque et le coût d'une protection contre la répétition (empreinte
  d'adresse, fenêtre de temps, table de passages) ne le justifie pas à cette
  échelle.
*/
