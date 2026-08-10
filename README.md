# Mall Express Gafsa

Plateforme locale pour Gafsa : vitrine des boutiques du mall, marketplace,
ventes en direct, bons plans partagés par les habitants, services citoyens,
espace vendeur et console d'administration.

### Deux mises en page, une seule structure

Le point de bascule est **1024 px** (`lg:`), sans une ligne de JavaScript : que
des variantes Tailwind. Serveur et client rendent donc le même HTML, et il n'y
a pas de saut à l'hydratation.

| | < 1024 px | ≥ 1024 px |
|---|---|---|
| Coque | colonne de 520 px, centrée | grille `252px + 1fr`, jusqu'à 1440 px |
| Navigation | barre d'onglets en bas, libellés 9 px | colonne latérale collante, libellés 13,5 px |
| Espaces d'un compte multi-rôle | `SpaceSwitcher` en haut | listés dans la colonne latérale |
| Catalogue | 2 colonnes | 3 à 4 colonnes |
| Listes de cartes | 1 colonne | 2 colonnes |

Tout passe par [`components/shell/app-shell.tsx`](src/components/shell/app-shell.tsx),
qui prend un `contentWidth` :

- `wide` (1120 px) — catalogue, listes, tableaux de bord.
- `reading` (720 px) — obtenu en posant la classe **`col-reading`** sur le
  conteneur d'une page : formulaires, caisse, fil de messages, compte. Un champ
  de saisie de 1000 px ne se remplit pas mieux qu'un de 600.

Les onglets sont définis une seule fois, dans
[`nav-items.tsx`](src/components/shell/nav-items.tsx) : `BottomNav` et `SideNav`
lisent la même source, un onglet ajouté ne peut pas manquer d'un côté.

Les deux vitrines publiques — `/boutique/[slug]` et `/produit/[id]` — portent
leur propre coque, hors des groupes de routes. Elles s'élargissent aussi, et la
fiche produit passe en deux colonnes (photo à gauche, achat à droite) : ce sont
les pages qui arrivent depuis Google, donc les premières que voit un visiteur
sur ordinateur.

### Deux portes, deux rôles

- **`/`** — la présentation ([`src/app/page.tsx`](src/app/page.tsx)). Pleine
  largeur de bout en bout, hors coque applicative : ni barre d'onglets ni
  colonne latérale. C'est ce que voit un visiteur qui ouvre le site pour la
  première fois. Deux boutons : parcourir, ou installer.
- **`/accueil`** — le fil de l'application, dans la coque. C'est le `start_url`
  du manifeste : une fois installée, la PWA s'ouvre là, pas sur la présentation.

`/presentation` redirige en **308** vers `/`, déclaré dans
[`next.config.ts`](next.config.ts) et non dans une page : une
`permanentRedirect()` de composant part dans la charge RSC avec un statut 200,
que le navigateur suit mais qu'un robot d'indexation voit comme une page vide.

**Une seule application** — responsive du 375 px au bureau, installable en PWA.
Bilingue français / arabe avec direction RTL.

Implémentation du handoff design v3 (thème « Halo », 14 écrans).

---

## Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Front | Next.js 15 (App Router), React 19, TypeScript | SSR/ISR sur les fiches produit et boutique → référencement Google, décisif pour une marketplace locale |
| Styles | Tailwind CSS v4 (CSS-first) | Les jetons du handoff vivent dans `@theme`, un seul endroit à modifier |
| Base | Supabase (PostgreSQL, Auth, Storage, Realtime) | RLS comme unique barrière de sécurité, temps réel natif pour les lives |
| PWA | Serwist | Service worker typé, intégré au build Next |
| Live vidéo | WebRTC pair-à-pair · relais Facebook · HLS | Voir [Les lives](#les-lives) |

---

## Démarrage

```bash
npm install
cp .env.local.example .env.local     # puis remplir les valeurs
npm run dev
```

### Variables d'environnement

Tableau de bord Supabase → **Project Settings → API**.

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique, protégée par RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Serveur uniquement.** Contourne RLS. Jamais committée, jamais exposée au navigateur |
| `NEXT_PUBLIC_SITE_URL` | URL publique — redirections OAuth, sitemap, métadonnées |
| `CRON_SECRET` | Protège `/api/cron/*`. Générer avec `openssl rand -hex 32` |
| `NEXT_PUBLIC_TURN_*` | Optionnel — serveur TURN pour la diffusion caméra derrière NAT symétrique |

---

## Base de données

### Application des migrations

```bash
npx supabase link --project-ref <votre-ref>
npx supabase db push
```

Ou, sans le CLI : ouvrir chaque fichier de `supabase/migrations/` dans l'éditeur
SQL de Supabase, **dans l'ordre des noms**.

| Fichier | Contenu |
|---|---|
| `…000100_extensions_and_enums.sql` | Extensions, types énumérés |
| `…000200_tables.sql` | 32 tables |
| `…000300_functions_triggers.sql` | Fonctions métier, triggers, compteurs |
| `…000400_rls.sql` | Row Level Security — **la barrière de sécurité** |
| `…000500_storage_and_realtime.sql` | Buckets, policies de stockage, publication Realtime |
| `…000600_fix_privilege_guards.sql` | Les gardes `guard_*` ne bloquent plus l'exploitant |
| `…000700_admin_bootstrap.sql` | Premier administrateur, gestion de l'équipe |

Les deux dernières doivent souvent être appliquées à la main, sur un projet
déjà en ligne. Pour ne faire qu'un seul collage :

```bash
npm run db:sql        # réunit 06 + 07 et les met dans le presse-papiers
```

Puis Supabase → SQL Editor → New query → coller → Run, et `npm run db:check`.

### Données initiales

`supabase/seed.sql` est en deux parties :

- **Partie A — Référentiel** : catégories, services pratiques, contenus
  municipaux, horaires de prière. **Nécessaire en production.** Rejouable.
- **Partie B — Démonstration** : comptes, boutiques, produits, live, bons plans
  reproduisant les maquettes. **À ne pas charger en production.**

```bash
npx supabase db reset      # local : applique migrations + seed complet
```

En production, n'exécuter que la partie A (couper avant le repère `PARTIE B`).

Comptes de démonstration — mot de passe `demo1234` :

| Compte | Rôle |
|---|---|
| `amira@demo.gafsa` | Cliente (320 points de fidélité) |
| `zara@demo.gafsa` | Vendeuse (boutique approuvée) |
| `maisongafsa@demo.gafsa` | Vendeur (dossier en attente) |
| `admin@demo.gafsa` | Administration |

### Diagnostic

```bash
npm run db:check
```

Vérifie en une passe : variables d'environnement, connexion, présence des
32 tables, chargement du référentiel, et **liste les comptes administrateurs**.
Aucune valeur de clé n'est affichée.

C'est le premier réflexe devant un `Failed to fetch`.

### Requêtes réellement exécutées

```bash
npm run db:smoke
```

`supabase-js` ne lève jamais : une requête refusée renvoie `{ data: null,
error }`, que le code appelant lit comme « aucun résultat ». La page se rend
vide, un `if (!shop)` redirige vers l'accueil — sans une ligne dans la
console, et sans que le typecheck ni le build s'en aperçoivent : ni l'un ni
l'autre ne parle à la base.

Ce script relève chaque `.from("table").select("…")` du code, crée deux
comptes jetables — un vendeur avec boutique, un client — rejoue toutes les
requêtes avec leur jeton, puis supprime les comptes. **À lancer après toute
modification du schéma ou des policies.**

Il a déjà attrapé cinq requêtes cassées en production : `shops → categories`
et `deals → profiles` étaient ambigus — deux chemins relient ces tables, une
clé étrangère et une table de liaison — et PostgREST répondait 300 plutôt que
de choisir. Le correctif consiste à nommer la contrainte :
`categories!shops_category_id_fkey`.

### Dépannage

| Symptôme | Cause la plus fréquente |
|---|---|
| `Failed to fetch` à l'inscription | `NEXT_PUBLIC_SUPABASE_URL` absente, factice, ou avec une barre oblique finale. Lancez `npm run db:check` |
| `401` sur toutes les requêtes | L'URL et la clé viennent de **deux projets différents** |
| Pages vides mais sans erreur | `supabase-js` renvoie `{ data: null, error }` au lieu de lever. Lancez `npm run db:smoke` : il rejoue toutes les requêtes et nomme celles qui échouent |
| L'espace vendeur renvoie à l'accueil | `getMyShop()` a renvoyé `null`. Soit le compte n'a pas le rôle `vendor` (vérifiez sur `/admin/membres`), soit la requête échoue — `npm run db:smoke` |
| Modification de `.env.local` sans effet | **Redémarrez le serveur** : les variables sont lues une seule fois au démarrage |
| Première variable du fichier ignorée | `.env.local` enregistré en « UTF-8 avec BOM ». Réenregistrez en **UTF-8 sans BOM** — `db:check` le détecte |
| `relation "public.x" does not exist` | Migrations non appliquées, ou appliquées dans le désordre |
| Le projet ne répond plus après quelques jours | Les projets Supabase gratuits se mettent en pause après 7 jours d'inactivité. Réveillez-le depuis le tableau de bord |

### Configuration Supabase

**Authentication → URL Configuration**

- Site URL : votre `NEXT_PUBLIC_SITE_URL`
- Redirect URLs : `https://votre-domaine/auth/callback`

### Connexion Google et Facebook

Rien à écrire dans le code : il faut un identifiant client et un secret, obtenus
chez Google puis chez Meta, collés dans Supabase.

**1. Récupérer les identifiants**

| | Où | Quoi créer |
|---|---|---|
| Google | [console.cloud.google.com](https://console.cloud.google.com) → API et services → Identifiants | Un « ID client OAuth 2.0 », type *Application Web* |
| Facebook | [developers.facebook.com](https://developers.facebook.com) → votre app → Connexion Facebook | Produit « Connexion Facebook », en mode *Live* |

**2. Déclarer l'URI de redirection**, la même des deux côtés — c'est Supabase
qui reçoit le retour, pas votre domaine :

```
https://<ref>.supabase.co/auth/v1/callback
```

**3. Coller les identifiants** dans Supabase → Authentication → Sign In /
Providers → Google, puis Facebook.

**4. Autoriser le retour vers votre site**, dans Authentication → URL
Configuration :

```
Site URL       https://votre-domaine
Redirect URLs  https://votre-domaine/auth/callback
```

`npm run db:check` affiche l'état des deux fournisseurs et rappelle ces valeurs
avec la référence réelle de votre projet.

> **L'application n'affiche que les fournisseurs réellement utilisables.**
> [`enabledOAuthProviders()`](src/lib/auth/providers.ts) fait deux contrôles :
> le fournisseur est-il activé (`/auth/v1/settings`), et l'identifiant client
> que Supabase transmettra a-t-il la bonne forme ? Un bouton qui mène à une page
> d'erreur du fournisseur vaut moins que pas de bouton — d'autant qu'on n'en
> revient pas : « ID d'app non valide » chez Facebook ne propose qu'un retour
> vers facebook.com.

**Le piège à connaître.** Le champ « Client ID » de Supabase attend
l'identifiant de l'application chez le fournisseur, pas le nom de votre projet :

| Fournisseur | Forme attendue | Où le trouver |
|---|---|---|
| Facebook | un nombre de 15 à 17 chiffres | developers.facebook.com → Paramètres → Général → « Identifiant de l'app » |
| Google | `….apps.googleusercontent.com` | console.cloud.google.com → Identifiants |

Y coller autre chose donne exactement le message *« ID d'app non valide — L'identifiant
d'application fourni ne semble pas valide »*. `npm run db:check` lit la valeur
réellement transmise, la compare à la forme attendue, puis ouvre la page de
dialogue du fournisseur pour vérifier qu'il reconnaît bien l'application.

**Le second piège : le mode de l'application.** Une app Meta fraîchement créée
est en **Development**. Dans ce mode, seuls ses administrateurs, développeurs et
testeurs peuvent se connecter — tous les autres voient « App Not Active ». Le
passage en **Live** exige une URL de politique de confidentialité.

Ce que le code ne peut pas vérifier à votre place, et qui reste à contrôler dans
les consoles :

| Où | Quoi |
|---|---|
| Meta / Google | L'app est en mode **Live**, pas Development |
| Meta / Google | URI de redirection = `https://<ref>.supabase.co/auth/v1/callback` |
| Supabase → URL Configuration | **Redirect URLs** contient l'adresse de votre site (`http://localhost:3000/**` en local) — c'est le dernier saut, celui qui ramène le visiteur chez vous |

**En développement**, l'origine de la redirection est déduite de l'hôte réel de
la requête, pas de `NEXT_PUBLIC_SITE_URL` : cette variable traîne presque
toujours un mauvais port — `3001` quand le serveur écoute sur `3000` — et une
redirection OAuth vers le mauvais port échoue sans message exploitable. En
production, c'est l'inverse : la variable gagne, car derrière un proxy l'en-tête
`host` porte un nom interne.

**Confirmation d'e-mail — à désactiver.** Authentication → Sign In / Providers
→ décocher **Confirm email**.

Ce n'est pas une commodité de développement, c'est un prérequis. Tant que la
confirmation est active, chaque inscription envoie un courriel par le mailer
intégré de Supabase, **plafonné à quelques envois par heure**. Au-delà,
l'inscription répond `429 over_email_send_rate_limit` — pour tout le monde. Un
lancement à Gafsa se heurterait au plafond dans la première heure.

Le parti pris fonctionnel va dans le même sens : personne n'attend un courriel.
Un client entre directement ; un commerçant entre directement et attend
l'**approbation de son dossier par l'administration**, pas un lien dans sa
boîte mail.

Tant que la case reste cochée, `signUp` confirme lui-même l'adresse avec la clé
`service_role` puis ouvre la session — l'inscription n'est donc jamais bloquée,
mais le plafond d'envoi s'applique toujours. `npm run db:check` indique l'état
du réglage.

> Contrepartie assumée, dans les deux cas : rien ne prouve que l'adresse
> appartient à la personne. Pour une place de marché locale où la commande se
> règle à la livraison et où chaque boutique est validée à la main, le compromis
> est tenable. Il ne le serait pas pour du paiement en ligne.

### Administrateurs

Le rôle `admin` ne peut jamais être demandé à l'inscription : le trigger
`handle_new_user` le neutralise, et `guard_profile_privileges` empêche
quiconque de modifier son propre rôle. Personne ne se promeut seul — il faut
donc un amorçage hors application.

**Le premier.** Ouvrir
`supabase/migrations/20260810000700_admin_bootstrap.sql`, renseigner l'adresse
et le mot de passe dans le bloc en tête de fichier, puis coller le tout dans
l'éditeur SQL de Supabase. Le compte est créé dans `auth.users` — mot de passe
haché en bcrypt, e-mail déjà confirmé — et promu dans la foulée. Si l'adresse
existe déjà, le mot de passe est simplement réinitialisé.

> Le mot de passe est en clair dans ce fichier le temps de l'exécution.
> Le changer depuis `/profil/reglages` à la première connexion, puis le
> remplacer par une valeur factice dans le fichier.

**Les suivants.** Depuis l'application, sur `/admin/membres` : « Ajouter un
administrateur », l'adresse d'un compte existant, et c'est fait. C'est la voie
normale — l'éditeur SQL ne sert qu'une fois.

En ligne de commande, si besoin :

```bash
npm run db:make-admin -- collegue@exemple.com
```

**Deux garde-fous** tiennent en SQL, donc valables quelle que soit la voie
employée : on ne retire pas son propre rôle d'administrateur, et il en reste
toujours au moins un.

Vérifier avec `npm run db:check`, qui liste les administrateurs, ou :

```sql
select p.role, u.email, p.first_name, p.last_name
from public.profiles p join auth.users u on u.id = p.id
where p.role = 'admin';
```

Le compte bascule sur `/admin` à la connexion. Un vendeur bascule sur
`/vendeur`.

### Types TypeScript

`src/types/database.ts` est écrit à la main pour correspondre aux migrations.
Après toute modification du schéma, **régénérer plutôt que corriger** :

```bash
npm run db:types
```

Le bloc `Relationships` de chaque table n'est pas décoratif : sans lui, les
jointures imbriquées (`select("*, shop:shops(name)")`) se typent en `never`.

---

## Sécurité

Le navigateur n'utilise que la clé `anon`. **Les policies RLS sont la seule
barrière réelle** entre un visiteur et les données. Points structurants :

- RLS activée **et forcée** sur les 32 tables ; aucune policy permissive par défaut.
- **Les commandes ne sont jamais insérées depuis le client.** `orders.Insert` est
  typé `never` et aucune policy INSERT n'existe : tout passe par la fonction
  `place_order`, qui calcule le total, applique la remise live et décrémente le
  stock sous verrou. Un client ne peut pas fixer son prix.
- Des triggers `guard_*` neutralisent l'élévation de privilèges : un client ne
  se promeut pas vendeur, un vendeur ne s'auto-approuve pas, un auteur ne
  décerne pas son propre badge « Vérifié ».
- `award_points` est révoquée pour `anon` et `authenticated` : les points ne
  s'attribuent que depuis des fonctions `SECURITY DEFINER`.
- Toutes les fonctions `SECURITY DEFINER` fixent `search_path`.
- Les liens Facebook des lives sont validés contre une liste d'hôtes connus
  avant d'entrer dans une iframe.
- CSP, HSTS et `Permissions-Policy` dans `next.config.ts`.

---

## Les lives

L'écran 4 superpose deux couches indépendantes.

**La couche commerce est entièrement réelle**, quelle que soit la source vidéo :
commentaires temps réel (Postgres Changes), compteur de spectateurs (Presence),
produit épinglé modifiable en direct, compte à rebours de l'offre, et achat
sans quitter le flux.

**La couche vidéo est polymorphe** — le vendeur choisit à la création :

| Source | Transport | Plafond | Mise en œuvre |
|---|---|---|---|
| `camera` | WebRTC pair-à-pair, signalisation via Supabase Realtime | ~8 spectateurs | Le téléphone du vendeur encode un flux par spectateur. Au-delà, la qualité se dégrade pour tous : `MAX_VIEWERS` fait barrage et l'interface oriente vers Facebook |
| `facebook` | Plugin vidéo officiel Facebook | illimité | Le vendeur diffuse depuis l'application Facebook ; le direct est relayé ici avec ses produits |
| `hls` | Flux `.m3u8` externe | illimité | Prêt pour Mux, Cloudflare Stream ou une sortie LiveKit |

Pour une grande audience en caméra directe sans changer l'interface : brancher
un SFU (LiveKit) et alimenter la source `hls`. Le lecteur est déjà polymorphe,
rien d'autre ne bouge.

### Relayer un direct Facebook

Le parcours vendeur : lancer le direct sur sa page Facebook, puis
`/vendeur/lives/nouveau` → source **Direct Facebook** → coller le lien de la
vidéo → **Démarrer le direct** depuis la console. Rien à capturer côté
navigateur : la vidéo est servie par Facebook, notre site pose la couche
commerce par-dessus.

Ce que voient les clients sur `/lives/[id]`, quelle que soit la source :
commentaires en temps réel, réactions, compteur de spectateurs, produit épinglé,
remise live, et achat sans quitter le flux.

**Le lien collé doit être un permalien de vidéo complet.**
[`normalizeFacebookLiveUrl()`](src/lib/live/facebook.ts) le vérifie et le
nettoie, parce que deux formes échouent en silence — l'iframe s'affiche noire,
sans message, en pleine vente :

| Refusé | Pourquoi |
|---|---|
| `https://fb.watch/abc123/` | Lien court, que le greffon ne résout pas |
| `https://www.facebook.com/mapage` | Page, pas vidéo : iframe vide |
| `http://…` | Le greffon exige HTTPS |

`m.facebook.com` est ramené à `www.facebook.com`, et les paramètres de suivi
(`fbclid`, `mibextid`) sont retirés. Chaque refus explique la manœuvre à faire.

Deux conditions restent du côté de Facebook : **la vidéo doit être publique**, et
le greffon n'accepte pas les vidéos réservées à une audience restreinte.

Une Wake Lock maintient l'écran du vendeur allumé pendant sa diffusion.

---

## PWA

- Manifeste avec raccourcis (Marketplace, Lives, Bons plans, Services).
- Service worker à trois règles : **rien de personnel ou de transactionnel en
  cache** (panier, commandes, session, tout Supabase), images produits en cache
  long, reste en *stale-while-revalidate*. Page `/hors-ligne` en repli.
- Invitation à l'installation, refusable — et pas represéntée avant 30 jours.
- Gestionnaires `push` / `notificationclick` en place : brancher Web Push sur la
  table `notifications` ne demandera pas de retoucher le service worker.

Régénérer les icônes après modification de `public/icons/icon.svg` :

```bash
node scripts/generate-icons.mjs
```

---

## Bilingue et accessibilité

La bascule FR / العربية est **globale et en cookie**, pas dans l'URL : le
handoff décrit une puce dans la barre d'accessibilité, pas un changement de
page. Les URLs restent uniques, ce qui évite de diluer le référencement.

Les composants utilisent les propriétés logiques (`ps-`, `me-`, `start-`) :
le miroir RTL est automatique.

Trois réglages persistés (cookie + profil, donc retrouvés sur un autre appareil) :
**Texte plus grand** (3 crans, `rem` partout), **Mode simplifié** (contrastes
renforcés), **langue**. Cibles tactiles ≥ 44 px, `prefers-reduced-motion`
respecté, zoom navigateur jamais bloqué.

---

## Tâches périodiques

`GET /api/cron/maintenance` — expiration des bons plans et recalcul de l'état
d'ouverture des boutiques. Protégée par `CRON_SECRET` (comparaison à durée
constante).

Sur Vercel, `vercel.json` la planifie toutes les 15 minutes. Ailleurs, activer
`pg_cron` sur Supabase :

```sql
select cron.schedule('meg-maintenance', '*/15 * * * *', $$
  select public.expire_stale_deals();
  select public.refresh_shops_open_state();
$$);
```

---

## Déploiement

```bash
npm run build
```

1. Appliquer les migrations et la partie A du seed.
2. Renseigner les variables d'environnement chez l'hébergeur.
3. Configurer les URLs de redirection Supabase sur le domaine de production.
4. Déployer. Sur Vercel, le cron est repris de `vercel.json`.
5. Créer le premier compte administrateur (voir **Administrateurs**), puis
   nommer les suivants depuis `/admin/membres`.

---

## Structure

```
src/
├── app/
│   ├── (client)/          écrans 1, 2, 5, 7, 11, 12 + panier, commandes
│   ├── (auth)/            écran 13 — inscription et connexion
│   ├── produit/[id]/      écran 3   — indexable
│   ├── boutique/[slug]/   écran 6   — indexable, ISR
│   ├── lives/[id]/        écran 4   — direct plein écran
│   ├── vendeur/           écrans 8, 9, 10 + console de diffusion
│   ├── admin/             écran 14 + modération
│   ├── actions/           Server Actions — toutes les écritures
│   └── api/cron/          tâches périodiques
├── components/
│   ├── ui/                briques du système « Halo »
│   ├── shell/             barres supérieure, onglets, recherche, accessibilité
│   ├── live/              lecteur polymorphe, salle, console vendeur
│   └── pwa/               service worker, hors ligne, installation
├── lib/
│   ├── supabase/          clients navigateur / serveur / middleware / build
│   ├── i18n/              dictionnaires FR-AR, préférences
│   └── live/webrtc.ts     diffusion et réception WebRTC
└── types/database.ts      schéma typé

supabase/
├── migrations/            schéma, RLS, storage, realtime
└── seed.sql               référentiel (A) + démonstration (B)
```

---

## Correspondance écran → route

| # | Écran du handoff | Route | Rendu |
|---|---|---|---|
| 1 | Accueil / Fil | `/` | ISR 60 s |
| 2 | Marketplace | `/marketplace` | ISR 120 s |
| 3 | Fiche produit | `/produit/[id]` | ISR 300 s · **indexable** · JSON-LD `Product` |
| 4 | Live plein écran | `/lives/[id]` | dynamique |
| 5 | Services citoyens | `/services` | ISR 900 s |
| 6 | Profil boutique | `/boutique/[slug]` | SSG + ISR · **indexable** · JSON-LD `Store` |
| 7 | Profil utilisateur | `/profil` | dynamique |
| 8 | Vendeur — tableau de bord | `/vendeur` | dynamique |
| 9 | Vendeur — produits & stock | `/vendeur/produits` | dynamique |
| 10 | Vendeur — réglages boutique | `/vendeur/reglages` | dynamique |
| 11 | Bons plans | `/bons-plans` | dynamique |
| 12 | Publier un bon plan | `/bons-plans/nouveau` | dynamique |
| 13 | Inscription | `/inscription` · `/connexion` | dynamique |
| 14 | Administration | `/admin` | dynamique |

Écrans appelés par les maquettes sans y figurer, construits pour qu'aucun lien
ne mène nulle part :

| Route | Rôle |
|---|---|
| `/panier`, `/commandes` | Passage en caisse (une commande par boutique) et suivi |
| `/lives` | Liste des directs — en cours, à venir, passés |
| `/notifications` | Fil de notifications, marquage lu |
| `/messages`, `/messages/[id]` | Messagerie client ↔ boutique, temps réel |
| `/profil/reglages` | Identité, langue, accessibilité, mot de passe |
| `/profil/favoris` | Produits favoris et boutiques suivies |
| `/profil/demarches` | Suivi des démarches déposées |
| `/bons-plans/[id]` | Détail d'un bon plan, votes et commentaires |
| `/services/demarche/[id]` | Dépôt d'une démarche avec pièces jointes |
| `/vendeur/commandes` | File des commandes, avancement du statut |
| `/vendeur/promotions` | Création et activation des promotions |
| `/vendeur/lives/[id]` | Console de diffusion |
| `/` | **Porte d'entrée du site** : le projet, le fonctionnement, l'équipe, le contact. Pleine largeur, animée au défilement, deux appels à l'action — parcourir ou installer. `/presentation` y redirige en 308 |
| `/accueil` | Fil de l'application : lives, promotions, catégories, services. C'est le `start_url` de la PWA |
| `/vendeur/creer` | Boutique d'un vendeur qui n'en a pas encore |
| `/admin/boutiques` | Validation des dossiers, mise à la une |
| `/admin/membres` | Annuaire avec adresses, rôles, suspension, nomination d'administrateurs |
| `/admin/signalements` · `/admin/categories` | Modération, gestion des teintes |
| `/admin/sponsors` · `/admin/reglages` | Régie publicitaire, pilotage |
| `/hors-ligne` | Repli du service worker |

Next.js ne signale pas un `<Link>` vers une page inexistante — la faute
n'apparaît qu'au clic, en 404. Un script compare donc les liens écrits à
l'arborescence réelle :

```bash
npm run check:links
```

---

## Écarts assumés par rapport au handoff

- **Inscription.** Le README du handoff décrit une entrée par SMS sans mot de
  passe ; la maquette v3 — référence principale — montre e-mail + mot de passe,
  avec Google et Facebook. C'est la maquette qui a été suivie : elle est plus
  récente, et l'OTP par SMS suppose un contrat opérateur (Twilio ou équivalent)
  qui n'est pas encore pris. Le passage au SMS ne toucherait que l'écran 13 et
  la configuration Supabase.
- **Carte de localisation** (écrans 3 et 10) : laissée en zone hachurée tant
  qu'aucun fournisseur cartographique n'est choisi. Une image décorative qui ne
  localise rien serait pire qu'un emplacement honnête. Les colonnes
  `latitude` / `longitude` existent déjà.
- **Photos.** Toutes les zones hachurées sont des emplacements attendant de
  vraies images. Le téléversement fonctionne (compression navigateur puis
  Supabase Storage) ; ce sont les visuels qui manquent.
