"use client";

import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { cx } from "@/lib/format";
import { distanceMeters } from "@/lib/geo";
import { dureeMinutes, formatDistance, LIEUX_GAFSA, type Lieu, type Point } from "@/lib/taxi-match";

export type Champ = "depart" | "destination";
export type LieuChoisi = Point & { nom: string };

/**
 * Le trajet demandé : d'où l'on part, où l'on va, et ce que cela représente.
 *
 * C'est le panneau qui donne un sens à tout le reste de l'écran. Sans
 * destination, la liste des chauffeurs n'est qu'un annuaire trié par distance ;
 * avec elle, on peut dire lequel passe devant votre porte — et c'est la seule
 * chose que le client cherche vraiment à savoir.
 *
 * **Deux façons d'indiquer un lieu, et la même pour les deux bouts.** On écrit
 * son nom, et la liste se réduit à mesure ; ou l'on touche la carte, ce qui est
 * plus rapide et plus précis pour un endroit qui n'a pas de nom sur une liste.
 * Le champ qu'on vient de toucher devient celui que la carte renseigne : sans
 * cela, un client qui veut corriger son départ se voit changer sa destination.
 *
 * **Aucun prix n'est affiché**, et c'est une décision. La course se négocie de
 * vive voix à Gafsa ; annoncer un montant que le chauffeur n'a pas accepté
 * ferait de la plateforme l'arbitre d'un accord auquel elle n'a pas part.
 */
export function TripPanel({
  depart,
  departNom,
  destination,
  etatPosition,
  champActif,
  onChampActif,
  onLieu,
  onRelocaliser,
}: {
  depart: Point | null;
  /** Nom donné au départ quand il ne vient pas du GPS. */
  departNom: string | null;
  destination: LieuChoisi | null;
  etatPosition: "attente" | "trouvee" | "refusee";
  champActif: Champ;
  onChampActif: (champ: Champ) => void;
  onLieu: (champ: Champ, lieu: LieuChoisi | null) => void;
  onRelocaliser: () => void;
}) {
  const { t, locale } = useI18n();

  const metres = depart && destination ? distanceMeters(depart, destination) : null;
  const nomLieu = (lieu: Lieu) => (locale === "ar" ? lieu.nomAr : lieu.nom);

  return (
    <div className="flex flex-col gap-[10px] rounded-[18px] bg-[var(--color-surface-solid)] p-3 shadow-[0_6px_18px_rgba(60,40,90,0.07)]">
      {/*
        Les deux bouts du trajet, reliés par un trait.

        La ligne verticale entre la pastille verte et la pastille violette n'est
        pas un ornement : elle dit que ces deux lignes forment un seul trajet, et
        dans quel sens il se lit. Deux champs empilés sans elle se lisent comme
        deux réglages indépendants.
      */}
      <div className="relative flex flex-col gap-2 ps-[22px]">
        <span
          aria-hidden
          className="absolute start-[5px] top-[16px] bottom-[16px] w-[2px] rounded-full bg-[var(--color-hairline)]"
        />

        <Etape
          champ="depart"
          teinte="var(--color-ok, #2f7d5d)"
          label={t.taxi.departure}
          valeur={
            departNom ??
            (etatPosition === "trouvee" && depart
              ? t.taxi.myPosition
              : etatPosition === "attente"
                ? t.taxi.locating
                : t.taxi.locationRefused)
          }
          rempli={Boolean(depart)}
          actif={champActif === "depart"}
          onActif={onChampActif}
          onLieu={onLieu}
          nomLieu={nomLieu}
          action={
            departNom
              ? { texte: t.taxi.myPosition, faire: onRelocaliser }
              : etatPosition === "refusee"
                ? { texte: t.taxi.sharePosition, faire: onRelocaliser }
                : null
          }
        />

        <Etape
          champ="destination"
          teinte="var(--color-brand-fill)"
          label={t.taxi.destination}
          valeur={destination?.nom ?? t.taxi.chooseDestination}
          rempli={Boolean(destination)}
          actif={champActif === "destination"}
          onActif={onChampActif}
          onLieu={onLieu}
          nomLieu={nomLieu}
          action={
            destination ? { texte: t.common.delete, faire: () => onLieu("destination", null) } : null
          }
        />
      </div>

      {/*
        Le résumé n'apparaît que lorsqu'il repose sur deux vraies positions.

        Afficher « 0 km · 1 min » en attendant serait un chiffre faux, et le
        client n'a aucun moyen de savoir qu'il l'est.
      */}
      {metres !== null && (
        <m.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--color-hairline)] pt-[10px]"
        >
          <span className="text-[0.65625rem] font-semibold text-[var(--color-muted)]">
            {format(t.taxi.tripSummary, {
              distance: formatDistance(metres),
              min: dureeMinutes(metres),
            })}
          </span>
          <span className="text-[0.65625rem] font-bold text-[var(--color-brand)]">
            {t.taxi.priceToAgree}
          </span>
        </m.div>
      )}
    </div>
  );
}

/**
 * Une ligne du trajet : un libellé, une valeur, et de quoi la changer.
 *
 * Au repos, elle se lit comme une phrase. Touchée, elle devient un champ de
 * saisie avec ses suggestions — c'est le même espace qui sert à lire et à
 * écrire, ce qui évite d'empiler un formulaire sous un résumé qui dit déjà la
 * même chose.
 */
function Etape({
  champ,
  teinte,
  label,
  valeur,
  rempli,
  actif,
  onActif,
  onLieu,
  nomLieu,
  action,
}: {
  champ: Champ;
  teinte: string;
  label: string;
  valeur: string;
  rempli: boolean;
  actif: boolean;
  onActif: (champ: Champ) => void;
  onLieu: (champ: Champ, lieu: LieuChoisi | null) => void;
  nomLieu: (lieu: Lieu) => string;
  action: { texte: string; faire: () => void } | null;
}) {
  const { t } = useI18n();
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);

  const normalise = (texte: string) =>
    texte
      .toLowerCase()
      .normalize("NFD")
      // Les accents partent de la comparaison : « aeroport » doit trouver
      // « Aéroport », et personne ne tape les accents sur un clavier de
      // téléphone.
      .replace(/[̀-ͯ]/g, "");

  const suggestions = LIEUX_GAFSA.filter((lieu) =>
    saisie.trim() === "" ? true : normalise(nomLieu(lieu)).includes(normalise(saisie)),
  );

  function choisir(lieu: Lieu) {
    onLieu(champ, { lat: lieu.lat, lng: lieu.lng, nom: nomLieu(lieu) });
    setSaisie("");
    setOuvert(false);
  }

  return (
    <div className="relative">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className={cx(
            "absolute start-[-22px] top-[5px] h-[11px] w-[11px] rounded-full ring-[3px] ring-[var(--color-surface-solid)] transition-transform",
            actif && "scale-125",
          )}
          style={{ background: teinte }}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-faint)] uppercase">
            {label}
          </p>

          {ouvert ? (
            <input
              autoFocus
              value={saisie}
              onChange={(event) => setSaisie(event.target.value)}
              onFocus={() => onActif(champ)}
              onBlur={() => window.setTimeout(() => setOuvert(false), 140)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && suggestions[0]) choisir(suggestions[0]);
                if (event.key === "Escape") setOuvert(false);
              }}
              placeholder={valeur}
              className="w-full bg-transparent text-[0.71875rem] font-bold text-[var(--color-ink)] outline-none placeholder:font-semibold placeholder:text-[var(--color-faint)]"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                onActif(champ);
                setOuvert(true);
              }}
              className={cx(
                "block w-full truncate text-start text-[0.71875rem] font-bold",
                rempli ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]",
              )}
            >
              {valeur}
            </button>
          )}
        </div>

        {action && !ouvert && (
          <button
            type="button"
            onClick={action.faire}
            className="press flex-none text-[0.5625rem] font-bold whitespace-nowrap text-[var(--color-brand)]"
          >
            {action.texte}
          </button>
        )}
      </div>

      {/*
        Les suggestions, et le rappel qu'on peut aussi toucher la carte.

        `onMouseDown` plutôt que `onClick` : le champ perd le focus avant que le
        clic n'aboutisse, et la liste se refermait sous le doigt sans rien
        sélectionner.
      */}
      <AnimatePresence>
        {ouvert && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-[186px] overflow-y-auto rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-surface-solid)] p-1 shadow-[0_10px_24px_rgba(60,40,90,0.14)]"
          >
            {suggestions.map((lieu) => (
              <button
                key={lieu.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  choisir(lieu);
                }}
                className="block w-full truncate rounded-[10px] px-[9px] py-[7px] text-start text-[0.65625rem] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-field)]"
              >
                {nomLieu(lieu)}
              </button>
            ))}

            <p className="px-[9px] py-[7px] text-[0.53125rem] text-[var(--color-faint)]">
              {t.taxi.tapMap}
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
