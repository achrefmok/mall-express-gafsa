"use client";

import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import { correspondOption, texteFiltrable, type ConfigVitrine } from "@/lib/boutique-vitrines";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { COULEUR_ALERTE, COULEUR_OK, HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { nombreDe } from "./comparateur";
import { FeuilleProduit } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";

/*
  Matériaux de l'atelier (handoff, objet DISP « moto ») : la bande jaune de
  sécurité et le noir du bouton « أضف ». Pas des couleurs d'identité —
  celles-ci restent `--theme-*` (accent orange du métier).
*/
const JAUNE = "#f2b705";
const NOIR = "#141414";

function Stock({ p, locale }: { p: ProduitBoutique; locale: AppLocale }) {
  const ar = locale === "ar";
  const [texte, couleur] =
    p.stock <= 0
      ? [ar ? "نفد المخزون" : "Rupture de stock", COULEUR_ALERTE]
      : p.stock < 5
        ? [ar ? `آخر ${p.stock} قطع` : `Plus que ${p.stock}`, "oklch(.62 .16 60)"]
        : [ar ? "متوفر" : "En stock", COULEUR_OK];
  return (
    <span className="flex items-center gap-1 text-[0.6875rem] font-bold" style={{ color: couleur }}>
      <i className="h-[7px] w-[7px] rounded-full bg-current" />
      {texte}
    </span>
  );
}

/**
 * Moto & pièces — handoff « 06-moto-pieces » : plateau d'atelier à bande
 * de sécurité, filtre « الموتو متاعي », liste technique (référence,
 * stock, compatibilité par marque).
 *
 * La compatibilité se lit dans l'attribut `compatibilite` du vendeur ; la
 * grille ne montre que les marques présentes dans la boutique. Le montage
 * à l'atelier n'apparaît qu'avec un prix saisi (`montage_prix`), à titre
 * d'information : le panier ne porte pas d'option de service.
 */
export function MotoLayout({
  visible,
  locale,
  theme,
  vitrine,
  nomBoutique,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  vitrine: ConfigVitrine;
  nomBoutique: string;
}) {
  const ar = locale === "ar";
  const etat = useVitrine(visible, vitrine);
  const panier = useAjoutPanier();

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const marques = etat.options;

  function grilleCompatibilite(p: ProduitBoutique) {
    if (marques.length === 0) return null;
    const texte = texteFiltrable(p, vitrine.filtre);
    return (
      <div className="grid grid-cols-4 gap-1">
        {marques.slice(0, 8).map((m) => {
          const ok = correspondOption(m, texte);
          const choisie = etat.actif === m.cle;
          return (
            <span
              key={m.cle}
              className="flex min-h-[28px] items-center justify-center gap-[3px] rounded-[8px] px-1 text-[0.6875rem] font-bold"
              style={
                choisie && ok
                  ? { background: COULEUR_OK, color: "#fff" }
                  : ok
                    ? { background: "#eaf6ef", color: COULEUR_OK }
                    : { background: "color-mix(in srgb,var(--theme-muted) 12%,#fff)", color: "var(--theme-muted)" }
              }
            >
              {ok ? "✓" : "×"} {m.fr}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <HautDeVitrine
        vitrine={vitrine}
        produits={visible}
        etat={etat}
        nomBoutique={nomBoutique}
        locale={locale}
        noteDe={(p) => (p.attributs?.reference ? `REF · ${p.attributs.reference}` : null)}
        libelleCompatible={{
          oui: (o) => (ar ? `متوافق مع ${o.ar} ✓` : `Compatible ${o.fr} ✓`),
          non: (o) => (ar ? `غير متوافق مع ${o.ar}` : `Non compatible ${o.fr}`),
        }}
      />

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "القطع والإكسسوارات" : "Pièces et accessoires"} · {visible.length}
      </span>

      <div className="flex flex-col gap-[10px]">
        {visible.map((p) => {
          const montage = nombreDe(p.attributs?.montage_prix);
          return (
            <article
              key={p.id}
              className="flex flex-col gap-2 rounded-[10px] bg-[var(--theme-surface,#fff)] p-3 shadow-[0_6px_18px_rgba(0,0,0,0.07)] transition-opacity duration-300"
              style={{ borderTop: `3px solid ${JAUNE}`, opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
            >
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => etat.ouvrir(p.id)} className="flex min-w-0 flex-col items-start gap-[2px] text-start">
                  {p.attributs?.reference && (
                    <span dir="ltr" className="font-mono text-[0.625rem] font-semibold tracking-[0.04em] text-[var(--theme-muted)]">
                      REF · {p.attributs.reference}
                    </span>
                  )}
                  <span className="text-[0.875rem] leading-[1.3] font-bold">{p.name}</span>
                </button>
                <span className="flex-none text-[0.9375rem] font-extrabold text-[var(--theme-accent-fort)]">
                  {formatPrice(p.price, locale)}
                </span>
              </div>
              <Stock p={p} locale={locale} />
              {grilleCompatibilite(p)}
              <div className="flex items-center justify-between gap-2">
                {montage !== null ? (
                  <span className="text-[0.6875rem] font-semibold text-[var(--theme-muted)]">
                    {ar ? `تركيب في الورشة +${formatPrice(montage, locale)}` : `Montage à l'atelier +${formatPrice(montage, locale)}`}
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => panier.ajouter([{ productId: p.id }])}
                  disabled={panier.pending || p.stock <= 0}
                  className="min-h-[38px] flex-none rounded-[8px] px-4 text-[0.8125rem] font-extrabold disabled:opacity-50"
                  style={{ background: NOIR, color: JAUNE }}
                >
                  {ar ? "أضف" : "Ajouter"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <FeuilleProduit
        produit={etat.ouvert}
        locale={locale}
        onFermer={etat.fermer}
        pending={panier.pending}
        sousTitre={etat.ouvert?.attributs?.reference ? `REF · ${etat.ouvert.attributs.reference}` : null}
        onAjouter={(taille) => etat.ouvert && panier.ajouter([{ productId: etat.ouvert.id, size: taille }], etat.fermer)}
      >
        {etat.ouvert && (
          <>
            <Stock p={etat.ouvert} locale={locale} />
            {grilleCompatibilite(etat.ouvert)}
          </>
        )}
      </FeuilleProduit>
      <ToastBoutique message={panier.message} />
    </div>
  );
}
