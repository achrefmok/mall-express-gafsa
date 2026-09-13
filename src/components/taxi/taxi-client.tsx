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
import { DriverChat } from "./driver-chat";
import { RideRequest } from "./ride-request";
import { ClientThreads } from "./client-threads";
import { DriverList, type Filtre, type LigneChauffeur } from "./driver-list";
import type { DriverPin, MapLabels, MapPoint } from "./driver-map";
import { CourseSheet, type ChauffeurProche } from "./course-sheet";

const chargerAnimations = () => import("framer-motion").then((mod) => mod.domAnimation);

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
  const [departNom, setDepartNom] = useState<string | null>(null);
  const [etatPosition, setEtatPosition] = useState<"attente" | "trouvee" | "refusee">("attente");
  const [destination, setDestination] = useState<Point | null>(null);
  const [destinationNom, setDestinationNom] = useState<string | null>(null);
  const [chemin, setChemin] = useState<Itineraire | null>(null);

  const [panneauOuvert, setPanneauOuvert] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [selection, setSelection] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dernierReleve = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("taxi_drivers")
      .select("*")
      .eq("is_approved", true)
      .order("is_available", { ascending: false });
    if (!data) return false;
    setDrivers(data as Driver[]);
  }, []);

  usePoll(reload, 30_000);

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
        setEtatPosition("trouvee");
      },
      () => setEtatPosition("refusee"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000 },
    );
  }, []);

  useEffect(localiser, [localiser]);

  useEffect(() => {
    if (departNom !== null) return;
    if (!("geolocation" in navigator)) return;

    const veille = navigator.geolocation.watchPosition(
      (pos) => {
        const releve = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          at: pos.timestamp || Date.now(),
        };
        if (!positionPlausible(dernierReleve.current, releve)) return;
        dernierReleve.current = { lat: releve.lat, lng: releve.lng, at: releve.at };
        setDepart((actuel) => {
          if (actuel && distanceMeters(actuel, releve) < 20) return actuel;
          return { lat: releve.lat, lng: releve.lng };
        });
        setEtatPosition("trouvee");
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );

    return () => navigator.geolocation.clearWatch(veille);
  }, [departNom]);

  const cleTrajet = depart && destination
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
    return () => { annule = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleTrajet]);

  const lignes: LigneChauffeur[] = useMemo(() => {
    const trajet = depart && destination ? { depart, destination } : null;
    return drivers
      .map((d) => {
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
      .sort((a, b) => {
        const na = a.compat?.score ?? -1;
        const nb = b.compat?.score ?? -1;
        if (na !== nb) return nb - na;
        return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      });
  }, [drivers, depart, destination]);

  const chauffeursProches = useMemo(() => {
    if (!depart) return [];
    return lignes
      .filter((l) => l.positionConnue && l.distance !== null && l.distance < 5000)
      .slice(0, 8);
  }, [lignes, depart]);

  /*
    Ce que le panneau montre : les mêmes chauffeurs que la liste, réduits à ce
    qu'une carte a la place d'afficher. Dérivé plutôt que recalculé — les deux
    vues doivent dire la même chose du même chauffeur.
  */
  const cartesChauffeurs: ChauffeurProche[] = useMemo(
    () =>
      chauffeursProches.map((l) => ({
        id: l.id,
        nom: l.nom,
        telephone: l.telephone,
        vehicule: l.vehicule,
        distance: l.distance,
        placesLibres: l.placesLibres,
        libre: l.libre,
      })),
    [chauffeursProches],
  );

  /*
    Le repli : tous les taxis joignables, distance ou pas.

    La liste de proximité exige une position connue et moins de cinq km.
    Ces deux conditions sont bonnes pour classer, mauvaises pour conclure : un
    chauffeur qui n'a jamais autorisé le GPS reste parfaitement joignable, et
    sept kilomètres à Gafsa ne sont pas le bout du monde. Les écarter de
    l'affichage revenait à dire au client qu'il n'y a personne alors qu'il y a
    un numéro à composer.

    Trié par distance quand on la connaît, et ceux dont on l'ignore à la fin —
    pas exclus, seulement moins prioritaires.
  */
  const cartesToutes: ChauffeurProche[] = useMemo(
    () =>
      lignes
        .filter((l) => l.presence.joignable)
        .slice(0, 12)
        .map((l) => ({
          id: l.id,
          nom: l.nom,
          telephone: l.telephone,
          vehicule: l.vehicule,
          distance: l.distance,
          placesLibres: l.placesLibres,
          libre: l.libre,
        })),
    [lignes],
  );

  const choisi = lignes.find((l) => l.id === selection) ?? null;

  const pins: DriverPin[] = useMemo(
    () =>
      drivers
        /*
          Deux conditions pour figurer sur la carte, et la seconde est nouvelle.

          « Cartographiable » ne dit que ceci : on sait où il était, et le
          relevé n'est pas trop vieux. Cela n'a jamais rien dit de sa
          disponibilité — un chauffeur hors ligne gardait donc son repère, et
          la carte proposait au client quelqu'un qui s'était retiré.

          Se retirer doit être une absence, pas un grisé.
        */
        .filter((d) => {
          const presence = presenceDe(d);
          return presence.cartographiable && presence.statut !== "hors_ligne";
        })
        .map((d) => {
          const presence = presenceDe(d);
          return {
            id: d.id,
            name: d.display_name,
            lat: d.lat!,
            lng: d.lng!,
            available: presence.joignable,
            // L etat reel plutot que le seul booleen : le halo ne bat que
            // pour qui peut effectivement venir.
            // Le filtre ci-dessus a deja ecarte « hors_ligne » : ce qui
            // reste correspond exactement aux etats que la carte sait peindre.
            etat: presence.statut as "libre" | "places" | "occupe",
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
    if (destination) liste.push({ lat: destination.lat, lng: destination.lng, label: destinationNom ?? "Destination", kind: "arrivee" });
    return liste;
  }, [depart, destination, destinationNom, t]);

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

  /*
    Combien de taxis peuvent réellement venir.

    Compté sur la présence déclarée : c'est la même règle que
    le matching applique. Un compteur qui annoncerait plus de taxis que le
    serveur n'en contacte serait pire qu'aucun compteur.
  */
  const nbLibres = lignes.filter((l) => l.presence.joignable).length;

  const enRouteAvecPlace = lignes.filter(
    (l) => !l.libre && l.prendEnRoute && (l.placesLibres ?? 0) > 0,
  ).length;

  /*
    La carte occupe l'écran, le reste vient par-dessus.

    ────────────────────────────────────────────────────────────────────────
    Ce que la disposition précédente faisait, et pourquoi elle ne tenait pas
    ────────────────────────────────────────────────────────────────────────

    Une carte de 42 % de hauteur, une colonne de conversation à côté, la liste
    des chauffeurs en dessous — et, par-dessus tout cela, un tiroir en
    `position: fixed`. Le tiroir flottait donc au-dessus d'une page qui
    défilait sous lui : on faisait défiler la liste, elle passait dessous, et
    plus rien ne disait ce qui était au premier plan.

    Deux dispositions distinctes plutôt qu'une seule qui plie :

      téléphone  la carte prend toute la place disponible, le tiroir se tire
                 par-dessus. Rien ne défile derrière lui, parce qu'il n'y a
                 rien derrière lui que la carte.

      ordinateur la carte s'élargit, et le panneau prend sa place à côté
                 d'elle, dans le flux. Un tiroir n'aurait aucun sens là où la
                 place ne manque pas.

    `min-h-0` sur les deux conteneurs flex : sans lui, un enfant qui défile
    pousse son parent au lieu de défiler, et la carte déborde sous la barre
    d'onglets.
  */
  return (
    <LazyMotion features={chargerAnimations} strict>
      <div className="relative flex min-h-0 flex-1 gap-4 pb-2">
        {/* ─── La carte ──────────────────────────────────────────────── */}
        <div className="relative min-h-[52vh] flex-1 overflow-hidden rounded-[20px] shadow-[0_6px_18px_rgba(60,40,90,0.07)] lg:min-h-0">
          <DriverMap
            drivers={pins}
            labels={labels}
            points={points}
            route={route}
            onPick={(point) => {
              setDestination({ lat: point.lat, lng: point.lng });
              setDestinationNom("Point sur la carte");
            }}
            recentrer={t.taxi.recenter}
          />

          {/*
            Le compteur, en haut de la carte.

            Discret parce qu'il n'appelle aucune action : c'est un état, pas un
            bouton. Mais c'est la première question qu'on se pose en ouvrant
            l'écran — y a-t-il quelqu'un ? —, et y répondre avant qu'elle ne
            soit posée évite d'aller la chercher dans une liste.
          */}
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex items-start justify-between gap-2">
            <span className="flex items-center gap-[7px] rounded-full bg-[rgba(255,255,255,0.92)] px-[11px] py-[7px] text-[0.6875rem] font-bold text-[var(--color-ink)] shadow-[0_2px_10px_rgba(20,14,26,0.14)] backdrop-blur-[6px] dark:bg-[rgba(30,24,40,0.92)]">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: nbLibres > 0 ? "#2f7d5d" : "var(--color-faint)" }}
              />
              {nbLibres > 0
                ? `${nbLibres} taxi${nbLibres > 1 ? "s" : ""} disponible${nbLibres > 1 ? "s" : ""}`
                : "Aucun taxi libre"}
            </span>

            <AnimatePresence>
              {enRouteAvecPlace > 0 && (
                <m.span
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24 }}
                  className="flex items-center gap-[6px] rounded-full bg-[rgba(20,14,26,0.72)] px-[10px] py-[6px] text-[0.625rem] font-semibold text-white backdrop-blur-[4px]"
                >
                  <span aria-hidden>🚕</span>
                  {t.taxi.passingBy}
                </m.span>
              )}
            </AnimatePresence>
          </div>

          {/*
            « Ma position », flottant et seul.

            Séparé du formulaire à dessein : on s'en sert à n'importe quel
            moment du parcours — pendant la saisie, pendant l'attente, pendant
            la course —, y compris quand le tiroir est replié. L'enfermer dans
            le champ « Départ » l'aurait rendu inatteignable les trois quarts
            du temps.

            Placé au-dessus de la hauteur repliée du tiroir, pour ne jamais
            passer dessous.
          */}
          <button
            type="button"
            onClick={localiser}
            aria-label={t.taxi.recenter}
            className="absolute end-3 bottom-[calc(18%+16px)] z-[500] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-solid)] text-[1.125rem] shadow-[0_4px_14px_rgba(20,14,26,0.2)] transition-transform active:scale-[0.92] lg:bottom-4"
          >
            <span
              aria-hidden
              className={etatPosition === "attente" ? "animate-pulse" : undefined}
            >
              {etatPosition === "refusee" ? "📍" : "🎯"}
            </span>
          </button>
        </div>

        {/*
          Sur ordinateur, le panneau prend sa place ici, dans le flux.

          `CourseSheet` est monté une seule fois et décide de sa forme : tiroir
          sur téléphone, colonne ici. Le rendre deux fois et en masquer un par
          CSS donnerait deux formulaires, deux abonnements sur la même course,
          et une saisie perdue au redimensionnement.
        */}
        {mounted && !espaceChauffeur && (
          <CourseSheet
            ouvert={panneauOuvert}
            onFermer={() => setPanneauOuvert(false)}
            depart={depart}
            departNom={departNom}
            onDepartNom={(nom, point) => {
              setDepartNom(nom);
              if (point) setDepart(point);
            }}
            onRelocaliser={localiser}
            etatPosition={etatPosition}
            chauffeursProches={cartesChauffeurs}
            chauffeursTous={cartesToutes}
            clientId={clientId}
            onDestination={(point, nom) => {
              setDestination(point);
              setDestinationNom(nom);
            }}
            onDiscuter={(driverId) => setSelection(driverId)}
            extra={
              <div className="flex flex-col gap-3">
                <ClientThreads clientId={clientId} selection={selection} onOuvrir={setSelection} />

                {choisi && (
                  <RideRequest
                    key={`demande-${choisi.id}`}
                    driverId={choisi.id}
                    clientId={clientId}
                    depart={depart}
                    departNom={departNom}
                    destination={destination ? { lat: destination.lat, lng: destination.lng } : null}
                    destinationNom={destinationNom}
                    presence={choisi.presence}
                  />
                )}

                {/*
                  La conversation vit dans le panneau, pas par-dessus lui.

                  Montée une seule fois, comme tout le reste : la rendre à deux
                  endroits — un tiroir sur téléphone, une colonne sur écran —
                  aurait donné deux fils, deux sondages, et un brouillon perdu
                  au redimensionnement.
                */}
                <AnimatePresence>
                  {choisi && (
                    <DriverChat
                      key={choisi.id}
                      driverId={choisi.id}
                      driverName={choisi.nom}
                      clientId={clientId}
                      destination={destinationNom}
                      onClose={() => setSelection(null)}
                    />
                  )}
                </AnimatePresence>

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
            }
          />
        )}

        {/*
          Un chauffeur garde l'écran, sans le panneau de commande.

          Il vient y voir qui est en service et où. La liste lui reste donc
          accessible en pleine largeur, à la place qu'aurait prise le panneau.
        */}
        {espaceChauffeur && (
          <aside className="no-sb hidden w-[380px] flex-none overflow-y-auto lg:block">
            <DriverList
              lignes={lignes}
              filtre={filtre}
              onFiltre={setFiltre}
              selection={selection}
              onSelection={setSelection}
              espaceChauffeur={espaceChauffeur}
              aUneDestination={destination !== null}
            />
          </aside>
        )}
      </div>

    </LazyMotion>
  );
}
