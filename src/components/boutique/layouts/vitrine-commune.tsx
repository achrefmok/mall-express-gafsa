"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { formatPrice } from "@/lib/format";
import {
  optionsPresentes,
  produitCorrespond,
  type ConfigVitrine,
  type OptionFiltre,
} from "@/lib/boutique-vitrines";
import type { AppLocale } from "@/types/database";
import { Presentoir360, type PieceDuPresentoir } from "../presentoir/presentoir-360";
import { FiltreMetierPuces } from "../filtre-metier";
import type { ProduitBoutique } from "./types";

/** Au-delà, le cercle devient illisible sur un téléphone : 10 pièces au plus. */
const PIECES_MAX = 10;

/** Couleurs d'état communes du handoff : succès #23864f, alerte oklch(.52 .17 15). */
export const COULEUR_OK = "#23864f";
export const COULEUR_ALERTE = "oklch(.52 .17 15)";
/** Badge « تخفيض » du handoff, le même dans tous les métiers. */
export const COULEUR_PROMO = "oklch(.5 .18 10)";
/** Atténuation du catalogue hors filtre (le présentoir, lui, descend à .25). */
export const OPACITE_HORS_FILTRE = 0.38;

/**
 * L'état partagé par toutes les vitrines par métier : option du filtre,
 * pièce de face, produit ouvert dans la feuille.
 */
export function useVitrine(produits: ProduitBoutique[], vitrine: ConfigVitrine) {
  const [actif, setActif] = useState<string | null>(null);
  const [faceId, setFaceId] = useState<string | null>(null);
  const [ouvertId, setOuvertId] = useState<string | null>(null);

  const options = useMemo(() => optionsPresentes(produits, vitrine.filtre), [produits, vitrine.filtre]);
  // Une option qui n'existe plus (changement de genre en Mode…) ne filtre plus rien.
  const optionActive = actif && options.some((o) => o.cle === actif) ? actif : null;

  const correspond = useCallback(
    (p: ProduitBoutique) => produitCorrespond(p, vitrine.filtre, optionActive),
    [vitrine.filtre, optionActive],
  );

  const fermer = useCallback(() => setOuvertId(null), []);

  return {
    options,
    actif: optionActive,
    setActif,
    correspond,
    optionChoisie: options.find((o) => o.cle === optionActive) ?? null,
    face: produits.find((p) => p.id === faceId) ?? produits[0] ?? null,
    setFaceId,
    ouvert: produits.find((p) => p.id === ouvertId) ?? null,
    ouvrir: setOuvertId,
    fermer,
  };
}

/** Les pièces du présentoir, à partir des produits réels. */
export function piecesDuPresentoir(
  produits: ProduitBoutique[],
  correspond: (p: ProduitBoutique) => boolean,
  locale: AppLocale,
  motCourt: (p: ProduitBoutique) => string = (p) => p.name.split(/[\s—–-]+/)[0] || p.name,
): PieceDuPresentoir[] {
  return produits.slice(0, PIECES_MAX).map((p) => ({
    id: p.id,
    nom: p.name,
    motCourt: motCourt(p),
    prix: formatPrice(p.price, locale),
    image: p.images[0] ?? null,
    couleurs: p.colors ?? [],
    correspond: correspond(p),
  }));
}

/** Texte de shop pour le mur du présentoir : le nom en capitales latines s'il en a. */
export function texteDuMur(nomBoutique: string): string {
  if (!/[a-z]/i.test(nomBoutique)) return "G-MALL · GAFSA";
  const nom = nomBoutique.toUpperCase();
  return /MALL|GAFSA/.test(nom) ? nom : `${nom} · MALL GAFSA`;
}

/**
 * Le haut de chaque vitrine : présentoir 360°, plaque « في الواجهة الآن »
 * (ou ce que le métier met à sa place — les rayons pour Mode), puis le
 * filtre du métier. Moins de 3 produits : pas de présentoir (un cercle de
 * deux cartes n'a rien d'un présentoir), le filtre reste.
 */
export function HautDeVitrine({
  vitrine,
  produits,
  etat,
  nomBoutique,
  locale,
  sousPresentoir,
  noteDe,
  libelleCompatible,
}: {
  vitrine: ConfigVitrine;
  produits: ProduitBoutique[];
  etat: ReturnType<typeof useVitrine>;
  nomBoutique: string;
  locale: AppLocale;
  /** Remplace la plaque (Mode : la carte des rayons). */
  sousPresentoir?: (avecPresentoir: boolean) => ReactNode;
  /** La petite ligne de la plaque sans filtre actif (stockage, contenance…). */
  noteDe?: (p: ProduitBoutique) => string | null;
  /** Moto : « متوافق مع » plutôt que « يناسب ». */
  libelleCompatible?: { oui: (o: OptionFiltre) => string; non: (o: OptionFiltre) => string };
}) {
  const pieces = piecesDuPresentoir(produits, etat.correspond, locale);
  const face = etat.face;

  let ligneFace: { texte: string; couleur: string } | null = null;
  if (face && etat.optionChoisie) {
    const o = etat.optionChoisie;
    const ok = etat.correspond(face);
    const nom = locale === "ar" ? o.ar : o.fr;
    ligneFace = libelleCompatible
      ? { texte: ok ? libelleCompatible.oui(o) : libelleCompatible.non(o), couleur: ok ? COULEUR_OK : COULEUR_ALERTE }
      : {
          texte: ok
            ? `${locale === "ar" ? "يناسب" : "Convient"} : ${nom} ✓`
            : `${locale === "ar" ? "لا يناسب" : "Ne convient pas"} : ${nom}`,
          couleur: ok ? COULEUR_OK : COULEUR_ALERTE,
        };
  } else if (face) {
    const note = noteDe?.(face);
    if (note) ligneFace = { texte: note, couleur: "var(--theme-muted)" };
  }

  return (
    <>
      {pieces.length >= 3 && (
        <div className="-mx-4 flex flex-col">
          <Presentoir360
            pieces={pieces}
            scene={vitrine.scene}
            texteMur={texteDuMur(nomBoutique)}
            locale={locale}
            onOuvrir={etat.ouvrir}
            onFace={etat.setFaceId}
          />
          {sousPresentoir?.(true) ??
            (face && (
              <div className="relative z-[2] mx-[14px] -mt-[6px] flex items-center gap-[10px] rounded-[16px] bg-[var(--theme-surface,#fff)] px-3 py-[10px] shadow-[0_8px_20px_rgba(60,40,90,0.08)]">
                <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
                  <span className="text-[0.6875rem] text-[var(--theme-muted)]">
                    {locale === "ar" ? "في الواجهة الآن" : "En vitrine maintenant"}
                  </span>
                  <span className="truncate text-[0.9375rem] font-extrabold">{face.name}</span>
                  {ligneFace && (
                    <span className="truncate text-[0.75rem] font-bold" style={{ color: ligneFace.couleur }}>
                      {ligneFace.texte}
                    </span>
                  )}
                </div>
                <div className="flex flex-none flex-col items-end leading-[1.2]">
                  <span className="text-[0.9375rem] font-black whitespace-nowrap text-[var(--theme-accent-fort)]">
                    {formatPrice(face.price, locale)}
                  </span>
                  {face.compare_at_price && face.compare_at_price > face.price && (
                    <span className="text-[0.625rem] whitespace-nowrap text-[var(--theme-muted)]">
                      {locale === "ar" ? "بدلا من" : "au lieu de"} {formatPrice(face.compare_at_price, locale)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => etat.ouvrir(face.id)}
                  className="min-h-[42px] flex-none rounded-[12px] bg-[var(--theme-accent)] px-[14px] text-[0.8125rem] font-extrabold text-[var(--theme-accent-texte)]"
                >
                  {locale === "ar" ? "عرض" : "Voir"}
                </button>
              </div>
            ))}
        </div>
      )}

      {pieces.length < 3 && sousPresentoir?.(false)}

      <FiltreMetierPuces
        filtre={vitrine.filtre}
        options={etat.options}
        actif={etat.actif}
        onChange={etat.setActif}
        locale={locale}
      />
    </>
  );
}
