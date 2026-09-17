import { NextResponse } from "next/server";
import type { MetadataRoute } from "next";
import { lireMarque } from "@/lib/brand";

/*
  Plus figé : les adresses des icônes portent la date du logo (voir
  `lireMarque`), et un manifeste figé les gèlerait au jour de la
  construction. La lecture est mise en cache une minute ; le coût est nul.
*/
export const revalidate = 60;

/**
 * Manifeste PWA, servi par une route et non par `app/manifest.ts`.
 *
 * `display: standalone` + `start_url` sur `/accueil` : une fois installée,
 * l'application s'ouvre sur le fil, sans barre d'adresse.
 *
 * Pourquoi : `app/manifest.ts` fait émettre à Next un `<link rel="manifest">`
 * automatique, sans attribut `crossorigin`. Le navigateur récupère alors le
 * manifeste sans cookie, et derrière tout portail à session — la Deployment
 * Protection de Vercel, un intranet — la requête est redirigée vers un autre
 * domaine : `ERR_FAILED` en boucle, invitation à installer cassée, et
 * préchargement du service worker en échec.
 *
 * Impossible de lui ajouter `crossorigin` ; en déclarant le lien nous-mêmes
 * dans `<head>` et en servant le manifeste ici, il n en reste qu un seul.
 */
export async function GET() {
  const { version } = await lireMarque();

  const manifest: MetadataRoute.Manifest & {
    share_target?: unknown;
  } = {
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

    /*
      L'icône installée sur le téléphone, depuis le logo de l'administration.

      Les adresses restent fixes — le manifeste peut donc rester statique —
      et c'est la route `/brand-icon/` qui lit le logo en vigueur. Changer le
      logo change l'icône des nouvelles installations, sans reconstruction.

      La variante « masquable » garde sa marge : Android la découpe selon la
      forme du lanceur, et un logo bord à bord y perdrait ses coins.
    */
    icons: [
      { src: `/brand-icon/192.png?v=${version}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/brand-icon/512.png?v=${version}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/brand-icon/maskable-512.png?v=${version}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],

    // Raccourcis à l'appui long sur l'icône installée
    shortcuts: [
      {
        name: "Passer en direct",
        short_name: "Direct",
        url: "/vendeur/lives/partage",
        icons: [{ src: `/brand-icon/192.png?v=${version}`, sizes: "192x192" }],
      },
      {
        name: "Marketplace",
        short_name: "Marketplace",
        url: "/marketplace",
        icons: [{ src: `/brand-icon/192.png?v=${version}`, sizes: "192x192" }],
      },
      {
        name: "Ventes en direct",
        short_name: "Lives",
        url: "/lives",
        icons: [{ src: `/brand-icon/192.png?v=${version}`, sizes: "192x192" }],
      },
      {
        name: "Bons plans",
        short_name: "Bons plans",
        url: "/bons-plans",
        icons: [{ src: `/brand-icon/192.png?v=${version}`, sizes: "192x192" }],
      },
      {
        name: "Services citoyens",
        short_name: "Services",
        url: "/services",
        icons: [{ src: `/brand-icon/192.png?v=${version}`, sizes: "192x192" }],
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
  };

  // Le type MIME exact du manifeste : certains navigateurs refusent un
  // `application/json` générique.
  return NextResponse.json(manifest, {
    headers: { "content-type": "application/manifest+json; charset=utf-8" },
  });
}
