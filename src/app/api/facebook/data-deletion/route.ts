import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Rappel de suppression des données, appelé par Facebook.
 *
 * Quand un commerçant retire notre application depuis les paramètres de son
 * compte Facebook, Meta nous prévient ici. Nous supprimons alors la liaison de
 * page et son jeton d'accès, puis répondons l'adresse où il peut vérifier, avec
 * un code de suivi.
 *
 * Meta préfère ce mécanisme à une simple page d'instructions pour toute
 * application utilisant Facebook Login, et l'exige en revue.
 *
 * ⚠ Route publique. La charge est signée par Meta avec le secret de
 * l'application : sans cette vérification, n'importe qui pourrait faire
 * supprimer la liaison d'une boutique en devinant un identifiant.
 */
export async function POST(request: NextRequest) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "Non configuré" }, { status: 503 });
  }

  // Meta envoie `signed_request` en formulaire, pas en JSON.
  const form = await request.formData().catch(() => null);
  const signed = form?.get("signed_request");

  if (typeof signed !== "string") {
    return NextResponse.json({ error: "signed_request manquant" }, { status: 400 });
  }

  const payload = verifySignedRequest(signed, appSecret);
  if (!payload) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  const facebookUserId = payload.user_id;
  if (!facebookUserId) {
    return NextResponse.json({ error: "user_id absent" }, { status: 400 });
  }

  /*
    Code de suivi. Dérivé de l'identifiant Facebook et du secret : reproductible
    pour nous, imprévisible pour un tiers, et sans table supplémentaire à tenir.
    Meta l'affiche au commerçant pour qu'il puisse nous interroger.
  */
  const confirmationCode = createHmac("sha256", appSecret)
    .update(`suppression:${facebookUserId}`)
    .digest("hex")
    .slice(0, 16);

  try {
    const admin = createAdminClient();

    // Le jeton de page part avec la ligne : plus aucune lecture possible.
    const { error } = await admin
      .from("shop_facebook_pages")
      .delete()
      .eq("facebook_user_id", facebookUserId);

    // Une table absente — migration 08 non appliquée — n'est pas un refus de
    // suppression : il n'y a rien à supprimer.
    if (error && error.code !== "PGRST205") {
      console.error("Suppression de la liaison Facebook échouée", error.message);
      return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
    }
  } catch (cause) {
    console.error("Suppression de la liaison Facebook échouée", cause);
    return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  }

  const origin = request.nextUrl.origin;

  // Forme exigée par Meta : une adresse de suivi et un code.
  return NextResponse.json({
    url: `${origin}/suppression-donnees?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

/**
 * Vérifie et décode un `signed_request` Meta.
 *
 * Deux parties séparées par un point : la signature puis la charge, toutes deux
 * en base64url. La signature porte sur la charge encodée, telle quelle.
 */
function verifySignedRequest(
  signed: string,
  appSecret: string,
): { user_id?: string; algorithm?: string } | null {
  const [signature, encodedPayload] = signed.split(".");
  if (!signature || !encodedPayload) return null;

  const provided = Buffer.from(base64UrlToBase64(signature), "base64");
  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();

  // `timingSafeEqual` lève si les longueurs diffèrent : on écarte ce cas avant.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(base64UrlToBase64(encodedPayload), "base64").toString("utf8"),
    );

    // Meta n'utilise que HMAC-SHA256 ici. Refuser tout le reste ferme la porte
    // à une charge qui prétendrait n'être signée par rien.
    if (payload.algorithm && !/HMAC-SHA256/i.test(payload.algorithm)) return null;

    return payload;
  } catch {
    return null;
  }
}

function base64UrlToBase64(value: string): string {
  return value.replace(/-/g, "+").replace(/_/g, "/");
}
