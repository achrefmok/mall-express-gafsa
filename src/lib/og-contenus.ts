import "server-only";

import { createStaticClient } from "@/lib/supabase/server";
import { formatPrice, percentOff } from "@/lib/format";
import { pourcentageReduction } from "@/lib/black-friday";
import { offresBfParProduit } from "@/lib/black-friday-server";
import { identifiantProduit } from "@/app/produit/[id]/resoudre";
import type { ContenuPartage } from "@/lib/og";

/**
 * Ce que dit chaque carte de partage, indépendamment de son format.
 *
 * Les aperçus de lien (`opengraph-image.tsx`) et les images Instagram
 * (`/partage/...`) lisent ici : un produit partagé en post Instagram porte
 * exactement le prix de son aperçu WhatsApp. Deux copies de ces requêtes
 * auraient fini par ne plus dire la même chose.
 *
 * Tout est lu avec le client anonyme : c'est ce que verra la personne qui
 * reçoit l'image, donc exactement ce que les policies montrent au public —
 * pas de prix Black Friday avant 00:01, pas de boutique non approuvée.
 *
 * `null` quand rien n'existe à cette adresse : aux appelants de répondre 404
 * ou une carte « introuvable », selon ce qui convient.
 */

export async function contenuProduit(id: string): Promise<ContenuPartage | null> {
  const productId = await identifiantProduit(id);
  if (!productId) return null;

  const supabase = createStaticClient();
  const { data: p } = await supabase
    .from("products")
    .select("id, name, price, compare_at_price, images, shop:shops(name)")
    .eq("id", productId)
    .maybeSingle();

  if (!p) return null;

  const shop = p.shop as unknown as { name: string } | null;
  const prix = Number(p.price);
  // La même lecture que les cartes produit : même règle, même fenêtre.
  const bf = (await offresBfParProduit([p.id], supabase)).get(p.id);

  if (bf) {
    return {
      sombre: true,
      bandeau: "BLACK FRIDAY",
      titre: p.name,
      sousTitre: shop?.name ?? null,
      image: p.images?.[0] ?? null,
      prix: formatPrice(bf.prix),
      ancienPrix: formatPrice(prix),
      reduction: pourcentageReduction(prix, bf.prix),
    };
  }

  return {
    titre: p.name,
    sousTitre: shop?.name ?? null,
    image: p.images?.[0] ?? null,
    prix: formatPrice(prix),
    ancienPrix: p.compare_at_price ? formatPrice(p.compare_at_price) : null,
    reduction: percentOff(prix, p.compare_at_price),
  };
}

export async function contenuBoutique(slug: string): Promise<ContenuPartage | null> {
  const supabase = createStaticClient();

  const { data: s } = await supabase
    .from("shops")
    .select("name, description, logo_url, cover_url, mall_level, mall_unit, category:categories!shops_category_id_fkey(name_fr)")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (!s) return null;

  const categorie = (s.category as unknown as { name_fr: string } | null)?.name_fr ?? null;
  const emplacement =
    s.mall_level !== null && s.mall_unit ? `Niveau ${s.mall_level} · Local ${s.mall_unit}` : null;

  return {
    bandeau: categorie ? categorie.toUpperCase() : "BOUTIQUE",
    titre: s.name,
    sousTitre: emplacement ?? s.description?.slice(0, 90) ?? "Au mall de Gafsa",
    image: s.cover_url ?? s.logo_url,
  };
}

/** L'aperçu du Black Friday : la plus forte remise en cours, ou la date. */
export async function contenuBlackFriday(): Promise<ContenuPartage> {
  const supabase = createStaticClient();

  // La policy ne rend rien au public hors de la fenêtre : hors campagne, la
  // liste est vide et la carte annonce la date.
  const { data } = await supabase
    .from("black_friday_offers")
    .select("bf_price, produit:products!inner(price, images)")
    .eq("is_enabled", true)
    .eq("is_moderated", false)
    .limit(40);

  let meilleure = 0;
  let image: string | null = null;

  for (const o of data ?? []) {
    const p = o.produit as unknown as { price: number; images: string[] | null };
    const r = pourcentageReduction(Number(p.price), Number(o.bf_price)) ?? 0;
    if (r > meilleure) {
      meilleure = r;
      image = p.images?.[0] ?? null;
    }
  }

  const { data: etat } = await supabase.rpc("black_friday_etat");
  const phase = etat?.campagne?.phase ?? null;

  return {
    sombre: true,
    bandeau: "BLACK FRIDAY",
    titre: phase === "actif" && meilleure > 0 ? `Jusqu'à −${meilleure}%` : "24 heures de prix exceptionnels",
    sousTitre:
      phase === "actif"
        ? "Dans les boutiques du mall de Gafsa — aujourd'hui seulement"
        : "Vendredi dès 00:01, dans les boutiques du mall de Gafsa",
    image,
  };
}

/** La fiche d'un chauffeur : sa photo, sa voiture, sa note s'il en a une. */
export async function contenuChauffeur(id: string): Promise<ContenuPartage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = createStaticClient();
  const { data: c } = await supabase.rpc("taxi_profil_public", { p_chauffeur: id });
  if (!c) return null;

  const vehicule = [c.vehicle_brand, c.vehicle_model].filter(Boolean).join(" ") || c.vehicle;
  const note = c.nb_avis && c.note_moyenne ? `★ ${c.note_moyenne} · ${c.nb_avis} avis` : null;

  return {
    bandeau: "TAXI GAFSA",
    titre: c.display_name,
    sousTitre: [vehicule, note ?? `${c.courses_terminees} courses`].filter(Boolean).join(" · "),
    image: c.photo_url,
  };
}
