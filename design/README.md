# Référence de design — G-Mall v3

Dossier de **référence visuelle uniquement**. Rien ici n'est compilé ni
déployé : `tsconfig.json` et `eslint.config.mjs` l'excluent.

| Fichier | Rôle |
|---|---|
| `G-Mall v3.dc.html` | Les 14 écrans côte à côte. **S'ouvre directement dans un navigateur.** |
| `ios-frame.jsx`, `support.js` | Mécanique d'affichage des maquettes. Non portée. |

L'implémentation se trouve dans `src/`. Le tableau de correspondance
écran → route est en bas du [README principal](../README.md).

## Jetons repris dans le code

Tous transposés dans `src/app/globals.css`, bloc `@theme` :

| Rôle | Valeur |
|---|---|
| Fond application | `#f4f1fa` |
| Surface carte | `rgba(255,255,255,.85)` + bordure `rgba(255,255,255,.9)` |
| Ombre carte | `0 6px 18px rgba(60,40,90,.07)` |
| Marque | `#6d4b8f` · teinte `rgba(109,75,143,.10)` |
| Texte | principal `#241f2e` · secondaire `#6f6880` · tertiaire `#a79fb5` |
| Accent live | `oklch(.52 .17 10)` |
| Séparateur / bordure | `rgba(60,40,90,.09)` / `rgba(60,40,90,.14)` |
| Dégradé | `linear-gradient(135deg,#6d4b8f,#241f2e)` |
| Rayons | carte 18 · vignette 16 · petite vignette 14 · chip 12–14 · flottant 24 |
| Police | Cairo 400–800 (latin + arabe), servie par `next/font` |

### Couleurs par catégorie

Règle systémique : `oklch(.47 .12 <teinte>)` pour le texte,
`color-mix(in srgb, <même couleur> 14%, #f4f1fa)` pour le fond.

La teinte vit en base (`categories.hue`) et arrive dans le CSS par la variable
`--hue` posée en style inline. **Ajouter une catégorie = choisir une teinte**,
depuis `/admin/categories`, qui en affiche l'aperçu en direct. Aucun code à
modifier.
