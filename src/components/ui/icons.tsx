import type { SVGProps } from "react";

/**
 * Icônes monochromes tracées, reprises du handoff (loupe, cloche, panier,
 * enveloppe, bulle). Trait 1.4–1.6 sur une grille 20 × 20 : elles restent
 * nettes à 17 px, la taille utilisée dans les barres supérieures.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 17, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
    <path d="M3.2 6l6.8 5 6.8-5" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 8a4 4 0 0 1 8 0v3l1.5 2.5h-11L6 11V8z" />
    <path d="M8.5 15.6a1.7 1.7 0 0 0 3 0" />
  </Svg>
);

export const CartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h2.2l2 8h8.3L17 6.5H6" />
    <circle cx="8.5" cy="15.6" r="1.2" />
    <circle cx="14.3" cy="15.6" r="1.2" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg strokeWidth={1.6} {...p}>
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M12.8 12.8L17 17" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4.5h14v9H8.5l-4 3v-3H3z" />
  </Svg>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg fill={filled ? "currentColor" : "none"} {...p}>
    <path d="M10 16.5S3.5 12.6 3.5 8.2A3.7 3.7 0 0 1 10 5.9a3.7 3.7 0 0 1 6.5 2.3c0 4.4-6.5 8.3-6.5 8.3z" />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 13.5V3.5M10 3.5L6.5 7M10 3.5L13.5 7" />
    <path d="M4 11v4.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V11" />
  </Svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg strokeWidth={1.6} className="flip-rtl" {...p}>
    <path d="M12.5 4L6.5 10l6 6" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg strokeWidth={1.6} className="flip-rtl" {...p}>
    <path d="M8 4l6 6-6 6" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg strokeWidth={1.6} {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M10 4.5v11M4.5 10h11" />
  </Svg>
);

export const MinusIcon = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M4.5 10h11" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 2.5v1.8M10 15.7v1.8M17.5 10h-1.8M4.3 10H2.5M15.3 4.7l-1.3 1.3M6 14l-1.3 1.3M15.3 15.3L14 14M6 6L4.7 4.7" />
  </Svg>
);

export const MenuIcon = (p: IconProps) => (
  <Svg strokeWidth={1.6} {...p}>
    <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
  </Svg>
);

export const DotsIcon = (p: IconProps) => (
  <Svg fill="currentColor" stroke="none" {...p}>
    <circle cx="10" cy="4.5" r="1.4" />
    <circle cx="10" cy="10" r="1.4" />
    <circle cx="10" cy="15.5" r="1.4" />
  </Svg>
);

export const UpIcon = (p: IconProps) => (
  <Svg fill="currentColor" stroke="none" {...p}>
    <path d="M10 4.5l6 8H4z" />
  </Svg>
);

export const DownIcon = (p: IconProps) => (
  <Svg fill="currentColor" stroke="none" {...p}>
    <path d="M10 15.5l-6-8h12z" />
  </Svg>
);

export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 6.5h3l1.2-2h6.6l1.2 2h3v9h-15z" />
    <circle cx="10" cy="10.5" r="3" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="15" height="12" rx="2" />
    <circle cx="7" cy="8" r="1.3" />
    <path d="M3.5 14l4-4 3.5 3 2.5-2 3 3" />
  </Svg>
);

export const MicIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7.7" y="2.5" width="4.6" height="9" rx="2.3" />
    <path d="M4.8 9.5a5.2 5.2 0 0 0 10.4 0M10 14.7v2.8" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 17.5s5.2-5 5.2-9a5.2 5.2 0 1 0-10.4 0c0 4 5.2 9 5.2 9z" />
    <circle cx="10" cy="8.4" r="1.9" />
  </Svg>
);

export const StoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5h14l1 3.5a2.4 2.4 0 0 1-4.7.6 2.4 2.4 0 0 1-4.6 0 2.4 2.4 0 0 1-4.7-.6z" />
    <path d="M4.3 10.5V16h11.4v-5.5" />
  </Svg>
);

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 9.2L10 3.5l6.5 5.7" />
    <path d="M5.2 10.6V16h9.6v-5.4" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="6" height="6" rx="1.5" />
    <rect x="11" y="3" width="6" height="6" rx="1.5" />
    <rect x="3" y="11" width="6" height="6" rx="1.5" />
    <rect x="11" y="11" width="6" height="6" rx="1.5" />
  </Svg>
);

export const SparkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 2.5l1.9 5.1 5.1 1.9-5.1 1.9L10 16.5l-1.9-5.1L3 9.5l5.1-1.9z" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="7" r="3.2" />
    <path d="M4 16.5c0-2.8 2.7-4.4 6-4.4s6 1.6 6 4.4" />
  </Svg>
);

export const BoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 2.8l6.5 3.3v7.8L10 17.2 3.5 13.9V6.1z" />
    <path d="M3.5 6.1L10 9.4l6.5-3.3M10 9.4v7.8" />
  </Svg>
);

export const FlagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 17.5V3.5h9l-1.6 3 1.6 3H5" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 2.5l6 2.2v4.8c0 4-2.5 6.8-6 8-3.5-1.2-6-4-6-8V4.7z" />
    <path d="M7.3 9.7l1.9 1.9 3.5-3.9" />
  </Svg>
);

/** Point plein « en direct », animé. */
export const LiveDot = ({ size = 10 }: { size?: number }) => (
  <span
    className="animate-live-dot inline-block flex-none rounded-full bg-[var(--color-live-fill)]"
    style={{ width: size, height: size }}
    aria-hidden
  />
);
