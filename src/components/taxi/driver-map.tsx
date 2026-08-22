"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

/*
  La feuille de style de Leaflet, indispensable.

  Elle positionne les tuiles, les calques et les contrôles ; sans elle la carte
  se rend en un rectangle gris, tuiles chargées mais empilées au même endroit.
  Deux règles écrites à la main n'y suffisent pas — il faut la vraie.

  Importée depuis le paquet plutôt que depuis un CDN : la CSP interdit les
  feuilles tierces, et Next la sert alors depuis notre domaine, ce que
  `style-src 'self'` autorise. Elle est découpée avec ce composant, donc chargée
  uniquement par l'écran taxi.
*/
import "leaflet/dist/leaflet.css";

import { telHref, whatsAppHref } from "@/lib/contact";

/** Centre de Gafsa : le repli quand aucun chauffeur n'a encore publié sa position. */
const GAFSA: [number, number] = [34.425, 8.784];

export interface DriverPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  available: boolean;
  /** Ce qui distingue la personne : véhicule, immatriculation, ou métier. */
  detail?: string | null;
  /** Sans numéro, la bulle n'affiche que l'identité. */
  phone?: string | null;
  /*
    Une action propre au point, en plus d'appeler.

    Pour un chauffeur, appeler suffit — il vient à vous. Pour une boutique,
    c'est l'inverse : le client doit s'y rendre, et ce qui lui manque est un
    itinéraire, pas un numéro. Le champ reste facultatif pour que la carte serve
    les deux usages sans se dédoubler.
  */
  link?: { href: string; label: string } | null;
}

/** Libellés de la bulle. La carte est réemployée par le taxi et par le SOS. */
export interface MapLabels {
  free: string;
  busy: string;
  call: string;
  whatsApp: string;
}

/*
  Échapper avant d'insérer dans la bulle.

  Leaflet ne rend que du HTML : `bindPopup` reçoit une chaîne, pas des nœuds
  React. Or le nom et le véhicule sont saisis par le chauffeur lui-même. Sans
  cette précaution, un nom contenant une balise s'exécuterait chez tous les
  clients qui touchent son repère.
*/
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Le contenu de la bulle : qui c'est, et comment le joindre.
 *
 * Trois façons de prendre contact, dans l'ordre où elles servent à Gafsa :
 * l'appel d'abord — c'est ce qu'on fait pour un taxi — puis WhatsApp, qui
 * permet d'envoyer un point de rendez-vous plutôt que de le décrire.
 *
 * Les liens portent `target="_blank"` pour WhatsApp seulement : un `tel:` ouvre
 * le composeur du téléphone et ne doit pas laisser un onglet vide derrière lui.
 */
function popupHtml(pin: DriverPin, labels: MapLabels): string {
  const state = pin.available ? labels.free : labels.busy;
  const tel = telHref(pin.phone);
  const wa = whatsAppHref(pin.phone, `Bonjour, je vous contacte depuis Mall Express Gafsa.`);

  const button =
    "display:inline-block;padding:6px 10px;border-radius:10px;font-size:11px;font-weight:700;text-decoration:none;";

  const extra = pin.link
    ? `<a href="${esc(pin.link.href)}" target="_blank" rel="noopener noreferrer"
          style="${button}background:#efe9f5;color:#6d4b8f;margin-top:6px;display:block;text-align:center">${esc(pin.link.label)}</a>`
    : "";

  return `
    <div style="min-width:170px;font-family:inherit">
      <div style="font-size:12.5px;font-weight:700;color:#1b1420">${esc(pin.name)}</div>
      <div style="font-size:10.5px;color:#6b6474;margin-top:1px">
        ${esc([pin.detail, state].filter(Boolean).join(" · "))}
      </div>
      ${
        tel && wa
          ? `<div style="display:flex;gap:6px;margin-top:8px">
               <a href="${tel}" style="${button}background:#7a1f2b;color:#fff">${esc(labels.call)}</a>
               <a href="${wa}" target="_blank" rel="noopener noreferrer"
                  style="${button}background:#e6f4ea;color:#0f7a3d">${esc(labels.whatsApp)}</a>
             </div>`
          : ""
      }
      ${extra}
    </div>`;
}

/**
 * La carte des chauffeurs.
 *
 * OpenStreetMap et Leaflet : aucune clé, aucune facturation, aucun compte à
 * ouvrir. Un service commercial coûterait des dizaines d'euros par mois pour
 * situer des taxis dans une ville de cette taille — la dépense ne se justifie
 * pas tant que le service n'a pas fait ses preuves.
 *
 * Leaflet est chargé à la demande plutôt qu'importé en tête : il pèse une
 * quarantaine de kilo-octets et ne sert qu'à cet écran. L'importer normalement
 * l'aurait ajouté au paquet commun de toutes les pages, y compris à celles d'un
 * client qui ne cherchera jamais de taxi.
 *
 * La carte est invalidée après montage : Leaflet mesure son conteneur à la
 * création, et un conteneur encore à zéro — le cas quand le composant arrive par
 * un import dynamique — lui fait calculer une grille de tuiles vide.
 */
export function DriverMap({
  drivers,
  labels,
}: {
  drivers: DriverPin[];
  labels: MapLabels;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const L = (await import("leaflet")).default;
      if (cancelled || !boxRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(boxRef.current, { attributionControl: true }).setView(GAFSA, 13);

        /*
          Le point d'accès canonique, sans sous-domaine.

          L'ancien schéma `{s}.tile.openstreetmap.org` répartissait la charge sur
          a/b/c ; OpenStreetMap l'a déprécié au profit d'un hôte unique. Le
          conserver ajoutait trois hôtes à autoriser dans la CSP pour rien.
        */
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          // L'attribution n'est pas décorative : la licence d'OpenStreetMap
          // l'exige, et l'omettre nous mettrait en faute.
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });

        /*
          Une tuile refusée ne dit rien d'elle-même : la carte reste simplement
          grise, et l'on cherche du côté de la mise en page alors que le problème
          est réseau. On le note une fois, sans noyer la console.
        */
        let reported = false;
        tiles.on("tileerror", () => {
          if (reported) return;
          reported = true;
          console.warn("Tuiles OpenStreetMap refusées — vérifier img-src dans la CSP.");
        });

        tiles.addTo(mapRef.current);
      }

      const map = mapRef.current;

      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];

      for (const driver of drivers) {
        /*
          Une pastille dessinée en HTML plutôt qu'une image : Leaflet cherche ses
          icônes par défaut sur un chemin relatif qui n'existe pas dans un paquet
          Next, et la couleur doit distinguer libre et occupé d'un coup d'œil.
        */
        /*
          La pastille garde ses seize pixels ; la cible en fait vingt-huit.

          Seize pixels, c'était la plus petite cible de l'application — sur une
          carte, où l'on vise déjà de mémoire, avec le pouce, parfois en
          marchant. Le repère reste dessiné à la même taille pour ne pas
          encombrer la vue quand plusieurs boutiques sont voisines ; c'est la
          zone transparente autour de lui qui grandit.

          L'ancrage suit : au centre de la zone, soit quatorze pixels, sans quoi
          le point se décalerait de sa position réelle.
        */
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px">
            <span style="display:block;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${
              driver.available ? "#2f7d5d" : "#948da6"
            }"></span>
          </span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([driver.lat, driver.lng], { icon })
          .addTo(map)
          .bindPopup(popupHtml(driver, labels));

        markersRef.current.push(marker);
      }

      /*
        Reprendre les mesures.

        Leaflet retient la taille de son conteneur au moment de la création. Avec
        un import dynamique, ce conteneur peut encore mesurer zéro : la carte
        calcule alors une grille vide et n'affiche aucune tuile, même une fois la
        mise en page stabilisée.
      */
      map.invalidateSize();

      // Cadrer sur les chauffeurs présents, sans dézoomer à l'excès s'il n'y en
      // a qu'un seul.
      if (drivers.length > 0) {
        const bounds = L.latLngBounds(drivers.map((d) => [d.lat, d.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }

    void draw();
    return () => {
      cancelled = true;
    };
  }, [drivers, labels]);

  // La carte est démontée avec l'écran : Leaflet garde sinon des écouteurs sur
  // un nœud qui n'existe plus.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <>
      {/* Le fond reprend nos jetons ; le reste vient de la feuille de Leaflet. */}
      <style>{`
        .leaflet-container { height: 100%; width: 100%; background: var(--color-track); }
        .leaflet-control-attribution { font-size: 9px; }
      `}</style>
      <div ref={boxRef} className="h-full w-full rounded-[18px]" />
    </>
  );
}
