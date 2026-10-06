import type { ThemeId } from "@/lib/boutique-themes";

/**
 * Ce que l'écran /vendeur/vitrine mesure pour construire la checklist —
 * des faits bruts, déjà lus côté serveur, jamais recalculés depuis le
 * thème lui-même. Aucun champ n'est obligatoire : une boutique toute
 * neuve a tout à `false`/`0`, et la checklist doit rester lisible dans
 * cet état, pas seulement une fois remplie.
 */
export interface DonneesCompletude {
  hasCover: boolean;
  hasLogo: boolean;
  hasHoraires: boolean;
  storiesActives: number;
  offreActive: boolean;
  produitsTotal: number;
  /** Produits ayant déjà le ou les attributs clés du métier (`type`, `famille_olfactive`…). */
  produitsAvecAttributCle: number;
  packsPrets: number;
  zonesLivraison: number;
}

export interface EtapeCompletude {
  id: string;
  fait: boolean;
  libelle: string;
  pourquoi: string;
  href: string;
}

export interface Completude {
  pourcentage: number;
  etapes: EtapeCompletude[];
}

/** Au moins une étape pour ne jamais diviser par zéro, même sur un thème sans règle propre. */
function etapesCommunes(d: DonneesCompletude): EtapeCompletude[] {
  return [
    {
      id: "identite",
      fait: d.hasCover && d.hasLogo,
      libelle: "Couverture et logo",
      pourquoi: "Sans eux, la vitrine s'ouvre sur un cadre vide à la place de la boutique.",
      href: "/vendeur/reglages#identite",
    },
    {
      id: "horaires",
      fait: d.hasHoraires,
      libelle: "Horaires renseignés",
      pourquoi: "Sans horaires, le badge \"Ouvert/Fermé\" ne peut rien afficher d'exact.",
      href: "/vendeur/reglages#horaires",
    },
    {
      id: "stories",
      fait: d.storiesActives > 0,
      libelle: "Au moins une story active",
      pourquoi: "Le rail sous l'en-tête reste masqué tant qu'aucune n'est publiée.",
      href: "/vendeur/vitrine#stories",
    },
    {
      id: "offre",
      fait: d.offreActive,
      libelle: "Une promotion active",
      pourquoi: "La carte \"Offre du jour\" ne s'affiche que si une promotion est en cours.",
      href: "/vendeur/promotions",
    },
  ];
}

const RATIO_SUFFISANT = 0.8;

/** Une étape par métier, sur une donnée que ce métier lit réellement (voir les layouts). */
function etapeMetier(theme: ThemeId, d: DonneesCompletude): EtapeCompletude | null {
  const ratio = d.produitsTotal > 0 ? d.produitsAvecAttributCle / d.produitsTotal : 0;
  const suffisant = d.produitsTotal > 0 && ratio >= RATIO_SUFFISANT;

  switch (theme) {
    case "mode":
      return {
        id: "mode-type",
        fait: suffisant,
        libelle: "Type renseigné sur 80 % des produits",
        pourquoi: "Sans \"type\" (Robes, Pulls…), tout reste dans le rayon \"Tout\", sans rayons distincts.",
        href: "/vendeur/produits",
      };
    case "electronique":
      return {
        id: "electro-specs",
        fait: suffisant,
        libelle: "Fiche technique sur 80 % des produits",
        pourquoi: "Sans stockage/écran/batterie, la fiche produit reste une simple photo sans repère de comparaison.",
        href: "/vendeur/produits",
      };
    case "beaute":
      return {
        id: "beaute-attributs",
        fait: suffisant,
        libelle: "Teintes, notes ou routine sur 80 % des produits",
        pourquoi: "Sans ces attributs, le trouveur de teinte et la pyramide olfactive n'ont rien à afficher.",
        href: "/vendeur/produits",
      };
    case "maison":
      return {
        id: "maison-piece",
        fait: suffisant,
        libelle: "Pièce renseignée sur 80 % des produits",
        pourquoi: "Sans \"pièce\", impossible de proposer une ambiance Salon/Chambre/Cuisine par pièce.",
        href: "/vendeur/produits",
      };
    case "bijouterie":
      return {
        id: "bijou-matiere",
        fait: suffisant,
        libelle: "Matière renseignée sur 80 % des produits",
        pourquoi: "Sans matière (Or/Argent/Fantaisie), le sélecteur de matière reste vide.",
        href: "/vendeur/produits",
      };
    case "parapharmacie":
      return {
        id: "para-besoin-pack",
        fait: suffisant && d.packsPrets > 0,
        libelle: "Besoin renseigné et au moins un pack prêt",
        pourquoi: "Sans \"besoin\", les puces restent vides ; sans pack, le rail \"Packs prêts\" n'apparaît pas.",
        href: "/vendeur/packs",
      };
    case "services":
      return {
        id: "services-zones",
        fait: d.zonesLivraison > 0,
        libelle: "Au moins une zone de livraison",
        pourquoi: "Sans zone, le tableau de tarifs par zone reste vide.",
        href: "/vendeur/livraison",
      };
    default:
      return null;
  }
}

export function calculerCompletude(theme: ThemeId, d: DonneesCompletude): Completude {
  const etapes = [...etapesCommunes(d)];
  const propreAuMetier = etapeMetier(theme, d);
  if (propreAuMetier) etapes.push(propreAuMetier);

  const faites = etapes.filter((e) => e.fait).length;
  const pourcentage = Math.round((faites / etapes.length) * 100);

  return { pourcentage, etapes };
}
