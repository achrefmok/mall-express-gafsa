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
};

export function categoryIcon(slug: string): IconComponent | null {
  return BY_SLUG[slug] ?? null;
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

/* Réexportés pour que l'appelant n'importe qu'un seul module. */
export { BoxIcon, HeartIcon, StoreIcon, UserIcon };
