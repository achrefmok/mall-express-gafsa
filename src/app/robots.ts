import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const base = siteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/admin",
          "/vendeur",
          "/panier",
          "/commandes",
          "/profil",
          "/messages",
          "/connexion",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
