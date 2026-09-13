import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { lireEtatBlackFriday } from "@/lib/black-friday-server";
import { TopBar } from "@/components/shell/top-bar";
import { CompteARebours } from "@/components/black-friday/countdown";
import { GestionBlackFriday, type OffreBoutique, type ProduitBoutique } from "./bf-manager";

export const metadata: Metadata = { title: "Black Friday", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Le Black Friday de la boutique.
 *
 * L'état de la campagne vient du serveur, et c'est lui qui décide si
 * l'écran est modifiable. L'interface le reflète — champs verrouillés après
 * la fin — mais le verrou réel est le déclencheur `black_friday_garde`, qui
 * refuse toute écriture sur une campagne terminée, quelle que soit la route
 * empruntée.
 */
export default async function BlackFridayVendeur() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { t, locale } = await getT();
  const supabase = await createClient();
  const etat = await lireEtatBlackFriday();
  const campagne = etat.campagne;

  const [produits, offres] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, stock, images, is_online, is_draft")
      .eq("shop_id", shop.id)
      .order("name"),
    campagne
      ? supabase
          .from("black_friday_offers")
          .select("id, product_id, bf_price, is_enabled, is_moderated, moderation_note, shares_count")
          .eq("shop_id", shop.id)
          .eq("campaign_id", campagne.id)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const listeProduits: ProduitBoutique[] = (produits.data ?? []).map((p) => ({
    id: p.id,
    nom: p.name,
    prix: Number(p.price),
    stock: p.stock,
    image: p.images?.[0] ?? null,
    visible: p.is_online && !p.is_draft,
  }));

  const listeOffres: OffreBoutique[] = (offres.data ?? []).map((o) => ({
    id: o.id,
    produitId: o.product_id,
    prixBf: Number(o.bf_price),
    active: o.is_enabled,
    moderee: o.is_moderated,
    noteModeration: o.moderation_note,
    partages: o.shares_count,
  }));

  return (
    <>
      <TopBar title="Black Friday" back="/vendeur" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        {!etat.disponible && (
          <p className="rounded-[16px] bg-[var(--color-live-tint)] p-4 text-[0.8125rem] text-[var(--color-live)]">
            {t.bfVendor.notEnabled}
          </p>
        )}

        {etat.disponible && !campagne && (
          <p className="rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4 text-[0.8125rem] text-[var(--color-muted)]">
            {t.bfVendor.noCampaign}
          </p>
        )}

        {campagne && (
          <section className="rounded-[20px] bg-[linear-gradient(135deg,#0d0b10_0%,#241f2e_60%,#5a3a78_100%)] p-4 text-white">
            <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
              {campagne.phase === "avant" && t.bfVendor.phaseScheduled}
              {campagne.phase === "actif" && t.bfVendor.phaseRunning}
              {campagne.phase === "termine" && t.bfVendor.phaseEnded}
            </p>
            <p className="mt-1 text-[1.0625rem] font-extrabold">
              {format(t.bfVendor.fridayLine, { date: formatDate(campagne.debut, locale) })}
            </p>

            {campagne.phase !== "termine" ? (
              <div className="mt-3">
                <CompteARebours
                  cible={campagne.phase === "actif" ? campagne.fin : campagne.debut}
                  serveurMaintenant={etat.maintenant}
                  libelle={campagne.phase === "actif" ? t.bf.endsIn : t.bf.startsIn}
                  variante="sombre"
                />
              </div>
            ) : (
              <p className="mt-2 text-[0.75rem] text-white/75">
                {t.bfVendor.lockedNote}
              </p>
            )}
          </section>
        )}

        {campagne && (
          <GestionBlackFriday
            produits={listeProduits}
            offres={listeOffres}
            phase={campagne.phase}
            locale={locale}
          />
        )}
      </div>
    </>
  );
}
