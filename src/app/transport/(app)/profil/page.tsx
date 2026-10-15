import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { signOut } from "@/app/actions/auth";
import { LanguageToggle } from "@/components/shell/language-toggle";
import { FormulaireProfilTransport } from "@/components/transport/formulaire-profil";

export const metadata: Metadata = { title: "Mon profil" };
export const dynamic = "force-dynamic";

/**
 * Le profil dans « Taxi & Louage Gafsa » : nom et téléphone (ce que voit le
 * chauffeur ou le conducteur de louage), langue, accès chauffeur, sortie.
 * Le même compte que G-Mall : ce qui change ici change aussi là-bas.
 */
export default async function ProfilTransport() {
  const { locale } = await getT();
  const ar = locale === "ar";
  const profile = await getProfile();
  if (!profile) return null;
  const user = await getSessionUser();
  const supabase = await createClient();
  const { data: chauffeur } = await supabase.from("taxi_drivers").select("id, is_approved").eq("id", profile.id).maybeSingle();

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-6">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[1.25rem] font-black text-[var(--color-brand)]">
          {(profile.first_name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[1.125rem]">{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || (ar ? "حسابي" : "Mon compte")}</b>
          <span className="truncate text-[0.78125rem] text-[var(--color-muted)]">{user?.email}</span>
        </span>
        <LanguageToggle />
      </div>

      <FormulaireProfilTransport prenom={profile.first_name ?? ""} nom={profile.last_name ?? ""} telephone={profile.phone ?? ""} />

      <Link
        href={chauffeur ? "/profil/chauffeur" : "/devenir-chauffeur"}
        className="press flex items-center gap-3 rounded-[18px] bg-[var(--color-surface-solid)] p-4"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-[0.9375rem]">
            {chauffeur ? (ar ? "فضاء السائق" : "Mon espace chauffeur") : ar ? "كن سائقا" : "Devenir chauffeur"}
          </b>
          <span className="text-[0.75rem] text-[var(--color-muted)]">
            {chauffeur
              ? chauffeur.is_approved
                ? ar
                  ? "استقبل الطلبات وحدّد مسارك"
                  : "Recevez des courses, déclarez votre trajet"
                : ar
                  ? "ملفّك في انتظار المصادقة"
                  : "Votre fiche attend la validation de l’administration"
              : ar
                ? "سجّل سيارتك واستقبل الطلبات"
                : "Inscrivez votre véhicule et recevez des courses"}
          </span>
        </span>
        <span aria-hidden className="text-[1.25rem] text-[var(--color-brand)] rtl:rotate-180">›</span>
      </Link>

      <form action={signOut}>
        <button type="submit" className="min-h-[48px] w-full rounded-[16px] border border-[var(--color-outline)] text-[0.875rem] font-extrabold text-[var(--color-live)]">
          {ar ? "تسجيل الخروج" : "Se déconnecter"}
        </button>
      </form>
    </div>
  );
}
