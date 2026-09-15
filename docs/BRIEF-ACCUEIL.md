# Brief design — Page d'accueil « Mall Express Gafsa »

## Le produit

Application web installable (PWA) qui met en ligne les boutiques d'un centre commercial de Gafsa, en Tunisie. Trois métiers dans une même application :

1. une **marketplace** (boutiques, produits, panier, commandes, ventes en direct) ;
2. des **services de la ville** (taxi avec géolocalisation, louage, pharmacies de garde, horaires de prière, SOS dépannage) ;
3. des **opérations commerciales** (promotions, Black Friday de 24 heures).

**Public** : habitants de Gafsa, de 18 à 60 ans, **presque tous sur téléphone Android**, souvent en données mobiles limitées. Beaucoup ne sont pas à l'aise avec les applications. **Deux langues** : français et arabe, avec inversion complète du sens de lecture (RTL) en arabe.

**Ce qu'on attend de l'accueil** : qu'une personne qui ouvre l'application trouve en moins de cinq secondes ce qu'elle est venue chercher — le plus souvent un taxi, une pharmacie, une boutique précise, ou une bonne affaire.

## Contraintes techniques (à respecter dans toute proposition)

- Colonne unique de **520 px maximum**, centrée. Sur grand écran, un menu latéral de 252 px s'ajoute à gauche ; la colonne de contenu ne s'élargit pas.
- **Barre de navigation fixe en bas** (6 onglets : Accueil, Marketplace, Lives, Bons plans, Services, Profil). Elle recouvre le bas de l'écran, tout contenu doit rester au-dessus.
- Tout le contenu vient d'une base de données : les sections peuvent être **vides** (aucun direct, aucune promotion, aucun service). Chaque proposition doit dire ce qui s'affiche dans ce cas.
- Cibles tactiles de 44 px minimum. Thème clair **et** sombre. Animations désactivables (préférence système « mouvement réduit »).
- Rendu serveur : le contenu arrive déjà rempli, pas d'écran de chargement à concevoir.

## Identité visuelle actuelle

| Rôle | Valeur |
| --- | --- |
| Fond de l'application | `#f4f1fa` (lilas très pâle) |
| Marque (violet) | `#6d4b8f`, variante foncée `#5a3a78` |
| Texte principal | `#241f2e` |
| Texte secondaire | `#635c74` · tertiaire `#767085` |
| Accent « direct » / alerte | rouge framboise ≈ `#d0455f` |
| Succès | `#2e8b57` |
| Cartes | blanc translucide, bordure quasi blanche |
| Black Friday | dégradé noir → violet `#0d0b10 → #241f2e → #5a3a78` |

- **Rayons** : cartes 18 px, vignettes 16 px, pastilles 14 px, grandes cartes 20 à 26 px, ronds parfaits pour les avatars et les services.
- **Ombres** : très douces, teintées violet (`0 6px 18px rgba(60,40,90,0.07)`).
- **Typographie** : une seule famille (sans-serif système, Cairo pour l'arabe). Titres très gras, interlettrage négatif. Beaucoup de petites tailles : 9 à 11,5 px pour les légendes, 11,5 px pour le corps, 24 px pour le titre principal.
- **Ton** : chaleureux, direct, tutoiement évité, pas de jargon.

## Structure actuelle, de haut en bas

1. **En-tête** (fixe, ne défile pas) — surtitre minuscule, puis « Bonjour Achref » en 24 px, puis une ligne d'état (« 12 boutiques actives aujourd'hui »). À droite : trois pastilles rondes de 38 px — bascule de langue, notifications (avec badge chiffré), panier (pleine couleur violette, badge blanc).
2. **Barre de recherche** — pleine largeur, avec saisie vocale.
3. **Barre d'accessibilité** — agrandir le texte, arabe, mode simplifié.
4. **Bandeau contextuel** — carte fine avec une pastille pulsante : état d'ouverture du mall et prochain direct, plus un bouton « Me prévenir ».
5. **Black Friday** — *seulement pendant la campagne ou juste avant* : bannière sombre, compte à rebours en chiffres monospace, rangée d'offres avec prix barré et pourcentage.
6. **Publicité sponsorisée** — bannière large que l'on fait glisser du doigt.
7. **Sélection des boutiques à la une** — rangée horizontale de 3 vignettes produit (photo, nom, prix, cœur favori, bouton d'achat rond à cheval sur la carte). *Cachée* quand un direct est en cours.
8. **Nos partenaires / En direct maintenant** — rangée d'avatars ronds de 58 px ; anneau rouge et étiquette « LIVE » pour ceux qui diffusent.
9. **Promotions du moment** — rangée de tuiles de remise par boutique, puis une grande carte : photo de 168 px, badge boutique posé en haut à gauche, pourcentage en bas à gauche, titre, prix, prix barré.
10. **Catégories** — rangée de tuiles rondes de 66 px, colorées par teinte, avec le nombre de boutiques.
11. **Services pratiques** — rangée de pastilles rondes de 58 px : Taxi, Louage, Pharmacie, Prière, Animaux, SOS, et Black Friday pendant la campagne. Un toucher ouvre directement le service.
12. **Invitation commerçants** — bandeau dégradé violet avec bouton blanc « Ouvrir ma boutique ».

Tout ce qui est sous la barre de recherche défile verticalement ; **six sections sur douze sont des rangées horizontales**.

## Ce qui ne va pas, selon nous

- **Trop de rangées horizontales qui se ressemblent.** Six rails empilés, tous au même rythme : l'œil ne hiérarchise plus rien et la page se parcourt sans s'arrêter.
- **Les services sont en position 11 sur 12.** Or le taxi et la pharmacie de garde sont probablement les deux motifs d'ouverture les plus fréquents. Il faut faire défiler longuement pour les atteindre.
- **Beaucoup de très petits textes** (9 à 10 px) sous les pastilles et les tuiles, difficiles à lire en plein soleil ou pour un utilisateur âgé.
- **La page est longue** et se termine par un bandeau publicitaire destiné aux commerçants, pas aux clients.
- **Les états vides** ne sont pas vraiment dessinés : quand il n'y a ni direct, ni promotion, ni publicité, l'accueil se vide de sa moitié haute.
- **Densité inégale** : le bandeau contextuel et la carte de promotion sont très aérés, les rangées de pastilles très serrées.

## Ce qu'on demande

Une **proposition de refonte de la page d'accueil** qui :

1. **hiérarchise** : ce qu'on vient chercher le plus souvent doit être atteignable sans défiler ;
2. **varie les formats** au lieu d'empiler des rangées identiques, tout en gardant le geste de glissement horizontal là où il a du sens ;
3. **tient dans la colonne de 520 px**, avec la barre du bas ;
4. **fonctionne en arabe** (sens inversé, mots plus longs) ;
5. **reste lisible** : propose une échelle typographique plus généreuse que l'actuelle ;
6. **traite les états vides** et les cas où une section n'a rien à montrer ;
7. **conserve la palette et la douceur actuelles** (violet, lilas pâle, grands rayons, ombres discrètes) — on ne veut pas changer d'identité, on veut mieux l'utiliser.

Livrable souhaité : une ou deux directions, décrites section par section avec l'ordre proposé, plus une maquette HTML/CSS statique à la largeur d'un téléphone (390 px) pour voir le rythme de la page.
