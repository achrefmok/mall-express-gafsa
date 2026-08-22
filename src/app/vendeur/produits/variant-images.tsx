"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { generateVariantImages, setVariantImage } from "@/app/actions/variants";
import { planGeneration } from "@/lib/variants";
import { uploadImage } from "@/lib/upload";
import { cx } from "@/lib/format";
import { Button, Divider } from "@/components/ui/primitives";
import { ImageIcon } from "@/components/ui/icons";
import type { VariantImages } from "@/types/database";

/**
 * Quelle photo montre quelle couleur — et ce qu'on fabrique à défaut.
 *
 * Un commerçant photographie son article une fois, puis déclare quatre
 * coloris. Sans rattachement, le client qui touchait « bleu » voyait la photo
 * rouge et découvrait la vraie couleur à la livraison.
 *
 * Trois états par couleur, et un seul geste pour en changer :
 *
 *   · **Photo réelle** — la pastille montre la photo du vendeur ;
 *   · **Teinte fabriquée** — la couleur a été obtenue par rotation depuis une
 *     autre photo, et l'étiquette le dit, ici comme sur la fiche client ;
 *   · **Aucune image** — la pastille montre la couleur seule.
 *
 * Toucher une pastille remplace toujours par une vraie photo. C'est le sens
 * unique de la règle : une photo réelle chasse une teinte fabriquée, jamais
 * l'inverse.
 */
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

  const restant = planGeneration(colors, images, variants);

  async function onPick(color: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(color);

    try {
      const { publicUrl } = await uploadImage("products", file);

      const result = await setVariantImage({ productId, color, url: publicUrl });
      if (result.ok) {
        setVariants((v) => ({ ...v, [color]: { url: publicUrl, generated: false } }));
        setNotice(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError(t.common.error);
    } finally {
      setBusy(null);
    }
  }

  function onClear(color: string) {
    setBusy(color);
    startTransition(async () => {
      const result = await setVariantImage({ productId, color, url: null });
      if (result.ok) {
        setVariants((v) => {
          const next = { ...v };
          delete next[color];
          return next;
        });
      } else {
        setError(result.error);
      }
      setBusy(null);
    });
  }

  function onGenerate() {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await generateVariantImages(productId);
      if (result.ok) {
        setNotice(format(t.product.generatedCount, { n: result.data.generated }));
        // Le serveur a écrit : on recharge pour récupérer les adresses créées.
        window.location.reload();
      } else {
        setError(result.error);
      }
    });
  }

  if (colors.length === 0) return null;

  return (
    <>
      <Divider />

      <span className="text-[0.625rem] text-[var(--color-muted)]">{t.product.variantImages}</span>

      <div className="flex flex-col gap-2">
        {colors.map((color) => {
          const entry = variants[color];
          const occupe = busy === color || pending;

          return (
            <div key={color} className="flex items-center gap-[10px]">
              <label
                className={cx(
                  "press relative flex h-11 w-11 flex-none cursor-pointer items-center justify-center overflow-hidden rounded-[14px] border border-[var(--color-outline)]",
                  occupe && "opacity-50",
                )}
                style={entry?.url ? undefined : { background: color }}
                title={t.product.pickVariantPhoto}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={occupe}
                  onChange={(event) => void onPick(color, event.target.files?.[0])}
                />
                {entry?.url ? (
                  <Image src={entry.url} alt="" fill sizes="44px" className="object-cover" />
                ) : (
                  <span className="rounded-full bg-[rgba(255,255,255,0.85)] p-1 text-[var(--color-ink)]">
                    <ImageIcon size={13} />
                  </span>
                )}
              </label>

              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.625rem] text-[var(--color-muted)]">{color}</p>
                <p
                  className={cx(
                    "text-[0.65625rem] font-bold",
                    entry?.generated
                      ? "text-[var(--color-brand)]"
                      : entry
                        ? "text-[var(--color-ink)]"
                        : "text-[var(--color-faint)]",
                  )}
                >
                  {entry?.generated
                    ? t.product.generatedImage
                    : entry
                      ? t.product.realPhoto
                      : t.product.noImage}
                </p>
              </div>

              {entry && (
                <button
                  type="button"
                  onClick={() => onClear(color)}
                  disabled={occupe}
                  aria-label={`${t.common.delete} ${color}`}
                  className="press flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--color-muted)]"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/*
        Le bouton n'apparaît que s'il y a quelque chose à fabriquer.

        Il disparaît de lui-même quand toutes les couleurs ont une image, et
        quand les couleurs restantes sont des neutres — un noir ou un blanc ne
        s'obtient pas par rotation de teinte, et produire une copie de la source
        sous une étiquette « bleu » serait un mensonge.
      */}
      {restant.length > 0 && (
        <>
          <Button
            size="sm"
            tone="outline"
            block
            onClick={onGenerate}
            disabled={pending || busy !== null}
          >
            {pending
              ? t.common.loading
              : format(t.product.generateTints, { n: restant.length })}
          </Button>

          <p className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">
            {t.product.generatedNotice}
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
