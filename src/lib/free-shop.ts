/**
 * Les deux limites du G-Shop, écrites une fois.
 *
 * Elles vivent ici et non dans `actions/deals.ts` : un fichier « use server »
 * n'exporte que des fonctions asynchrones, et un écran qui a besoin du chiffre
 * pour l'afficher n'a pas à tirer tout le module d'actions derrière lui.
 *
 * Ce ne sont pas elles qui décident. La contrainte `deals_quatre_photos` et le
 * déclencheur `freeshop_limite_mensuelle` refusent, en base, ce que ces deux
 * nombres se contentent d'annoncer. Un formulaire se contourne ; une
 * contrainte non. Si l'un des deux chiffres change ici, il doit changer là-bas
 * — et c'est la base qui a raison.
 */

/** Quatre photos par publication. */
export const FREESHOP_PHOTOS_MAX = 4;

/** Trois publications par mois et par membre. */
export const FREESHOP_PAR_MOIS = 3;
