import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prochainVendredi, phaseCampagne } from "@/lib/black-friday";
import { lireEtatBlackFriday } from "@/lib/black-friday-server";
import { getT } from "@/lib/i18n/server";
import { AdminBlackFriday, type CampagneAdmin, type OffreAdmin } from "./bf-admin";

export const metadata: Metadata = { title: "Black Friday · Administration", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Le Black Friday vu de l'administration.
 *
 * L'administrateur lit toutes les offres — la policy le lui permet —, y
 * compris celles en préparation et celles déjà terminées : c'est ce qui rend
 * le bilan possible après la fin, et la modération possible avant le début.
 */
export default async function AdminBlackFridayPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const etat = await lireEtatBlackFriday();

  const { data: campagnes } = await supabase
    .from("black_friday_campaigns")
    .select("id, friday_date, starts_at, ends_at, is_enabled")
    .order("friday_date", { ascending: false })
    .limit(12);

  // La campagne à détailler : celle de l'état courant, sinon la plus récente.
  const cible = etat.campagne?.id ?? campagnes?.[0]?.id ?? null;

  const { data: offres } = cible
    ? await supabase
        .from("black_friday_offers")
        .select(
          "id, bf_price, is_enabled, is_moderated, moderation_note, shares_count, shop_id, produit:products(id, name, price, views_count, images), boutique:shops(name, slug)",
        )
        .eq("campaign_id", cible)
    : { data: [] as never[] };

  const maintenant = Date.parse(etat.maintenant);

  const listeCampagnes: CampagneAdmin[] = (campagnes ?? []).map((c) => ({
    id: c.id,
    fridayDate: c.friday_date,
    debut: c.starts_at,
    fin: c.ends_at,
    active: c.is_enabled,
    phase: phaseCampagne(c.starts_at, c.ends_at, maintenant),
  }));

  const listeOffres: OffreAdmin[] = (offres ?? []).map((o) => {
    const produit = o.produit as unknown as {
      id: string; name: string; price: number; views_count: number; images: string[] | null;
    } | null;
    const boutique = o.boutique as unknown as { name: string; slug: string } | null;
    return {
      id: o.id,
      prixBf: Number(o.bf_price),
      prixNormal: Number(produit?.price ?? 0),
      active: o.is_enabled,
      moderee: o.is_moderated,
      note: o.moderation_note,
      partages: o.shares_count,
      vues: produit?.views_count ?? 0,
      produit: produit?.name ?? t.bfAdmin.deletedProduct,
      image: produit?.images?.[0] ?? null,
      boutique: boutique?.name ?? "—",
      boutiqueId: o.shop_id,
    };
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <p className="text-[0.625rem] font-bold tracking-[0.12em] text-[var(--color-faint)] uppercase">
          {t.bfAdmin.kicker}
        </p>
        <h1 className="text-[1.375rem] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
          {t.bf.title}
        </h1>
      </header>

      {!etat.disponible ? (
        <p className="rounded-[16px] bg-[var(--color-live-tint)] p-4 text-[0.8125rem] text-[var(--color-live)]">
          {t.bfAdmin.migrationMissing} <code dir="ltr">20260913001000_black_friday.sql</code>
        </p>
      ) : (
        <AdminBlackFriday
          campagnes={listeCampagnes}
          offres={listeOffres}
          campagneCible={cible}
          vendrediPropose={prochainVendredi(new Date(maintenant))}
        />
      )}
    </div>
  );
}
