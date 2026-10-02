"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import { formatPrice } from "@/lib/format";
import { addToCart } from "@/app/actions/cart";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { PackBoutique, ProduitBoutique } from "./types";

/**
 * « Besoins & packs » — Parapharmacie.
 *
 * Les chips « besoin » viennent de l'attribut `besoin` (`product_attributes`,
 * Lot 10). Le rail de packs vient de `product_packs` — aucune boutique n'en
 * a créé tant qu'elle ne passe pas par l'écran vendeur dédié : le rail
 * reste alors simplement absent, pas un rail vide.
 *
 * Le pourcentage affiché sur un pack est indicatif ; le prix réellement
 * facturé est recalculé côté serveur au moment de l'ajout au panier (voir
 * le plan — jamais confiance à un montant composé côté client). Cette
 * mise en page ne fait qu'afficher `discount_percent`, elle ne calcule ni
 * ne facture rien.
 */
export function ParapharmacieLayout({
  visible,
  locale,
  theme,
  packs,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  packs: PackBoutique[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);

  const besoins = useMemo(() => {
    const comptes = new Map<string, number>();
    for (const p of visible) {
      const b = p.attributs?.besoin;
      if (!b) continue;
      comptes.set(b, (comptes.get(b) ?? 0) + 1);
    }
    return [...comptes.entries()];
  }, [visible]);

  const [besoinActif, setBesoinActif] = useState<string | null>(null);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const produits = besoinActif ? visible.filter((p) => p.attributs?.besoin === besoinActif) : visible;

  const choisis = produits.filter((p) => selection.includes(p.id));
  const sousTotal = choisis.reduce((a, p) => a + p.price, 0);
  const remise = choisis.length >= 3 ? 0.15 : choisis.length === 2 ? 0.1 : 0;

  function toggleChoix(id: string) {
    setSelection((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function ajouterLePack() {
    setFeedback(null);
    startTransition(async () => {
      for (const p of choisis) {
        const result = await addToCart({ productId: p.id });
        if (!result.ok) {
          if (result.error === "Authentification requise") {
            router.push(`/connexion?suite=/boutique/${window.location.pathname.split("/")[2]}`);
            return;
          }
          setFeedback(result.error);
          return;
        }
      }
      setFeedback(locale === "ar" ? "أُضيفت المنتجات — التخفيض يُطبّقه المتجر" : "Produits ajoutés — la remise sera appliquée par la boutique");
      setSelection([]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {besoins.length > 0 && (
        <div className="no-sb flex gap-[8px] overflow-x-auto pb-[2px]">
          {besoins.map(([besoin, count]) => {
            const on = besoin === besoinActif;
            return (
              <button
                key={besoin}
                type="button"
                onClick={() => setBesoinActif(on ? null : besoin)}
                className="flex-none rounded-[999px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
                style={{
                  background: on ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                  color: on ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                }}
              >
                {besoin} · {count}
              </button>
            );
          })}
        </div>
      )}

      {packs.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          <span className="px-[2px] text-[0.75rem] font-bold">{locale === "ar" ? "باقات" : "Packs"}</span>
          <div className="no-sb flex gap-[10px] overflow-x-auto pb-[4px]">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="flex w-[220px] flex-none flex-col gap-[6px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[12px] shadow-[var(--shadow-card)]"
              >
                <div className="relative flex h-[70px] gap-[4px]">
                  {pack.items.slice(0, 3).map((it) => (
                    <span
                      key={it.id}
                      className="flex-1 rounded-[12px] bg-[var(--color-workshop)]"
                      style={it.images[0] ? { backgroundImage: `url(${it.images[0]})`, backgroundSize: "cover" } : undefined}
                    />
                  ))}
                  <span className="absolute top-[4px] right-[4px] rounded-[10px] bg-[var(--theme-accent)] px-[7px] py-[3px] text-[0.59375rem] font-bold text-[var(--theme-accent-texte)]">
                    −{pack.discount_percent}%
                  </span>
                </div>
                <span className="text-[0.75rem] font-bold">{locale === "ar" && pack.name_ar ? pack.name_ar : pack.name}</span>
                <span className="text-[0.625rem] text-[var(--theme-muted)]">
                  {pack.items.map((it) => it.name).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {produits.length >= 2 && (
        <div className="flex flex-col gap-[10px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[13px]">
          <div className="flex flex-col gap-[2px]">
            <span className="text-[0.8125rem] font-bold">{locale === "ar" ? "كوّنوا باقتكم" : "Composez votre pack"}</span>
            <span className="text-[0.65625rem] text-[var(--theme-muted,var(--color-muted))]">
              {locale === "ar" ? "منتجان −10% · ثلاثة فأكثر −15%" : "2 produits −10 % · 3 produits et plus −15 %"}
            </span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-[3px] bg-[var(--theme-accent-doux)]">
            <div
              className="h-full rounded-[3px] bg-[var(--theme-accent,var(--color-brand-fill))]"
              style={{ width: `${Math.min(100, (choisis.length / 3) * 100)}%` }}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            {produits.map((p) => {
              const coche = selection.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleChoix(p.id)}
                  className="flex items-center gap-[10px] border-t border-[var(--theme-bordure)] py-[6px] text-start first:border-t-0"
                >
                  <span
                    className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border-2 text-[0.625rem] text-white"
                    style={{
                      borderColor: "var(--theme-accent)",
                      background: coche ? "var(--theme-accent,var(--color-brand-fill))" : "transparent",
                    }}
                  >
                    {coche ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.75rem] font-semibold">{p.name}</span>
                  <span className="flex-none text-[0.75rem] font-bold">{formatPrice(p.price, locale)}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={ajouterLePack}
            disabled={pending || choisis.length < 2}
            className="rounded-[16px] px-[16px] py-[12px] text-center text-[0.8125rem] font-semibold text-[var(--theme-accent-texte,white)] disabled:opacity-50"
            style={{ background: "var(--theme-accent,var(--color-brand-fill))" }}
          >
            {pending
              ? t.common.saving
              : choisis.length >= 2
                ? `${locale === "ar" ? "أضف الباقة" : "Ajouter mon pack"} · ${formatPrice(sousTotal * (1 - remise), locale)}`
                : locale === "ar"
                  ? "اختاروا منتجَين على الأقل"
                  : "Cochez au moins 2 produits"}
          </button>
          {feedback && <p className="text-center text-[0.6875rem] font-semibold text-[var(--theme-accent-fort)]">{feedback}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
        {produits.map((p) => (
          <ProductCard key={p.id} product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
        ))}
      </div>
    </div>
  );
}
