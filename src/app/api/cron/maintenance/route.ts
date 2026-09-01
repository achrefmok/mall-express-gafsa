import { NextResponse, type NextRequest } from "next/server";
import { APP_SPACE } from "@/lib/space";
import { createAdminClient } from "@/lib/supabase/server";
import { signaler } from "@/lib/signal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tâches périodiques : expiration des bons plans et recalcul de l'état
 * d'ouverture des boutiques.
 *
 * Protégée par CRON_SECRET, comparé en temps constant : sans cela, la route
 * serait un levier de charge accessible à n'importe qui.
 *
 * Cadence conseillée : toutes les 15 minutes.
 *   vercel.json → { "crons": [{ "path": "/api/cron/maintenance", "schedule": "*​/15 * * * *" }] }
 *
 * Alternative sans hébergeur : activer pg_cron sur Supabase et planifier
 * directement `select public.expire_stale_deals();`.
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
    /*
      200 et non 204 : un 204 déclare « pas de contenu » et la spécification lui
      interdit tout corps, si bien que `NextResponse.json` y lève une exception
      et que la route ressortait en 500. Le planificateur voyait un échec chaque
      nuit pour une tâche qui n'avait, ici, rien à faire.

      Un 200 explicite vaut mieux qu'une réponse vide : le journal dit pourquoi
      rien ne s'est produit.
    */
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

  try {
    const supabase = createAdminClient();

    const [expired, refreshed, courses, services] = await Promise.all([
      supabase.rpc("expire_stale_deals"),
      supabase.rpc("refresh_shops_open_state"),
      /*
        Les demandes de course échues, et les déclarations trop vieilles.

        Le navigateur écarte déjà une demande périmée à l'affichage — son
        échéance est dans la ligne, il suffit de la lire. Ce passage-ci entérine
        la chose en base, pour que l'historique ne garde pas des demandes
        éternellement « en attente », et retire les chauffeurs déclarés libres
        depuis plus de douze heures.
      */
      supabase.rpc("expire_taxi_requests"),
      /*
        La prière et la pharmacie de garde du jour.

        Sans ce passage quotidien, la fenêtre de sept jours laissée par le seed
        glisse et « Aujourd'hui à Gafsa » retombe sur ses tirets.
      */
      supabase.rpc("refresh_daily_services"),
    ]);

    if (expired.error) throw new Error(expired.error.message);
    if (refreshed.error) throw new Error(refreshed.error.message);

    /*
      L'échec du taxi n'arrête pas la maintenance.

      La fonction n'existe que si la migration a été collée, et elle l'est à la
      main dans l'éditeur SQL de Supabase. Faire échouer toute la tâche
      périodique pour cette raison priverait les bons plans de leur expiration
      et les boutiques de leur état d'ouverture — une panne bien plus large que
      celle qu'on signalerait.
    */
    if (courses.error) {
      signaler(courses.error, { ou: "expiration des demandes de course" });
    }

    /*
      Idem pour les services du jour : tant que la migration n'est pas collée,
      la fonction manque, et ce n'est pas une raison pour faire sombrer le reste.
    */
    if (services.error) {
      signaler(services.error, { ou: "rafraîchissement des services du jour" });
    }

    const detail = {
      expiredDeals: expired.data ?? 0,
      refreshedShops: refreshed.data ?? 0,
      expiredRides: courses.error ? null : (courses.data ?? 0),
      servicesToday: services.error ? null : (services.data ?? 0),
    };

    /*
      Garder la trace du passage.

      Sans elle, une tâche qui cesse d'être déclenchée ne se remarque pas : les
      bons plans n'expirent plus, les boutiques restent ouvertes la nuit, les
      demandes de course s'accumulent en « en attente » — et le premier signal
      est un client qui se plaint. Trois colonnes suffisent à répondre « quand
      a-t-elle tourné la dernière fois ? », qui est la seule question qu'on se
      pose vraiment.
    */
    await consigner(supabase, true, detail);

    return NextResponse.json({ ok: true, ...detail, at: new Date().toISOString() });
  } catch (cause) {
    signaler(cause, { ou: "tâche de maintenance" });

    /*
      Un échec se consigne aussi — surtout un échec.

      Une exécution qui plante sans laisser de trace est indiscernable d'une
      exécution qui n'a pas eu lieu, et les deux appellent pourtant des gestes
      différents.
    */
    try {
      await consigner(createAdminClient(), false, {
        message: cause instanceof Error ? cause.message : String(cause),
      });
    } catch {
      // La base est peut-être ce qui vient de tomber. `signaler` a déjà écrit.
    }

    return NextResponse.json({ error: "Maintenance échouée" }, { status: 500 });
  }
}

/**
 * Déposer un relevé d'exécution.
 *
 * Silencieuse par construction : la maintenance a fait son travail, et
 * l'incapacité à en garder la trace ne doit pas la faire passer pour un échec.
 * Tant que la migration n'est pas collée, la table n'existe pas et l'écriture
 * échoue — sans conséquence.
 */
async function consigner(
  supabase: ReturnType<typeof createAdminClient>,
  ok: boolean,
  detail: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("cron_runs")
    .insert({ tache: "maintenance", ok, detail: detail as never });

  if (error) signaler(error, { ou: "relevé d'exécution de la maintenance" });
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
