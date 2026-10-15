import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/format";
import { CarteNotation } from "@/components/taxi/rating-card";
import type { TaxiRequestStatus } from "@/types/database";

export const metadata: Metadata = { title: "Mes courses" };
export const dynamic = "force-dynamic";

const STATUTS: Record<TaxiRequestStatus, { fr: string; ar: string; teinte: string }> = {
  en_attente: { fr: "En attente d’un chauffeur", ar: "في انتظار سائق", teinte: "#fbbf24" },
  acceptee: { fr: "Acceptée", ar: "مقبولة", teinte: "#5cbd8b" },
  driver_arriving: { fr: "Chauffeur en route", ar: "السائق في الطريق", teinte: "#5cbd8b" },
  picked_up: { fr: "À bord", ar: "على متن التاكسي", teinte: "#5cbd8b" },
  in_progress: { fr: "En course", ar: "في الطريق", teinte: "#5cbd8b" },
  completed: { fr: "Terminée", ar: "منتهية", teinte: "#a7adba" },
  refusee: { fr: "Refusée", ar: "مرفوضة", teinte: "#f87171" },
  expiree: { fr: "Expirée", ar: "منتهية الصلاحية", teinte: "#8b92a1" },
  annulee: { fr: "Annulée", ar: "ملغاة", teinte: "#8b92a1" },
};

/**
 * « Mes courses » — l'historique réel de la personne : ses demandes de taxi
 * (statut, trajet, prix convenu, avis), les courses qu'elle a assurées si
 * elle est chauffeur, et ses places de louage réservées. La carte de
 * notation existante propose d'évaluer la dernière course terminée.
 */
export default async function MesCourses() {
  const { locale } = await getT();
  const ar = locale === "ar";
  const profile = await getProfile();
  if (!profile) return null; // l'intergiciel renvoie déjà vers /connexion
  const supabase = await createClient();

  const [{ data: demandes }, { data: assurees }, { data: places }, { data: avis }] = await Promise.all([
    supabase
      .from("taxi_requests")
      .select("id, status, created_at, pickup_label, dest_label, destination_name, accepted_price, proposed_price, driver_id")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("taxi_requests")
      .select("id, status, created_at, pickup_label, dest_label, destination_name, accepted_price, proposed_price")
      .eq("driver_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("louage_seats")
      .select("id, seats, status, created_at, depart:louage_departures!louage_seats_departure_id_fkey(destination, departs_at, driver_name, phone, price_per_seat)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("taxi_driver_reviews").select("request_id").eq("client_id", profile.id),
  ]);

  const notees = new Set((avis ?? []).map((a) => a.request_id));
  const date = (iso: string) =>
    new Date(iso).toLocaleString(ar ? "ar-TN" : "fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const trajet = (r: { pickup_label: string | null; dest_label: string | null; destination_name: string | null }) =>
    [r.pickup_label, r.destination_name ?? r.dest_label].filter(Boolean).join(" → ") || (ar ? "رحلة تاكسي" : "Course de taxi");

  const Ligne = ({ r, avecAvis }: { r: NonNullable<typeof demandes>[number] | NonNullable<typeof assurees>[number]; avecAvis: boolean }) => {
    const s = STATUTS[r.status] ?? STATUTS.en_attente;
    const prix = r.accepted_price ?? r.proposed_price;
    return (
      <li className="flex items-start gap-3 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3">
        <span aria-hidden className="mt-[6px] h-[10px] w-[10px] flex-none rounded-full" style={{ background: s.teinte }} />
        <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <b className="truncate text-[0.875rem]">{trajet(r)}</b>
          <span className="text-[0.75rem] text-[var(--color-muted)]">
            {date(r.created_at)} · <span style={{ color: s.teinte }}>{ar ? s.ar : s.fr}</span>
          </span>
          {avecAvis && r.status === "completed" && "id" in r && (
            <span className="text-[0.6875rem] font-semibold text-[var(--color-muted)]">
              {notees.has(r.id) ? (ar ? "✓ تمّ التقييم" : "✓ Avis laissé") : ar ? "لم تُقيَّم بعد" : "Pas encore notée"}
            </span>
          )}
        </span>
        {prix != null && <b className="flex-none text-[0.875rem] text-[var(--color-brand)]">{formatPrice(prix, locale)}</b>}
      </li>
    );
  };

  const vide = (demandes ?? []).length === 0 && (assurees ?? []).length === 0 && (places ?? []).length === 0;

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-6">
      <h1 className="text-[1.5rem] font-black tracking-[-0.4px]">{ar ? "رحلاتي" : "Mes courses"}</h1>

      <CarteNotation />

      {vide && (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-[var(--color-outline)] p-6 text-center">
          <p className="text-[0.875rem] text-[var(--color-muted)]">
            {ar ? "لا رحلات بعد. اطلب أوّل تاكسي أو احجز مقعدك في اللواج." : "Aucune course pour l’instant. Commandez votre premier taxi ou réservez un louage."}
          </p>
          <div className="flex gap-2">
            <Link href="/taxi" className="rounded-[14px] bg-[var(--color-brand-fill)] px-4 py-2 text-[0.8125rem] font-extrabold text-white">
              {ar ? "اطلب تاكسي" : "Commander un taxi"}
            </Link>
            <Link href="/louage" className="rounded-[14px] border border-[var(--color-outline)] px-4 py-2 text-[0.8125rem] font-extrabold">
              {ar ? "اللواج" : "Louage"}
            </Link>
          </div>
        </div>
      )}

      {(demandes ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[1rem] font-extrabold">{ar ? "طلبات التاكسي" : "Mes demandes de taxi"}</h2>
          <ul className="flex flex-col gap-2">
            {(demandes ?? []).map((r) => (
              <Ligne key={r.id} r={r} avecAvis />
            ))}
          </ul>
        </section>
      )}

      {(assurees ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[1rem] font-extrabold">{ar ? "الرحلات التي قمت بها كسائق" : "Courses assurées comme chauffeur"}</h2>
          <ul className="flex flex-col gap-2">
            {(assurees ?? []).map((r) => (
              <Ligne key={r.id} r={r} avecAvis={false} />
            ))}
          </ul>
        </section>
      )}

      {(places ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[1rem] font-extrabold">{ar ? "مقاعدي في اللواج" : "Mes places de louage"}</h2>
          <ul className="flex flex-col gap-2">
            {(places ?? []).map((p) => {
              const d = p.depart;
              const annulee = p.status === "annulee";
              return (
                <li key={p.id} className="flex items-start gap-3 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3">
                  <span aria-hidden className="mt-[6px] h-[10px] w-[10px] flex-none rounded-full" style={{ background: annulee ? "#8b92a1" : "#5cbd8b" }} />
                  <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <b className="truncate text-[0.875rem]">{d?.destination ?? (ar ? "لواج" : "Louage")}</b>
                    <span className="text-[0.75rem] text-[var(--color-muted)]">
                      {d ? date(d.departs_at) : ""} · {ar ? `${p.seats} مقعد` : `${p.seats} place${p.seats > 1 ? "s" : ""}`} ·{" "}
                      {annulee ? (ar ? "ملغاة" : "Annulée") : ar ? "محجوزة" : "Réservée"}
                    </span>
                    {d?.driver_name && !annulee && (
                      <a href={`tel:${d.phone}`} className="text-[0.75rem] font-bold text-[var(--color-brand)]">
                        {d.driver_name} · {d.phone}
                      </a>
                    )}
                  </span>
                  {d?.price_per_seat != null && (
                    <b className="flex-none text-[0.875rem] text-[var(--color-brand)]">{formatPrice(d.price_per_seat * p.seats, locale)}</b>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
