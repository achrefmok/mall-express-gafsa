import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getCategories } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { fullName, monogram } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Avatar, Card } from "@/components/ui/primitives";
import { ChevronRightIcon, GearIcon } from "@/components/ui/icons";
import { InstallSheet } from "@/components/pwa/install-sheet";
import { BecomeVendorModal } from "@/components/profile/become-vendor-modal";
import { crossSpaceHref } from "@/lib/space";
import { InviteButton, SignOutButton } from "./profile-client";

export const metadata: Metadata = {
  title: "Mon compte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Paliers de fidélité. Le seuil courant pilote la barre de progression. */
const TIERS = [
  { key: "tierBronze", threshold: 0, next: 200 },
  { key: "tierSilver", threshold: 200, next: 500 },
  { key: "tierGold", threshold: 500, next: null },
] as const;

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/profil");

  /*
    L'inscription commerçant vit sur l'autre hébergement quand le site est
    découpé. Un lien relatif y menait à l'inscription client — celle que ce
    déploiement sert — et le visiteur y créait un second compte d'acheteur en
    croyant ouvrir une boutique.
  */
  const vendorSignUpUrl = crossSpaceHref("vendor", "/inscription");

  const { t } = await getT();
  const supabase = await createClient();

  const [orders, favorites, reviews, categories] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "delivered"),
    supabase.from("favorites").select("product_id", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    getCategories(),
  ]);

  const points = profile.loyalty_points;
  const tierIndex = Math.max(
    0,
    TIERS.findLastIndex((tier) => points >= tier.threshold),
  );
  const tier = TIERS[tierIndex];
  const nextTier = TIERS[tierIndex + 1] ?? null;

  const progress = tier.next
    ? Math.min(100, Math.round(((points - tier.threshold) / (tier.next - tier.threshold)) * 100))
    : 100;

  const rows = [
    { href: "/commandes", label: t.account.myOrders, monogram: "CM" },
    { href: "/profil/favoris", label: t.account.favoriteShops, monogram: "FV" },
    { href: "/messages", label: t.account.messages, monogram: "MS" },
    { href: "/profil/demarches", label: t.account.myProcedures, monogram: "SC" },
    // Seul point d'entrée vers la présentation depuis un téléphone : la barre
    // de bureau n'y est pas affichée.
    { href: "/", label: "Le projet, l'équipe, le contact", monogram: "PR" },
  ];

  return (
    <>
      <TopBar
        title={t.account.title}
        action={
          <Link href="/profil/reglages" aria-label={t.nav.settings} className="text-[var(--color-ink)]">
            <GearIcon />
          </Link>
        }
      />

      <div className="flex flex-none flex-col items-center gap-2 px-4 py-[18px]">
        <Avatar
          src={profile.avatar_url}
          initials={monogram(profile.first_name, profile.last_name)}
          size={74}
          tone="ink"
        />
        <p className="text-[1.125rem] font-semibold text-[var(--color-ink)]">{fullName(profile) || "—"}</p>
        <p className="text-[0.6875rem] text-[var(--color-muted)]">{profile.city ?? "Gafsa"}, Tunisie</p>

        <div className="mt-[6px] flex gap-6 text-[0.6875rem] text-[var(--color-muted)]">
          <span>
            <b className="text-[var(--color-ink)]">{orders.count ?? 0}</b> {t.account.purchases}
          </span>
          <span>
            <b className="text-[var(--color-ink)]">{favorites.count ?? 0}</b> {t.account.favorites}
          </span>
          <span>
            <b className="text-[var(--color-ink)]">{reviews.count ?? 0}</b> {t.account.reviewsCount}
          </span>
        </div>
      </div>

      <div className="col-reading no-sb flex flex-1 flex-col gap-2 overflow-y-auto px-4 pt-[6px] pb-[14px]">
        {/* ─── Carte de fidélité ──────────────────────────────────────── */}
        <div className="flex flex-none flex-col gap-2 rounded-[18px] bg-[image:var(--gradient-brand)] p-3 text-white">
          <div className="flex items-baseline justify-between">
            <p className="text-[0.71875rem] font-bold">{t.account.loyaltyCard}</p>
            <p className="text-[0.65625rem] opacity-80">{t.account[tier.key]}</p>
          </div>
          <div className="h-[5px] overflow-hidden rounded-[3px] bg-white/25">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[0.625rem] opacity-85">
            {nextTier
              ? format(t.account.pointsProgress, {
                  current: points,
                  target: tier.next ?? 0,
                  left: (tier.next ?? points) - points,
                  next: t.account[nextTier.key],
                })
              : format(t.account.pointsMax, { current: points })}
          </p>
        </div>

        {/* ─── Parrainage ─────────────────────────────────────────────── */}
        <Card className="flex flex-none items-center gap-[10px] p-3">
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.8125rem] font-bold text-[var(--color-brand)]">
            +2
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">{t.account.referTitle}</p>
            <p className="text-[0.65625rem] text-[var(--color-muted)]">{t.account.referBody}</p>
          </div>
          <InviteButton code={profile.referral_code ?? ""} />
        </Card>

        {/* ─── Raccourcis d'espace ────────────────────────────────────── */}
        {profile.role === "vendor" && (
          <Link
            href="/vendeur"
            className="flex items-center gap-[10px] rounded-[18px] bg-[var(--color-brand-fill)] p-3 text-white"
          >
            <span className="flex-1 text-[0.78125rem] font-bold">{t.account.vendorSpace}</span>
            <ChevronRightIcon size={14} />
          </Link>
        )}
        {profile.role === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-[10px] rounded-[18px] bg-[var(--color-ink)] p-3 text-[var(--color-app)]"
          >
            <span className="flex-1 text-[0.78125rem] font-bold">{t.account.adminSpace}</span>
            <ChevronRightIcon size={14} />
          </Link>
        )}
        {profile.role === "client" && (
          <BecomeVendorModal categories={categories} label={t.account.becomeVendor} />
        )}

        {/* ─── Lignes de navigation ───────────────────────────────────── */}
        {rows.map((row) => (
          <Link
            key={row.href}
            href={row.href}
            className="flex items-center gap-[10px] rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
          >
            <span className="w-6 flex-none text-[1rem] font-semibold tracking-[0.03125rem] text-[var(--color-brand)]">
              {row.monogram}
            </span>
            <span className="flex-1 text-[0.78125rem] font-semibold text-[var(--color-ink)]">{row.label}</span>
            <ChevronRightIcon size={14} className="text-[var(--color-faint)]" />
          </Link>
        ))}

        {/*
          Le panneau d'installation, et l'invitation aux commerçants avec lui.

          Il s'ouvre de lui-même à la première visite du profil : c'est l'écran
          où l'on s'installe dans l'application, pas celui où l'on cherche un
          produit.
        */}
        <InstallSheet vendorSignUpUrl={profile.role === "client" ? vendorSignUpUrl : null} />

        <SignOutButton />
      </div>
    </>
  );
}
