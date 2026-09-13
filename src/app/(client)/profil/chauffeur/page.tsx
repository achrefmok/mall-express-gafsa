import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { MotionProvider } from "@/components/ui/motion";
import { FormulaireChauffeur, BasculeStatut } from "./chauffeur-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.driver.spaceTitle, robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * L'espace du chauffeur, côté compte.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qui vit ici, et ce qui vit ailleurs
 * ────────────────────────────────────────────────────────────────────────
 *
 * `/taxi/chauffeur` existe déjà et fait le travail de route : demandes
 * reçues, clients autour, position GPS, conversations. Le recréer ici aurait
 * donné deux consoles à tenir synchrones.
 *
 * Cette page-ci est la **fiche** : qui il est, ce qu'il conduit, où il
 * travaille — ce qu'il remplit une fois et corrige de temps en temps. Elle
 * porte aussi la bascule de disponibilité, parce qu'on change de statut
 * depuis n'importe où, et un lien vers la console pour le reste.
 */
export default async function EspaceChauffeur() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/profil/chauffeur");

  const { t } = await getT();
  const supabase = await createClient();

  const [{ data: fiche }, { data: prive }, { data: publique }] = await Promise.all([
    supabase.from("taxi_drivers").select("*").eq("id", profile.id).maybeSingle(),
    supabase.from("taxi_driver_private").select("license_number").eq("id", profile.id).maybeSingle(),
    supabase.rpc("taxi_profil_public", { p_chauffeur: profile.id }),
  ]);

  // L'espace chauffeur s'ouvre depuis l'administration, jamais en devinant l'adresse.
  if (!fiche) redirect("/profil");

  /*
    La complétude, pour dire au chauffeur ce qui manque.

    Une fiche vide ne se trouve pas : un client qui hésite entre deux
    chauffeurs choisit celui dont il voit la voiture et la photo.
  */
  const champs = [
    fiche.photo_url,
    fiche.bio,
    fiche.vehicle_brand,
    fiche.vehicle_model,
    fiche.vehicle_color,
    fiche.plate,
    fiche.service_zones?.length ? "ok" : null,
    fiche.languages?.length ? "ok" : null,
  ];
  const complete = Math.round((champs.filter(Boolean).length / champs.length) * 100);

  return (
    <>
      <TopBar title={t.driver.spaceTitle} back="/profil" />

      <MotionProvider>
        <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
          {!fiche.is_approved && (
            <p className="rounded-[16px] bg-[#fbeadb] p-4 text-[0.8125rem] text-[#9a4f0c]">
              {t.driver.pendingValidation}
            </p>
          )}

          <section className="flex flex-col gap-3 rounded-[20px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{t.driver.availability}</h2>
            <BasculeStatut initial={fiche.status} />
            <p className="text-[0.6875rem] text-[var(--color-muted)]">
              {t.driver.availabilityNote}
            </p>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <Chiffre valeur={String(publique?.courses_terminees ?? 0)} libelle={t.driver.rides} />
            <Chiffre valeur={`${complete}%`} libelle={t.driver.completion} />
            <Chiffre valeur={fiche.is_approved ? t.driver.validated : t.driver.waiting} libelle={t.driver.account} />
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/taxi/chauffeur"
              className="press flex min-h-12 items-center justify-center rounded-[14px] bg-[var(--color-brand-fill)] text-[0.8125rem] font-bold text-white"
            >
              {t.driver.console}
            </Link>
            {fiche.is_approved ? (
              <Link
                href={`/chauffeurs/${fiche.id}`}
                className="press flex min-h-12 items-center justify-center rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] text-[0.8125rem] font-bold text-[var(--color-ink)]"
              >
                {t.driver.seePublic}
              </Link>
            ) : (
              <span className="flex min-h-12 items-center justify-center rounded-[14px] bg-[var(--color-field)] text-center text-[0.75rem] text-[var(--color-faint)]">
                {t.driver.publicAfter}
              </span>
            )}
          </div>

          <FormulaireChauffeur
            initial={{
              displayName: fiche.display_name,
              phone: fiche.phone,
              photoUrl: fiche.photo_url ?? null,
              bio: fiche.bio ?? null,
              vehicleBrand: fiche.vehicle_brand ?? null,
              vehicleModel: fiche.vehicle_model ?? null,
              vehicleColor: fiche.vehicle_color ?? null,
              vehicleYear: fiche.vehicle_year ?? null,
              plate: fiche.plate,
              serviceZones: fiche.service_zones ?? [],
              languages: fiche.languages ?? [],
              experienceYears: fiche.experience_years ?? null,
              licenseNumber: prive?.license_number ?? null,
              showPhone: fiche.show_phone ?? true,
            }}
          />
        </div>
      </MotionProvider>
    </>
  );
}

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="flex flex-col items-center gap-[2px] rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-3">
      <span className="text-[1rem] font-extrabold tabular-nums text-[var(--color-ink)]">{valeur}</span>
      <span className="text-center text-[0.59375rem] font-semibold text-[var(--color-muted)]">{libelle}</span>
    </div>
  );
}
