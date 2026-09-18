import Image from "next/image";
import Link from "next/link";
import { monogram } from "@/lib/format";
import type { AppLocale } from "@/types/database";

export interface PartenaireAccueil {
  id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  logo_url: string | null;
  banner_url: string | null;
  cover_url: string | null;
  partner_tagline: string | null;
  partner_tagline_ar: string | null;
  accepts_reservations: boolean;
  category: { hue: number } | null;
}

/** Une carte de la rangée : une boutique partenaire, ou un espace entier. */
export interface CartePartenaire {
  cle: string;
  href: string;
  nom: string;
  accroche: string | null;
  image: string | null;
  logo: string | null;
  monogramme: string;
  /** L'ambre de Lelma3ardh, le violet du mall : deux mondes, deux teintes. */
  teinte: "mall" | "expo";
  liens: Array<{ href: string; libelle: string; accent?: boolean }>;
}

/** Une boutique partenaire, telle que la rangée l'attend. */
export function cartePourBoutique(p: PartenaireAccueil, locale: AppLocale): CartePartenaire {
  return {
    cle: p.id,
    href: `/boutique/${p.slug}`,
    nom: locale === "ar" ? (p.name_ar ?? p.name) : p.name,
    accroche: locale === "ar" ? (p.partner_tagline_ar ?? p.partner_tagline) : p.partner_tagline,
    image: p.banner_url ?? p.cover_url,
    logo: p.logo_url,
    monogramme: monogram(p.name),
    teinte: "mall",
    liens: [
      { href: `/boutique/${p.slug}?onglet=products`, libelle: "Voir les produits" },
      { href: `/boutique/${p.slug}?onglet=promos`, libelle: "Voir les promotions" },
      ...(p.accepts_reservations
        ? [{ href: `/boutique/${p.slug}`, libelle: "Réserver", accent: true }]
        : []),
    ],
  };
}

/**
 * Combien de partenaires tiennent sur l'accueil.
 *
 * Une rangée qu'il faut faire glisser six fois n'est pas parcourue : on
 * s'arrête à la troisième carte. Au-delà de quatre, le lien « tout voir »
 * fait mieux le travail.
 */
export const PARTENAIRES_ACCUEIL = 4;

/**
 * Les partenaires de G-Mall, sur l'accueil.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi cette carte ne ressemble pas à une publicité
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un partenaire paie sa place : la tentation est de le faire crier — cadre
 * clignotant, couleur d'alerte, « SPONSORISÉ » en capitales rouges. C'est
 * exactement ce qui le ferait ignorer. L'œil a appris à sauter ce qui a l'air
 * d'une réclame, et un encart qui hurle dessert celui qui l'a payé.
 *
 * La carte emprunte donc le vocabulaire du reste de l'application — mêmes
 * arrondis, mêmes ombres, même typographie — et se distingue par trois choses
 * discrètes : elle est plus grande, elle porte une image pleine largeur, et
 * elle annonce ce qu'elle est d'un mot, en petit.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Une boutique et un espace, dans la même rangée
 * ────────────────────────────────────────────────────────────────────────
 *
 * Dar Elhout est un commerce, Lelma3ardh une exposition entière. Les mettre
 * côte à côte n'est pas un abus : du point de vue du visiteur, ce sont deux
 * partenaires qui lui proposent quelque chose à parcourir. Seule la teinte du
 * bandeau les distingue — violet pour le mall, ambre pour le marché — parce
 * qu'on ne commande pas de la même façon des deux côtés.
 */
export function PartnersRail({
  cartes,
  taille = "grande",
}: {
  cartes: CartePartenaire[];
  /*
    « moyenne » sur l'accueil, « grande » sur la page des partenaires.

    La carte pleine taille prenait les trois quarts de l'écran : on voyait
    un partenaire et un bout du suivant, sans deviner qu'il y en avait
    d'autres. Plus étroite, elle en montre deux — et deux cartes côte à
    côte disent « ceci est une liste », ce qu'une seule ne dit pas.
  */
  taille?: "moyenne" | "grande";
}) {
  const large = taille === "grande";
  if (cartes.length === 0) return null;

  return (
    <div className="no-sb flex gap-3 overflow-x-auto px-4 pb-1">
      {cartes.map((c) => (
        <article
          key={c.cle}
          className={
            "flex flex-none flex-col overflow-hidden bg-[var(--color-surface-solid)] " +
            (large
              ? "w-[290px] rounded-[22px] shadow-[0_10px_28px_rgba(36,31,46,0.1)]"
              : "w-[216px] rounded-[18px] shadow-[0_7px_20px_rgba(36,31,46,0.08)]")
          }
        >
          <Link href={c.href} className={large ? "relative block aspect-[16/9]" : "relative block aspect-[3/2]"}>
            {c.image ? (
              <Image src={c.image} alt="" fill sizes={large ? "290px" : "216px"} className="object-cover" />
            ) : (
              <span
                className={
                  c.teinte === "expo"
                    ? "block h-full w-full bg-[linear-gradient(135deg,#b07a2a,#3d2608)]"
                    : "block h-full w-full bg-[image:var(--gradient-brand)]"
                }
              />
            )}

            {/* Le voile porte le mot « partenaire » sans le crier. */}
            <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent)] px-3 pt-8 pb-[10px]">
              <span className="text-[0.5rem] font-bold tracking-[0.18em] text-white/80 uppercase">
                {c.teinte === "expo" ? "Partenaire · exposition" : "Partenaire"}
              </span>
            </span>
          </Link>

          <div className={large ? "flex flex-col gap-[10px] p-3" : "flex flex-col gap-2 p-[10px]"}>
            <div className="flex items-center gap-[10px]">
              <span
                className={
                  (large
                    ? "flex h-[38px] w-[38px] flex-none items-center justify-center overflow-hidden rounded-[13px] text-[0.625rem] font-bold "
                    : "flex h-[30px] w-[30px] flex-none items-center justify-center overflow-hidden rounded-[10px] text-[0.5625rem] font-bold ") +
                  (c.teinte === "expo"
                    ? "bg-[rgba(138,90,31,0.14)] text-[#8a5a1f]"
                    : "bg-[var(--color-app)] text-[var(--color-muted)]")
                }
              >
                {c.logo ? (
                  <Image src={c.logo} alt="" width={38} height={38} className="h-full w-full object-cover" />
                ) : (
                  c.monogramme
                )}
              </span>

              <span className="min-w-0 flex-1">
                <Link
                  href={c.href}
                  className={
                    large
                      ? "block truncate text-[0.8125rem] font-bold text-[var(--color-ink)]"
                      : "block truncate text-[0.71875rem] font-bold text-[var(--color-ink)]"
                  }
                >
                  {c.nom}
                </Link>
                {c.accroche && (
                  <span className="block truncate text-[0.625rem] text-[var(--color-muted)]">
                    {c.accroche}
                  </span>
                )}
              </span>
            </div>

            <div className="flex flex-wrap gap-[6px]">
              {(large ? c.liens : c.liens.slice(-1)).map((lien) => (
                <Link
                  key={lien.href + lien.libelle}
                  href={lien.href}
                  className={
                    lien.accent
                      ? `rounded-full px-[11px] py-[6px] text-[0.625rem] font-bold text-white ${
                          c.teinte === "expo" ? "bg-[#8a5a1f]" : "bg-[var(--color-brand)]"
                        }`
                      : "rounded-full border border-[var(--color-outline)] px-[11px] py-[6px] text-[0.625rem] font-bold text-[var(--color-ink)]"
                  }
                >
                  {lien.libelle}
                </Link>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
