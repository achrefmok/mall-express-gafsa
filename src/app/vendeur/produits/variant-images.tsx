"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import {
  discardVariantPreviews,
  previewVariantImages,
  publishVariantImages,
  setVariantImage,
  type VariantProposal,
} from "@/app/actions/variants";
import { planGeneration } from "@/lib/variants";
import { colorName } from "@/lib/color-names";
import { uploadImage } from "@/lib/upload";
import { cx } from "@/lib/format";
import { Button, Divider } from "@/components/ui/primitives";
import { CameraIcon, ImageIcon } from "@/components/ui/icons";
import type { VariantImages } from "@/types/database";

/**
 * Quelle image montre quel coloris — et ce qu'on fabrique pour les autres.
 *
 * Un commerçant photographie son article une fois, puis déclare six coloris.
 * Sans rattachement, le client qui touchait « bleu » voyait la photo noire et
 * découvrait la vraie couleur à la livraison.
 *
 * Chaque ligne dit franchement où en est un coloris :
 *
 *   · **Photo vendeur** — une ou plusieurs vues déposées à la main ;
 *   · **Générée** — l'image a été fabriquée à partir de la photo de référence ;
 *   · **Sans photo** — rien ne le montre, et la fiche client le dira.
 *
 * Le premier coloris déclaré n'attend rien : ce sont les photos du produit qui
 * le montrent, et l'écran le rappelle plutôt que de laisser croire qu'il manque
 * quelque chose.
 *
 * **La fabrication passe par un aperçu.** Les images sont produites, montrées,
 * et publiées seulement si le vendeur les valide. Il est le seul à pouvoir dire
 * si le rendu tient sur *sa* photo ; le lui demander après coup, une fois la
 * fiche en ligne, serait le mettre devant le fait accompli.
 *
 * **Rien de technique ne remonte jusqu'ici.** Le vendeur lit ce qu'il peut faire
 * — reprendre la photo, en déposer une autre — jamais ce qui a échoué dans le
 * masque. Un message d'erreur qu'on ne peut pas suivre ne sert qu'à inquiéter.
 */

/** Durée du « Prête » avant que l'étiquette ne reprenne son texte habituel. */
const DUREE_CONFIRMATION = 2600;

export function VariantImageEditor({
  productId,
  colors,
  images,
  initial,
}: {
  productId: string;
  colors: string[];
  images: string[];
  initial: VariantImages;
}) {
  const { t } = useI18n();

  const [variants, setVariants] = useState<VariantImages>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Les images fabriquées, en attente du verdict du vendeur. */
  const [apercus, setApercus] = useState<VariantProposal[] | null>(null);
  const [refuses, setRefuses] = useState<string[]>([]);

  /*
    Les coloris qui viennent d'aboutir, et le moment où l'on cesse de le dire.

    Le résultat se voit — la vignette se remplit — mais après une attente, voir
    ne suffit pas : le vendeur veut lire que c'est fait. La confirmation s'efface
    ensuite d'elle-même, sinon elle deviendrait un décor permanent qui ne
    confirme plus rien.
  */
  const [confirmes, setConfirmes] = useState<string[]>([]);
  const minuteur = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (minuteur.current) window.clearTimeout(minuteur.current);
    };
  }, []);

  function confirmer(couleurs: string[]) {
    setConfirmes(couleurs);
    if (minuteur.current) window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => setConfirmes([]), DUREE_CONFIRMATION);
  }

  const restant = planGeneration(colors, images, variants);
  const nom = (couleur: string) => colorName(couleur, t) ?? couleur;

  /** Les vues d'un coloris, l'ancien format à une seule adresse compris. */
  function vuesDe(color: string): string[] {
    const entry = variants[color];
    if (!entry?.url) return [];
    return entry.images?.length ? entry.images : [entry.url];
  }

  async function enregistrer(color: string, vues: string[]) {
    const result = await setVariantImage({ productId, color, urls: vues });

    if (!result.ok) {
      setError(result.error);
      return false;
    }

    setVariants((v) => {
      const next = { ...v };
      if (vues.length > 0) next[color] = { url: vues[0], generated: false, images: vues };
      else delete next[color];
      return next;
    });
    return true;
  }

  async function onPick(color: string, files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);
    setNotice(null);
    setBusy(color);

    try {
      /*
        Les envois se font l'un après l'autre, pas tous ensemble.

        Sur la connexion d'un commerçant de Gafsa, trois envois simultanés se
        partagent la même bande passante et échouent plus souvent qu'ils
        n'aboutissent. En file, chaque photo profite de tout ce qui est
        disponible.
      */
      const ajouts: string[] = [];
      for (const file of Array.from(files)) {
        const { publicUrl } = await uploadImage("products", file);
        ajouts.push(publicUrl);
      }

      // Les nouvelles vues s'ajoutent aux existantes : déposer le dos ne doit
      // pas effacer l'avant. Une image fabriquée, elle, est bien remplacée.
      const anciennes = variants[color]?.generated ? [] : vuesDe(color);
      const ok = await enregistrer(color, [...anciennes, ...ajouts]);
      if (ok) confirmer([color]);
    } catch {
      setError(t.product.uploadFailed);
    } finally {
      setBusy(null);
    }
  }

  function onRemoveView(color: string, url: string) {
    setError(null);
    setBusy(color);

    startTransition(async () => {
      await enregistrer(
        color,
        vuesDe(color).filter((vue) => vue !== url),
      );
      setBusy(null);
    });
  }

  function onFabriquer() {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await previewVariantImages(productId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setApercus(result.data.proposals);
      setRefuses(result.data.refused);
    });
  }

  function onPublier() {
    if (!apercus) return;
    setError(null);

    startTransition(async () => {
      const result = await publishVariantImages(productId, apercus);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setVariants(result.data.variants);
      setNotice(format(t.product.generatedCount, { n: result.data.ecrits }));
      confirmer(apercus.map((p) => p.color));
      setApercus(null);
      setRefuses([]);
    });
  }

  function onJeter() {
    const urls = (apercus ?? []).map((p) => p.url);
    setApercus(null);
    setRefuses([]);
    startTransition(async () => {
      await discardVariantPreviews(urls);
    });
  }

  if (colors.length === 0) return null;

  return (
    <>
      <Divider />

      <span className="text-[0.625rem] text-[var(--color-muted)]">{t.product.variantImages}</span>

      <div className="flex flex-col gap-3">
        {colors.map((color, rang) => {
          const entry = variants[color];
          const vues = vuesDe(color);
          const occupe = busy === color;
          const confirme = confirmes.includes(color);

          /* Le premier coloris est celui des photos du produit : il n'attend
             rien, et le dire évite qu'on lui cherche une photo. */
          const parDefaut = rang === 0 && vues.length === 0;

          /* Une seule ligne dit où en est ce coloris. Trois indicateurs
             concurrents pour un même état ne se lisent plus. */
          const etat = occupe
            ? { marque: "…", texte: t.product.generating, ton: "text-[var(--color-muted)]" }
            : confirme
              ? { marque: "✓", texte: t.product.tintReady, ton: "text-[var(--color-brand)]" }
              : entry?.generated
                ? { marque: "✓", texte: t.product.generatedImage, ton: "text-[var(--color-brand)]" }
                : vues.length > 0
                  ? {
                      marque: "✓",
                      texte:
                        vues.length > 1
                          ? `${t.product.realPhoto} · ${format(t.product.variantViewCount, { n: vues.length })}`
                          : t.product.realPhoto,
                      ton: "text-[var(--color-ink)]",
                    }
                  : parDefaut
                    ? { marque: "✓", texte: t.product.defaultColor, ton: "text-[var(--color-muted)]" }
                    : { marque: "○", texte: t.product.colorNoPhoto, ton: "text-[var(--color-faint)]" };

          return (
            <div key={color} className="flex items-start gap-[10px]">
              {/* La pastille de couleur, jamais recouverte par les photos :
                  c'est elle qui dit de quel coloris parle la ligne. */}
              <span
                aria-hidden
                className="mt-[3px] h-[18px] w-[18px] flex-none rounded-full ring-1 ring-[var(--color-outline)]"
                style={{ background: color }}
              />

              <div className="min-w-0 flex-1">
                <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">{nom(color)}</p>
                <p className={cx("text-[0.625rem] font-semibold", etat.ton)}>
                  <span aria-hidden>{etat.marque} </span>
                  {etat.texte}
                </p>

                <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
                  {/* Le coloris par défaut montre la photo du produit, sans
                      croix : elle ne lui appartient pas, elle appartient à
                      l'article. */}
                  {parDefaut && images[0] && (
                    <span className="relative h-11 w-11 flex-none overflow-hidden rounded-[12px] border border-[var(--color-outline)] opacity-70">
                      <Image src={images[0]} alt="" fill sizes="44px" className="object-cover" />
                    </span>
                  )}

                  {vues.map((url) => (
                    <span
                      key={url}
                      className="relative h-11 w-11 overflow-hidden rounded-[12px] border border-[var(--color-outline)]"
                    >
                      <Image src={url} alt="" fill sizes="44px" className="object-cover" />

                      {/* La croix déborde la vignette : petite à l'œil, large
                          au doigt. Les vendeurs se trompent de photo, souvent. */}
                      <button
                        type="button"
                        onClick={() => onRemoveView(color, url)}
                        disabled={occupe}
                        aria-label={`${t.common.delete} — ${nom(color)}`}
                        className="press absolute end-0 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-bl-[10px] bg-[rgba(20,14,26,0.62)] text-[0.625rem] leading-none text-white"
                      >
                        ✕
                      </button>
                    </span>
                  ))}

                  <label
                    className={cx(
                      "press flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-[var(--color-outline)] text-[var(--color-muted)]",
                      occupe && "pointer-events-none opacity-50",
                    )}
                    title={t.common.takePhoto}
                  >
                    {/* `capture` ouvre directement l'appareil photo sur mobile. */}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="sr-only"
                      disabled={occupe}
                      onChange={(event) => {
                        void onPick(color, event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <CameraIcon size={14} />
                  </label>

                  <label
                    className={cx(
                      "press flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-[var(--color-outline)] text-[var(--color-muted)]",
                      occupe && "pointer-events-none opacity-50",
                    )}
                    title={vues.length > 0 ? t.product.addView : t.product.pickVariantPhoto}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      disabled={occupe}
                      onChange={(event) => {
                        void onPick(color, event.target.files);
                        // Le champ est vidé pour que redéposer le même fichier
                        // déclenche bien un nouvel envoi.
                        event.target.value = "";
                      }}
                    />
                    <ImageIcon size={14} />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/*
        L'aperçu : ce qui serait publié, tel qu'il serait publié.

        Les images sont déjà déposées dans le stockage — ce sont les fichiers
        définitifs, pas des rendus réduits pour la circonstance. Le vendeur juge
        donc sur pièce, et « Publier » ne fait que les rattacher au produit.
      */}
      {apercus && apercus.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[16px] border border-[var(--color-outline)] p-3">
          <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
            {t.product.previewTitle}
          </p>
          <p className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">
            {t.product.previewHint}
          </p>

          <div className="no-sb flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {apercus.map((proposition) => (
              <div key={proposition.color} className="flex w-[86px] flex-none flex-col gap-1">
                <span className="relative block h-[110px] w-full overflow-hidden rounded-[12px] border border-[var(--color-outline)]">
                  <Image
                    src={proposition.url}
                    alt={nom(proposition.color)}
                    fill
                    sizes="86px"
                    className="object-cover"
                  />
                </span>
                <span className="flex items-center gap-1 text-[0.5625rem] font-semibold text-[var(--color-muted)]">
                  <span
                    aria-hidden
                    className="h-[10px] w-[10px] flex-none rounded-full ring-1 ring-[var(--color-outline)]"
                    style={{ background: proposition.color }}
                  />
                  <span className="truncate">{nom(proposition.color)}</span>
                </span>
              </div>
            ))}
          </div>

          {refuses.length > 0 && (
            <p className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">
              {format(t.product.generationRefused, { n: refuses.length })}
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={onPublier} disabled={pending} className="flex-1">
              {pending ? t.common.loading : t.product.publish}
            </Button>
            <Button size="sm" tone="outline" onClick={onJeter} disabled={pending}>
              {t.product.discard}
            </Button>
          </div>
        </div>
      )}

      {/*
        Le bouton n'apparaît que s'il y a quelque chose à fabriquer. Il disparaît
        de lui-même quand chaque coloris a son image.
      */}
      {!apercus && restant.length > 0 && (
        <>
          <Button
            size="sm"
            tone="outline"
            block
            onClick={onFabriquer}
            disabled={pending || busy !== null}
          >
            {pending ? t.product.generating : format(t.product.generateTints, { n: restant.length })}
          </Button>

          <p className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">
            {t.product.generationNotice}
          </p>
        </>
      )}

      {notice && (
        <p role="status" className="text-[0.65625rem] font-semibold text-[var(--color-brand)]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}
    </>
  );
}
