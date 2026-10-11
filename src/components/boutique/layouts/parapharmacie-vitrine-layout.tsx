"use client";

import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import { normaliser, type ConfigVitrine } from "@/lib/boutique-vitrines";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { PackBoutique, ProduitBoutique } from "./types";
import { COULEUR_OK, HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { ParapharmacieLayout } from "./parapharmacie-layout";
import { FeuilleProduit, fondSansPhoto } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";

/** Le moment d'application déclaré (`moment` : « matin », « soir », « matin et soir »…). */
function momentsDe(p: ProduitBoutique): Array<"matin" | "soir"> {
  const m = normaliser(p.attributs?.moment ?? "");
  const out: Array<"matin" | "soir"> = [];
  if (/matin|jour|صباح|نهار/.test(m)) out.push("matin");
  if (/soir|nuit|مساء|ليل/.test(m)) out.push("soir");
  return out;
}

const ingredientsDe = (p: ProduitBoutique) =>
  (p.attributs?.ingredients ?? "")
    .split(/[,،;·]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

function Moments({ p, locale }: { p: ProduitBoutique; locale: AppLocale }) {
  const moments = momentsDe(p);
  if (moments.length === 0) return null;
  return (
    <span className="flex gap-1">
      {moments.map((m) => (
        <span
          key={m}
          className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold text-[var(--theme-texte)]"
          style={{ background: m === "matin" ? "#fff4d6" : "#e8e6f7" }}
        >
          {m === "matin" ? (locale === "ar" ? "☀ صباحا" : "☀ Matin") : locale === "ar" ? "☾ مساء" : "☾ Soir"}
        </span>
      ))}
    </span>
  );
}

/**
 * Parapharmacie — handoff « 04-parapharmacie » : tour de soin blanche,
 * filtre « نوع بشرتي », liste de soins (vignette ronde, moments ☀/☾,
 * ingrédients, jauge de compatibilité avec le type de peau choisi). Les
 * packs prêts et « Composez votre pack » restent ceux de la boutique
 * (`ParapharmacieLayout`, mode packs seuls).
 *
 * « بدون وصفة » : vrai par nature — une parapharmacie ne vend rien sur
 * ordonnance.
 */
export function ParapharmacieVitrineLayout({
  visible,
  locale,
  theme,
  vitrine,
  nomBoutique,
  packs,
  shopId,
  shopSlug,
  packTiers,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  vitrine: ConfigVitrine;
  nomBoutique: string;
  packs: PackBoutique[];
  shopId: string;
  shopSlug: string;
  packTiers: Array<{ min: number; pct: number }>;
}) {
  const ar = locale === "ar";
  const etat = useVitrine(visible, vitrine);
  const panier = useAjoutPanier();

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const peau = etat.optionChoisie;

  return (
    <div className="flex flex-col gap-[14px]">
      <HautDeVitrine
        vitrine={vitrine}
        produits={visible}
        etat={etat}
        nomBoutique={nomBoutique}
        locale={locale}
        noteDe={(p) => p.attributs?.besoin ?? p.attributs?.peau ?? null}
      />

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "منتجات العناية" : "Les soins"} · {visible.length}
      </span>

      <div className="flex flex-col gap-[10px]">
        {visible.map((p) => {
          const ok = etat.correspond(p);
          const ingredients = ingredientsDe(p);
          return (
            <article
              key={p.id}
              className="flex gap-3 rounded-[20px] bg-[var(--theme-surface,#fff)] p-3 shadow-[0_6px_18px_rgba(20,80,60,0.07)] transition-opacity duration-300"
              style={{ opacity: ok ? 1 : OPACITE_HORS_FILTRE }}
            >
              <button
                type="button"
                onClick={() => etat.ouvrir(p.id)}
                aria-label={p.name}
                className="relative h-16 w-16 flex-none overflow-hidden rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_color-mix(in_srgb,var(--theme-accent)_35%,#fff)]"
                style={{ background: p.images[0] ? "var(--theme-accent-doux)" : fondSansPhoto(p) }}
              >
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette ronde 64px
                  <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[0.75rem] font-black text-white">{p.name.split(/\s+/)[0]}</span>
                )}
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => etat.ouvrir(p.id)} className="min-w-0 text-start">
                    {p.attributs?.marque && (
                      <span className="block text-[0.625rem] font-bold tracking-[0.05em] text-[var(--theme-muted)] uppercase">
                        {p.attributs.marque}
                      </span>
                    )}
                    <span className="block text-[0.875rem] leading-[1.3] font-bold">{p.name}</span>
                  </button>
                  <span className="flex-none text-[0.875rem] font-extrabold text-[var(--theme-accent-fort)]">
                    {formatPrice(p.price, locale)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Moments p={p} locale={locale} />
                  {ingredients.map((i) => (
                    <span key={i} className="rounded-full bg-[var(--theme-accent-doux)] px-2 py-[2px] text-[0.6875rem] text-[var(--theme-accent-fort)]">
                      {i}
                    </span>
                  ))}
                </div>
                {peau && (
                  <span className="flex items-center gap-2">
                    <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--theme-muted)_18%,#fff)]">
                      <span
                        className="block h-full rounded-full transition-[width] duration-300"
                        style={{ width: ok ? "100%" : "30%", background: ok ? COULEUR_OK : "var(--theme-muted)" }}
                      />
                    </span>
                    <span className="flex-none text-[0.6875rem] font-bold" style={{ color: ok ? COULEUR_OK : "var(--theme-muted)" }}>
                      {ok ? (ar ? "مناسب لبشرتك" : "Adapté à votre peau") : ar ? "غير مخصّص لها" : "Pas conçu pour elle"}
                    </span>
                  </span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-[8px] border border-[var(--theme-bordure)] px-2 py-[1px] text-[0.625rem] font-bold text-[var(--theme-muted)]">
                    {ar ? "بدون وصفة" : "Sans ordonnance"}
                  </span>
                  <button
                    type="button"
                    onClick={() => panier.ajouter([{ productId: p.id }])}
                    disabled={panier.pending || p.stock <= 0}
                    aria-label={ar ? "أضف إلى السلة" : "Ajouter au panier"}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--theme-accent)] text-[1.125rem] font-bold text-[var(--theme-accent-texte)] disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <ParapharmacieLayout
        visible={visible}
        locale={locale}
        theme={theme}
        packs={packs}
        shopId={shopId}
        shopSlug={shopSlug}
        packTiers={packTiers}
        packsSeulement
      />

      <FeuilleProduit
        produit={etat.ouvert}
        locale={locale}
        onFermer={etat.fermer}
        pending={panier.pending}
        sousTitre={etat.ouvert?.attributs?.marque}
        onAjouter={(taille) => etat.ouvert && panier.ajouter([{ productId: etat.ouvert.id, size: taille }], etat.fermer)}
      >
        {etat.ouvert && (
          <>
            <Moments p={etat.ouvert} locale={locale} />
            {etat.ouvert.attributs?.ingredients && (
              <p className="text-[0.8125rem] leading-[1.5]">
                <b>{ar ? "المكوّنات : " : "Ingrédients : "}</b>
                {etat.ouvert.attributs.ingredients}
              </p>
            )}
            {(etat.ouvert.attributs?.peau || etat.ouvert.attributs?.besoin) && (
              <p className="text-[0.8125rem] text-[var(--theme-muted)]">
                {[etat.ouvert.attributs?.peau, etat.ouvert.attributs?.besoin].filter(Boolean).join(" · ")}
              </p>
            )}
          </>
        )}
      </FeuilleProduit>
      <ToastBoutique message={panier.message} />
    </div>
  );
}
