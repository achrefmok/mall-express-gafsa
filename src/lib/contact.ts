/**
 * Liens d'appel et de WhatsApp à partir d'un numéro saisi à la main.
 *
 * Les numéros arrivent tels que les gens les écrivent : « 98 123 456 »,
 * « +216 98123456 », « 00216-98-12-34-56 ». WhatsApp, lui, n'accepte qu'une
 * suite de chiffres précédée de l'indicatif pays, sans signe ni espace — un
 * numéro mal formé ouvre une page d'erreur au lieu d'une conversation.
 *
 * L'indicatif tunisien est ajouté quand il manque, ce qui est le cas de la
 * plupart des saisies locales : personne n'écrit son propre indicatif dans son
 * propre pays.
 */

const TUNISIA = "216";

/** Chiffres seuls, indicatif compris. Rend `null` si rien d'exploitable. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D+/g, "");
  if (!digits) return null;

  // 00216… → 216…  (le préfixe international à l'ancienne)
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Huit chiffres : un numéro tunisien sans indicatif.
  if (digits.length === 8) digits = TUNISIA + digits;

  // En deçà, ce n'est pas un numéro joignable — mieux vaut ne rien proposer
  // qu'un lien qui échoue.
  return digits.length >= 10 ? digits : null;
}

/** `tel:` — l'appel direct, qui fonctionne partout, y compris sur un fixe. */
export function telHref(raw: string | null | undefined): string | null {
  const digits = normalizePhone(raw);
  return digits ? `tel:+${digits}` : null;
}

/**
 * `wa.me` — WhatsApp, avec un premier message déjà écrit.
 *
 * L'adresse `wa.me` est celle que WhatsApp recommande : elle ouvre
 * l'application si elle est installée, et le site sinon. Le message d'amorce
 * évite le silence gêné du premier contact, et dit d'où vient la personne.
 */
export function whatsAppHref(
  raw: string | null | undefined,
  message?: string,
): string | null {
  const digits = normalizePhone(raw);
  if (!digits) return null;

  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${query}`;
}
