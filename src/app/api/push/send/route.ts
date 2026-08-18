import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import { isValidVapidPublicKey, vapidPublicKey } from "@/lib/push-key";

/*
  Runtime Node, pas Edge : le chiffrement des messages poussés repose sur le
  module `crypto` de Node, absent du runtime Edge.
*/
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * Envoi des notifications poussées
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Appelée par Postgres — un déclencheur sur `notifications` — et par personne
 * d'autre. C'est ce qui permet à une notification créée en base d'atteindre un
 * téléphone dont le site n'est même pas ouvert.
 *
 * Pourquoi ce détour plutôt qu'un envoi depuis l'application : les notifications
 * de ce projet naissent dans des déclencheurs SQL (commande passée, boutique
 * approuvée, direct démarré). Le code applicatif ne voit jamais l'insertion.
 *
 * Le secret partagé n'est pas une formalité : sans lui, n'importe qui pourrait
 * faire sonner le téléphone de tous les clients en connaissant une seule adresse.
 */

/** Comparaison à temps constant : un `===` fuit la longueur du préfixe correct. */
function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

interface Payload {
  userId?: string;
  title?: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Le secret attendu, lu dans la base plutôt que dans l'environnement.
 *
 * Il doit être identique des deux côtés : le déclencheur SQL l'envoie depuis
 * `app_settings`, et cette route le compare. Le tenir à deux endroits — une
 * ligne de table et une variable Vercel — obligeait à recopier à la main une
 * chaîne aléatoire, et la moindre divergence produisait un « 401 Refusé » que
 * rien n'expliquait. C'est exactement ce qui est arrivé.
 *
 * En le lisant à la source qui l'émet, la comparaison ne peut plus échouer pour
 * cause de recopie. La variable d'environnement reste acceptée en second
 * recours, pour un déploiement qui n'aurait pas la table.
 */
async function expectedSecret(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "push_secret")
    .maybeSingle();

  const fromDb = data?.value?.trim();
  return fromDb || process.env.PUSH_SECRET?.trim() || null;
}

export async function POST(request: NextRequest) {

  /*
    La même clé publique que le navigateur, prise à la même source : les deux
    doivent concorder au caractère près, sinon chaque envoi est rejeté par le
    service de notifications. Les lire à deux endroits différents était une
    invitation à les voir diverger.
  */
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.replace(/\s+/g, "");
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@mall-express-gafsa.tn";

  /*
    Client d'administration : cette route lit les abonnements de quelqu'un
    d'autre, ce que les policies interdisent — à raison — au client ordinaire.
    L'autorisation vient du secret partagé, vérifié juste après.
  */
  const supabase = createAdminClient();
  const secret = await expectedSecret(supabase);

  /*
    Non configuré : on répond 204 et non une erreur. Le déclencheur SQL n'a rien
    à en faire, et un 500 remplirait les journaux de Postgres d'avertissements à
    chaque notification créée.
  */
  if (!secret || !publicKey || !privateKey) {
    return new NextResponse(null, { status: 204 });
  }

  if (!secretMatches(request.headers.get("x-push-secret"), secret)) {
    return NextResponse.json({ error: "Refusé" }, { status: 401 });
  }

  /*
    Contrôler la forme des clés avant de les confier à `web-push`, qui lèverait
    sinon une exception aboutissant en 500 — un code qui ne dit pas ce qui
    manque. Une clé privée fait 32 octets, soit 43 caractères en base64url.
  */
  if (!isValidVapidPublicKey(publicKey)) {
    return NextResponse.json(
      { error: `Clé publique invalide : ${publicKey.length} caractères au lieu de 87` },
      { status: 500 },
    );
  }

  if (privateKey.length !== 43) {
    return NextResponse.json(
      {
        error:
          `Clé privée invalide : ${privateKey.length} caractères au lieu de 43. ` +
          `Vérifier VAPID_PRIVATE_KEY — probablement tronquée au collage.`,
      },
      { status: 500 },
    );
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  const { userId, title } = payload;
  if (!userId || !title) {
    return NextResponse.json({ error: "userId et title requis" }, { status: 400 });
  }

  webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, reason: "aucun appareil abonné" });
  }

  const message = JSON.stringify({
    title,
    body: payload.body ?? undefined,
    link: payload.link ?? "/notifications",
  });

  /*
    Tous les appareils en parallèle, et les échecs isolés.

    Une personne peut avoir trois appareils abonnés dont un téléphone remplacé
    depuis six mois. `Promise.allSettled` plutôt que `all` : l'appareil disparu ne
    doit pas empêcher la notification d'arriver sur les deux autres.
  */
  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        message,
        { TTL: 12 * 3600 },
      ),
    ),
  );

  /*
    Faire le ménage.

    404 et 410 signifient que l'abonnement n'existe plus — application
    désinstallée, permission retirée, navigateur réinitialisé. Le garder
    reviendrait à tenter un envoi voué à l'échec à chaque notification, pour
    toujours. Les autres erreurs (réseau, service momentanément indisponible) ne
    justifient pas une suppression : l'appareil est peut-être simplement éteint.
  */
  const dead: string[] = [];
  let sent = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sent += 1;
      return;
    }

    const status = (result.reason as { statusCode?: number } | undefined)?.statusCode;
    if (status === 404 || status === 410) dead.push(subscriptions[index].id);
  });

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  if (sent > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  return NextResponse.json({ sent, removed: dead.length });
}
