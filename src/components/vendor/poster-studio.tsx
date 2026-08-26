"use client";

import Image from "next/image";
import { AnimatePresence, LazyMotion, m } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format as gabarit } from "@/lib/i18n/format";
import { cx, formatPrice } from "@/lib/format";
import { Card } from "@/components/ui/primitives";
import {
  FORMATS,
  PRODUITS_MAX,
  THEMES,
  nomFichier,
  type CleFormat,
  type CleTheme,
} from "@/lib/poster";
import {
  chargerImages,
  dessinerAffiche,
  versBlob,
  type ProduitAffiche,
} from "@/lib/poster-render";

const chargerAnimations = () => import("framer-motion").then((mod) => mod.domAnimation);

/**
 * L'atelier d'affiche.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que cet écran remplace
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une boutique de Gafsa qui veut annoncer ses prix sur Facebook photographie
 * son article, l'ouvre dans une application de retouche, écrit le prix à la
 * main, et publie quelque chose qui ressemble à ce qu'on fait avec le pouce sur
 * un écran de six pouces. Le résultat dessert le produit qu'il montre.
 *
 * Tout ce qu'il faut est pourtant déjà dans l'application : les photos, les
 * noms, les prix, les remises, le numéro de téléphone. Il ne manquait qu'une
 * mise en page — et une mise en page est précisément ce qu'un ordinateur fait
 * mieux qu'une main pressée.
 *
 * ────────────────────────────────────────────────────────────────────────
 * L'aperçu est le fichier
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le canvas est dessiné à la taille réelle de l'export — 1080 × 1920 pour une
 * story — et seulement réduit par le CSS pour l'aperçu. Ce qu'on voit est donc
 * exactement ce qui sera téléchargé, aux pixels près. Un aperçu approximatif
 * suivi d'un export différent est la manière la plus sûre de faire publier une
 * affiche fautive.
 */

export interface ProduitBoutique {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  images: string[];
}

const FORMAT_ORDRE: CleFormat[] = ["story", "carre", "paysage"];
const THEME_ORDRE: CleTheme[] = ["nuit", "sable", "eclat", "souk"];

export function PosterStudio({
  boutique,
  telephone,
  produits,
}: {
  boutique: string;
  telephone: string | null;
  produits: ProduitBoutique[];
}) {
  const { t, locale } = useI18n();

  const [choisis, setChoisis] = useState<string[]>(() => produits.slice(0, 3).map((p) => p.id));
  const [formatChoisi, setFormatChoisi] = useState<CleFormat>("carre");
  const [themeChoisi, setThemeChoisi] = useState<CleTheme>("nuit");
  const [accroche, setAccroche] = useState("");
  const [compose, setCompose] = useState(false);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* Les photos décodées, gardées d'un rendu à l'autre : rebasculer de « carré »
     à « story » ne doit pas retélécharger ce qu'on a déjà. */
  const imagesRef = useRef<Map<string, CanvasImageSource>>(new Map());

  const selection: ProduitAffiche[] = useMemo(
    () =>
      choisis
        .map((id) => produits.find((p) => p.id === id))
        .filter((p): p is ProduitBoutique => Boolean(p))
        .map((p) => ({
          id: p.id,
          nom: p.name,
          prix: Number(p.price),
          comparaison: p.compare_at_price === null ? null : Number(p.compare_at_price),
          image: p.images[0] ?? null,
        })),
    [choisis, produits],
  );

  /*
    Le rendu, relancé à chaque changement.

    `annule` protège d'une course : changer deux fois de format en une seconde
    lance deux chargements, et le plus lent ne doit pas repeindre par-dessus le
    plus récent. Sans ce garde-fou, l'aperçu affiche parfois le format
    précédent, et le fichier téléchargé aussi.
  */
  const composer = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || selection.length === 0) return;

    setCompose(true);

    const manquantes = selection.filter((p) => p.image && !imagesRef.current.has(p.id));
    if (manquantes.length > 0) {
      const nouvelles = await chargerImages(manquantes);
      for (const [id, image] of nouvelles) imagesRef.current.set(id, image);
    }

    /*
      Attendre les polices avant de mesurer.

      `measureText` sur une police pas encore chargée renvoie les métriques de
      la police de repli : les textes sont ajustés pour la mauvaise, puis
      redessinés trop grands ou trop petits. Une seule attente, au premier
      rendu, suffit à écarter le problème.
    */
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
      } catch {
        // Une police indisponible n'empêche pas de dessiner.
      }
    }

    dessinerAffiche(canvas, {
      format: formatChoisi,
      theme: themeChoisi,
      boutique,
      telephone,
      accroche,
      produits: selection,
      locale,
      images: imagesRef.current,
    });

    const sansPhoto = selection.filter((p) => !imagesRef.current.has(p.id)).length;
    setAvertissement(
      sansPhoto > 0 ? gabarit(t.vendor.posterMissingPhotos, { n: sansPhoto }) : null,
    );

    setCompose(false);
  }, [selection, formatChoisi, themeChoisi, accroche, boutique, telephone, locale, t]);

  /*
    Un souffle avant de redessiner.

    La phrase d'accroche se tape lettre par lettre ; repeindre une affiche de
    deux millions de pixels à chaque frappe fait tressauter le clavier sur un
    téléphone d'entrée de gamme. Cent soixante millisecondes est le délai au bout
    duquel on cesse de taper sans s'en rendre compte.
  */
  useEffect(() => {
    const minuteur = setTimeout(() => void composer(), 160);
    return () => clearTimeout(minuteur);
  }, [composer]);

  function basculer(id: string) {
    setFait(false);
    setChoisis((actuels) => {
      if (actuels.includes(id)) return actuels.filter((x) => x !== id);
      // L'ordre de sélection est l'ordre sur l'affiche : le premier touché est
      // celui qui sera mis en avant. C'est plus prévisible qu'un tri caché.
      if (actuels.length >= PRODUITS_MAX) return actuels;
      return [...actuels, id];
    });
  }

  async function telecharger() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const blob = await versBlob(canvas);
    if (!blob) return;

    const nom = nomFichier(boutique, formatChoisi);

    /*
      Partager plutôt que télécharger, quand le téléphone le permet.

      Sur Android, `navigator.share` ouvre directement Facebook, WhatsApp ou
      Messenger avec l'image jointe : le vendeur publie sans jamais passer par
      sa galerie. C'est deux gestes au lieu de cinq, et c'est là que la
      fonctionnalité gagne ou perd son utilité.

      Le repli reste un téléchargement ordinaire, qui marche partout.
    */
    const fichier = new File([blob], nom, { type: "image/png" });

    if (navigator.canShare?.({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier], title: boutique });
        setFait(true);
        return;
      } catch {
        // Partage refusé ou annulé : on retombe sur le téléchargement.
      }
    }

    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nom;
    lien.click();
    URL.revokeObjectURL(url);
    setFait(true);
  }

  if (produits.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-[0.6875rem] text-[var(--color-muted)]">{t.vendor.posterEmpty}</p>
      </Card>
    );
  }

  const format = FORMATS[formatChoisi];
  const complet = choisis.length >= PRODUITS_MAX;

  return (
    <LazyMotion features={chargerAnimations} strict>
      <div className="flex flex-col gap-4">
        <p className="text-[0.65625rem] leading-[1.6] text-[var(--color-muted)]">
          {gabarit(t.vendor.posterIntro, { n: PRODUITS_MAX })}
        </p>

        {/* ─── L'aperçu ─────────────────────────────────────────────── */}

        <section className="flex flex-col gap-2">
          <h2 className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
            {t.vendor.posterPreview}
          </h2>

          <div className="flex justify-center">
            <m.div
              /*
                La clé change avec le format : l'aperçu se reconstruit alors au
                lieu de s'étirer d'un rapport à l'autre, ce qui donnait une
                déformation désagréable entre une story et un paysage.
              */
              key={formatChoisi}
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
              className="relative overflow-hidden rounded-[18px] shadow-[0_14px_40px_rgba(40,25,70,0.22)]"
              style={{
                width: "min(300px, 78vw)",
                aspectRatio: `${format.largeur} / ${format.hauteur}`,
              }}
            >
              <canvas ref={canvasRef} className="block h-full w-full" />

              {/*
                Un balayage pendant la composition.

                Il dure le temps du rendu et pas une milliseconde de plus : ce
                n'est pas une décoration mais la réponse à « est-ce que ça
                marche ? » sur un téléphone où le redessin prend une seconde.
              */}
              <AnimatePresence>
                {compose && (
                  <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="pointer-events-none absolute inset-0"
                  >
                    <m.div
                      animate={{ x: ["-60%", "160%"] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-y-0 w-[45%] bg-gradient-to-r from-transparent via-white/28 to-transparent"
                    />
                  </m.div>
                )}
              </AnimatePresence>
            </m.div>
          </div>

          <AnimatePresence>
            {avertissement && (
              <m.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden text-center text-[0.59375rem] text-[var(--color-muted)]"
              >
                {avertissement}
              </m.p>
            )}
          </AnimatePresence>
        </section>

        {/* ─── Format ───────────────────────────────────────────────── */}

        <section className="flex flex-col gap-2">
          <h2 className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
            {t.vendor.posterFormat}
          </h2>

          <div className="flex gap-[6px] rounded-[14px] bg-[var(--color-field)] p-[4px]">
            {FORMAT_ORDRE.map((cle) => {
              const actif = formatChoisi === cle;
              const libelle =
                cle === "story"
                  ? t.vendor.posterStory
                  : cle === "carre"
                    ? t.vendor.posterSquare
                    : t.vendor.posterLandscape;
              const aide =
                cle === "story"
                  ? t.vendor.posterStoryHint
                  : cle === "carre"
                    ? t.vendor.posterSquareHint
                    : t.vendor.posterLandscapeHint;

              return (
                <button
                  key={cle}
                  type="button"
                  onClick={() => {
                    setFormatChoisi(cle);
                    setFait(false);
                  }}
                  aria-pressed={actif}
                  className="press relative flex-1 rounded-[11px] px-1 py-[9px]"
                >
                  {actif && (
                    <m.span
                      layoutId="format-affiche"
                      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                      className="absolute inset-0 rounded-[11px] bg-[var(--color-ink)]"
                    />
                  )}
                  <span
                    className={cx(
                      "relative block text-[0.625rem] font-bold",
                      actif ? "text-[var(--color-app)]" : "text-[var(--color-muted)]",
                    )}
                  >
                    {libelle}
                  </span>
                  <span
                    className={cx(
                      "relative mt-[2px] block truncate text-[0.5rem]",
                      actif ? "text-[var(--color-app)] opacity-70" : "text-[var(--color-faint)]",
                    )}
                  >
                    {aide}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── Ambiance ─────────────────────────────────────────────── */}

        <section className="flex flex-col gap-2">
          <h2 className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
            {t.vendor.posterTheme}
          </h2>

          <div className="flex gap-2">
            {THEME_ORDRE.map((cle) => {
              const theme = THEMES[cle];
              const actif = themeChoisi === cle;
              const nom =
                cle === "nuit"
                  ? t.vendor.posterNight
                  : cle === "sable"
                    ? t.vendor.posterSand
                    : cle === "eclat"
                      ? t.vendor.posterGlow
                      : t.vendor.posterSouk;

              return (
                <button
                  key={cle}
                  type="button"
                  onClick={() => {
                    setThemeChoisi(cle);
                    setFait(false);
                  }}
                  aria-pressed={actif}
                  className="press flex flex-1 flex-col items-center gap-[5px]"
                >
                  {/* La pastille montre le thème plutôt que de le nommer : on
                      choisit une ambiance en la voyant, pas en la lisant. */}
                  <m.span
                    animate={{ scale: actif ? 1 : 0.88 }}
                    transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                    className={cx(
                      "relative block h-[38px] w-full overflow-hidden rounded-[12px]",
                      actif && "ring-2 ring-[var(--color-ink)] ring-offset-2 ring-offset-[var(--color-app)]",
                    )}
                    style={{
                      background: `linear-gradient(140deg, ${theme.fond[0]}, ${theme.fond[1]})`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute bottom-[6px] end-[6px] h-[9px] w-[9px] rounded-full"
                      style={{ background: theme.accent }}
                    />
                  </m.span>

                  <span
                    className={cx(
                      "text-[0.5625rem] font-semibold",
                      actif ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]",
                    )}
                  >
                    {nom}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── Accroche ─────────────────────────────────────────────── */}

        <section className="flex flex-col gap-2">
          <h2 className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
            {t.vendor.posterHeadline}
          </h2>

          <input
            value={accroche}
            onChange={(event) => {
              setAccroche(event.target.value);
              setFait(false);
            }}
            maxLength={60}
            placeholder={t.vendor.posterHeadlinePlaceholder}
            className="w-full rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-3 py-2 text-[0.75rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
          />

          {!telephone && (
            <p className="text-[0.5625rem] text-[var(--color-muted)]">{t.vendor.posterNoPhone}</p>
          )}
        </section>

        {/* ─── Les produits ─────────────────────────────────────────── */}

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
              {t.vendor.posterPick}
            </h2>
            <span className="text-[0.5625rem] text-[var(--color-faint)]">
              {complet ? t.vendor.posterFull : t.vendor.posterPickHint}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {produits.map((produit) => {
              const rang = choisis.indexOf(produit.id);
              const actif = rang !== -1;

              return (
                <m.button
                  key={produit.id}
                  type="button"
                  onClick={() => basculer(produit.id)}
                  aria-pressed={actif}
                  whileTap={{ scale: 0.95 }}
                  animate={{ opacity: !actif && complet ? 0.42 : 1 }}
                  className={cx(
                    "press relative flex flex-col overflow-hidden rounded-[14px] bg-[var(--color-surface-solid)] text-start",
                    actif && "ring-2 ring-[var(--color-brand-fill)]",
                  )}
                >
                  <span className="relative block aspect-square w-full overflow-hidden bg-[var(--color-field)]">
                    {produit.images[0] ? (
                      <Image
                        src={produit.images[0]}
                        alt=""
                        fill
                        sizes="(min-width: 640px) 180px, 30vw"
                        className="object-cover"
                      />
                    ) : null}

                    {/* Le rang, et non une simple coche : il dit où le produit
                        atterrira sur l'affiche, ce qu'une coche ne dit pas. */}
                    <AnimatePresence>
                      {actif && (
                        <m.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                          className="absolute top-[6px] end-[6px] flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-[0.5625rem] font-bold text-white"
                        >
                          {rang + 1}
                        </m.span>
                      )}
                    </AnimatePresence>
                  </span>

                  <span className="flex flex-col gap-[1px] px-[7px] py-[6px]">
                    <span className="truncate text-[0.5625rem] font-semibold text-[var(--color-ink)]">
                      {produit.name}
                    </span>
                    <span className="truncate text-[0.53125rem] text-[var(--color-muted)]">
                      {formatPrice(produit.price, locale)}
                    </span>
                  </span>
                </m.button>
              );
            })}
          </div>
        </section>

        {/* ─── L'export ─────────────────────────────────────────────── */}

        <div className="sticky bottom-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => void telecharger()}
            disabled={selection.length === 0 || compose}
            className="press w-full rounded-full bg-[var(--color-ink)] py-[13px] text-[0.75rem] font-bold text-[var(--color-app)] shadow-[0_8px_24px_rgba(40,25,70,0.24)] disabled:opacity-45"
          >
            {compose
              ? t.vendor.posterComposing
              : fait
                ? t.vendor.posterDone
                : t.vendor.posterDownload}
          </button>

          {selection.length === 0 && (
            <p className="text-center text-[0.5625rem] text-[var(--color-muted)]">
              {t.vendor.posterNone}
            </p>
          )}
        </div>
      </div>
    </LazyMotion>
  );
}
