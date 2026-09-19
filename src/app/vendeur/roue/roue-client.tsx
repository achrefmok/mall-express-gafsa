"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  ajouterCase,
  enregistrerLot,
  enregistrerRoue,
  marquerLotRemis,
  supprimerLot,
} from "@/app/actions/roue";
import { uploadImage } from "@/lib/upload";
import { cx, formatPrice, timeAgo } from "@/lib/format";
import { Button, Card, Divider, EmptyState, KeyValueRow, Switch, Tag, fieldClass } from "@/components/ui/primitives";
import type { AppLocale } from "@/types/database";

const CHAMP = fieldClass({ size: "sm", solid: true });
const ETIQ = "text-[0.625rem] text-[var(--color-muted)]";

export interface RoueVendeurRow {
  id: string;
  title: string;
  title_ar: string | null;
  is_active: boolean;
  spins_per_day: number;
  ends_at: string | null;
}

export interface LotVendeur {
  id: string;
  label: string;
  label_ar: string | null;
  weight: number;
  is_win: boolean;
  stock: number | null;
  image_url: string | null;
  position: number;
}

export interface ProduitBoutique {
  id: string;
  name: string;
  price: number;
  images: string[];
}

export interface TourJoue {
  id: string;
  code: string;
  created_at: string;
  claimed_at: string | null;
  prize: { label: string; is_win: boolean } | null;
  joueur: { first_name: string | null; last_name: string | null; phone: string | null } | null;
}

/**
 * Composer sa roue.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Les poids, et la chance réelle affichée en clair
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un commerçant qui écrit « poids 1 » ne sait pas ce qu'il vient de promettre.
 * La colonne de droite traduit chaque poids en pourcentage de la somme : « 1 »
 * parmi « 40, 40, 1 » devient « 1,2 % », et il voit tout de suite s'il a mis
 * son gros lot à une chance sur deux.
 *
 * C'est le seul endroit où ces chiffres sont visibles : côté client, ni les
 * poids ni les stocks ne sortent de la base. Un joueur qui lit « une chance
 * sur mille » ne tente pas.
 */
export function RoueVendeur({
  roue,
  lots,
  tours,
  produits,
  locale,
}: {
  roue: RoueVendeurRow | null;
  lots: LotVendeur[];
  tours: TourJoue[];
  produits: ProduitBoutique[];
  locale: AppLocale;
}) {
  const router = useRouter();
  const [titre, setTitre] = useState(roue?.title ?? "Roue de la chance");
  const [active, setActive] = useState(roue?.is_active ?? true);
  const [parJour, setParJour] = useState(String(roue?.spins_per_day ?? 1));
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = lots.reduce((n, l) => n + (l.stock === 0 ? 0 : l.weight), 0);
  const chance = (l: LotVendeur) =>
    total === 0 || l.stock === 0 ? "0 %" : `${((l.weight / total) * 100).toFixed(1)} %`;

  function enregistrer() {
    setErreur(null);
    startTransition(async () => {
      const r = await enregistrerRoue({
        title: titre,
        isActive: active,
        spinsPerDay: Number(parJour) || 0,
      });
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      {/* ─── La roue ─────────────────────────────────────────────────── */}
      <Card className="flex flex-none flex-col gap-2 p-3">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Titre</span>
          <input value={titre} onChange={(e) => setTitre(e.target.value.slice(0, 60))} className={CHAMP} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Tours par personne et par jour (0 = sans limite)</span>
          <input
            value={parJour}
            onChange={(e) => setParJour(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            dir="ltr"
            className={CHAMP}
          />
        </label>

        <KeyValueRow label={<span className={ETIQ}>Roue ouverte</span>}>
          <Switch checked={active} onChange={setActive} label="Roue ouverte" />
        </KeyValueRow>

        {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

        <Button size="sm" block onClick={enregistrer} disabled={pending}>
          {roue ? "Enregistrer" : "Créer ma roue"}
        </Button>
      </Card>

      {!roue ? (
        <EmptyState
          title="Aucune roue"
          body="Créez la roue, puis ajoutez ses lots. Elle apparaîtra sur votre fiche et invitera les clients à venir."
        />
      ) : (
        <>
          {/* ─── Les lots ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
              Les lots ({lots.length})
            </p>
            {lots.length > 0 && (
              <span className={ETIQ}>
                {lots.filter((l) => !l.is_win).length === 0
                  ? "Aucune case perdante"
                  : `${lots.filter((l) => !l.is_win).length} case(s) perdante(s)`}
              </span>
            )}
          </div>

          {lots.length === 0 && (
            <p className="rounded-[12px] bg-[rgba(224,85,111,0.1)] px-3 py-2 text-[0.625rem] leading-[1.5] text-[var(--color-live)]">
              Une roue sans case perdante n&apos;est pas une roue : elle distribue. Prévoyez au
              moins une case « Perdu, retentez demain ».
            </p>
          )}

          {lots.map((lot) => (
            <FormulaireLot
              key={lot.id}
              wheelId={roue.id}
              lot={lot}
              chance={chance(lot)}
              onFini={() => router.refresh()}
            />
          ))}

          <Composeur
            wheelId={roue.id}
            position={lots.length}
            produits={produits}
            locale={locale}
            onFini={() => router.refresh()}
          />

          {/* ─── Les tours joués ─────────────────────────────────────── */}
          <p className="mt-2 text-[0.6875rem] font-bold text-[var(--color-ink)]">
            Derniers tours ({tours.length})
          </p>

          {tours.length === 0 ? (
            <EmptyState title="Personne n'a encore joué" body="Les gagnants apparaîtront ici." />
          ) : (
            tours.map((tour) => <LigneTour key={tour.id} tour={tour} locale={locale} />)
          )}
        </>
      )}
    </div>
  );
}

/**
 * Ajouter une case, en un geste.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Trois portes, parce qu'il y a trois intentions
 * ────────────────────────────────────────────────────────────────────────
 *
 * « J'offre un de mes articles », « je fais une remise », « il faut bien
 * perdre parfois ». Un formulaire unique obligeait à traduire chacune de
 * ces trois phrases en libellé, poids, stock et case à cocher — et la
 * plupart des commerçants abandonnaient avant la sixième case.
 *
 * Le produit choisi apporte son nom et sa photo : plus rien à taper, et le
 * lot correspond vraiment à quelque chose du catalogue. Il part à un
 * exemplaire — c'est ce qui fait que « trois articles » devient « deux
 * articles » dès le premier gagné, la case disparaissant de la roue.
 */
function Composeur({
  wheelId,
  position,
  produits,
  locale,
  onFini,
}: {
  wheelId: string;
  position: number;
  produits: ProduitBoutique[];
  locale: AppLocale;
  onFini: () => void;
}) {
  const [ouvert, setOuvert] = useState<"produit" | "remise" | "photo" | null>(null);
  const [libelle, setLibelle] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fichier = useRef<HTMLInputElement>(null);

  const poser = (args: Parameters<typeof ajouterCase>[0]) =>
    startTransition(async () => {
      setErreur(null);
      const r = await ajouterCase(args);
      if (r.ok) {
        setOuvert(null);
        setLibelle("");
        setPhoto(null);
        onFini();
      } else setErreur(r.error);
    });

  async function choisirPhoto(liste: FileList | null) {
    const f = liste?.[0];
    if (!f) return;
    setEnvoi(true);
    try {
      const { publicUrl } = await uploadImage("shop-assets", f);
      setPhoto(publicUrl);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Envoi impossible");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Card className="flex flex-none flex-col gap-2 border-dashed p-3">
      <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">Ajouter une case</p>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => setOuvert(ouvert === "produit" ? null : "produit")}>
          Un produit
        </Button>
        <Button size="sm" onClick={() => setOuvert(ouvert === "remise" ? null : "remise")}>
          Une remise
        </Button>
        <Button size="sm" onClick={() => setOuvert(ouvert === "photo" ? null : "photo")}>
          Une photo
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() => poser({ wheelId, kind: "perdu", position })}
        >
          Case perdante
        </Button>
      </div>

      {ouvert === "produit" && (
        produits.length === 0 ? (
          <p className={ETIQ}>Aucun produit en ligne à offrir.</p>
        ) : (
          <div className="no-sb max-h-56 overflow-y-auto rounded-[12px] border border-[var(--color-hairline)]">
            {produits.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() =>
                  poser({
                    wheelId,
                    kind: "produit",
                    position,
                    productId: p.id,
                    productName: p.name,
                    productImage: p.images[0] ?? null,
                  })
                }
                className="flex w-full items-center gap-2 px-2 py-2 text-start"
              >
                <span className="h-9 w-9 flex-none overflow-hidden rounded-[10px] bg-[var(--color-app)]">
                  {p.images[0] && (
                    /* eslint-disable-next-line @next/next/no-img-element -- vignette locale */
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-semibold text-[var(--color-ink)]">
                  {p.name}
                </span>
                <span dir="ltr" className="flex-none text-[0.65625rem] font-bold text-[var(--color-brand)]">
                  {formatPrice(p.price, locale)}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {ouvert === "remise" && (
        <div className="flex flex-wrap gap-2">
          {[5, 10, 15, 20, 30].map((pourcent) => (
            <button
              key={pourcent}
              type="button"
              disabled={pending}
              onClick={() => poser({ wheelId, kind: "remise", position, percent: pourcent })}
              className="rounded-full border border-[var(--color-outline)] px-3 py-[7px] text-[0.6875rem] font-bold text-[var(--color-ink)]"
            >
              −{pourcent} %
            </button>
          ))}
        </div>
      )}

      {ouvert === "photo" && (
        <div className="flex flex-col gap-2">
          <input
            value={libelle}
            onChange={(e) => setLibelle(e.target.value.slice(0, 40))}
            placeholder="Ce qu'on gagne — « Un café », « Un porte-clés »…"
            className={CHAMP}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fichier.current?.click()}
              disabled={envoi}
              className="h-14 w-14 flex-none rounded-[12px] border-[1.5px] border-dashed border-[var(--color-outline)] text-[var(--color-brand)]"
            >
              {envoi ? "…" : photo ? "✓" : "+"}
            </button>
            {photo && (
              /* eslint-disable-next-line @next/next/no-img-element -- vignette locale */
              <img src={photo} alt="" className="h-14 w-14 rounded-[12px] object-cover" />
            )}
            <input
              ref={fichier}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void choisirPhoto(e.target.files)}
            />
          </div>

          <Button
            size="sm"
            disabled={pending || envoi || !libelle.trim()}
            onClick={() => poser({ wheelId, kind: "photo", position, label: libelle, imageUrl: photo })}
          >
            Ajouter
          </Button>
        </div>
      )}

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}
    </Card>
  );
}

function FormulaireLot({
  wheelId,
  lot,
  chance,
  position,
  onFini,
}: {
  wheelId: string;
  lot?: LotVendeur;
  chance?: string;
  position?: number;
  onFini: () => void;
}) {
  const [libelle, setLibelle] = useState(lot?.label ?? "");
  const [poids, setPoids] = useState(String(lot?.weight ?? 10));
  const [gagnant, setGagnant] = useState(lot?.is_win ?? true);
  const [stock, setStock] = useState(lot?.stock == null ? "" : String(lot.stock));
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await enregistrerLot({
        id: lot?.id,
        wheelId,
        label: libelle,
        weight: Number(poids) || 0,
        isWin: gagnant,
        stock: stock.trim() === "" ? null : Number(stock),
        position: lot?.position ?? position ?? 0,
      });
      if (r.ok) {
        if (!lot) setLibelle("");
        onFini();
      } else setErreur(r.error);
    });
  }

  function retirer() {
    if (!lot) return;
    startTransition(async () => {
      const r = await supprimerLot(lot.id);
      if (r.ok) onFini();
      else setErreur(r.error);
    });
  }

  return (
    <Card className={cx("flex flex-none flex-col gap-2 p-3", !lot && "border-dashed")}>
      <div className="flex items-center gap-2">
        {lot?.image_url && (
          /* eslint-disable-next-line @next/next/no-img-element -- vignette locale */
          <img src={lot.image_url} alt="" className="h-9 w-9 flex-none rounded-[10px] object-cover" />
        )}
        <input
          value={libelle}
          onChange={(e) => setLibelle(e.target.value.slice(0, 40))}
          placeholder={lot ? "" : "Nouveau lot — « −10 % », « Un café »…"}
          className={cx(CHAMP, "flex-1")}
        />
        {chance && <Tag>{chance}</Tag>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Poids</span>
          <input
            value={poids}
            onChange={(e) => setPoids(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            dir="ltr"
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Stock (vide = illimité)</span>
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            dir="ltr"
            className={CHAMP}
          />
        </label>
      </div>

      <KeyValueRow label={<span className={ETIQ}>Case gagnante</span>}>
        <Switch checked={gagnant} onChange={setGagnant} label="Case gagnante" />
      </KeyValueRow>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={envoyer} disabled={pending || !libelle.trim()} className="flex-1">
          {lot ? "Enregistrer" : "Ajouter"}
        </Button>
        {lot && (
          <Button size="sm" onClick={retirer} disabled={pending}>
            Supprimer
          </Button>
        )}
      </div>
    </Card>
  );
}

function LigneTour({ tour, locale }: { tour: TourJoue; locale: AppLocale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const nom =
    [tour.joueur?.first_name, tour.joueur?.last_name].filter(Boolean).join(" ") || "Client";

  return (
    <Card className="flex flex-none flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
            {tour.prize?.label ?? "Lot retiré"}
          </p>
          <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
            {nom}
            {tour.joueur?.phone ? ` · ${tour.joueur.phone}` : ""} · {timeAgo(tour.created_at, locale)}
          </p>
        </div>
        <span dir="ltr" className="flex-none text-[0.75rem] font-extrabold tracking-[0.12em]">
          {tour.code}
        </span>
      </div>

      {tour.prize?.is_win && (
        <>
          <Divider />
          {tour.claimed_at ? (
            <p className="text-[0.625rem] text-[var(--color-muted)]">
              Remis · {timeAgo(tour.claimed_at, locale)}
            </p>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                startTransition(async () => {
                  const r = await marquerLotRemis(tour.id);
                  if (r.ok) router.refresh();
                })
              }
              disabled={pending}
            >
              Marquer remis
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
