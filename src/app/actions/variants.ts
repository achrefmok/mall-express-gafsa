"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireShopOwner } from "./_helpers";
import { planGeneration } from "@/lib/variants";
import type { VariantImages } from "@/types/database";

/**
 * Les teintes de couleur manquantes, fabriquées à partir d'une vraie photo.
 *
 * Le besoin : un commerçant photographie son article une fois, puis déclare
 * quatre coloris. Le client qui touche « bleu » voyait alors la photo rouge, et
 * découvrait la vraie couleur à la livraison. Fabriquer une approximation vaut
 * mieux que montrer la mauvaise couleur — à condition de le dire, ce que fait
 * le drapeau `generated` et l'étiquette portée par la galerie.
 *
 * **La méthode : une rotation de teinte, pas un remplissage.** On fait tourner
 * la roue chromatique de l'écart entre la couleur d'origine et la couleur
 * visée. Ce qui est coloré se décale ; ce qui est neutre — un fond blanc, une
 * ombre grise, une semelle noire — n'a pas de teinte à faire tourner et reste
 * intact. C'est ce qui rend le résultat crédible sur une photo de produit
 * détourée, et c'est aussi ce qui en fixe la limite : sur une photo de rue avec
 * du ciel et de la végétation, tout se décale.
 *
 * Ce que la fonction refuse de faire, et c'est délibéré :
 *
 *   · elle ne remplace jamais une vraie photo ;
 *   · elle ne repart jamais d'une teinte déjà fabriquée — les écarts
 *     s'accumuleraient de proche en proche ;
 *   · elle ne produit rien pour un noir, un blanc ou un gris : une rotation ne
 *     donne aucune couleur à ce qui n'en a pas, et le résultat serait une copie
 *     de la source portant une étiquette mensongère.
 */

/** Bornes de sécurité : une fiche produit n'a pas dix coloris. */
const MAX_PAR_APPEL = 6;
const TAILLE_MAX = 4 * 1024 * 1024;

export async function generateVariantImages(productId: string) {
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

  /*
    La colonne est facultative tant que la migration n'est pas passée.

    Le reste de l'application s'en accommode — la fiche affiche simplement la
    galerie complète. Ici, en revanche, il n'y a nulle part où écrire : mieux
    vaut le dire en français que laisser remonter un message de PostgREST.
  */
  if (!("variant_images" in product)) {
    return fail(
      "Migration requise : ajoutez la colonne « variant_images » avant de fabriquer des teintes.",
    );
  }

  const current: VariantImages = product.variant_images ?? {};
  const plans = planGeneration(product.colors ?? [], product.images ?? [], current).slice(
    0,
    MAX_PAR_APPEL,
  );

  if (plans.length === 0) {
    return ok({ generated: 0, skipped: (product.colors ?? []).length });
  }

  const next: VariantImages = { ...current };
  const failures: string[] = [];

  for (const plan of plans) {
    try {
      const response = await fetch(plan.sourceUrl);
      if (!response.ok) {
        failures.push(plan.color);
        continue;
      }

      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > TAILLE_MAX) {
        failures.push(plan.color);
        continue;
      }

      /*
        `modulate` fait tourner la teinte sans toucher à la clarté ni à la
        saturation : la matière, les plis et les ombres du vêtement restent
        ceux de la photo d'origine. C'est précisément ce qu'on veut — seule la
        couleur change.
      */
      const body = await sharp(raw)
        .rotate() // respecte l'orientation EXIF avant toute transformation
        .modulate({ hue: plan.rotation })
        .webp({ quality: 82, effort: 5 })
        .toBuffer();

      const path = `${shop.owner_id}/${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await supabase.storage.from("products").upload(path, body, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });

      if (uploadError) {
        failures.push(plan.color);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("products").getPublicUrl(path);

      next[plan.color] = {
        url: publicUrl,
        generated: true,
        from: plan.from,
        at: new Date().toISOString(),
      };
    } catch {
      failures.push(plan.color);
    }
  }

  const produced = plans.length - failures.length;
  if (produced === 0) return fail("Aucune teinte n'a pu être fabriquée");

  const { error: writeError } = await supabase
    .from("products")
    .update({ variant_images: next })
    .eq("id", productId)
    .eq("shop_id", shop.id);

  if (writeError) return fail(readableError(writeError));

  revalidatePath(`/produit/${productId}`);
  revalidatePath("/vendeur/produits");

  return ok({ generated: produced, failed: failures.length });
}

/**
 * Rattache une vraie photo à une couleur — et efface la teinte fabriquée qui
 * l'occupait, s'il y en avait une.
 *
 * C'est le sens unique de la règle : une vraie photo remplace une fabriquée,
 * jamais l'inverse. Passer `null` retire l'association et rend la couleur
 * éligible à une nouvelle fabrication.
 */
export async function setVariantImage(input: {
  productId: string;
  color: string;
  url: string | null;
}) {
  const { supabase, shop, error } = await requireShopOwner();
  if (!shop) return fail(error);

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

  if (input.url) next[input.color] = { url: input.url, generated: false };
  else delete next[input.color];

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
