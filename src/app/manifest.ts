import type { MetadataRoute } from "next";

/**
 * Manifeste PWA. `display: standalone` + `start_url` sur l'accueil : une
 * fois installée, l'application s'ouvre sans barre d'adresse, comme une
 * application native.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mall Express Gafsa",
    short_name: "Mall Express",
    description:
      "Les boutiques du mall de Gafsa : marketplace, ventes en direct, bons plans et services citoyens.",
    id: "/",
    start_url: "/accueil",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f1fa",
    theme_color: "#f4f1fa",
    lang: "fr",
    dir: "auto", // bascule automatiquement en RTL quand l'interface passe en arabe
    categories: ["shopping", "lifestyle", "business"],

    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],

    // Raccourcis à l'appui long sur l'icône installée
    shortcuts: [
      {
        name: "Marketplace",
        short_name: "Marketplace",
        url: "/marketplace",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Ventes en direct",
        short_name: "Lives",
        url: "/lives",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Bons plans",
        short_name: "Bons plans",
        url: "/bons-plans",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Services citoyens",
        short_name: "Services",
        url: "/services",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],

    /*
      Cible de partage.

      Rend l'application choisissable dans la feuille « Partager » du système.
      Un commerçant qui diffuse depuis son profil Facebook — cas où la Graph API
      n'expose rien — touche « Partager » sur sa vidéo, choisit Mall Express, et
      le lien arrive ici sans qu'il ait à le copier.

      Pris en charge par Chrome et Edge sur Android, une fois l'application
      installée. Safari iOS ne l'implémente pas : là-bas, le bouton
      « Coller le lien copié » de l'écran de diffusion fait le même travail.

      Absent du type Manifest de Next, qui suit une version plus ancienne de la
      spécification — d'où l'élargissement ci-dessous.
    */
    share_target: {
      action: "/vendeur/lives/partage",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: { title: "titre", text: "texte", url: "lien" },
    },
  } as MetadataRoute.Manifest & {
    share_target: {
      action: string;
      method: string;
      enctype: string;
      params: Record<string, string>;
    };
  };
}
