"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cx } from "@/lib/format";
import { CountBadge } from "@/components/ui/primitives";
import { ArrowLeftIcon, BellIcon, CartIcon, MailIcon } from "@/components/ui/icons";

export interface TopBarCounts {
  messages: number;
  notifications: number;
  cart: number;
}

/**
 * Barre supérieure. Trois formes selon l'écran :
 *   — marque « Mall Express Gafsa » + icônes à compteur (accueil)
 *   — titre simple + icônes choisies
 *   — flèche retour + titre + action de droite (fiche produit, réglages)
 */
export function TopBar({
  title,
  brand,
  back,
  action,
  icons,
  counts,
  className,
}: {
  title?: string;
  /** Rend « Mall Express » + « Gafsa » en couleur de marque. */
  brand?: boolean;
  back?: string | (() => void);
  action?: ReactNode;
  icons?: Array<"messages" | "notifications" | "cart">;
  counts?: Partial<TopBarCounts>;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <header
      className={cx(
        "flex flex-none items-center justify-between gap-3 px-[18px] pt-4 pb-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {back &&
          (typeof back === "string" ? (
            <Link href={back} aria-label={t.common.back} className="-ms-1 p-1 text-[var(--color-ink)]">
              <ArrowLeftIcon size={18} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={back}
              aria-label={t.common.back}
              className="-ms-1 p-1 text-[var(--color-ink)]"
            >
              <ArrowLeftIcon size={18} />
            </button>
          ))}

        {brand ? (
          <p className="truncate text-[19px] font-bold tracking-[-0.2px] text-[var(--color-ink)]">
            {t.brand.first} <span className="text-[var(--color-brand)]">{t.brand.second}</span>
          </p>
        ) : (
          title && (
            <h1 className="truncate text-[17px] font-bold tracking-[-0.2px] text-[var(--color-ink)]">
              {title}
            </h1>
          )
        )}
      </div>

      <div className="flex flex-none items-center gap-4 text-[var(--color-ink)]">
        {icons?.includes("messages") && (
          <Link href="/messages" aria-label={t.account.messages} className="relative">
            <MailIcon />
            <CountBadge count={counts?.messages ?? 0} />
          </Link>
        )}
        {icons?.includes("notifications") && (
          <Link href="/notifications" aria-label="Notifications" className="relative">
            <BellIcon />
            <CountBadge count={counts?.notifications ?? 0} />
          </Link>
        )}
        {icons?.includes("cart") && (
          <Link href="/panier" aria-label={t.cart.title} className="relative">
            <CartIcon />
            <CountBadge count={counts?.cart ?? 0} tone="brand" />
          </Link>
        )}
        {action}
      </div>
    </header>
  );
}
