import "server-only";

/**
 * Signaler une erreur qu'on a choisi de ne pas faire remonter à l'utilisateur.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le défaut que ce module corrige
 * ────────────────────────────────────────────────────────────────────────
 *
 * L'audit du 26 août 2026 a compté quarante-six blocs `catch {}` qui avalent
 * leur erreur volontairement. Chacun est défendable pris isolément — une
 * notification manquée ne doit pas annuler le message qu'elle annonce, une
 * place mal décomptée ne doit pas annuler une course acceptée. Mis bout à bout,
 * ils rendaient invisibles des pannes entières :
 *
 *   · une notification de course jamais partie ;
 *   · des places non décomptées après acceptation ;
 *   · l'expiration périodique des demandes qui ne s'exécute plus.
 *
 * Un chauffeur qui ne reçoit plus aucune demande avait exactement la même
 * signature qu'un chauffeur que personne n'appelle. Rien ne permettait de
 * distinguer les deux.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que ce module change, et ce qu'il ne change pas
 * ────────────────────────────────────────────────────────────────────────
 *
 * **Il ne change pas le comportement.** Un appel à `signaler` n'interrompt
 * rien, ne relance rien, ne renvoie rien. On continue à ne pas faire échouer
 * l'action ; on cesse seulement d'ignorer la cause.
 *
 * **Il écrit une ligne lisible par une machine.** Les journaux de l'hébergeur
 * contiennent déjà tout le bruit d'un serveur ; une erreur noyée dedans n'est
 * pas une erreur remontée. Le préfixe et la forme JSON rendent la recherche
 * possible — et une alerte, plus tard, triviale à écrire.
 *
 * Aucun service tiers n'est requis : la journalisation structurée fonctionne le
 * jour où on la déploie. `SENTRY_DSN` est reconnu si un jour on en ajoute un,
 * sans que rien d'autre n'ait à changer ici.
 */

/** Le préfixe qui rend une recherche possible dans les journaux de l'hébergeur. */
const MARQUEUR = "[mall-express:erreur]";

export interface Contexte {
  /** Où cela s'est produit, en termes métier. Ex. « notification de course ». */
  ou: string;
  /** Ce qu'on essayait de faire, avec les identifiants utiles au diagnostic. */
  quoi?: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Rendre une erreur lisible sans jamais lever à son tour.
 *
 * On peut recevoir n'importe quoi dans un `catch` — une `Error`, une chaîne, un
 * objet PostgREST, `undefined`. Une fonction de journalisation qui échoue sur
 * l'un de ces cas transformerait un incident mineur en panne, exactement à
 * l'endroit conçu pour absorber les incidents mineurs.
 */
function lisible(cause: unknown): { message: string; pile?: string } {
  if (cause instanceof Error) {
    return { message: cause.message, pile: cause.stack };
  }

  if (typeof cause === "string") return { message: cause };

  if (cause && typeof cause === "object") {
    // Le client Supabase renvoie `{ message, code, details }` sans jamais lever.
    const o = cause as Record<string, unknown>;
    const parties = [o.message, o.code, o.details].filter(Boolean).map(String);
    if (parties.length > 0) return { message: parties.join(" · ") };

    try {
      return { message: JSON.stringify(cause) };
    } catch {
      return { message: "objet non sérialisable" };
    }
  }

  return { message: String(cause) };
}

/**
 * Consigner une erreur absorbée.
 *
 * À appeler dans tout `catch` dont on a décidé qu'il ne devait pas faire échouer
 * l'action. Ne retourne rien, ne lève jamais.
 */
export function signaler(cause: unknown, contexte: Contexte): void {
  try {
    const { message, pile } = lisible(cause);

    console.error(
      MARQUEUR,
      JSON.stringify({
        ou: contexte.ou,
        message,
        ...contexte.quoi,
        at: new Date().toISOString(),
      }),
      // La pile en second argument, hors du JSON : elle est multiligne, et
      // l'enfermer dans la chaîne rendrait la ligne illisible à l'œil.
      pile ?? "",
    );
  } catch {
    /*
      Le dernier filet.

      Si la journalisation elle-même échoue — un contexte non sérialisable, une
      console indisponible — il n'y a plus rien à tenter, et surtout rien qui
      justifie de faire échouer l'appelant. C'est le seul `catch` vide du projet
      qui n'ait rien à signaler à personne.
    */
  }
}
