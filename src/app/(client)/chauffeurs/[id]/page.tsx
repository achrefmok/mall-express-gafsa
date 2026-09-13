import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { formatDate, monogram } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { numeroAppelable } from "@/lib/phone";
import { whatsAppHref } from "@/lib/contact";
import { nomZone } from "@/lib/taxi-zones";
import { TopBar } from "@/components/shell/top-bar";
import { BoutonPartage } from "@/components/black-friday/share-button";
import { lireChauffeur } from "./lire";

export const dynamic = "force-dynamic";

const STATUTS = {
  libre: { libelle: "statusFree", puce: "🟢", classe: "bg-[#dcefe5] text-[#1c6244]" },
  places: { libelle: "statusSeats", puce: "🟠", classe: "bg-[#fbeadb] text-[#9a4f0c]" },
  occupe: { libelle: "statusBusy", puce: "🟠", classe: "bg-[#fbeadb] text-[#9a4f0c]" },
  hors_ligne: { libelle: "statusOffline", puce: "⚫", classe: "bg-[var(--color-field)] text-[var(--color-muted)]" },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { t } = await getT();
  const c = await lireChauffeur(id);
  if (!c) return { title: t.driver.notFound };
  return {
    title: `${c.display_name} · Taxi`,
    description: c.bio ?? format(t.driver.metaDescription, { name: c.display_name }),
  };
}

/**
 * La fiche publique d'un chauffeur.
 *
 * Lue par `taxi_profil_public`, qui ne rend qu'un chauffeur approuvé et qui
 * retire le numéro quand il a choisi de ne pas l'afficher. Le nombre de
 * courses et la note sont calculés par la fonction — `taxi_requests` et les
 * avis ne sont pas lisibles ligne à ligne par le visiteur, et c'est très
 * bien ainsi.
 *
 * Tant que la migration des avis n'est pas collée, la fonction ne rend pas
 * la note : la fiche dit alors « Aucun avis pour le moment », ce qui est
 * exact.
 */
export default async function ProfilChauffeurPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getT();
  // Déjà lu par le layout : le cache de React rend cet appel gratuit.
  const c = await lireChauffeur(id);
  if (!c) notFound();

  const statut = STATUTS[c.status] ?? STATUTS.hors_ligne;
  const vehicule = [c.vehicle_brand, c.vehicle_model].filter(Boolean).join(" ") || c.vehicle;
  const wa = whatsAppHref(c.phone, t.driver.whatsappMessage);

  const nbAvis = c.nb_avis ?? 0;
  const avis = c.avis_recents ?? [];

  return (
    <>
      <TopBar title={t.driver.publicTitle} back="/taxi" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        <section className="flex flex-col items-center gap-3 rounded-[22px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-5 text-center shadow-[var(--shadow-card)]">
          <div className="relative h-24 w-24 overflow-hidden rounded-full bg-[var(--color-brand-tint)]">
            {c.photo_url ? (
              <Image src={c.photo_url} alt="" fill sizes="96px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[1.75rem] font-bold text-[var(--color-brand)]">
                {monogram(c.display_name)}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-[1.25rem] font-bold text-[var(--color-ink)]">{c.display_name}</h1>
            <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.71875rem] font-bold ${statut.classe}`}>
              <span aria-hidden>{statut.puce}</span>
              {t.driver[statut.libelle]}
            </span>
          </div>

          {/* La note, en tête : c'est la première chose qu'on regarde. */}
          {nbAvis > 0 && c.note_moyenne ? (
            <p className="flex items-baseline gap-2">
              <span className="text-[1.5rem] font-extrabold text-[var(--color-ink)]" dir="ltr">
                <span aria-hidden className="text-[#f5a623]">★ </span>
                {c.note_moyenne}
              </span>
              <span className="text-[0.8125rem] font-semibold text-[var(--color-muted)]">
                {format(t.reviews.count, { n: nbAvis })}
              </span>
            </p>
          ) : (
            <p className="text-[0.8125rem] text-[var(--color-muted)]">{t.reviews.none}</p>
          )}

          <dl className="grid w-full grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-[var(--color-field)] p-3">
              <dt className="text-[0.625rem] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">{t.driver.rides}</dt>
              <dd className="text-[1.125rem] font-extrabold tabular-nums text-[var(--color-ink)]">{c.courses_terminees}</dd>
            </div>
            <div className="rounded-[14px] bg-[var(--color-field)] p-3">
              <dt className="text-[0.625rem] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                {c.experience_years !== null ? t.driver.experienceLabel : t.driver.memberSince}
              </dt>
              <dd className="text-[1.125rem] font-extrabold text-[var(--color-ink)]">
                {c.experience_years !== null
                  ? format(t.driver.years, { n: c.experience_years })
                  : formatDate(c.membre_depuis, locale)}
              </dd>
            </div>
          </dl>

          {c.phone && (
            <div className="flex w-full gap-2">
              <a
                href={`tel:${numeroAppelable(c.phone)}`}
                className="press flex min-h-12 flex-1 items-center justify-center rounded-[14px] bg-[var(--color-brand-fill)] text-[0.875rem] font-bold text-white"
              >
                📞 {t.taxi.call}
              </a>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press flex min-h-12 flex-1 items-center justify-center rounded-[14px] bg-[#e6f4ea] text-[0.875rem] font-bold text-[#0f7a3d]"
                >
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </section>

        {c.bio && (
          <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
            <h2 className="mb-1 text-[0.75rem] font-bold text-[var(--color-muted)]">{t.driver.presentation}</h2>
            <p className="text-[0.8125rem] leading-[1.6] text-[var(--color-ink)]">{c.bio}</p>
          </section>
        )}

        <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
          <dl className="flex flex-col gap-3 text-[0.8125rem]">
            {vehicule && (
              <Ligne libelle={t.driver.vehicle}>
                {vehicule}
                {c.vehicle_color && ` · ${c.vehicle_color}`}
                {c.vehicle_year && ` · ${c.vehicle_year}`}
                {c.plate && <span className="ms-1 font-mono text-[var(--color-muted)]" dir="ltr">{c.plate}</span>}
              </Ligne>
            )}
            {c.seats_total !== null && (
              <Ligne libelle={t.driver.seats}>
                {format(t.driver.seatsValue, { free: c.seats_free ?? "—", total: c.seats_total })}
              </Ligne>
            )}
            {c.service_zones.length > 0 && (
              <Ligne libelle={t.driver.zones}>
                {c.service_zones.map((z) => nomZone(z, locale) ?? z).join(locale === "ar" ? "، " : ", ")}
              </Ligne>
            )}
            {c.languages.length > 0 && (
              <Ligne libelle={t.driver.languages}>
                {c.languages.map((l) => t.driver.languageNames[l] ?? l).join(locale === "ar" ? "، " : ", ")}
              </Ligne>
            )}
          </dl>
        </section>

        {avis.length > 0 && (
          <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
            <h2 className="mb-3 text-[0.75rem] font-bold text-[var(--color-muted)]">{t.reviews.recent}</h2>
            <ul className="flex flex-col gap-3">
              {avis.map((a, i) => (
                <li key={`${a.created_at}-${i}`} className="flex flex-col gap-1 border-b border-[var(--color-hairline)] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.8125rem] font-bold text-[var(--color-ink)]">
                      {a.prenom || t.reviews.anonymous}
                    </span>
                    <span className="text-[0.6875rem] text-[var(--color-faint)]">{formatDate(a.created_at, locale)}</span>
                  </div>
                  <span
                    className="text-[0.875rem] text-[#f5a623]"
                    dir="ltr"
                    role="img"
                    aria-label={format(t.reviews.starsAria, { n: a.note })}
                  >
                    {"★".repeat(a.note)}
                    <span className="text-[var(--color-faint)]">{"★".repeat(5 - a.note)}</span>
                  </span>
                  {a.commentaire && (
                    <p className="text-[0.8125rem] leading-[1.5] text-[var(--color-ink)]">{a.commentaire}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex justify-center">
          <BoutonPartage
            chemin={`/chauffeurs/${c.id}`}
            titre={format(t.driver.shareTitle, { name: c.display_name })}
            texte={format(t.driver.shareText, { name: c.display_name })}
            image={`/partage/chauffeur/${c.id}`}
          />
        </div>
      </div>
    </>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <dt className="text-[0.625rem] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">{libelle}</dt>
      <dd className="text-[var(--color-ink)]">{children}</dd>
    </div>
  );
}
