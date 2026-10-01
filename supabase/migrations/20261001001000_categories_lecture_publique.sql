-- Ouvre la lecture de `public.categories` à tout le monde, catégorie
-- inactive comprise — aucune donnée sensible dans cette table (nom, slug,
-- teinte, parent).
--
-- Avant ce changement, un visiteur anonyme ne pouvait lire qu'une
-- catégorie `is_active = true` : le thème d'une boutique de catégorie
-- inactive (Cafés, aujourd'hui) retombait donc sur le thème par défaut
-- pour ce visiteur, alors que `resolveTheme()` fonctionne correctement —
-- c'est la policy qui masquait la catégorie, pas une erreur de thème.
-- Même chose pour le nom de catégorie d'une boutique sur sa page OG, sa
-- fiche produit, le détail d'une brocante.
--
-- Chaque endroit qui LISTE ou FILTRE par catégorie (menus, filtres,
-- recherche, formulaire vendeur) passe déjà par `is_active = true`
-- explicite côté application — voir `src/lib/queries.ts#getCategories`,
-- `src/app/(client)/free-shop/nouveau/page.tsx`,
-- `src/app/(client)/marketplace/page.tsx` et
-- `src/components/annuaire/annuaire-lieux.tsx` (ces deux derniers
-- filtrent désormais leurs sous-catégories explicitement, vérifié dans le
-- même lot que cette migration). Une catégorie inactive reste donc
-- invisible dans ces listes malgré la lecture ouverte ici — seule une
-- page qui affiche la catégorie d'un élément déjà résolu par son id ou
-- son slug (une boutique, un produit, un deal) peut désormais la nommer
-- correctement, active ou non.

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select using (true);
