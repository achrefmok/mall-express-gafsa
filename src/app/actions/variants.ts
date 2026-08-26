"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireShopOwner } from "./_helpers";
import { createAdminClient, createStaticClient } from "@/lib/supabase/server";
import { planGeneration } from "@/lib/variants";
import { recolorGarment, type RecolorReason } from "@/lib/garment-recolor";
import type { VariantImages } from "@/types/database";

/**
 * Les coloris d'un article : ceux que le vendeur photographie, et ceux qu'on
 * fabrique pour lui.
 *
 * **Ce qui est fabriqué est un fichier image, au même titre qu'une photo
 * déposée.** Rien n'est recoloré à l'affichage : la fiche ne sait pas
 * distinguer une image fabriquée d'une vraie, elle affiche des adresses. C'est
 * ce qui permet à l'animation de traiter les deux exactement pareil, et c'est ce
 * qui rend la promesse tenable — la couleur est dans le fichier, pas dans un
 * filtre appliqué par-dessus le mannequin.
 *
 * La recoloration elle-même, et surtout la façon dont elle épargne le visage et
 * les mains, vit dans `lib/garment-recolor`. Ici on orchestre : quoi fabriquer,
 * à partir de quoi, et surtout **en deux temps**.
 *
 * ## Pourquoi deux temps
 *
 * Fabriquer et publier d'un seul geste mettait le vendeur devant le fait
 * accompli : ses coloris partaient en ligne avant qu'il ait pu les regarder. La
 * fabrication produit donc des propositions — de vrais fichiers, déjà déposés,
 * mais que rien ne relie encore au produit. Le vendeur les voit, puis publie ou
 * jette. Tant qu'il n'a pas publié, la fiche client ne montre rien de nouveau.
 */

/** Bornes de sécurité : une fabrication ne doit jamais bloquer une requête. */
const MAX_PAR_APPEL = 8;
const TAILLE_MAX = 8 * 1024 * 1024;

export interface VariantProposal {
  color: string;
  url: string;
  /** Photo dont elle a été tirée, pour savoir plus tard si elle a vieilli. */
  from: string;
}

/* ─── 1. Fabriquer ─────────────────────────────────────────────────────── */

/**
 * Fabrique les coloris manquants et les propose, sans rien publier.
 *
 * Ce que la fonction refuse de faire, et c'est délibéré :
 *
 *   · elle ne remplace jamais une vraie photo du vendeur ;
 *   · elle ne repart jamais d'une image déjà fabriquée ;
 *   · elle ne propose rien dont le moteur n'a pas pu établir que la peau, les
 *     cheveux et le décor étaient intacts. Le coloris reste alors sans photo, ce
 *     qui est honnête, plutôt qu'illustré par un mannequin décoloré.
 */
export async function previewVariantImages(productId: string) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { data: product, error: readError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (readError) return fail(readableError(readError));
  if (!product) return fail("Produit introuvable");

  if (!("variant_images" in product)) {
    return fail(
      "Migration requise : ajoutez la colonne « variant_images » avant de fabriquer des coloris.",
    );
  }

  const plans = planGeneration(
    product.colors ?? [],
    product.images ?? [],
    product.variant_images ?? {},
  ).slice(0, MAX_PAR_APPEL);

  if (plans.length === 0) return ok({ proposals: [] as VariantProposal[], refused: [] as string[] });

  /*
    La photo de référence est téléchargée une seule fois.

    Tous les coloris en dérivent ; la reprendre à chaque tour ferait huit allers
    et retours vers le stockage, sur une requête qui a déjà de l'image à
    traiter.
  */
  let source: Buffer;
  try {
    const reponse = await fetch(plans[0].sourceUrl);
    if (!reponse.ok) return fail("La photo du produit n'a pas pu être relue.");

    source = Buffer.from(await reponse.arrayBuffer());
    if (source.byteLength > TAILLE_MAX) {
      return fail("La photo du produit est trop lourde pour être déclinée.");
    }
  } catch {
    return fail("La photo du produit n'a pas pu être relue.");
  }

  const proposals: VariantProposal[] = [];
  const refused: string[] = [];
  const motifs = new Set<RecolorReason>();

  for (const plan of plans) {
    const resultat = await recolorGarment(source, plan.color);

    if (!resultat.ok) {
      refused.push(plan.color);
      motifs.add(resultat.reason);
      continue;
    }

    const chemin = `${shop.owner_id}/${crypto.randomUUID()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(chemin, resultat.data, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      refused.push(plan.color);
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("products").getPublicUrl(chemin);

    proposals.push({ color: plan.color, url: publicUrl, from: plan.sourceUrl });
  }

  if (proposals.length === 0) return fail(messageEchec(motifs));

  return ok({ proposals, refused });
}

/* ─── 2. Publier, ou jeter ─────────────────────────────────────────────── */

/**
 * Rattache au produit les coloris que le vendeur vient d'approuver.
 *
 * Les adresses sont revérifiées avant d'être écrites : elles doivent désigner le
 * dossier de stockage de ce commerçant. La fonction reçoit ce que le navigateur
 * lui envoie, et un navigateur peut envoyer n'importe quoi — sans ce contrôle,
 * on pourrait faire pointer un coloris vers l'image d'un autre.
 */
export async function publishVariantImages(productId: string, proposals: VariantProposal[]) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const { data: product, error: readError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (readError) return fail(readableError(readError));
  if (!product) return fail("Produit introuvable");
  if (!("variant_images" in product)) return fail("Migration requise pour publier les coloris.");

  const {
    data: { publicUrl: racine },
  } = supabase.storage.from("products").getPublicUrl(`${shop.owner_id}/`);

  const couleurs: string[] = product.colors ?? [];
  const suivant: VariantImages = { ...(product.variant_images ?? {}) };
  const horodatage = new Date().toISOString();
  let ecrits = 0;

  for (const proposition of proposals) {
    if (!proposition.url.startsWith(racine)) continue;
    if (!couleurs.includes(proposition.color)) continue;

    // La règle du sens unique : une vraie photo n'est jamais recouverte par une
    // fabrication, même approuvée entre-temps.
    const existante = suivant[proposition.color];
    if (existante && !existante.generated) continue;

    suivant[proposition.color] = {
      url: proposition.url,
      generated: true,
      from: proposition.from,
      at: horodatage,
    };
    ecrits++;
  }

  if (ecrits === 0) return fail("Aucun coloris à publier.");

  const { error: writeError } = await supabase
    .from("products")
    .update({ variant_images: suivant })
    .eq("id", productId)
    .eq("shop_id", shop.id);

  if (writeError) return fail(readableError(writeError));

  revalidatePath(`/produit/${productId}`);
  revalidatePath("/vendeur/produits");

  return ok({ variants: suivant, ecrits });
}

/**
 * Efface les propositions que le vendeur n'a pas retenues.
 *
 * Elles ont bien été déposées dans le stockage — c'est ce qui permet de les lui
 * montrer telles qu'elles seraient publiées, et non redimensionnées ou
 * réencodées pour l'occasion. Refuser doit donc les retirer, sans quoi chaque
 * essai laisserait huit fichiers derrière lui.
 */
export async function discardVariantPreviews(urls: string[]) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  const prefixe = `${shop.owner_id}/`;
  const chemins = urls
    .map((url) => {
      const marque = "/products/";
      const rang = url.indexOf(marque);
      return rang === -1 ? null : url.slice(rang + marque.length);
    })
    .filter((chemin): chemin is string => chemin !== null && chemin.startsWith(prefixe));

  if (chemins.length === 0) return done();

  await supabase.storage.from("products").remove(chemins);
  return done();
}

/* ─── À la demande, pour le client qui regarde ─────────────────────────── */

/*
  Les fabrications en cours, pour n'en lancer qu'une par coloris.

  Deux clients qui touchent « jaune » à la même seconde déclenchaient deux fois
  le même travail : deux décodages, deux recolorations, deux fichiers dans le
  stockage dont un orphelin. La carte retient la promesse en cours et les fait
  attendre la même.

  Elle ne vaut que pour une instance du serveur — deux régions Vercel peuvent
  encore se croiser. Le garde-fou de fond est ailleurs : on relit la base juste
  avant d'écrire, et une image déjà enregistrée l'emporte sur celle qu'on vient
  de produire.
*/
const enCours = new Map<string, Promise<string | null>>();

/*
  Un plafond sur le nombre de recolorations par minute.

  `ensureVariantImage` est la seule action serveur sans garde d'identité, et
  c'est délibéré : la génération à la demande sert la fiche produit publique,
  qu'un visiteur consulte sans compte. Mais elle enchaîne un téléchargement, un
  traitement pixel par pixel et une écriture dans le stockage.

  Les garde-fous existants bornent la répétition — la couleur doit figurer parmi
  celles que le vendeur a déclarées, les appels concurrents sur la même clé sont
  dédoublonnés, et le résultat est mis en cache dès la première fois. Ils ne
  bornaient pas l'**étendue** : parcourir le catalogue en demandant chaque
  coloris non encore généré déclenchait autant de traitements, sans que rien ne
  s'y oppose.

  Vingt par minute laisse passer la navigation la plus curieuse — un visiteur ne
  regarde pas vingt coloris inédits en soixante secondes — et divise par
  plusieurs ordres de grandeur ce qu'un balayage automatique peut coûter. Comme
  la carte ci-dessus, le compteur ne vaut que pour une instance ; c'est une
  limite de coût, pas une frontière de sécurité, et le refus reste gracieux.
*/
const PLAFOND_PAR_MINUTE = 20;
const recentes: number[] = [];

function plafondAtteint(maintenant = Date.now()): boolean {
  const depuis = maintenant - 60_000;
  while (recentes.length > 0 && recentes[0] < depuis) recentes.shift();
  return recentes.length >= PLAFOND_PAR_MINUTE;
}

/**
 * L'image d'un coloris — celle qui existe, ou celle qu'on fabrique à l'instant.
 *
 * C'est ce que la fiche appelle quand le client touche une couleur qui n'a pas
 * encore d'image. Auparavant, la galerie s'arrêtait à « coloris sans photo » et
 * remplaçait l'article par une pastille : le produit disparaissait de sa propre
 * fiche. Fabriquer à la demande est la seule réponse acceptable — le vêtement
 * doit rester visible, dans la couleur demandée.
 *
 * **Pourquoi une écriture à privilèges pour un simple visiteur.** La lecture se
 * fait sous RLS, avec la clé publique : un produit hors ligne ou en brouillon
 * reste donc invisible, et rien de ce qui suit n'a lieu. L'écriture, elle, doit
 * franchir les policies puisque le visiteur n'est pas le commerçant. Elle est
 * bornée à ce qu'un visiteur peut légitimement provoquer :
 *
 *   · le produit doit être visible de lui ;
 *   · le coloris doit figurer dans ceux que le vendeur a déclarés ;
 *   · une image déjà présente n'est jamais remplacée ;
 *   · le contenu écrit est dérivé de la photo du produit, rien d'autre.
 *
 * Le travail est donc plafonné par le nombre de coloris de l'article : une fois
 * les six fabriqués, tous les appels suivants ne font plus qu'une lecture.
 */
export async function ensureVariantImage(productId: string, color: string) {
  const cle = `${productId}|${color}`;
  const dejaLa = enCours.get(cle);
  if (dejaLa) return ok({ url: await dejaLa });

  /*
    Le refus est gracieux, et c'est important.

    La galerie retombe alors sur la photo d'origine du produit — l'article reste
    visible, son prix aussi, et rien ne se casse à l'écran. Un visiteur légitime
    ne rencontrera jamais ce cas ; celui qui balaie le catalogue le rencontrera
    tout de suite.
  */
  if (plafondAtteint()) return ok({ url: null });

  recentes.push(Date.now());

  const travail = fabriquerALaDemande(productId, color).finally(() => enCours.delete(cle));
  enCours.set(cle, travail);

  try {
    return ok({ url: await travail });
  } catch {
    return fail("Ce coloris n'a pas pu être préparé.");
  }
}

async function fabriquerALaDemande(productId: string, color: string): Promise<string | null> {
  // Lecture sous RLS : un produit que le visiteur ne peut pas voir n'existe pas.
  const lecture = createStaticClient();
  const { data: product } = await lecture
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (!product) return null;
  if (!("variant_images" in product)) return null;

  const couleurs: string[] = product.colors ?? [];
  const images: string[] = product.images ?? [];
  if (!couleurs.includes(color) || images.length === 0) return null;

  const variantes: VariantImages = product.variant_images ?? {};

  // Déjà là — c'est le cas de loin le plus fréquent, et il ne coûte qu'une
  // lecture.
  const existante = variantes[color];
  if (existante?.url) return existante.url;

  // Le premier coloris est celui des photos du produit : rien à fabriquer.
  if (color === couleurs[0]) return images[0];

  const reference = variantes[couleurs[0]];
  const sourceUrl = reference && !reference.generated ? reference.url : images[0];

  let source: Buffer;
  try {
    const reponse = await fetch(sourceUrl);
    if (!reponse.ok) return null;
    source = Buffer.from(await reponse.arrayBuffer());
    if (source.byteLength > TAILLE_MAX) return null;
  } catch {
    return null;
  }

  const resultat = await recolorGarment(source, color);
  if (!resultat.ok) return null;

  const admin = createAdminClient();
  const chemin = `${product.shop_id}/coloris-${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await admin.storage.from("products").upload(chemin, resultat.data, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) return null;

  const {
    data: { publicUrl },
  } = admin.storage.from("products").getPublicUrl(chemin);

  /*
    On relit avant d'écrire.

    Entre le début de la fabrication et maintenant, le vendeur a pu déposer une
    vraie photo, ou une autre instance a pu enregistrer la sienne. Dans les deux
    cas la nôtre arrive trop tard : on garde celle qui est en base et l'on
    retire le fichier qu'on vient de déposer, plutôt que de laisser un orphelin.
  */
  const { data: frais } = await admin
    .from("products")
    .select("variant_images")
    .eq("id", productId)
    .maybeSingle();

  const actuelles: VariantImages = frais?.variant_images ?? variantes;
  if (actuelles[color]?.url) {
    await admin.storage.from("products").remove([chemin]);
    return actuelles[color].url;
  }

  await admin
    .from("products")
    .update({
      variant_images: {
        ...actuelles,
        [color]: {
          url: publicUrl,
          generated: true,
          from: sourceUrl,
          at: new Date().toISOString(),
        },
      },
    })
    .eq("id", productId);

  revalidatePath(`/produit/${productId}`);
  return publicUrl;
}

/* ─── Rattachement manuel ──────────────────────────────────────────────── */

/**
 * Rattacher des photos à un coloris.
 *
 * Une vraie photo l'emporte toujours sur une image fabriquée : elle montre
 * l'article, pas une approximation. La règle vaut dans les deux sens — on ne
 * fabrique jamais par-dessus une vraie photo, et une vraie photo déposée plus
 * tard prend la place de la fabriquée sans qu'on ait à l'effacer.
 */
export async function setVariantImage(input: {
  productId: string;
  color: string;
  /**
   * Les vues du coloris, dans l'ordre d'affichage. Liste vide ou `null` :
   * l'association est retirée.
   *
   * Un vendeur photographie souvent l'avant, le dos et le détail d'une même
   * déclinaison. Une seule adresse obligeait à choisir laquelle des trois
   * représenterait la couleur, et les deux autres disparaissaient.
   */
  urls: string[] | null;
}) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

  /*
    `select("*")` plutôt que la liste des colonnes.

    Nommer `variant_images` dans un `select` fait échouer *toute* la requête
    tant que la migration n'est pas passée — pas seulement la colonne. L'étoile
    ramène ce qui existe, et le garde-fou ci-dessous dit en français ce qui
    manque.
  */
  const { data: product, error: readError } = await supabase
    .from("products")
    .select("*")
    .eq("id", input.productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (readError) return fail(readableError(readError));
  if (!product) return fail("Produit introuvable");

  if (!("variant_images" in product)) {
    return fail(
      "Migration requise : ajoutez la colonne « variant_images » avant d'associer une photo.",
    );
  }

  const next: VariantImages = { ...(product.variant_images ?? {}) };
  const vues = (input.urls ?? []).filter(Boolean);

  if (vues.length > 0) {
    // `url` reste la vue principale : tout le code de lecture la connaît, et
    // une base écrite avant ce jour n'a que ce champ.
    next[input.color] = { url: vues[0], generated: false, images: vues };
  } else {
    delete next[input.color];
  }

  const { error: writeError } = await supabase
    .from("products")
    .update({ variant_images: next })
    .eq("id", input.productId)
    .eq("shop_id", shop.id);

  if (writeError) return fail(readableError(writeError));

  revalidatePath(`/produit/${input.productId}`);
  revalidatePath("/vendeur/produits");
  return done();
}

/**
 * Dire au vendeur ce qu'il peut faire, jamais ce qui a échoué à l'intérieur.
 *
 * « vetement-introuvable » n'a de sens que pour qui a écrit le masque. Ce que le
 * commerçant doit lire, c'est le geste qui débloque la situation : reprendre la
 * photo, ou déposer un cliché par coloris.
 */
function messageEchec(motifs: Set<RecolorReason>): string {
  if (motifs.has("sujet-protege")) {
    return "Impossible de changer la couleur sans toucher au modèle sur cette photo. Déposez une photo par coloris.";
  }

  if (motifs.has("image-illisible")) {
    return "La photo du produit n'a pas pu être lue. Déposez-la à nouveau.";
  }

  if (motifs.has("tissu-heterogene")) {
    return "Sur cette photo, la couleur ne pourrait être changée que sur une partie du vêtement. Déposez une photo par coloris plutôt qu'un article à moitié recoloré.";
  }

  return "Le vêtement n'a pas pu être isolé sur cette photo. Un article seul, sur fond uni, donne de bien meilleurs résultats.";
}
