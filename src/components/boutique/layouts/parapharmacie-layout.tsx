"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import { formatPrice } from "@/lib/format";
import { addToCart } from "@/app/actions/cart";
import { openConversation } from "@/app/actions/account";
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
 * Le pourcentage affiché, qu'il vienne d'un pack prêt ou de « Composez
 * votre pack », est toujours indicatif — `ajouterLePack`/`ajouterPackPret`
 * ajoutent les produits à leur prix plein, jamais un montant composé
 * calculé ici : la remise promise est honorée par la boutique au moment de
 * traiter la commande (voir le message affiché après l'ajout), jamais
 * appliquée automatiquement par du code qui tournerait côté client.
 */
export function ParapharmacieLayout({
  visible,
  locale,
  theme,
  packs,
  shopId,
  shopSlug,
  packTiers,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  packs: PackBoutique[];
  shopId: string;
  shopSlug: string;
  /** `shops.pack_tiers` — paliers triés du plus petit au plus grand. */
  packTiers: Array<{ min: number; pct: number }>;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contactPending, startContact] = useTransition();
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

  const marques = useMemo(() => {
    const vues = new Set<string>();
    const liste: string[] = [];
    for (const p of visible) {
      const m = p.attributs?.marque;
      if (!m || vues.has(m)) continue;
      vues.add(m);
      liste.push(m);
    }
    return liste;
  }, [visible]);

  const [besoinActif, setBesoinActif] = useState<string | null>(null);

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const produits = besoinActif ? visible.filter((p) => p.attributs?.besoin === besoinActif) : visible;
  const packsBesoin = besoinActif
    ? packs.filter((pack) => pack.items.some((it) => produits.some((p) => p.id === it.id)))
    : packs;

  const choisis = produits.filter((p) => selection.includes(p.id));
  const sousTotal = choisis.reduce((a, p) => a + p.price, 0);

  const paliers = [...packTiers].sort((a, b) => a.min - b.min);
  const palierAtteint = [...paliers].reverse().find((p) => choisis.length >= p.min) ?? null;
  const remise = (palierAtteint?.pct ?? 0) / 100;
  const prochainPalier = paliers.find((p) => p.min > choisis.length) ?? null;

  function toggleChoix(id: string) {
    setSelection((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function ajouterProduits(items: Array<{ id: string }>, surSucces: () => void) {
    setFeedback(null);
    startTransition(async () => {
      for (const it of items) {
        const result = await addToCart({ productId: it.id });
        if (!result.ok) {
          if (result.error === "Authentification requise") {
            router.push(`/connexion?suite=/boutique/${shopSlug}`);
            return;
          }
          setFeedback(result.error);
          return;
        }
      }
      surSucces();
      router.refresh();
    });
  }

  function ajouterLePack() {
    ajouterProduits(choisis, () => {
      setFeedback(locale === "ar" ? "أُضيفت المنتجات — التخفيض يُطبّقه المتجر" : "Produits ajoutés — la remise sera appliquée par la boutique");
      setSelection([]);
    });
  }

  function ajouterPackPret(pack: PackBoutique) {
    ajouterProduits(pack.items, () => {
      setFeedback(locale === "ar" ? "أُضيفت المنتجات — التخفيض يُطبّقه المتجر" : "Produits ajoutés — la remise sera appliquée par la boutique");
    });
  }

  function contacterVendeur() {
    startContact(async () => {
      const result = await openConversation(shopId);
      if (!result.ok) {
        router.push(`/connexion?suite=${encodeURIComponent(`/boutique/${shopSlug}`)}`);
        return;
      }
      router.push(`/messages/${result.data.id}`);
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

      {packsBesoin.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          <span className="px-[2px] text-[0.75rem] font-bold">
            {locale === "ar" ? "باقات جاهزة" : "Packs prêts"}
            {besoinActif ? ` · ${besoinActif}` : ""}
          </span>
          <div className="no-sb flex gap-[10px] overflow-x-auto pb-[4px]">
            {packsBesoin.map((pack) => {
              const prixInitial = pack.items.reduce((a, it) => a + it.price, 0);
              const prixRemise = prixInitial * (1 - pack.discount_percent / 100);
              return (
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
                  <span className="truncate text-[0.625rem] text-[var(--theme-muted)]">
                    {pack.items.map((it) => it.name).join(", ")}
                  </span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-[6px]">
                      <span className="text-[0.8125rem] font-bold text-[var(--theme-accent-fort)]">
                        {formatPrice(prixRemise, locale)}
                      </span>
                      <span className="text-[0.625rem] text-[var(--theme-muted)] line-through">
                        {formatPrice(prixInitial, locale)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => ajouterPackPret(pack)}
                      disabled={pending}
                      aria-label={locale === "ar" ? "أضيفوا الباقة" : "Ajouter le pack"}
                      className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[0.9375rem] font-bold text-[var(--theme-accent-texte,white)] disabled:opacity-50"
                      style={{ background: "var(--theme-accent,var(--color-brand-fill))" }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {paliers.length > 0 && produits.length >= paliers[0].min && (
        <div className="flex flex-col gap-[10px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[13px]">
          <div className="flex flex-col gap-[2px]">
            <span className="text-[0.8125rem] font-bold">{locale === "ar" ? "كوّنوا باقتكم" : "Composez votre pack"}</span>
            <span
              className="text-[0.65625rem] font-semibold"
              style={{ color: remise > 0 ? "var(--theme-accent-fort)" : "var(--theme-muted,var(--color-muted))" }}
            >
              {remise > 0
                ? `−${palierAtteint!.pct} % ${locale === "ar" ? "مطبّق" : "appliqué"}${
                    prochainPalier
                      ? locale === "ar"
                        ? ` · أضيفوا ${prochainPalier.min - choisis.length} منتجًا آخر لـ −${prochainPalier.pct}%`
                        : ` · encore ${prochainPalier.min - choisis.length} produit${prochainPalier.min - choisis.length > 1 ? "s" : ""} pour −${prochainPalier.pct} %`
                      : ""
                  }`
                : paliers.map((p) => `${p.min}+ −${p.pct}%`).join(" · ")}
            </span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-[3px] bg-[var(--theme-accent-doux)]">
            <div
              className="h-full rounded-[3px] bg-[var(--theme-accent,var(--color-brand-fill))]"
              style={{
                width: `${Math.min(100, (choisis.length / (paliers.at(-1)?.min ?? 3)) * 100)}%`,
              }}
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
                  <span className="min-w-0 flex-1">
                    {p.attributs?.marque && (
                      <span className="block text-[0.5625rem] font-bold tracking-wide text-[var(--theme-muted,var(--color-muted))] uppercase">
                        {p.attributs.marque}
                      </span>
                    )}
                    <span className="block truncate text-[0.75rem] font-semibold">{p.name}</span>
                  </span>
                  <span className="flex-none text-[0.75rem] font-bold">{formatPrice(p.price, locale)}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={ajouterLePack}
            disabled={pending || choisis.length < (paliers[0]?.min ?? 2)}
            className="rounded-[16px] px-[16px] py-[12px] text-center text-[0.8125rem] font-semibold text-[var(--theme-accent-texte,white)] disabled:opacity-50"
            style={{ background: "var(--theme-accent,var(--color-brand-fill))" }}
          >
            {pending
              ? t.common.saving
              : choisis.length >= (paliers[0]?.min ?? 2)
                ? `${locale === "ar" ? "أضف الباقة" : "Ajouter mon pack"} · ${formatPrice(sousTotal * (1 - remise), locale)}${
                    remise > 0
                      ? locale === "ar"
                        ? ` بدل ${formatPrice(sousTotal, locale)}`
                        : ` (au lieu de ${formatPrice(sousTotal, locale)})`
                      : ""
                  }`
                : locale === "ar"
                  ? `اختاروا ${paliers[0]?.min ?? 2} منتجات على الأقل`
                  : `Cochez au moins ${paliers[0]?.min ?? 2} produits`}
          </button>
          {feedback && <p className="text-center text-[0.6875rem] font-semibold text-[var(--theme-accent-fort)]">{feedback}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
        {produits.map((p) => (
          <ProductCard key={p.id} product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
        ))}
      </div>

      {marques.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          <span className="px-[2px] text-[0.75rem] font-bold">
            {locale === "ar" ? "علامات المتجر" : "Marques de la boutique"}
          </span>
          <div className="flex flex-wrap gap-[8px]">
            {marques.map((marque) => (
              <span
                key={marque}
                className="rounded-[12px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] px-[13px] py-[8px] text-[0.6875rem] font-semibold"
              >
                {marque}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-[10px] rounded-[16px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[12px]">
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[0.8125rem] font-bold text-[var(--theme-accent-texte)]"
          style={{ background: "var(--theme-accent)" }}
        >
          {locale === "ar" ? "؟" : "?"}
        </span>
        <p className="min-w-0 flex-1 text-[0.75rem] font-semibold">
          {locale === "ar" ? "شكّ حول منتج؟" : "Un doute sur un produit ?"}
        </p>
        <button
          type="button"
          onClick={contacterVendeur}
          disabled={contactPending}
          className="flex-none rounded-[14px] px-[13px] py-[8px] text-[0.6875rem] font-semibold text-[var(--theme-accent-texte,white)] disabled:opacity-60"
          style={{ background: "var(--theme-accent,var(--color-brand-fill))" }}
        >
          {locale === "ar" ? "اكتبوا" : "Écrire"}
        </button>
      </div>
    </div>
  );
}
