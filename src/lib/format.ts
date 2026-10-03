import type { AppLocale } from "@/types/database";

/**
 * Le dinar tunisien se subdivise en millimes (3 décimales). L'usage courant
 * dans le commerce de détail affiche les entiers sans décimale — « 89 DT » —
 * et ne montre les millimes que s'ils existent.
 */
export function formatPrice(value: number | string | null | undefined, locale: AppLocale = "fr"): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(amount)) return "—";

  const hasFraction = Math.abs(amount % 1) > 0.0005;
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-TN" : "fr-TN", {
    minimumFractionDigits: hasFraction ? 3 : 0,
    maximumFractionDigits: 3,
  }).format(amount);

  return `${formatted} ${locale === "ar" ? "د.ت" : "DT"}`;
}

/** Compteurs sociaux : 12400 → « 12.4k ». */
export function formatCount(n: number | null | undefined): string {
  const value = n ?? 0;
  if (value < 1000) return String(value);
  if (value < 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (value < 1_000_000) return `${Math.round(value / 1000)}k`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function formatRating(sum: number, count: number): string {
  if (!count) return "—";
  return (sum / count).toFixed(1);
}

/** « il y a 25 min », « il y a 2 h », « il y a 3 j ». */
export function timeAgo(iso: string, locale: AppLocale = "fr"): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-TN" : "fr-FR", {
    numeric: "auto",
    style: "short",
  });

  if (seconds < 60) return rtf.format(-seconds, "second");
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 2_592_000) return rtf.format(-Math.floor(seconds / 86_400), "day");
  return rtf.format(-Math.floor(seconds / 2_592_000), "month");
}

export function formatDateTime(iso: string, locale: AppLocale = "fr"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : "fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: AppLocale = "fr"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : "fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Tunis",
  }).format(new Date(iso));
}

/** « 16:42 » à partir d'un `time` PostgreSQL (« 16:42:00 »). */
export function formatTime(sqlTime: string | null | undefined): string {
  if (!sqlTime) return "—";
  return sqlTime.slice(0, 5);
}

/**
 * La date du jour à Gafsa, au format `YYYY-MM-DD`.
 *
 * `toISOString()` rendrait la date UTC : entre minuit et une heure du matin à
 * Tunis (UTC+1), elle retomberait sur la veille. Tout ce qui cherche une ligne
 * `on_date` — prière, pharmacie de garde — doit demander la date locale de
 * Tunis, ou il ne trouvera rien pour « aujourd'hui ».
 */
export function tunisDateISO(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Tunis",
  }).format(date);
}

/** Compte à rebours « 02:41 » pour l'offre live. */
export function countdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Monogramme de deux lettres, comme les pastilles de catégorie. */
export function monogram(...parts: Array<string | null | undefined>): string {
  const words = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(" ")
    .split(/[\s—–-]+/)
    .filter(Boolean);

  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function fullName(
  profile: { first_name?: string | null; last_name?: string | null } | null | undefined,
): string {
  if (!profile) return "";
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
}

/** « Mohamed Karray » → « Mohamed K. », comme sur les cartes de bons plans. */
export function shortName(
  profile: { first_name?: string | null; last_name?: string | null } | null | undefined,
): string {
  if (!profile) return "";
  const first = profile.first_name?.trim() ?? "";
  const initial = profile.last_name?.trim()?.[0];
  return initial ? `${first} ${initial}.` : first;
}

/**
 * Un nom de boutique qui ressemble à une adresse e-mail.
 *
 * Le nom sert de base au slug (`slugify`), qui devient l'adresse publique de
 * la boutique — `/boutique/<slug>`. Une adresse e-mail saisie là (par erreur,
 * ou faute de mieux au moment de l'inscription) finit donc translittérée dans
 * une URL que l'app partage activement (BoutonPartage, images Open Graph) :
 * l'adresse du commerçant fuite dans chaque lien partagé, même après qu'il
 * ait renommé sa boutique — le slug, lui, ne change pas rétroactivement.
 * Un seul « @ » suffit à la repérer, sans faux positif sur un nom de
 * boutique ordinaire.
 */
export function ressembleAUneAdresseEmail(nom: string): boolean {
  return nom.includes("@");
}

/** Discount percentage from a compare-at price. */
export function percentOff(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
