import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/format";
import { serviceIcon } from "@/components/ui/category-icons";
import { BellIcon, BoxIcon, UserIcon } from "@/components/ui/icons";
import { LanguageToggle } from "@/components/shell/language-toggle";

export const dynamic = "force-dynamic";

const IconeTaxi = serviceIcon("taxi")!;
const IconeLouage = serviceIcon("louage")!;

/**
 * L'accueil de « Taxi & Louage Gafsa » : ce qu'on vient faire, tout de suite.
 * Le nombre de taxis réellement disponibles, la commande en un geste, les
 * prochains départs de louage avec leurs places restantes, puis les
 * raccourcis (courses, notifications, espace chauffeur). Tous les chiffres
 * sont réels ; une section sans données ne s'affiche pas.
 */
export default async function AccueilTransport() {
  const { locale } = await getT();
  const ar = locale === "ar";
  const supabase = await createClient();
  const profile = await getProfile();

  const [{ count: libres }, { data: departs }, estChauffeur, { count: nonLues }] = await Promise.all([
    supabase.from("taxi_drivers").select("id", { count: "exact", head: true }).eq("is_approved", true).eq("is_available", true),
    supabase.rpc("louage_a_venir"),
    profile
      ? supabase.from("taxi_drivers").select("id").eq("id", profile.id).maybeSingle().then(({ data }) => Boolean(data))
      : Promise.resolve(false),
    profile
      ? supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("kind", "taxi_request").is("read_at", null)
      : Promise.resolve({ count: 0 }),
  ]);

  const prochains = (departs ?? []).filter((d) => d.seats_left > 0).slice(0, 3);
  const heure = (iso: string) =>
    new Date(iso).toLocaleString(ar ? "ar-TN" : "fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-6 pb-6">
      <header className="relative overflow-hidden rounded-b-[30px] bg-[image:var(--gradient-brand)] px-[18px] pt-4 pb-7 text-white">
        <span aria-hidden className="animate-halo-a pointer-events-none absolute -top-16 -end-14 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.2),transparent_65%)]" />
        <div className="relative flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-[0.6875rem] font-extrabold tracking-[0.14em] text-white/80 uppercase">
              {ar ? "تاكسي ولواج قفصة" : "Taxi & Louage Gafsa"}
            </span>
            <h1 className="text-[1.625rem] leading-[1.1] font-black tracking-[-0.5px]">
              {profile?.first_name ? (ar ? `أهلا ${profile.first_name}` : `Bonjour ${profile.first_name}`) : ar ? "إلى أين؟" : "Où allez-vous ?"}
            </h1>
            <p className="flex items-center gap-2 text-[0.78125rem] font-semibold text-white/90">
              <i aria-hidden className={`h-2 w-2 rounded-full ${libres ? "animate-point-vert bg-[#7EE2A8]" : "bg-white/40"}`} />
              {libres
                ? ar
                  ? `${libres} تاكسي متاح الآن`
                  : `${libres} taxi${libres > 1 ? "s" : ""} disponible${libres > 1 ? "s" : ""} maintenant`
                : ar
                  ? "لا تاكسي متاح في هذه اللحظة"
                  : "Aucun taxi disponible pour l’instant"}
            </p>
          </div>
          <LanguageToggle sombre />
        </div>
      </header>

      {/* Le geste principal : commander. */}
      <Link
        href="/taxi"
        className="press mx-4 -mt-10 flex items-center gap-4 rounded-[24px] bg-[var(--color-surface-solid)] p-4 shadow-[0_14px_34px_rgba(0,0,0,.45)]"
      >
        <span className="flex h-16 w-16 flex-none items-center justify-center rounded-[20px] bg-[linear-gradient(140deg,#fbbf24,#d97706)] text-[#1a1204]">
          <IconeTaxi size={34} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <b className="text-[1.125rem] leading-tight">{ar ? "اطلب تاكسي" : "Commander un taxi"}</b>
          <span className="text-[0.78125rem] text-[var(--color-muted)]">
            {ar ? "حدّد وجهتك واقترح سعرك" : "Indiquez votre destination, proposez votre prix"}
          </span>
        </span>
        <span aria-hidden className="text-[1.5rem] text-[var(--color-brand)] rtl:rotate-180">›</span>
      </Link>

      {/* Les prochains départs de louage, places restantes réelles. */}
      <section className="flex flex-col gap-3 px-4">
        <div className="flex items-center gap-2">
          <IconeLouage size={18} className="text-[var(--color-brand)]" />
          <h2 className="text-[1rem] font-extrabold">{ar ? "اللواج — الرحلات القادمة" : "Louage — prochains départs"}</h2>
          <Link href="/louage" className="ms-auto text-[0.75rem] font-extrabold text-[var(--color-brand)]">
            {ar ? "الكلّ" : "Tout voir"}
          </Link>
        </div>
        {prochains.length > 0 ? (
          prochains.map((d) => (
            <Link
              key={d.id}
              href="/louage"
              className="press flex items-center gap-3 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-[0.9375rem]">{d.destination}</b>
                <span className="truncate text-[0.75rem] text-[var(--color-muted)]">
                  {heure(d.departs_at)}
                  {d.departure_point ? ` · ${d.departure_point}` : ""}
                </span>
              </span>
              <span className="flex flex-none flex-col items-end">
                <b className="text-[0.875rem] text-[var(--color-brand)]">
                  {ar ? `${d.seats_left} مقاعد` : `${d.seats_left} place${d.seats_left > 1 ? "s" : ""}`}
                </b>
                {d.price_per_seat != null && <span className="text-[0.6875rem] text-[var(--color-muted)]">{formatPrice(d.price_per_seat, locale)}</span>}
              </span>
            </Link>
          ))
        ) : (
          <Link href="/louage" className="rounded-[18px] border border-dashed border-[var(--color-outline)] p-4 text-center text-[0.8125rem] text-[var(--color-muted)]">
            {ar ? "لا رحلات مبرمجة حاليا — اطّلع على محطات اللواج" : "Aucun départ programmé pour l’instant — voir les stations de louage"}
          </Link>
        )}
      </section>

      {/* Raccourcis. */}
      <section className="grid grid-cols-3 gap-2 px-4">
        {[
          { href: "/courses", icone: <BoxIcon size={20} />, titre: ar ? "رحلاتي" : "Mes courses", badge: 0 },
          { href: "/notifications", icone: <BellIcon size={20} />, titre: ar ? "الإشعارات" : "Notifications", badge: nonLues ?? 0 },
          estChauffeur
            ? { href: "/taxi/chauffeur", icone: <IconeTaxi size={20} />, titre: ar ? "فضاء السائق" : "Espace chauffeur", badge: 0 }
            : {
                href: profile ? "/devenir-chauffeur" : "/inscription?chauffeur=1",
                icone: <UserIcon size={20} />,
                titre: ar ? "كن سائقا" : "Devenir chauffeur",
                badge: 0,
              },
        ].map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="press relative flex flex-col items-center gap-2 rounded-[18px] bg-[var(--color-surface-solid)] px-2 py-4 text-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)]">{r.icone}</span>
            <span className="text-[0.75rem] font-bold leading-tight">{r.titre}</span>
            {r.badge > 0 && (
              <span className="absolute top-2 end-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-live-fill)] px-1 text-[0.625rem] font-black text-white">
                {r.badge}
              </span>
            )}
          </Link>
        ))}
      </section>

      {!profile && (
        <div className="mx-4 flex items-center gap-3 rounded-[18px] bg-[var(--color-brand-tint)] p-4">
          <span className="flex-1 text-[0.8125rem] font-semibold">
            {ar ? "سجّل الدخول لتتبّع رحلاتك واستقبال الإشعارات." : "Connectez-vous pour suivre vos courses et recevoir les notifications."}
          </span>
          <Link href="/connexion" className="flex-none rounded-[14px] bg-[var(--color-brand-fill)] px-4 py-2 text-[0.8125rem] font-extrabold text-white">
            {ar ? "دخول" : "Connexion"}
          </Link>
        </div>
      )}
    </div>
  );
}
