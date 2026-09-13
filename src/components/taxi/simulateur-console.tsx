"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  accepterPourSimule,
  creerFlotte,
  deplacerSimule,
  etatSimule,
  listerFlotte,
  perdreGpsSimule,
  supprimerFlotte,
  type ChauffeurSimule,
  type StatutSimule,
} from "@/app/actions/taxi-simulateur";
import { usePoll } from "@/lib/use-poll";
import { TAXI_ZONES } from "@/lib/taxi-zones";
import type { DriverPin, MapLabels } from "./driver-map";

const DriverMap = dynamic(() => import("./driver-map").then((m) => m.DriverMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--color-track)]" />,
});

/* ═══════════════════════════════════════════════════════════════════════
   Le poste de pilotage de la flotte fictive.

   Ce que cet écran permet, et qu'aucun autre ne permettait : voir le système
   réagir. Jusqu'ici, éprouver une course demandait deux téléphones, deux
   comptes et deux personnes — et les cas qui cassent vraiment (deux
   chauffeurs qui acceptent dans la même seconde, un GPS qui lâche, quelqu'un
   qui se met hors ligne pendant qu'on le cherche) ne s'obtiennent pas à la
   main.

   Les chauffeurs pilotés ici sont de vrais enregistrements. Ils traversent
   les mêmes policies, alimentent le même matching, apparaissent sur la même
   carte. La seule chose de fictive est qu'il n'y a personne au volant.
   ═══════════════════════════════════════════════════════════════════════ */

const ETIQUETTES: MapLabels = {
  free: "Libre",
  busy: "Occupé",
  call: "Appeler",
  whatsApp: "WhatsApp",
};

const ETATS: ReadonlyArray<{ cle: StatutSimule; libelle: string; puce: string }> = [
  { cle: "libre", libelle: "Libre", puce: "🟢" },
  { cle: "places", libelle: "Places", puce: "🟠" },
  { cle: "occupe", libelle: "Occupé", puce: "⚪" },
  { cle: "hors_ligne", libelle: "Hors ligne", puce: "⚫" },
];

/** Un pas de déplacement automatique : ~35 m, la longueur d'une rue. */
const PAS_DEGRES = 0.00032;

export function SimulateurConsole() {
  const [flotte, setFlotte] = useState<ChauffeurSimule[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [journal, setJournal] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [roulent, setRoulent] = useState(false);
  const [demandeId, setDemandeId] = useState("");

  /** Le cap de chaque voiture, tiré une fois puis conservé. */
  const caps = useRef(new Map<string, number>());

  const noter = useCallback((ligne: string) => {
    const heure = new Date().toLocaleTimeString("fr-FR", { hour12: false });
    setJournal((j) => [`${heure} · ${ligne}`, ...j].slice(0, 40));
  }, []);

  const relire = useCallback(async () => {
    const r = await listerFlotte();
    setCharge(true);
    if (!r.ok) {
      setErreur(r.error);
      return false;
    }
    setErreur(null);
    setFlotte(r.data);
  }, []);

  useEffect(() => { void relire(); }, [relire]);
  usePoll(relire, 8_000);

  /* ─── Le déplacement automatique ─────────────────────────────────────
     Une écriture par voiture toutes les cinq secondes, et seulement quand
     l'interrupteur est mis. Le simulateur ne doit pas être un robinet ouvert
     sur le quota : c'est exactement la panne qu'on cherche à ne pas revivre. */
  useEffect(() => {
    if (!roulent) return;

    const mobiles = flotte.filter((c) => c.statut === "libre" || c.statut === "places");
    if (mobiles.length === 0) return;

    const minuteur = window.setInterval(() => {
      for (const c of mobiles) {
        if (c.lat === null || c.lng === null) continue;

        /*
          Une marche aléatoire qui garde son cap.

          Tirer une direction neuve à chaque pas produirait un tremblement sur
          place, jamais un trajet. Le cap ne dévie que de quelques degrés par
          pas : la voiture suit une courbe, et l'interpolation de la carte a
          quelque chose à lisser.
        */
        const precedent = caps.current.get(c.id) ?? Math.random() * 360;
        const cap = (precedent + (Math.random() - 0.5) * 40 + 360) % 360;
        caps.current.set(c.id, cap);

        const rad = (cap * Math.PI) / 180;
        const lat = c.lat + Math.cos(rad) * PAS_DEGRES;
        const lng = c.lng + Math.sin(rad) * PAS_DEGRES * 1.21; // cos(34.4°) ≈ 0.825

        void deplacerSimule({ id: c.id, lat, lng });
      }
    }, 5_000);

    return () => window.clearInterval(minuteur);
  }, [roulent, flotte]);

  /* ─── Les gestes ─────────────────────────────────────────────────────── */

  function agir(nom: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setErreur(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setErreur(r.error ?? "Échec");
        noter(`✗ ${nom} — ${r.error ?? "échec"}`);
        return;
      }
      noter(`✓ ${nom}`);
      await relire();
    });
  }

  /**
   * Les deux premiers libres acceptent la même demande, en parallèle.
   *
   * `Promise.all` et non deux `await` successifs : c'est toute la différence.
   * En série, le second verrait un état déjà écrit et le test ne prouverait
   * rien. En parallèle, les deux mises à jour conditionnelles partent
   * ensemble, et c'est Postgres qui départage — ce qu'on veut vérifier.
   */
  function courseConcurrente() {
    const libres = flotte.filter((c) => c.statut === "libre").slice(0, 2);
    if (libres.length < 2) {
      setErreur("Il faut deux chauffeurs libres. Réinitialisez la flotte.");
      return;
    }
    if (!demandeId.trim()) {
      setErreur("Collez l'identifiant d'une demande en attente.");
      return;
    }

    setErreur(null);
    startTransition(async () => {
      const id = demandeId.trim();
      const [a, b] = await Promise.all([
        accepterPourSimule({ id: libres[0].id, demandeId: id }),
        accepterPourSimule({ id: libres[1].id, demandeId: id }),
      ]);

      const gagnants = [a.ok, b.ok].filter(Boolean).length;

      noter(
        gagnants === 1
          ? `✓ Concurrence : un seul gagnant sur deux — ${libres[0].nom} ${a.ok ? "gagne" : "perd"}, ${libres[1].nom} ${b.ok ? "gagne" : "perd"}`
          : `✗ Concurrence : ${gagnants} gagnant(s) — l'unicité du matching est en défaut`,
      );

      if (gagnants !== 1) setErreur(`${gagnants} acceptations ont abouti au lieu d'une.`);
      await relire();
    });
  }

  const pins: DriverPin[] = flotte
    .filter((c) => c.lat !== null && c.lng !== null && c.statut !== "hors_ligne")
    .map((c) => ({
      id: c.id,
      name: c.nom,
      lat: c.lat!,
      lng: c.lng!,
      available: c.statut === "libre" || c.statut === "places",
      etat: c.statut === "hors_ligne" ? "occupe" : c.statut,
      detail: c.vehicule,
      phone: c.telephone,
      initials: c.nom.replace(/[^0-9]/g, "") || "SIM",
      caption: ETATS.find((e) => e.cle === c.statut)?.libelle ?? null,
    }));

  return (
    <div className="flex flex-col gap-3">
      <Bandeau />

      {erreur && (
        <p role="alert" className="rounded-[12px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.8125rem] font-medium text-[var(--color-live)]">
          {erreur}
        </p>
      )}

      {/* ─── Commandes de flotte ─────────────────────────────────────── */}
      <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
        <h2 className="mb-3 text-[0.9375rem] font-bold text-[var(--color-ink)]">Flotte</h2>

        <div className="flex flex-wrap gap-2">
          <Bouton principal disabled={pending} onClick={() => agir("Flotte créée / réinitialisée", creerFlotte)}>
            Créer / réinitialiser
          </Bouton>
          <Bouton disabled={pending} onClick={() => agir("Flotte supprimée", supprimerFlotte)}>
            Tout supprimer
          </Bouton>
          <Bouton
            disabled={pending || flotte.length === 0}
            onClick={() => {
              setRoulent((v) => !v);
              noter(roulent ? "Déplacement automatique arrêté" : "Déplacement automatique démarré");
            }}
          >
            {roulent ? "⏸ Arrêter le mouvement" : "▶ Faire rouler"}
          </Bouton>
        </div>

        {roulent && (
          <p className="mt-2 text-[0.6875rem] text-[var(--color-muted)]">
            Une écriture par voiture toutes les 5 s. Pensez à arrêter en quittant l&apos;écran.
          </p>
        )}
      </section>

      {/* ─── Carte ───────────────────────────────────────────────────── */}
      {pins.length > 0 && (
        <div className="h-[280px] overflow-hidden rounded-[18px]">
          <DriverMap drivers={pins} labels={ETIQUETTES} />
        </div>
      )}

      {/* ─── Scénarios ───────────────────────────────────────────────── */}
      <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
        <h2 className="mb-1 text-[0.9375rem] font-bold text-[var(--color-ink)]">Scénarios</h2>
        <p className="mb-3 text-[0.75rem] text-[var(--color-muted)]">
          Lancez une recherche depuis <code>/taxi</code> avec un autre compte, puis collez
          l&apos;identifiant de la demande ici.
        </p>

        <input
          value={demandeId}
          onChange={(e) => setDemandeId(e.target.value)}
          placeholder="Identifiant de la demande (uuid)"
          className="mb-3 min-h-[44px] w-full rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 font-mono text-[0.75rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]"
        />

        <div className="flex flex-wrap gap-2">
          <Bouton disabled={pending} onClick={courseConcurrente}>
            ⚔ Deux acceptations simultanées
          </Bouton>
          <Bouton
            disabled={pending || flotte.length === 0}
            onClick={() => {
              const cible = flotte.find((c) => c.statut === "libre");
              if (!cible) { setErreur("Aucun chauffeur libre."); return; }
              agir(`GPS perdu — ${cible.nom}`, () => perdreGpsSimule(cible.id));
            }}
          >
            📡 Perte de GPS
          </Bouton>
          <Bouton
            disabled={pending || flotte.length === 0}
            onClick={() => {
              const cible = flotte.find((c) => c.statut === "libre");
              if (!cible) { setErreur("Aucun chauffeur libre."); return; }
              agir(`Hors ligne — ${cible.nom}`, () =>
                etatSimule({ id: cible.id, statut: "hors_ligne" }),
              );
            }}
          >
            ⚫ Passage hors ligne
          </Bouton>
        </div>
      </section>

      {/* ─── Chauffeurs ──────────────────────────────────────────────── */}
      <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
        <h2 className="mb-3 text-[0.9375rem] font-bold text-[var(--color-ink)]">
          Chauffeurs {charge && <span className="font-normal text-[var(--color-muted)]">· {flotte.length}</span>}
        </h2>

        {!charge ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-[14px] bg-[var(--color-field)]" />
            ))}
          </div>
        ) : flotte.length === 0 ? (
          <p className="py-4 text-center text-[0.8125rem] text-[var(--color-muted)]">
            Aucun chauffeur simulé. Touchez « Créer / réinitialiser ».
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {flotte.map((c) => (
              <Fiche
                key={c.id}
                chauffeur={c}
                occupe={pending}
                onEtat={(statut) =>
                  agir(`${c.nom} → ${statut}`, () => etatSimule({ id: c.id, statut }))
                }
                onZone={(lat, lng) =>
                  agir(`${c.nom} déplacé`, () => deplacerSimule({ id: c.id, lat, lng }))
                }
                onGps={() => agir(`GPS perdu — ${c.nom}`, () => perdreGpsSimule(c.id))}
                onAccepter={() => {
                  if (!demandeId.trim()) { setErreur("Collez d'abord un identifiant de demande."); return; }
                  agir(`${c.nom} accepte`, () =>
                    accepterPourSimule({ id: c.id, demandeId: demandeId.trim() }),
                  );
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Journal ─────────────────────────────────────────────────── */}
      {journal.length > 0 && (
        <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
          <h2 className="mb-2 text-[0.9375rem] font-bold text-[var(--color-ink)]">Journal</h2>
          <ol className="flex flex-col gap-1 font-mono text-[0.6875rem] text-[var(--color-soft,var(--color-muted))]">
            {journal.map((l, i) => (
              <li key={i} className={l.startsWith(l.slice(0, 9) + " · ✗") ? "text-[var(--color-live)]" : undefined}>
                {l}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/* ─── Pièces ──────────────────────────────────────────────────────────── */

function Bandeau() {
  return (
    <p className="rounded-[14px] border border-[var(--color-brand)] bg-[var(--color-brand-tint)] px-4 py-3 text-[0.8125rem] text-[var(--color-ink)]">
      <strong>Ces chauffeurs sont réels en base.</strong> Ils traversent les mêmes policies et le
      même matching que de vrais comptes — c&apos;est ce qui rend le test concluant. Ils portent
      le domaine réservé <code>@simulation.mall-express.test</code> et se suppriment d&apos;ici,
      ou par <code>db:clean-tests</code>.
    </p>
  );
}

function Fiche({
  chauffeur,
  occupe,
  onEtat,
  onZone,
  onGps,
  onAccepter,
}: {
  chauffeur: ChauffeurSimule;
  occupe: boolean;
  onEtat: (s: StatutSimule) => void;
  onZone: (lat: number, lng: number) => void;
  onGps: () => void;
  onAccepter: () => void;
}) {
  const c = chauffeur;

  return (
    <article className="rounded-[14px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.875rem] font-bold text-[var(--color-ink)]">{c.nom}</p>
        <p className="font-mono text-[0.6875rem] text-[var(--color-muted)]">
          {c.lat !== null && c.lng !== null
            ? `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`
            : "position inconnue"}
        </p>
      </div>

      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[0.6875rem] text-[var(--color-muted)]">
        <span>💺 {c.placesLibres ?? "—"}/{c.placesTotal ?? "—"}</span>
        <span>{c.zoneDepart ?? "—"} → {c.zoneArrivee ?? "libre"}</span>
        {c.accepteLibre && <span>accepte hors zone</span>}
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {ETATS.map((e) => (
          <button
            key={e.cle}
            type="button"
            disabled={occupe}
            onClick={() => onEtat(e.cle)}
            aria-pressed={c.statut === e.cle}
            className={`min-h-[36px] rounded-full px-3 text-[0.6875rem] font-semibold disabled:opacity-50 ${
              c.statut === e.cle
                ? "bg-[var(--color-brand-fill)] text-white"
                : "bg-[var(--color-field)] text-[var(--color-ink)]"
            }`}
          >
            {e.puce} {e.libelle}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {/* Téléporter dans une zone : le plus rapide pour éprouver le rayon. */}
        {TAXI_ZONES.slice(0, 4).map((z) => (
          <button
            key={z.id}
            type="button"
            disabled={occupe}
            onClick={() => onZone(z.lat, z.lng)}
            className="min-h-[36px] rounded-full bg-[var(--color-field)] px-3 text-[0.625rem] font-semibold text-[var(--color-ink)] disabled:opacity-50"
          >
            → {z.fr}
          </button>
        ))}
        <button
          type="button"
          disabled={occupe}
          onClick={onGps}
          className="min-h-[36px] rounded-full bg-[var(--color-field)] px-3 text-[0.625rem] font-semibold text-[var(--color-ink)] disabled:opacity-50"
        >
          📡 perdre GPS
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={onAccepter}
          className="min-h-[36px] rounded-full bg-[var(--color-brand-tint)] px-3 text-[0.625rem] font-bold text-[var(--color-brand)] disabled:opacity-50"
        >
          ✓ accepter la demande
        </button>
      </div>
    </article>
  );
}

function Bouton({
  children,
  onClick,
  disabled,
  principal,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  principal?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] rounded-[12px] px-4 text-[0.8125rem] font-semibold transition-transform active:scale-[0.97] disabled:opacity-40 ${
        principal
          ? "bg-[var(--color-brand-fill)] font-bold text-white"
          : "bg-[var(--color-field)] text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}
