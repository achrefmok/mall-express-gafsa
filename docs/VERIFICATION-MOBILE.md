# Vérification mobile — G-Mall

À faire sur **un vrai téléphone**, en production (pas sur une préversion Vercel protégée par SSO). Un Android récent avec Chrome, et un iPhone avec Safari si possible. Cochez au fur et à mesure et notez tout écart avec une capture.

Avant de commencer :

- [ ] Les migrations `20260913001000`, `20260913002000`, `20260913003000` et `20260914001000` sont collées dans Supabase, dans cet ordre.
- [ ] `npm run db:black-friday` passe.
- [ ] Un logo est défini dans l'administration (Admin → logo de l'app).
- [ ] Pour tester le Black Friday **en cours** : une campagne programmée sur le vendredi du jour, avec au moins une offre activée. Sinon, seules les phases « à venir » et « terminée » sont vérifiables.
- [ ] Données mobiles activées, Wi-Fi coupé, pour au moins un passage : c'est la condition réelle de la plupart des clients.

## 1. Installation PWA et logo

- [ ] Android : le bandeau ou le menu « Installer l'application » apparaît.
- [ ] iPhone : Partager → « Sur l'écran d'accueil » propose l'icône du logo.
- [ ] L'icône sur l'écran d'accueil est **le logo de l'administration**, net, non rogné (icône adaptative Android : le logo reste dans le cercle).
- [ ] L'écran de lancement (splash) montre le fond de la marque et le logo.
- [ ] L'application s'ouvre en plein écran, sans barre d'adresse.
- [ ] Changer le logo dans l'administration puis réinstaller : la nouvelle icône est prise (le cache des icônes dure jusqu'à 24 h).

## 2. Accueil et navigation

- [ ] L'accueil s'affiche en moins de 3 s en 4G.
- [ ] Raccourcis : Taxi, Louage, Pharmacie, Prière, Animaux, SOS, Black Friday (pendant une campagne) ouvrent **directement** leur écran en un toucher.
- [ ] Pharmacie et Prière font défiler jusqu'au bon bloc de `/services`.
- [ ] La barre du bas reste visible et ne recouvre aucun bouton.
- [ ] Retour arrière du téléphone : revient à l'écran précédent, jamais hors de l'application.
- [ ] Aucun défilement horizontal parasite sur aucune page.

## 3. Taxi (client)

- [ ] La carte se charge ; « Ma position » centre sur la position réelle.
- [ ] Le panneau du bas se tire sur trois hauteurs sans saccade et ne passe pas sous la barre de navigation.
- [ ] Recherche d'une destination, lancement : l'animation de recherche puis la liste des chauffeurs.
- [ ] Sans chauffeur proche : les taxis joignables s'affichent avec leur numéro.
- [ ] **Appeler** ouvre le composeur avec le bon numéro.
- [ ] **WhatsApp** ouvre la conversation avec le message pré-rempli.
- [ ] Le nom du chauffeur ouvre sa fiche publique.
- [ ] Après une course **terminée**, en rouvrant l'écran taxi : la carte « Comment s'est passée votre course ? » apparaît ; noter 1 à 5 étoiles, commenter, envoyer → « Merci pour votre avis ! ».
- [ ] Renvoyer une seconde note pour la même course est impossible (la carte ne revient pas).
- [ ] « Plus tard » fait disparaître la carte pour cette course.

## 4. Espace chauffeur

- [ ] Profil → « Mon espace taxi » n'apparaît que pour un chauffeur validé.
- [ ] Bascule Disponible / Occupé / Hors ligne : le changement est immédiat et visible sur la carte d'un autre téléphone client.
- [ ] Photo : prise depuis l'appareil photo et depuis la galerie ; elle s'affiche après envoi.
- [ ] Toutes les informations s'enregistrent et restent après rechargement.
- [ ] Le bouton « Enregistrer » reste sous le pouce en bas de l'écran.
- [ ] Fiche publique : note moyenne et nombre d'avis, ou « Aucun avis pour le moment » ; avis récents ; numéro masqué si l'option est décochée.

## 5. Black Friday

- [ ] Accueil : la section et le compte à rebours s'affichent ; le décompte avance chaque seconde dans les dernières 24 h.
- [ ] À 00:01 le vendredi (ou en réglant une campagne de test), la page bascule sans rechargement manuel.
- [ ] **Cartes produit** (accueil, marketplace, catégorie, recherche, boutique, favoris) : ancien prix barré, prix Black Friday, badge « 🔥 −XX % », bandeau Black Friday.
- [ ] Fiche produit : prix Black Friday.
- [ ] Panier : prix Black Friday.
- [ ] **Commande** : le total facturé est le prix Black Friday (vérifier dans « Mes commandes » et côté vendeur).
- [ ] Après la fin : les cartes, la fiche et le panier reviennent au prix normal ; la commande est facturée au prix normal.
- [ ] Vendeur : ajout d'un produit, prix, pourcentage calculé à la frappe ; modification refusée après la fin.
- [ ] Admin : programmer, désactiver, modérer une offre (le motif s'affiche chez le vendeur).

## 6. Partage

- [ ] « Partager » ouvre la feuille de partage native ; le lien collé dans WhatsApp montre un **aperçu avec image** (logo, nom, prix).
- [ ] « 📸 Image » : la feuille de partage propose l'image au format portrait ; **Instagram** figure dans la liste s'il est installé ; publier en post → l'image n'est pas rognée.
- [ ] « Story » : l'image plein écran s'ouvre dans l'éditeur de story d'Instagram.
- [ ] Pendant le Black Friday, l'image partagée porte le prix Black Friday et le badge.
- [ ] Sur ordinateur : « Image » enregistre le fichier PNG.

## 7. Louage, Pharmacie, Animaux

- [ ] Louage : liste, Appeler, WhatsApp.
- [ ] Pharmacie de garde : carte et numéros.
- [ ] Animaux : la catégorie et ses sous-catégories s'ouvrent depuis l'accueil.

## 8. Arabe et RTL

Basculer la langue sur « العربية » puis refaire un passage rapide sur chaque écran ci-dessus.

- [ ] Toute l'interface passe en arabe : Black Friday, louage, espace chauffeur, fiche chauffeur, avis, vendeur et admin Black Friday, boutons, messages d'erreur.
- [ ] Le sens de lecture est de droite à gauche ; les icônes de retour pointent à droite.
- [ ] Les prix, pourcentages (−40 %), le compte à rebours, les étoiles et les plaques restent lisibles, sans chiffres inversés.
- [ ] Aucun texte ne déborde de son bouton.
- [ ] Les images de partage restent en français (voir « Limites » dans le rapport).

## 9. Performance et affichage

- [ ] Lighthouse mobile (Chrome DevTools, « Mobile », 4G lente) sur `/accueil`, `/marketplace`, `/taxi` : noter les scores Performance et LCP.
- [ ] Aucun saut de mise en page visible au chargement des images.
- [ ] Clavier ouvert (champs du taxi, de l'espace chauffeur) : le champ actif reste visible.
- [ ] Encoche et barre de gestes (iPhone) : rien n'est caché dessous.
- [ ] Texte agrandi (« Texte plus grand ») : les écrans restent utilisables.

## Relevé

| Appareil | Navigateur | Date | Écarts constatés |
| --- | --- | --- | --- |
|  |  |  |  |
