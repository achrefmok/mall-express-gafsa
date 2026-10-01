# À traiter plus tard — notes issues du travail sur les thèmes de boutique

Ce fichier n'est pas un vrai backlog outillé : c'est le carnet des points
identifiés pendant le travail sur les thèmes de boutique (octobre 2026), qui
dépassent le périmètre du moment ou qui demandent un arbitrage avant d'y
toucher.

## Onglet "Posts" — aucune source de données

Il n'existe **aucune table `posts`** dans le schéma, et rien dans le code ne
la requête. `shops.posts_count` est une colonne réelle mais **n'est
incrémentée nulle part** — elle affiche toujours 0.

Traitement actuel (masquage, pas suppression) : l'onglet "Posts" est retiré
de `ShopTabs`, et la statistique "0 posts" n'apparaît plus sur la fiche
boutique. Rien n'a été supprimé côté base — le jour où la fonctionnalité
existera, il suffira de réintroduire l'onglet et de brancher la vraie
source.

## Doublon `sport` / `sport-loisirs`

Deux catégories top-level (`sport`, hue 155 ; `sport-loisirs`, hue 150) très
proches, dont les sous-catégories (salles de sport, fitness, clubs…)
pointent toutes vers `sport-loisirs`. Le thème `sport` les traite comme une
seule famille, mais la duplication en base reste — à fusionner un jour côté
`categories` (migration à part, hors périmètre de ce travail).

## Immobilier / Voitures — champs manquants sur `products`, mais la table générique existe déjà

`products` ne porte que nom/description/prix/stock/images/colors/sizes. Les
`productLayout` dédiés à ces deux métiers (`showcase-fiche`, `vehicule`) se
dégradent proprement vers l'équivalent d'une grille classique tant
qu'aucune donnée structurée n'existe — rien n'est inventé.

**La table générique proposée ici a été construite** pendant le chantier
"expérience par catégorie" (octobre 2026) — `product_attributes(product_id,
key, value)`, voir `supabase/migrations/20261001002000_product_attributes.sql`
— et sert déjà Électronique, Beauté, Maison, Bijouterie (voir plus bas).
Immobilier (surface, pièces, localisation) et Voitures (marque, modèle,
année, kilométrage) peuvent la réutiliser directement, sans nouvelle
migration : il reste seulement à écrire leurs `productLayout` (aucun des
deux n'est branché, les deux restent sur la grille par défaut) et à
étendre `src/app/vendeur/produits/attribute-fields.tsx` avec leurs champs.

## Vérification à faire avant d'implémenter les thèmes Immobilier / Voitures

Confirmer avec l'équipe si ces deux familles seront un jour vendues via
`products` comme aujourd'hui, ou si elles mériteraient leur propre table
(une annonce immobilière n'a pas de stock ni de tailles) — ça changerait
la décision ci-dessus (`product_attributes` reste pertinent pour des
champs descriptifs quoi qu'il en soit, mais pas pour un cycle de vie
différent comme une annonce qui expire).

## Migrations en attente de collage manuel (chantier "expérience par catégorie")

Six migrations écrites pour ce chantier ne sont pas encore collées dans
l'éditeur SQL Supabase (pas de CLI/psql sur ce projet — voir la mémoire du
projet) :

- `20261001002000_product_attributes.sql`
- `20261001003000_product_variants_material.sql`
- `20261001004000_product_packs.sql`
- `20261001005000_categories_bijouterie_parapharmacie.sql`
- `20261001006000_sous_categories_beaute.sql`

Tant qu'elles ne sont pas collées, tout le code qui les lit ou les écrit
tolère leur absence (`MIGRATION_ABSENTE`, voir `attributs-server.ts` et
`actions/vendor.ts`) : aucune page ne casse, les nouvelles mises en page
retombent simplement sur une grille simple, et le formulaire vendeur
enregistre le produit même si ses champs par métier échouent.

## Prix des packs — recalcul serveur à brancher au panier

Décision prise : le pourcentage de remise d'un pack (`discount_percent`)
est purement indicatif tant qu'il n'est qu'affiché. Le jour où un client
pourra l'ajouter réellement à son panier, le prix facturé doit être
recalculé côté serveur à partir des vrais prix des produits du pack — ne
jamais faire confiance à un montant composé côté client. Pas encore
implémenté : `ParapharmacieLayout` affiche les packs, mais aucun bouton
"ajouter" n'existe encore dessus.

## Gravure et taille de bague (Bijouterie) — outils cosmétiques, décision à revisiter si besoin

Décision prise explicitement : ces deux outils ne sauvegardent rien
aujourd'hui — un client qui veut une gravure précise contacte le bijoutier
par la messagerie existante. Si le besoin se confirme, il faudra une
colonne de personnalisation sur `cart_items`/`order_items` pour que la
gravure saisie survive jusqu'à la commande que voit le commerçant — hors
périmètre de ce chantier.

## Personnalisation du thème par le vendeur — non implémentée

`ThemeBoutique.overridesAutorises` existe dans le système de types
(`src/lib/boutique-themes/types.ts`) : une liste fermée de jetons qu'un
commerçant pourrait un jour ajuster lui-même (aujourd'hui, seulement
`"accent"`, pour chaque thème). Rien ne la lit ni ne l'écrit côté
`/vendeur` — c'est un champ préparé pour plus tard, pas une fonctionnalité.
À brancher le jour où le besoin est confirmé : probablement une colonne
`shops.theme_overrides` (jsonb), validée côté serveur contre la liste
`overridesAutorises` du thème résolu, jamais un objet libre — un vendeur ne
doit pouvoir que teinter son thème, pas casser sa lisibilité ni sa
structure.
