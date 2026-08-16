"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { cx } from "@/lib/format";
import { spaceHref } from "@/lib/space";
import type { UserRole } from "@/types/database";

/**
 * Bascule entre les espaces d'un même compte.
 *
 * Un vendeur est aussi un client : il achète chez les voisins, suit des lives,
 * répond aux messages. Mais les deux espaces ont des barres d'onglets
 * disjointes — depuis `/vendeur`, rien ne ramenait à l'application. Ce bandeau
 * fin, présent des deux côtés, tient ce rôle.
 *
 * Invisible pour un client : il n'a qu'un seul espace.
 */
export function SpaceSwitcher({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const pathname = usePathname();

  if (role === "client") return null;

  const current = pathname.startsWith("/vendeur")
    ? "vendor"
    : pathname.startsWith("/admin")
      ? "admin"
      : "client";

  const spaces: Array<{ key: string; href: string; label: string }> = [
    { key: "client", href: spaceHref("/accueil"), label: t.account.clientSpace },
  ];

  if (role === "vendor" || role === "admin") {
    spaces.push({ key: "vendor", href: spaceHref("/vendeur"), label: t.vendor.myShop });
  }
  if (role === "admin") {
    spaces.push({ key: "admin", href: spaceHref("/admin"), label: t.account.adminSpace });
  }

  return (
    <nav
      aria-label={t.account.switchLabel}
      className="flex flex-none justify-center gap-1 border-b border-[var(--color-surface-edge)] bg-[var(--color-surface)] px-3 py-[5px]"
    >
      {spaces.map((space) => {
        const active = space.key === current;

        return (
          <Link
            key={space.key}
            href={space.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded-[10px] px-[10px] py-[4px] text-[10px] font-bold whitespace-nowrap",
              active
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-brand)]",
            )}
          >
            {space.label}
          </Link>
        );
      })}
    </nav>
  );
}
