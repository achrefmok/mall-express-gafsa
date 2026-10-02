"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard, type ProductCardData } from "@/components/cards/product-card";
import { Card } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { formatPrice } from "@/lib/format";
import { addToCart } from "@/app/actions/cart";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

/**
 * « Par pièce » — Maison.
 *
 * Les chips de pièce viennent de l'attribut `piece` (`product_attributes`),
 * jamais d'une liste figée : seules les valeurs réellement déclarées par
 * cette boutique apparaissent. Aucun produit n'a encore de `piece` — grille
 * simple, sans rail vide, et la photo d'ambiance ne s'affiche pas non plus
 * tant qu'aucune pièce n'est active.
 */
export function MaisonLayout({
  visible,
  locale,
  theme,
  couverture,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  couverture: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const pieces = useMemo(() => {
    const comptes = new Map<string, number>();
    for (const p of visible) {
      const piece = p.attributs?.piece;
      if (!piece) continue;
      comptes.set(piece, (comptes.get(piece) ?? 0) + 1);
    }
    return [...comptes.entries()];
  }, [visible]);

  const [pieceActive, setPieceActive] = useState<string | null>(pieces[0]?.[0] ?? null);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const produits = pieceActive ? visible.filter((p) => p.attributs?.piece === pieceActive) : visible;
  const PINS = ["30%,42%", "66%,60%"];

  function ajouterLaPiece() {
    setFeedback(null);
    startTransition(async () => {
      for (const p of produits) {
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
      setFeedback(t.product.added);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {pieces.length > 0 && (
        <div className="no-sb flex gap-[8px] overflow-x-auto pb-[2px]">
          {pieces.map(([piece, count]) => {
            const on = piece === pieceActive;
            return (
              <button
                key={piece}
                type="button"
                onClick={() => setPieceActive(on ? null : piece)}
                className="flex-none rounded-[14px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
                style={{
                  background: on ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                  color: on ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                }}
              >
                {piece} · {count}
              </button>
            );
          })}
        </div>
      )}

      {couverture && pieceActive && produits.length > 0 && (
        <div
          className="relative h-[200px] overflow-hidden rounded-[var(--theme-rayon,22px)] bg-center bg-cover"
          style={{ backgroundImage: `url(${couverture})` }}
        >
          {produits.slice(0, 2).map((p, i) => (
            <span
              key={p.id}
              className="absolute flex h-[24px] w-[24px] items-center justify-center rounded-full bg-white text-[0.6875rem] font-bold text-[var(--theme-accent-fort)] shadow-[0_4px_10px_rgba(30,20,45,0.3)]"
              style={{ left: PINS[i].split(",")[0], top: PINS[i].split(",")[1] }}
            >
              {i + 1}
            </span>
          ))}
          <span className="absolute bottom-[12px] left-[12px] rounded-[12px] bg-[rgba(255,255,255,0.88)] px-[11px] py-[5px] text-[0.6875rem] font-bold">
            {locale === "ar" ? "أجواء" : "Ambiance"} {pieceActive} · {produits.length}{" "}
            {locale === "ar" ? "قطع" : "articles"}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
        {produits.map((p) => {
          const legende = [p.attributs?.dimensions, p.attributs?.materiau].filter(Boolean).join(" · ");
          return (
            <div key={p.id} className="flex flex-col gap-[2px]">
              <ProductCard product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
              {legende && (
                <p className="px-[4px] text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">{legende}</p>
              )}
            </div>
          );
        })}
      </div>

      {pieceActive && produits.length > 1 && (
        <button
          type="button"
          onClick={ajouterLaPiece}
          disabled={pending}
          className="rounded-[16px] bg-[var(--theme-accent,var(--color-brand-fill))] px-[16px] py-[12px] text-center text-[0.8125rem] font-semibold text-[var(--theme-accent-texte,white)] shadow-[0_8px_18px_rgba(109,75,143,0.26)] disabled:opacity-60"
        >
          {pending
            ? t.common.saving
            : `${locale === "ar" ? "أضف أجواء" : "Ajouter l'ambiance"} ${pieceActive} · ${formatPrice(
                produits.reduce((a: number, p: ProductCardData) => a + p.price, 0),
                locale,
              )}`}
        </button>
      )}

      {feedback && <p className="text-center text-[0.6875rem] font-semibold text-[var(--theme-accent-fort)]">{feedback}</p>}

      <div className="grid grid-cols-2 gap-[10px]">
        <Card className="flex flex-col gap-[2px] p-3">
          <span className="text-[0.75rem] font-bold">{locale === "ar" ? "التوصيل والتركيب" : "Livraison + montage"}</span>
          <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "قفصة المدينة، خلال 48 سا" : "Gafsa ville, sous 48 h"}
          </span>
        </Card>
        <Card className="flex flex-col gap-[2px] p-3">
          <span className="text-[0.75rem] font-bold">{locale === "ar" ? "مقاس خاص" : "Sur mesure"}</span>
          <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "أرسلوا قياساتكم" : "Envoyez vos dimensions"}
          </span>
        </Card>
      </div>
    </div>
  );
}
