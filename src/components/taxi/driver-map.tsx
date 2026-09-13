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

/**
 * La silhouette d'un taxi, dessinée une fois.
 *
 * Un rond de couleur dit « quelqu'un est là » ; il ne dit pas quoi. Sur une
 * carte qui porte déjà des repères de boutiques et de dépanneurs, la voiture
 * lève l'ambiguïté avant même qu'on lise l'étiquette — et c'est ce qu'on
 * regarde en premier quand on cherche un taxi.
 *
 * Un tracé inline plutôt qu'un fichier : Leaflet insère du HTML brut dans ses
 * repères, l'icône pèse trois cents octets, et une requête réseau de plus pour
 * cela n'aurait aucun sens.
 */
function taxiSvg(couleur: string, taille = 15): string {
  return `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" aria-hidden="true" style="display:block;flex:none">
    <path fill="${couleur}" d="M9.7 2.4h4.6c.6 0 1 .4 1 1v1.3H8.7V3.4c0-.6.4-1 1-1Z"/>
    <path fill="${couleur}" d="M7.6 5.9h8.8c.9 0 1.7.5 2 1.4l1.3 3.2c.7.3 1.1 1 1.1 1.7v3.3c0 .6-.5 1-1 1h-.8a2.3 2.3 0 0 1-4.5 0H9.5a2.3 2.3 0 0 1-4.5 0h-.8c-.6 0-1-.5-1-1v-3.3c0-.8.4-1.4 1.1-1.7l1.3-3.2c.3-.9 1.1-1.4 2-1.4Zm.2 2-.9 2.3h10.2l-.9-2.3H7.8Z"/>
    <circle fill="${couleur}" cx="7.3" cy="16.4" r="1.7"/>
    <circle fill="${couleur}" cx="16.7" cy="16.4" r="1.7"/>
  </svg>`;
}

/**
 * La couleur de chaque état, et ce qu'elle promet.
 *
 * Vert et ambre battent — on peut les appeler. Gris et bleu ne battent pas :
 * l'un n'est pas joignable, l'autre est déjà en course avec quelqu'un. Le
 * halo est donc une information, pas une décoration : il dit « celui-là peut
 * venir ».
 */
const ETATS = {
  libre: { couleur: "#2f7d5d", halo: true },
  places: { couleur: "#b5761f", halo: true },
  occupe: { couleur: "#948da6", halo: false },
  course: { couleur: "#3f6cd0", halo: false },
} as const;

/** Le cap entre deux points, en degrés, pour orienter la voiture. */
function capDegres(
  de: { lat: number; lng: number },
  vers: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLng = (vers.lng - de.lng) * rad;
  const lat1 = de.lat * rad;
  const lat2 = vers.lat * rad;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (Math.atan2(y, x) / rad + 360) % 360;
}

/**
 * Retirer un repère en le laissant s'effacer.
 *
 * Leaflet retire l'élément du document dès l'appel : une transition CSS n'a
 * jamais le temps de se jouer. On pose donc la classe de sortie, puis on
 * retire une fois l'animation finie.
 *
 * Le repli par minuterie n'est pas de la prudence excessive : `animationend`
 * ne se déclenche pas si l'élément est masqué, si l'onglet passe en arrière-
 * plan, ou si l'utilisateur a demandé moins de mouvement — et le repère
 * resterait alors sur la carte pour toujours.
 */
function retirerEnDouceur(marker: Marker, apres: () => void) {
  const el = marker.getElement();

  if (!el) {
    marker.remove();
    apres();
    return;
  }

  let fini = false;
  const achever = () => {
    if (fini) return;
    fini = true;
    marker.remove();
    apres();
  };

  el.classList.add("meg-pin--sortie");
  el.addEventListener("animationend", achever, { once: true });
  window.setTimeout(achever, 320);
}

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
  /**
   * Deux ou trois lettres dessinées dans le repère.
   *
   * Sur une carte qui porte cinq taxis, des pastilles identiques obligent à
   * ouvrir chaque bulle pour savoir qui est qui. Les initiales font le lien
   * immédiat avec la ligne du tableau, en dessous — c'est le même chauffeur, et
   * l'œil le retrouve sans cliquer.
   */
  initials?: string | null;
  /** Le repère choisi : plus grand, cerné, au-dessus des autres. */
  selected?: boolean;
  /** Un mot sous le repère : « libre », « place libre »… */
  caption?: string | null;
  /**
   * L'état réel, pour la couleur et le halo.
   *
   * `available` ne disait que oui ou non. Trois situations se distinguent
   * pourtant à l'œil sur une carte : celui qui est libre, celui qui roule mais
   * garde des places — le louage urbain, cas le plus fréquent ici —, et celui
   * qui est pris. Le halo ne bat que pour les deux premiers, ce qui en fait
   * une information et non une décoration : il dit « celui-là peut venir ».
   *
   * Facultatif : le SOS réemploie cette carte et ne connaît que `available`.
   */
  etat?: "libre" | "places" | "occupe" | "course";
}

/**
 * Un client qui cherche un taxi, vu depuis l'écran du chauffeur.
 *
 * Il n'apparaît que le temps de sa demande : créée quand il confirme sa
 * recherche, retirée dès qu'il annule, qu'un chauffeur accepte, ou que
 * l'échéance tombe. Un compte ordinaire n'a jamais de repère ici — et ce
 * n'est pas cet affichage qui le garantit, mais la fonction SQL
 * `taxi_demandes_proches`, qui ne rend que les demandes ouvertes et refuse
 * de répondre à qui n'est pas un chauffeur approuvé.
 */
export interface ClientPin {
  id: string;
  lat: number;
  lng: number;
  /** Distance au chauffeur, déjà calculée côté serveur. */
  distanceM: number;
  destination: string;
  seats: number;
  prix: number | null;
  selected?: boolean;
}

/** Un point remarquable qui n'est pas un chauffeur : vous, ou votre arrivée. */
export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  /** `depart` en vert, `arrivee` en violet — les deux bouts du trajet. */
  kind: "depart" | "arrivee";
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
  clients,
  labels,
  points,
  route,
  onPick,
  recentrer,
}: {
  drivers: DriverPin[];
  /**
   * Les demandes de course ouvertes autour du chauffeur.
   *
   * Absent sur la carte du client, et c'est la moitié de la règle de
   * visibilité : un passager ne voit jamais les autres passagers. L'autre
   * moitié tient côté base, où `taxi_demandes_proches` refuse de répondre à
   * qui n'est pas un chauffeur approuvé.
   */
  clients?: ClientPin[];
  labels: MapLabels;
  /** Départ et arrivée, quand l'écran en a. Facultatif : le SOS n'en a pas. */
  points?: MapPoint[];
  /** Le trait entre les deux, s'il y a lieu de le montrer. */
  route?: Array<{ lat: number; lng: number }> | null;
  /**
   * Toucher la carte pour désigner une arrivée.
   *
   * Plus rapide qu'écrire, et plus précis qu'un nom de quartier — surtout pour
   * une destination qui n'a pas de nom sur une liste.
   */
  onPick?: (point: { lat: number; lng: number }) => void;
  /** Libellé du bouton de recentrage. Absent : pas de bouton. */
  recentrer?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  /*
    Les repères des chauffeurs, gardés par identifiant.

    Ils étaient tous retirés puis recréés à chaque relecture. Sur une carte qui
    se rafraîchit toutes les trente secondes, cela veut dire : bulle ouverte qui
    se referme d'elle-même, repère qui clignote, et surtout chauffeur qui se
    téléporte d'un point à l'autre sans qu'on puisse suivre son déplacement.

    En les conservant, on ne fait plus que déplacer ceux qui ont bougé — et on
    peut le faire progressivement.
  */
  const taxisRef = useRef(new Map<string, Marker>());
  const animationsRef = useRef(new Map<string, number>());

  /*
    La dernière position connue de chaque taxi, et le cap qui en découle.

    Gardée ici plutôt que déduite du repère : `getLatLng()` rend la position
    *interpolée*, celle de l'image en cours, pas celle du dernier relevé. Un
    cap calculé dessus tremblerait pendant toute l'animation.
  */
  const capsRef = useRef(new Map<string, { lat: number; lng: number; cap: number }>());

  /** Les repères des clients en attente, tenus comme ceux des taxis. */
  const clientsRef = useRef(new Map<string, Marker>());

  const pointsRef = useRef<Marker[]>([]);
  const calquesRef = useRef<Array<{ remove: () => void }>>([]);

  /*
    Le rappel de sélection passe par une référence.

    Il change à chaque rendu du parent — c'est une fonction fléchée — et le
    mettre dans les dépendances de l'effet reconstruirait la carte à chaque
    battement du temps réel : tuiles rechargées, zoom perdu, position du client
    ramenée au centre toutes les trente secondes.
  */
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  /** La dernière disposition sur laquelle on a cadré, pour ne pas y revenir. */
  const cadrageRef = useRef<string | null>(null);

  /** Comment recadrer, tel que le dernier rendu l'a défini. */
  const cadrerRef = useRef<(() => void) | null>(null);

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

        // Toucher la carte désigne l'arrivée. L'écouteur est posé une seule
        // fois, à la création, et lit le rappel courant par la référence.
        mapRef.current.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          onPickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
        });
      }

      const map = mapRef.current;

      for (const marker of pointsRef.current) marker.remove();
      pointsRef.current = [];
      for (const calque of calquesRef.current) calque.remove();
      calquesRef.current = [];

      /*
        Le trajet d'abord, sous les repères.

        Deux traits superposés : un large et pâle en dessous, un fin et net
        au-dessus. C'est ce qui rend la ligne lisible aussi bien sur une avenue
        claire que sur un parc sombre, sans avoir à assombrir la carte entière.
      */
      if (route && route.length >= 2) {
        const chemin = route.map((p) => [p.lat, p.lng] as [number, number]);
        for (const trait of [
          { color: "#6d4b8f", weight: 9, opacity: 0.22 },
          { color: "#6d4b8f", weight: 3.5, opacity: 0.95 },
        ]) {
          calquesRef.current.push(L.polyline(chemin, { ...trait, lineCap: "round" }).addTo(map));
        }
      }

      /*
        Vous, et votre arrivée.

        Un anneau plutôt qu'une pastille pleine : le point de départ est une
        zone — « quelque part par ici » — et non une adresse au mètre près. Le
        dessin dit ce que la donnée vaut.
      */
      for (const point of points ?? []) {
        const teinte = point.kind === "depart" ? "#2f7d5d" : "#6d4b8f";
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px">
              <span style="display:block;width:14px;height:14px;border-radius:50%;background:${teinte};
                border:3px solid #fff;box-shadow:0 0 0 3px ${teinte}33,0 2px 6px rgba(20,14,26,.35)"></span>
            </span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        pointsRef.current.push(
          L.marker([point.lat, point.lng], { icon, zIndexOffset: 500 })
            .addTo(map)
            .bindPopup(`<div style="font:700 12px/1.4 inherit;color:#1b1420">${esc(point.label)}</div>`),
        );
      }

      const vus = new Set<string>();

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
        /*
          L'état gouverne la couleur et le halo, et `available` reste le repli.

          Les deux coexistent parce que cette carte sert aussi le SOS, qui ne
          connaît que « joignable ou non ». Un appelant qui ne renseigne pas
          `etat` retrouve donc exactement le comportement d'avant.
        */
        const etat = driver.etat ?? (driver.available ? "libre" : "occupe");
        const { couleur: teinte, halo } = ETATS[etat];
        const choisi = driver.selected === true;

        /*
          Le cap, déduit du déplacement plutôt que transmis.

          Aucune colonne ne porte la direction, et en ajouter une obligerait le
          téléphone du chauffeur à la calculer puis à l'écrire — une donnée de
          plus à chaque relevé, pour un détail d'affichage.

          Deux positions successives la donnent gratuitement. Sous une dizaine
          de mètres, on garde le cap précédent : le tremblement du capteur
          ferait sinon pivoter la voiture sur place.
        */
        const precedent = capsRef.current.get(driver.id);
        let cap = precedent?.cap ?? 0;

        if (precedent) {
          const bougeAssez =
            Math.abs(precedent.lat - driver.lat) > 1e-4 ||
            Math.abs(precedent.lng - driver.lng) > 1e-4;

          if (bougeAssez) {
            cap = capDegres(
              { lat: precedent.lat, lng: precedent.lng },
              { lat: driver.lat, lng: driver.lng },
            );
          }
        }

        capsRef.current.set(driver.id, { lat: driver.lat, lng: driver.lng, cap });

        /* Les deux ondes, seulement quand le chauffeur peut réellement venir. */
        const haloHtml = halo
          ? `<span class="meg-halo" style="--halo:${teinte}"></span>
             <span class="meg-halo meg-halo--retard" style="--halo:${teinte}"></span>`
          : "";

        /*
          Deux dessins pour un même repère.

          Sans initiales, la pastille de seize pixels d'origine : c'est ce dont
          le SOS et la carte des boutiques ont besoin, et rien ne change pour
          eux. Avec initiales, une gélule blanche qui porte les lettres et, sous
          elle, un mot d'état — de quoi identifier le chauffeur sans ouvrir sa
          bulle.

          Le choisi passe en couleur pleine et gagne un halo : sur une carte qui
          en compte cinq, il faut retrouver le sien d'un coup d'œil.
        */
        const html = driver.initials
          ? `<span class="meg-pin${choisi ? " meg-pin--choisi" : ""}" style="display:flex;flex-direction:column;align-items:center;gap:2px">
               <span style="position:relative;display:flex;align-items:center;justify-content:center">
                 ${haloHtml}
                 <span style="position:relative;display:flex;align-items:center;justify-content:center;gap:4px;min-width:30px;height:26px;padding:0 8px;border-radius:13px;
                   font:700 11px/1 system-ui,sans-serif;letter-spacing:.02em;
                   background:${choisi ? teinte : "#fff"};color:${choisi ? "#fff" : "#1b1420"};
                   border:2px solid ${choisi ? "#fff" : teinte};
                   box-shadow:0 2px ${choisi ? "10px" : "6px"} rgba(20,14,26,${choisi ? ".45" : ".25"})">
                   <span class="meg-taxi-corps" style="--cap:${cap.toFixed(0)}deg;display:block">
                     ${taxiSvg(choisi ? "#fff" : teinte)}
                   </span>
                   ${esc(driver.initials)}
                 </span>
               </span>
               ${
                 driver.caption
                   ? `<span style="padding:1px 6px;border-radius:8px;font:700 8.5px/1.5 system-ui,sans-serif;white-space:nowrap;
                        background:${teinte};color:#fff;box-shadow:0 1px 4px rgba(20,14,26,.3)">${esc(driver.caption)}</span>`
                   : ""
               }
             </span>`
          : `<span class="meg-pin" style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px">
               ${haloHtml}
               <span style="position:relative;display:block;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${teinte}"></span>
             </span>`;

        const icon = L.divIcon({
          className: "",
          html,
          iconSize: driver.initials ? [86, 46] : [28, 28],
          iconAnchor: driver.initials ? [43, 23] : [14, 14],
        });

        /*
          Le repère est réutilisé s'il existe déjà, et il glisse jusqu'à sa
          nouvelle position.

          Un taxi qui roule change de coordonnées toutes les trente secondes,
          soit deux à trois cents mètres. Reposer le repère d'un coup à
          l'arrivée donne une téléportation : on voit un saut, on ne voit pas un
          déplacement, et l'on ne devine ni la direction ni la vitesse.

          Une seconde d'interpolation suffit à rendre le mouvement lisible sans
          jamais laisser le repère en retard sur la donnée — la relecture
          suivante est trente fois plus tard.
        */
        const existant = taxisRef.current.get(driver.id);

        if (existant) {
          existant.setIcon(icon);
          existant.setZIndexOffset(choisi ? 1000 : 0);
          existant.setPopupContent(popupHtml(driver, labels));

          const depuis = existant.getLatLng();
          const versLat = driver.lat;
          const versLng = driver.lng;

          // Sous une dizaine de mètres, ce n'est pas un déplacement mais le
          // tremblement du capteur : on repose sans animer.
          const bouge =
            Math.abs(depuis.lat - versLat) > 1e-4 || Math.abs(depuis.lng - versLng) > 1e-4;

          const enCours = animationsRef.current.get(driver.id);
          if (enCours) cancelAnimationFrame(enCours);

          if (!bouge) {
            existant.setLatLng([versLat, versLng]);
          } else {
            const depart = performance.now();
            const DUREE = 1000;

            const avancer = (maintenant: number) => {
              const t = Math.min(1, (maintenant - depart) / DUREE);
              // Départ et arrivée adoucis : un mouvement linéaire se lit comme
              // un objet tiré à la ficelle.
              const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

              existant.setLatLng([
                depuis.lat + (versLat - depuis.lat) * e,
                depuis.lng + (versLng - depuis.lng) * e,
              ]);

              if (t < 1) {
                animationsRef.current.set(driver.id, requestAnimationFrame(avancer));
              } else {
                animationsRef.current.delete(driver.id);
              }
            };

            animationsRef.current.set(driver.id, requestAnimationFrame(avancer));
          }

          vus.add(driver.id);
          continue;
        }

        const marker = L.marker([driver.lat, driver.lng], {
          icon,
          // Le repère choisi passe devant les autres : sur une carte dense, il
          // se retrouvait caché derrière un voisin.
          zIndexOffset: choisi ? 1000 : 0,
        })
          .addTo(map)
          .bindPopup(popupHtml(driver, labels));

        taxisRef.current.set(driver.id, marker);
        vus.add(driver.id);
      }

      // Un chauffeur qui a disparu de la liste — déconnecté, position périmée —
      // voit son repère retiré. Sans cela, la carte accumulerait des fantômes.
      for (const [id, marker] of taxisRef.current) {
        if (vus.has(id)) continue;
        const anim = animationsRef.current.get(id);
        if (anim) cancelAnimationFrame(anim);
        animationsRef.current.delete(id);
        capsRef.current.delete(id);
        retirerEnDouceur(marker, () => taxisRef.current.delete(id));
      }

      /* ─── Les clients qui attendent ──────────────────────────────────
         Même mécanique que les taxis : repères conservés par identifiant,
         retirés en fondu. Ils ne bougent pas — un client qui attend un taxi
         reste où il est — donc pas d'interpolation ici. */
      const clientsVus = new Set<string>();

      for (const client of clients ?? []) {
        clientsVus.add(client.id);

        const distance =
          client.distanceM < 1000
            ? `${client.distanceM} m`
            : `${(client.distanceM / 1000).toFixed(1)} km`;

        const html = `<span class="meg-pin" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="position:relative;display:flex;align-items:center;justify-content:center">
              <span class="meg-halo" style="--halo:#7a4fd0"></span>
              <span class="meg-client-coeur" style="position:relative;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;
                background:${client.selected ? "#7a4fd0" : "#fff"};border:2px solid ${client.selected ? "#fff" : "#7a4fd0"};
                box-shadow:0 2px 6px rgba(20,14,26,.28);font:700 12px/1 system-ui,sans-serif">
                <span style="filter:${client.selected ? "grayscale(1) brightness(3)" : "none"}">👤</span>
              </span>
            </span>
            <span style="padding:1px 6px;border-radius:8px;font:700 8.5px/1.5 system-ui,sans-serif;white-space:nowrap;
              background:#7a4fd0;color:#fff;box-shadow:0 1px 4px rgba(20,14,26,.3)">${esc(distance)}</span>
          </span>`;

        const icon = L.divIcon({
          className: "",
          html,
          iconSize: [76, 46],
          iconAnchor: [38, 23],
        });

        const bulle = `<div style="min-width:150px;font:400 12px/1.5 system-ui,sans-serif">
            <p style="margin:0 0 4px;font-weight:700">👤 Client · ${esc(distance)}</p>
            <p style="margin:0 0 2px">🎯 ${esc(client.destination)}</p>
            <p style="margin:0;color:#6b6478">👥 ${client.seats} pers.${
              client.prix !== null ? ` · 💰 ${client.prix} DT` : ""
            }</p>
          </div>`;

        const existant = clientsRef.current.get(client.id);

        if (existant) {
          existant.setIcon(icon);
          existant.setLatLng([client.lat, client.lng]);
          existant.setPopupContent(bulle);
          existant.setZIndexOffset(client.selected ? 900 : 200);
          continue;
        }

        clientsRef.current.set(
          client.id,
          L.marker([client.lat, client.lng], {
            icon,
            zIndexOffset: client.selected ? 900 : 200,
          })
            .addTo(map)
            .bindPopup(bulle),
        );
      }

      /*
        Une demande qui s'éteint — annulée, acceptée, expirée — s'efface.

        Le fondu n'est pas un ornement : sur une carte que l'on regarde en
        conduisant, un repère qui disparaît d'une image à l'autre passe
        inaperçu. Un quart de seconde suffit à voir *lequel* est parti.
      */
      for (const [id, marker] of clientsRef.current) {
        if (clientsVus.has(id)) continue;
        retirerEnDouceur(marker, () => clientsRef.current.delete(id));
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
      /*
        Le cadrage tient compte du trajet, pas seulement des chauffeurs.

        Cadrer sur les seuls taxis sortait l'aéroport de l'écran dès qu'on le
        choisissait comme destination : le client voyait ses chauffeurs mais
        plus où il allait.

        Il ne se rejoue qu'à l'arrivée ou au départ d'un point, jamais à chaque
        rafraîchissement de position : une carte qui se recadre toutes les
        trente secondes est inutilisable dès qu'on veut regarder un détail.
      */
      const tous = [
        ...drivers.map((d) => [d.lat, d.lng] as [number, number]),
        ...(points ?? []).map((p) => [p.lat, p.lng] as [number, number]),
      ];

      const signature = (points ?? []).map((p) => `${p.kind}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");

      /*
        Le cadrage se joue sur le trajet quand il y en a un, sur tout le monde
        sinon.

        Avec un départ et une arrivée, ce sont eux qu'il faut voir en entier —
        un chauffeur égaré à l'autre bout de la ville ferait dézoomer au point
        de rendre le trajet illisible. La marge est généreuse pour que les
        repères, qui débordent de leur point d'ancrage, ne touchent pas le bord.
      */
      const aTrajet = (points ?? []).length >= 2;
      const cadre = aTrajet
        ? [
            ...(points ?? []).map((p) => [p.lat, p.lng] as [number, number]),
            ...(route ?? []).map((p) => [p.lat, p.lng] as [number, number]),
          ]
        : tous;

      cadrerRef.current = () => {
        if (cadre.length === 0) return;
        map.fitBounds(L.latLngBounds(cadre), {
          padding: [56, 56],
          // Ni trop près — on perdrait le contexte de la rue — ni trop loin :
          // sur une ville de dix kilomètres, en dessous de treize on ne
          // distingue plus les quartiers.
          maxZoom: 16,
        });
      };

      if (cadre.length > 0 && signature !== cadrageRef.current) {
        cadrageRef.current = signature;
        cadrerRef.current();
      }
    }

    void draw();
    return () => {
      cancelled = true;
    };
  }, [drivers, clients, labels, points, route]);

  // La carte est démontée avec l'écran : Leaflet garde sinon des écouteurs sur
  // un nœud qui n'existe plus.
  useEffect(() => {
    /*
      Les collections suivent la carte dans la tombe.

      `map.remove()` détruit les repères côté Leaflet, mais nos `Map` gardent
      leurs références et les minuteurs de `retirerEnDouceur` peuvent encore
      se déclencher sur des repères dont la carte n'existe plus. Un écran
      taxi ouvert, fermé, rouvert accumulait sinon des entrées mortes.
    */
    const taxis = taxisRef.current;
    const clientsPins = clientsRef.current;
    const animations = animationsRef.current;
    const caps = capsRef.current;

    return () => {
      for (const id of animations.values()) cancelAnimationFrame(id);
      animations.clear();
      taxis.clear();
      clientsPins.clear();
      caps.clear();

      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* Le fond reprend nos jetons ; le reste vient de la feuille de Leaflet. */}
      <style>{`
        .leaflet-container { height: 100%; width: 100%; background: var(--color-track); }
        .leaflet-control-attribution { font-size: 9px; }
        /* Les commandes de zoom sont trop petites au doigt dans leur taille
           d'origine : vingt-six pixels, c'est la limite du visable en marchant. */
        .leaflet-touch .leaflet-bar a { width: 32px; height: 32px; line-height: 32px; }
      `}</style>
      <div ref={boxRef} className="h-full w-full rounded-[18px]" />

      {/*
        Recadrer, sans jamais reprendre la main de force.

        La carte se cale une fois sur le trajet, puis se tait : quelqu'un qui a
        zoomé sur une rue pour repérer un porche ne doit pas voir sa vue reprise
        au prochain relevé de position. Le bouton rend ce geste à celui qui le
        veut, quand il le veut.
      */}
      {recentrer && (
        <button
          type="button"
          onClick={() => cadrerRef.current?.()}
          aria-label={recentrer}
          className="press absolute end-3 bottom-[26px] z-[500] flex items-center gap-[6px] rounded-full bg-[var(--color-surface-solid)] px-[11px] py-[7px] text-[0.59375rem] font-bold text-[var(--color-ink)] shadow-[0_4px_14px_rgba(20,14,26,0.22)]"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" style={{ display: "block" }}>
            <circle cx="12" cy="12" r="3.2" fill="currentColor" />
            <circle cx="12" cy="12" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 1.6v3.2M12 19.2v3.2M1.6 12h3.2M19.2 12h3.2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {recentrer}
        </button>
      )}
    </div>
  );
}
