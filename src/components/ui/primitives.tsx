import Link from "next/link";
import { categoryIcon } from "./category-icons";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/format";

/* ═══════════════════════════════════════════════════════════════════════
   Briques du système « Halo ».
   Toute la fidélité au handoff est concentrée ici : les écrans composent
   ces briques plutôt que de répéter des classes.
   ═══════════════════════════════════════════════════════════════════════ */

/** Carte flottante : surface translucide, bord clair, ombre douce, r18. */
export function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "article" | "li";
  className?: string;
  children: ReactNode;
  // HTMLAttributes<HTMLElement> plutôt que ComponentProps<"div"> : les
  // gestionnaires d'événements doivent rester compatibles avec les quatre
  // balises autorisées par `as`.
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cx(
        "rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cx("text-[11px] font-bold tracking-[0.2px] text-[var(--color-ink)]", className)}>
      {children}
    </h2>
  );
}

/* ─── Pastille de catégorie ──────────────────────────────────────────────
   `hue` vient de la base. Fond et texte en découlent par la règle
   systémique — aucune couleur n'est écrite en dur ici. */

export function CategoryTile({
  hue,
  monogram,
  label,
  slug,
  size = 48,
  href,
}: {
  hue: number;
  monogram: string;
  label: string;
  /** Sert à choisir le dessin ; sans lui, la tuile garde son monogramme. */
  slug?: string;
  size?: number;
  href?: string;
}) {
  /*
    Un dessin plutôt que deux lettres, quand la catégorie en a un.

    « MO », « BE », « AL » demandent une lecture avant de renseigner — et la
    lecture est précisément ce qu'on économise dans une rangée de tuiles. Une
    part des clients visés lit peu le français : un cintre ou un panier se
    comprend sans savoir écrire « alimentation ».

    Le monogramme reste le repli. Une catégorie ajoutée depuis l'administration
    s'affiche donc correctement sans qu'il faille livrer du code.
  */
  const Icon = slug ? categoryIcon(slug) : null;
  const inner = (
    <>
      <span
        className="cat-surface cat-ring cat-ink flex items-center justify-center rounded-[16px] font-semibold tracking-[0.5px]"
        style={
          {
            "--hue": hue,
            width: size,
            height: size,
            fontSize: size * 0.354,
          } as React.CSSProperties
        }
        aria-hidden
      >
        {Icon ? <Icon size={Math.round(size * 0.46)} /> : monogram}
      </span>
      <span className="text-center text-[9.5px] leading-tight text-[var(--color-ink)]">{label}</span>
    </>
  );

  const className = "flex flex-col items-center gap-[5px]";

  return href ? (
    <Link href={href} className={cx(className, "transition-opacity active:opacity-70")}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/* ─── Chips ───────────────────────────────────────────────────────────── */

export type ChipTone = "brand" | "tinted" | "outline" | "category" | "live";

export function Chip({
  tone = "outline",
  hue,
  active,
  className,
  children,
  ...rest
}: {
  tone?: ChipTone;
  hue?: number;
  active?: boolean;
  children: ReactNode;
} & ComponentProps<"button">) {
  const base =
    "flex-none whitespace-nowrap rounded-[14px] px-[13px] py-[6px] text-[10.5px] font-semibold transition-colors";

  const tones: Record<ChipTone, string> = {
    brand: "bg-[var(--color-brand)] text-white",
    tinted: "bg-[var(--color-brand-tint)] text-[var(--color-brand)]",
    outline: "border border-[var(--color-outline)] text-[var(--color-muted)]",
    category: "cat-surface cat-ink",
    live: "border border-[var(--color-outline)] text-[var(--color-live)]",
  };

  const resolved = active ? "brand" : tone;

  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(base, tones[resolved], className)}
      style={hue !== undefined ? ({ "--hue": hue } as React.CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Variante non interactive (badge de statut, étiquette). */
export function Tag({
  tone = "tinted",
  hue,
  className,
  children,
}: {
  tone?: ChipTone;
  hue?: number;
  className?: string;
  children: ReactNode;
}) {
  const tones: Record<ChipTone, string> = {
    brand: "bg-[var(--color-brand)] text-white",
    tinted: "bg-[var(--color-brand-tint)] text-[var(--color-brand)]",
    outline: "border border-[var(--color-outline)] text-[var(--color-muted)]",
    category: "cat-surface cat-ink",
    live: "bg-[var(--color-live)] text-white",
  };

  return (
    <span
      className={cx(
        "inline-flex flex-none items-center whitespace-nowrap rounded-[11px] px-2 py-1 text-[9.5px] font-bold",
        tones[tone],
        className,
      )}
      style={hue !== undefined ? ({ "--hue": hue } as React.CSSProperties) : undefined}
    >
      {children}
    </span>
  );
}

/* ─── Boutons ─────────────────────────────────────────────────────────── */

type ButtonTone = "primary" | "outline" | "ghost" | "danger" | "white";

const BUTTON_TONES: Record<ButtonTone, string> = {
  primary: "bg-[var(--color-brand)] text-white active:bg-[var(--color-brand-strong)]",
  outline: "border-[1.5px] border-[var(--color-brand)] text-[var(--color-brand)]",
  ghost: "text-[var(--color-brand)]",
  danger: "bg-[var(--color-live)] text-white",
  white: "bg-white text-[var(--color-ink)]",
};

export function Button({
  tone = "primary",
  block,
  size = "md",
  className,
  children,
  ...rest
}: {
  tone?: ButtonTone;
  block?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
} & ComponentProps<"button">) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center rounded-[16px] font-semibold transition-[opacity,background-color]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "px-3 py-[7px] text-[10.5px]" : "px-4 py-3 text-[13px]",
        block && "w-full",
        BUTTON_TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  tone = "primary",
  block,
  size = "md",
  className,
  children,
  ...rest
}: {
  tone?: ButtonTone;
  block?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
} & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx(
        "inline-flex items-center justify-center rounded-[16px] text-center font-semibold",
        size === "sm" ? "px-3 py-[7px] text-[10.5px]" : "px-4 py-3 text-[13px]",
        block && "w-full",
        BUTTON_TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

/* ─── Interrupteur ────────────────────────────────────────────────────────
   Piste 34 × 19, pastille 15 — exactement la spec « Interactions ».
   `start-`/`end-` plutôt que `left-`/`right-` : le miroir RTL est gratuit. */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cx(
        "relative h-[19px] w-[34px] flex-none rounded-[10px] transition-colors disabled:opacity-50",
        checked ? "bg-[var(--color-brand)]" : "bg-[var(--color-track)]",
      )}
    >
      <span
        className={cx(
          "absolute top-[2px] h-[15px] w-[15px] rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-150",
          checked ? "start-[17px]" : "start-[2px]",
        )}
      />
    </button>
  );
}

/* ─── Emplacement d'image ────────────────────────────────────────────────
   Zone hachurée du handoff. Reste visible quand une vraie photo manque —
   c'est plus honnête qu'un carré vide, et ça signale ce qu'il faut fournir. */

export function Placeholder({
  label,
  className,
  rounded = "none",
  style,
}: {
  label?: string;
  className?: string;
  rounded?: "none" | "thumb" | "tile" | "card" | "full";
  style?: React.CSSProperties;
}) {
  const radii = {
    none: "",
    thumb: "rounded-[14px]",
    tile: "rounded-[16px]",
    card: "rounded-[18px]",
    full: "rounded-full",
  } as const;

  return (
    <div
      className={cx(
        "ph-stripe flex items-center justify-center font-mono text-[10px] text-[var(--color-faint)]",
        radii[rounded],
        className,
      )}
      style={style}
      aria-hidden
    >
      {label}
    </div>
  );
}

/** Avatar : photo si elle existe, monogramme sinon. */
export function Avatar({
  src,
  initials,
  size = 32,
  hue,
  className,
}: {
  src?: string | null;
  initials: string;
  size?: number;
  hue?: number;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars de taille fixe, déjà dimensionnés au stockage
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={cx("flex-none rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const tinted = hue !== undefined;

  return (
    <span
      className={cx(
        "flex flex-none items-center justify-center rounded-full font-bold",
        tinted ? "cat-surface cat-ink" : "bg-[var(--color-brand)] text-white",
        className,
      )}
      style={
        {
          width: size,
          height: size,
          fontSize: Math.max(7, size * 0.34),
          ...(tinted ? { "--hue": hue } : {}),
        } as React.CSSProperties
      }
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Pastille compteur sur une icône de la barre supérieure. */
export function CountBadge({ count, tone = "live" }: { count: number; tone?: "live" | "brand" }) {
  if (count <= 0) return null;
  return (
    <span
      className={cx(
        "absolute -top-[3px] -end-[5px] flex h-[14px] min-w-[14px] items-center justify-center rounded-[7px] px-[3px] text-[8px] font-bold text-white",
        tone === "live" ? "bg-[var(--color-live)]" : "bg-[var(--color-brand)]",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Ligne clé-valeur des panneaux de réglages. */
export function KeyValueRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center justify-between gap-[10px] text-[11.5px]", className)}>
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px bg-[var(--color-hairline)]", className)} />;
}

/** Rangée défilante horizontalement, barre masquée. */
export function Rail({
  children,
  className,
  gap = 10,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <div className={cx("no-sb flex overflow-x-auto", className)} style={{ gap }}>
      {children}
    </div>
  );
}

/** État vide : jamais une page blanche, toujours une porte de sortie. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    // `lg:col-span-full` : plusieurs listes deviennent des grilles à deux
    // colonnes sur ordinateur. Un état vide coincé dans une demi-largeur
    // paraîtrait décentré. Sans effet hors grille.
    <div className="flex flex-col items-center gap-3 px-8 py-14 text-center lg:col-span-full">
      <div className="cat-surface flex h-12 w-12 items-center justify-center rounded-[16px] text-[18px] font-semibold text-[var(--color-brand)]" style={{ "--hue": 300 } as React.CSSProperties}>
        ·
      </div>
      <p className="text-[13px] font-bold text-[var(--color-ink)]">{title}</p>
      {body && <p className="max-w-[36ch] text-[11.5px] leading-relaxed text-[var(--color-muted)]">{body}</p>}
      {action}
    </div>
  );
}

/** Bouton flottant, bas de page, au-dessus de la barre d'onglets. */
export function Fab({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  // 84 px : au-dessus de la barre d'onglets. Sur ordinateur elle disparaît,
  // le bouton peut redescendre.
  const className =
    "fixed bottom-[84px] end-[18px] z-30 inline-flex items-center gap-1 rounded-[24px] bg-[var(--color-brand)] px-[18px] py-3 text-[12px] font-bold text-white shadow-[var(--shadow-fab)] lg:bottom-8 lg:end-8";

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
