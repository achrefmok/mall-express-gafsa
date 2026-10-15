/**
 * ═══════════════════════════════════════════════════════════════════════
 * « Taxi & Louage Gafsa » — l'application de transport, sur son propre domaine
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Même dépôt, même base Supabase, même déploiement que G-Mall : seul le
 * domaine change. L'intergiciel reconnaît l'hôte de transport et sert alors
 * les pages de `src/app/transport/` — l'adresse visible reste `/taxi`,
 * `/louage`… —, avec leur propre coque, leur connexion, leur manifeste et
 * leur icône. Les comptes sont les mêmes ; les cookies, eux, appartiennent à
 * chaque domaine : on se connecte séparément à chaque application.
 *
 * Configuration :
 *   NEXT_PUBLIC_TRANSPORT_HOST   le domaine de l'application
 *                                (ex. « taxi-gafsa.vercel.app »). Vide : rien
 *                                ne change, G-Mall sert tout comme avant.
 * En développement, tout hôte « taxi.* » (ex. `taxi.localhost:3000`) est
 * reconnu, sans rien configurer.
 *
 * Ouverture : décision de l'utilisateur (2026-10-15) — l'application est
 * ouverte à tous tout de suite, inscription comprise, même pendant que
 * G-Mall reste en préparation.
 */

export const NOM_TRANSPORT = { fr: "Taxi & Louage Gafsa", ar: "تاكسي ولواج قفصة" } as const;
export const NOM_COURT_TRANSPORT = { fr: "Taxi & Louage", ar: "تاكسي ولواج" } as const;

/** L'en-tête posé par l'intergiciel sur une requête de l'application de transport. */
export const ENTETE_APP = "x-gm-app";

const HOTE_CONFIGURE = (process.env.NEXT_PUBLIC_TRANSPORT_HOST ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Cet hôte (en-tête `host`) est-il celui de l'application de transport ? */
export function estHoteTransport(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  if (HOTE_CONFIGURE && (h === HOTE_CONFIGURE || h.split(":")[0] === HOTE_CONFIGURE.split(":")[0])) return true;
  return process.env.NODE_ENV !== "production" && h.startsWith("taxi.");
}

/** Le domaine de transport est-il configuré pour la production ? */
export const TRANSPORT_CONFIGURE = HOTE_CONFIGURE !== "";

/**
 * Les adresses que sert l'application de transport, et seulement elles.
 * Elles sont réécrites vers `/transport/<chemin>` ; tout le reste renvoie
 * vers G-Mall.
 */
const PREFIXES_TRANSPORT = ["/taxi", "/louage", "/chauffeurs", "/courses", "/notifications", "/profil", "/devenir-chauffeur", "/connexion", "/inscription"];

/** Communes aux deux applications : servies telles quelles, sans réécriture. */
const PREFIXES_COMMUNS = ["/api", "/auth", "/mot-de-passe-oublie", "/hors-ligne", "/confidentialite", "/suppression-donnees", "/manifest-transport.webmanifest", "/transport-icon", "/brand-icon"];

const correspond = (chemin: string, prefixe: string) => chemin === prefixe || chemin.startsWith(`${prefixe}/`);

export function cheminTransport(chemin: string): boolean {
  return chemin === "/" || PREFIXES_TRANSPORT.some((p) => correspond(chemin, p));
}

export function cheminCommun(chemin: string): boolean {
  return PREFIXES_COMMUNS.some((p) => correspond(chemin, p));
}

/**
 * Ce qui, sur l'hôte G-Mall, appartient désormais à l'application de
 * transport : redirigé vers elle dès que son domaine est configuré.
 */
export function cheminQuiDemenage(chemin: string): boolean {
  return ["/taxi", "/louage", "/chauffeurs", "/profil/chauffeur"].some((p) => correspond(chemin, p));
}

/** Adresse absolue dans l'application de transport (production configurée), sinon le chemin seul. */
export function urlTransport(chemin: string): string {
  if (!TRANSPORT_CONFIGURE) return chemin;
  const proto = /^(localhost|127\.0\.0\.1)/.test(HOTE_CONFIGURE) ? "http" : "https";
  return `${proto}://${HOTE_CONFIGURE}${chemin}`;
}
