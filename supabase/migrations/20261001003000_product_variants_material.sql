-- Troisième axe de déclinaison : la matière (or, argent, fantaisie…).
--
-- `product_variants` ne connaissait que couleur × taille. Pour la Bijouterie,
-- la matière change le prix et le stock exactement comme une taille change
-- la coupe d'un vêtement — c'est un axe de variante, pas un attribut
-- descriptif : voir `product_attributes`, qui porte le poids et la
-- collection, des informations qui elles ne changent ni le prix ni le stock.
--
-- Additive : `material` est nul pour toute déclinaison existante. La
-- contrainte d'unicité élargie à trois colonnes ne peut pas entrer en
-- conflit avec une ligne déjà là — en SQL, deux NULL ne sont jamais égaux
-- pour une contrainte unique, donc ajouter une colonne nulle ne resserre
-- rien pour l'existant (même comportement que `color`/`size`, déjà nuls
-- pour un article sans déclinaison avant cette migration).

alter table public.product_variants
  add column if not exists material text;

alter table public.product_variants
  drop constraint if exists product_variants_combinaison_unique;

alter table public.product_variants
  add constraint product_variants_combinaison_unique
  unique (product_id, color, size, material);

/* ─── Reprise ──────────────────────────────────────────────────────────── */

-- Marche arrière :
--   alter table public.product_variants drop constraint product_variants_combinaison_unique;
--   alter table public.product_variants add constraint product_variants_combinaison_unique unique (product_id, color, size);
--   alter table public.product_variants drop column material;
