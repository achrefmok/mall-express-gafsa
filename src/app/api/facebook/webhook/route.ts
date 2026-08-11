import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isOnAir, liveVideoById } from "@/lib/live/facebook-graph";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Point d'entrée des notifications Facebook.
 *
 * C'est ce qui rend le relais automatique : quand une boutique lance un direct
 * sur sa page, Facebook nous appelle ici, et le direct s'ouvre sur le site avec
 * sa couche commerce.
 *
 * ⚠ Route publique, non authentifiée : n'importe qui peut la solliciter. Toute
 * requête dont la signature ne correspond pas au secret de l'application est
 * rejetée — sans quoi un tiers pourrait déclencher de faux directs, envoyer des
 * notifications à tous les abonnés d'une boutique, et lui prêter une vidéo
 * qu'elle n'a pas diffusée.
 */

/* ─── Vérification de l'abonnement ───────────────────────────────────── */

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) return new NextResponse("Non configuré", { status: 503 });

  if (
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === verifyToken
  ) {
    // Facebook attend l'écho brut du défi, sans guillemets ni JSON.
    return new NextResponse(params.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new NextResponse("Jeton de vérification invalide", { status: 403 });
}

/* ─── Événements ─────────────────────────────────────────────────────── */

type Change = { field?: string; value?: { id?: string; status?: string } };
type Entry = { id?: string; changes?: Change[] };

export async function POST(request: NextRequest) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) return new NextResponse("Non configuré", { status: 503 });

  // Le corps brut, avant tout décodage : la signature porte sur les octets
  // exacts. `request.json()` les reformaterait et invaliderait le calcul.
  const raw = await request.text();

  if (!signatureMatches(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Signature invalide", { status: 401 });
  }

  let payload: { object?: string; entry?: Entry[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Corps illisible", { status: 400 });
  }

  if (payload.object !== "page") return NextResponse.json({ ok: true });

  // Facebook considère l'événement perdu au-delà de quelques secondes et le
  // renvoie. On traite donc vite, et `sync_facebook_live` est idempotente.
  await Promise.allSettled((payload.entry ?? []).map(handleEntry));

  return NextResponse.json({ ok: true });
}

async function handleEntry(entry: Entry): Promise<void> {
  const pageId = entry.id;
  if (!pageId) return;

  const videoChanges = (entry.changes ?? []).filter((change) => change.field === "live_videos");
  if (videoChanges.length === 0) return;

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("shop_facebook_pages")
    .select("shop_id, page_token")
    .eq("page_id", pageId)
    .maybeSingle();

  // Page inconnue : abonnement laissé derrière une boutique supprimée.
  if (!link) return;

  for (const change of videoChanges) {
    const videoId = change.value?.id;
    if (!videoId) continue;

    /*
      On ne se fie pas au statut porté par la notification : il arrive
      abrégé, et parfois en avance sur l'état réel. On redemande la vidéo à
      Facebook, qui fait foi — et qui nous donne au passage le permalien et
      le titre.
    */
    const video = await liveVideoById(videoId, link.page_token);
    if (!video) continue;

    const { error } = await admin.rpc("sync_facebook_live", {
      target_shop: link.shop_id,
      video_id: video.id,
      permalink: video.permalink,
      video_title: video.title,
      live_now: isOnAir(video.status),
    });

    if (error) console.error("sync_facebook_live", error.message);
  }

  await admin
    .from("shop_facebook_pages")
    .update({ last_checked_at: new Date().toISOString(), last_error: null })
    .eq("page_id", pageId);
}

/** HMAC-SHA256 du corps brut, comparé à durée constante. */
function signatureMatches(raw: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  const provided = Buffer.from(header.slice(7), "hex");

  // `timingSafeEqual` lève si les longueurs diffèrent : on écarte ce cas avant.
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
