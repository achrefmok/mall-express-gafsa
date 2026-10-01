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

## Immobilier / Voitures — champs manquants sur `products`

`products` ne porte que nom/description/prix/stock/images/colors/sizes.
Aucun champ pour surface, nombre de pièces, localisation (Immobilier) ni
marque, modèle, année, kilométrage (Voitures). Les `productLayout` dédiés à
ces deux métiers se dégradent proprement vers l'équivalent d'une grille
classique tant que ces champs n'existent pas — rien n'est inventé.

**Migration à envisager, non appliquée** (à valider avant de l'écrire) :
une table `product_attributes` générique (`product_id`, `key`, `value`)
plutôt que des colonnes dédiées à chaque métier sur `products` — évite
d'alourdir la table principale pour des champs qui ne concernent qu'une
poignée de catégories, et reste extensible à d'autres métiers de service
sans nouvelle migration à chaque fois.

## Vérification à faire avant d'implémenter les thèmes Immobilier / Voitures

Confirmer avec l'équipe si ces deux familles seront un jour vendues via
`products` comme aujourd'hui, ou si elles mériteraient leur propre table
(une annonce immobilière n'a pas de stock ni de tailles) — ça change la
forme de la migration ci-dessus.

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
