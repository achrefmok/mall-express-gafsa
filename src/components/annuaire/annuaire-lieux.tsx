import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatDate, formatRating, monogram } from "@/lib/format";
import { numeroAppelable } from "@/lib/phone";
import { whatsAppHref } from "@/lib/contact";
import { categoryIcon } from "@/components/ui/category-icons";
import { TopBar } from "@/components/shell/top-bar";

export type FamilleLieux = "fete-evenements" | "sport-loisirs";

/* ═══════════════════════════════════════════════════════════════════════
   L'annuaire des lieux : Fête & Événements, Sport & Loisirs.

   ────────────────────────────────────────────────────────────────────────
   Des lieux, rangés comme des boutiques
   ────────────────────────────────────────────────────────────────────────

   Une salle des fêtes ou une salle de sport a tout ce qu'une boutique a
   déjà dans l'application : nom, photos, description, adresse, position,
   téléphone, WhatsApp, Instagram, Facebook, horaires, avis — et des
   promotions. Aucune table nouvelle : l'établissement s'inscrit comme une
   boutique, se range dans la famille (catégorie principale ou « catégorie
   vendue »), et apparaît ici dès qu'il est approuvé.

   Les promotions en cours deviennent l'offre de la carte. Pas d'offre, pas
   d'encart : un espace vide annonçant « aucune offre » n'aide personne.
   ═══════════════════════════════════════════════════════════════════════ */

function lienInstagram(valeur: string | null): string | null {
  if (!valeur?.trim()) return null;
  const brut = valeur.trim();
  if (/^https?:\/\//i.test(brut)) return brut;
  const compte = brut.replace(/^@/, "").replace(/^(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
  return compte ? `https://www.instagram.com/${encodeURIComponent(compte)}/` : null;
}

function lienWeb(valeur: string | null): string | null {
  if (!valeur?.trim()) return null;
  try {
    const url = new URL(valeur.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function AnnuaireLieux({ famille }: { famille: FamilleLieux }) {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const titre = famille === "fete-evenements" ? t.annuaire.feteTitle : t.annuaire.sportTitle;
  const intro = famille === "fete-evenements" ? t.annuaire.feteIntro : t.annuaire.sportIntro;

  const { data: parent } = await supabase
    .from("categories")
    .select("id, slug, hue")
    .eq("slug", famille)
    .eq("is_active", true)
    .maybeSingle();

  // La migration des catégories n'est pas encore passée : on le dit simplement.
  if (!parent) {
    return (
      <Cadre titre={titre} intro={intro}>
        <Vide titre={t.annuaire.notReady} />
      </Cadre>
    );
  }

  const { data: enfants } = await supabase
    .from("categories")
    .select("id, name_fr, name_ar")
    .eq("parent_id", parent.id)
    .eq("is_active", true);

  const idsFamille = [parent.id, ...(enfants ?? []).map((c) => c.id)];
  const nomSousCategorie = new Map(
    (enfants ?? []).map((c) => [c.id, locale === "ar" ? c.name_ar : c.name_fr]),
  );

  const [directes, vendues] = await Promise.all([
    supabase.from("shops").select("id").eq("status", "approved").in("category_id", idsFamille),
    supabase.from("shop_categories").select("shop_id, category_id").in("category_id", idsFamille),
  ]);

  const idsLieux = [
    ...new Set([...(directes.data ?? []).map((s) => s.id), ...(vendues.data ?? []).map((r) => r.shop_id)]),
  ];

  if (idsLieux.length === 0) {
    return (
      <Cadre titre={titre} intro={intro}>
        <Vide titre={t.annuaire.emptyTitle} corps={t.annuaire.emptyBody} action={t.annuaire.listMine} />
      </Cadre>
    );
  }

  const maintenant = new Date().toISOString();
  const jour = (new Date().getDay() + 6) % 7;

  const [lieux, promotions, horaires] = await Promise.all([
    supabase
      .from("shops")
      .select(
        "id, slug, name, name_ar, description, description_ar, logo_url, cover_url, banner_url, address, latitude, longitude, phone, whatsapp, instagram, facebook_url, rating_sum, rating_count, is_featured, category_id",
      )
      .in("id", idsLieux)
      .eq("status", "approved"),
    supabase
      .from("promotions")
      .select("shop_id, title, title_ar, percent_off, ends_at")
      .in("shop_id", idsLieux)
      .eq("is_active", true)
      .lte("starts_at", maintenant)
      .gt("ends_at", maintenant),
    supabase
      .from("shop_hours")
      .select("shop_id, opens_at, closes_at, is_closed")
      .in("shop_id", idsLieux)
      .eq("weekday", jour),
  ]);

  // La meilleure offre de chaque lieu : la plus forte remise.
  const offreDe = new Map<string, NonNullable<typeof promotions.data>[number]>();
  for (const p of promotions.data ?? []) {
    const actuelle = offreDe.get(p.shop_id);
    if (!actuelle || p.percent_off > actuelle.percent_off) offreDe.set(p.shop_id, p);
  }
  const horaireDe = new Map((horaires.data ?? []).map((h) => [h.shop_id, h]));
  const sousCategorieVendue = new Map((vendues.data ?? []).map((r) => [r.shop_id, r.category_id]));

  // À la une d'abord, puis les lieux qui ont une offre, puis les mieux notés.
  const tries = [...(lieux.data ?? [])].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    const oa = offreDe.has(a.id) ? 1 : 0;
    const ob = offreDe.has(b.id) ? 1 : 0;
    if (oa !== ob) return ob - oa;
    const na = a.rating_count ? a.rating_sum / a.rating_count : 0;
    const nb = b.rating_count ? b.rating_sum / b.rating_count : 0;
    return nb - na;
  });

  const Icone = categoryIcon(famille);

  return (
    <Cadre titre={titre} intro={intro} compte={format(t.annuaire.count, { n: tries.length })}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tries.map((lieu, i) => {
          const nom = locale === "ar" && lieu.name_ar ? lieu.name_ar : lieu.name;
          const description = locale === "ar" && lieu.description_ar ? lieu.description_ar : lieu.description;
          const image = lieu.banner_url ?? lieu.cover_url ?? lieu.logo_url;
          const offre = offreDe.get(lieu.id);
          const horaire = horaireDe.get(lieu.id);
          const sousCategorie =
            nomSousCategorie.get(lieu.category_id ?? "") ??
            nomSousCategorie.get(sousCategorieVendue.get(lieu.id) ?? "");

          const itineraire =
            lieu.latitude !== null && lieu.longitude !== null
              ? `https://www.google.com/maps/search/?api=1&query=${lieu.latitude},${lieu.longitude}`
              : lieu.address
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lieu.address}, Gafsa`)}`
                : null;

          const whatsapp = whatsAppHref(lieu.whatsapp ?? lieu.phone, `Bonjour, je vous contacte depuis G-Mall au sujet de ${lieu.name}.`);
          const facebook = lienWeb(lieu.facebook_url);
          const instagram = lienInstagram(lieu.instagram);

          const horaireTexte = !horaire
            ? null
            : horaire.is_closed || !horaire.opens_at || !horaire.closes_at
              ? t.annuaire.closedToday
              : format(t.annuaire.hoursToday, {
                  hours: `${horaire.opens_at.slice(0, 5)} – ${horaire.closes_at.slice(0, 5)}`,
                });

          return (
            <li
              key={lieu.id}
              className="overflow-hidden rounded-[22px] bg-[var(--color-surface-solid)] shadow-[0_8px_22px_rgba(60,40,90,0.1)]"
            >
              <Link href={`/boutique/${lieu.slug}`} className="relative block aspect-[16/10] w-full overflow-hidden">
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    priority={i < 2}
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="cat-surface cat-ink flex h-full w-full items-center justify-center"
                    style={{ "--hue": parent.hue } as React.CSSProperties}
                  >
                    {Icone ? <Icone size={56} /> : <span className="text-[2rem] font-black">{monogram(nom)}</span>}
                  </span>
                )}

                {offre && (
                  <span className="absolute start-3 top-3 rounded-full bg-[var(--color-live-fill)] px-[11px] py-[6px] text-[0.6875rem] font-extrabold tracking-[0.04em] text-white shadow-[0_4px_12px_rgba(60,40,90,0.3)]">
                    <span aria-hidden>🔥 </span>
                    {t.annuaire.offer}
                    {offre.percent_off > 0 && <span dir="ltr"> −{offre.percent_off}%</span>}
                  </span>
                )}

                {sousCategorie && (
                  <span className="absolute end-3 top-3 max-w-[55%] truncate rounded-full bg-[var(--color-surface-solid)]/95 px-[10px] py-[5px] text-[0.625rem] font-bold text-[var(--color-ink)]">
                    {sousCategorie}
                  </span>
                )}
              </Link>

              <div className="flex flex-col gap-[10px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-[1rem] leading-[1.25] font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
                    {nom}
                  </h2>
                  {lieu.rating_count > 0 && (
                    <span className="flex-none text-[0.75rem] font-bold text-[var(--color-ink)]" dir="ltr">
                      <span aria-hidden className="text-[#f5a623]">★ </span>
                      {formatRating(lieu.rating_sum, lieu.rating_count)}
                      <span className="ms-1 font-normal text-[var(--color-muted)]">
                        ({format(t.annuaire.reviews, { n: lieu.rating_count })})
                      </span>
                    </span>
                  )}
                </div>

                {description && (
                  <p className="line-clamp-3 text-[0.78125rem] leading-[1.55] text-[var(--color-muted)]">
                    {description}
                  </p>
                )}

                {(lieu.address || horaireTexte) && (
                  <ul className="flex flex-col gap-1 text-[0.71875rem] text-[var(--color-ink)]">
                    {lieu.address && (
                      <li className="flex items-start gap-2">
                        <span aria-hidden>📍</span>
                        <span className="min-w-0">{lieu.address}</span>
                      </li>
                    )}
                    {horaireTexte && (
                      <li className="flex items-start gap-2">
                        <span aria-hidden>🕒</span>
                        <span>{horaireTexte}</span>
                      </li>
                    )}
                  </ul>
                )}

                {offre && (
                  <div className="rounded-[14px] bg-[var(--color-live-tint)] px-3 py-[10px]">
                    <p className="text-[0.625rem] font-extrabold tracking-[0.08em] text-[var(--color-live)]">
                      🔥 {t.annuaire.promotion}
                    </p>
                    <p className="mt-[3px] text-[0.8125rem] font-bold text-[var(--color-ink)]">
                      {locale === "ar" && offre.title_ar ? offre.title_ar : offre.title}
                    </p>
                    <p className="mt-[2px] text-[0.65625rem] text-[var(--color-muted)]">
                      {format(t.annuaire.until, { date: formatDate(offre.ends_at, locale) })}
                    </p>
                  </div>
                )}

                {/* Les gestes : appeler d'abord, puis les réseaux, puis la fiche. */}
                <div className="grid grid-cols-2 gap-2">
                  {lieu.phone ? (
                    <a
                      href={`tel:${numeroAppelable(lieu.phone)}`}
                      className="press flex min-h-11 items-center justify-center gap-1 rounded-[14px] bg-[var(--color-brand-fill)] text-[0.75rem] font-bold text-white"
                    >
                      <span aria-hidden>📞</span> {t.annuaire.call}
                    </a>
                  ) : (
                    <Link
                      href={`/boutique/${lieu.slug}`}
                      className="press flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--color-brand-fill)] text-[0.75rem] font-bold text-white"
                    >
                      {t.annuaire.seeProfile}
                    </Link>
                  )}
                  {whatsapp ? (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="press flex min-h-11 items-center justify-center rounded-[14px] bg-[#e6f4ea] text-[0.75rem] font-bold text-[#0f7a3d]"
                    >
                      WhatsApp
                    </a>
                  ) : (
                    itineraire && (
                      <a
                        href={itineraire}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="press flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--color-field)] text-[0.75rem] font-bold text-[var(--color-ink)]"
                      >
                        {t.annuaire.directions}
                      </a>
                    )
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {facebook && (
                    <a
                      href={facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="press flex min-h-10 items-center rounded-full border border-[var(--color-outline)] px-3 text-[0.6875rem] font-bold text-[#1877f2]"
                    >
                      Facebook
                    </a>
                  )}
                  {instagram && (
                    <a
                      href={instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="press flex min-h-10 items-center rounded-full border border-[var(--color-outline)] px-3 text-[0.6875rem] font-bold text-[#c13584]"
                    >
                      Instagram
                    </a>
                  )}
                  {whatsapp && itineraire && (
                    <a
                      href={itineraire}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="press flex min-h-10 items-center rounded-full border border-[var(--color-outline)] px-3 text-[0.6875rem] font-bold text-[var(--color-ink)]"
                    >
                      {t.annuaire.directions}
                    </a>
                  )}
                  {lieu.phone && (
                    <Link
                      href={`/boutique/${lieu.slug}`}
                      className="ms-auto flex min-h-10 items-center text-[0.6875rem] font-bold text-[var(--color-brand)]"
                    >
                      {t.annuaire.seeProfile} →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Cadre>
  );
}

function Cadre({
  titre,
  intro,
  compte,
  children,
}: {
  titre: string;
  intro: string;
  compte?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBar title={titre} back="/accueil" />
      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-8">
        <header className="flex flex-col gap-1">
          <p className="text-[0.8125rem] leading-[1.55] text-[var(--color-muted)]">{intro}</p>
          {compte && <p className="text-[0.6875rem] font-bold text-[var(--color-brand)]">{compte}</p>}
        </header>
        {children}
      </div>
    </>
  );
}

function Vide({ titre, corps, action }: { titre: string; corps?: string; action?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-[var(--color-outline)] bg-[var(--color-surface)] px-5 py-8 text-center">
      <p className="text-[0.875rem] font-bold text-[var(--color-ink)]">{titre}</p>
      {corps && <p className="max-w-[36ch] text-[0.75rem] leading-[1.5] text-[var(--color-muted)]">{corps}</p>}
      {action && (
        <Link
          href="/inscription?role=vendeur"
          className="press mt-2 flex min-h-11 items-center rounded-full bg-[var(--color-brand-fill)] px-5 text-[0.75rem] font-bold text-white"
        >
          {action}
        </Link>
      )}
    </div>
  );
}
