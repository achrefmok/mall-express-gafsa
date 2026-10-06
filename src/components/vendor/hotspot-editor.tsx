"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { upsertLookbookPins } from "@/app/actions/vendor";
import { uploadImage } from "@/lib/upload";
import { Button } from "@/components/ui/primitives";

const LABEL = "text-[0.625rem] text-[var(--color-muted)]";
const FIELD =
  "rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 py-2 text-[0.75rem] outline-none";

interface Pin {
  productId: string | null;
  x: number;
  y: number;
}

/**
 * Pose des repères cliquables sur une photo — le lookbook Mode, l'ambiance
 * par pièce Maison. Un clic sur l'image ajoute un repère à cet endroit ;
 * chaque repère se relie ensuite à un produit via une liste déroulante.
 *
 * Pas de glisser pour repositionner un repère posé (clic pour ajouter,
 * croix pour retirer, recommencer si la position ne convient pas) : plus
 * simple à construire et à comprendre qu'un vrai éditeur drag, largement
 * suffisant pour poser 2 à 4 repères sur une photo.
 */
export function HotspotEditor({
  scope,
  titre,
  imageUrlInitiale,
  pinsInitiaux,
  produits,
}: {
  scope: string;
  titre: string;
  imageUrlInitiale: string | null;
  pinsInitiaux: Array<{ productId: string | null; x: number; y: number }>;
  produits: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [envoiImage, setEnvoiImage] = useState(false);
  const [imageUrl, setImageUrl] = useState(imageUrlInitiale);
  const [pins, setPins] = useState<Pin[]>(pinsInitiaux);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnvoiImage(true);
    setErreur(null);
    try {
      const { publicUrl } = await uploadImage("shop-assets", file);
      setImageUrl(publicUrl);
      setPins([]);
    } catch {
      setErreur("Envoi de l'image impossible");
    } finally {
      setEnvoiImage(false);
    }
  }

  function onClicImage(e: React.MouseEvent<HTMLDivElement>) {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    setPins((cur) => [...cur, { productId: null, x, y }]);
    setEnregistre(false);
  }

  function majProduit(i: number, productId: string) {
    setPins((cur) => cur.map((p, j) => (j === i ? { ...p, productId: productId || null } : p)));
  }

  function retirer(i: number) {
    setPins((cur) => cur.filter((_, j) => j !== i));
  }

  function onEnregistrer() {
    setErreur(null);
    if (!imageUrl) {
      setErreur("Ajoutez d'abord une photo");
      return;
    }
    const sansProduit = pins.some((p) => !p.productId);
    if (sansProduit) {
      setErreur("Associez un produit à chaque repère");
      return;
    }
    startTransition(async () => {
      const result = await upsertLookbookPins(scope, imageUrl!, pins);
      if (!result.ok) {
        setErreur(result.error);
        return;
      }
      setEnregistre(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <span className={LABEL}>{titre}</span>

      <input type="file" accept="image/*" onChange={onImageChange} disabled={envoiImage} className="text-[0.6875rem]" />

      {imageUrl && (
        <>
          <div
            ref={imageRef}
            onClick={onClicImage}
            className="relative h-[180px] cursor-crosshair overflow-hidden rounded-[18px] bg-center bg-cover"
            style={{ backgroundImage: `url(${imageUrl})` }}
          >
            {pins.map((p, i) => (
              <span
                key={i}
                className="absolute flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-[0.625rem] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <p className="text-[0.625rem] text-[var(--color-muted)]">Touchez la photo pour poser un repère.</p>

          {pins.length > 0 && (
            <div className="flex flex-col gap-[6px]">
              {pins.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-[0.625rem] font-bold text-white">
                    {i + 1}
                  </span>
                  <select value={p.productId ?? ""} onChange={(e) => majProduit(i, e.target.value)} className={`${FIELD} flex-1`}>
                    <option value="">Choisir un produit…</option>
                    {produits.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => retirer(i)} className="flex-none text-[0.75rem] font-bold text-[var(--color-live)]">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {erreur && (
        <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
          {erreur}
        </p>
      )}
      {enregistre && <p className="text-[0.6875rem] font-semibold text-[var(--color-success)]">Enregistré</p>}

      <Button block onClick={onEnregistrer} disabled={pending || envoiImage || !imageUrl}>
        {pending ? "Enregistrement…" : "Enregistrer les repères"}
      </Button>
    </div>
  );
}
