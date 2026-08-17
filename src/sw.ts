/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import { servesPath } from "@/lib/space";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * ═══════════════════════════════════════════════════════════════════════
 * Service worker — Mall Express Gafsa
 * ═══════════════════════════════════════════════════════════════════════
 *
 * L'application vise des connexions mobiles tunisiennes irrégulières. La
 * stratégie tient en trois règles :
 *
 *   1. Ce qui est personnel ou transactionnel ne va jamais en cache —
 *      panier, commandes, authentification, session. Servir une version
 *      périmée d'un panier serait pire que ne rien servir.
 *   2. Les images de produits, quasi immuables, sont mises en cache long.
 *   3. Les documents HTML passent en « réseau d'abord », avec le cache pour
 *      filet : un document périmé désigne des fragments JavaScript que le
 *      déploiement suivant a supprimés, et l'écran reste blanc.
 *
 * Le temps réel (WebSocket Supabase, WebRTC) contourne entièrement le
 * service worker : ces échanges ne passent pas par `fetch`.
 */

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,

  runtimeCaching: [
    /* ─── Navigations vers l'autre espace ──────────────────────────── */
    {
      /*
        Une redirection hors origine ne se suit pas depuis un service worker.

        Sur un déploiement découpé, `/vendeur` est renvoyée par le middleware
        vers l'autre hébergement. Le service worker, lui, tentait de suivre cette
        redirection depuis notre origine : le navigateur refuse — « Unsafe
        attempt to load URL […] from frame with URL /sw.js » — et la navigation
        échouait sur une page blanche, doublée d'un « no-response ».

        `redirect: "manual"` produit une réponse opaque de redirection, que l'on
        peut légitimement rendre pour une navigation : le navigateur la suit
        alors lui-même, avec ses propres droits. C'est le seul moyen de laisser
        passer une redirection inter-domaines à travers un service worker.

        `servesPath` connaît l'espace de ce déploiement : sur un hébergement
        unique, aucune route n'est concernée et cette règle ne s'applique jamais.
      */
      matcher: ({ request, url }) =>
        request.mode === "navigate" && url.origin === self.location.origin && !servesPath(url.pathname),
      handler: async ({ request }) => fetch(request, { redirect: "manual" }),
    },

    /* ─── Jamais en cache ──────────────────────────────────────────── */
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/auth/") ||
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/panier") ||
        url.pathname.startsWith("/commandes") ||
        url.pathname.startsWith("/vendeur") ||
        url.pathname.startsWith("/admin") ||
        // Toute requête vers Supabase : données vivantes et jetons de session.
        url.hostname.endsWith(".supabase.co"),
      handler: new NetworkOnly(),
    },

    /* ─── Images de produits et de boutiques ───────────────────────── */
    {
      matcher: ({ request, url }) =>
        request.destination === "image" &&
        (url.pathname.startsWith("/_next/image") || url.pathname.includes("/storage/v1/object/public/")),
      handler: new CacheFirst({
        cacheName: "meg-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },

    /* ─── Tuiles de la carte ───────────────────────────────────────── */
    {
      /*
        Gafsa ne bouge pas : une tuile déjà vue n'a aucune raison d'être
        redemandée. Le cache épargne le réseau du client et les serveurs
        d'OpenStreetMap, dont l'usage est bénévole — leur politique demande
        explicitement de mettre les tuiles en cache.

        Le plafond est bas volontairement : quelques niveaux de zoom sur une
        seule ville, pas un atlas.
      */
      matcher: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"),
      handler: new CacheFirst({
        cacheName: "meg-tuiles",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 14 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },

    /* ─── Pages publiques ──────────────────────────────────────────── */
    {
      matcher: ({ request, url }) =>
        request.mode === "navigate" &&
        (url.pathname === "/" ||
          url.pathname.startsWith("/marketplace") ||
          url.pathname.startsWith("/produit/") ||
          url.pathname.startsWith("/boutique/") ||
          url.pathname.startsWith("/services") ||
          url.pathname.startsWith("/bons-plans")),
      /*
        « Réseau d'abord », et non « périmé puis rafraîchi ».

        Un document HTML nomme des fragments JavaScript par leur empreinte. Servir
        un document d'hier après un déploiement fait réclamer des fragments qui
        n'existent plus : le serveur répond 404 en texte brut, et le navigateur
        refuse d'exécuter du `text/plain` — « ChunkLoadError ». L'écran reste
        blanc jusqu'à un rechargement.

        Le cache ne sert donc plus que de filet hors réseau, où il reste précieux.
        Le coût est un aller-retour réseau par navigation ; l'ancienne stratégie
        échangeait cela contre un écran cassé à chaque mise en ligne.
      */
      handler: new NetworkFirst({
        cacheName: "meg-pages",
        networkTimeoutSeconds: 4,
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },

    ...defaultCache,
  ],

  fallbacks: {
    entries: [
      {
        url: "/hors-ligne",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

/* ─── Notifications poussées ─────────────────────────────────────────────
   Le schéma prévoit déjà les notifications ; l'abonnement Web Push se
   branchera dessus. Les gestionnaires sont en place pour que l'ajout se
   fasse sans retoucher le service worker. */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; link?: string } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Mall Express Gafsa", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge.png",
      data: { link: payload.link ?? "/" },
      lang: "fr",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data as { link?: string } | undefined)?.link ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Réutiliser un onglet déjà ouvert plutôt qu'en empiler un nouveau.
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        void existing.focus();
        return existing.navigate(link).then(() => undefined);
      }
      return self.clients.openWindow(link).then(() => undefined);
    }),
  );
});
