"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  enregistrerExpo,
  enregistrerExposant,
  enregistrerProduitExpo,
  supprimerExposant,
  supprimerProduitExpo,
} from "@/app/actions/lelma3ardh";
import { uploadImage } from "@/lib/upload";
import { cx } from "@/lib/format";
import { Button, Card, Chip, EmptyState, Switch, Tag, fieldClass } from "@/components/ui/primitives";
import type { ShopStatus } from "@/types/database";

const CHAMP = fieldClass({ size: "sm", solid: true });
const ETIQ = "text-[0.625rem] text-[var(--color-muted)]";

/** Huit photos par stand, six par produit : les contraintes de table. */
const PHOTOS_EXPOSANT = 8;
const PHOTOS_PRODUIT = 6;

export interface ExpoGeree {
  id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  place: string | null;
  starts_on: string;
  ends_on: string;
  is_published: boolean;
  cover_url: string | null;
}

export interface ExposantGere {
  id: string;
  expo_id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  stand_no: string | null;
  phone: string | null;
  whatsapp: string | null;
  facebook_url: string | null;
  instagram: string | null;
  address: string | null;
  logo_url: string | null;
  cover_url: string | null;
  images: string[];
  status: ShopStatus;
}

export interface ProduitGere {
  id: string;
  exhibitor_id: string;
  name: string;
  name_ar: string | null;
  price: number | null;
  compare_at_price: number | null;
  images: string[];
  is_available: boolean;
  position: number;
}

const jour = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Tout tient sur un écran, en trois niveaux repliés.
 *
 * Éditions → exposants → produits. Chaque niveau se déplie au toucher et un
 * seul à la fois : sur une exposition de quarante stands, tout ouvrir ferait
 * une page de plusieurs mètres où l'on ne retrouve rien. C'est le même
 * principe que l'arborescence d'un gestionnaire de fichiers, et personne n'a
 * besoin qu'on le lui explique.
 */
export function GestionLelma3ardh({
  expos,
  exposants,
  produits,
}: {
  expos: ExpoGeree[];
  exposants: ExposantGere[];
  produits: ProduitGere[];
}) {
  const [expoOuverte, setExpoOuverte] = useState<string | null>(expos[0]?.id ?? null);
  const [nouvelleExpo, setNouvelleExpo] = useState(false);

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      <div className="flex items-center justify-between">
        <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
          Éditions ({expos.length})
        </p>
        <button
          type="button"
          onClick={() => setNouvelleExpo((v) => !v)}
          className="text-[0.65625rem] font-bold text-[var(--color-brand)]"
        >
          {nouvelleExpo ? "Fermer" : "+ Nouvelle édition"}
        </button>
      </div>

      {nouvelleExpo && <FormulaireExpo onFini={() => setNouvelleExpo(false)} />}

      {expos.length === 0 && !nouvelleExpo && (
        <EmptyState
          title="Aucune édition"
          body="Créez une édition : un lieu, deux dates, puis ses exposants."
        />
      )}

      {expos.map((expo) => {
        const siens = exposants.filter((x) => x.expo_id === expo.id);
        const ouverte = expoOuverte === expo.id;

        return (
          <Card key={expo.id} className="flex flex-none flex-col gap-[10px] p-3">
            <button
              type="button"
              onClick={() => setExpoOuverte(ouverte ? null : expo.id)}
              className="flex items-center gap-2 text-start"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.78125rem] font-bold text-[var(--color-ink)]">
                  {expo.name}
                </span>
                <span className="block text-[0.625rem] text-[var(--color-muted)]">
                  {expo.starts_on} → {expo.ends_on}
                  {expo.place ? ` · ${expo.place}` : ""} · {siens.length} exposant
                  {siens.length > 1 ? "s" : ""}
                </span>
              </span>
              {!expo.is_published && <Tag>masquée</Tag>}
            </button>

            {ouverte && (
              <>
                <FormulaireExpo expo={expo} />
                <ListeExposants expoId={expo.id} exposants={siens} produits={produits} />
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Une édition ─────────────────────────────────────────────────────── */

function FormulaireExpo({ expo, onFini }: { expo?: ExpoGeree; onFini?: () => void }) {
  const router = useRouter();
  const [nom, setNom] = useState(expo?.name ?? "");
  const [nomAr, setNomAr] = useState(expo?.name_ar ?? "");
  const [lieu, setLieu] = useState(expo?.place ?? "");
  const [texte, setTexte] = useState(expo?.description ?? "");
  const [debut, setDebut] = useState(expo?.starts_on ?? jour(new Date()));
  const [fin, setFin] = useState(expo?.ends_on ?? jour(new Date(Date.now() + 3 * 86_400_000)));
  const [publiee, setPubliee] = useState(expo?.is_published ?? true);
  const [couverture, setCouverture] = useState<string[]>(expo?.cover_url ? [expo.cover_url] : []);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await enregistrerExpo({
        id: expo?.id,
        name: nom,
        nameAr: nomAr,
        description: texte,
        place: lieu,
        startsOn: debut,
        endsOn: fin,
        isPublished: publiee,
        coverUrl: couverture[0] ?? null,
      });
      if (r.ok) {
        onFini?.();
        router.refresh();
      } else setErreur(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-[var(--color-app)] p-[10px]">
      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Nom de l&apos;édition</span>
        <input value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Nom en arabe</span>
        <input
          value={nomAr}
          onChange={(e) => setNomAr(e.target.value.slice(0, 80))}
          dir="rtl"
          lang="ar"
          className={CHAMP}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Lieu</span>
        <input value={lieu} onChange={(e) => setLieu(e.target.value.slice(0, 120))} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Description</span>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value.slice(0, 500))}
          rows={2}
          className={cx(CHAMP, "resize-none")}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Début</span>
          <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Fin</span>
          <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={CHAMP} />
        </label>
      </div>

      {/*
        La photo de couverture : celle que montrent l'accueil et la page
        « Nos partenaires » sur la carte de l'édition en cours. Une seule
        suffit — c'est une vignette, pas une galerie.
      */}
      <Photos images={couverture} setImages={setCouverture} max={1} />

      <div className="flex items-center justify-between">
        <span className={ETIQ}>Visible du public</span>
        <Switch checked={publiee} onChange={setPubliee} label="Visible du public" />
      </div>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      <Button onClick={envoyer} disabled={pending}>
        {expo ? "Enregistrer" : "Créer l'édition"}
      </Button>
    </div>
  );
}

/* ─── Les exposants d'une édition ─────────────────────────────────────── */

function ListeExposants({
  expoId,
  exposants,
  produits,
}: {
  expoId: string;
  exposants: ExposantGere[];
  produits: ProduitGere[];
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.65625rem] font-bold text-[var(--color-ink)]">Exposants</span>
        <button
          type="button"
          onClick={() => setNouveau((v) => !v)}
          className="text-[0.625rem] font-bold text-[var(--color-brand)]"
        >
          {nouveau ? "Fermer" : "+ Exposant"}
        </button>
      </div>

      {nouveau && <FormulaireExposant expoId={expoId} onFini={() => setNouveau(false)} />}

      {exposants.map((x) => (
        <div key={x.id} className="rounded-[14px] border border-[var(--color-hairline)] p-[10px]">
          <button
            type="button"
            onClick={() => setOuvert(ouvert === x.id ? null : x.id)}
            className="flex w-full items-center gap-2 text-start"
          >
            <span className="min-w-0 flex-1 truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
              {x.name}
              {x.stand_no ? ` · stand ${x.stand_no}` : ""}
            </span>
            <Tag>{x.status === "approved" ? "publié" : x.status}</Tag>
          </button>

          {ouvert === x.id && (
            <div className="mt-2 flex flex-col gap-2">
              <FormulaireExposant expoId={expoId} exposant={x} />
              <ListeProduits
                exposantId={x.id}
                produits={produits.filter((p) => p.exhibitor_id === x.id)}
              />
              <Link
                href={`/lelma3ardh/${x.slug}`}
                className="text-center text-[0.625rem] font-bold text-[var(--color-brand)]"
              >
                Voir la page publique →
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FormulaireExposant({
  expoId,
  exposant,
  onFini,
}: {
  expoId: string;
  exposant?: ExposantGere;
  onFini?: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(exposant?.name ?? "");
  const [nomAr, setNomAr] = useState(exposant?.name_ar ?? "");
  const [texte, setTexte] = useState(exposant?.description ?? "");
  const [stand, setStand] = useState(exposant?.stand_no ?? "");
  const [tel, setTel] = useState(exposant?.phone ?? "");
  const [wa, setWa] = useState(exposant?.whatsapp ?? "");
  const [facebook, setFacebook] = useState(exposant?.facebook_url ?? "");
  const [instagram, setInstagram] = useState(exposant?.instagram ?? "");
  const [adresse, setAdresse] = useState(exposant?.address ?? "");
  const [images, setImages] = useState<string[]>(exposant?.images ?? []);
  const [statut, setStatut] = useState<ShopStatus>(exposant?.status ?? "pending");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await enregistrerExposant({
        id: exposant?.id,
        expoId,
        name: nom,
        nameAr: nomAr,
        description: texte,
        standNo: stand,
        phone: tel,
        whatsapp: wa,
        facebookUrl: facebook,
        instagram,
        address: adresse,
        images,
        coverUrl: images[0] ?? null,
        status: statut as "pending" | "approved" | "rejected" | "suspended",
      });
      if (r.ok) {
        onFini?.();
        router.refresh();
      } else setErreur(r.error);
    });
  }

  function retirer() {
    if (!exposant) return;
    startTransition(async () => {
      const r = await supprimerExposant(exposant.id);
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-[var(--color-app)] p-[10px]">
      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Nom en arabe</span>
        <input
          value={nomAr}
          onChange={(e) => setNomAr(e.target.value.slice(0, 80))}
          dir="rtl"
          lang="ar"
          className={CHAMP}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Description</span>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value.slice(0, 600))}
          rows={2}
          className={cx(CHAMP, "resize-none")}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Stand</span>
          <input value={stand} onChange={(e) => setStand(e.target.value.slice(0, 12))} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Téléphone</span>
          <input
            value={tel}
            onChange={(e) => setTel(e.target.value.slice(0, 20))}
            dir="ltr"
            inputMode="tel"
            className={CHAMP}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>WhatsApp</span>
          <input
            value={wa}
            onChange={(e) => setWa(e.target.value.slice(0, 20))}
            dir="ltr"
            inputMode="tel"
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Instagram</span>
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value.slice(0, 40))}
            dir="ltr"
            className={CHAMP}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Facebook (adresse)</span>
        <input
          value={facebook}
          onChange={(e) => setFacebook(e.target.value.slice(0, 200))}
          dir="ltr"
          type="url"
          className={CHAMP}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Adresse</span>
        <input
          value={adresse}
          onChange={(e) => setAdresse(e.target.value.slice(0, 160))}
          className={CHAMP}
        />
      </label>

      <Photos images={images} setImages={setImages} max={PHOTOS_EXPOSANT} />

      <div className="flex flex-wrap gap-[6px]">
        {(["pending", "approved", "suspended"] as const).map((s) => (
          <Chip key={s} active={statut === s} onClick={() => setStatut(s)}>
            {s === "pending" ? "En attente" : s === "approved" ? "Publié" : "Suspendu"}
          </Chip>
        ))}
      </div>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      <div className="flex gap-2">
        <Button onClick={envoyer} disabled={pending} className="flex-1">
          {exposant ? "Enregistrer" : "Créer l'exposant"}
        </Button>
        {exposant && (
          <Button onClick={retirer} disabled={pending}>
            Supprimer
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Les produits d'un exposant ──────────────────────────────────────── */

function ListeProduits({ exposantId, produits }: { exposantId: string; produits: ProduitGere[] }) {
  const [nouveau, setNouveau] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] font-bold text-[var(--color-ink)]">
          Produits ({produits.length})
        </span>
        <button
          type="button"
          onClick={() => setNouveau((v) => !v)}
          className="text-[0.625rem] font-bold text-[var(--color-brand)]"
        >
          {nouveau ? "Fermer" : "+ Produit"}
        </button>
      </div>

      {nouveau && <FormulaireProduit exposantId={exposantId} onFini={() => setNouveau(false)} />}

      {produits.map((p) => (
        <div key={p.id}>
          <button
            type="button"
            onClick={() => setOuvert(ouvert === p.id ? null : p.id)}
            className="flex w-full items-center gap-2 py-1 text-start"
          >
            <span className="min-w-0 flex-1 truncate text-[0.65625rem] text-[var(--color-ink)]">
              {p.name}
            </span>
            {p.price != null && (
              <span dir="ltr" className="text-[0.625rem] font-bold text-[#8a5a1f]">
                {p.price} DT
              </span>
            )}
          </button>
          {ouvert === p.id && <FormulaireProduit exposantId={exposantId} produit={p} />}
        </div>
      ))}
    </div>
  );
}

function FormulaireProduit({
  exposantId,
  produit,
  onFini,
}: {
  exposantId: string;
  produit?: ProduitGere;
  onFini?: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(produit?.name ?? "");
  const [nomAr, setNomAr] = useState(produit?.name_ar ?? "");
  const [prix, setPrix] = useState(produit?.price?.toString() ?? "");
  const [barre, setBarre] = useState(produit?.compare_at_price?.toString() ?? "");
  const [images, setImages] = useState<string[]>(produit?.images ?? []);
  const [dispo, setDispo] = useState(produit?.is_available ?? true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nombre = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await enregistrerProduitExpo({
        id: produit?.id,
        exhibitorId: exposantId,
        name: nom,
        nameAr: nomAr,
        price: nombre(prix),
        compareAtPrice: nombre(barre),
        images,
        isAvailable: dispo,
      });
      if (r.ok) {
        onFini?.();
        router.refresh();
      } else setErreur(r.error);
    });
  }

  function retirer() {
    if (!produit) return;
    startTransition(async () => {
      const r = await supprimerProduitExpo(produit.id);
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-[var(--color-surface-solid)] p-[10px]">
      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Nom du produit</span>
        <input value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Nom en arabe</span>
        <input
          value={nomAr}
          onChange={(e) => setNomAr(e.target.value.slice(0, 80))}
          dir="rtl"
          lang="ar"
          className={CHAMP}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Prix (DT)</span>
          <input
            value={prix}
            onChange={(e) => setPrix(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 9))}
            dir="ltr"
            inputMode="decimal"
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Prix barré</span>
          <input
            value={barre}
            onChange={(e) => setBarre(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 9))}
            dir="ltr"
            inputMode="decimal"
            className={CHAMP}
          />
        </label>
      </div>

      <Photos images={images} setImages={setImages} max={PHOTOS_PRODUIT} />

      <div className="flex items-center justify-between">
        <span className={ETIQ}>Disponible</span>
        <Switch checked={dispo} onChange={setDispo} label="Disponible" />
      </div>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      <div className="flex gap-2">
        <Button onClick={envoyer} disabled={pending} className="flex-1">
          {produit ? "Enregistrer" : "Ajouter"}
        </Button>
        {produit && (
          <Button onClick={retirer} disabled={pending}>
            Supprimer
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Les photos, avec leur plafond ───────────────────────────────────── */

function Photos({
  images,
  setImages,
  max,
}: {
  images: string[];
  setImages: (v: string[]) => void;
  max: number;
}) {
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
        Photos {images.length}/{max}
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
