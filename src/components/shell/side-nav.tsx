"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { cx } from "@/lib/format";
import { isActive, useNavItems, type NavVariant } from "./nav-items";
import type { UserRole } from "@/types/database";

/**
 * Navigation latérale, à partir de `lg`. Contrepartie de `BottomNav`, qui
 * disparaît à la même largeur.
 *
 * Sur téléphone, six onglets doivent tenir dans 520 px : libellés de 9 px,
 * icônes empilées. Ici la place ne manque pas — libellés de 13,5 px, cibles
 * hautes, et les espaces d'un compte à plusieurs rôles listés bout à bout
 * au lieu d'être cachés derrière une bascule.
 */
export function SideNav({
  variant,
  role,
  hasShop = false,
}: {
  variant: NavVariant;
  role?: UserRole;
  /** Sans boutique, l'onglet ne mènerait qu'à un écran vide. */
  hasShop?: boolean;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = useNavItems(variant);

  // Un vendeur ou un administrateur circule entre plusieurs espaces. Sur
  // téléphone c'est le rôle de `SpaceSwitcher` ; ici, autant les montrer.
  const spaces: Array<{ href: string; label: string; variant: NavVariant }> = [
    { href: "/accueil", label: t.account.clientSpace, variant: "client" },
  ];
  if ((role === "vendor" || role === "admin") && hasShop) {
    spaces.push({ href: "/vendeur", label: t.vendor.myShop, variant: "vendor" });
  }
  if (role === "admin") {
    spaces.push({ href: "/admin", label: t.account.adminSpace, variant: "admin" });
  }

  return (
    <div className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:overflow-y-auto lg:border-e lg:border-[var(--color-hairline)] lg:px-5 lg:py-7">
      <Link href="/accueil" className="flex-none text-[18px] font-bold tracking-[-0.3px] text-[var(--color-ink)]">
        Mall Express <span className="text-[var(--color-brand)]">Gafsa</span>
      </Link>

      <nav aria-label={t.nav.home} className="flex flex-none flex-col gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex min-h-[42px] items-center gap-3 rounded-[14px] px-3 text-[13.5px] font-semibold transition-colors",
                active
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-brand-tint)] hover:text-[var(--color-brand)]",
              )}
            >
              <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {spaces.length > 1 && (
        <div className="flex flex-none flex-col gap-1 border-t border-[var(--color-hairline)] pt-5">
          <p className="px-3 pb-1 text-[10px] font-bold tracking-[1px] text-[var(--color-faint)] uppercase">
            {t.account.switchLabel}
          </p>
          {spaces.map((space) => (
            <Link
              key={space.href}
              href={space.href}
              aria-current={space.variant === variant ? "page" : undefined}
              className={cx(
                "flex min-h-[38px] items-center rounded-[14px] px-3 text-[12.5px] font-semibold transition-colors",
                space.variant === variant
                  ? "text-[var(--color-brand)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-brand)]",
              )}
            >
              {space.label}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-none flex-col gap-1 border-t border-[var(--color-hairline)] pt-5">
        <Link
          href="/"
          className="rounded-[14px] px-3 py-2 text-[12px] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-brand)]"
        >
          Le projet
        </Link>
        <Link
          href="/#contact"
          className="rounded-[14px] px-3 py-2 text-[12px] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-brand)]"
        >
          Contact
        </Link>
      </div>
    </div>
  );
}
