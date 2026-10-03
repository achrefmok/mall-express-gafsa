import "server-only";

import type { AppLocale } from "@/types/database";

/**
 * Traduction automatique du nom et de la description d'une boutique.
 *
 * Décision explicite et confirmée : un seul champ côté commerçant plutôt
 * que deux (un par langue). Le texte qu'il écrit — dans la langue où son
 * interface est réglée au moment où il écrit — est traduit vers l'autre
 * langue à l'enregistrement, via l'API Google Cloud Translation.
 *
 * Nécessite `GOOGLE_TRANSLATE_API_KEY` dans les variables d'environnement.
 * Absente, ou l'appel échoue : on renvoie `null` plutôt que de bloquer
 * l'enregistrement — la colonne dans l'autre langue garde alors sa valeur
 * précédente, elle n'est jamais écrasée par un vide.
 *
 * La traduction automatique rend l'arabe standard (MSA), pas le dialecte
 * tunisien parlé sur le reste du site : un commerçant qui veut son propre
 * phrasé garde la main en rééditant le texte une fois l'interface basculée
 * dans l'autre langue — l'action n'écrase alors que ce qu'elle vient de
 * traduire, jamais un texte qu'il a lui-même écrit après coup.
 */
export async function traduireTexte(
  texte: string,
  depuis: AppLocale,
  vers: AppLocale,
): Promise<string | null> {
  const propre = texte.trim();
  if (!propre) return null;

  const cle = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!cle) return null;

  try {
    const reponse = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${cle}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: propre, source: depuis, target: vers, format: "text" }),
        // Dix secondes : un enregistrement de réglages ne doit pas rester
        // suspendu à un service tiers plus longtemps qu'il ne faut pour
        // écrire une phrase.
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!reponse.ok) return null;

    const data = (await reponse.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };
    return data.data?.translations?.[0]?.translatedText?.trim() || null;
  } catch {
    return null;
  }
}
