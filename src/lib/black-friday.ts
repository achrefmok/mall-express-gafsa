/**
 * La règle du Black Friday, sans base ni navigateur.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que ce module décide, et ce qu'il ne décide pas
 * ────────────────────────────────────────────────────────────────────────
 *
 * Il **affiche**. Il ne **permet** rien. Qu'une offre soit visible, qu'un prix
 * soit appliqué au paiement, qu'une modification soit refusée après la fin :
 * tout cela est tranché par Postgres, à l'heure du serveur — la policy de
 * `black_friday_offers`, le déclencheur `black_friday_garde`, `place_order`.
 *
 * Ce module ne fait que dire la même chose à l'écran : quel statut montrer,
 * combien de temps il reste, quel pourcentage écrire. Il est pur — aucune
 * dépendance, l'heure en paramètre — pour que les tests puissent éprouver
 * les bornes à la seconde près sans attendre un vendredi.
 *
 * La fenêtre ici **doit** rester celle du déclencheur SQL
 * `black_friday_fenetre` : vendredi 00:01 → samedi 00:01, heure de Tunis.
 * Si l'une change, l'autre doit suivre.
 */

/** Où en est la campagne par rapport à l'heure. */
export type PhaseCampagne = "aucune" | "avant" | "actif" | "termine";

/** Ce qu'on affiche d'une offre au commerçant. */
export type StatutOffre = "preparation" | "programme" | "actif" | "termine" | "modere";

/**
 * Le décalage de Tunis, en minutes.
 *
 * UTC+1 toute l'année : la Tunisie a abandonné l'heure d'été en 2009. Le SQL
 * s'en remet à `Africa/Tunis` et suivrait un changement de règle ; ce module,
 * lui, l'écrit en dur parce qu'il ne sert qu'à l'affichage et aux tests. Un
 * écart éventuel se verrait tout de suite — les dates viennent du serveur.
 */
const DECALAGE_TUNIS_MIN = 60;

/** Vrai si la date ISO (AAAA-MM-JJ) tombe un vendredi. */
export function estVendredi(dateIso: string): boolean {
  const d = new Date(`${dateIso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 5;
}

/**
 * La fenêtre d'un vendredi : 00:01 heure de Tunis, et vingt-quatre heures.
 *
 * Pourquoi 00:01 et non minuit : c'est la règle demandée, et elle a une vertu
 * — minuit pile appartient aux deux jours dans le langage courant, 00:01 à un
 * seul.
 */
export function fenetreDuVendredi(dateIso: string): { debut: Date; fin: Date } {
  const minuitUtc = Date.parse(`${dateIso}T00:00:00Z`);
  const debut = new Date(minuitUtc + (1 - DECALAGE_TUNIS_MIN) * 60_000);
  const fin = new Date(debut.getTime() + 24 * 60 * 60_000);
  return { debut, fin };
}

/** La phase d'une campagne à un instant donné. Borne de fin exclue. */
export function phaseCampagne(
  debut: Date | string | null,
  fin: Date | string | null,
  maintenant: Date | number,
): PhaseCampagne {
  if (!debut || !fin) return "aucune";

  const d = new Date(debut).getTime();
  const f = new Date(fin).getTime();
  const n = typeof maintenant === "number" ? maintenant : maintenant.getTime();

  if (Number.isNaN(d) || Number.isNaN(f)) return "aucune";
  if (n < d) return "avant";
  if (n < f) return "actif";
  return "termine";
}

/**
 * Le statut d'une offre, tel qu'on le montre au commerçant.
 *
 * La modération passe devant tout : une offre retirée par l'administration
 * ne doit jamais apparaître « active » à son auteur, même dans la fenêtre.
 */
export function statutOffre(
  offre: { active: boolean; moderee: boolean },
  phase: PhaseCampagne,
): StatutOffre {
  if (offre.moderee) return "modere";
  if (phase === "termine") return "termine";
  if (!offre.active) return "preparation";
  return phase === "actif" ? "actif" : "programme";
}

/**
 * Le pourcentage de réduction, arrondi à l'entier.
 *
 * `null` quand il n'y a pas de réduction réelle : un prix Black Friday égal
 * ou supérieur au prix normal n'est pas une offre, et afficher « −0 % » ou
 * « +5 % » serait pire que ne rien afficher.
 */
export function pourcentageReduction(normal: number, bf: number): number | null {
  if (!Number.isFinite(normal) || !Number.isFinite(bf)) return null;
  if (normal <= 0 || bf <= 0 || bf >= normal) return null;

  const p = Math.round(((normal - bf) / normal) * 100);
  // Une réduction de 0,3 % s'arrondit à zéro : elle n'est pas affichable.
  return p >= 1 ? Math.min(99, p) : null;
}

/**
 * Un prix Black Friday tel qu'une carte produit le reçoit : le prix, et la
 * fenêtre de la campagne qui le porte.
 */
export interface PrixBf {
  prix: number;
  debut: string;
  fin: string;
}

/**
 * Ce prix est-il en vigueur à cet instant ? Borne de fin exclue, comme
 * `phaseCampagne` — c'est la même règle, et c'est elle qu'on appelle.
 *
 * Pourquoi la carte revérifie ce que la base a déjà filtré : certaines pages
 * sont mises en cache plusieurs minutes (la boutique, cinq). Une page rendue
 * à 23:58 et servie à 00:03 le samedi montrerait encore l'offre ; avec la
 * fenêtre en main, la carte la retire d'elle-même à l'heure dite. Le prix
 * facturé, lui, n'a jamais dépendu de cet affichage : `place_order` le
 * recalcule à l'heure du serveur.
 */
export function bfEnVigueur(bf: PrixBf | null | undefined, maintenant: number): bf is PrixBf {
  if (!bf) return false;
  return phaseCampagne(bf.debut, bf.fin, maintenant) === "actif";
}

/**
 * Le prochain vendredi à partir d'un instant, en date de Tunis.
 *
 * Si l'on est vendredi avant la fin de la fenêtre, c'est aujourd'hui : un
 * administrateur qui prépare la campagne le matin même ne doit pas se voir
 * proposer la semaine suivante.
 */
export function prochainVendredi(depuis: Date): string {
  const local = new Date(depuis.getTime() + DECALAGE_TUNIS_MIN * 60_000);
  const jour = local.getUTCDay();
  const ecart = (5 - jour + 7) % 7;

  const cible = new Date(Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + ecart,
  ));

  return cible.toISOString().slice(0, 10);
}

export interface Decompte {
  jours: number;
  heures: number;
  minutes: number;
  secondes: number;
  /** Plus rien à décompter. */
  ecoule: boolean;
}

/** Décompose une durée en millisecondes. Jamais négative. */
export function decompte(ms: number): Decompte {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    jours: Math.floor(total / 86_400),
    heures: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    secondes: total % 60,
    ecoule: total === 0,
  };
}

/**
 * Le décompte en texte court.
 *
 * Au-delà d'un jour, les secondes ne disent rien et font clignoter l'écran :
 * « 02j 05h 32m ». Sous un jour, elles disent l'urgence : « 12h 24m 18s ».
 */
export function formatDecompte(d: Decompte): string {
  const deux = (n: number) => String(n).padStart(2, "0");
  if (d.jours > 0) return `${deux(d.jours)}j ${deux(d.heures)}h ${deux(d.minutes)}m`;
  return `${deux(d.heures)}h ${deux(d.minutes)}m ${deux(d.secondes)}s`;
}
