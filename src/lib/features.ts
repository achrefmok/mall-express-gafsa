/**
 * Le Live est de nouveau dans les menus et sur l'accueil (2026-10-27), pour
 * le faire tester par les vendeurs : onglet « Lives » de l'espace vendeur,
 * « Prochain direct » et « Lancer un direct » sur son tableau de bord, et
 * côté client l'onglet « Lives » et « Boutiques en direct » sur l'accueil.
 * Pendant la préparation, seuls l'administration et les vendeurs (dans leur
 * espace) les voient ; repasser ce drapeau à `false` le retire partout, les
 * pages `/lives` et `/vendeur/lives` restant joignables par leur adresse.
 */
export const LIVES_DANS_LES_MENUS = true;
