"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { formatPrice } from "@/lib/format";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { ConfigVitrine } from "@/lib/boutique-vitrines";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { COULEUR_PROMO, HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { FeuilleProduit, fondSansPhoto } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";

type Tri = "nouveautes" | "prix" | "promo";

/** Les trois genres réels — seuls ceux qui ont des articles deviennent un onglet. */
const GENRES = [
  { slug: "mode-femme", labelFr: "Femme", labelAr: "نساء" },
  { slug: "mode-homme", labelFr: "Homme", labelAr: "رجال" },
  { slug: "mode-enfant", labelFr: "Enfant", labelAr: "أطفال" },
] as const;

/** Chaussures et accessoires n'ont pas de genre dans ce schéma — visibles sous chaque onglet. */
const CATEGORIES_TRANSVERSALES = ["mode-chaussures", "mode-accessoires"];

/** Un glyphe par type de vêtement — mêmes intitulés que les suggestions du formulaire vendeur. */
const ICONE_PAR_TYPE: Record<string, string> = {
  Robes: "◇",
  Pulls: "▤",
  Chaussures: "⟡",
  Pantalons: "∥",
  Vestes: "⌂",
  Chemises: "▽",
  Sacs: "◒",
  "T-shirts": "⊤",
  Accessoires: "✦",
};

/** Une nouveauté affichée comme telle pendant 14 jours — pas plus, sinon le mot perd son sens. */
const JOURS_NOUVEAUTE = 14;

const normalise = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const typeDe = (p: ProduitBoutique) =>
  p.attributs?.type ||
  (p.category?.slug === "mode-chaussures" ? "Chaussures" : p.category?.slug === "mode-accessoires" ? "Accessoires" : null);

function estNouveau(p: ProduitBoutique) {
  if (!p.created_at) return false;
  return (Date.now() - new Date(p.created_at).getTime()) / 86_400_000 <= JOURS_NOUVEAUTE;
}

/**
 * Mode — handoff « 01-mode » : portant doré 360° à cintres, carte des
 * rayons sous le portant (à la place de la plaque « في الواجهة الآن »),
 * filtre « مقاسي » qui éteint les pièces indisponibles, puis le catalogue
 * lookbook en deux colonnes.
 *
 * Navigation à deux niveaux conservée : le genre (Femme/Homme/Enfant, un
 * onglet par genre réellement présent), puis le rayon — l'attribut `type`
 * saisi par le vendeur, ou la catégorie pour Chaussures/Accessoires. Un
 * article sans `type` reste dans « Tout », jamais dans un rayon inventé.
 */
export function ModeLayout({
  visible,
  locale,
  theme,
  vitrine,
  nomBoutique,
  couverture,
  lookbook: lookbookPose,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  vitrine: ConfigVitrine;
  nomBoutique: string;
  couverture: string | null;
  /** Repères posés par le vendeur (`/vendeur/vitrine`) — `null` = pas encore posés. */
  lookbook: { imageUrl: string; reperes: Array<{ id: string; productId: string | null; x: number; y: number }> } | null;
}) {
  const { t } = useI18n();
  const panier = useAjoutPanier();
  const [query, setQuery] = useState("");
  const [rayon, setRayon] = useState<string | null>(null);
  const [tri, setTri] = useState<Tri>("nouveautes");
  const [favoris, setFavoris] = useState<Record<string, boolean>>({});

  const genresPresents = useMemo(
    () => GENRES.filter((g) => visible.some((p) => p.category?.slug === g.slug)),
    [visible],
  );
  const [genreActif, setGenreActif] = useState<string | null>(null);
  const genre = genreActif ?? genresPresents[0]?.slug ?? null;

  const base = useMemo(() => {
    if (!genre) return visible;
    return visible.filter((p) => p.category?.slug === genre || CATEGORIES_TRANSVERSALES.includes(p.category?.slug ?? ""));
  }, [visible, genre]);

  const etat = useVitrine(base, vitrine);

  const rayons = useMemo(() => {
    const comptes = new Map<string, number>();
    for (const p of base) {
      const label = typeDe(p);
      if (label) comptes.set(label, (comptes.get(label) ?? 0) + 1);
    }
    return [...comptes.entries()];
  }, [base]);

  /*
    Une vraie photo plutôt qu'un glyphe quand le rayon en a une — le premier
    produit du rayon qui a déjà une image, jamais une photo inventée.
  */
  const imageParRayon = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of base) {
      const label = typeDe(p);
      if (!label || m.has(label) || !p.images?.[0]) continue;
      m.set(label, p.images[0]);
    }
    return m;
  }, [base]);

  const q = normalise(query.trim());
  /* Rayon et recherche retirent du catalogue ; la taille, elle, éteint (handoff). */
  const dansLaSelection = (p: ProduitBoutique) =>
    (!rayon || typeDe(p) === rayon) && (!q || normalise(p.name).includes(q));

  const filtres = useMemo(() => {
    const liste = base.filter((p) => (!rayon || typeDe(p) === rayon) && (!q || normalise(p.name).includes(q)));
    if (tri === "prix") liste.sort((a, b) => a.price - b.price);
    else if (tri === "promo") liste.sort((a, b) => (b.compare_at_price ? 1 : 0) - (a.compare_at_price ? 1 : 0));
    else liste.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return liste;
  }, [base, rayon, q, tri]);

  /*
    Repères réels posés par le vendeur s'il y en a — sinon les 3 premiers
    articles du genre actif, à des positions fixes : jamais de section vide.
  */
  const reperesReels =
    lookbookPose && lookbookPose.reperes.length > 0
      ? lookbookPose.reperes
          .map((r) => ({ repere: r, produit: visible.find((p) => p.id === r.productId) }))
          .filter((x): x is { repere: (typeof lookbookPose.reperes)[number]; produit: ProduitBoutique } => Boolean(x.produit))
      : null;
  const imageLookbook = lookbookPose?.imageUrl ?? couverture;
  const lookbook = reperesReels ? reperesReels.map((x) => x.produit) : base.slice(0, 3);
  const PINS_AUTO = ["18%,24%", "58%,42%", "32%,66%"];

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  function changerGenre(slug: string) {
    setGenreActif(slug);
    setRayon(null);
    etat.setActif(null);
  }

  const estFavori = (p: ProduitBoutique) => (p.id in favoris ? favoris[p.id] : p.isFavorite);

  /* Le panier rond : un article à tailles ouvre la feuille pour choisir la sienne. */
  function ajoutRapide(p: ProduitBoutique) {
    if ((p.sizes ?? []).length > 0) etat.ouvrir(p.id);
    else panier.ajouter([{ productId: p.id }]);
  }

  /* Les pièces du portant suivent aussi rayon et recherche — « يضيء الرّف ما يناسبك ». */
  const etatPortant = {
    ...etat,
    correspond: (p: ProduitBoutique) => etat.correspond(p) && dansLaSelection(p),
  };

  const rayonsUI = (
    <div className="flex flex-col gap-[8px]">
      <div className="flex items-baseline justify-between px-[2px]">
        <span className="text-[0.75rem] font-bold">{locale === "ar" ? "أقسام المتجر" : "Rayons de la boutique"}</span>
        <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
          {base.length} {locale === "ar" ? "منتج" : "articles"}
        </span>
      </div>
      <div className="no-sb flex gap-[12px] overflow-x-auto pb-[2px]">
        <button type="button" onClick={() => setRayon(null)} className="flex flex-none flex-col items-center gap-[6px]">
          <span
            className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] text-[1.125rem]"
            style={{
              background: rayon === null ? "var(--theme-accent)" : "var(--theme-accent-doux)",
              color: rayon === null ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
              boxShadow: rayon === null ? "0 0 0 2px var(--theme-surface,#fff), 0 0 0 4px var(--theme-accent)" : "none",
            }}
          >
            ✱
          </span>
          <span className="text-[0.625rem] font-bold whitespace-nowrap">
            {t.common.all} · {base.length}
          </span>
        </button>
        {rayons.map(([label, count]) => {
          const actif = label === rayon;
          const image = imageParRayon.get(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => setRayon(actif ? null : label)}
              aria-pressed={actif}
              className="flex flex-none flex-col items-center gap-[6px]"
            >
              <span
                className="relative flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-[20px] text-[1.125rem]"
                style={{
                  background: image ? undefined : actif ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                  color: actif ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                  boxShadow: actif ? "0 0 0 2px var(--theme-surface,#fff), 0 0 0 4px var(--theme-accent)" : "none",
                }}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniature fixe 60px
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  (ICONE_PAR_TYPE[label] ?? "•")
                )}
              </span>
              <span className="max-w-[64px] truncate text-[0.625rem] font-bold whitespace-nowrap">
                {label} · {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-[14px]">
      {genresPresents.length > 1 && (
        <div className="flex gap-[4px] rounded-[18px] bg-[var(--theme-accent-doux)] p-[4px]">
          {genresPresents.map((g) => {
            const actif = g.slug === genre;
            return (
              <button
                key={g.slug}
                type="button"
                onClick={() => changerGenre(g.slug)}
                aria-pressed={actif}
                className="flex-1 rounded-[14px] py-[8px] text-center text-[0.75rem] font-bold whitespace-nowrap"
                style={{
                  background: actif ? "var(--theme-surface,#fff)" : "transparent",
                  color: actif ? "var(--theme-accent-fort)" : "var(--theme-muted)",
                }}
              >
                {locale === "ar" ? g.labelAr : g.labelFr}
              </button>
            );
          })}
        </div>
      )}

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

      {/*
        Le portant doré, et juste dessous — à la place de la plaque
        « في الواجهة الآن » du prototype, choix de l'utilisateur — la carte
        des rayons. Puis le filtre « مقاسي ».
      */}
      <HautDeVitrine
        vitrine={vitrine}
        produits={base}
        etat={etatPortant}
        nomBoutique={nomBoutique}
        locale={locale}
        sousPresentoir={(avecPresentoir) =>
          rayons.length > 1 ? (
            <div
              className={`relative z-[2] rounded-[16px] bg-[var(--theme-surface,var(--color-surface-solid))] px-3 py-[10px] shadow-[0_8px_20px_rgba(60,40,90,0.08)] ${
                avecPresentoir ? "mx-[14px] -mt-[6px]" : ""
              }`}
            >
              {rayonsUI}
            </div>
          ) : null
        }
      />

      {imageLookbook && lookbook.length > 1 && !query && !rayon && (
        <div
          className="relative h-[280px] overflow-hidden rounded-[22px] bg-center bg-cover"
          style={{ backgroundImage: `url(${imageLookbook})` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,20,0)_45%,rgba(20,20,20,0.55)_100%)]" />
          {lookbook.map((p, i) => {
            const [x, y] = reperesReels
              ? [`${reperesReels[i].repere.x}%`, `${reperesReels[i].repere.y}%`]
              : PINS_AUTO[i].split(",");
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => etat.ouvrir(p.id)}
                className="absolute flex items-center gap-[6px] rounded-[14px] bg-[rgba(255,255,255,0.92)] py-[4px] pr-[10px] pl-[4px] shadow-[0_4px_10px_rgba(30,20,45,0.25)]"
                style={{ left: x, top: y }}
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--theme-accent)] text-[0.625rem] font-bold text-[var(--theme-accent-texte)]">
                  +
                </span>
                <span className="text-[0.625rem] font-bold text-[var(--theme-texte)]">
                  {p.name} {formatPrice(p.price, locale)}
                </span>
              </button>
            );
          })}
          <div className="absolute inset-x-[16px] bottom-[16px] flex items-end justify-between gap-2 text-white">
            <span className="flex flex-col">
              <span className="text-[0.625rem] font-semibold opacity-85">
                Lookbook{genre ? ` · ${GENRES.find((g) => g.slug === genre)?.labelFr}` : ""}
              </span>
              <span className="text-[1.375rem] font-bold">{theme.ambiance.nom}</span>
            </span>
            <button
              type="button"
              onClick={() => panier.ajouter(lookbook.map((p) => ({ productId: p.id })))}
              disabled={panier.pending}
              className="flex-none rounded-[16px] bg-white px-[14px] py-[8px] text-[0.6875rem] font-bold whitespace-nowrap text-[var(--theme-texte)] disabled:opacity-60"
            >
              {panier.pending
                ? t.common.saving
                : `${locale === "ar" ? "أضف الإطلالة" : "Tout le look"} · ${formatPrice(
                    lookbook.reduce((a, p) => a + p.price, 0),
                    locale,
                  )}`}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.9375rem] font-extrabold">
          {query ? `« ${query.trim()} »` : rayon ? rayon : locale === "ar" ? "كل المنتجات" : "Tous les articles"}
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
              aria-pressed={tri === v}
              className="flex-none rounded-[12px] px-[9px] py-[5px] text-[0.6875rem] font-semibold whitespace-nowrap"
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

      {filtres.length === 0 ? (
        <EmptyState title={format(t.search.noResults, { q: query.trim() })} />
      ) : (
        /*
          Catalogue lookbook (README Mode) : 2 colonnes, 1re carte pleine
          largeur (200px), les autres 150px ; carte blanche r22, image en
          retrait de 8px r16 ; badge, cœur 30px, panier rond 36px qui
          chevauche le bas avec une bordure 3px couleur de page.
        */
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-[14px]">
          {filtres.map((p, i) => {
            const large = i === 0 && filtres.length > 1;
            const promo = Boolean(p.compare_at_price && p.compare_at_price > p.price);
            const badge = promo ? (locale === "ar" ? "تخفيض" : "Promo") : estNouveau(p) ? (locale === "ar" ? "جديد" : "Nouveau") : null;
            const fav = estFavori(p);
            return (
              <div
                key={p.id}
                className={`flex flex-col gap-[6px] transition-opacity duration-300 ${large ? "col-span-2" : ""}`}
                style={{ opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
              >
                <div className="relative rounded-[22px] bg-[var(--theme-surface,#fff)] p-2 shadow-[0_6px_18px_rgba(60,40,90,0.07)]">
                  <button
                    type="button"
                    onClick={() => etat.ouvrir(p.id)}
                    aria-label={p.name}
                    className="relative block w-full overflow-hidden rounded-[16px] bg-[var(--theme-accent-doux)]"
                    style={{ height: large ? 200 : 150 }}
                  >
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- vignette de catalogue
                      <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className="absolute inset-0 flex items-center justify-center p-3 text-center text-[1.25rem] font-black text-white"
                        style={{ background: fondSansPhoto(p) }}
                      >
                        {p.name.split(/[\s—–-]+/)[0]}
                      </span>
                    )}
                  </button>
                  {badge && (
                    <span
                      className="absolute top-[14px] right-[14px] rounded-full px-[9px] py-[3px] text-[0.625rem] font-extrabold text-white"
                      style={{ background: promo ? COULEUR_PROMO : "var(--theme-accent)" }}
                    >
                      {badge}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      panier.basculerFavori(p.id, fav, (nouveau) => setFavoris((f) => ({ ...f, [p.id]: nouveau })))
                    }
                    aria-label={locale === "ar" ? "المفضلة" : "Favori"}
                    aria-pressed={Boolean(fav)}
                    className="absolute top-[14px] left-[14px] flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[rgba(255,255,255,0.92)] text-[0.9375rem] shadow-[0_2px_6px_rgba(30,20,45,0.18)]"
                    style={{ color: fav ? COULEUR_PROMO : "var(--theme-texte)" }}
                  >
                    {fav ? "♥" : "♡"}
                  </button>
                  <button
                    type="button"
                    onClick={() => ajoutRapide(p)}
                    disabled={panier.pending || p.stock <= 0}
                    aria-label={locale === "ar" ? "أضف إلى السلة" : "Ajouter au panier"}
                    className="absolute -bottom-[14px] left-[14px] flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[var(--theme-accent)] text-[1.125rem] leading-none font-bold text-[var(--theme-accent-texte)] disabled:opacity-50"
                    style={{ border: "3px solid var(--theme-fond)" }}
                  >
                    +
                  </button>
                </div>
                <button type="button" onClick={() => etat.ouvrir(p.id)} className="flex flex-col items-start gap-px px-1 pt-[6px] text-start">
                  <span className="line-clamp-2 text-[0.8125rem] leading-[1.3] font-semibold">{p.name}</span>
                  <span className="flex items-baseline gap-[6px]">
                    <span className="text-[0.9375rem] font-extrabold text-[var(--theme-accent-fort)]">
                      {formatPrice(p.price, locale)}
                    </span>
                    {promo && (
                      <span className="text-[0.6875rem] text-[var(--theme-muted)] line-through">
                        {formatPrice(p.compare_at_price!, locale)}
                      </span>
                    )}
                  </span>
                  {(p.sizes ?? []).length > 0 ? (
                    <span className="text-[0.6875rem] text-[var(--theme-muted)]">{p.sizes!.join(" · ")}</span>
                  ) : (
                    typeDe(p) && <span className="text-[0.6875rem] text-[var(--theme-muted)]">{typeDe(p)}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <FeuilleProduit
        produit={etat.ouvert}
        locale={locale}
        onFermer={etat.fermer}
        pending={panier.pending}
        tailleRequise
        sousTitre={etat.ouvert ? typeDe(etat.ouvert) : null}
        onAjouter={(taille) => {
          const p = etat.ouvert;
          if (p) panier.ajouter([{ productId: p.id, size: taille }], etat.fermer);
        }}
      />
      <ToastBoutique message={panier.message} />
    </div>
  );
}
