import { NextResponse } from "next/server";
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/**
 * Manifeste PWA de « Taxi & Louage Gafsa » (src/lib/transport.ts).
 *
 * Servi sur le domaine de transport, déclaré par le gabarit racine quand
 * l'intergiciel signale cette application : elle s'installe sur le
 * téléphone comme une application distincte de G-Mall, avec son nom, son
 * icône ambre et ses raccourcis.
 */
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    name: "Taxi & Louage Gafsa",
    short_name: "Taxi Gafsa",
    description: "Commandez un taxi à Gafsa en quelques minutes, réservez votre place en louage.",
    id: "/?app=transport",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14161c",
    theme_color: "#14161c",
    lang: "fr",
    dir: "auto",
    categories: ["travel", "navigation", "lifestyle"],
    icons: [
      { src: "/transport-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/transport-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/transport-icon/masquable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Commander un taxi", short_name: "Taxi", url: "/taxi", icons: [{ src: "/transport-icon/192", sizes: "192x192" }] },
      { name: "Départs de louage", short_name: "Louage", url: "/louage", icons: [{ src: "/transport-icon/192", sizes: "192x192" }] },
      { name: "Mes courses", short_name: "Courses", url: "/courses", icons: [{ src: "/transport-icon/192", sizes: "192x192" }] },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "content-type": "application/manifest+json; charset=utf-8" },
  });
}
