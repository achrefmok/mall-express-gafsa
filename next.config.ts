import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co").hostname;
  } catch {
    return "placeholder.supabase.co";
  }
})();

/**
 * En-têtes de sécurité. `frame-src` autorise Facebook : l'écran Live peut
 * relayer un direct Facebook (source `facebook`) via le plugin vidéo officiel.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    // camera/microphone requis pour la diffusion live depuis l'appareil du vendeur
    value: "camera=(self), microphone=(self), geolocation=(self), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // Next.js injecte des scripts inline hydratation/runtime
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      // Cairo est servie depuis notre domaine via next/font : aucun hôte tiers.
      "font-src 'self' data:",
      `img-src 'self' data: blob: https://${supabaseHost} https://*.fbcdn.net https://scontent.xx.fbcdn.net`,
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://accounts.google.com https://www.facebook.com`,
      "media-src 'self' blob: https:",
      "frame-src 'self' https://www.facebook.com https://web.facebook.com https://accounts.google.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Sans cela, Next remonte jusqu'au premier package-lock.json trouvé dans
  // les dossiers parents et prend une racine d'espace de travail erronée.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js"],
  },
  /*
    La présentation a d'abord vécu sur /presentation, avant de devenir la
    racine du site. L'alias reste, pour les liens déjà partagés.

    Ici plutôt que dans une page : une `permanentRedirect()` de composant part
    dans la charge RSC, avec un statut HTTP 200 — le navigateur suit, mais un
    robot d'indexation voit une page vide. Déclarée dans la configuration,
    c'est un vrai 308, et le référencement est transféré vers « / ».
  */
  async redirects() {
    return [{ source: "/presentation", destination: "/", permanent: true }];
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
