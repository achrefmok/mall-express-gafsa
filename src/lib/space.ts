/**
 * ═══════════════════════════════════════════════════════════════════════
 * Découpage de l'application en déploiements séparés
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Un seul dépôt, plusieurs hébergements. `NEXT_PUBLIC_APP_SPACE` décide de ce
 * qu'un déploiement accepte de servir :
 *
 *   all      toutes les routes — le défaut, et le comportement historique
 *   client   la marketplace, les directs, le panier, les services
 *   vendor   la console du vendeur et l'administration
 *
 * Pourquoi pas deux dépôts : les deux espaces partagent le lecteur de direct, le
 * panier, les primitives d'interface, les types de la base et les actions
 * serveur. Les séparer obligerait à corriger chaque défaut deux fois, et les
 * deux copies divergeraient au premier correctif pressé.
 *
 * Ce qu'il faut savoir avant de découper
 * ──────────────────────────────────────
 * La session Supabase vit dans un cookie, et un cookie appartient à un domaine.
 * Deux domaines sans parent commun — `boutique.tn` et `vendeurs.tn` — imposent
 * deux connexions au même vendeur, qui est aussi un client. Deux sous-domaines
 * d'un même parent — `www.mall.tn` et `vendeur.mall.tn` — peuvent partager la
 * session. Le découpage se paie donc en confort de connexion dès qu'on choisit
 * des domaines étrangers l'un à l'autre.
 */

export type AppSpace = "all" | "client" | "vendor";

export const APP_SPACE: AppSpace =
  process.env.NEXT_PUBLIC_APP_SPACE === "client"
    ? "client"
    : process.env.NEXT_PUBLIC_APP_SPACE === "vendor"
      ? "vendor"
      : "all";

/** Les préfixes qui appartiennent à l'espace vendeur. L'administration y vit. */
const VENDOR_PREFIXES = ["/vendeur", "/admin"];

export function isVendorPath(pathname: string): boolean {
  return VENDOR_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/*
  Ce qui appartient aux deux espaces, quel que soit le découpage.

  Les routes techniques d'abord : une session se rafraîchit des deux côtés, et
  couper `/auth/callback` sur l'un des deux casserait la connexion par courriel.

  Les écrans de connexion et d'inscription ensuite, et c'est indispensable. Sans
  eux, l'espace vendeur renvoyait `/connexion` vers l'hôte client — où le vendeur
  se connectait, pour un cookie qui ne vaut que là-bas. Deux adresses en
  `.vercel.app` n'ayant pas de domaine parent commun, la session ne revenait
  jamais : l'espace vendeur était inaccessible à tout le monde, définitivement.
  Chaque espace doit porter sa propre porte d'entrée.
*/
const SHARED_PREFIXES = ["/api/", "/auth/", "/connexion", "/inscription", "/hors-ligne"];

function isSharedPath(pathname: string): boolean {
  return SHARED_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
  );
}

/** Ce déploiement sert-il cette route ? */
export function servesPath(pathname: string): boolean {
  if (APP_SPACE === "all") return true;
  if (isSharedPath(pathname)) return true;

  return APP_SPACE === "vendor" ? isVendorPath(pathname) : !isVendorPath(pathname);
}

/*
  Adresses absolues des deux espaces, pour les liens qui traversent la frontière.

  Vides tant que rien n'est découpé : les liens restent alors relatifs, ce qui
  est exactement le comportement d'aujourd'hui. C'est ce qui permet de préparer
  le découpage sans rien changer pour un déploiement unique.
*/
const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL?.replace(/\/$/, "") ?? "";
const VENDOR_URL = process.env.NEXT_PUBLIC_VENDOR_URL?.replace(/\/$/, "") ?? "";

/**
 * Adresse à utiliser pour un lien, selon l'espace qui le sert.
 *
 * Depuis l'espace client, un lien vers `/vendeur` doit sortir vers l'autre
 * hébergement — sinon il tombe sur une route que ce déploiement ne sert pas.
 * Sans découpage, la fonction rend le chemin inchangé.
 */
/**
 * Adresse d'une route *chez l'autre espace*, ou `null` si rien n'est découpé.
 *
 * `spaceHref` ne sait renvoyer que ce qui n'est pas servi ici ; certains liens
 * doivent au contraire désigner explicitement l'autre hébergement, alors même
 * que la route existe des deux côtés. L'inscription en est le cas type : chaque
 * espace la sert, mais un commerçant venu du côté client doit être envoyé créer
 * sa boutique là où elle se gère.
 *
 * `null` plutôt qu'un chemin relatif : l'appelant peut alors masquer le lien
 * quand il n'y a pas d'autre espace, au lieu d'en afficher un qui tourne en rond.
 */
export function crossSpaceHref(space: "client" | "vendor", pathname: string): string | null {
  const base = space === "vendor" ? VENDOR_URL : CLIENT_URL;
  return base ? `${base}${pathname}` : null;
}

export function spaceHref(pathname: string): string {
  if (APP_SPACE === "all") return pathname;

  const wantsVendor = isVendorPath(pathname);

  if (wantsVendor && APP_SPACE === "client" && VENDOR_URL) return `${VENDOR_URL}${pathname}`;
  if (!wantsVendor && APP_SPACE === "vendor" && CLIENT_URL) return `${CLIENT_URL}${pathname}`;

  return pathname;
}
