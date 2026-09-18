import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatPrice, monogram } from "@/lib/format";
import { telHref, whatsAppHref } from "@/lib/contact";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, Tag } from "@/components/ui/primitives";

export const revalidate = 300;

async function lireExposant(slug: string) {
  const supabase = await createClient();
  return supabase
    .from("expo_exhibitors")
    .select(
      `id, slug, name, name_ar, description, description_ar, logo_url, cover_url, images,
       stand_no, phone, whatsapp, facebook_url, instagram, address, status,
       expo:expos!expo_exhibitors_expo_id_fkey(name, name_ar, place, starts_on, ends_on, is_published)`,
    )
    .eq("slug", slug)
    .maybeSingle();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await lireExposant(slug);

  if (!data) return { title: "Exposant introuvable", robots: { index: false, follow: false } };

  return {
    title: `${data.name} — Lelma3ardh`,
    description:
      data.description ?? `Le stand de ${data.name} à Lelma3ardh, Société Dahmani, Gafsa.`,
  };
}

/**
 * Le stand d'un exposant, devenu vitrine permanente.
 *
 * Aucun panier, aucun stock, aucune commande : on regarde, et on appelle. Un
 * exposant n'a ni logistique ni retour, et lui prêter les gestes d'une
 * boutique ferait attendre au visiteur une livraison qui n'existe pas. Les
 * deux seules actions sont donc le téléphone et WhatsApp.
 *
 * L'exposition terminée, la page ne change pas — c'est tout l'objet du
 * module — mais elle le dit : une étiquette, et les dates conservées. Laisser
 * croire qu'un marché clos est encore ouvert serait pire que de le fermer.
 */
export default async function ExposantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale } = await getT();
  const { data: exposant } = await lireExposant(slug);

  if (!exposant || exposant.status !== "approved") notFound();

  const expo = exposant.expo as unknown as {
    name: string;
    name_ar: string | null;
    place: string | null;
    starts_on: string;
    ends_on: string;
    is_published: boolean;
  } | null;

  if (expo && !expo.is_published) notFound();

  const supabase = await createClient();
  const { data: produits } = await supabase
    .from("expo_products")
    .select("id, name, name_ar, description, description_ar, images, price, compare_at_price, is_available")
    .eq("exhibitor_id", exposant.id)
    .order("position")
    .limit(120);

  const nom = locale === "ar" ? (exposant.name_ar ?? exposant.name) : exposant.name;
  const texte =
    locale === "ar" ? (exposant.description_ar ?? exposant.description) : exposant.description;
  const couverture = exposant.cover_url ?? exposant.images[0] ?? null;
  const terminee = expo ? expo.ends_on < new Date().toISOString().slice(0, 10) : false;

  const tel = telHref(exposant.phone);
  const wa = whatsAppHref(exposant.whatsapp ?? exposant.phone, `Bonjour ${exposant.name},`);

  return (
    <>
      <TopBar title={nom} back="/lelma3ardh" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto pb-6">
        <div className="relative aspect-[16/9] w-full bg-[rgba(138,90,31,0.12)]">
          {couverture ? (
            <Image src={couverture} alt="" fill sizes="100vw" className="object-cover" priority />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[1.5rem] font-bold text-[rgba(138,90,31,0.45)]">
              {monogram(exposant.name)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 px-4">
          <h1 className="text-[1.0625rem] font-extrabold tracking-[-0.02em] text-[var(--color-ink)]">
            {nom}
          </h1>

          <div className="flex flex-wrap gap-[6px]">
            {exposant.stand_no && <Tag>Stand {exposant.stand_no}</Tag>}
            {expo && (
              <Tag>
                {terminee
                  ? "Exposition terminée"
                  : `${formatDate(expo.starts_on, locale)} → ${formatDate(expo.ends_on, locale)}`}
              </Tag>
            )}
            {expo?.place && <Tag>{expo.place}</Tag>}
          </div>

          {texte && (
            <p className="text-[0.71875rem] leading-[1.55] text-[var(--color-muted)]">{texte}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {tel && (
              <a
                href={tel}
                dir="ltr"
                className="rounded-full border border-[var(--color-outline)] px-3 py-[7px] text-[0.6875rem] font-bold text-[var(--color-ink)]"
              >
                ☎ {exposant.phone}
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[#e6f4ea] px-3 py-[7px] text-[0.6875rem] font-bold text-[#0f7a3d]"
              >
                WhatsApp
              </a>
            )}
            {exposant.facebook_url && (
              <a
                href={exposant.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[var(--color-outline)] px-3 py-[7px] text-[0.6875rem] font-bold text-[var(--color-ink)]"
              >
                Facebook
              </a>
            )}
            {exposant.instagram && (
              <a
                href={`https://instagram.com/${exposant.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[var(--color-outline)] px-3 py-[7px] text-[0.6875rem] font-bold text-[var(--color-ink)]"
              >
                Instagram
              </a>
            )}
          </div>
        </div>

        <section className="flex flex-col gap-3 px-4">
          <h2 className="text-[0.8125rem] font-bold text-[var(--color-ink)]">Ses produits</h2>

          {(produits ?? []).length === 0 ? (
            <EmptyState title="Aucun produit" body="Ce stand n'a pas encore publié ses articles." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(produits ?? []).map((p) => {
                const image = p.images[0] ?? null;
                const titre = locale === "ar" ? (p.name_ar ?? p.name) : p.name;

                return (
                  <Card key={p.id} className="flex flex-col overflow-hidden p-0">
                    <span className="relative block aspect-square bg-[rgba(138,90,31,0.08)]">
                      {image ? (
                        <Image src={image} alt="" fill sizes="50vw" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[0.625rem] text-[var(--color-faint)]">
                          produit
                        </span>
                      )}
                      {!p.is_available && (
                        <span className="absolute inset-x-0 bottom-0 bg-[rgba(36,31,46,0.72)] py-[3px] text-center text-[0.5625rem] font-bold text-white">
                          Épuisé
                        </span>
                      )}
                    </span>

                    <span className="flex flex-col gap-[2px] px-[10px] py-[9px]">
                      <span className="truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
                        {titre}
                      </span>
                      {p.price != null && (
                        <span dir="ltr" className="flex items-center gap-[6px]">
                          {p.compare_at_price != null && (
                            <span className="text-[0.59375rem] text-[var(--color-faint)] line-through">
                              {formatPrice(p.compare_at_price, locale)}
                            </span>
                          )}
                          <span className="text-[0.75rem] font-bold text-[#8a5a1f]">
                            {formatPrice(p.price, locale)}
                          </span>
                        </span>
                      )}
                    </span>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Link
          href="/lelma3ardh"
          className="mx-4 rounded-full border border-[var(--color-outline)] py-[9px] text-center text-[0.6875rem] font-bold text-[var(--color-ink)]"
        >
          Tous les exposants
        </Link>
      </div>
    </>
  );
}
