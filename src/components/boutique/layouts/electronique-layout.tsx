"use client";

import { useMemo, useState } from "react";
import { EmptyState, Card } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import { formatPrice } from "@/lib/format";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

/** Les trois clés de specs attendues côté vendeur — voir le formulaire produit. */
const CLES_SPECS = ["stockage", "ecran", "batterie"] as const;
const VERSEMENTS = [1, 3, 6] as const;

/**
 * « Fiche technique » — Électronique.
 *
 * Les mini-stats et la marque viennent de `product_attributes` : un
 * produit qui n'en a aucune (le cas de toute boutique aujourd'hui, avant
 * que le vendeur les remplisse) reste une carte simple, sans case vide ni
 * tiret, et n'apparaît simplement dans aucun filtre de marque. Le
 * comparateur fonctionne quand même — comparer deux fiches sans specs
 * reste utile pour les photos et les prix.
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
          placeholder={locale === "ar" ? "الموديل، المرجع…" : "Modèle, référence…"}
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

      <div className="grid grid-cols-2 gap-x-[10px] gap-y-[18px]">
        {filtres.map((product) => {
          const specs = CLES_SPECS.map((cle) => product.attributs?.[cle]).filter(Boolean) as string[];
          const enComparaison = comparaison.includes(product.id);
          return (
            <div key={product.id} className="flex flex-col gap-[6px]">
              <ProductCard
                product={{ ...product, shop: null }}
                locale={locale}
                showShop={false}
                imageHeight={118}
              />
              {versements > 1 && (
                <p className="px-[4px] text-[0.8125rem] font-bold" style={{ color: "var(--theme-accent-fort)" }}>
                  {prixAffiche(product.price)}
                </p>
              )}
              {specs.length > 0 && (
                <div className="flex gap-[4px] px-[4px]">
                  {specs.map((v, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-[10px] bg-[var(--theme-accent-doux)] px-[6px] py-[4px] text-center text-[0.5625rem] font-bold text-[var(--theme-accent-fort)]"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => toggleComparaison(product.id)}
                className="mx-[4px] rounded-[10px] px-[8px] py-[6px] text-[0.625rem] font-bold"
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
              {CLES_SPECS.map((cle) => (
                <div
                  key={cle}
                  className="grid gap-[4px] border-t border-[var(--color-hairline)] p-[10px] text-[0.6875rem]"
                  style={{ gridTemplateColumns: `1.4fr repeat(${produitsComparés.length}, 1fr)` }}
                >
                  <span className="text-[var(--color-muted)]">{cle}</span>
                  {produitsComparés.map((p) => (
                    <span key={p.id}>{p.attributs?.[cle] ?? "—"}</span>
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
