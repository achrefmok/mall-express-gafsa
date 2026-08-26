"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, LazyMotion, m } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { usePoll } from "@/lib/use-poll";
import { distanceMeters, positionPlausible } from "@/lib/geo";
import { presenceDe } from "@/lib/taxi-presence";
import { itineraire, type Itineraire } from "@/lib/routing";
import { compatibilite, type Point } from "@/lib/taxi-match";
import { monogram } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";
import { TripPanel, type Champ, type LieuChoisi } from "./trip-panel";
import { DriverChat } from "./driver-chat";
import { RideRequest } from "./ride-request";
import { ClientThreads } from "./client-threads";
import { DriverList, type Filtre, type LigneChauffeur } from "./driver-list";
import type { DriverPin, MapLabels, MapPoint } from "./driver-map";

const chargerAnimations = () => import("framer-motion").then((mod) => mod.domAnimation);

/*
  La carte ne se rend que dans le navigateur : Leaflet touche `window` dès son
  import, et un rendu serveur le ferait échouer.
*/
const DriverMap = dynamic(() => import("./driver-map").then((m) => m.DriverMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--color-track)]" />,
});

export interface Driver {
  id: string;
  display_name: string;
  phone: string;
  vehicle: string | null;
  plate: string | null;
  is_available: boolean;
  lat: number | null;
  lng: number | null;
  position_updated_at: string | null;
  seats_total?: number | null;
  seats_free?: number | null;
  free_at?: string | null;
  takes_along?: boolean | null;
}

/**
 * Trouver un taxi à Gafsa — celui qui est libre, ou celui qui passe par là.
 *
 * L'écran s'organise autour de la carte, parce que c'est la seule chose qui
 * répond en un coup d'œil à la question posée : où sont-ils, par rapport à moi.
 * Le reste s'y raccroche — le trajet à droite, la conversation dessous, la liste
 * détaillée en bas pour comparer.
 *
 * **Deux façons d'être pris en charge**, et l'application montre enfin la
 * seconde. Un chauffeur libre vient vous chercher : c'est le taxi classique. Un
 * chauffeur déjà en course peut vous prendre au passage s'il a une place et que
 * vous êtes sur son chemin : c'est ce qui se pratique tous les jours ici, et
 * l'ancien écran, qui n'affichait que « libre » ou « occupé », le rendait
 * invisible.
 *
 * Tout ce qui est chiffré est calculé sur des positions réelles. Quand une
 * donnée manque — position trop vieille, destination non saisie, places non
 * renseignées —, l'écran le dit au lieu de combler le trou.
 */
export function TaxiClient({
  initialDrivers,
  clientId,
  espaceChauffeur,
}: {
  initialDrivers: Driver[];
  clientId: string | null;
  espaceChauffeur: boolean;
}) {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState(initialDrivers);

  const [depart, setDepart] = useState<Point | null>(null);
  /** Le nom du départ quand il a été saisi, plutôt que relevé par le GPS. */
  const [departNom, setDepartNom] = useState<string | null>(null);
  const [etatPosition, setEtatPosition] = useState<"attente" | "trouvee" | "refusee">("attente");
  const [destination, setDestination] = useState<LieuChoisi | null>(null);

  /*
    Quel bout du trajet la carte renseigne.

    Toucher la carte devait bien remplir quelque chose, et toujours la
    destination était un choix trop rigide : un client dont le GPS place le
    départ à deux rues de là n'avait aucun moyen de le corriger. C'est donc le
    champ touché en dernier qui reçoit le point — et la destination par défaut,
    parce que c'est ce qu'on vient renseigner neuf fois sur dix.
  */
  const [champActif, setChampActif] = useState<Champ>("destination");

  /** Précision annoncée par le téléphone, en mètres. */
  const [precision, setPrecision] = useState<number | null>(null);

  /** L'itinéraire routier, quand les deux bouts sont connus. */
  const [chemin, setChemin] = useState<Itineraire | null>(null);

  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [selection, setSelection] = useState<string | null>(null);

  /*
    Relecture périodique, et non abonnement aux changements.

    L'abonnement diffusait chaque position publiée à tous les spectateurs, et
    chacun relisait ensuite la liste entière : le coût croissait comme le produit
    des chauffeurs par les spectateurs, et le quota mensuel de messages temps
    réel s'épuisait en moins d'une journée avec cinq chauffeurs et trente
    spectateurs.

    Trente secondes ne se remarquent pas : un chauffeur qui prend une course
    reste joignable, et la carte le montre libre une demi-minute de trop au pire.
    Le crochet suspend tout quand l'onglet passe à l'arrière-plan.

    `select("*")` plutôt que la liste des colonnes : les places et l'heure de
    libération n'existent qu'après la migration, et nommer une colonne absente
    ferait échouer *toute* la requête — donc l'écran entier, pas seulement les
    places.
  */
  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("taxi_drivers")
      .select("*")
      .eq("is_approved", true)
      .order("is_available", { ascending: false });

    // `false` prévient le crochet de sondage : il ralentira plutôt que de
    // marteler un service en panne à la même cadence qu'un service sain.
    if (!data) return false;
    setDrivers(data as Driver[]);
  }, []);

  usePoll(reload, 30_000);

  /*
    La position du client, demandée une fois.

    Sans elle, l'écran reste utilisable — la liste s'affiche, les numéros aussi —
    mais il ne peut plus rien dire de la distance ni de la compatibilité. Un
    refus n'est donc pas une panne : c'est une fonctionnalité en moins, et le
    panneau de trajet propose de réessayer.
  */
  /** Le dernier relevé retenu, pour juger le suivant. */
  const dernierReleve = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const localiser = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setEtatPosition("refusee");
      return;
    }

    setEtatPosition("attente");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const releve = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          at: pos.timestamp || Date.now(),
        };
        dernierReleve.current = releve;
        setDepart({ lat: releve.lat, lng: releve.lng });
        setDepartNom(null);
        setPrecision(pos.coords.accuracy ?? null);
        setEtatPosition("trouvee");
      },
      () => setEtatPosition("refusee"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000 },
    );
  }, []);

  useEffect(localiser, [localiser]);

  /*
    Le suivi continu, filtré.

    Une position figée au premier relevé vieillit vite : le client marche vers
    son taxi, et la carte le laisse là où il était. Un suivi brut, à l'inverse,
    le fait sauter d'un bout à l'autre de la ville chaque fois que le GPS perd
    les satellites entre deux immeubles.

    On garde donc le suivi, mais chaque relevé doit être crédible — précision
    annoncée raisonnable, et déplacement compatible avec une vitesse humaine.
    Le suivi s'arrête dès que le départ a été saisi à la main : quelqu'un qui a
    corrigé son point de départ ne veut pas que le GPS le lui reprenne.
  */
  useEffect(() => {
    if (departNom !== null) return;
    if (!("geolocation" in navigator)) return;

    const veille = navigator.geolocation.watchPosition(
      (pos) => {
        const releve = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          at: pos.timestamp || Date.now(),
          precision: pos.coords.accuracy ?? null,
        };

        if (!positionPlausible(dernierReleve.current, releve)) return;

        dernierReleve.current = { lat: releve.lat, lng: releve.lng, at: releve.at };
        setPrecision(releve.precision);
        setDepart((actuel) => {
          // Sous vingt mètres, on ne bouge pas : c'est le tremblement du
          // capteur, et déplacer le marqueur pour cela donne l'impression que
          // la carte vibre.
          if (actuel && distanceMeters(actuel, releve) < 20) return actuel;
          return { lat: releve.lat, lng: releve.lng };
        });
        setEtatPosition("trouvee");
      },
      () => {
        // Une erreur en cours de suivi ne remet pas en cause la position déjà
        // obtenue : on garde la dernière fiable.
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );

    return () => navigator.geolocation.clearWatch(veille);
  }, [departNom]);

  /**
   * Poser un lieu sur l'un des deux bouts du trajet.
   *
   * Un seul chemin pour les trois façons de désigner un endroit — la liste, la
   * saisie, le toucher sur la carte —, sans quoi chacune finirait par se
   * comporter un peu différemment des deux autres.
   */
  const poserLieu = useCallback((champ: Champ, lieu: LieuChoisi | null) => {
    if (champ === "destination") {
      setDestination(lieu);
      return;
    }

    if (!lieu) {
      // On ne vide pas un départ : on revient à la position réelle, qui est le
      // seul repli qui ait un sens.
      localiser();
      return;
    }

    setDepart({ lat: lieu.lat, lng: lieu.lng });
    setDepartNom(lieu.nom);
    setEtatPosition("trouvee");
  }, [localiser]);

  const trajet = useMemo(
    () => (depart ? { depart, destination } : null),
    [depart, destination],
  );

  /*
    L'itinéraire se recalcule quand le trajet change, pas quand la carte bouge.

    Les coordonnées sont arrondies dans la clé de l'effet : un GPS qui tremble
    de quelques mètres ne change pas d'itinéraire, et relancer le calcul à
    chaque battement épuiserait un service public gratuit pour rien.
  */
  const cleTrajet =
    depart && destination
      ? `${depart.lat.toFixed(4)},${depart.lng.toFixed(4)}>${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`
      : null;

  useEffect(() => {
    if (!depart || !destination) {
      setChemin(null);
      return;
    }

    let annule = false;
    void itineraire(depart, destination).then((resultat) => {
      if (!annule) setChemin(resultat);
    });

    return () => {
      annule = true;
    };
    // `cleTrajet` suffit : c'est lui qui dit si le trajet a réellement changé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleTrajet]);

  /*
    Une ligne par chauffeur, calculée une fois pour la carte et pour le tableau.

    Les deux doivent dire la même chose : un chauffeur marqué « libre » sur la
    carte et « en course » dans la liste ferait douter de l'écran entier. Une
    seule source, deux rendus.
  */
  const lignes: LigneChauffeur[] = useMemo(() => {
    return drivers
      .map((d) => {
        /*
          L'état vient de ce que le chauffeur a déclaré, plus de l'âge de sa
          position.

          C'était le défaut central de cet écran : un chauffeur qui fermait
          l'application disparaissait au bout de dix minutes, quoi qu'il ait
          déclaré. On sépare désormais ce qu'il décide — libre, des places,
          occupé — de ce qu'on mesure, sa position, qui vieillit et qu'on date
          honnêtement.
        */
        const presence = presenceDe(d);
        const point: Point | null = presence.cartographiable
          ? { lat: d.lat!, lng: d.lng! }
          : null;

        const libreDans =
          d.free_at != null
            ? Math.max(0, Math.round((new Date(d.free_at).getTime() - Date.now()) / 60_000))
            : null;

        return {
          id: d.id,
          nom: d.display_name,
          telephone: d.phone,
          vehicule: [d.vehicle, d.plate].filter(Boolean).join(" · ") || null,
          libre: presence.statut === "libre",
          distance: point && depart ? distanceMeters(point, depart) : null,
          libreDans,
          placesLibres: presence.places,
          prendEnRoute: d.takes_along === true,
          compat: compatibilite(point, trajet, presence.joignable),
          positionConnue: presence.cartographiable,
          presence,
        };
      })
      /*
        Le meilleur d'abord : la note de compatibilité, puis la distance.

        Sans trajet saisi, la note est nulle pour tout le monde et c'est la
        distance qui classe — ce qui reste l'ordre le plus utile.
      */
      .sort((a, b) => {
        const na = a.compat?.score ?? -1;
        const nb = b.compat?.score ?? -1;
        if (na !== nb) return nb - na;
        return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      });
  }, [drivers, depart, trajet]);

  const choisi = lignes.find((l) => l.id === selection) ?? null;

  /* ─── Ce que la carte reçoit ─────────────────────────────────────────── */

  const pins: DriverPin[] = useMemo(
    () =>
      drivers
        /*
          Seuls ceux dont on sait encore où ils sont.

          Un chauffeur reste dans la liste et reste appelable même sans position
          récente — c'est toute la différence entre « je ne sais pas où il est »
          et « il n'est pas là ». Mais on ne pose pas de point sur une carte pour
          une position de la veille : un point est une affirmation.
        */
        .filter((d) => presenceDe(d).cartographiable)
        .map((d) => {
          const presence = presenceDe(d);

          return {
            id: d.id,
            name: d.display_name,
            lat: d.lat!,
            lng: d.lng!,
            available: presence.joignable,
            detail: [d.vehicle, d.plate].filter(Boolean).join(" · ") || null,
            phone: d.phone,
            initials: monogram(d.display_name),
            selected: d.id === selection,
            caption:
              presence.statut === "libre"
                ? t.taxi.free
                : presence.statut === "places"
                  ? presence.places === null
                    ? t.taxi.statusSeats
                    : t.taxi.seatsLeft.replace("{n}", String(presence.places))
                  : t.taxi.busy,
          };
        }),
    [drivers, selection, t],
  );

  const points: MapPoint[] = useMemo(() => {
    const liste: MapPoint[] = [];
    if (depart) liste.push({ ...depart, label: t.taxi.myPosition, kind: "depart" });
    if (destination) liste.push({ ...destination, label: destination.nom, kind: "arrivee" });
    return liste;
  }, [depart, destination, t]);

  // Le tracé routier s'il a pu être obtenu ; la ligne droite en attendant,
  // pour que la carte ne reste pas muette pendant le calcul.
  const route = chemin?.points ?? (depart && destination ? [depart, destination] : null);

  const labels: MapLabels = {
    free: t.taxi.free,
    busy: t.taxi.busy,
    call: t.taxi.call,
    whatsApp: t.common.whatsApp,
  };

  if (drivers.length === 0) {
    return <EmptyState title={t.taxi.none} body={t.taxi.noneBody} />;
  }

  /** Combien de chauffeurs en course accepteraient quelqu'un sur leur chemin. */
  const enRouteAvecPlace = lignes.filter(
    (l) => !l.libre && l.prendEnRoute && (l.placesLibres ?? 0) > 0,
  ).length;

  return (
    <LazyMotion features={chargerAnimations} strict>
      <div className="flex flex-col gap-3 pb-4">
        {/*
          La carte et le trajet côte à côte sur large écran, empilés sur
          téléphone. La carte garde la plus grande part : c'est elle qui répond
          à la question posée, le reste la commente.
        */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="relative h-[42vh] min-h-[260px] overflow-hidden rounded-[20px] shadow-[0_6px_18px_rgba(60,40,90,0.07)] lg:h-[430px]">
            <DriverMap
              drivers={pins}
              labels={labels}
              points={points}
              route={route}
              onPick={(point) => poserLieu(champActif, { ...point, nom: t.taxi.pointOnMap })}
              recentrer={t.taxi.recenter}
            />

            {/*
              Le rappel discret que des taxis passent par là.

              Il ne s'affiche que lorsqu'il y a vraiment quelqu'un à prendre en
              route : une bannière permanente qui annonce zéro place n'apprend
              rien et occupe le bas de la carte.
            */}
            <AnimatePresence>
              {enRouteAvecPlace > 0 && (
                <m.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.24 }}
                  className="pointer-events-none absolute bottom-3 start-3 z-[500] flex items-center gap-[7px] rounded-full bg-[rgba(20,14,26,0.72)] px-[11px] py-[7px] text-[0.59375rem] font-semibold text-white backdrop-blur-[3px]"
                >
                  <span aria-hidden>🚕</span>
                  {t.taxi.passingBy}
                </m.p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-3">
            <TripPanel
              depart={depart}
              departNom={departNom}
              precision={precision}
              chemin={chemin}
              destination={destination}
              etatPosition={etatPosition}
              champActif={champActif}
              onChampActif={setChampActif}
              onLieu={poserLieu}
              onRelocaliser={localiser}
            />

            {/*
              Les conversations en cours, avant le fil ouvert.

              C'est ce qui manquait : un client qui revenait sur la page ne
              retrouvait pas la réponse de son chauffeur — il fallait deviner
              lequel rouvrir. Le bloc disparaît de lui-même quand il n'y a rien.
            */}
            <ClientThreads clientId={clientId} selection={selection} onOuvrir={setSelection} />

            {/*
              Demander la course avant d'en discuter.

              Un message suppose que le chauffeur peut lire et répondre ; au
              volant, il ne le peut pas. La demande, elle, fait sonner son
              téléphone même application fermée et se répond d'un doigt — c'est
              le canal le plus sûr, et il passe donc en premier. La discussion
              reste juste en dessous pour négocier le prix.
            */}
            {choisi && (
              <RideRequest
                key={`demande-${choisi.id}`}
                driverId={choisi.id}
                clientId={clientId}
                depart={depart}
                departNom={departNom}
                destination={destination}
                destinationNom={destination?.nom ?? null}
                presence={choisi.presence}
              />
            )}

            <AnimatePresence>
              {choisi && (
                <DriverChat
                  key={choisi.id}
                  driverId={choisi.id}
                  driverName={choisi.nom}
                  clientId={clientId}
                  destination={destination?.nom ?? null}
                  onClose={() => setSelection(null)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <DriverList
          lignes={lignes}
          filtre={filtre}
          onFiltre={setFiltre}
          selection={selection}
          onSelection={setSelection}
          espaceChauffeur={espaceChauffeur}
          aUneDestination={destination !== null}
        />
      </div>
    </LazyMotion>
  );
}
