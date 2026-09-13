"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  accepterDemandeProche,
  demandesProches,
  proposerDestination,
  type DemandeProche,
} from "@/app/actions/taxi-propositions";
import { usePoll } from "@/lib/use-poll";
import { nomZone } from "@/lib/taxi-zones";
import { chercherLieux } from "@/lib/taxi-lieux";
import dynamic from "next/dynamic";
import type { ClientPin, MapLabels } from "./driver-map";

/* La carte touche `window` : elle ne peut pas être rendue côté serveur. */
const DriverMap = dynamic(() => import("./driver-map").then((m) => m.DriverMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--color-track)]" />,
});

/* ═══════════════════════════════════════════════════════════════════════
   Chercher des clients, au lieu de les attendre.

   Le chauffeur ne pouvait que **recevoir** : le serveur lui adressait les
   demandes compatibles, et s'il n'en venait aucune, son écran restait vide
   sans qu'il puisse rien y faire. Il ne pouvait pas non plus regarder autour
   de lui — `taxi_requests` n'est lisible que de ses deux extrémités, et il
   n'en est pas une tant que personne n'a accepté.

   D'où la fonction SQL `taxi_demandes_proches`, qui est la seule porte, et
   qui filtre pour lui : les demandes ouvertes dans son rayon, triées par
   proximité, **sans l'identité du client ni son téléphone ni son départ
   exact**. Il voit une distance, une destination, un nombre de passagers et
   un budget — de quoi décider, et rien de plus. Le reste apparaît quand il
   accepte, c'est-à-dire quand il devient une extrémité de la course.

   Deux gestes, et le second est celui qui manquait le plus :

     Accepter          — il prend la course telle qu'elle est annoncée ;
     Autre destination — « je vais vers Lella, ça vous arrange ? ». Le client
                         tranche. C'est ainsi qu'on prend un taxi ici, et
                         l'application ne savait pas l'exprimer.
   ═══════════════════════════════════════════════════════════════════════ */

/** Assez large pour couvrir Gafsa, assez serré pour rester utile. */
const RAYON_M = 8000;

/*
  La carte est réemployée du côté client, où elle sert à appeler un chauffeur.
  Ici personne n'appelle personne depuis un repère : c'est le chauffeur qui
  regarde des demandes. Les libellés sont donc présents pour satisfaire le
  contrat du composant, et les bulles des clients n'en utilisent aucun.
*/
const ETIQUETTES: MapLabels = {
  free: "Libre",
  busy: "Occupé",
  call: "Appeler",
  whatsApp: "WhatsApp",
};

function distanceTexte(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function destinationTexte(d: DemandeProche): string {
  if (d.destinationType === "zone" && d.destinationZone) {
    return nomZone(d.destinationZone, "fr") ?? d.destinationZone;
  }
  return d.destinationName ?? d.destLabel ?? "Destination libre";
}

function departTexte(d: DemandeProche): string {
  if (d.pickupLabel) return d.pickupLabel;
  if (d.originZone) return nomZone(d.originZone, "fr") ?? d.originZone;
  return "Position du client";
}

/*
  Aucun identifiant en paramètre, et c'est délibéré.

  Qui cherche est décidé côté serveur, par auth.uid() dans la fonction SQL.
  Recevoir un identifiant du navigateur laisserait croire qu'il gouverne
  quelque chose — alors qu'un chauffeur qui en enverrait un autre verrait
  exactement la même liste : la sienne.
*/
export function DriverNearby() {
  const reduit = useReducedMotion();

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [etatGps, setEtatGps] = useState<"attente" | "ok" | "refuse">("attente");
  const [demandes, setDemandes] = useState<DemandeProche[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [propose, setPropose] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);

  /*
    La position vient du navigateur, maintenant, et n'est pas écrite en base.

    Elle sert uniquement à trier et à filtrer cette liste. Un chauffeur peut
    parfaitement refuser le partage continu de sa position — qui alimente la
    carte des clients — et vouloir néanmoins chercher une course à l'instant
    où il ouvre l'écran. Les deux choses sont distinctes, et les confondre
    reviendrait à lui faire payer une fonctionnalité pour en obtenir une autre.
  */
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setEtatGps("refuse");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setEtatGps("ok");
      },
      () => setEtatGps("refuse"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);

  const relire = useCallback(async () => {
    if (!position) return;

    const r = await demandesProches({ lat: position.lat, lng: position.lng, rayonM: RAYON_M });
    setCharge(true);

    if (!r.ok) {
      setErreur(r.error);
      return false;
    }

    setErreur(null);
    setDemandes(r.data);
  }, [position]);

  // Première lecture dès que la position arrive, puis à cadence lente : une
  // demande vit trois minutes, la relire toutes les vingt secondes suffit
  // largement et ne pèse rien à côté de ce que coûtait la diffusion GPS.
  useEffect(() => {
    if (position) void relire();
  }, [position, relire]);

  usePoll(relire, 20_000);

  /*
    Les repères, dérivés des demandes déjà chargées.

    Aucune requête de plus : la carte et la liste montrent exactement le même
    ensemble, et c'est ce qui garantit qu'un client visible sur l'une est
    cliquable sur l'autre. Un jeu de données séparé pour la carte finirait par
    diverger — c'est ce qui était arrivé aux coordonnées des lieux.
  */
  const reperes: ClientPin[] = useMemo(
    () =>
      demandes.map((d) => ({
        id: d.id,
        lat: d.pickupLat,
        lng: d.pickupLng,
        distanceM: d.distanceM,
        destination: destinationTexte(d),
        seats: d.seats,
        prix: d.proposedPrice,
        selected: d.id === choisi,
      })),
    [demandes, choisi],
  );

  function accepter(id: string) {
    if (!position) return;
    setErreur(null);

    startTransition(async () => {
      const r = await accepterDemandeProche({
        demandeId: id,
        lat: position.lat,
        lng: position.lng,
      });

      if (!r.ok) {
        setErreur(r.error);
        // La course est peut-être partie chez un autre : on relit plutôt que
        // de laisser une carte morte sous le pouce.
        void relire();
        return;
      }

      setDemandes((liste) => liste.filter((d) => d.id !== id));
    });
  }

  if (etatGps === "refuse") {
    return (
      <Cadre>
        <p className="text-[0.8125rem] text-[var(--color-muted)]">
          Autorisez la localisation pour voir les clients autour de vous.
        </p>
      </Cadre>
    );
  }

  if (!charge) {
    return (
      <Cadre>
        <div className="flex flex-col gap-2" aria-hidden>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[76px] animate-pulse rounded-[16px] bg-[var(--color-field)]"
            />
          ))}
        </div>
        <span className="sr-only">Recherche des clients autour de vous…</span>
      </Cadre>
    );
  }

  return (
    <Cadre>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[0.9375rem] font-bold text-[var(--color-ink)]">
          Clients autour de vous
        </h2>
        <span className="rounded-full bg-[var(--color-field)] px-2 py-1 text-[0.625rem] font-bold tabular-nums text-[var(--color-muted)]">
          {demandes.length}
        </span>
      </div>

      {erreur && (
        <p
          role="alert"
          className="mb-3 rounded-[12px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.75rem] font-medium text-[var(--color-live)]"
        >
          {erreur}
        </p>
      )}

      {/*
        La carte, avant la liste.

        Un chauffeur juge une course à sa géographie avant tout le reste : où
        est le client, dans quelle direction il part, et si cela l'arrange. Une
        colonne de distances ne dit pas si les trois demandes sont dans la même
        rue ou aux trois coins de la ville.
      */}
      {position && demandes.length > 0 && (
        <div className="mb-3 h-[210px] overflow-hidden rounded-[16px]">
          <DriverMap
            drivers={[
              {
                id: "moi",
                name: "Ma position",
                lat: position.lat,
                lng: position.lng,
                available: true,
                etat: "libre",
                initials: "MOI",
              },
            ]}
            clients={reperes}
            labels={ETIQUETTES}
          />
        </div>
      )}

      {demandes.length === 0 ? (
        <p className="py-4 text-center text-[0.8125rem] text-[var(--color-muted)]">
          Aucune demande dans un rayon de {RAYON_M / 1000} km pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {demandes.map((d, i) => (
              <m.article
                key={d.id}
                layout
                initial={reduit ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduit ? undefined : { opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
                transition={
                  reduit
                    ? { duration: 0 }
                    : { delay: Math.min(i, 5) * 0.05, duration: 0.32, ease: [0.32, 0.72, 0, 1] }
                }
                className="rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[0.875rem] font-bold text-[var(--color-ink)]">
                      <span aria-hidden>📍</span>
                      <span className="tabular-nums">{distanceTexte(d.distanceM)}</span>
                      <span className="truncate text-[0.75rem] font-normal text-[var(--color-muted)]">
                        · {departTexte(d)}
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-[var(--color-ink)]">
                      <span aria-hidden>🎯</span>
                      <span className="truncate">{destinationTexte(d)}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.6875rem] text-[var(--color-muted)]">
                      <span>👤 {d.seats} pers.</span>
                      {d.proposedPrice !== null && (
                        <span className="font-semibold text-[var(--color-ink)]">
                          💰 {d.proposedPrice} DT
                        </span>
                      )}
                      {d.dejaDiffusee && <span>· déjà proposée</span>}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setChoisi(d.id); setPropose(propose === d.id ? null : d.id); }}
                    className="min-h-[44px] flex-1 rounded-[12px] bg-[var(--color-field)] text-[0.75rem] font-semibold text-[var(--color-ink)] transition-transform active:scale-[0.97] disabled:opacity-50"
                  >
                    🎯 Autre destination
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => accepter(d.id)}
                    className="min-h-[44px] flex-1 rounded-[12px] bg-[var(--color-brand-fill)] text-[0.75rem] font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
                  >
                    Accepter
                  </button>
                </div>

                <AnimatePresence>
                  {propose === d.id && (
                    <FormProposition
                      demandeId={d.id}
                      reduit={Boolean(reduit)}
                      onFini={() => { setPropose(null); void relire(); }}
                      onErreur={setErreur}
                    />
                  )}
                </AnimatePresence>
              </m.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Cadre>
  );
}

/**
 * Proposer une autre destination, sans quitter la carte de la demande.
 *
 * Le champ est libre et les suggestions ne sont qu'une aide : le chauffeur
 * connaît des lieux que le répertoire ignorera toujours, et lui imposer une
 * liste reviendrait à lui faire décrire sa propre ville dans un vocabulaire
 * qui n'est pas le sien.
 */
function FormProposition({
  demandeId,
  reduit,
  onFini,
  onErreur,
}: {
  demandeId: string;
  reduit: boolean;
  onFini: () => void;
  onErreur: (message: string) => void;
}) {
  const [saisie, setSaisie] = useState("");
  const [pending, startTransition] = useTransition();
  const champ = useRef<HTMLInputElement | null>(null);

  useEffect(() => { champ.current?.focus(); }, []);

  const suggestions = saisie.trim().length >= 1 ? chercherLieux(saisie, 4) : [];

  function envoyer(label: string, lat?: number, lng?: number) {
    const nom = label.trim();
    if (nom.length < 2) return;

    startTransition(async () => {
      const r = await proposerDestination({
        demandeId,
        label: nom,
        lat: lat ?? null,
        lng: lng ?? null,
      });

      if (!r.ok) { onErreur(r.error); return; }
      onFini();
    });
  }

  return (
    <m.div
      initial={reduit ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduit ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden"
    >
      <div className="mt-2.5 flex flex-col gap-2 border-t border-[var(--color-hairline)] pt-2.5">
        <input
          ref={champ}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); envoyer(saisie); } }}
          placeholder="Je vais plutôt vers…"
          enterKeyHint="send"
          aria-label="Destination que vous proposez"
          className="min-h-[44px] w-full rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]"
        />

        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((l) => (
              <button
                key={l.nom}
                type="button"
                disabled={pending}
                onClick={() => envoyer(l.nom, l.lat, l.lng)}
                className="min-h-[36px] rounded-full bg-[var(--color-field)] px-3 text-[0.6875rem] font-semibold text-[var(--color-ink)] disabled:opacity-50"
              >
                {l.nom}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={pending || saisie.trim().length < 2}
          onClick={() => envoyer(saisie)}
          className="min-h-[44px] w-full rounded-[12px] bg-[var(--color-brand-fill)] text-[0.75rem] font-bold text-white disabled:opacity-40"
        >
          {pending ? "Envoi…" : "Proposer au client"}
        </button>
      </div>
    </m.div>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
      {children}
    </section>
  );
}
