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
