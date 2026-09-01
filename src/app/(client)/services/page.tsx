import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatTime, tunisDateISO } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { ChevronRightIcon, SearchIcon } from "@/components/ui/icons";
import { PharmaciesMap } from "@/components/services/pharmacies-map";

export const metadata: Metadata = {
  title: "Services citoyens de Gafsa",
  description:
    "Horaires de prière, pharmacie de garde, infos municipales, démarches administratives et alertes locales pour Gafsa.",
  alternates: { canonical: "/services" },
};

export const revalidate = 900;

/** Prochaine prière à partir de l'heure locale de Tunis. */
function nextPrayer(
  times: { fajr: string; dhuhr: string; asr: string; maghrib: string; isha: string } | null,
  labels: Record<"fajr" | "dhuhr" | "asr" | "maghrib" | "isha", string>,
) {
  if (!times) return null;

  const now = new Date().toLocaleTimeString("fr-FR", {
    hour12: false,
    timeZone: "Africa/Tunis",
    hour: "2-digit",
    minute: "2-digit",
  });

  const schedule = [
    ["fajr", times.fajr],
    ["dhuhr", times.dhuhr],
    ["asr", times.asr],
    ["maghrib", times.maghrib],
    ["isha", times.isha],
  ] as const;

  const upcoming = schedule.find(([, time]) => time.slice(0, 5) > now);
  const [key, time] = upcoming ?? schedule[0]; // après Isha : Fajr de demain

  return { label: labels[key], time: formatTime(time) };
}

export default async function ServicesPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  // Le jour à Gafsa, pas celui d'UTC : c'est par ce fuseau que la prière et la
  // pharmacie de garde sont enregistrées. {@link tunisDateISO}
  const today = tunisDateISO();

  const [prayer, pharmacy, infos, alerts] = await Promise.all([
    supabase.from("prayer_times").select("*").eq("on_date", today).maybeSingle(),
    supabase
      .from("pharmacies_on_duty")
      .select("*")
      .eq("on_date", today)
      .order("name")
      .limit(6),
    supabase.from("city_infos").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("city_alerts")
      .select("*")
      .eq("is_active", true)
      .lte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(3),
  ]);

  const prayerNow = nextPrayer(prayer.data, t.services.prayers);
  const municipal = (infos.data ?? []).filter((i) => i.kind !== "admin_procedure");
  const procedures = (infos.data ?? []).filter((i) => i.kind === "admin_procedure");
  const pharmacies = pharmacy.data ?? [];

  return (
    <>
      <TopBar
        title={t.services.title}
        action={
          <Link href="/marketplace" aria-label={t.common.search} className="-m-2 p-2 text-[var(--color-ink)]">
            <SearchIcon />
          </Link>
        }
      />

      <div className="no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-[14px] pb-4 lg:grid lg:grid-cols-2 lg:content-start">
        {/* ─── Aujourd'hui à Gafsa ────────────────────────────────────── */}
        <Card className="flex flex-none flex-col gap-[9px] p-3 lg:col-span-full">
          <div className="flex items-baseline justify-between">
            <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">{t.services.todayIn}</p>
            <p className="text-[0.65625rem] text-[var(--color-muted)]">
              {formatDate(new Date().toISOString(), locale)}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div
              id="prayer"
              className="flex-1 rounded-[14px] bg-[var(--color-brand-tint)] p-2 text-center"
            >
              <p className="text-[0.59375rem] text-[var(--color-muted)]">{t.services.nextPrayer}</p>
              <p className="text-[0.75rem] font-bold text-[var(--color-brand)]">
                {prayerNow ? `${prayerNow.label} · ${prayerNow.time}` : "—"}
              </p>
            </div>

            {pharmacies.length > 0 && (
              <div id="pharmacy" className="flex flex-col gap-2">
                <p className="px-1 text-[0.59375rem] font-bold text-[var(--color-brand)]">
                  {t.services.pharmacyOnDuty}
                </p>

                {/*
                  Les pharmacies de garde du jour, jusqu'à trois d'entre elles,
                  et leur emplacement sur la carte. Chacune donne l'adresse, le
                  téléphone et un itinéraire — on s'y rend, on ne les appelle
                  pas pour qu'elles viennent.
                */}
                {pharmacies.map((p) => (
                  <div key={p.id} className="rounded-[14px] bg-[var(--color-brand-tint)] p-2">
                    <p className="truncate text-[0.75rem] font-bold text-[var(--color-ink)]">{p.name}</p>
                    <div className="mt-[2px] flex flex-col gap-[1px]">
                      {p.address && (
                        <p className="truncate text-[0.625rem] text-[var(--color-muted)]">{p.address}</p>
                      )}
                      {p.phone && (
                        <a
                          href={`tel:${p.phone.replace(/\s+/g, "")}`}
                          className="truncate text-[0.625rem] font-semibold text-[var(--color-brand)]"
                        >
                          {p.phone}
                        </a>
                      )}
                    </div>
                    {p.latitude !== null && p.longitude !== null && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
                        className="mt-[6px] inline-flex items-center gap-1 rounded-[9px] bg-[var(--color-brand-fill)] px-2 py-[3px] text-[0.59375rem] font-bold text-white"
                      >
                        {t.services.directions}
                      </a>
                    )}
                  </div>
                ))}

                {pharmacies.some((p) => p.latitude !== null && p.longitude !== null) && (
                  <>
                    <p className="px-1 pt-1 text-[0.59375rem] font-bold text-[var(--color-brand)]">
                      {t.services.pharmaciesTonight}
                    </p>
                    <PharmaciesMap pharmacies={pharmacies} />
                  </>
                )}
              </div>
            )}
          </div>
        </Card>

        {/*
          ─── Taxi ─────────────────────────────────────────────────────

          Placé avant les infos municipales : chercher un taxi est un besoin
          immédiat, consulter un avis de travaux ne l'est pas.
        */}
        <Link href="/taxi" className="lg:col-span-full">
          <Card className="flex items-center gap-[10px] p-3">
            <span className="cat-surface cat-ink flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[0.875rem] font-semibold">
              T
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
                {t.taxi.title}
              </p>
              <p className="truncate text-[0.625rem] text-[var(--color-muted)]">{t.taxi.noneFree}</p>
            </div>
            <ChevronRightIcon size={13} className="text-[var(--color-faint)]" />
          </Card>
        </Link>

        {/*
          ─── Boutiques vérifiées ──────────────────────────────────────

          Chercher où aller est un besoin de service, pas de catalogue : on
          ouvre cet écran en sachant ce qu'on veut, pas en flânant.
        */}
        <Link href="/boutiques" className="lg:col-span-full">
          <Card className="flex items-center gap-[10px] p-3">
            <span className="cat-surface cat-ink flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[0.875rem] font-semibold">
              B
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
                {t.shops.title}
              </p>
              <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                {t.shops.onMap}
              </p>
            </div>
            <ChevronRightIcon size={13} className="text-[var(--color-faint)]" />
          </Card>
        </Link>

        {/*
          ─── SOS dépannage ────────────────────────────────────────────

          Juste après le taxi, pour la même raison : une panne se règle
          maintenant. La liste des métiers reste derrière le lien — l'annoncer
          ici transformerait l'écran Services en menu à rallonge.
        */}
        <Link href="/sos" className="lg:col-span-full">
          <Card className="flex items-center gap-[10px] p-3">
            <span className="cat-surface cat-ink flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[0.875rem] font-semibold">
              S
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
                {t.sos.title}
              </p>
              <p className="truncate text-[0.625rem] text-[var(--color-muted)]">{t.sos.tagline}</p>
            </div>
            <ChevronRightIcon size={13} className="text-[var(--color-faint)]" />
          </Card>
        </Link>

        {/* ─── Infos municipales ──────────────────────────────────────── */}
        {municipal.length > 0 && (
          <>
            <SectionTitle className="lg:col-span-full">{t.services.cityInfo}</SectionTitle>
            {municipal.map((info) => (
              <Card key={info.id} className="flex items-center gap-[10px] p-3">
                <span
                  className="cat-surface cat-ink flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[0.875rem] font-semibold tracking-[0.03125rem]"
                  style={{ "--hue": info.hue } as React.CSSProperties}
                >
                  {info.monogram}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.78125rem] font-semibold text-[var(--color-ink)]">
                    {locale === "ar" && info.title_ar ? info.title_ar : info.title}
                  </p>
                  {info.subtitle && (
                    <p className="text-[0.6875rem] text-[var(--color-muted)]">
                      {locale === "ar" && info.subtitle_ar ? info.subtitle_ar : info.subtitle}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </>
        )}

        {/* ─── Démarches administratives ──────────────────────────────── */}
        {procedures.length > 0 && (
          <>
            <SectionTitle className="mt-[6px] lg:col-span-full">{t.services.procedures}</SectionTitle>
            {procedures.map((info) => (
              <Link
                key={info.id}
                href={`/services/demarche/${info.id}`}
                className="flex items-center gap-[10px] rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
              >
                <span
                  className="cat-surface cat-ink flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[0.875rem] font-semibold tracking-[0.03125rem]"
                  style={{ "--hue": info.hue } as React.CSSProperties}
                >
                  {info.monogram}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.78125rem] font-semibold text-[var(--color-ink)]">
                    {locale === "ar" && info.title_ar ? info.title_ar : info.title}
                  </p>
                  {info.subtitle && (
                    <p className="truncate text-[0.6875rem] text-[var(--color-muted)]">
                      {locale === "ar" && info.subtitle_ar ? info.subtitle_ar : info.subtitle}
                    </p>
                  )}
                </div>
                <ChevronRightIcon size={14} className="flex-none text-[var(--color-faint)]" />
              </Link>
            ))}
          </>
        )}

        {/* ─── Alertes locales ────────────────────────────────────────── */}
        {(alerts.data ?? []).length > 0 && (
          <>
            <SectionTitle className="mt-[6px] lg:col-span-full">{t.services.alerts}</SectionTitle>
            {alerts.data!.map((alert) => (
              <div
                key={alert.id}
                role="status"
                className="flex items-center gap-[10px] rounded-[18px] border border-[rgba(122,31,43,0.15)] bg-[var(--color-brand-tint)] p-3"
              >
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[var(--color-live-fill)] text-[0.8125rem] font-bold text-white">
                  !
                </span>
                <p className="text-[0.75rem] text-[var(--color-ink)]">
                  {locale === "ar" && alert.title_ar ? alert.title_ar : alert.title}
                  {alert.body && ` — ${alert.body}`}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
