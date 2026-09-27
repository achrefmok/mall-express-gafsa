"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { formatPrice } from "@/lib/format";
import {
  basculerProduitExposant,
  creerProduitExposant,
  modifierMonStand,
  modifierProduitExposant,
  supprimerProduitExposant,
} from "@/app/actions/lelma3ardh";
import { uploadImage } from "@/lib/upload";
import { Button, Card, SectionTitle, Tag, fieldClass } from "@/components/ui/primitives";
import { SignOutButton } from "@/app/(client)/profil/profile-client";

const CHAMP = fieldClass({ size: "xs", solid: true });
const ETIQ = "text-[0.625rem] text-[var(--color-muted)]";

export interface ExposantMoi {
  id: string;
  expo_id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  stand_no: string | null;
  phone: string | null;
  whatsapp: string | null;
  facebook_url: string | null;
  instagram: string | null;
  address: string | null;
  logo_url: string | null;
  cover_url: string | null;
  images: string[];
  status: "pending" | "approved" | "rejected" | "suspended";
}

export interface ProduitExposant {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  price: number | null;
  compare_at_price: number | null;
  images: string[];
  is_available: boolean;
  position: number;
}

export function EspaceExposant({
  exhibitor,
  produits,
}: {
  exhibitor: ExposantMoi;
  produits: ProduitExposant[];
}) {
  const { t, locale } = useI18n();

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6">
      <Card className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.875rem] font-bold text-[var(--color-ink)]">
            {locale === "ar" && exhibitor.name_ar ? exhibitor.name_ar : exhibitor.name}
          </p>
          {exhibitor.status !== "approved" && (
            <Tag tone="tinted">{exhibitor.status}</Tag>
          )}
        </div>
      </Card>

      <FormulaireStand exhibitor={exhibitor} />

      <section className="flex flex-col gap-2">
        <SectionTitle>{t.dahmani.products}</SectionTitle>
        <ListeProduitsExposant produits={produits} />
      </section>

      <SignOutButton />
    </div>
  );
}

/* ─── Mon stand ─────────────────────────────────────────────────────────── */

function FormulaireStand({ exhibitor }: { exhibitor: ExposantMoi }) {
  const { t } = useI18n();
  const router = useRouter();

  const [nameAr, setNameAr] = useState(exhibitor.name_ar ?? "");
  const [description, setDescription] = useState(exhibitor.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(exhibitor.description_ar ?? "");
  const [standNo, setStandNo] = useState(exhibitor.stand_no ?? "");
  const [phone, setPhone] = useState(exhibitor.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(exhibitor.whatsapp ?? "");
  const [facebook, setFacebook] = useState(exhibitor.facebook_url ?? "");
  const [instagram, setInstagram] = useState(exhibitor.instagram ?? "");
  const [address, setAddress] = useState(exhibitor.address ?? "");
  const [cover, setCover] = useState<string[]>(exhibitor.cover_url ? [exhibitor.cover_url] : []);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await modifierMonStand({
        nameAr,
        description,
        descriptionAr,
        standNo,
        phone,
        whatsapp,
        facebookUrl: facebook,
        instagram,
        address,
        coverUrl: cover[0] ?? null,
        images: exhibitor.images,
      });
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <Card className="flex flex-col gap-2 p-3">
      <SectionTitle>{t.dahmani.standInfo}</SectionTitle>

      <PhotoUnique images={cover} setImages={setCover} label={t.dahmani.photos} />

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>{t.dahmani.lastName} (عربي)</span>
        <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" lang="ar" className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>{t.dahmani.description}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows={2}
          className={`${CHAMP} resize-none`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>{t.dahmani.description} (عربي)</span>
        <textarea
          value={descriptionAr}
          onChange={(e) => setDescriptionAr(e.target.value.slice(0, 500))}
          dir="rtl"
          lang="ar"
          rows={2}
          className={`${CHAMP} resize-none`}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>{t.dahmani.phone}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>{t.dahmani.whatsapp}</span>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" inputMode="tel" className={CHAMP} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Facebook</span>
          <input value={facebook} onChange={(e) => setFacebook(e.target.value)} dir="ltr" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Instagram</span>
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} dir="ltr" className={CHAMP} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>{t.shopCreate.address}</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Stand</span>
        <input value={standNo} onChange={(e) => setStandNo(e.target.value)} className={CHAMP} />
      </label>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      <Button onClick={envoyer} disabled={pending}>
        {t.dahmani.saveChanges}
      </Button>
    </Card>
  );
}

/* ─── Mes produits ─────────────────────────────────────────────────────── */

function ListeProduitsExposant({ produits }: { produits: ProduitExposant[] }) {
  const { t } = useI18n();
  const [nouveau, setNouveau] = useState(false);

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[0.65625rem] font-bold text-[var(--color-ink)]">
          {t.dahmani.products} · {produits.length}
        </span>
        <button
          type="button"
          onClick={() => setNouveau((v) => !v)}
          className="text-[0.625rem] font-bold text-[var(--color-brand)]"
        >
          {nouveau ? t.dahmani.close : `+ ${t.dahmani.addProduct}`}
        </button>
      </div>

      {nouveau && <FormulaireProduitExposant onFini={() => setNouveau(false)} />}

      {produits.length === 0 && !nouveau && (
        <p className="py-4 text-center text-[0.6875rem] text-[var(--color-muted)]">
          {t.dahmani.noProducts}
        </p>
      )}

      {produits.map((p) => (
        <LigneProduitExposant key={p.id} produit={p} />
      ))}
    </Card>
  );
}

function LigneProduitExposant({ produit }: { produit: ProduitExposant }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [pending, startTransition] = useTransition();

  function basculer() {
    startTransition(async () => {
      const r = await basculerProduitExposant(produit.id, !produit.is_available);
      if (r.ok) router.refresh();
    });
  }

  function retirer() {
    if (!window.confirm(t.dahmani.confirmDeleteProduct)) return;
    startTransition(async () => {
      const r = await supprimerProduitExposant(produit.id);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] border border-[var(--color-hairline)] p-[10px]">
      <div className="flex items-center gap-[10px]">
        {produit.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette 44px dans une liste
          <img src={produit.images[0]} alt="" className="h-11 w-11 flex-none rounded-[12px] object-cover" />
        ) : (
          <span className="h-11 w-11 flex-none rounded-[12px] bg-[var(--color-track)]" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
            {locale === "ar" && produit.name_ar ? produit.name_ar : produit.name}
          </p>
          <p className="text-[0.625rem] text-[var(--color-muted)]">
            {produit.price !== null ? formatPrice(produit.price, locale) : "—"}
            {" · "}
            {produit.is_available ? t.dahmani.available : t.dahmani.unavailable}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          className="flex-none text-[0.625rem] font-bold text-[var(--color-brand)]"
        >
          {t.dahmani.edit}
        </button>
      </div>

      {ouvert && (
        <div className="mt-2">
          <FormulaireProduitExposant produit={produit} onFini={() => setOuvert(false)} />
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={basculer}
          disabled={pending}
          className="flex-1 rounded-[10px] border border-[var(--color-outline)] py-[6px] text-[0.625rem] font-semibold text-[var(--color-muted)] disabled:opacity-50"
        >
          {produit.is_available ? t.dahmani.makeUnavailable : t.dahmani.makeAvailable}
        </button>
        <button
          type="button"
          onClick={retirer}
          disabled={pending}
          className="flex-1 rounded-[10px] border border-[var(--color-outline)] py-[6px] text-[0.625rem] font-semibold text-[var(--color-live)] disabled:opacity-50"
        >
          {t.dahmani.delete}
        </button>
      </div>
    </div>
  );
}

function FormulaireProduitExposant({
  produit,
  onFini,
}: {
  produit?: ProduitExposant;
  onFini: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [nom, setNom] = useState(produit?.name ?? "");
  const [nomAr, setNomAr] = useState(produit?.name_ar ?? "");
  const [description, setDescription] = useState(produit?.description ?? "");
  const [prix, setPrix] = useState(produit?.price != null ? String(produit.price) : "");
  const [prixBarre, setPrixBarre] = useState(
    produit?.compare_at_price != null ? String(produit.compare_at_price) : "",
  );
  const [images, setImages] = useState<string[]>(produit?.images ?? []);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function envoyer() {
    setErreur(null);
    const prixNum = prix.trim() ? Number.parseFloat(prix) : null;
    const barreNum = prixBarre.trim() ? Number.parseFloat(prixBarre) : null;

    startTransition(async () => {
      const r = produit
        ? await modifierProduitExposant({
            id: produit.id,
            name: nom,
            nameAr: nomAr,
            description,
            price: prixNum,
            compareAtPrice: barreNum,
            images,
            isAvailable: produit.is_available,
          })
        : await creerProduitExposant({
            name: nom,
            nameAr: nomAr,
            description,
            price: prixNum,
            compareAtPrice: barreNum,
            images,
          });

      if (r.ok) {
        onFini();
        router.refresh();
      } else {
        setErreur(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-[var(--color-app)] p-[10px]">
      <PhotosProduit images={images} setImages={setImages} max={4} />

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>{t.dahmani.productName}</span>
        <input value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>{t.dahmani.productNameAr}</span>
        <input
          value={nomAr}
          onChange={(e) => setNomAr(e.target.value.slice(0, 80))}
          dir="rtl"
          lang="ar"
          className={CHAMP}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>{t.dahmani.description}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 400))}
          rows={2}
          className={`${CHAMP} resize-none`}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>{t.dahmani.price}</span>
          <input value={prix} onChange={(e) => setPrix(e.target.value)} inputMode="decimal" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>{t.dahmani.comparePrice}</span>
          <input
            value={prixBarre}
            onChange={(e) => setPrixBarre(e.target.value)}
            inputMode="decimal"
            className={CHAMP}
          />
        </label>
      </div>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={envoyer} disabled={pending || !nom.trim()} className="flex-1">
          {t.dahmani.save}
        </Button>
        <button
          type="button"
          onClick={onFini}
          className="flex-1 rounded-[16px] border border-[var(--color-outline)] text-[0.65625rem] font-semibold text-[var(--color-muted)]"
        >
          {t.dahmani.close}
        </button>
      </div>
    </div>
  );
}

/* ─── Photos ────────────────────────────────────────────────────────────── */

function PhotoUnique({
  images,
  setImages,
  label,
}: {
  images: string[];
  setImages: (v: string[]) => void;
  label: string;
}) {
  const { t } = useI18n();
  const champ = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);

  async function choisir(fichiers: FileList | null) {
    const f = fichiers?.[0];
    if (!f) return;
    setEnvoi(true);
    try {
      const { publicUrl } = await uploadImage("shop-assets", f);
      setImages([publicUrl]);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={ETIQ}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="relative h-14 w-14 flex-none overflow-hidden rounded-[10px] bg-[var(--color-track)]">
          {images[0] && (
            // eslint-disable-next-line @next/next/no-img-element -- miniature locale
            <img src={images[0]} alt="" className="h-full w-full object-cover" />
          )}
        </span>
        <button
          type="button"
          onClick={() => champ.current?.click()}
          disabled={envoi}
          className="rounded-[12px] border border-[var(--color-outline)] px-3 py-2 text-[0.625rem] font-semibold text-[var(--color-brand)] disabled:opacity-50"
        >
          {envoi ? "…" : images[0] ? t.dahmani.replacePhoto : t.dahmani.choosePhoto}
        </button>
        <input
          ref={champ}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void choisir(e.target.files)}
        />
      </div>
    </div>
  );
}

function PhotosProduit({
  images,
  setImages,
  max,
}: {
  images: string[];
  setImages: (v: string[]) => void;
  max: number;
}) {
  const { t } = useI18n();
  const champ = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);

  async function ajouter(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    setEnvoi(true);
    try {
      const restants = max - images.length;
      const envoyes = await Promise.all(
        Array.from(fichiers)
          .slice(0, restants)
          .map((f) => uploadImage("shop-assets", f)),
      );
      setImages([...images, ...envoyes.map((u) => u.publicUrl)]);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={ETIQ}>
        {format(t.deals.photos, { n: images.length, max })}
      </span>
      <div className="no-sb flex gap-2 overflow-x-auto">
        {images.map((url) => (
          <span key={url} className="relative h-14 w-14 flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- miniature locale */}
            <img src={url} alt="" className="h-full w-full rounded-[10px] object-cover" />
            <button
              type="button"
              onClick={() => setImages(images.filter((u) => u !== url))}
              aria-label="Retirer"
              className="absolute end-[2px] top-[2px] flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(36,31,46,0.72)] text-[0.625rem] leading-none text-white"
            >
              ✕
            </button>
          </span>
        ))}

        {images.length < max && (
          <button
            type="button"
            onClick={() => champ.current?.click()}
            disabled={envoi}
            className="h-14 w-14 flex-none rounded-[10px] border-[1.5px] border-dashed border-[var(--color-outline)] text-[0.875rem] text-[var(--color-brand)] disabled:opacity-50"
          >
            {envoi ? "…" : "+"}
          </button>
        )}
      </div>

      <input
        ref={champ}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void ajouter(e.target.files)}
      />
    </div>
  );
}
