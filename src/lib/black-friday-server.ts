import "server-only";

import { createClient, createStaticClient } from "@/lib/supabase/server";
import { pourcentageReduction, type PhaseCampagne, type PrixBf } from "@/lib/black-friday";

/**
 * Lire le Black Friday depuis le serveur.
 *
 * Un seul point d'entrée pour l'accueil, la page dédiée, la fiche produit et
 * le panier. Ce qui compte : tous affichent **le prix que `place_order`
 * facturera**. Si l'un d'eux calculait le sien, ils finiraient par diverger
 * — et le client verrait 149 DT sur la fiche, 250 DT au panier.
 *
 * Chaque lecture tolère l'absence de la migration : sans les tables, le Black
 * Friday n'existe simplement pas, et rien d'autre ne tombe avec lui.
 */

/** Ce que PostgREST répond quand les tables ou la fonction n'existent pas. */
const MIGRATION_ABSENTE = ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"];

export interface EtatBlackFriday {
  /** Faux tant que la migration n'est pas collée. */
  disponible: boolean;
  /** L'heure du serveur, pour caler le compte à rebours. */
  maintenant: string;
  campagne: {
    id: string;
    fridayDate: string;
    debut: string;
    fin: string;
    phase: Exclude<PhaseCampagne, "aucune">;
  } | null;
}

export async function lireEtatBlackFriday(): Promise<EtatBlackFriday> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("black_friday_etat");

  if (error || !data) {
    return {
      disponible: !error || !MIGRATION_ABSENTE.includes(error.code),
      maintenant: new Date().toISOString(),
      campagne: null,
    };
  }

  const c = data.campagne;

  return {
    disponible: true,
    maintenant: data.now,
    campagne: c
      ? { id: c.id, fridayDate: c.friday_date, debut: c.starts_at, fin: c.ends_at, phase: c.phase }
      : null,
  };
}

export interface OffreVitrine {
  id: string;
  prixBf: number;
  prixNormal: number;
  reduction: number | null;
  stock: number;
  produit: { id: string; name: string; image: string | null };
  boutique: { name: string; slug: string; logoUrl: string | null };
}

/**
 * Les offres en vigueur, pour l'accueil et la page Black Friday.
 *
 * Les conditions de fenêtre sont répétées ici alors que la policy les pose
 * déjà pour le public. Ce n'est pas une redondance : la policy laisse aussi
 * passer, pour un commerçant, **ses propres** offres en préparation. Sans
 * ces filtres, un vendeur connecté verrait sur l'accueil ses brouillons
 * présentés comme des offres en cours.
 */
export async function lireOffresActives(limite = 12): Promise<OffreVitrine[]> {
  const supabase = await createClient();
  const maintenant = new Date().toISOString();

  const { data, error } = await supabase
    .from("black_friday_offers")
    .select(
      `id, bf_price,
       campagne:black_friday_campaigns!inner(is_enabled, starts_at, ends_at),
       produit:products!inner(id, name, price, images, stock, is_online, is_draft),
       boutique:shops!inner(name, slug, logo_url, status)`,
    )
    .eq("is_enabled", true)
    .eq("is_moderated", false)
    .eq("campagne.is_enabled", true)
    .lte("campagne.starts_at", maintenant)
    .gt("campagne.ends_at", maintenant)
    .eq("produit.is_online", true)
    .eq("produit.is_draft", false)
    .eq("boutique.status", "approved")
    .limit(limite);

  if (error || !data) return [];

  return data
    .map((o) => {
      const produit = o.produit as unknown as {
        id: string; name: string; price: number; images: string[] | null; stock: number;
      };
      const boutique = o.boutique as unknown as { name: string; slug: string; logo_url: string | null };
      const prixNormal = Number(produit.price);
      const prixBf = Number(o.bf_price);

      return {
        id: o.id,
        prixBf,
        prixNormal,
        reduction: pourcentageReduction(prixNormal, prixBf),
        stock: produit.stock,
        produit: { id: produit.id, name: produit.name, image: produit.images?.[0] ?? null },
        boutique: { name: boutique.name, slug: boutique.slug, logoUrl: boutique.logo_url },
      };
    })
    // Les plus fortes réductions d'abord : c'est ce qu'on vient chercher.
    .sort((a, b) => (b.reduction ?? 0) - (a.reduction ?? 0));
}

type ClientLecture = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createStaticClient>;

/**
 * Les offres Black Friday en vigueur pour une liste de produits, avec leur
 * fenêtre.
 *
 * La seule lecture des prix BF par produit : la fiche, le panier et toutes
 * les cartes produit passent par ici. La même règle que `place_order` —
 * l'offre activée, non modérée, dans la fenêtre, et, si deux campagnes se
 * chevauchaient, le prix le plus bas. Une seule requête pour une grille
 * entière, plutôt qu'une par carte.
 *
 * `client` : les pages mises en cache (la boutique) passent le client
 * anonyme, qui ne lit pas les cookies — le client de session rendrait la
 * page dynamique à chaque visite.
 */
export async function offresBfParProduit(
  productIds: string[],
  client?: ClientLecture,
): Promise<Map<string, PrixBf>> {
  const resultat = new Map<string, PrixBf>();
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return resultat;

  const supabase = client ?? (await createClient());
  const maintenant = new Date().toISOString();

  const { data, error } = await supabase
    .from("black_friday_offers")
    .select("product_id, bf_price, campagne:black_friday_campaigns!inner(is_enabled, starts_at, ends_at)")
    .in("product_id", ids)
    .eq("is_enabled", true)
    .eq("is_moderated", false)
    .eq("campagne.is_enabled", true)
    .lte("campagne.starts_at", maintenant)
    .gt("campagne.ends_at", maintenant);

  if (error || !data) return resultat;

  for (const o of data) {
    const c = o.campagne as unknown as { starts_at: string; ends_at: string };
    const prix = Number(o.bf_price);
    const actuel = resultat.get(o.product_id);
    if (actuel === undefined || prix < actuel.prix) {
      resultat.set(o.product_id, { prix, debut: c.starts_at, fin: c.ends_at });
    }
  }

  return resultat;
}

/** Le prix seul, pour la fiche et le panier. */
export async function prixBlackFriday(productIds: string[]): Promise<Map<string, number>> {
  const offres = await offresBfParProduit(productIds);
  return new Map([...offres].map(([id, o]) => [id, o.prix]));
}

/**
 * Pose le prix BF sur chaque produit d'une liste, pour `ProductCard`.
 *
 * Hors campagne la requête rend une liste vide et chaque produit reçoit
 * `bf: null` : la carte s'affiche exactement comme avant.
 */
export async function avecBlackFriday<T extends { id: string }>(
  produits: T[],
  client?: ClientLecture,
): Promise<Array<T & { bf: PrixBf | null }>> {
  const offres = await offresBfParProduit(produits.map((p) => p.id), client);
  return produits.map((p) => ({ ...p, bf: offres.get(p.id) ?? null }));
}
