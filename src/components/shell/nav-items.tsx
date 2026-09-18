"use client";

import { useI18n } from "@/lib/i18n/provider";
import {
  BoxIcon,
  FlagIcon,
  GearIcon,
  GridIcon,
  HeartIcon,
  HomeIcon,
  LiveDot,
  SparkIcon,
  StoreIcon,
  UserIcon,
} from "@/components/ui/icons";

export type NavVariant = "client" | "vendor" | "admin";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Correspondance exacte : sinon « / » serait actif partout. */
  exact?: boolean;
};

/**
 * Onglets de navigation, source unique.
 *
 * Deux présentations les consomment — la barre du bas sur téléphone, la
 * colonne latérale sur ordinateur. Les définir une seule fois évite qu'un
 * onglet ajouté d'un côté manque de l'autre.
 */
export function useNavItems(variant: NavVariant): NavItem[] {
  const { t } = useI18n();

  const sets: Record<NavVariant, NavItem[]> = {
    client: [
      { href: "/accueil", label: t.nav.home, icon: <HomeIcon size={17} />, exact: true },
      { href: "/marketplace", label: t.nav.marketplace, icon: <GridIcon size={17} /> },
      { href: "/lives", label: t.nav.lives, icon: <LiveDot size={9} /> },
      { href: "/free-shop", label: t.nav.deals, icon: <HeartIcon size={17} /> },
      { href: "/services", label: t.nav.services, icon: <SparkIcon size={17} /> },
      { href: "/profil", label: t.nav.profile, icon: <UserIcon size={17} /> },
    ],
    vendor: [
      { href: "/vendeur", label: t.nav.dashboard, icon: <HomeIcon size={17} />, exact: true },
      { href: "/vendeur/produits", label: t.nav.products, icon: <GridIcon size={17} /> },
      { href: "/vendeur/commandes", label: t.nav.orders, icon: <BoxIcon size={17} /> },
      { href: "/vendeur/lives", label: t.nav.lives, icon: <LiveDot size={9} /> },
      { href: "/vendeur/reservations", label: "Réservations", icon: <BoxIcon size={17} /> },
      { href: "/vendeur/reglages", label: t.nav.settings, icon: <GearIcon size={17} /> },
    ],
    admin: [
      { href: "/admin", label: t.nav.dashboard, icon: <HomeIcon size={17} />, exact: true },
      { href: "/admin/boutiques", label: t.nav.shops, icon: <StoreIcon size={17} /> },
      { href: "/admin/membres", label: t.nav.members, icon: <UserIcon size={17} /> },
      { href: "/admin/signalements", label: t.nav.reports, icon: <FlagIcon size={17} /> },
      { href: "/admin/pharmacies", label: t.admin.pharmacies, icon: <SparkIcon size={17} /> },
      { href: "/admin/partenaires", label: "Partenaires", icon: <StoreIcon size={17} /> },
      { href: "/admin/free-shop", label: "Free Shop", icon: <HeartIcon size={17} /> },
      { href: "/admin/black-friday", label: "Black Friday", icon: <SparkIcon size={17} /> },
      { href: "/admin/reglages", label: t.nav.settings, icon: <GearIcon size={17} /> },
    ],
  };

  return sets[variant];
}

/** Un onglet est actif sur sa page, et sur ses sous-pages s'il n'est pas exact. */
export function isActive(pathname: string, item: NavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
