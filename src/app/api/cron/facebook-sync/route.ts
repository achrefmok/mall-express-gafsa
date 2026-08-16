import { NextResponse, type NextRequest } from "next/server";
import { APP_SPACE } from "@/lib/space";
import { createAdminClient } from "@/lib/supabase/server";
import { facebookConfigured } from "@/lib/live/facebook-graph";
import { syncPage } from "@/lib/live/facebook-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Relais automatique des directs Facebook, par vérification planifiée.
 *
 * C'est le chemin par défaut. Le webhook `live_videos` serait plus immédiat,
 * mais l'abonner exige `pages_manage_metadata` — une permission que beaucoup
 * d'applications Meta n'ont pas, et dont l'absence bloquait tout le dialogue
 * d'autorisation. Interroger la Graph API toutes les quinze minutes ne demande
 * que `pages_read_engagement`, et ne coûte rien.
 *
 * Cadence conseillée : toutes les 15 minutes. Le plan Hobby de Vercel plafonne
 * les tâches à une par jour ; passez donc par pg_cron sur Supabase, qui est
 * gratuit et sans plafond :
 *
 *   select cron.schedule('meg-facebook', '*​/15 * * * *', $$
 *     select net.http_get(
 *       url     := 'https://votre-domaine/api/cron/facebook-sync',
 *       headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb
 *     );
 *   $$);
 *
 * Protégée par CRON_SECRET : sans cela, la route serait un levier pour faire
 * appeler la Graph API en boucle au nom de vos commerçants.
 */
export async function GET(request: NextRequest) {
  /*
    Une seule fois, même si l'application est déployée en plusieurs exemplaires.

    Le découpage client/vendeur produit deux hébergements du même dépôt, donc
    deux planificateurs pour le même `vercel.json`. Les tâches s'exécuteraient en
    double : deux expirations concurrentes de bons plans, deux synchronisations
    Facebook. La façade client s'abstient ; le côté qui porte l'administration
    garde la charge.
  */
  if (APP_SPACE === "client") {
    // 200 et non 204 : ce dernier interdit tout corps, et `NextResponse.json`
    // y lève une exception — la route ressortait en 500 à chaque passage.
    return NextResponse.json({ ignore: "espace client" });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!facebookConfigured()) {
    return NextResponse.json({ ok: true, skipped: "relais Facebook non configuré" });
  }

  try {
    const admin = createAdminClient();

    const { data: links, error } = await admin
      .from("shop_facebook_pages")
      .select("shop_id, page_id, page_token")
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(50);

    // Migration 08 pas encore appliquée : ce n'est pas une panne, c'est une
    // installation inachevée. Une tâche planifiée qui échoue toutes les quinze
    // minutes noierait les vraies erreurs — on le dit une fois, calmement.
    // `npm run db:check` le signale aussi.
    if (error?.code === "PGRST205" || /Could not find the table/i.test(error?.message ?? "")) {
      return NextResponse.json({
        ok: true,
        skipped: "migration 20260811000800 non appliquée",
      });
    }

    if (error) throw new Error(error.message);
    if (!links || links.length === 0) return NextResponse.json({ ok: true, pages: 0 });

    // En série : une boutique dont le jeton est révoqué ne doit pas faire
    // échouer les autres, et la Graph API n'aime pas les rafales.
    const results = [];
    for (const link of links) results.push(await syncPage(admin, link));

    return NextResponse.json({
      ok: true,
      pages: results.length,
      onAir: results.reduce((total, result) => total + result.onAir, 0),
      failed: results.filter((result) => result.error).length,
      at: new Date().toISOString(),
    });
  } catch (cause) {
    console.error("Synchronisation Facebook échouée", cause);
    return NextResponse.json({ error: "Synchronisation échouée" }, { status: 500 });
  }
}

/** Comparaison à durée constante : ne fuit pas la longueur du préfixe correct. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
