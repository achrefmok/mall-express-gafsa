"use client";

import { m } from "framer-motion";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  registerDriver,
  setDriverStatus,
  signalerPresence,
  updateDriverPosition,
} from "@/app/actions/taxi";
import { updateDriverRoute } from "@/app/actions/taxi-matching";
import { shouldPublishPosition } from "@/lib/geo";
import { presenceDe, type TaxiStatus } from "@/lib/taxi-presence";
import { Button, Card } from "@/components/ui/primitives";
import { TAXI_ZONES, nomZone, estZone } from "@/lib/taxi-zones";
import { cx } from "@/lib/format";

const FIELD =
  "w-full rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-3 py-2 text-[0.75rem] text-[var(--color-ink)]";

export interface DriverProfile {
  display_name: string;
  phone: string;
  vehicle: string | null;
  plate: string | null;
  is_available: boolean;
  is_approved: boolean;
  position_updated_at: string | null;
  /* Ajoutées par la migration de présence. Absentes tant qu'elle n'est pas
     collée, d'où l'optionnel : le repli de `presenceDe` prend alors le relais. */
  status?: string | null;
  seats_total?: number | null;
  seats_free?: number | null;
  /* Ajoutées par la migration de matching. Absentes tant qu'elle n'est pas
     collée ; la carte de trajet les laisse alors vides, sans planter. */
  origin_zone?: string | null;
  destination_zone?: string | null;
  accepts_custom?: boolean | null;
}

/**
 * L'espace du chauffeur.
 *
 * Sa fiche, son état, et le partage de sa position. Un chauffeur consulte cet
 * écran au feu rouge — chaque champ ajouté est un champ qu'il ne remplira pas.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi trois états et non un interrupteur
 * ────────────────────────────────────────────────────────────────────────
 *
 * L'interrupteur libre/occupé forçait un choix faux. Un chauffeur qui emmène
 * déjà quelqu'un et à qui il reste trois places n'est ni l'un ni l'autre : se
 * dire libre trompe le client qui l'attend seul, se dire occupé lui coûte les
 * trois courses qu'il aurait pu prendre en chemin. C'est pourtant le
 * fonctionnement ordinaire d'un louage à Gafsa, et l'application ne savait pas
 * l'écrire.
 *
 * Et surtout : **ce qu'il déclare ici lui survit.** Fermer l'application ne le
 * rend plus indisponible. C'est le serveur qui tient son état, avec une
 * expiration longue et explicite, et non la dernière fois que son GPS a parlé.
 */
export function DriverConsole({ initial }: { initial: DriverProfile | null }) {
  const { t, locale } = useI18n();
  const [driver, setDriver] = useState(initial);
  const [name, setName] = useState(initial?.display_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [vehicle, setVehicle] = useState(initial?.vehicle ?? "");
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const watchRef = useRef<number | null>(null);

  /* Le trajet déclaré : qui il est prêt à prendre. Vient de la fiche, puis
     vit localement jusqu'à « Enregistrer mon trajet ». */
  const [origine, setOrigine] = useState<(typeof TAXI_ZONES)[number]["id"] | null>(
    initial?.origin_zone && estZone(initial.origin_zone) ? initial.origin_zone : null,
  );
  const [arrivee, setArrivee] = useState<(typeof TAXI_ZONES)[number]["id"] | null>(
    initial?.destination_zone && estZone(initial.destination_zone) ? initial.destination_zone : null,
  );
  const [acceptCustom, setAcceptCustom] = useState(initial?.accepts_custom ?? false);
  /* Dernière position réellement publiée, pour ne pas republier du bruit. */
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const presence = driver ? presenceDe(driver) : null;
  const statut = presence?.statut ?? "hors_ligne";
  const places = presence?.places ?? null;

  /*
    Le partage de position s'arrête avec l'écran.

    `watchPosition` continue sinon à consommer le GPS en arrière-plan, ce qui
    vide la batterie d'un chauffeur qui a simplement changé d'onglet — et publie
    une position qu'il ne sait plus qu'il partage.

    Ce n'est plus la même chose que devenir indisponible : le statut déclaré
    reste, seule la position cesse d'être rafraîchie. C'était exactement la
    confusion à défaire.
  */
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  /*
    « Je suis là », une fois par minute.

    Assez pour dire au client « vu il y a deux minutes » quand le GPS est refusé
    ou indisponible — un chauffeur peut être parfaitement joignable sans jamais
    partager sa position, et l'ancien modèle le rendait invisible pour cette
    seule raison.

    Le battement ne part que si l'écran est réellement regardé : un téléphone
    posé dans une poche interrogerait sinon le serveur toute la journée.
  */
  useEffect(() => {
    if (!driver) return;

    const battre = () => {
      if (document.visibilityState === "visible") void signalerPresence();
    };

    battre();
    const timer = setInterval(battre, 60_000);
    document.addEventListener("visibilitychange", battre);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", battre);
    };
  }, [driver]);

  function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await registerDriver({
        displayName: name,
        phone,
        vehicle: vehicle || undefined,
        plate: plate || undefined,
      });

      if (!result.ok) return setError(result.error);

      setDriver((current) => ({
        ...current,
        display_name: name.trim(),
        phone: phone.trim(),
        vehicle: vehicle.trim() || null,
        plate: plate.trim() || null,
        is_available: current?.is_available ?? false,
        is_approved: current?.is_approved ?? false,
        position_updated_at: current?.position_updated_at ?? null,
      }));
    });
  }

  /**
   * Changer d'état.
   *
   * L'écran suit le doigt avant que le serveur ait répondu, et revient en
   * arrière si l'écriture échoue. Un chauffeur qui se déclare libre au feu vert
   * ne doit pas attendre un aller-retour réseau pour savoir que c'est pris.
   */
  function choisir(prochain: TaxiStatus, prochainesPlaces?: number | null) {
    const avant = driver;
    if (!avant) return;

    setError(null);
    setDriver({
      ...avant,
      status: prochain,
      is_available: prochain === "libre" || prochain === "places",
      ...(prochainesPlaces === undefined ? {} : { seats_free: prochainesPlaces }),
    });

    startTransition(async () => {
      const result = await setDriverStatus({
        statut: prochain,
        places: prochainesPlaces,
      });

      if (!result.ok) {
        setDriver(avant);
        setError(result.error);
      }
    });
  }

  /**
   * Une place de plus ou de moins.
   *
   * Le passage à « complet » n'est pas un affichage : à zéro place, le chauffeur
   * bascule en occupé et cesse de recevoir des demandes. C'est ce qui empêche un
   * cinquième passager de réserver dans une voiture de quatre.
   */
  function ajusterPlaces(delta: number) {
    const actuelles = places ?? driver?.seats_total ?? 4;
    const suivantes = Math.max(0, Math.min(8, actuelles + delta));
    if (suivantes === places) return;

    choisir(suivantes === 0 ? "occupe" : "places", suivantes);
  }

  /** Enregistrer le trajet déclaré ; les demandes compatibles affluent ensuite. */
  function enregistrerTrajet(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateDriverRoute({
        originZone: origine,
        destinationZone: arrivee,
        acceptCustom,
      });

      if (!result.ok) setError(result.error);
    });
  }

  function onShare() {
    if (!("geolocation" in navigator)) {
      setError("Votre appareil ne permet pas le partage de position.");
      return;
    }

    setError(null);
    setSharing(true);

    /*
      `watchPosition` plutôt qu'un relevé unique : un taxi se déplace, et une
      position figée au moment de l'inscription enverrait les clients au mauvais
      endroit une heure plus tard.
    */
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };

        /*
          Ne publier que ce qui apprend quelque chose.

          Le GPS livre un relevé toutes les une à trois secondes, et il en livre
          même à l'arrêt : la position tremble de quelques mètres sans que rien ne
          bouge. Chaque écriture était auparavant diffusée à tous les clients
          regardant la carte, qui relisaient alors la liste entière — le quota
          mensuel de messages partait en moins d'une journée.

          Cinquante mètres, ou vingt-cinq secondes. Un taxi en ville franchit
          cinquante mètres en quelques secondes : la carte ne perd rien.
        */
        if (!shouldPublishPosition(lastSentRef.current, next)) return;
        lastSentRef.current = { ...next, at: Date.now() };

        void updateDriverPosition(next.lat, next.lng);
        setDriver((current) =>
          current ? { ...current, position_updated_at: new Date().toISOString() } : current,
        );
      },
      () => {
        setSharing(false);
        setError("Position refusée. Autorisez la localisation dans les réglages du navigateur.");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }

  /* Les trois états qu'un chauffeur choisit lui-même. « Hors ligne » est à part :
     c'est un retrait, pas une disponibilité, et il ne mérite pas la même place. */
  const etats: Array<{ cle: TaxiStatus; libelle: string; teinte: string }> = [
    { cle: "libre", libelle: t.taxi.free, teinte: "#2f7d5d" },
    { cle: "places", libelle: t.taxi.statusSeats, teinte: "#2563a8" },
    { cle: "occupe", libelle: t.taxi.busy, teinte: "#b8722c" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {driver && !driver.is_approved && (
        <Card className="p-3">
          <p className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
            {t.taxi.pendingApproval}
          </p>
        </Card>
      )}

      {driver && (
        <Card className="flex flex-col gap-[10px] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">
              {t.taxi.declareStatus}
            </p>

            {statut !== "hors_ligne" && (
              <button
                type="button"
                onClick={() => choisir("hors_ligne")}
                disabled={pending}
                className="press flex-none text-[0.59375rem] font-semibold text-[var(--color-muted)] underline underline-offset-2 disabled:opacity-50"
              >
                {t.taxi.offline}
              </button>
            )}
          </div>

          {/* Trois pastilles plutôt qu'un interrupteur : le troisième état est le
              seul qui décrive vraiment un louage en cours de route. */}
          <div className="relative flex gap-[6px] rounded-[14px] bg-[var(--color-field)] p-[4px]">
            {etats.map((etat) => {
              const actif = statut === etat.cle;

              return (
                <button
                  key={etat.cle}
                  type="button"
                  onClick={() => choisir(etat.cle, etat.cle === "places" ? (places ?? 3) : undefined)}
                  disabled={pending}
                  aria-pressed={actif}
                  className="press relative flex-1 rounded-[11px] px-1 py-[9px] text-[0.625rem] font-bold disabled:opacity-60"
                  style={{ color: actif ? "#fff" : "var(--color-muted)" }}
                >
                  {actif && (
                    <m.span
                      layoutId="etat-chauffeur"
                      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                      className="absolute inset-0 rounded-[11px]"
                      style={{ background: etat.teinte }}
                    />
                  )}
                  <span className="relative">{etat.libelle}</span>
                </button>
              );
            })}
          </div>

          {/* Le compteur de places n'apparaît que quand il veut dire quelque
              chose : afficher « 0 place » à un chauffeur qui se déclare libre
              seul dans sa voiture serait une question sans objet. */}
          {statut === "places" && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <p className="min-w-0 flex-1 text-[0.65625rem] text-[var(--color-muted)]">
                {t.taxi.seatsLabel}
              </p>

              <div className="flex flex-none items-center gap-1">
                <button
                  type="button"
                  onClick={() => ajusterPlaces(-1)}
                  disabled={pending || (places ?? 0) <= 0}
                  aria-label="−"
                  className="press flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--color-field)] text-[0.9375rem] font-bold text-[var(--color-ink)] disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-[26px] text-center text-[0.875rem] font-bold tabular-nums text-[var(--color-ink)]">
                  {places ?? "—"}
                </span>
                <button
                  type="button"
                  onClick={() => ajusterPlaces(1)}
                  disabled={pending || (places ?? 0) >= 8}
                  aria-label="+"
                  className="press flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--color-field)] text-[0.9375rem] font-bold text-[var(--color-ink)] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </m.div>
          )}

          {/*
            La phrase qui répond à la question que tout chauffeur se pose.

            Elle vaut mieux qu'un long réglage : elle dit que fermer
            l'application ne le retire pas de la carte, ce qui est précisément ce
            que l'ancien comportement faisait sans le dire.
          */}
          <p className="text-[0.59375rem] leading-[1.5] text-[var(--color-faint)]">
            {t.taxi.statusKeptNote}
          </p>
        </Card>
      )}

      {/*
        Le trajet que le chauffeur choisit de servir.
        
        Sans lui, aucune demande de matching ne lui arrive : c'est la route
        déclarée qui fait la correspondance. Pour les destinations hors zones,
        la case est son accord — jamais une hypothèse de la plateforme.
      */}
      {driver && (
        <Card className="flex flex-col gap-[10px] p-3">
          <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">
            🧭 {t.taxi.orderDriverRoute}
          </p>

          <div className="flex flex-col gap-[6px]">
            <p className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
              {t.taxi.orderRouteOrigin}
            </p>
            <div className="flex flex-wrap gap-[6px]">
              {TAXI_ZONES.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setOrigine(zone.id)}
                  aria-pressed={origine === zone.id}
                  className={cx(
                    "press rounded-full border px-[11px] py-[7px] text-[0.625rem] font-bold",
                    origine === zone.id
                      ? "border-[var(--color-brand-fill)] bg-[var(--color-brand-tint,rgba(131,56,228,0.1))] text-[var(--color-brand)]"
                      : "border-[var(--color-outline)] text-[var(--color-muted)]",
                  )}
                >
                  {nomZone(zone.id, locale)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <p className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
              {t.taxi.orderRouteDest}
            </p>
            <div className="flex flex-wrap gap-[6px]">
              {TAXI_ZONES.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setArrivee(zone.id)}
                  aria-pressed={arrivee === zone.id}
                  className={cx(
                    "press rounded-full border px-[11px] py-[7px] text-[0.625rem] font-bold",
                    arrivee === zone.id
                      ? "border-[var(--color-brand-fill)] bg-[var(--color-brand-tint,rgba(131,56,228,0.1))] text-[var(--color-brand)]"
                      : "border-[var(--color-outline)] text-[var(--color-muted)]",
                  )}
                >
                  {nomZone(zone.id, locale)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-[12px] bg-[var(--color-field)] px-3 py-[9px]">
            <input
              type="checkbox"
              checked={acceptCustom}
              onChange={(e) => setAcceptCustom(e.target.checked)}
              className="h-[16px] w-[16px] flex-none accent-[var(--color-brand-fill)]"
            />
            <span className="text-[0.65625rem] font-semibold text-[var(--color-ink)]">
              {t.taxi.orderAcceptCustom}
            </span>
          </label>

          <p className="text-[0.59375rem] leading-[1.5] text-[var(--color-faint)]">
            {t.taxi.orderRouteNote}
          </p>

          <Button
            type="button"
            onClick={enregistrerTrajet}
            disabled={pending || origine !== null !== (arrivee !== null)}
          >
            {t.taxi.orderRouteCta}
          </Button>
        </Card>
      )}

      {driver && (
        <div className="flex flex-col gap-[6px]">
          <Button tone={sharing ? "outline" : "primary"} onClick={onShare} disabled={sharing}>
            {sharing ? t.taxi.positionShared : t.taxi.sharePosition}
          </Button>

          {/*
            Dire la limite plutôt que la laisser découvrir.

            Aucun navigateur ne permet de relever le GPS application fermée : ni
            service worker, ni API d'arrière-plan. Un chauffeur qui croirait le
            contraire penserait que l'application est cassée quand sa position
            cesse de bouger. Autant l'écrire, et préciser que son statut, lui,
            ne bouge pas.
          */}
          <p className="px-1 text-[0.5625rem] leading-[1.5] text-[var(--color-faint)]">
            {t.taxi.gpsBackgroundNote}
          </p>
        </div>
      )}

      <Card className="p-3">
        <form onSubmit={onSave} className="flex flex-col gap-[10px]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.taxi.driverName}
            className={FIELD}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder={t.taxi.driverPhone}
            className={FIELD}
          />
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder={t.taxi.driverVehicle}
            className={FIELD}
          />
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder={t.taxi.driverPlate}
            className={cx(FIELD)}
          />

          {error && (
            <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "…" : driver ? t.common.save : t.taxi.register}
          </Button>
        </form>
      </Card>
    </div>
  );
}
