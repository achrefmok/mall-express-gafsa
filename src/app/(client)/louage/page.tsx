import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { numeroAppelable } from "@/lib/phone";
import { whatsAppHref } from "@/lib/contact";
import { TopBar } from "@/components/shell/top-bar";
import { getProfile } from "@/lib/queries";
import { DepartsLouage, MesPlaces, type DepartLouage } from "./departs-client";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.louage.title, description: t.louage.metaDescription };
}

/*
  Plus de cache de cinq minutes.

  La liste des stations changeait une fois par mois ; les places restantes
  changent à la minute. Servir « 3 places » depuis un cache quand il n'en
  reste plus est pire que de ne rien annoncer — le voyageur se déplace.
*/
export const dynamic = "force-dynamic";

/**
 * Les louages, en accès direct.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi cette page existe
 * ────────────────────────────────────────────────────────────────────────
 *
 * La pastille « Louage » de l'accueil menait à `/services#louage`. Or la page
 * des services **n'affichait pas** les louages — seulement les prières, les
 * pharmacies et les démarches. Le raccourci atterrissait donc en haut d'une
 * page qui ne contenait pas ce qu'on cherchait, sans ancre à rejoindre.
 *
 * Un clic, et l’on voit les louages et leurs numéros.
 *
 * Depuis, la page porte aussi les départs annoncés : les stations disent où
 * aller, les départs disent quand et s’il reste de la place. Les deux listes
 * cohabitent — tant que peu de chauffeurs annoncent, le numéro de station
 * reste le seul recours, et la retirer viderait la page.
 */
export default async function PageLouage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const profile = await getProfile();

  const [stations, departs, mesPlaces] = await Promise.all([
    supabase
      .from("practical_services")
      .select("id, name, name_ar, phone, address, info")
      .eq("kind", "louage")
      .eq("is_active", true)
      .order("sort_order"),

    /* Les places restantes sont comptées en base : deux voyageurs doivent
       voir le même chiffre. */
    supabase.rpc("louage_a_venir"),

    profile
      ? supabase
          .from("louage_seats")
          .select(
            "id, seats, depart:louage_departures!louage_seats_departure_id_fkey(destination, departs_at, driver_name, phone)",
          )
          .eq("user_id", profile.id)
          .eq("status", "reservee")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const louages = stations.data ?? [];

  return (
    <>
      <TopBar title={t.louage.title} back="/accueil" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        <p className="text-[0.8125rem] leading-[1.5] text-[var(--color-muted)]">{t.louage.intro}</p>

        <DepartsLouage
          departs={(departs.data ?? []) as unknown as DepartLouage[]}
          connecte={Boolean(profile)}
          defauts={{
            nom: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
            phone: profile?.phone ?? "",
          }}
          locale={locale}
        />

        <MesPlaces
          places={(mesPlaces.data ?? []) as unknown as Parameters<typeof MesPlaces>[0]["places"]}
          locale={locale}
        />

        {/*
          Les stations restent, sous les départs.

          Un départ annoncé vaut mieux qu'un numéro de station — mais tant que
          les chauffeurs n'annoncent rien, le numéro est tout ce qu'il y a. Le
          jour où la liste du haut sera pleine, celle du bas deviendra un
          recours ; la retirer aujourd'hui viderait la page.
        */}
        <p className="mt-2 text-[0.8125rem] font-bold text-[var(--color-ink)]">Stations et numéros</p>

        {louages.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-[var(--color-outline)] p-5 text-center text-[0.8125rem] text-[var(--color-muted)]">
            {t.louage.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {louages.map((l) => {
              const nom = locale === "ar" && l.name_ar ? l.name_ar : l.name;
              const wa = whatsAppHref(l.phone, format(t.louage.whatsappMessage, { name: nom }));

              return (
                <li
                  key={l.id}
                  className="flex flex-col gap-3 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[1.125rem]">
                      🚐
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{nom}</p>
                      {l.info && <p className="mt-[2px] text-[0.75rem] text-[var(--color-muted)]">{l.info}</p>}
                      {l.address && <p className="mt-[2px] text-[0.6875rem] text-[var(--color-faint)]">{l.address}</p>}
                    </div>
                  </div>

                  {l.phone && (
                    <div className="flex gap-2">
                      <a
                        href={`tel:${numeroAppelable(l.phone)}`}
                        className="press flex min-h-11 flex-1 items-center justify-center rounded-[12px] bg-[var(--color-brand-fill)] text-[0.8125rem] font-bold text-white"
                      >
                        📞 {t.taxi.call}
                      </a>
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="press flex min-h-11 flex-1 items-center justify-center rounded-[12px] bg-[#e6f4ea] text-[0.8125rem] font-bold text-[#0f7a3d]"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
