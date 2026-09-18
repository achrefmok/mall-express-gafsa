import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate, monogram } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Société Dahmani — Lelma3ardh",
  description:
    "Les exposants de Société Dahmani à Gafsa : leurs stands, leurs produits et leurs prix, consultables même après la fin de l'exposition.",
};

/** Cinq minutes : un exposant ajoute son stand pendant l'événement. */
export const revalidate = 300;

/**
 * Lelma3ardh — l'exposition qui ne ferme pas.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que cette page corrige
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une exposition dure trois jours. Celui qui n'est pas passé n'a rien vu ;
 * celui qui est passé a oublié le nom du stand où il avait repéré quelque
 * chose. Tout le travail d'un exposant — installer, présenter, expliquer —
 * s'évapore à la fermeture des portes.
 *
 * Ici, le stand devient une page qui reste. L'événement physique se termine,
 * la vitrine non : les produits, les prix, le numéro de téléphone et les
 * photos restent consultables. C'est la seule raison d'être de ce module.
 *
 * D'où l'étiquette « Exposition terminée » plutôt qu'une disparition : dire
 * que l'événement est fini est honnête, retirer la page serait recommencer à
 * tout perdre.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi un espace visuellement distinct
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un exposant n'est pas une boutique du mall : on ne commande pas, on ne paie
 * pas, il n'y a ni stock ni livraison. Lui donner l'apparence d'une boutique
 * ferait chercher un panier qui n'existe pas. L'ambre de cette section dit
 * « marché », le violet dit « mall ».
 */
export default async function Lelma3ardhPage() {
  const { locale } = await getT();
  const supabase = await createClient();

  const { data: expos } = await supabase
    .from("expos")
    .select("id, slug, name, name_ar, description, description_ar, place, cover_url, starts_on, ends_on")
    .eq("is_published", true)
    .order("starts_on", { ascending: false })
    .limit(10);

  const { data: exposants } = await supabase
    .from("expo_exhibitors")
    .select("id, expo_id, slug, name, name_ar, logo_url, cover_url, stand_no, images")
    .eq("status", "approved")
    .order("name")
    .limit(200);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <>
      <TopBar title="Lelma3ardh" back="/accueil" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6">
        <header className="flex flex-col gap-1 rounded-[20px] bg-[linear-gradient(135deg,#8a5a1f,#3d2608)] px-4 py-[18px] text-white">
          <span className="text-[0.5625rem] font-bold tracking-[0.2em] text-white/70 uppercase">
            Société Dahmani
          </span>
          <h1 className="text-[1.125rem] font-extrabold tracking-[-0.02em]">Lelma3ardh</h1>
          <p className="text-[0.6875rem] leading-[1.5] text-white/80">
            Les stands de l&apos;exposition, ouverts toute l&apos;année. Le marché ferme, les
            vitrines restent.
          </p>
        </header>

        {(expos ?? []).length === 0 ? (
          <EmptyState
            title="Aucune exposition"
            body="Les éditions et leurs exposants apparaîtront ici."
          />
        ) : (
          (expos ?? []).map((expo) => {
            const siens = (exposants ?? []).filter((x) => x.expo_id === expo.id);
            const terminee = expo.ends_on < aujourdhui;
            const nom = locale === "ar" ? (expo.name_ar ?? expo.name) : expo.name;
            const texte =
              locale === "ar" ? (expo.description_ar ?? expo.description) : expo.description;

            return (
              <section key={expo.id} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{nom}</h2>
                    <Tag>
                      {terminee
                        ? "Exposition terminée"
                        : `${formatDate(expo.starts_on, locale)} → ${formatDate(expo.ends_on, locale)}`}
                    </Tag>
                  </div>
                  {expo.place && (
                    <p className="text-[0.65625rem] text-[var(--color-muted)]">{expo.place}</p>
                  )}
                  {texte && (
                    <p className="text-[0.6875rem] leading-[1.5] text-[var(--color-muted)]">{texte}</p>
                  )}
                </div>

                {siens.length === 0 ? (
                  <EmptyState title="Aucun exposant" body="Les stands seront publiés bientôt." />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {siens.map((x) => {
                      const image = x.cover_url ?? x.images[0] ?? null;
                      return (
                        <Link key={x.id} href={`/lelma3ardh/${x.slug}`} className="block">
                          <Card className="flex flex-col overflow-hidden p-0">
                            <span className="relative block aspect-[4/3] bg-[rgba(138,90,31,0.1)]">
                              {image ? (
                                <Image src={image} alt="" fill sizes="50vw" className="object-cover" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[0.875rem] font-bold text-[rgba(138,90,31,0.5)]">
                                  {monogram(x.name)}
                                </span>
                              )}
                              {x.stand_no && (
                                <span className="absolute start-2 top-2 rounded-full bg-[rgba(0,0,0,0.55)] px-2 py-[3px] text-[0.5625rem] font-bold text-white">
                                  Stand {x.stand_no}
                                </span>
                              )}
                            </span>
                            <span className="block truncate px-[10px] py-[9px] text-[0.71875rem] font-bold text-[var(--color-ink)]">
                              {locale === "ar" ? (x.name_ar ?? x.name) : x.name}
                            </span>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}

      </div>
    </>
  );
}
