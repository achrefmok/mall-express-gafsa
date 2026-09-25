import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import {
  PartnersRail,
  cartePourBoutique,
  type CartePartenaire,
  type PartenaireAccueil,
} from "@/components/home/partners-rail";

export const metadata: Metadata = {
  title: "Nos partenaires",
  description:
    "Les commerces et les espaces partenaires de G-Mall à Gafsa : leurs produits, leurs promotions et leurs réservations.",
};

export const revalidate = 300;

/**
 * Tous les partenaires, en pleine largeur.
 *
 * L'accueil n'en montre que quatre, en cartes resserrées : au-delà, une
 * rangée qu'il faut faire glisser six fois n'est plus parcourue. Ici, la
 * place ne manque pas — les cartes reprennent leur taille pleine, et leurs
 * trois boutons plutôt qu'un seul.
 *
 * Une grille plutôt qu'une rangée : on vient ici pour comparer, pas pour
 * jeter un œil en passant.
 */
export default async function PartenairesPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [boutiques, edition, exposants] = await Promise.all([
    supabase
      .from("shops")
      .select(
        `id, slug, name, name_ar, logo_url, banner_url, cover_url,
         partner_tagline, partner_tagline_ar, accepts_reservations,
         category:categories!shops_category_id_fkey(hue)`,
      )
      .eq("status", "approved")
      .eq("is_partner", true)
      .order("partner_rank", { ascending: true, nullsFirst: false })
      .order("approved_at", { ascending: false })
      .limit(60),

    supabase
      .from("expos")
      .select("id, name, place, cover_url")
      .eq("is_published", true)
      .order("starts_on", { ascending: false })
      .limit(1),

    supabase.from("expo_exhibitors").select("id").eq("status", "approved").limit(200),
  ]);

  const cartes: CartePartenaire[] = ((boutiques.data ?? []) as unknown as PartenaireAccueil[]).map(
    (p) => cartePourBoutique(p, locale),
  );

  const enCours = edition.data?.[0];
  if (enCours && (exposants.data ?? []).length > 0) {
    cartes.push({
      cle: enCours.id,
      href: "/lelma3ardh",
      nom: "شركة الدحماني — للمعارض",
      accroche: `${(exposants.data ?? []).length} عارض · ${enCours.place ?? "قفصة"}`,
      image: enCours.cover_url,
      logo: null,
      monogramme: "SD",
      teinte: "expo",
      liens: [
        { href: "/lelma3ardh", libelle: "مشاهدة الأجنحة" },
        { href: "/lelma3ardh?vue=produits", libelle: "مشاهدة المنتجات", accent: true },
      ],
    });
  }

  return (
    <>
      <TopBar title={t.home.partners} back="/accueil" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto pt-3 pb-6">
        <p className="px-4 text-[0.6875rem] leading-[1.55] text-[var(--color-muted)]">
          Les commerces et les espaces qui soutiennent G-Mall.
        </p>

        {cartes.length === 0 ? (
          <EmptyState title={t.common.empty} body="Aucun partenaire pour le moment." />
        ) : (
          /*
            La même carte que l'accueil, en pleine taille, mais empilée : la
            rangée horizontale sert à faire entrevoir ; une page sert à faire
            le tour.
          */
          <div className="flex flex-col gap-4">
            {cartes.map((c) => (
              <PartnersRail key={c.cle} cartes={[c]} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
