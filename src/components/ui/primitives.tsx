import Link from "next/link";
import Image from "next/image";
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
    <h2 className={cx("text-[0.6875rem] font-bold tracking-[0.0125rem] text-[var(--color-ink)]", className)}>
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
  imageUrl,
  caption,
  radius,
}: {
  hue: number;
  monogram: string;
  label: string;
  /** Sert à choisir le dessin ; sans lui, la tuile garde son monogramme. */
  slug?: string;
  size?: number;
  href?: string;
  /**
   * Photo de la catégorie, quand l'administration en a téléversé une.
   *
   * Trois niveaux, du plus parlant au plus sûr : la photo, puis le dessin, puis
   * les deux lettres. Une catégorie créée ce matin depuis l'administration
   * s'affiche donc correctement avant même qu'on lui ait choisi une image.
   */
  imageUrl?: string | null;
  /** Seconde ligne : « 12 boutiques ». Absente si on ne sait pas compter. */
  caption?: string;
  /** Rayon du cadre. Par défaut proportionné à la taille. */
  radius?: number;
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
        className={cx(
          "flex flex-none items-center justify-center overflow-hidden font-semibold tracking-[0.03125rem]",
          imageUrl
            ? "bg-[var(--color-track)] shadow-[0_8px_18px_rgba(60,40,90,0.10)]"
            : "cat-surface cat-ring cat-ink",
        )}
        style={
          {
            "--hue": hue,
            width: size,
            height: size,
            borderRadius: radius ?? Math.round(size / 3),
            fontSize: size * 0.354,
          } as React.CSSProperties
        }
        aria-hidden
      >
        {imageUrl ? (
          /*
            Passée par l'optimiseur plutôt que servie telle quelle.

            Le fichier source fait quatre cent quatre-vingts pixels de côté —
            deux fois la plus grande taille d'affichage — alors que la tuile en
            occupe soixante-six. Sans optimisation, chaque visiteur téléchargeait
            l'original pour une vignette sept fois plus petite. Next sert ici une
            variante à la bonne taille, en AVIF ou WebP selon le navigateur ; le
            format du fichier d'origine n'a plus d'importance.
          */
          <Image
            src={imageUrl}
            alt=""
            width={size}
            height={size}
            className="fade-in-img h-full w-full object-cover"
          />
        ) : Icon ? (
          <Icon size={Math.round(size * 0.46)} />
        ) : (
          monogram
        )}
      </span>

      <span className="flex flex-col items-center gap-[1px] text-center">
        <span className="text-[0.65625rem] leading-tight font-bold text-[var(--color-ink)]">
          {label}
        </span>
        {caption && (
          <span className="text-[0.53125rem] leading-tight font-semibold whitespace-nowrap text-[var(--color-faint)]">
            {caption}
          </span>
        )}
      </span>
    </>
  );

  const className = "flex flex-col items-center gap-[7px]";

  return href ? (
    <Link href={href} className={cx(className, "press")}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/* ─── Chips ───────────────────────────────────────────────────────────── */

export type ChipTone = "brand" | "tinted" | "outline" | "category" | "live" | "surface";

export function Chip({
  tone = "outline",
  size = "sm",
  hue,
  active,
  className,
  children,
  ...rest
}: {
  tone?: ChipTone;
  /**
   * `md` — le filtre principal d'un écran, posé sous un grand titre : il doit
   * se viser au pouce et supporter le poids de la page.
   * `sm` — les filtres secondaires, dans une carte ou sous un onglet.
   */
  size?: "sm" | "md";
  hue?: number;
  active?: boolean;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "size">) {
  const base = cx(
    "press flex-none whitespace-nowrap font-semibold transition-colors",
    size === "md"
      ? "rounded-[20px] px-[18px] py-[10px] text-[0.71875rem]"
      : "rounded-[14px] px-[13px] py-[6px] text-[0.65625rem]",
  );

  const tones: Record<ChipTone, string> = {
    brand: "bg-[var(--color-brand-fill)] text-white shadow-[0_8px_18px_rgba(109,75,143,0.26)]",
    tinted: "bg-[var(--color-brand-tint)] text-[var(--color-brand)]",
    outline: "border border-[var(--color-outline)] text-[var(--color-muted)]",
    // Pastille posée sur le fond, sans contour : c'est l'ombre qui la détache.
    surface:
      "bg-[var(--color-surface-solid)] text-[var(--color-ink)] shadow-[0_6px_16px_rgba(60,40,90,0.07)]",
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
    brand: "bg-[var(--color-brand-fill)] text-white",
    tinted: "bg-[var(--color-brand-tint)] text-[var(--color-brand)]",
    outline: "border border-[var(--color-outline)] text-[var(--color-muted)]",
    surface:
      "bg-[var(--color-surface-solid)] text-[var(--color-ink)] shadow-[0_6px_16px_rgba(60,40,90,0.07)]",
    category: "cat-surface cat-ink",
    live: "bg-[var(--color-live-fill)] text-white",
  };

  return (
    <span
      className={cx(
        "inline-flex flex-none items-center whitespace-nowrap rounded-[11px] px-2 py-1 text-[0.59375rem] font-bold",
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
  primary: "bg-[var(--color-brand-fill)] text-white active:bg-[var(--color-brand-strong)]",
  outline: "border-[1.5px] border-[var(--color-brand)] text-[var(--color-brand)]",
  ghost: "text-[var(--color-brand)]",
  danger: "bg-[var(--color-live-fill)] text-white",
  white: "bg-white text-[var(--color-on-light)]",
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
        /*
          `press` porte l'enfoncement à l'appui. Posé sur la primitive plutôt que
          sur chaque appelant : c'est le seul moyen que tous les boutons du
          projet réagissent de la même façon, y compris ceux écrits demain.

          `disabled:active:transform-none` annule l'enfoncement sur un bouton
          désactivé — sans cela, il répondrait au doigt tout en n'agissant pas,
          ce qui est exactement le signal inverse de celui qu'il doit donner.
        */
        "press inline-flex items-center justify-center rounded-[16px] font-semibold transition-[opacity,background-color]",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:active:transform-none",
        size === "sm" ? "px-3 py-[7px] text-[0.65625rem]" : "px-4 py-3 text-[0.8125rem]",
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
        // `press` comme sur `Button` : deux commandes identiques à l'œil
        // doivent répondre au doigt de la même façon. Sans lui, un lien-bouton
        // restait inerte à l'appui juste à côté d'un bouton qui s'enfonçait.
        "press inline-flex items-center justify-center rounded-[16px] text-center font-semibold",
        size === "sm" ? "px-3 py-[7px] text-[0.65625rem]" : "px-4 py-3 text-[0.8125rem]",
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

/* ─── Champs de formulaire ───────────────────────────────────────────────
   Le système couvrait les cartes, les boutons, les puces et les états vides,
   mais s'arrêtait aux portes des formulaires : quatre-vingt-seize champs
   écrits à la main, et la même chaîne de classes recopiée dans douze fichiers
   avec onze variantes légèrement différentes.

   Trois tailles suffisent à décrire ce qui existait vraiment :
     · `md` — formulaires client et vendeur, cible confortable au doigt ;
     · `sm` — panneaux d'administration, plus denses ;
     · `xs` — tableaux d'administration, une ligne par enregistrement.

   `invalid` porte l'état d'erreur : sans lui, chaque écran l'inventait, ou
   l'oubliait. */

export type FieldSize = "xs" | "sm" | "md";

const FIELD_SIZES: Record<FieldSize, string> = {
  xs: "rounded-[10px] px-2 py-[7px] text-[0.6875rem]",
  sm: "rounded-[12px] px-3 py-2 text-[0.75rem]",
  md: "rounded-[14px] px-3 py-[10px] text-[0.75rem]",
};

export interface FieldStyle {
  size?: FieldSize;
  /** Fond blanc opaque plutôt que translucide : formulaires posés sur une carte. */
  solid?: boolean;
  /** Le poids fort des écrans d'authentification. */
  strong?: boolean;
  invalid?: boolean;
  className?: string;
}

/**
 * Les classes d'un champ, pour les écrans qui composent leur propre balise —
 * un `<input type="file">` déguisé, un champ de date natif.
 * Préférer `Input`, `Textarea` ou `Select` partout ailleurs.
 *
 * Les variantes sont des options, jamais des classes ajoutées après coup : deux
 * utilitaires qui règlent la même propriété — `bg-white` après `bg-[var(--color-field)]` —
 * ne se départagent pas par leur ordre dans l'attribut mais par leur ordre dans
 * la feuille de style. Une surcharge « qui marche » aujourd'hui peut s'inverser
 * à la compilation suivante.
 */
export function fieldClass({ size = "md", solid, strong, invalid, className }: FieldStyle = {}) {
  return cx(
    "w-full text-[var(--color-ink)] outline-none transition-colors",
    "placeholder:font-normal placeholder:text-[var(--color-faint)]",
    "disabled:cursor-not-allowed disabled:opacity-55",
    FIELD_SIZES[size],
    solid ? "bg-[var(--color-surface-solid)]" : "bg-[var(--color-field)]",
    strong && "font-semibold",
    invalid
      ? "border border-[var(--color-live)]"
      : "border border-[var(--color-outline)] focus:border-[var(--color-brand)]",
    className,
  );
}

export function Input({
  size,
  solid,
  strong,
  invalid,
  className,
  ...rest
}: FieldStyle & Omit<ComponentProps<"input">, "size" | "className">) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={fieldClass({ size, solid, strong, invalid, className })}
      {...rest}
    />
  );
}

export function Textarea({
  size,
  solid,
  strong,
  invalid,
  className,
  ...rest
}: FieldStyle & Omit<ComponentProps<"textarea">, "className">) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={fieldClass({ size, solid, strong, invalid, className: cx("resize-y", className) })}
      {...rest}
    />
  );
}

export function Select({
  size,
  solid,
  strong,
  invalid,
  className,
  children,
  ...rest
}: FieldStyle & Omit<ComponentProps<"select">, "size" | "className">) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={fieldClass({ size, solid, strong, invalid, className })}
      {...rest}
    >
      {children}
    </select>
  );
}

/**
 * Étiquette, champ, puis aide ou erreur.
 *
 * Le `<label>` enveloppe le champ plutôt que de le viser par `htmlFor` : aucun
 * identifiant à inventer, aucun risque d'en réutiliser un, et toute la zone —
 * étiquette comprise — donne le focus.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      <span className="text-[0.625rem] text-[var(--color-muted)]">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-[0.625rem] font-semibold text-[var(--color-live)]">
          {error}
        </span>
      ) : (
        hint && <span className="text-[0.5625rem] text-[var(--color-faint)]">{hint}</span>
      )}
    </label>
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
      /*
        La piste garde ses 34 × 19 px ; la zone tactile, elle, passe à 46 × 31.

        Dix-neuf pixels de haut, c'est sous le minimum de vingt-quatre, et cet
        interrupteur commande tous les réglages — client comme vendeur. Le
        rembourrage agrandit la cible, la marge négative reprend la place qu'il
        occupe : rien ne bouge à l'écran.
      */
      className="-m-[6px] flex-none p-[6px] disabled:opacity-50"
    >
      <span
        className={cx(
          "relative block h-[19px] w-[34px] rounded-[10px] transition-colors",
          checked ? "bg-[var(--color-brand-fill)]" : "bg-[var(--color-track)]",
        )}
      >
        <span
          className={cx(
            "absolute top-[2px] h-[15px] w-[15px] rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-150",
            checked ? "start-[17px]" : "start-[2px]",
          )}
        />
      </span>
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
        "ph-stripe flex items-center justify-center font-mono text-[0.625rem] text-[var(--color-faint)]",
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
  tone,
  className,
}: {
  src?: string | null;
  initials: string;
  size?: number;
  hue?: number;
  /**
   * `ink` : pastille foncée en clair, claire en sombre — le texte suit.
   *
   * Trois écrans imposaient jusqu'ici `className="bg-[var(--color-ink)]"`. Deux
   * classes réglant la même propriété ne se départagent pas par leur ordre dans
   * l'attribut : la primitive posait son fond de marque, l'appelant le sien, et
   * le gagnant dépendait de l'ordre de la feuille de style. En thème sombre,
   * l'encre devenue claire laissait du texte blanc sur fond blanc.
   */
  tone?: "ink";
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
        tinted
          ? "cat-surface cat-ink"
          : tone === "ink"
            ? // Encre en fond, fond d'application en texte : la paire s'inverse
              // d'elle-même en thème sombre. Trois écrans passaient jusqu'ici
              // `className="bg-[var(--color-ink)]"`, qui entrait en conflit avec
              // le fond de la primitive — et laissait du blanc sur blanc dès que
              // l'encre s'éclaircissait.
              "bg-[var(--color-ink)] text-[var(--color-app)]"
            : "bg-[var(--color-brand-fill)] text-white",
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
        "absolute -top-[3px] -end-[5px] flex h-[14px] min-w-[14px] items-center justify-center rounded-[7px] px-[3px] text-[0.5rem] font-bold text-white",
        tone === "live" ? "bg-[var(--color-live-fill)]" : "bg-[var(--color-brand-fill)]",
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
    <div className={cx("flex items-center justify-between gap-[10px] text-[0.71875rem]", className)}>
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
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  /**
   * Le dessin du vide, quand l'écran sait de quoi il parle.
   *
   * Tous les états vides portaient le même point générique — panier, favoris,
   * commandes, recherche sans résultat. Un dessin qui nomme la situation aide à
   * comprendre qu'il ne s'agit pas d'une panne, mais d'une liste qui attend
   * d'être remplie. Le point reste le repli : un écran sans dessin vaut mieux
   * qu'un dessin faux.
   */
  icon?: ReactNode;
}) {
  return (
    // `lg:col-span-full` : plusieurs listes deviennent des grilles à deux
    // colonnes sur ordinateur. Un état vide coincé dans une demi-largeur
    // paraîtrait décentré. Sans effet hors grille.
    <div className="flex flex-col items-center gap-3 px-8 py-14 text-center lg:col-span-full">
      <div
        className="cat-surface flex h-12 w-12 items-center justify-center rounded-[16px] text-[1.125rem] font-semibold text-[var(--color-brand)]"
        style={{ "--hue": 300 } as React.CSSProperties}
        aria-hidden
      >
        {icon ?? "·"}
      </div>
      <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">{title}</p>
      {body && <p className="max-w-[36ch] text-[0.71875rem] leading-relaxed text-[var(--color-muted)]">{body}</p>}
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
  // La hauteur de la barre d'onglets vient d'un jeton partagé : les deux
  // étaient réglés séparément en dur, et rien n'aurait signalé qu'ils s'étaient
  // désolidarisés — le bouton se serait posé sur la barre, sans erreur visible
  // au code.
  const className =
    "fixed bottom-[var(--nav-space)] end-[18px] z-30 inline-flex items-center gap-1 rounded-[24px] bg-[var(--color-brand-fill)] px-[18px] py-3 text-[0.75rem] font-bold text-white shadow-[var(--shadow-fab)] lg:end-8";

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
