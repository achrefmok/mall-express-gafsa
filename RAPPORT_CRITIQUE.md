# Rapport de Critique Complète — G-Mall

> **Date :** 26 août 2026
> **Objectif :** Audit complet du site sans modification de code
> **Périmètre :** Architecture, sécurité, performance, UX, accessibilité, SEO, i18n, PWA, CI/CD

---

## Résumé Exécutif

G-Mall est une plateforme e-commerce locale ambitieuse et techniquement impressionnante. Le codebase est mature, bien documenté (en français), et suit des patterns cohérents. Cependant, **22 problèmes critiques/élevés** nécessitent une attention immédiate, ainsi que de nombreuses améliorations moyennes et faibles.

| Sévérité | Nombre |
|----------|--------|
| 🔴 Critique | 5 |
| 🟠 Élevée | 10 |
| 🟡 Moyenne | 12 |
| 🟢 Faible | 15 |
| **Total** | **42** |

---

## 🔴 PROBLÈMES CRITIQUES (5)

### C1. Aucun test automatisé dans tout le codebase

**Impact :** Aucune filet de sécurité pour les régressions.

- Zéro fichier `*.test.*`, `*.spec.*`, `__tests__/`
- Aucun framework de test configuré (Jest, Vitest, Playwright, Cypress)
- Le script `package.json` ne contient pas de commande `test`
- Le pipeline CI (`ci.yml`) ne lance aucun test
- Le script `db:smoke` (documentation critique) n'est pas automatisé

### C2. Identifiants TURN exposés dans le bundle client

**Fichier :** `src/lib/live/webrtc.ts:37-42`

Les variables `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME` et `NEXT_PUBLIC_TURN_CREDENTIAL` sont préfixées `NEXT_PUBLIC_`, donc visibles dans le JavaScript côté client via DevTools. N'importe qui peut extraire ces identifiants et utiliser votre serveur TURN comme relais gratuit pour tout trafic.

**Recommandation :** Générer des credentials temporaires via un endpoint serveur.

### C3. CSP contient `unsafe-eval`

**Fichier :** `next.config.ts:70`

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net
```

`unsafe-eval` désactive le bénéfice principal du CSP (empêcher l'exécution de scripts injectés). Les versions modernes de Next.js ne devraient pas nécessiter `unsafe-eval`. Cela augmente significativement la surface d'attaque XSS.

### C4. Aucune limitation de débit sur les Server Actions d'authentification

**Fichier :** `src/app/actions/auth.ts`

- `signUp`, `signIn`, `requestPasswordReset` n'ont aucune rate limiting
- Un attaquant peut forcer des mots de passe en brute-force
- Pas de mécanisme de verrouillage de compte après échecs répétés
- Supabase a une rate limiting intégrée, mais elle est insuffisante pour `signIn`

### C5. Aucun suivi d'erreurs ni monitoring de performance

**Impact :** Les erreurs en production sont invisibles.

- Pas de Sentry, Datadog, New Relic, ni aucun outil de tracking
- Pas de surveillance Core Web Vitals
- Pas de métriques de performance API
- Seul `console.error` dans les error boundaries — des logs qui disparaissent en production

---

## 🟠 PROBLÈMES ÉLEVÉS (10)

### E1. Page produit en `force-dynamic` mal être l'entrée SEO principale

**Fichier :** `src/app/produit/[id]/page.tsx:30`

La page produit est l'entrée principale Google, mais elle est entièrement dynamique (pas de cache). Chaque visite interroge Supabase, ce qui est un goulot d'étranglement de performance et de coût. Le commentaires du code (lignes 20-29) reconnaissent cette limitation architecturale.

### E2. Middleware interroge la base de données à chaque requête

**Fichier :** `src/lib/supabase/middleware.ts`

- Chaque requête déclenche `supabase.auth.getUser()` (appel réseau)
- Pour les routes vendeur/admin : jusqu'à 3 requêtes DB supplémentaires
- Un utilisateur naviguant vers `/vendeur` déclenche 3 allers-retours DB séquentiels avant même le rendu de la page
- Depuis la Tunisie vers le serveur Supabase + Vercel (Paris), cela ajoute une latence significative

### E3. Pas de pagination sur le marketplace

**Fichier :** `src/app/(client)/marketplace/page.tsx:51`

Les produits sont récupérés avec `.limit(40)`. Pas de "charger plus", pas de scroll infini. Si une boutique a 200 produits, seuls les 40 premiers sont affichés sans possibilité d'en voir davantage.

### E4. `dangerouslySetInnerHTML` pour JSON-LD sans sanitisation

**Fichiers :** `src/app/produit/[id]/page.tsx:135`, `src/app/boutique/[slug]/page.tsx:185`

Si un nom de produit ou description contenait `</script>`, cela casserait le bloc JSON-LD. Il faut échapper `<`, `>`, et `&` dans la sortie stringifiée.

### E5. Messages d'erreur PostgREST exposés au client

**Fichier :** `src/app/actions/_helpers.ts:94`

Le cas `default` retourne `error.message` directement au client. Certains messages PostgREST contiennent des détails internes (noms de colonnes, contraintes, structures de tables). Seul le cas `P0001` devrait transmettre le message brut.

### E6. Pages critiques publiques sans error boundary dédiée

- Pas de `error.tsx` dans `src/app/produit/[id]/` (page produit — critique SEO)
- Pas de `error.tsx` dans `src/app/boutique/[slug]/` (page boutique — critique SEO)
- Pas de `error.tsx` dans `src/app/lives/[id]/` (page live)

Ces pages retombent sur le `error.tsx` parent, ce qui fonctionne mais ne fournit pas d'interface de récupération ciblée.

### E7. Le workflow de déploiement n'est pas verrouillé sur le CI

**Fichier :** `.github/workflows/deploy.yml`

Un push vers `main` déclenche `ci.yml` et `deploy.yml` en parallèle. Le déploiement peut réussir même si les vérifications CI échouent. Il devrait y avoir un `needs: [ci-job]`.

### E8. Pas de vérification client-side du format de téléphone à la commande

**Fichier :** `src/app/(client)/panier/cart-client.tsx:361-369`

Le champ téléphone accepte n'importe quel texte. L'action serveur ne vérifie que `if (!phone)` (cart.ts:165), pas le format. Un utilisateur pourrait saisir "abc" et procéder au paiement.

### E9. Panier redirige vers connexion sans guest checkout

**Fichier :** `src/app/(client)/panier/page.tsx:20`

La page panier redirige vers la connexion si non authentifié. La landing page dit "Le compte peut attendre" (page.tsx:494), mais le panier et le checkout exigent un compte. Cela crée une friction — les utilisateurs naviguent librement mais cognent un mur à l'achat.

### E10. Commandes en direct sans temps réel pour le vendeur

**Fichier :** `src/app/vendeur/page.tsx:31-59`

Le tableau de bord vendeur interroge Supabase au rendu mais n'a aucun abonnement temps réel. Un vendeur attendant des commandes doit rafraîchir manuellement la page. Les pages taxi et live utilisent le polling/realtime, mais pas le tableau de bord des commandes.

---

## 🟡 PROBLÈMES MOYENS (12)

### M1. Bundle framer-motion chargé eager dans 6+ composants taxi

6 composants taxi importent `AnimatePresence` et `m` directement depuis `"framer-motion"` sans lazy loading, alors que des animations CSS équivalentes existent déjà dans `globals.css`.

### M2. `@types/leaflet` dans `dependencies` au lieu de `devDependencies`

**Fichier :** `package.json:33` — Package de types uniquement, devrait être en devDependencies.

### M3. Pas de budget de performance dans le CI

Le pipeline CI vérifie que le code compile, mais pas les régressions de taille de bundle, LCP, ou Core Web Vitals.

### M4. Strings françaises hardcodées dans le panneau admin

**Fichiers :** `src/app/admin/admin-client.tsx:321,328,338,346,357` — Labels `aria-label` en français hardcodés au lieu d'utiliser les clés de traduction.

### M5. Page 404 avec texte français hardcodé

**Fichier :** `src/app/not-found.tsx:10-12` — Le titre et la description sont en français au lieu d'utiliser le dictionnaire i18n.

### M6. Page erreur avec texte français hardcodé

**Fichier :** `src/app/error.tsx:51` — `"Réessayez dans un instant..."` est hardcodé en français.

### M7. Strings arabes hardcodées sur la page taxi

**Fichier :** `src/app/(client)/taxi/page.tsx:86` — `تاكسي قفصة` affiché quelle que soit la langue, pouvant confondre les utilisateurs francophones.

### M8. Cache stats landing page trop court (5 min)

**Fichier :** `src/app/page.tsx:152` — `revalidate: 300` = 4 requêtes Supabase/heure pour les mêmes 4 counts. Pourrait être 30-60 min.

### M9. OpenGraph type `"website"` au lieu de `"product"` sur les pages produit

**Fichier :** `src/app/produit/[id]/page.tsx:62` — Pourrait activer des aperçus riches sur Facebook/WhatsApp avec prix et disponibilité.

### M10. JSON-LD produit manque `url`, `sku`, `itemCondition`, `category`

**Fichier :** `src/app/produit/[id]/page.tsx:114-129` — Recommandé par Google pour les rich results.

### M11. Pas de barème de force du mot de passe à l'inscription

**Fichier :** `src/app/(auth)/inscription/sign-up-screen.tsx:172-191` — Seule validation : `minLength={8}`. Pas d'indicateur, pas de feedback sur les exigences (majuscules, chiffres, etc.) avant l'échec de soumission.

### M12. Le service worker a un timeout réseau de 4 secondes

**Fichier :** `src/sw.ts:148` — Sur les connexions 3G tunisiennes lentes, cela peut être trop agressif — les utilisateurs voient du contenu cache périmé même quand le réseau est juste lent.

---

## 🟢 PROBLÈMES FAIBLES (15)

| # | Problème | Fichier |
|---|----------|---------|
| L1 | `Avatar` utilise `<img>` au lieu de `next/image` | `primitives.tsx:605-615` |
| L2 | `tones` map dupliquée dans `Chip` et `Tag` | `primitives.tsx:195-241` |
| L3 | `ButtonLink` duplique la logique de `Button` | `primitives.tsx:308-338` |
| L4 | ESLint utilise `FlatCompat` legacy | `eslint.config.mjs:3-7` |
| L5 | Assertions non-nulles sur variables d'env sans validation runtime | `supabase/server.ts:16-17` |
| L6 | Skeleton shimmer hardcode les couleurs au lieu des variables CSS | `globals.css:363-374` |
| L7 | `aria-hidden` inconditionnel sur `Avatar` (les initiales disparaissent des lecteurs d'écran) | `primitives.tsx:644` |
| L8 | Dot vert "live" non communiqué aux lecteurs d'écran | `page.tsx:218-219` |
| L9 | Images produit dans le panier avec `alt=""` | `cart-client.tsx:218` |
| L10 | Like button dans le live sans label accessible pour le compteur | `live-room.tsx:477-480` |
| L11 | Toggle mot de passe sans `aria-pressed` | `sign-up-screen.tsx:183-189` |
| L12 | `select("*")` pour les chauffeurs taxi (toutes les colonnes) | `taxi-client.tsx:128` |
| L13 | Cache images service worker limité à 300 entrées | `sw.ts:90` |
| L14 | 5 poids de Cairo chargés eager (poids 500 et 800 rarement utilisés) | `layout.tsx:20-25` |
| L15 | Filtre `brightness()` dark mode sur toutes les images (risque de jank) | `globals.css:230-232` |

---

## Points Forts (ce qui est bien fait)

| Domaine | Détail |
|---------|--------|
| **Sécurité webhook** | Facebook webhook utilise HMAC-SHA256 avec `timingSafeEqual` |
| **Garde `server-only`** | `supabase/server.ts` et `facebook-graph.ts` empêchent la fuite côté client |
| **Vérification ban** | `requireProfile` vérifie `is_banned` à chaque Server Action |
| **Prix côté serveur** | Le total de commande est calculé par `place_order` RPC — pas de manipulation client |
| **Pattern d'erreur** | Toutes les Server Actions utilisent `ActionResult` avec `fail()`/`done()`/`ok()` |
| **Dark mode tokens** | Implémenté purement via variables CSS, pas de classes par composant |
| **Skip-to-content** | Présent dans `layout.tsx` |
| **Reduced motion** | Toutes les animations neutralisées sous `prefers-reduced-motion` |
| **Limites tactiles** | Cibles minimum 44px |
| **Zoom non bloqué** | `maximumScale: 5` avec commentaire expliquant pourquoi `1` est incorrect |
| **i18n FR/AR** | 1600+ lignes de traductions, support RTL via propriétés logiques CSS |
| **Font Cairo** | Couvre latin + arabe, servi localement (pas de roundtrip Google Fonts) |
| **RLS** | Activé et appliqué sur les 32 tables de la base |
| **Headers sécurité** | CSP, HSTS, X-Frame-Options, Permissions-Policy configurés |
| **Types complets** | `database.ts` = 1245 lignes avec Row/Insert/Update/Relationships pour chaque table |
| **85 directives `"use client"`** | La frontière server/client est clairement tracée |
| **Structure data** | JSON-LD présent sur les pages produit et boutique |
| **PWA complète** | Manifest, service worker, offline fallback, share_target |
| **ISR correct** | La page boutique utilise ISR + `generateStaticParams()` |

---

## Recommandations par Priorité

### P0 — Immédiat (sécurité)
1. Déplacer les credentials TURN côté serveur (endpoint temporaire)
2. Retirer `unsafe-eval` du CSP
3. Ajouter la rate limiting sur les actions d'auth
4. Installer un outil de monitoring d'erreurs (Sentry)

### P1 — Court terme (1-2 semaines)
5. Ajouter des tests unitaires (Vitest) + E2E (Playwright)
6. Rendre les pages produit cacheables (ISR au lieu de force-dynamic)
7. Ajouter la pagination au marketplace
8. Sanitiser le JSON-LD (`dangerouslySetInnerHTML`)
9. Masquer les messages d'erreur PostgREST au client
10. Verrouiller le déploiement sur le CI

### P2 — Moyen terme (1 mois)
11. Optimiser le middleware (cache de session, batch queries)
12. Ajouter le guest checkout
13. Ajouter le temps réel sur le tableau de bord vendeur
14. Compléter l'i18n (strings hardcodées → dictionnaire)
15. Ajouter les error boundaries sur les pages SEO critiques
16. Lazy charger framer-motion dans les composants taxi
17. Valider le format de téléphone côté client

### P3 — Long terme
18. Système d'avis/notes produits
19. Suivi de commande avec timeline de livraison
20. Budget de performance dans le CI
21. URLs SEO-friendly pour les produits (slugs)
22. Monitorer Core Web Vitals en production

---

*Rapport généré sans modification de code. Chaque problème inclut le fichier et la ligne concernée pour faciliter la résolution.*
