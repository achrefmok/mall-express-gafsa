"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { basculerOffre, enregistrerOffre, retirerOffre } from "@/app/actions/black-friday";
import { formatPrice } from "@/lib/format";
import { pourcentageReduction, statutOffre, type StatutOffre } from "@/lib/black-friday";
import type { AppLocale } from "@/types/database";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";

export interface ProduitBoutique {
  id: string;
  nom: string;
  prix: number;
  stock: number;
  image: string | null;
  visible: boolean;
}

export interface OffreBoutique {
  id: string;
  produitId: string;
  prixBf: number;
  active: boolean;
  moderee: boolean;
  noteModeration: string | null;
  partages: number;
}

type CleStatut = "statusPreparation" | "statusScheduled" | "statusActive" | "statusEnded" | "statusModerated";

const STATUTS: Record<StatutOffre, { libelle: CleStatut; classe: string }> = {
  preparation: { libelle: "statusPreparation", classe: "bg-[var(--color-field)] text-[var(--color-muted)]" },
  programme: { libelle: "statusScheduled", classe: "bg-[var(--color-brand-tint)] text-[var(--color-brand)]" },
  actif: { libelle: "statusActive", classe: "bg-[#dcefe5] text-[#1c6244]" },
  termine: { libelle: "statusEnded", classe: "bg-[var(--color-field)] text-[var(--color-faint)]" },
  modere: { libelle: "statusModerated", classe: "bg-[var(--color-live-tint)] text-[var(--color-live)]" },
};

type Filtre = "tous" | "selection";

/**
 * Choisir ses produits, fixer ses prix.
 *
 * Une ligne par produit, et tout se règle sur place : le prix, la réduction
 * qui en découle, l'activation. Pas de fenêtre à ouvrir par produit — un
 * commerçant qui met vingt articles au Black Friday ne doit pas faire
 * quarante allers-retours.
 *
 * La réduction affichée se calcule à la frappe, avec la même fonction que
 * celle de l'accueil : ce que le commerçant lit ici est exactement ce que le
 * client lira.
 */
export function GestionBlackFriday({
  produits,
  offres,
  phase,
  locale,
}: {
  produits: ProduitBoutique[];
  offres: OffreBoutique[];
  phase: "avant" | "actif" | "termine";
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const [filtre, setFiltre] = useState<Filtre>(offres.length > 0 ? "selection" : "tous");
  const [recherche, setRecherche] = useState("");

  const parProduit = useMemo(() => new Map(offres.map((o) => [o.produitId, o])), [offres]);
  const verrouille = phase === "termine";

  const visibles = produits.filter((p) => {
    if (filtre === "selection" && !parProduit.has(p.id)) return false;
    if (recherche.trim() && !p.nom.toLowerCase().includes(recherche.trim().toLowerCase())) return false;
    return true;
  });

  const nbActives = offres.filter((o) => o.active && !o.moderee).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Chiffre valeur={offres.length} libelle={t.bfVendor.chosen} />
        <Chiffre valeur={nbActives} libelle={phase === "actif" ? t.bfVendor.online : t.bfVendor.enabled} />
        <Chiffre valeur={offres.reduce((n, o) => n + o.partages, 0)} libelle={t.bfVendor.shares} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-1 rounded-full bg-[var(--color-field)] p-1" role="tablist">
          {(
            [
              ["selection", format(t.bfVendor.mySelection, { n: offres.length })],
              ["tous", format(t.bfVendor.allProducts, { n: produits.length })],
            ] as const
          ).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={filtre === cle}
              onClick={() => setFiltre(cle)}
              className={`min-h-10 flex-1 rounded-full text-[0.71875rem] font-bold transition-colors ${
                filtre === cle
                  ? "bg-[var(--color-surface-solid)] text-[var(--color-ink)] shadow-[0_1px_4px_rgba(20,14,26,0.1)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>

        {filtre === "tous" && produits.length > 6 && (
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t.common.searchProduct}
            aria-label={t.common.searchProduct}
            className="min-h-11 rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-4 text-[0.8125rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]"
          />
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-[var(--color-outline)] p-5 text-center text-[0.8125rem] text-[var(--color-muted)]">
          {filtre === "selection"
            ? verrouille
              ? t.bfVendor.noneEnded
              : t.bfVendor.noneSelected
            : t.bfVendor.noMatch}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((p) => (
            <LigneProduit
              key={p.id}
              produit={p}
              offre={parProduit.get(p.id) ?? null}
              phase={phase}
              verrouille={verrouille}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function LigneProduit({
  produit,
  offre,
  phase,
  verrouille,
  locale,
}: {
  produit: ProduitBoutique;
  offre: OffreBoutique | null;
  phase: "avant" | "actif" | "termine";
  verrouille: boolean;
  locale: AppLocale;
}) {
  const { t } = useI18n();
  const [saisie, setSaisie] = useState(offre ? String(offre.prixBf) : "");
  const [active, setActive] = useState(offre?.active ?? true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [pending, startTransition] = useTransition();

  const prix = Number(saisie.replace(",", "."));
  const reduction = saisie.trim() ? pourcentageReduction(produit.prix, prix) : null;
  const prixValide = saisie.trim() !== "" && Number.isFinite(prix) && prix > 0 && prix < produit.prix;

  const statut = offre ? statutOffre({ active: offre.active, moderee: offre.moderee }, phase) : null;
  const modifie = offre ? prix !== offre.prixBf || active !== offre.active : saisie.trim() !== "";

  function enregistrer() {
    setErreur(null);
    startTransition(async () => {
      const r = await enregistrerOffre({ productId: produit.id, prixBf: prix, active });
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      setEnregistre(true);
      window.setTimeout(() => setEnregistre(false), 1800);
    });
  }

  function basculer(valeur: boolean) {
    setActive(valeur);
    if (!offre) return;
    setErreur(null);
    startTransition(async () => {
      const r = await basculerOffre(offre.id, valeur);
      if (!r.ok) {
        setErreur(r.error);
        setActive(!valeur);
      }
    });
  }

  function retirer() {
    if (!offre) return;
    setErreur(null);
    startTransition(async () => {
      const r = await retirerOffre(offre.id);
      if (!r.ok) setErreur(r.error);
    });
  }

  return (
    <li className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 flex-none overflow-hidden rounded-[12px] bg-[var(--color-track)]">
          {produit.image && (
            <Image src={produit.image} alt="" fill sizes="56px" className="object-cover" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-[0.8125rem] leading-[1.25] font-bold text-[var(--color-ink)]">
              {produit.nom}
            </p>
            {statut && (
              <span className={`flex-none rounded-full px-2 py-[3px] text-[0.59375rem] font-bold ${STATUTS[statut].classe}`}>
                {t.bfVendor[STATUTS[statut].libelle]}
              </span>
            )}
          </div>
          <p className="mt-[2px] text-[0.6875rem] text-[var(--color-muted)]">
            {format(t.bfVendor.normalPrice, { price: formatPrice(produit.prix, locale), stock: produit.stock })}
            {!produit.visible && t.bfVendor.offline}
          </p>
        </div>
      </div>

      {offre?.moderee && offre.noteModeration && (
        <p className="mt-2 rounded-[10px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.6875rem] text-[var(--color-live)]">
          {offre.noteModeration}
        </p>
      )}

      <div className="mt-3 flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[0.625rem] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
            {t.bfVendor.bfPrice}
          </span>
          <span className="flex min-h-11 items-center rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 focus-within:border-[var(--color-brand)]">
            <input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value.replace(/[^0-9.,]/g, ""))}
              inputMode="decimal"
              disabled={verrouille || offre?.moderee}
              placeholder="—"
              className="min-w-0 flex-1 bg-transparent text-[0.9375rem] font-bold text-[var(--color-ink)] outline-none disabled:opacity-60"
            />
            <span className="flex-none text-[0.6875rem] font-semibold text-[var(--color-muted)]">DT</span>
          </span>
        </label>

        {/* La réduction, calculée à la frappe : ce que le client lira. */}
        <span
          className={`flex min-h-11 w-[64px] flex-none items-center justify-center rounded-[12px] text-[0.9375rem] font-extrabold ${
            reduction !== null ? "bg-[#111] text-white" : "bg-[var(--color-field)] text-[var(--color-faint)]"
          }`}
          aria-label={reduction !== null ? format(t.bfVendor.discountAria, { n: reduction }) : t.bfVendor.noDiscount}
        >
          <span dir="ltr">{reduction !== null ? `−${reduction}%` : "—"}</span>
        </span>
      </div>

      {saisie.trim() !== "" && !prixValide && (
        <p className="mt-1 text-[0.6875rem] font-medium text-[var(--color-live)]">
          {format(t.bfVendor.mustBeLower, { price: formatPrice(produit.prix, locale) })}
        </p>
      )}

      {!verrouille && !offre?.moderee && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[0.75rem] font-semibold text-[var(--color-ink)]">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => basculer(e.target.checked)}
              disabled={pending}
              className="h-5 w-5 accent-[var(--color-brand)]"
            />
            {phase === "actif" ? t.bfVendor.onlineNow : t.bfVendor.enableForDay}
          </label>

          <div className="flex gap-2">
            {offre && (
              <button
                type="button"
                onClick={retirer}
                disabled={pending}
                className="min-h-11 rounded-[12px] px-3 text-[0.75rem] font-semibold text-[var(--color-live)] disabled:opacity-50"
              >
                {t.bfVendor.remove}
              </button>
            )}
            <button
              type="button"
              onClick={enregistrer}
              disabled={pending || !prixValide || (!modifie && !enregistre)}
              className="min-h-11 rounded-[12px] bg-[var(--color-brand-fill)] px-4 text-[0.75rem] font-bold text-white disabled:opacity-40"
            >
              {pending ? "…" : enregistre ? t.bfVendor.savedShort : offre ? t.bfVendor.update : t.bfVendor.add}
            </button>
          </div>
        </div>
      )}

      {erreur && (
        <p role="alert" className="mt-2 text-[0.71875rem] font-medium text-[var(--color-live)]">
          {erreur}
        </p>
      )}
    </li>
  );
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="flex flex-col items-center gap-[2px] rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-3">
      <span className="text-[1.25rem] font-extrabold tabular-nums text-[var(--color-ink)]">{valeur}</span>
      <span className="text-center text-[0.59375rem] leading-tight font-semibold text-[var(--color-muted)]">
        {libelle}
      </span>
    </div>
  );
}
