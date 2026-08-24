"use client";

import Link from "next/link";
import { AnimatePresence, m } from "framer-motion";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { cx, monogram } from "@/lib/format";
import { formatDistance, type Compatibilite } from "@/lib/taxi-match";
import { Avatar } from "@/components/ui/primitives";

/**
 * Qui peut vous prendre, et dans quel ordre s'y intéresser.
 *
 * La même information sert deux mises en page. Sur large écran, un tableau :
 * cinq colonnes se comparent d'un coup d'œil, et c'est exactement ce qu'on fait
 * quand on choisit un chauffeur — celui-ci est plus près, celui-là est plus
 * compatible. Sur téléphone, des cartes : un tableau à cinq colonnes de trois
 * cent quatre-vingts pixels de large n'est pas un tableau, c'est une bouillie.
 *
 * Ce n'est pas le même composant rendu deux fois. Les deux formes existent
 * ensemble et l'une est masquée : le contenu reste dans le document, donc
 * lisible par un lecteur d'écran et trouvable par la recherche du navigateur,
 * quel que soit l'écran.
 */

export interface LigneChauffeur {
  id: string;
  nom: string;
  telephone: string;
  vehicule: string | null;
  libre: boolean;
  /** Distance au client, en mètres. Nulle si la position n'est pas connue. */
  distance: number | null;
  /** Minutes avant qu'il se libère. Nulle : il ne l'a pas dit. */
  libreDans: number | null;
  /** Places restantes. Nulle : non renseigné — on n'affiche alors aucun chiffre. */
  placesLibres: number | null;
  prendEnRoute: boolean;
  compat: Compatibilite | null;
  positionConnue: boolean;
}

export type Filtre = "tous" | "libres" | "places";

export function DriverList({
  lignes,
  filtre,
  onFiltre,
  selection,
  onSelection,
  espaceChauffeur,
  aUneDestination,
}: {
  lignes: LigneChauffeur[];
  filtre: Filtre;
  onFiltre: (f: Filtre) => void;
  selection: string | null;
  onSelection: (id: string) => void;
  /** Vrai si la personne conduit un taxi : elle a droit à son propre espace. */
  espaceChauffeur: boolean;
  aUneDestination: boolean;
}) {
  const { t } = useI18n();

  const libres = lignes.filter((l) => l.libre).length;
  const placesEnRoute = lignes
    .filter((l) => !l.libre && l.prendEnRoute)
    .reduce((total, l) => total + (l.placesLibres ?? 0), 0);

  const visibles = lignes.filter((ligne) => {
    if (filtre === "libres") return ligne.libre;
    if (filtre === "places") return !ligne.libre && ligne.prendEnRoute;
    return true;
  });

  return (
    <section className="flex flex-col gap-3 rounded-[20px] bg-[var(--color-surface-solid)] p-3 shadow-[0_6px_18px_rgba(60,40,90,0.07)] lg:p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[0.8125rem] font-bold text-[var(--color-ink)]">{t.taxi.nearby}</h2>
          <p className="mt-[2px] text-[0.59375rem] text-[var(--color-muted)]">
            {format(t.taxi.nearbyCount, {
              libres,
              places: placesEnRoute,
              total: lignes.length,
            })}
          </p>
        </div>

        {/* Le point qui bat : la liste se relit toute seule, personne n'a à
            rafraîchir la page. */}
        <span className="flex flex-none items-center gap-[6px] rounded-full bg-[var(--color-field)] px-[10px] py-[5px] text-[0.5625rem] font-bold text-[var(--color-muted)]">
          <m.span
            aria-hidden
            className="h-[6px] w-[6px] rounded-full bg-[var(--color-ok,#2f7d5d)]"
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          {t.taxi.realtime}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          « Vue chauffeur » n'apparaît que pour un chauffeur.

          Ce n'est pas un filtre de la liste mais l'accès à son propre espace —
          disponibilité, partage de position. L'afficher à tout le monde
          promettrait une vue que personne d'autre ne peut ouvrir.
        */}
        {espaceChauffeur && (
          <div className="flex items-center gap-[4px] rounded-full bg-[var(--color-field)] p-[3px]">
            <span className="rounded-full bg-[var(--color-surface-solid)] px-[11px] py-[6px] text-[0.59375rem] font-bold text-[var(--color-ink)] shadow-[0_1px_3px_rgba(60,40,90,0.1)]">
              {t.taxi.viewClient}
            </span>
            <Link
              href="/taxi/chauffeur"
              className="press rounded-full px-[11px] py-[6px] text-[0.59375rem] font-semibold text-[var(--color-muted)]"
            >
              {t.taxi.viewDriver}
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-[6px]">
          {(
            [
              ["tous", t.taxi.filterAll],
              ["libres", t.taxi.filterFree],
              ["places", t.taxi.filterSeats],
            ] as const
          ).map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              onClick={() => onFiltre(valeur)}
              aria-pressed={filtre === valeur}
              className={cx(
                "press rounded-full px-[13px] py-[7px] text-[0.59375rem] font-bold transition-colors",
                filtre === valeur
                  ? "bg-[var(--color-ink)] text-[var(--color-app)]"
                  : "bg-[var(--color-field)] text-[var(--color-muted)]",
              )}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-[14px] bg-[var(--color-field)] px-3 py-4 text-center text-[0.65625rem] text-[var(--color-muted)]">
          {t.taxi.noCompatible}
        </p>
      ) : (
        <>
          {/* ── Large écran : un tableau ─────────────────────────────── */}
          <div className="no-sb hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
                  <th className="px-2 pb-2 text-start font-bold">{t.taxi.colDriver}</th>
                  <th className="px-2 pb-2 text-start font-bold">{t.taxi.colVehicle}</th>
                  <th className="px-2 pb-2 text-start font-bold">{t.taxi.colState}</th>
                  <th className="px-2 pb-2 text-start font-bold">{t.taxi.colMatch}</th>
                  <th className="px-2 pb-2 text-end font-bold">{t.taxi.colAction}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {visibles.map((ligne) => (
                    <m.tr
                      key={ligne.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => onSelection(ligne.id)}
                      className={cx(
                        "cursor-pointer border-t border-[var(--color-hairline)] align-middle transition-colors",
                        selection === ligne.id && "bg-[var(--color-brand-tint)]",
                      )}
                    >
                      <td className="px-2 py-[10px]">
                        <Identite ligne={ligne} />
                      </td>
                      <td className="px-2 py-[10px]">
                        <Vehicule ligne={ligne} />
                      </td>
                      <td className="px-2 py-[10px]">
                        <Etat ligne={ligne} />
                      </td>
                      <td className="px-2 py-[10px]">
                        <Compat ligne={ligne} aUneDestination={aUneDestination} />
                      </td>
                      <td className="px-2 py-[10px] text-end">
                        <Action ligne={ligne} onSelection={onSelection} />
                      </td>
                    </m.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* ── Téléphone : des cartes ───────────────────────────────── */}
          <div className="flex flex-col gap-2 lg:hidden">
            <AnimatePresence initial={false}>
              {visibles.map((ligne) => (
                <m.div
                  key={ligne.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => onSelection(ligne.id)}
                  className={cx(
                    "flex flex-col gap-[8px] rounded-[16px] border p-[11px] transition-colors",
                    selection === ligne.id
                      ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)]"
                      : "border-[var(--color-hairline)]",
                  )}
                >
                  <div className="flex items-start gap-[10px]">
                    <div className="min-w-0 flex-1">
                      <Identite ligne={ligne} />
                    </div>
                    <Action ligne={ligne} onSelection={onSelection} />
                  </div>

                  <Vehicule ligne={ligne} />
                  <Etat ligne={ligne} />
                  <Compat ligne={ligne} aUneDestination={aUneDestination} />
                </m.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </section>
  );
}

/* ─── Les cinq colonnes, partagées par les deux mises en page ──────────── */

function Identite({ ligne }: { ligne: LigneChauffeur }) {
  return (
    <div className="flex items-center gap-[9px]">
      <Avatar initials={monogram(ligne.nom)} size={28} />
      <p className="min-w-0 truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
        {ligne.nom}
      </p>
    </div>
  );
}

function Vehicule({ ligne }: { ligne: LigneChauffeur }) {
  const { t } = useI18n();

  return (
    <div className="min-w-0">
      <p className="truncate text-[0.65625rem] font-semibold text-[var(--color-ink)]">
        {ligne.vehicule || t.taxi.taxi}
      </p>
      {/*
        La distance seulement si la position est fraîche.

        « à 600 m de vous » calculé sur un relevé de la veille enverrait
        quelqu'un attendre au coin d'une rue. On préfère l'aveu.
      */}
      <p className="truncate text-[0.5625rem] text-[var(--color-muted)]">
        {ligne.distance !== null && ligne.compat
          ? format(t.taxi.awayFromYou, {
              distance: formatDistance(ligne.distance),
              min: ligne.compat.minutesJusquAVous,
            })
          : t.taxi.positionStale}
      </p>
    </div>
  );
}

function Etat({ ligne }: { ligne: LigneChauffeur }) {
  const { t } = useI18n();

  const texte = ligne.libre
    ? t.taxi.freeNowState
    : ligne.libreDans !== null
      ? format(t.taxi.busyUntil, { n: ligne.libreDans })
      : t.taxi.busyUnknown;

  return (
    <span
      className={cx(
        "flex items-center gap-[6px] rounded-[10px] px-[9px] py-[6px] text-[0.59375rem] font-semibold",
        ligne.libre
          ? "bg-[rgba(47,125,93,0.1)] text-[var(--color-ok,#2f7d5d)]"
          : "bg-[rgba(184,121,31,0.12)] text-[#8a5a12]",
      )}
    >
      <span
        aria-hidden
        className="h-[5px] w-[5px] flex-none rounded-full"
        style={{ background: "currentColor" }}
      />
      <span className="truncate">{texte}</span>
    </span>
  );
}

function Compat({
  ligne,
  aUneDestination,
}: {
  ligne: LigneChauffeur;
  aUneDestination: boolean;
}) {
  const { t } = useI18n();

  const raison = ligne.compat
    ? ligne.compat.raison === "vient-vous-chercher"
      ? t.taxi.comesForYou
      : ligne.compat.raison === "passe-sur-votre-trajet"
        ? t.taxi.onYourRoute
        : t.taxi.differentRoute
    : null;

  /*
    Trois paliers de couleur, et un quatrième cas : l'absence.

    Sans destination saisie, on ne peut rien dire d'un chauffeur en course : on
    l'écrit, plutôt que d'afficher un pourcentage qui n'aurait été calculé sur
    rien. C'est la règle de tout cet écran.
  */
  const ton = !ligne.compat
    ? "bg-[var(--color-field)] text-[var(--color-muted)]"
    : ligne.compat.score >= 80
      ? "bg-[rgba(47,125,93,0.1)] text-[var(--color-ok,#2f7d5d)]"
      : ligne.compat.score >= 50
        ? "bg-[rgba(184,121,31,0.12)] text-[#8a5a12]"
        : "bg-[rgba(150,60,60,0.1)] text-[#8a3030]";

  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <span className={cx("truncate rounded-[10px] px-[9px] py-[5px] text-[0.5625rem] font-bold", ton)}>
        {ligne.compat
          ? `${format(t.taxi.matchPercent, { n: ligne.compat.score })} · ${raison}`
          : aUneDestination
            ? t.taxi.matchUnknown
            : t.taxi.needDestination}
      </span>

      <span className="truncate text-[0.53125rem] text-[var(--color-muted)]">
        {ligne.placesLibres !== null
          ? [
              format(t.taxi.seatsFree, { n: ligne.placesLibres }),
              ligne.prendEnRoute ? t.taxi.takesAlong : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : t.taxi.noSeatsInfo}
      </span>
    </div>
  );
}

/**
 * Une action par situation, et jamais deux.
 *
 * Libre : on lui parle. En course mais compatible : on le suit, en sachant dans
 * combien de minutes il arrive. Ni l'un ni l'autre : on réserve pour plus tard.
 * Proposer « Discuter » à un chauffeur qui roule dans l'autre sens ferait perdre
 * du temps aux deux.
 */
function Action({
  ligne,
  onSelection,
}: {
  ligne: LigneChauffeur;
  onSelection: (id: string) => void;
}) {
  const { t } = useI18n();

  const compatible = ligne.compat !== null && ligne.compat.score >= 50;

  if (ligne.libre) {
    return (
      <button
        type="button"
        onClick={() => onSelection(ligne.id)}
        className="press flex-none rounded-full bg-[var(--color-ink)] px-[13px] py-[7px] text-[0.59375rem] font-bold text-[var(--color-app)]"
      >
        {t.taxi.discuss}
      </button>
    );
  }

  if (compatible) {
    return (
      <button
        type="button"
        onClick={() => onSelection(ligne.id)}
        className="press flex-none rounded-full border border-[var(--color-ink)] px-[13px] py-[7px] text-[0.59375rem] font-bold text-[var(--color-ink)]"
      >
        {ligne.compat && ligne.libreDans !== null
          ? format(t.taxi.follow, { n: ligne.libreDans })
          : format(t.taxi.follow, { n: ligne.compat?.minutesJusquAVous ?? 0 })}
      </button>
    );
  }

  return (
    <a
      href={`tel:${ligne.telephone}`}
      onClick={(event) => event.stopPropagation()}
      className="press flex-none rounded-full border border-[var(--color-outline)] px-[13px] py-[7px] text-[0.59375rem] font-semibold text-[var(--color-muted)]"
    >
      {t.taxi.bookAfter}
    </a>
  );
}
