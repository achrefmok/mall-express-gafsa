"use client";

import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { uploadImage, type UploadResult } from "@/lib/upload";
import { quickAddProductToLive } from "@/app/actions/lives";
import { Button, Card } from "@/components/ui/primitives";
import { CameraIcon, PlusIcon } from "@/components/ui/icons";

const FIELD =
  "w-full rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-3 py-2 text-[0.75rem] text-[var(--color-ink)]";

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
export function QuickProduct({
  liveId,
  captureFrame,
}: {
  liveId: string;
  /** Fourni en source caméra : prend une image du direct en cours. */
  captureFrame?: () => Promise<File | null>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  /*
    Plusieurs photos, comme dans l'éditeur complet.

    Un vendeur qui présente une pièce en direct la montre sous deux ou trois
    angles : la coupe, l'étiquette, le défaut éventuel. N'en garder qu'une
    l'obligeait à rouvrir la fiche après le direct pour compléter — c'est-à-dire,
    en pratique, à ne jamais le faire.
  */
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const MAX_PHOTOS = 4;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  /*
    Prendre la photo dans le direct lui-même.

    Le vendeur montre l'article à la caméra et appuie une fois : l'image est
    extraite de la trame courante. Il ne lâche pas ce qu'il tient, n'ouvre pas
    l'appareil photo, ne quitte pas la diffusion — trois gestes économisés au
    moment où il parle à ses clients.
  */
  async function onCapture() {
    if (!captureFrame) return;
    const file = await captureFrame();
    if (!file) {
      setError("La vidéo n'est pas encore prête — réessayez dans un instant.");
      return;
    }
    if (photos.length >= MAX_PHOTOS) return;
    setError(null);
    setPhotos((current) => [...current, { file, preview: URL.createObjectURL(file) }]);
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    if (chosen.length === 0) return;

    // L'aperçu vient du fichier local : rien n'est envoyé tant que le vendeur
    // n'a pas validé, et une photo retirée ne laisse pas de fichier orphelin.
    setPhotos((current) => [
      ...current,
      ...chosen
        .slice(0, MAX_PHOTOS - current.length)
        .map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);

    // Sans cela, choisir deux fois le même fichier ne déclenche rien.
    event.target.value = "";
  }

  function reset() {
    for (const p of photos) URL.revokeObjectURL(p.preview);
    setName("");
    setPrice("");
    setPhotos([]);
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

      if (photos.length > 0) {
        /*
          Les envois isolés les uns des autres. `allSettled` plutôt que `all` :
          une photo qui échoue ne doit pas emporter les autres, ni bloquer un
          vendeur au milieu de sa diffusion. L'ordre choisi est conservé — la
          première photo reste la vignette.
        */
        const results = await Promise.allSettled(
          photos.map((p) => uploadImage("products", p.file)),
        );

        images = results
          .filter((r): r is PromiseFulfilledResult<UploadResult> => r.status === "fulfilled")
          .map((r) => r.value.publicUrl);

        if (images.length < photos.length) {
          setError(
            images.length === 0
              ? "Les photos n'ont pas pu être envoyées — l'article est créé sans image."
              : `${photos.length - images.length} photo(s) non envoyée(s) — l'article est créé avec les autres.`,
          );
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
            className="relative flex h-[62px] w-[62px] flex-none items-center justify-center overflow-hidden rounded-[16px] border border-dashed border-[var(--color-outline)] bg-[var(--color-app)] text-[var(--color-muted)]"
            aria-label={t.common.takePhoto}
          >
            {photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local, jamais servi par Next/Image
              <img src={photos[0].preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <CameraIcon size={20} />
            )}

            {/* Le compte, pour qu'on sache qu'il y en a d'autres derrière. */}
            {photos.length > 1 && (
              <span className="absolute end-[2px] bottom-[2px] rounded-[6px] bg-[rgba(36,31,46,0.78)] px-[5px] text-[0.5625rem] font-bold text-white">
                {photos.length}
              </span>
            )}
          </button>

          {captureFrame && (
            <button
              type="button"
              onClick={() => void onCapture()}
              className="flex h-[62px] w-[62px] flex-none flex-col items-center justify-center gap-1 rounded-[16px] border border-[var(--color-outline)] bg-[var(--color-brand-tint)] text-[var(--color-brand)]"
            >
              <CameraIcon size={18} />
              <span className="text-[0.53125rem] font-bold leading-none">{t.live.captureFrame}</span>
            </button>
          )}

          {/*
            `multiple`, et plus de `capture`.

            `capture="environment"` ouvrait directement l'appareil photo arrière,
            ce qui allait vite — mais interdit de choisir plusieurs fichiers, le
            capteur n'en produisant qu'un. Le sélecteur ordinaire propose les deux
            : prendre une photo, ou en choisir plusieurs dans la galerie. Le
            bouton « Capturer » voisin couvre déjà le geste immédiat.
          */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
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
          <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
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
