# CLAUDE.md

## Thèmes de la page boutique

La page `/boutique/[slug]` change d'apparence selon la famille de catégorie
de la boutique (Mode, Alimentation, Santé…) — voir `src/lib/boutique-themes/`.

- **Jamais de couleur en dur** dans un composant de la page boutique
  (`src/app/boutique/[slug]/`, `src/components/boutique/`,
  `src/components/cards/product-card.tsx`) : toute couleur passe par un
  jeton de thème (`var(--theme-accent, ...)`, `var(--theme-surface, ...)`…),
  avec l'ancienne couleur G-Mall en repli (`var(--theme-accent,
  var(--color-brand-fill))`) — un composant partagé avec le reste du site
  (comme `ProductCard`) garde ainsi son apparence habituelle hors d'une
  page boutique, où `--theme-*` n'existe simplement pas.
- Exception assumée : le bandeau "retour à mon espace" du propriétaire
  reste en identité G-Mall (violet), pas celle du thème — c'est un outil
  d'administration, pas la vitrine.
- **Ajouter un thème pour une nouvelle catégorie** : créer
  `src/lib/boutique-themes/<id>.ts` sur le modèle d'un thème existant,
  l'enregistrer dans `THEMES` et dans `THEME_PAR_CATEGORIE`
  (`src/lib/boutique-themes/index.ts`), puis ajouter l'id à `ThemeId`
  (`types.ts`). Prévoir une palette claire ET sombre (sauf thème "sombre
  par nature"), un `emptyState` pour `produits`, `promos` et `posts`
  (FR + AR), et vérifier le rendu dans `/dev/boutique-themes` (dev only).
- Après toute palette ajoutée ou modifiée, `npm run check:theme-contrast`
  **doit rester vert** — il vérifie chaque paire texte/fond de chaque
  thème, en clair et en sombre, avec la vraie formule WCAG. Il fait partie
  de `npm run check`.

## Structure de la page boutique par métier

Au-delà de la couleur, `theme.productLayout` pilote la structure même de
l'onglet Produits (`src/components/boutique/boutique-contenu.tsx` fait le
dispatch). Chaque métier qui a sa propre mise en page vit dans
`src/components/boutique/layouts/` ; `GrilleParDefaut` reste le repli pour
toute famille qui n'en a pas encore.

- **Jamais de donnée inventée** : une mise en page lit `product_attributes`
  (specs, notes, pièce, poids…), `product_variants.material` ou
  `product_packs` — jamais un champ qui n'existe pas dans le schéma. Si un
  métier a besoin d'une nouvelle donnée, elle passe par
  `product_attributes` (clé/valeur) sauf si c'est un vrai axe de variante
  (→ `product_variants`) ou une relation entre plusieurs produits (→ une
  table dédiée, voir `product_packs`/`pack_items`).
- **Toujours dégrader proprement** : toute boutique existante a
  aujourd'hui zéro attribut, zéro variante de matière, zéro pack. Une
  nouvelle mise en page doit rendre quelque chose de correct sans aucune
  de ces données — pas de section vide, pas de case "—", pas de crash.
  `src/lib/boutique-themes/attributs-server.ts` tolère déjà l'absence des
  migrations correspondantes (voir `MIGRATION_ABSENTE`, même patron que
  `black-friday-server.ts`).
- **Ajouter les champs d'un métier côté vendeur** :
  `src/app/vendeur/produits/attribute-fields.tsx`, un bloc conditionnel
  par `familleId` (le `ThemeId` de la boutique, résolu côté serveur dans
  `page.tsx`/`[id]/page.tsx`, jamais recalculé côté client).
