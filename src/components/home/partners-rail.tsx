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
 * elle annonce ce qu'elle est d'un mot, en petit. C'est la même différence
 * qu'entre une vitrine soignée et un homme-sandwich.
 *
 * Les trois boutons mènent aux onglets qui existent déjà sur la fiche de la
 * boutique — produits, promotions — plutôt qu'à des pages nouvelles : ce sont
 * les mêmes données, et une seconde page à tenir à jour finit par diverger.
 */
export function PartnersRail({
  partenaires,
  locale,
}: {
  partenaires: PartenaireAccueil[];
  locale: AppLocale;
}) {
  if (partenaires.length === 0) return null;

  return (
    <div className="no-sb flex gap-3 overflow-x-auto px-4 pb-1">
      {partenaires.map((p) => {
        const nom = locale === "ar" ? (p.name_ar ?? p.name) : p.name;
        const accroche =
          locale === "ar" ? (p.partner_tagline_ar ?? p.partner_tagline) : p.partner_tagline;
        const image = p.banner_url ?? p.cover_url;

        return (
          <article
            key={p.id}
            className="flex w-[290px] flex-none flex-col overflow-hidden rounded-[22px] bg-[var(--color-surface-solid)] shadow-[0_10px_28px_rgba(36,31,46,0.1)]"
          >
            <Link href={`/boutique/${p.slug}`} className="relative block aspect-[16/9]">
              {image ? (
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="290px"
                  className="object-cover"
                />
              ) : (
                <span
                  className="cat-surface flex h-full w-full items-center justify-center"
                  style={{ "--hue": p.category?.hue ?? 300 } as React.CSSProperties}
                />
              )}

              {/* Le voile porte le mot « partenaire » sans le crier. */}
              <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent)] px-3 pt-8 pb-[10px]">
                <span className="text-[0.5rem] font-bold tracking-[0.18em] text-white/80 uppercase">
                  Partenaire
                </span>
              </span>
            </Link>

            <div className="flex flex-col gap-[10px] p-3">
              <div className="flex items-center gap-[10px]">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center overflow-hidden rounded-[13px] bg-[var(--color-app)] text-[0.625rem] font-bold text-[var(--color-muted)]">
                  {p.logo_url ? (
                    <Image src={p.logo_url} alt="" width={38} height={38} className="h-full w-full object-cover" />
                  ) : (
                    monogram(p.name)
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <Link
                    href={`/boutique/${p.slug}`}
                    className="block truncate text-[0.8125rem] font-bold text-[var(--color-ink)]"
                  >
                    {nom}
                  </Link>
                  {accroche && (
                    <span className="block truncate text-[0.625rem] text-[var(--color-muted)]">
                      {accroche}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap gap-[6px]">
                <Bouton href={`/boutique/${p.slug}?onglet=products`}>Voir les produits</Bouton>
                <Bouton href={`/boutique/${p.slug}?onglet=promos`}>Voir les promotions</Bouton>
                {p.accepts_reservations && (
                  <Bouton href={`/boutique/${p.slug}`} accent>
                    Réserver
                  </Bouton>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Bouton({
  href,
  children,
  accent,
}: {
  href: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        accent
          ? "rounded-full bg-[var(--color-brand)] px-[11px] py-[6px] text-[0.625rem] font-bold text-white"
          : "rounded-full border border-[var(--color-outline)] px-[11px] py-[6px] text-[0.625rem] font-bold text-[var(--color-ink)]"
      }
    >
      {children}
    </Link>
  );
}
