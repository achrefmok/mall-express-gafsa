/**
 * La clé VAPID publique, dans le code — et c'est délibéré.
 *
 * Elle n'est pas un secret : elle est inscrite en clair dans le paquet JavaScript
 * envoyé à chaque visiteur, et c'est sa raison d'être. Elle identifie l'émetteur
 * auprès du service de notifications du navigateur ; sans la clé privée, qui
 * reste sur le serveur, elle ne permet d'envoyer quoi que ce soit à personne.
 *
 * Pourquoi elle a quitté les variables d'environnement : une clé publique VAPID
 * fait 87 caractères, et un mot de 87 caractères se fait couper par le retour à
 * la ligne d'un terminal. Collée tronquée dans un tableau de bord, elle produit
 * un « applicationServerKey is not valid » du navigateur, sans indiquer ni la
 * cause ni l'endroit. Nous y avons perdu plusieurs allers-retours.
 *
 * Ici, la valeur est versionnée, relue à la revue, et impossible à tronquer sans
 * que la modification apparaisse dans l'historique. C'est le bon endroit pour une
 * constante publique.
 *
 * La variable d'environnement reste acceptée si elle est présente ET valide :
 * c'est ce qui permettra de changer de paire de clés sans nouvelle mise en ligne.
 * Une valeur invalide est ignorée au profit de celle-ci, plutôt que de casser les
 * notifications de tout le monde.
 *
 * En changeant cette clé, il faut changer `VAPID_PRIVATE_KEY` du même coup : les
 * deux forment une paire. Tous les abonnements existants deviennent alors
 * inutilisables et doivent être repris — c'est pourquoi on ne la change pas sans
 * raison.
 */

const BUILT_IN =
  "BHe5jgJvb4fYQ5B2xlk4A9eC_aEsYgTv-U-mvM4AC_lITDm9I-KpNFUeckLcYNAnoisGDnodR1RnIQnHJnQDhIU";

/**
 * Une clé VAPID publique est un point de courbe non compressé : 65 octets,
 * dont le premier vaut 4. Toute autre longueur signale une clé abîmée.
 */
export function isValidVapidPublicKey(key: string): boolean {
  const clean = key.replace(/\s+/g, "");
  if (clean.length !== 87) return false;

  // Base64url : seuls ces caractères, jamais d'espace ni de `+` ou `/`.
  return /^[A-Za-z0-9_-]+$/.test(clean);
}

/** La clé effectivement utilisée, côté navigateur comme côté serveur. */
export function vapidPublicKey(): string {
  const fromEnv = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.replace(/\s+/g, "") ?? "";
  return isValidVapidPublicKey(fromEnv) ? fromEnv : BUILT_IN;
}
