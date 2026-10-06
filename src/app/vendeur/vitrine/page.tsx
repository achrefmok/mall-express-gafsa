import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMyShop } from "@/lib/queries";
import { resolveTheme } from "@/lib/boutique-themes";
import {
  lireAttributsProduits,
  lireMatieresProduits,
  lirePacksBoutique,
  lireRepereLookbook,
  lireStoriesBoutique,
  lireZonesLivraison,
} from "@/lib/boutique-themes/attributs-server";
import { calculerCompletude, type DonneesCompletude } from "@/lib/vitrine-completude";
import { VitrineClient } from "./vitrine-client";

export const metadata: Metadata = {
  title: "Ma vitrine",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Une clé d'attribut par métier — celle que sa mise en page lit réellement. */
const CLES_PAR_METIER: Record<string, string[]> = {
  mode: ["type"],
  electronique: ["stockage", "ecran", "batterie"],
  beaute: ["famille_olfactive", "note_tete", "note_coeur", "note_fond", "peau", "etape"],
  maison: ["piece"],
  parapharmacie: ["besoin"],
};

/**
 * Écran vendeur « Ma vitrine » : guide de complétude par catégorie, gestion
 * des stories, réglages propres au métier (palier de livraison, remise
 * routine, paliers de pack, paiement en plusieurs fois).
 *
 * Pas d'aperçu en direct au sens strict (monter `BoutiqueContenu` avec des
 * données en cours de saisie demanderait de reproduire toute la mécanique
 * de thème/props de la page boutique) : l'aperçu montre les stories et la
 * barre de livraison telles qu'elles apparaîtront réellement, à partir de
 * l'état du formulaire — pas la grille de produits, qui ne change pas ici.
 */
export default async function VendorVitrinePage() {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const supabase = await createClient();
  const theme = resolveTheme(shop.category?.slug);

  const [
    stories,
    { count: nbHoraires },
    { data: promoActive },
    { count: produitsTotal },
    { data: produitsComplets },
    packs,
    zones,
    lookbookExistant,
  ] = await Promise.all([
    lireStoriesBoutique(supabase, shop.id),
    supabase.from("shop_hours").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("is_closed", false),
    supabase
      .from("promotions")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .gte("ends_at", new Date().toISOString())
      .limit(1)
      .maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    // Jeu complet pour l'aperçu en direct — mêmes colonnes que la page
    // boutique publique (src/app/boutique/[slug]/page.tsx).
    supabase
      .from("products")
      .select(
        "id, name, price, compare_at_price, images, stock, sizes, colors, created_at, category:categories(hue, slug, name_fr, name_ar)",
      )
      .eq("shop_id", shop.id)
      .eq("is_online", true)
      .eq("is_draft", false)
      .order("sold_count", { ascending: false })
      .limit(24),
    theme.id === "parapharmacie" ? lirePacksBoutique(supabase, shop.id) : Promise.resolve([]),
    theme.id === "services" ? lireZonesLivraison(supabase, shop.id) : Promise.resolve([]),
    theme.id === "mode" ? lireRepereLookbook(supabase, shop.id, "lookbook") : Promise.resolve(null),
  ]);

  const produits = (produitsComplets ?? []).map((p) => ({ id: p.id }));

  const clesMetier = CLES_PAR_METIER[theme.id] ?? [];
  let produitsAvecAttributCle = 0;
  /*
    `product_variants`/`product_attributes` n'existent pas encore dans les
    types générés (migrations collées manuellement, voir le projet) —
    client non typé pour ces deux lectures seulement, même choix qu'ailleurs
    (ex. `upsertProductAttributes` dans vendor.ts).
  */
  const clientNonType = supabase as unknown as SupabaseClient;

  if (theme.id === "bijouterie") {
    const { data: variantes } = await clientNonType
      .from("product_variants")
      .select("product_id")
      .not("material", "is", null)
      .in("product_id", (produits ?? []).map((p) => p.id));
    produitsAvecAttributCle = new Set((variantes ?? []).map((v: { product_id: string }) => v.product_id)).size;
  } else if (clesMetier.length > 0 && produits && produits.length > 0) {
    const { data: attributs } = await clientNonType
      .from("product_attributes")
      .select("product_id, key")
      .in("product_id", produits.map((p) => p.id))
      .in("key", clesMetier);
    produitsAvecAttributCle = new Set((attributs ?? []).map((a: { product_id: string }) => a.product_id)).size;
  }

  const donnees: DonneesCompletude = {
    hasCover: Boolean(shop.banner_url || shop.cover_url),
    hasLogo: Boolean(shop.logo_url),
    hasHoraires: (nbHoraires ?? 0) > 0,
    // Propriétaire : RLS lui rend toutes ses stories, pas seulement celles
    // dans leur fenêtre — suffisant comme indicateur de complétude (il en
    // a créé au moins une), la vraie fenêtre ne concerne que l'affichage
    // public.
    storiesActives: stories.length,
    offreActive: Boolean(promoActive),
    produitsTotal: produitsTotal ?? 0,
    produitsAvecAttributCle,
    packsPrets: packs.length,
    zonesLivraison: zones.length,
  };

  const completude = calculerCompletude(theme.id, donnees);

  // Enrichissement pour l'aperçu en direct — mêmes deux lectures que la
  // page boutique publique, jamais inventées pour l'occasion.
  const idsPourApercu = (produitsComplets ?? []).map((p) => p.id);
  const [attributsApercu, materiauxApercu] = await Promise.all([
    lireAttributsProduits(supabase, idsPourApercu),
    theme.id === "bijouterie" ? lireMatieresProduits(supabase, idsPourApercu) : Promise.resolve(new Map<string, string[]>()),
  ]);
  const produitsApercu = (produitsComplets ?? []).map((p) => ({
    ...p,
    attributs: attributsApercu.get(p.id),
    materiaux: materiauxApercu.get(p.id),
  }));

  const enTeteApercu = shop.banner_url ?? shop.cover_url;

  return (
    <VitrineClient
      shop={{
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        freeDeliveryThreshold: shop.free_delivery_threshold,
        installments: shop.installments,
        routineDiscount: shop.routine_discount,
        packTiers: shop.pack_tiers,
      }}
      themeId={theme.id}
      theme={theme}
      stories={stories}
      completude={completude}
      produitsApercu={produitsApercu}
      enTeteApercu={enTeteApercu}
      packs={packs}
      zones={zones}
      lookbook={lookbookExistant}
      produitsPourRepere={(produitsComplets ?? []).map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
