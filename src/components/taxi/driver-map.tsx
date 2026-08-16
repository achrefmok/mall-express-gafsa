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

/** Centre de Gafsa : le repli quand aucun chauffeur n'a encore publié sa position. */
const GAFSA: [number, number] = [34.425, 8.784];

export interface DriverPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  available: boolean;
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
export function DriverMap({ drivers }: { drivers: DriverPin[] }) {
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
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${
            driver.available ? "#2f7d5d" : "#948da6"
          }"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([driver.lat, driver.lng], { icon })
          .addTo(map)
          .bindPopup(`${driver.name}${driver.available ? " · libre" : " · occupé"}`);

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
  }, [drivers]);

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
