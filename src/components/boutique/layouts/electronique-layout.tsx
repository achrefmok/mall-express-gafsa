"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { EmptyState, Card, Placeholder } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { formatPrice } from "@/lib/format";
import { lienProduit } from "@/lib/product-url";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

/** Les trois clés de specs attendues côté vendeur — voir le formulaire produit. */
const CLES_SPECS = [
  { cle: "stockage", labelFr: "Stockage", labelAr: "التخزين" },
  { cle: "ecran", labelFr: "Écran", labelAr: "الشاشة" },
  { cle: "batterie", labelFr: "mAh", labelAr: "mAh" },
] as const;
const VERSEMENTS = [1, 3, 6] as const;

/**
 * « Fiche technique » — Électronique.
 *
 * Une fiche par ligne, pas une grille de photos : ici on compare des
 * chiffres (stockage, écran, batterie, garantie), pas une allure — la
 * photo reste une vignette, les specs prennent la place.
 *
 * Les mini-stats, la marque et la garantie viennent de `product_attributes` :
 * un produit qui n'en a aucune (le cas de toute boutique aujourd'hui, avant
 * que le vendeur les remplisse) reste une fiche simple, sans case vide ni
 * tiret. Le comparateur fonctionne quand même — comparer deux fiches sans
 * specs reste utile pour les photos et les prix.
 *
 * Le « payer en X fois » ne divise que l'affichage — aucun versement n'est
 * réellement proposé au paiement, c'est un repère de budget comme dans la
 * maquette, pas une fonctionnalité de paiement fractionné.
 */
export function ElectroniqueLayout({
  visible,
  locale,
  theme,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [marque, setMarque] = useState<string | null>(null);
  const [versements, setVersements] = useState<(typeof VERSEMENTS)[number]>(1);
  const [comparaison, setComparaison] = useState<string[]>([]);
  const [ouvert, setOuvert] = useState(false);

  const marques = useMemo(() => {
    const set = new Set<string>();
    for (const p of visible) if (p.attributs?.marque) set.add(p.attributs.marque);
    return [...set];
  }, [visible]);

  const normalise = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filtres = useMemo(() => {
    const q = normalise(query.trim());
    return visible.filter((p) => {
      if (marque && p.attributs?.marque !== marque) return false;
      if (q && !normalise(p.name).includes(q)) return false;
      return true;
    });
  }, [visible, marque, query]);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const toggleComparaison = (id: string) =>
    setComparaison((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));

  const produitsComparés = visible.filter((p) => comparaison.includes(p.id));
  const prixAffiche = (prix: number) =>
    versements === 1 ? formatPrice(prix, locale) : `${formatPrice(Math.round(prix / versements), locale)} /mois`;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-[8px] rounded-[16px] bg-[var(--theme-surface,var(--color-surface-solid))] px-[12px] shadow-[0_4px_14px_rgba(60,40,90,0.07)]">
        <span className="text-[0.875rem] text-[var(--theme-muted,var(--color-faint))]" aria-hidden>
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === "ar" ? "الموديل، المرجع…" : "Modèle, référence, marque…"}
          className="min-w-0 flex-1 border-0 bg-transparent py-[12px] text-[0.75rem] text-[var(--theme-texte,var(--color-ink))] outline-none"
        />
      </div>

      {marques.length > 0 && (
        <div className="no-sb flex gap-[8px] overflow-x-auto pb-[2px]">
          <button
            type="button"
            onClick={() => setMarque(null)}
            className="flex-none rounded-[14px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
            style={{
              background: marque === null ? "var(--theme-accent)" : "var(--theme-accent-doux)",
              color: marque === null ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
            }}
          >
            {t.common.all}
          </button>
          {marques.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMarque(m === marque ? null : m)}
              className="flex-none rounded-[14px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
              style={{
                background: m === marque ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                color: m === marque ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-[8px]">
        <span className="text-[0.6875rem] font-bold whitespace-nowrap">{locale === "ar" ? "ادفع على" : "Payer en"}</span>
        <div className="flex flex-1 gap-[4px] rounded-[16px] bg-[var(--theme-accent-doux)] p-[4px]">
          {VERSEMENTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVersements(v)}
              className="flex-1 rounded-[12px] py-[6px] text-center text-[0.6875rem] font-bold"
              style={{
                background: versements === v ? "var(--theme-surface,#fff)" : "transparent",
                color: versements === v ? "var(--theme-accent-fort)" : "var(--theme-muted)",
              }}
            >
              {v}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[10px]">
        {filtres.map((product) => {
          const specs = CLES_SPECS.map((c) => ({ ...c, valeur: product.attributs?.[c.cle] })).filter((c) => c.valeur);
          const enComparaison = comparaison.includes(product.id);
          const garantie = product.attributs?.garantie_mois;
          return (
            <div
              key={product.id}
              className="flex gap-[12px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[10px] shadow-[var(--shadow-card)]"
            >
              <Link href={lienProduit(product)} className="relative h-[88px] w-[72px] flex-none overflow-hidden rounded-[14px]">
                {product.images[0] ? (
                  <Image src={product.images[0]} alt="" fill sizes="72px" className="object-cover" />
                ) : (
                  <Placeholder label="produit" className="h-full w-full" />
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                <Link href={lienProduit(product)} className="truncate text-[0.8125rem] font-bold text-[var(--theme-texte,var(--color-ink))]">
                  {product.name}
                </Link>
                {specs.length > 0 && (
                  <div className="flex gap-[4px]">
                    {specs.map((s) => (
                      <span
                        key={s.cle}
                        className="flex flex-1 flex-col rounded-[10px] px-[6px] py-[4px] text-[0.5625rem]"
                        style={{ background: "var(--theme-accent-doux)", color: "var(--theme-muted)" }}
                      >
                        <b className="text-[0.6875rem]" style={{ color: "var(--theme-accent-fort)" }}>
                          {s.valeur}
                        </b>
                        {locale === "ar" ? s.labelAr : s.labelFr}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="flex flex-col">
                    <span className="text-[0.875rem] font-bold">{prixAffiche(product.price)}</span>
                    {garantie && (
                      <span className="text-[0.59375rem] text-[var(--theme-muted,var(--color-muted))]">
                        {locale === "ar" ? `ضمان ${garantie} شهر` : `Garantie ${garantie} mois`}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleComparaison(product.id)}
                    className="flex-none rounded-[12px] px-[10px] py-[6px] text-[0.625rem] font-bold whitespace-nowrap"
                    style={{
                      background: enComparaison ? "var(--theme-accent)" : "transparent",
                      color: enComparaison ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                      border: enComparaison ? "none" : "1px solid var(--theme-accent)",
                    }}
                  >
                    {enComparaison ? "✓ " : "+ "}
                    {t.product.compare}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-[10px]">
        <Card className="flex flex-col gap-[2px] p-3">
          <span className="text-[0.75rem] font-bold">{locale === "ar" ? "إصلاح" : "Réparation"}</span>
          <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "تشخيص مجاني خلال 30 د" : "Diagnostic gratuit en 30 min"}
          </span>
        </Card>
        <Card className="flex flex-col gap-[2px] p-3">
          <span className="text-[0.75rem] font-bold">{locale === "ar" ? "استرجاع" : "Reprise"}</span>
          <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "قيّموا جهازكم القديم" : "Estimez votre ancien appareil"}
          </span>
        </Card>
      </div>

      {comparaison.length > 0 && !ouvert && (
        <div className="fixed right-4 bottom-20 left-4 z-30 flex items-center justify-between rounded-[24px] bg-[var(--theme-accent)] px-[16px] py-[10px] text-[var(--theme-accent-texte)] shadow-[0_6px_18px_rgba(0,0,0,0.3)]">
          <span className="text-[0.75rem] font-bold">
            {comparaison.length} {t.product.selected}
          </span>
          <button type="button" onClick={() => setOuvert(true)} className="rounded-[14px] bg-white px-[14px] py-[7px] text-[0.6875rem] font-bold text-[var(--theme-accent)]">
            {t.product.compare}
          </button>
        </div>
      )}

      {ouvert && (
        <div className="fixed inset-0 z-40 flex items-end bg-[rgba(36,31,46,0.45)]" onClick={() => setOuvert(false)}>
          <div
            className="flex w-full flex-col gap-[12px] rounded-t-[28px] bg-[var(--color-app)] p-[16px_16px_28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[1rem] font-bold">{t.product.compare}</span>
              <button type="button" onClick={() => setOuvert(false)} className="text-[0.75rem] font-bold text-[var(--theme-accent-fort)]">
                {t.common.close}
              </button>
            </div>
            <div className="overflow-hidden rounded-[18px] bg-[var(--color-surface-solid)]">
              <div
                className="grid gap-[4px] bg-[var(--theme-accent-doux)] p-[10px] text-[0.625rem] text-[var(--theme-muted)]"
                style={{ gridTemplateColumns: `1.4fr repeat(${produitsComparés.length}, 1fr)` }}
              >
                <span />
                {produitsComparés.map((p) => (
                  <span key={p.id} className="truncate font-bold">
                    {p.name}
                  </span>
                ))}
              </div>
              {CLES_SPECS.map((c) => (
                <div
                  key={c.cle}
                  className="grid gap-[4px] border-t border-[var(--color-hairline)] p-[10px] text-[0.6875rem]"
                  style={{ gridTemplateColumns: `1.4fr repeat(${produitsComparés.length}, 1fr)` }}
                >
                  <span className="text-[var(--color-muted)]">{locale === "ar" ? c.labelAr : c.labelFr}</span>
                  {produitsComparés.map((p) => (
                    <span key={p.id}>{p.attributs?.[c.cle] ?? "—"}</span>
                  ))}
                </div>
              ))}
              <div
                className="grid gap-[4px] border-t border-[var(--color-hairline)] p-[10px] text-[0.6875rem] font-bold"
                style={{ gridTemplateColumns: `1.4fr repeat(${produitsComparés.length}, 1fr)` }}
              >
                <span className="font-normal text-[var(--color-muted)]">{t.product.price}</span>
                {produitsComparés.map((p) => (
                  <span key={p.id} style={{ color: "var(--theme-accent-fort)" }}>
                    {formatPrice(p.price, locale)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
