"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { formatPrice } from "@/lib/format";
import { addToCart } from "@/app/actions/cart";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

type Tri = "nouveautes" | "prix" | "promo";

/** Un glyphe simple par sous-catégorie réelle — jamais une icône de métier inventée. */
const ICONE_TYPE: Record<string, string> = {
  "mode-femme": "♀",
  "mode-homme": "♂",
  "mode-enfant": "◡",
  "mode-chaussures": "⟡",
  "mode-accessoires": "✦",
};

/** Une nouveauté affichée comme telle pendant 14 jours — pas plus, sinon le mot perd son sens. */
const JOURS_NOUVEAUTE = 14;

/**
 * « Vitrine éditoriale » — Mode.
 *
 * Le rayon de types (femme/homme/enfant/chaussures/accessoires) vient de la
 * vraie sous-catégorie de chaque produit — ces cinq familles sont déjà
 * sœurs sous « mode » dans `categories`. Une boutique qui n'a encore rangé
 * aucun produit dans une sous-catégorie précise n'affiche simplement pas
 * de rayon — la recherche et la grille fonctionnent quand même.
 *
 * Le filtre de taille vient de l'union réelle de `products.sizes` parmi
 * les articles visibles — jamais une liste XS-XXL figée qui proposerait
 * une taille que personne ne vend.
 *
 * Le lookbook reprend la photo de couverture de la boutique et épingle ses
 * 2-3 articles les plus vendus (déjà l'ordre de `visible`, voir la requête
 * de `page.tsx`) — pas de coordonnées saisies par le vendeur, donc des
 * repères à des positions fixes plutôt qu'une donnée inventée par article.
 * Absent sans photo de couverture ou avec un seul article.
 */
export function ModeLayout({
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
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [taille, setTaille] = useState<string | null>(null);
  const [tri, setTri] = useState<Tri>("nouveautes");
  const [feedback, setFeedback] = useState<string | null>(null);

  const types = useMemo(() => {
    const comptes = new Map<string, { label: string; count: number }>();
    for (const p of visible) {
      const slug = p.category?.slug;
      if (!slug) continue;
      const label = (locale === "ar" ? p.category?.name_ar : p.category?.name_fr) ?? slug;
      const entry = comptes.get(slug);
      if (entry) entry.count += 1;
      else comptes.set(slug, { label, count: 1 });
    }
    return [...comptes.entries()].map(([slug, v]) => ({ slug, ...v }));
  }, [visible, locale]);

  const tailles = useMemo(() => {
    const set = new Set<string>();
    for (const p of visible) for (const s of p.sizes ?? []) set.add(s);
    return [...set];
  }, [visible]);

  const normalise = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filtres = useMemo(() => {
    const q = normalise(query.trim());
    let liste = visible.filter((p) => {
      if (type && p.category?.slug !== type) return false;
      if (taille && !(p.sizes ?? []).includes(taille)) return false;
      if (q && !normalise(p.name).includes(q)) return false;
      return true;
    });
    liste = [...liste];
    if (tri === "prix") liste.sort((a, b) => a.price - b.price);
    else if (tri === "promo") liste.sort((a, b) => (b.compare_at_price ? 1 : 0) - (a.compare_at_price ? 1 : 0));
    else if (tri === "nouveautes") {
      liste.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    }
    return liste;
  }, [visible, type, taille, query, tri]);

  const lookbook = visible.slice(0, 3);
  const PINS = ["18%,24%", "58%,42%", "32%,66%"];

  function estNouveau(p: ProduitBoutique) {
    if (!p.created_at) return false;
    const jours = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
    return jours <= JOURS_NOUVEAUTE;
  }

  function ajouterLeLook() {
    setFeedback(null);
    startTransition(async () => {
      for (const p of lookbook) {
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

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-[8px] rounded-[16px] bg-[var(--theme-surface,var(--color-surface-solid))] px-[12px] shadow-[0_4px_14px_rgba(60,40,90,0.07)]">
        <span className="text-[0.875rem] text-[var(--theme-muted,var(--color-faint))]" aria-hidden>
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.common.searchProduct}
          className="min-w-0 flex-1 border-0 bg-transparent py-[12px] text-[0.75rem] text-[var(--theme-texte,var(--color-ink))] outline-none"
        />
      </div>

      {types.length > 1 && (
        <div className="flex flex-col gap-[8px]">
          <div className="flex items-baseline justify-between px-[2px]">
            <span className="text-[0.75rem] font-bold">{locale === "ar" ? "أقسام المتجر" : "Rayons de la boutique"}</span>
            <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
              {visible.length} {locale === "ar" ? "منتج" : "articles"}
            </span>
          </div>
          <div className="no-sb flex gap-[12px] overflow-x-auto pb-[2px]">
            <button type="button" onClick={() => setType(null)} className="flex flex-none flex-col items-center gap-[6px]">
              <span
                className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] text-[1.125rem]"
                style={{
                  background: type === null ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                  color: type === null ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                  boxShadow: type === null ? "0 0 0 2px var(--theme-surface,#fff), 0 0 0 4px var(--theme-accent)" : "none",
                }}
              >
                ✱
              </span>
              <span className="text-[0.625rem] font-bold whitespace-nowrap">
                {t.common.all} · {visible.length}
              </span>
            </button>
            {types.map((entry) => {
              const actif = entry.slug === type;
              return (
                <button
                  key={entry.slug}
                  type="button"
                  onClick={() => setType(actif ? null : entry.slug)}
                  className="flex flex-none flex-col items-center gap-[6px]"
                >
                  <span
                    className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] text-[1.125rem]"
                    style={{
                      background: actif ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                      color: actif ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                      boxShadow: actif ? "0 0 0 2px var(--theme-surface,#fff), 0 0 0 4px var(--theme-accent)" : "none",
                    }}
                  >
                    {ICONE_TYPE[entry.slug] ?? "•"}
                  </span>
                  <span className="max-w-[64px] truncate text-[0.625rem] font-bold whitespace-nowrap">
                    {entry.label} · {entry.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {couverture && lookbook.length > 1 && !query && !type && (
        <div
          className="relative h-[280px] overflow-hidden rounded-[var(--theme-rayon,28px)] bg-center bg-cover"
          style={{ backgroundImage: `url(${couverture})` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,20,0)_45%,rgba(20,20,20,0.55)_100%)]" />
          {lookbook.map((p, i) => {
            const [x, y] = PINS[i].split(",");
            return (
              <span
                key={p.id}
                className="absolute flex items-center gap-[6px] rounded-[14px] bg-[rgba(255,255,255,0.92)] py-[4px] pr-[10px] pl-[4px] shadow-[0_4px_10px_rgba(30,20,45,0.25)]"
                style={{ left: x, top: y }}
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--theme-accent,var(--color-brand-fill))] text-[0.625rem] font-bold text-[var(--theme-accent-texte,white)]">
                  +
                </span>
                <span className="text-[0.625rem] font-bold text-[var(--color-ink)]">
                  {p.name} {formatPrice(p.price, locale)}
                </span>
              </span>
            );
          })}
          <div className="absolute inset-x-[16px] bottom-[16px] flex items-end justify-between gap-2 text-white">
            <span className="flex flex-col">
              <span className="text-[0.625rem] font-semibold opacity-85">Lookbook</span>
              <span className="text-[1.375rem] font-bold">{theme.ambiance.nom}</span>
            </span>
            <button
              type="button"
              onClick={ajouterLeLook}
              disabled={pending}
              className="flex-none rounded-[16px] bg-white px-[14px] py-[8px] text-[0.6875rem] font-bold whitespace-nowrap text-[var(--color-ink)] disabled:opacity-60"
            >
              {pending
                ? t.common.saving
                : `${locale === "ar" ? "أضف الإطلالة" : "Tout le look"} · ${formatPrice(
                    lookbook.reduce((a, p) => a + p.price, 0),
                    locale,
                  )}`}
            </button>
          </div>
        </div>
      )}

      {feedback && <p className="text-center text-[0.6875rem] font-semibold text-[var(--theme-accent-fort)]">{feedback}</p>}

      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.75rem] font-bold">
            {query
              ? `« ${query.trim()} »`
              : type
                ? types.find((x) => x.slug === type)?.label
                : locale === "ar"
                  ? "كل المنتجات"
                  : "Tous les articles"}
          </span>
          <div className="flex gap-[4px]">
            {(
              [
                ["nouveautes", locale === "ar" ? "الأحدث" : "Nouveautés"],
                ["prix", locale === "ar" ? "السعر" : "Prix ↑"],
                ["promo", locale === "ar" ? "تخفيض" : "Promo"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTri(v)}
                className="flex-none rounded-[12px] px-[9px] py-[5px] text-[0.625rem] font-semibold whitespace-nowrap"
                style={{
                  background: tri === v ? "var(--theme-accent-doux)" : "transparent",
                  color: tri === v ? "var(--theme-accent-fort)" : "var(--theme-muted)",
                  border: `1px solid ${tri === v ? "var(--theme-accent)" : "var(--theme-bordure)"}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tailles.length > 0 && (
          <div className="flex gap-[6px]">
            {tailles.map((s) => {
              const actif = s === taille;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTaille(actif ? null : s)}
                  className="flex-1 rounded-[11px] py-[8px] text-center text-[0.6875rem] font-bold"
                  style={{
                    background: actif ? "var(--theme-accent)" : "transparent",
                    color: actif ? "var(--theme-accent-texte)" : "var(--theme-texte)",
                    border: `1px solid ${actif ? "var(--theme-accent)" : "var(--theme-bordure)"}`,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {filtres.length === 0 ? (
        <EmptyState title={format(t.search.noResults, { q: query.trim() })} />
      ) : (
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
          {filtres.map((product, i) => {
            const nouveau = estNouveau(product);
            const promo = Boolean(product.compare_at_price);
            return (
              <div key={product.id} className={i === 0 && filtres.length > 2 ? "col-span-2" : undefined}>
                <div className="relative">
                  {(nouveau || promo) && (
                    <span
                      className="absolute top-[10px] left-[10px] z-[1] rounded-[10px] px-[9px] py-[4px] text-[0.5625rem] font-bold text-white"
                      style={{ background: promo ? "var(--color-live-fill)" : "var(--theme-accent,var(--color-brand-fill))" }}
                    >
                      {promo ? (locale === "ar" ? "تخفيض" : "Promo") : locale === "ar" ? "جديد" : "Nouveau"}
                    </span>
                  )}
                  <ProductCard
                    product={{ ...product, shop: null }}
                    locale={locale}
                    showShop={false}
                    imageHeight={i === 0 && filtres.length > 2 ? 220 : 118}
                  />
                </div>
                <div className="flex flex-col gap-[1px] px-[4px]">
                  {product.sizes && product.sizes.length > 0 && (
                    <span className="text-[0.59375rem] text-[var(--theme-muted,var(--color-muted))]">
                      {product.sizes.join(" · ")}
                    </span>
                  )}
                  {product.category && (
                    <span
                      className="text-[0.5625rem] font-bold tracking-[0.04em] uppercase"
                      style={{ color: "var(--theme-accent-fort)" }}
                    >
                      {locale === "ar" ? product.category.name_ar : product.category.name_fr}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
