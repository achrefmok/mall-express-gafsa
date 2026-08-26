import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Recevoir une mesure de performance venue d'un vrai téléphone.
 *
 * Le composant `WebVitals` n'envoie que ce qui dépasse le seuil « à améliorer »
 * de Google : quelques relevés par jour, jamais le bruit de fond. Ils
 * atterrissent ici, sont écrits dans les journaux avec le même marqueur que le
 * reste, et rien de plus.
 *
 * **Volontairement sans base de données.** Une table de mesures se remplit
 * vite, coûte à interroger, et demande une interface pour être lue — trois
 * choses qui font qu'on ne la consulte jamais. Une ligne de journal cherchable
 * répond à la seule question qu'on se pose vraiment : « depuis la dernière
 * mise en production, est-ce que quelque chose s'est dégradé ? »
 *
 * Aucune authentification : la route ne lit rien, n'écrit rien, et ne renvoie
 * rien. Le pire qu'on puisse en faire est de salir un journal, ce qu'une borne
 * sur la taille du corps suffit à contenir.
 */

/** Un relevé fait quelques dizaines d'octets. Au-delà, ce n'en est pas un. */
const TAILLE_MAX = 1024;

const NOMS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

export async function POST(request: NextRequest) {
  try {
    const brut = await request.text();
    if (brut.length > TAILLE_MAX) return NextResponse.json({ ok: true });

    const mesure = JSON.parse(brut) as {
      nom?: unknown;
      valeur?: unknown;
      seuil?: unknown;
      note?: unknown;
      chemin?: unknown;
    };

    /*
      Le corps vient d'un navigateur : on ne journalise que ce qu'on reconnaît.

      Sans ce filtre, n'importe qui pourrait écrire n'importe quoi dans les
      journaux du serveur — y compris de fausses lignes ressemblant à d'autres
      événements, ce qui rendrait la recherche inutilisable au moment où elle
      compte.
    */
    if (typeof mesure.nom !== "string" || !NOMS.has(mesure.nom)) {
      return NextResponse.json({ ok: true });
    }
    if (typeof mesure.valeur !== "number" || !Number.isFinite(mesure.valeur)) {
      return NextResponse.json({ ok: true });
    }

    const chemin =
      typeof mesure.chemin === "string" ? mesure.chemin.slice(0, 120) : "inconnu";

    console.warn(
      "[mall-express:vitals]",
      JSON.stringify({
        nom: mesure.nom,
        valeur: mesure.valeur,
        seuil: typeof mesure.seuil === "number" ? mesure.seuil : null,
        chemin,
        // L'appareil, sans l'identifier : c'est ce qui distingue une lenteur
        // générale d'un défaut propre à un navigateur.
        agent: (request.headers.get("user-agent") ?? "").slice(0, 120),
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // Un corps illisible n'est pas un incident : on l'ignore.
  }

  /*
    Toujours 204, quoi qu'il arrive.

    `sendBeacon` ne lit pas la réponse et ne réessaie jamais. Renvoyer une
    erreur ne servirait qu'à faire apparaître des lignes rouges dans la console
    du visiteur, pour une mesure dont il n'a que faire.
  */
  return new NextResponse(null, { status: 204 });
}
