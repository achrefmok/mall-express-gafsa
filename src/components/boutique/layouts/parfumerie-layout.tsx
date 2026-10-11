"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { ConfigVitrine } from "@/lib/boutique-vitrines";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { nombreDe } from "./comparateur";
import { FeuilleProduit, fondSansPhoto } from "../feuille-produit";
import { ToastBoutique, useAjoutPanier } from "../use-ajout-panier";

const NOTES = [
  { cle: "note_tete", fr: "Tête", ar: "رأس", dose: 6 },
  { cle: "note_coeur", fr: "Cœur", ar: "قلب", dose: 11 },
  { cle: "note_fond", fr: "Fond", ar: "قاعدة", dose: 16 },
] as const;

/** Sillage saisi de 1 à 5 par le vendeur. */
function niveauSillage(p: ProduitBoutique): number | null {
  const n = nombreDe(p.attributs?.sillage);
  return n === null ? null : Math.max(1, Math.min(5, Math.round(n)));
}

/** Tenue : les heures saisies, un point toutes les deux heures (10 h et plus = 5). */
function niveauTenue(p: ProduitBoutique): number | null {
  const h = nombreDe(p.attributs?.tenue_heures);
  return h === null ? null : Math.max(1, Math.min(5, Math.round(h / 2)));
}

function Jauge({ libelle, niveau, detail }: { libelle: string; niveau: number; detail?: string }) {
  return (
    <span className="flex items-center justify-between gap-2 text-[0.6875rem]">
      <span className="text-[var(--theme-muted)]">
        {libelle}
        {detail ? ` · ${detail}` : ""}
      </span>
      <span className="flex gap-[3px]" aria-label={`${niveau}/5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <i
            key={i}
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: i <= niveau ? "var(--theme-accent)" : "color-mix(in srgb,var(--theme-accent) 16%,#fff)" }}
          />
        ))}
      </span>
    </span>
  );
}

function Pyramide({ p, locale, compacte }: { p: ProduitBoutique; locale: AppLocale; compacte?: boolean }) {
  const lignes = NOTES.filter((n) => p.attributs?.[n.cle]);
  if (lignes.length === 0) return null;
  return (
    <div className="flex flex-col overflow-hidden rounded-[12px]">
      {lignes.map((n) => (
        <span
          key={n.cle}
          className={`flex gap-2 px-[10px] ${compacte ? "py-[4px] text-[0.6875rem]" : "py-[7px] text-[0.8125rem]"}`}
          style={{ background: `color-mix(in srgb,var(--theme-accent) ${n.dose}%,#fff)` }}
        >
          <b className="flex-none text-[var(--theme-accent-fort)]">{locale === "ar" ? n.ar : n.fr}</b>
          <span className="min-w-0 truncate">{p.attributs?.[n.cle]}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Parfumerie — handoff « 03-parfumerie » : plateau de marbre rosé, filtre
 * « عائلتي العطرية », grille de flacons en arche avec pyramide olfactive
 * et jauges sillage / tenue.
 *
 * Contenances : les déclinaisons réelles du produit (`products.sizes`,
 * « 50 ml »), au même prix — le ×0,65 / ×1,7 du prototype serait un prix
 * inventé. L'échantillon gratuit passe par le bouton principal de
 * l'en-tête (« اطلب عيّنة », messagerie), le panier n'ayant pas de note.
 */
export function ParfumerieLayout({
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
  const [volume, setVolume] = useState<Record<string, string>>({});

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  function ajouter(p: ProduitBoutique, taille: string | null = null) {
    const choix = taille ?? (volume[p.id] || null);
    if ((p.sizes ?? []).length > 0 && !choix) {
      etat.ouvrir(p.id);
      return;
    }
    panier.ajouter([{ productId: p.id, size: choix }], etat.fermer);
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <HautDeVitrine
        vitrine={vitrine}
        produits={visible}
        etat={etat}
        nomBoutique={nomBoutique}
        locale={locale}
        noteDe={(p) => p.attributs?.famille_olfactive ?? null}
      />

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "العطور" : "Les parfums"} · {visible.length}
      </span>

      <div className="grid grid-cols-2 gap-[10px]">
        {visible.map((p) => {
          const sillage = niveauSillage(p);
          const tenue = niveauTenue(p);
          const volumes = p.sizes ?? [];
          return (
            <article
              key={p.id}
              className="flex flex-col gap-2 rounded-[22px] bg-[var(--theme-surface,#fff)] p-[10px] shadow-[0_6px_18px_rgba(60,40,90,0.07)] transition-opacity duration-300"
              style={{ opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE }}
            >
              <button
                type="button"
                onClick={() => etat.ouvrir(p.id)}
                aria-label={p.name}
                className="relative mx-auto h-[130px] w-[86%] overflow-hidden rounded-[999px_999px_14px_14px] shadow-[0_0_0_1.5px_#e3c39a]"
                style={{ background: p.images[0] ? "var(--theme-accent-doux)" : fondSansPhoto(p) }}
              >
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- flacon en arche
                  <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-x-2 top-[38%] text-center text-[1rem] font-black text-white">
                    {p.name.split(/\s+/)[0]}
                  </span>
                )}
              </button>
              <span className="line-clamp-2 text-center text-[0.8125rem] leading-[1.3] font-bold">{p.name}</span>
              {p.attributs?.famille_olfactive && (
                <span className="text-center text-[0.6875rem] text-[var(--theme-muted)]">{p.attributs.famille_olfactive}</span>
              )}
              <Pyramide p={p} locale={locale} compacte />
              {(sillage || tenue) && (
                <div className="flex flex-col gap-1">
                  {sillage && <Jauge libelle={ar ? "الفوحان" : "Sillage"} niveau={sillage} />}
                  {tenue && <Jauge libelle={ar ? "الثبات" : "Tenue"} niveau={tenue} />}
                </div>
              )}
              {volumes.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1">
                  {volumes.map((v) => {
                    const on = volume[p.id] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setVolume((cur) => ({ ...cur, [p.id]: on ? "" : v }))}
                        className="min-h-[30px] rounded-[9px] px-2 text-[0.6875rem] font-bold"
                        style={{
                          background: on ? "var(--theme-accent)" : "transparent",
                          color: on ? "var(--theme-accent-texte)" : "var(--theme-texte)",
                          border: `1px solid ${on ? "var(--theme-accent)" : "var(--theme-bordure)"}`,
                        }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-auto flex items-center justify-between gap-1">
                <span className="text-[0.9375rem] font-extrabold text-[var(--theme-accent-fort)]">{formatPrice(p.price, locale)}</span>
                <button
                  type="button"
                  onClick={() => ajouter(p)}
                  disabled={panier.pending || p.stock <= 0}
                  aria-label={ar ? "أضف إلى السلة" : "Ajouter au panier"}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--theme-accent)] text-[1.125rem] font-bold text-[var(--theme-accent-texte)] disabled:opacity-50"
                >
                  +
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
        tailleRequise
        sousTitre={etat.ouvert?.attributs?.famille_olfactive}
        onAjouter={(taille) => etat.ouvert && ajouter(etat.ouvert, taille)}
      >
        {etat.ouvert && (
          <>
            <Pyramide p={etat.ouvert} locale={locale} />
            {niveauSillage(etat.ouvert) && <Jauge libelle={ar ? "الفوحان" : "Sillage"} niveau={niveauSillage(etat.ouvert)!} />}
            {niveauTenue(etat.ouvert) && (
              <Jauge libelle={ar ? "الثبات" : "Tenue"} niveau={niveauTenue(etat.ouvert)!} detail={etat.ouvert.attributs?.tenue_heures} />
            )}
          </>
        )}
      </FeuilleProduit>
      <ToastBoutique message={panier.message} />
    </div>
  );
}
