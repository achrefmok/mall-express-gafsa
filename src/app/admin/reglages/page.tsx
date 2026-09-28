import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatCount, fullName } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, Divider, KeyValueRow, SectionTitle } from "@/components/ui/primitives";
import { ChevronRightIcon } from "@/components/ui/icons";
import { SignOutButton } from "@/app/(client)/profil/profile-client";
import { LogoManager } from "@/components/admin/logo-manager";
import { PublicAccessManager } from "@/components/admin/public-access-manager";

export const metadata: Metadata = {
  title: "Réglages de la plateforme",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Écran d'entrée du pilotage : ce qui se gère, et l'état de la plateforme. */
export default async function AdminSettingsPage() {
  const [profile, { t }] = await Promise.all([getProfile(), getT()]);
  const supabase = await createClient();

  const [shops, pending, users, vendors, products, deals, lives, categories, sponsors, alerts, reports, unverifiedRelays, pendingDrivers, pendingProviders, brand, acces] =
    await Promise.all([
      supabase.from("shops").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("shops").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "vendor"),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("deals").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("lives").select("id", { count: "exact", head: true }).eq("status", "live"),
      supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("sponsored_slots")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("ends_at", new Date().toISOString()),
      supabase.from("city_alerts").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),

      /*
        Relais Facebook dont la propriété n'est pas prouvée : adresse collée à
        la main, `facebook_video_id` resté vide faute d'être passé par la page
        connectée. Compté ici pour que le contrôle se voie depuis le pilotage,
        au lieu d'attendre qu'on pense à aller le chercher.
      */
      supabase
        .from("lives")
        .select("id", { count: "exact", head: true })
        .eq("source", "facebook")
        .is("facebook_video_id", null),

      // Chauffeurs inscrits mais pas encore vérifiés : invisibles des clients
      // tant que personne ne les a contrôlés.
      supabase
        .from("taxi_drivers")
        .select("id", { count: "exact", head: true })
        .eq("is_approved", false),

      // Dépanneurs autorisés mais pas encore vérifiés : invisibles des clients
      // tant que personne n'a contrôlé identité et qualification.
      supabase
          .from("sos_providers")
          .select("id", { count: "exact", head: true })
          .eq("is_approved", false),
      supabase.from("app_brand").select("app_logo_url").eq("id", true).maybeSingle(),
      supabase.from("app_access").select("public_access").eq("id", true).maybeSingle(),
    ]);

  const links = [
    { href: "/admin/boutiques", label: t.admin.featureShop, value: `${shops.count ?? 0} approuvées` },
    { href: "/admin/activation", label: t.activation.adminTitle, value: "" },
    { href: "/admin/sponsors", label: t.admin.sponsoredSlots, value: format(t.admin.activeCount, { n: sponsors.count ?? 0 }) },
    { href: "/admin/categories", label: t.admin.manageCategories, value: format(t.admin.categoriesCount, { n: categories.count ?? 0 }) },
    { href: "/admin/membres", label: t.nav.members, value: formatCount(users.count ?? 0) },
    { href: "/admin/signalements", label: t.admin.reportsTitle, value: String(reports.count ?? 0) },
    {
      href: "/admin/relais",
      label: "Relais Facebook",
      value: `${unverifiedRelays.count ?? 0} à contrôler`,
    },
    {
      href: "/admin/taxi",
      label: "Chauffeurs de taxi",
      value: `${pendingDrivers.count ?? 0} à vérifier`,
    },
    {
      href: "/admin/sos",
      label: "SOS dépannage",
      value: `${pendingProviders.count ?? 0} à vérifier`,
    },
    {
      href: "/admin/pharmacies",
      label: t.admin.pharmacies,
      value: "Garde du jour",
    },
  ];

  const stats = [
    { label: "Boutiques en attente", value: pending.count ?? 0, alert: (pending.count ?? 0) > 0 },
    { label: "Vendeurs", value: vendors.count ?? 0, alert: false },
    { label: "Produits", value: products.count ?? 0, alert: false },
    { label: "Bons plans actifs", value: deals.count ?? 0, alert: false },
    { label: "Directs en cours", value: lives.count ?? 0, alert: false },
    { label: "Alertes ville actives", value: alerts.count ?? 0, alert: false },
  ];

  return (
    <>
      <TopBar title={t.nav.settings} back="/admin" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.admin.steering}</SectionTitle>
          <Card className="flex flex-col gap-[10px] p-3">
            {links.map((link, index) => (
              <div key={link.href}>
                {index > 0 && <Divider className="mb-[10px]" />}
                <Link href={link.href} className="flex items-center gap-2">
                  <span className="flex-1 text-[0.71875rem] text-[var(--color-ink)]">{link.label}</span>
                  <span className="text-[0.71875rem] font-bold text-[var(--color-brand)]">
                    {link.value}
                  </span>
                  <ChevronRightIcon size={13} className="text-[var(--color-faint)]" />
                </Link>
              </div>
            ))}
          </Card>
        </section>

        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>État de la plateforme</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-[11px]">
                <p
                  className={`text-[1.0625rem] font-bold ${
                    stat.alert ? "text-[var(--color-live)]" : "text-[var(--color-brand)]"
                  }`}
                >
                  {stat.value}
                </p>
                <p className="text-[0.5625rem] leading-[1.3] text-[var(--color-muted)]">{stat.label}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.preparation.settingsTitle}</SectionTitle>
          <PublicAccessManager current={acces.data?.public_access ?? false} />
        </section>

        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Identité</SectionTitle>
          <LogoManager current={brand.data?.app_logo_url ?? null} />
        </section>

        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Compte</SectionTitle>
          <Card className="flex flex-col gap-[10px] p-3">
            <KeyValueRow label={<span className="text-[var(--color-muted)]">Connecté en tant que</span>}>
              <span className="font-semibold">{fullName(profile) || "—"}</span>
            </KeyValueRow>
            <Divider />
            <KeyValueRow label={<span className="text-[var(--color-muted)]">Rôle</span>}>
              <span className="font-bold text-[var(--color-brand)]">Administration</span>
            </KeyValueRow>
            <Divider />
            <Link href="/profil/reglages" className="flex items-center gap-2">
              <span className="flex-1 text-[0.71875rem] text-[var(--color-ink)]">
                Réglages personnels
              </span>
              <ChevronRightIcon size={13} className="text-[var(--color-faint)]" />
            </Link>
          </Card>

          <SignOutButton />
        </section>
      </div>
    </>
  );
}
