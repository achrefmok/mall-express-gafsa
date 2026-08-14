"use client";

import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { uploadImage } from "@/lib/upload";
import { quickAddProductToLive } from "@/app/actions/lives";
import { Button, Card } from "@/components/ui/primitives";
import { CameraIcon, PlusIcon } from "@/components/ui/icons";

const FIELD =
  "w-full rounded-[12px] border border-[var(--color-outline)] bg-white px-3 py-2 text-[12px] text-[var(--color-ink)]";

/**
 * Ajouter un article sans quitter la diffusion.
 *
 * Le vendeur tient la pièce en main et en parle : lui demander d'ouvrir le
 * formulaire produit complet reviendrait à lui faire quitter la console, donc à
 * interrompre son direct. Ici, une photo, un nom, un prix — et l'article est
 * achetable pendant qu'il continue de le présenter.
 *
 * L'article est épinglé dans la foulée : on vient d'en parler, c'est celui que
 * les spectateurs regardent. Il apparaît chez eux sans rechargement.
 *
 * Le stock vaut 1 par défaut, côté serveur : un vendeur qui filme une pièce en
 * main en a généralement une seule. Il reste modifiable depuis la fiche produit.
 *
 * La description reste vide. C'est là que se branchera l'extraction automatique
 * depuis la photo, sans rien changer au reste de la chaîne.
 */
export function QuickProduct({ liveId }: { liveId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // L'aperçu vient du fichier local : rien n'est envoyé tant que le vendeur
    // n'a pas validé, et une photo reprise ne laisse pas de fichier orphelin.
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

  function reset() {
    if (photo) URL.revokeObjectURL(photo.preview);
    setName("");
    setPrice("");
    setPhoto(null);
    setError(null);
    setOpen(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const value = Number.parseFloat(price.replace(",", "."));
    if (!name.trim()) return setError(t.common.required);
    if (!Number.isFinite(value) || value < 0) return setError("Prix invalide");

    startTransition(async () => {
      let images: string[] = [];

      if (photo) {
        try {
          const { publicUrl } = await uploadImage("products", photo.file);
          images = [publicUrl];
        } catch {
          // La photo n'est pas indispensable : mieux vaut un article vendable
          // sans image qu'un vendeur bloqué en pleine diffusion.
          setError("La photo n'a pas pu être envoyée — l'article est créé sans image.");
        }
      }

      const result = await quickAddProductToLive({
        liveId,
        name: name.trim(),
        price: value,
        images,
      });

      if (result.ok) reset();
      else setError(result.error);
    });
  }

  if (!open) {
    return (
      <Button tone="outline" onClick={() => setOpen(true)} className="w-full">
        <PlusIcon size={15} />
        {t.live.addProduct}
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-[10px] p-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-[10px]">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-[62px] w-[62px] flex-none items-center justify-center overflow-hidden rounded-[16px] border border-dashed border-[var(--color-outline)] bg-[var(--color-app)] text-[var(--color-muted)]"
            aria-label={t.common.takePhoto}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local, jamais servi par Next/Image
              <img src={photo.preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <CameraIcon size={20} />
            )}
          </button>

          {/*
            `capture="environment"` ouvre directement l'appareil photo arrière sur
            mobile, sans passer par la galerie : le vendeur filme, il ne cherche
            pas un fichier.
          */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="hidden"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.live.productName}
              className={FIELD}
              autoFocus
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder={`${t.live.productPrice} (${t.common.currency})`}
              className={FIELD}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "…" : t.live.addProduct}
          </Button>
          <Button type="button" tone="ghost" onClick={reset} disabled={pending}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
