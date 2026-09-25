import type { ComponentType } from "react";
import {
  BoxIcon,
  CartIcon,
  GridIcon,
  HeartIcon,
  HomeIcon,
  SparkIcon,
  StoreIcon,
  UserIcon,
} from "./icons";

/**
 * Une icône par catégorie, à la place des deux lettres.
 *
 * Les monogrammes — « MO », « BE », « AL » — demandent une lecture avant de
 * renseigner, et la lecture est précisément ce qu'on économise dans une rangée
 * de tuiles. Une part des clients visés lit peu le français : un dessin de
 * cintre ou de panier se comprend sans savoir écrire « alimentation ».
 *
 * Le rattachement se fait par identifiant de catégorie, pas par nom : un
 * commerçant qui renomme « Beauté » en « Beauté & soins » ne doit pas perdre son
 * icône. La couleur reste celle de la catégorie — le dessin s'ajoute au repère
 * chromatique, il ne le remplace pas.
 *
 * Une catégorie inconnue retombe sur son monogramme : la grille reste complète
 * le jour où quelqu'un en ajoute une depuis l'administration, sans qu'il faille
 * livrer du code pour cela.
 */

type IconComponent = ComponentType<{ size?: number; className?: string }>;

const BY_SLUG: Record<string, IconComponent> = {
  mode: ShirtIcon,
  "mode-femme": ShirtIcon,
  "mode-homme": ShirtIcon,
  "mode-enfant": ShirtIcon,
  "mode-accessoires": BagIcon,
  beaute: SparkIcon,
  maison: HomeIcon,
  sport: BallIcon,
  alimentation: CartIcon,
  electronique: DeviceIcon,
  cafes: CupIcon,
  services: GridIcon,

  /* Les familles venues après : mêmes règles, même grille. */
  sante: StethoscopeIcon,
  "medecin-generaliste": StethoscopeIcon,
  dentiste: StethoscopeIcon,
  specialiste: StethoscopeIcon,
  laboratoire: StethoscopeIcon,
  "kine-soins": StethoscopeIcon,

  immobilier: BuildingIcon,
  "location-appartement": BuildingIcon,
  "location-maison": HomeIcon,
  "vente-appartement": BuildingIcon,
  "vente-maison": HomeIcon,
  terrain: BuildingIcon,
  "local-commercial": StoreIcon,

  enseignement: CapIcon,
  "ecole-privee": CapIcon,
  "cours-particuliers": CapIcon,
  "centre-formation": CapIcon,
  langues: CapIcon,
  informatique: DeviceIcon,
  "auto-ecole": CarIcon,

  "voitures-motos": CarIcon,
  "equipement-maison": SofaIcon,
  autres: GridIcon,

  "fete-evenements": PartyIcon,
  "sport-loisirs": BallIcon,
};

export function categoryIcon(slug: string): IconComponent | null {
  return BY_SLUG[slug] ?? null;
}

/**
 * L'icône d'un service pratique.
 *
 * Taxi, louage, pharmacie, prière : quatre pastilles qu'on cherche du regard
 * dans l'urgence — une pharmacie de garde à minuit, un louage qu'on ne veut
 * pas rater. Une lettre dans un rond ne se trouve pas à cette vitesse ; une
 * voiture, un minibus et une croix, si.
 */
const PAR_SERVICE: Record<string, IconComponent> = {
  taxi: CarIcon,
  louage: VanIcon,
  pharmacy: PharmacyIcon,
  prayer: MosqueIcon,
  transporteur: TruckIcon,
};

export function serviceIcon(kind: string): IconComponent | null {
  return PAR_SERVICE[kind] ?? null;
}

/* ─── Dessins propres aux catégories ─────────────────────────────────────
   Les icônes génériques du projet couvrent le reste ; celles-ci n'existaient
   pas. Même grille de 20 et même épaisseur de trait, pour qu'elles ne se
   distinguent pas des autres dans une même rangée. */

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 18, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Un vêtement sur cintre : la mode, tous rayons confondus. */
function ShirtIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7.5 3.5 4 5.5 3 8.5l2 .8V16h10V9.3l2-.8-1-3-3.5-2" />
      <path d="M7.5 3.5a2.5 2.5 0 0 0 5 0" />
    </Svg>
  );
}

/** Un sac à main : les accessoires. */
function BagIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 7h11l-1 9.5h-9L4.5 7Z" />
      <path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </Svg>
  );
}

/** Un ballon : le sport. */
function BallIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 3.5 12.4 8l-2.4 3-2.4-3L10 3.5Z" />
      <path d="M3.9 8.6 7.6 11m4.8 0 3.7-2.4M7.6 11l1.2 4.4m2.4-4.4-1.2 4.4" />
    </Svg>
  );
}

/** Un stéthoscope : les cabinets médicaux. */
function StethoscopeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 3.5v4a3.2 3.2 0 0 0 6.4 0v-4" />
      <path d="M3.6 3.5h2.8M10 3.5h2.8" />
      <path d="M8.2 10.7v1.6a3.6 3.6 0 0 0 7.2 0v-1.2" />
      <circle cx="15.4" cy="8.6" r="1.9" />
    </Svg>
  );
}

/** Un immeuble : l'immobilier — la maison est déjà prise par « Maison ». */
function BuildingIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 16.5V6.2L9 3.5l5.5 2.7v10.3" />
      <path d="M2.5 16.5h15" />
      <path d="M6.4 8.2h1.6M10 8.2h1.6M6.4 11.4h1.6M10 11.4h1.6" />
      <path d="M7.8 16.5v-2.6h2.4v2.6" />
    </Svg>
  );
}

/** Une toque : l'enseignement et la formation. */
function CapIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 4 2.8 7.4 10 10.8l7.2-3.4L10 4Z" />
      <path d="M5.6 9v3.8c0 1.2 2 2.2 4.4 2.2s4.4-1 4.4-2.2V9" />
      <path d="M17.2 7.4v4" />
    </Svg>
  );
}

/** Une voiture : les véhicules, et le taxi. */
function CarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.2 12.4h13.6v2.4a.8.8 0 0 1-.8.8h-1.2a.8.8 0 0 1-.8-.8v-.8H6v.8a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8v-2.4Z" />
      <path d="M4.4 12.4 5.8 7.6a1.4 1.4 0 0 1 1.3-1h5.8a1.4 1.4 0 0 1 1.3 1l1.4 4.8" />
      <path d="M6 14.4h8" />
      <circle cx="6.4" cy="12.4" r=".1" />
      <circle cx="13.6" cy="12.4" r=".1" />
    </Svg>
  );
}

/** Un minibus : le louage, qui part quand il est plein. */
function VanIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.8 6.6h9.4v7.2H2.8z" />
      <path d="M12.2 8.8h2.6l2.4 2.6v2.4h-5z" />
      <path d="M2.8 13.8h14.4" />
      <circle cx="6.2" cy="15.2" r="1.3" />
      <circle cx="14.2" cy="15.2" r="1.3" />
      <path d="M5 9h2.2M9 9h2" />
    </Svg>
  );
}

/** Une croix dans un cercle : la pharmacie. */
function PharmacyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="10" r="6.8" />
      <path d="M10 6.4v7.2M6.4 10h7.2" />
    </Svg>
  );
}

/** Un dôme et un minaret : l'heure de la prière. */
function MosqueIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.4 16.5v-5.2a4.6 4.6 0 0 1 9.2 0v5.2" />
      <path d="M3.6 16.5h12.8" />
      <path d="M16.4 16.5V7.2" />
      <path d="M16.4 7.2a1.2 1.2 0 1 0-.1 0" />
      <path d="M10 6.7V4.6" />
    </Svg>
  );
}

/** Un canapé : les équipements pour la maison. */
function SofaIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.4V7.8a1.6 1.6 0 0 1 1.6-1.6h8.8A1.6 1.6 0 0 1 16 7.8v2.6" />
      <path d="M2.8 10.4a1.6 1.6 0 0 1 3.2 0v1.8h8v-1.8a1.6 1.6 0 0 1 3.2 0v3.4H2.8z" />
      <path d="M4.6 13.8v1.6M15.4 13.8v1.6" />
    </Svg>
  );
}

/** Un ballon de fête : les fêtes et les événements. */
function PartyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 3.2a4 4 0 0 1 4 4c0 2.6-2.2 4.8-4 5.6-1.8-.8-4-3-4-5.6a4 4 0 0 1 4-4Z" />
      <path d="M10 12.8v1.4" />
      <path d="M10 14.2c-1 .8-1 1.8 0 2.6" />
      <path d="M15.4 4.4 16.6 3M16.8 8.2h1.6M4.2 4.4 3 3" />
    </Svg>
  );
}

/** Un écran : l'électronique. */
function DeviceIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="14" height="9" rx="1.5" />
      <path d="M7.5 16.5h5" />
    </Svg>
  );
}

/** Une tasse : les cafés. */
function CupIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 6.5h9v5a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4v-5Z" />
      <path d="M13.5 8h1.5a1.8 1.8 0 0 1 0 3.6h-1.5" />
      <path d="M6.5 3.5v1.4m3 -1.4v1.4" />
    </Svg>
  );
}

/** Un camion : le transporteur, qui déplace plus qu'un louage ne le fait. */
function TruckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 6.2h8.4v7.4H2.5z" />
      <path d="M10.9 8.8h2.8l2.8 2.9v2.9h-5.6z" />
      <path d="M2.5 13.6h14.8" />
      <circle cx="6" cy="15.2" r="1.3" />
      <circle cx="14.4" cy="15.2" r="1.3" />
    </Svg>
  );
}

/** Une patte : les animaux. */
function PawIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="13" r="3.4" />
      <circle cx="5.3" cy="8.6" r="1.7" />
      <circle cx="9.3" cy="5.6" r="1.7" />
      <circle cx="13.7" cy="5.6" r="1.7" />
      <circle cx="14.7" cy="8.6" r="1.7" />
    </Svg>
  );
}

/** Une clé plate : le dépannage, SOS. */
function ToolIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13.2 3.4a3.4 3.4 0 0 0-4.4 4.3L3.6 12.9a1.6 1.6 0 0 0 2.3 2.3l5.2-5.2a3.4 3.4 0 0 0 4.3-4.4l-2.1 2.1-1.9-.5-.5-1.9 2.1-2.1Z" />
    </Svg>
  );
}

export { PawIcon, ToolIcon };

/* Réexportés pour que l'appelant n'importe qu'un seul module. */
export { BoxIcon, HeartIcon, StoreIcon, UserIcon };
