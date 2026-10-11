"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import { normaliser, type ConfigVitrine } from "@/lib/boutique-vitrines";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { COULEUR_OK, HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { FeuilleProduit, fondSansPhoto } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";

/** « الآن », « طازج », « maintenant », « frais » : prêt tout de suite (vert), sinon une heure (orange). */
function disponibilite(p: ProduitBoutique): { texte: string; pret: boolean } | null {
  const d = p.attributs?.disponible?.trim();
  if (!d) return null;
  return { texte: d, pret: /الان|طازج|maintenant|frais|immediat/.test(normaliser(d)) };
}

/**
 * Pâtisserie — handoff « 07-patisserie » : présentoir à gâteaux en
 * porcelaine, filtre « المناسبة », menu en lignes pilule avec compteur et
 * total, récapitulatif en pointillés.
 *
 * Le jour de retrait du prototype n'est pas proposé : ni le panier ni la
 * commande ne portent de date de retrait — la boutique le convient avec le
 * client (bouton « اطلب لمناسبة » de l'en-tête, messagerie).
 */
export function PatisserieLayout({
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
  const [quantites, setQuantites] = useState<Record<string, number>>({});

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const changer = (p: ProduitBoutique, delta: number) =>
    setQuantites((q) => ({ ...q, [p.id]: Math.max(0, Math.min(Math.max(0, p.stock), 99, (q[p.id] ?? 0) + delta)) }));

  const lignes = visible.filter((p) => (quantites[p.id] ?? 0) > 0);
  const total = lignes.reduce((a, p) => a + p.price * quantites[p.id], 0);
  const nbArticles = lignes.reduce((a, p) => a + quantites[p.id], 0);

  const unite = (p: ProduitBoutique) => (p.attributs?.unite ? ` / ${p.attributs.unite}` : "");

  return (
    <div className="flex flex-col gap-[14px]">
      <HautDeVitrine
        vitrine={vitrine}
        produits={visible}
        etat={etat}
        nomBoutique={nomBoutique}
        locale={locale}
        noteDe={(p) => disponibilite(p)?.texte ?? p.attributs?.occasion ?? null}
      />

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "قائمة الحلويات" : "La carte"} · {visible.length}
      </span>

      <div className="flex flex-col gap-2">
        {visible.map((p) => {
          const q = quantites[p.id] ?? 0;
          const dispo = disponibilite(p);
          return (
            <article
              key={p.id}
              className="flex items-center gap-3 rounded-[999px_24px_24px_999px] bg-[var(--theme-surface,#fff)] p-2 pe-3 shadow-[0_6px_18px_rgba(140,60,70,0.08)] transition-opacity duration-300 rtl:rounded-[24px_999px_999px_24px]"
              style={{ opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
            >
              <button
                type="button"
                onClick={() => etat.ouvrir(p.id)}
                aria-label={p.name}
                className="relative h-16 w-16 flex-none overflow-hidden rounded-full shadow-[0_0_0_3px_#fff,0_0_0_4.5px_color-mix(in_srgb,var(--theme-accent)_30%,#fff)]"
                style={{ background: p.images[0] ? "var(--theme-accent-doux)" : fondSansPhoto(p) }}
              >
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette ronde 64px
                  <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[0.75rem] font-black text-white">{p.name.split(/\s+/)[0]}</span>
                )}
              </button>
              <button type="button" onClick={() => etat.ouvrir(p.id)} className="flex min-w-0 flex-1 flex-col items-start gap-[2px] text-start">
                <span className="line-clamp-2 text-[0.875rem] leading-[1.3] font-bold">{p.name}</span>
                <span className="text-[0.75rem] font-bold text-[var(--theme-accent-fort)]">
                  {formatPrice(p.price, locale)}
                  <span className="font-medium text-[var(--theme-muted)]">{unite(p)}</span>
                </span>
                {dispo && (
                  <span className="text-[0.6875rem] font-bold" style={{ color: dispo.pret ? COULEUR_OK : "oklch(.62 .16 60)" }}>
                    ● {dispo.texte}
                  </span>
                )}
              </button>
              <div className="flex flex-none flex-col items-center gap-1">
                <div className="flex items-center gap-[6px]">
                  <button
                    type="button"
                    onClick={() => changer(p, -1)}
                    disabled={q === 0}
                    aria-label={ar ? "أنقص" : "Retirer"}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--theme-accent-doux)] text-[1rem] font-extrabold text-[var(--theme-accent-fort)] disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="min-w-[18px] text-center text-[0.9375rem] font-black">{q}</span>
                  <button
                    type="button"
                    onClick={() => changer(p, 1)}
                    disabled={p.stock <= q}
                    aria-label={ar ? "أضف" : "Ajouter"}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--theme-accent)] text-[1rem] font-extrabold text-[var(--theme-accent-texte)] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                {q > 0 && (
                  <span className="text-[0.6875rem] font-bold text-[var(--theme-muted)]">{formatPrice(p.price * q, locale)}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {nbArticles > 0 && (
        <div className="flex flex-col gap-2 rounded-[20px] border-2 border-dashed border-[color-mix(in_srgb,var(--theme-accent)_35%,#fff)] bg-[var(--theme-surface,#fff)] p-[14px]">
          <span className="text-[0.875rem] font-extrabold">{ar ? "طلبك" : "Votre commande"}</span>
          {lignes.map((p) => (
            <span key={p.id} className="flex justify-between gap-2 text-[0.8125rem]">
              <span className="truncate">
                {quantites[p.id]} × {p.name}
              </span>
              <span className="flex-none font-bold">{formatPrice(p.price * quantites[p.id], locale)}</span>
            </span>
          ))}
          <button
            type="button"
            disabled={panier.pending}
            onClick={() =>
              panier.ajouter(
                lignes.map((p) => ({ productId: p.id, quantity: quantites[p.id] })),
                () => setQuantites({}),
              )
            }
            className="mt-1 min-h-[48px] rounded-[14px] bg-[var(--theme-accent)] text-[0.875rem] font-extrabold text-[var(--theme-accent-texte)] disabled:opacity-60"
          >
            {ar ? "أضف الطلب للسلة" : "Ajouter au panier"} · {formatPrice(total, locale)}
          </button>
        </div>
      )}

      <FeuilleProduit
        produit={etat.ouvert}
        locale={locale}
        onFermer={etat.fermer}
        pending={panier.pending}
        sousTitre={etat.ouvert?.attributs?.occasion}
        onAjouter={(taille) => etat.ouvert && panier.ajouter([{ productId: etat.ouvert.id, size: taille }], etat.fermer)}
      >
        {etat.ouvert && disponibilite(etat.ouvert) && (
          <span className="text-[0.8125rem] font-bold" style={{ color: disponibilite(etat.ouvert)!.pret ? COULEUR_OK : "oklch(.62 .16 60)" }}>
            ● {disponibilite(etat.ouvert)!.texte}
          </span>
        )}
      </FeuilleProduit>
      <ToastBoutique message={panier.message} />
    </div>
  );
}
