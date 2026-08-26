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
 * **Sentry est branché, mais seulement côté serveur.** `@sentry/node` reste sur
 * le serveur et n'entre dans aucun paquet envoyé au navigateur : le budget de
 * performance ne bouge pas d'un octet. C'est aussi là que se trouve l'essentiel
 * de ce qu'on veut voir — actions, routes, tâches périodiques.
 *
 * Sans `SENTRY_DSN`, tout continue de fonctionner : la journalisation
 * structurée suffit à chercher, et elle marche le jour du déploiement sans
 * qu'aucun compte n'ait à être créé.
 */

/** Le préfixe qui rend une recherche possible dans les journaux de l'hébergeur. */
const MARQUEUR = "[mall-express:erreur]";

/*
  Le client Sentry, chargé une seule fois et seulement s'il sert.

  L'import est différé : sans DSN, le module n'est jamais évalué, et son coût de
  démarrage — non nul sur une fonction sans état qui démarre à froid — n'est
  jamais payé.
*/
let sentry: typeof import("@sentry/node") | null = null;
let sentryPret: Promise<void> | null = null;

function preparerSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  /*
    Seulement dans l'environnement Node.

    `signaler` est aussi appelé depuis l'intergiciel, qui s'exécute sur Edge —
    où `@sentry/node` n'existe pas et ne peut pas exister. Le journal structuré,
    lui, fonctionne des deux côtés : c'est la partie qui compte le plus.
  */
  if (process.env.NEXT_RUNTIME !== "nodejs") return null;

  /*
    `webpackIgnore` : l'import échappe à l'empaquetage.

    Next compile `instrumentation.ts` pour l'environnement Node *et* pour Edge.
    Le bundler Edge suivait la chaîne jusqu'à `node:child_process`, qu'il ne
    sait pas traiter, et la construction échouait sur un « UnhandledSchemeError »
    qui ne nommait pas la cause. La garde `NEXT_RUNTIME` ci-dessus empêche
    l'exécution, pas l'analyse statique — seule cette annotation le fait.

    Node résout alors le module lui-même, au moment où il sert. `serverExternalPackages`
    garantit qu'il est bien déployé à côté.
  */
  sentryPret ??= import(/* webpackIgnore: true */ "@sentry/node")
    .then((mod) => {
      mod.init({
        dsn,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        /*
          Aucun échantillonnage de performance.

          On veut les erreurs, pas les traces : les traces coûtent cher en
          quota et n'apprennent rien qu'un journal structuré ne dise déjà pour
          une application de cette taille.
        */
        tracesSampleRate: 0,
      });
      sentry = mod;
    })
    .catch(() => {
      // Un service de suivi indisponible ne doit jamais gêner l'application.
    });

  return sentryPret;
}

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

    /*
      Sentry en plus du journal, jamais à sa place.

      Le journal est immédiat et sans dépendance ; Sentry regroupe, date et
      alerte. Perdre l'un ne doit pas faire perdre l'autre — et le jour où le
      quota Sentry est atteint, on veut encore pouvoir chercher.
    */
    const pret = preparerSentry();
    if (pret) {
      void pret.then(() => {
        sentry?.captureException(cause instanceof Error ? cause : new Error(message), {
          tags: { ou: contexte.ou },
          extra: contexte.quoi,
        });
      });
    }

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
