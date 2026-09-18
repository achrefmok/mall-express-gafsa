"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, formatPrice, monogram } from "@/lib/format";
import { EmptyState, Tag, fieldClass } from "@/components/ui/primitives";
import type { AppLocale } from "@/types/database";

export interface EditionAffichee {
  id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  place: string | null;
  cover_url: string | null;
  starts_on: string;
  ends_on: string;
}

export interface ExposantAffiche {
  id: string;
  expo_id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  logo_url: string | null;
  cover_url: string | null;
  stand_no: string | null;
  images: string[];
}

export interface ProduitAffiche {
  id: string;
  exhibitor_id: string;
  name: string;
  name_ar: string | null;
  images: string[];
  price: number | null;
  compare_at_price: number | null;
  is_available: boolean;
}

/** Sans accent et en minuscules : « déglet » doit trouver « Deglet ». */
const pliage = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * L'exposition, par ses stands ou par ses produits.
 *
 * Le choix de la vue, la recherche et l'édition regardée vivent dans l'URL du
 * composant plutôt que sur le serveur : tout est déjà chargé — une exposition
 * compte des dizaines de stands, pas des milliers — et filtrer sans aller-retour
 * donne ce que donne un vrai marché, où l'on balaie l'allée des yeux.
 */
export function ExpositionClient({
  editions,
  exposants,
  produits,
  locale,
  vueInitiale,
  peutGerer,
}: {
  editions: EditionAffichee[];
  exposants: ExposantAffiche[];
  produits: ProduitAffiche[];
  locale: AppLocale;
  vueInitiale: "stands" | "produits";
  peutGerer: boolean;
}) {
  const [editionId, setEditionId] = useState(editions[0]?.id ?? "");
  const [vue, setVue] = useState<"stands" | "produits">(vueInitiale);
  const [recherche, setRecherche] = useState("");

  const edition = editions.find((e) => e.id === editionId) ?? editions[0];
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const terminee = edition ? edition.ends_on < aujourdhui : false;

  const standsDeLEdition = useMemo(
    () => exposants.filter((x) => x.expo_id === edition?.id),
    [exposants, edition],
  );

  /* Le nom du stand voyage avec son produit : la vue produits doit le dire. */
  const produitsDeLEdition = useMemo(() => {
    const parExposant = new Map(standsDeLEdition.map((x) => [x.id, x]));
    return produits
      .filter((p) => parExposant.has(p.exhibitor_id))
      .map((p) => ({ produit: p, stand: parExposant.get(p.exhibitor_id)! }));
  }, [produits, standsDeLEdition]);

  const q = pliage(recherche);

  const standsFiltres = useMemo(
    () =>
      q
        ? standsDeLEdition.filter(
            (x) =>
              pliage(x.name).includes(q) ||
              pliage(x.description ?? "").includes(q) ||
              produitsDeLEdition.some(
                (l) => l.stand.id === x.id && pliage(l.produit.name).includes(q),
              ),
          )
        : standsDeLEdition,
    [standsDeLEdition, produitsDeLEdition, q],
  );

  const produitsFiltres = useMemo(
    () =>
      q
        ? produitsDeLEdition.filter(
            (l) => pliage(l.produit.name).includes(q) || pliage(l.stand.name).includes(q),
          )
        : produitsDeLEdition,
    [produitsDeLEdition, q],
  );

  /** Combien d'articles, et à partir de combien : ce qu'on veut savoir d'un stand. */
  const resume = (exposantId: string) => {
    const siens = produitsDeLEdition.filter((l) => l.stand.id === exposantId);
    const prix = siens.map((l) => l.produit.price).filter((p): p is number => p != null);
    return {
      nombre: siens.length,
      apartirDe: prix.length > 0 ? Math.min(...prix) : null,
      apercus: siens.map((l) => l.produit.images[0]).filter(Boolean).slice(0, 3) as string[],
    };
  };

  if (!edition) return null;

  const nomEdition = locale === "ar" ? (edition.name_ar ?? edition.name) : edition.name;
  const texteEdition =
    locale === "ar" ? (edition.description_ar ?? edition.description) : edition.description;

  return (
    <div className="col-reading no-sb flex flex-1 flex-col overflow-y-auto pb-6">
      {/* ─── L'affiche de l'édition ──────────────────────────────────── */}
      <header className="relative aspect-[16/9] w-full bg-[linear-gradient(135deg,#b07a2a,#3d2608)]">
        {edition.cover_url && (
          <Image src={edition.cover_url} alt="" fill sizes="100vw" className="object-cover" priority />
        )}

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.78),transparent)] px-4 pt-10 pb-3">
          <p className="text-[0.5625rem] font-bold tracking-[0.2em] text-white/75 uppercase">
            Société Dahmani
          </p>
          <h1 className="text-[1.125rem] font-extrabold tracking-[-0.02em] text-white">
            {nomEdition}
          </h1>
          <p className="text-[0.65625rem] text-white/80">
            {terminee
              ? "Exposition terminée · les stands restent ouverts ici"
              : `${formatDate(edition.starts_on, locale)} → ${formatDate(edition.ends_on, locale)}`}
            {edition.place ? ` · ${edition.place}` : ""}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-3">
        {texteEdition && (
          <p className="text-[0.6875rem] leading-[1.55] text-[var(--color-muted)]">{texteEdition}</p>
        )}

        {peutGerer && (
          <Link
            href="/lelma3ardh/gestion"
            className="rounded-[14px] bg-[linear-gradient(135deg,#8a5a1f,#3d2608)] px-3 py-[10px] text-[0.6875rem] font-bold text-white"
          >
            Gérer l&apos;exposition, les stands et les produits →
          </Link>
        )}

        {/* Plusieurs éditions : on choisit celle qu'on regarde. */}
        {editions.length > 1 && (
          <div className="no-sb flex gap-2 overflow-x-auto">
            {editions.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditionId(e.id)}
                className={
                  "flex-none rounded-full px-3 py-[6px] text-[0.65625rem] font-bold " +
                  (e.id === edition.id
                    ? "bg-[#8a5a1f] text-white"
                    : "border border-[var(--color-outline)] text-[var(--color-ink)]")
                }
              >
                {e.name}
              </button>
            ))}
          </div>
        )}

        {/* ─── Les deux entrées ──────────────────────────────────────── */}
        <div className="flex gap-1 rounded-full bg-[rgba(138,90,31,0.1)] p-1">
          {(
            [
              ["stands", `Stands · ${standsDeLEdition.length}`],
              ["produits", `Produits · ${produitsDeLEdition.length}`],
            ] as const
          ).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setVue(cle)}
              className={
                "flex-1 rounded-full py-[7px] text-[0.6875rem] font-bold transition-colors " +
                (vue === cle ? "bg-white text-[#8a5a1f] shadow-sm" : "text-[rgba(61,38,8,0.6)]")
              }
            >
              {libelle}
            </button>
          ))}
        </div>

        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value.slice(0, 60))}
          placeholder="Chercher un produit ou un stand…"
          aria-label="Chercher un produit ou un stand"
          className={fieldClass({ size: "sm", solid: true })}
        />
      </div>

      {/* ─── Les stands ──────────────────────────────────────────────── */}
      {vue === "stands" && (
        <div className="grid grid-cols-1 gap-3 px-4 pt-3">
          {standsFiltres.length === 0 ? (
            <EmptyState title="Aucun stand" body="Rien ne correspond à cette recherche." />
          ) : (
            standsFiltres.map((x) => {
              const { nombre, apartirDe, apercus } = resume(x.id);
              const image = x.cover_url ?? x.images[0] ?? null;

              return (
                <Link
                  key={x.id}
                  href={`/lelma3ardh/${x.slug}`}
                  className="flex gap-3 overflow-hidden rounded-[18px] bg-[var(--color-surface-solid)] p-[10px] shadow-[0_6px_18px_rgba(36,31,46,0.06)]"
                >
                  <span className="relative h-[78px] w-[78px] flex-none overflow-hidden rounded-[14px] bg-[rgba(138,90,31,0.12)]">
                    {image ? (
                      <Image src={image} alt="" fill sizes="78px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[0.8125rem] font-bold text-[rgba(138,90,31,0.55)]">
                        {monogram(x.name)}
                      </span>
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[0.78125rem] font-bold text-[var(--color-ink)]">
                        {locale === "ar" ? (x.name_ar ?? x.name) : x.name}
                      </span>
                      {x.stand_no && <Tag>Stand {x.stand_no}</Tag>}
                    </span>

                    <span className="line-clamp-2 text-[0.625rem] leading-[1.45] text-[var(--color-muted)]">
                      {(locale === "ar" ? (x.description_ar ?? x.description) : x.description) ?? ""}
                    </span>

                    <span className="mt-[2px] flex items-center gap-2">
                      {/* Trois vignettes de ses articles : on voit ce qu'il vend
                          avant d'entrer, ce qu'une allée de marché montre aussi. */}
                      <span className="flex gap-[3px]">
                        {apercus.map((url) => (
                          <span
                            key={url}
                            className="relative block h-[22px] w-[22px] overflow-hidden rounded-[6px] bg-[var(--color-app)]"
                          >
                            <Image src={url} alt="" fill sizes="22px" className="object-cover" />
                          </span>
                        ))}
                      </span>

                      <span dir="ltr" className="text-[0.59375rem] font-bold text-[#8a5a1f]">
                        {nombre} article{nombre > 1 ? "s" : ""}
                        {apartirDe != null ? ` · dès ${formatPrice(apartirDe, locale)}` : ""}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* ─── Les produits, tous stands confondus ─────────────────────── */}
      {vue === "produits" && (
        <div className="grid grid-cols-2 gap-3 px-4 pt-3">
          {produitsFiltres.length === 0 ? (
            <div className="col-span-2">
              <EmptyState title="Aucun produit" body="Rien ne correspond à cette recherche." />
            </div>
          ) : (
            produitsFiltres.map(({ produit: p, stand }) => (
              <Link
                key={p.id}
                href={`/lelma3ardh/${stand.slug}`}
                className="flex flex-col overflow-hidden rounded-[18px] bg-[var(--color-surface-solid)] shadow-[0_6px_18px_rgba(36,31,46,0.06)]"
              >
                <span className="relative block aspect-square bg-[rgba(138,90,31,0.08)]">
                  {/*
                    Sans photo, le visuel du stand plutôt qu'un carré gris.

                    Atténué et surmonté du numéro de stand : il ne prétend pas
                    montrer l'article — ce serait mentir — mais il dit d'où il
                    vient, et une grille de carrés gris décourage de faire défiler.
                  */}
                  {p.images[0] ? (
                    <Image src={p.images[0]} alt="" fill sizes="50vw" className="object-cover" />
                  ) : (
                    <>
                      {stand.cover_url && (
                        <Image
                          src={stand.cover_url}
                          alt=""
                          fill
                          sizes="50vw"
                          className="object-cover opacity-45"
                        />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center text-[0.625rem] font-bold text-[rgba(61,38,8,0.65)]">
                        {stand.stand_no ? `Stand ${stand.stand_no}` : stand.name}
                      </span>
                    </>
                  )}
                  {!p.is_available && (
                    <span className="absolute inset-x-0 bottom-0 bg-[rgba(36,31,46,0.72)] py-[3px] text-center text-[0.5625rem] font-bold text-white">
                      Épuisé
                    </span>
                  )}
                </span>

                <span className="flex flex-col gap-[2px] px-[10px] py-[9px]">
                  <span className="truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
                    {locale === "ar" ? (p.name_ar ?? p.name) : p.name}
                  </span>
                  <span className="truncate text-[0.59375rem] text-[var(--color-muted)]">
                    {stand.name}
                  </span>
                  {p.price != null && (
                    <span dir="ltr" className="flex items-center gap-[6px]">
                      {p.compare_at_price != null && (
                        <span className="text-[0.5625rem] text-[var(--color-faint)] line-through">
                          {formatPrice(p.compare_at_price, locale)}
                        </span>
                      )}
                      <span className="text-[0.75rem] font-bold text-[#8a5a1f]">
                        {formatPrice(p.price, locale)}
                      </span>
                    </span>
                  )}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
