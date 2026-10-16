import Link from "next/link";
import Image from "next/image";
import type { ComponentType } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMallStatus, getProfile, getTopBarCounts } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { LIVES_DANS_LES_MENUS } from "@/lib/features";
import { cx, formatPrice, monogram, percentOff } from "@/lib/format";
import { SearchBar } from "@/components/shell/search-bar";
import { Avatar, Placeholder } from "@/components/ui/primitives";
import { PawIcon, ToolIcon, serviceIcon } from "@/components/ui/category-icons";
import { BellIcon, CartIcon } from "@/components/ui/icons";
import { LanguageToggle } from "@/components/shell/language-toggle";
import type { PracticalService } from "@/types/database";
import { lienProduit } from "@/lib/product-url";
import { DefilementAccueil } from "@/components/home/accueil/defilement";
import { ALAffiche, type Affiche } from "@/components/home/accueil/a-l-affiche";
import { CategoriesRail } from "@/components/home/accueil/categories-rail";
import { CoupDeCoeur, type CarteCoeur } from "@/components/home/accueil/coup-de-coeur";
import { CadeauGratter } from "@/components/home/accueil/cadeau-gratter";
import { Etages3D, type Etage } from "@/components/home/accueil/etages-3d";

export const metadata: Metadata = {
  title: "G-Mall — boutiques, marketplace et services",
  alternates: { canonical: "/accueil" },
};

/*
  Rendu à la demande : la page lit des cookies (session pour les compteurs,
  langue pour les textes), ce qui force le rendu dynamique — le dire
  explicitement plutôt que d'annoncer un cache qui n'existe pas.
*/
export const dynamic = "force-dynamic";

/*
  Accueil — handoff « design_handoff_accueil » (2026-10-14).

  Ordre du fichier : en-tête violet (salutation, état du mall) et recherche à
  cheval au texte d'aide animé ; « Tout Gafsa, en un seul endroit » (4 tuiles
  à compteurs) ; « À l'affiche » ; boutiques en direct ; catégories ;
  promotions ; « Coup de cœur du jour » ; « Cadeau du jour » ; « Les
  étages » (plan 3D du mall) ; services pratiques — puis G-Shop, seule section
  de l'ancien accueil gardée (choix de l'utilisateur, qui a retiré Black
  Friday, partenaires, sélection et invitation commerçants).

  Accueil clair (choix de l'utilisateur, même exception que les pages
  boutique) : `.clair-boutique` y pose les jetons clairs, le reste de l'app
  reste sombre. Tous les chiffres et toutes les boutiques sont réels.
*/

/** Un clic, et l'on est dans le service — chaque genre a son adresse directe. */
const LIEN_SERVICE: Record<string, string> = {
  taxi: "/taxi",
  louage: "/louage",
  pharmacy: "/services#pharmacy",
  prayer: "/services#prayer",
};

/** Les raccourcis qui ne sont pas des services pratiques en base. */
const RACCOURCIS = [
  { cle: "animaux", hue: 190, href: "/marketplace?categorie=animaux" },
  { cle: "sos", hue: 20, href: "/sos" },
] as const;

/** Photos livrées avec l'app, quand l'administration n'en a pas téléversé. */
const PHOTOS_CATEGORIES: Record<string, string> = {
  mode: "/images/cat-mode.webp",
  beaute: "/images/cat-beaute.webp",
  maison: "/images/cat-maison.webp",
  sport: "/images/cat-sport.webp",
  alimentation: "/images/cat-alim.webp",
  electronique: "/images/cat-electro.webp",
  cafes: "/images/cat-cafes.webp",
};

/** Deux familles mènent à leur annuaire de lieux, pas au marketplace. */
const ANNUAIRES: Record<string, string> = {
  "fete-evenements": "/evenements",
  "sport-loisirs": "/sport-loisirs",
};

/** Le plan 3D montre cinq niveaux : RDC à N4. */
const NIVEAUX = [0, 1, 2, 3, 4];

export default async function HomePage() {
  const { t, locale } = await getT();
  const ar = locale === "ar";
  const supabase = await createClient();
  const maintenant = new Date().toISOString();

  const [
    status,
    categories,
    counts,
    profile,
    sponsored,
    promo,
    shopPromos,
    catalogue,
    services,
    freeShop,
    livesRail,
    nbProduits,
    nbPromotions,
    boutiquesEtages,
    logos,
  ] = await Promise.all([
    getMallStatus(),
    getCategories(),
    getTopBarCounts(),
    getProfile(),

    // La boutique est jointe pour son `slug` : `/boutique/[slug]` n'accepte pas un identifiant.
    supabase
      .from("sponsored_slots")
      .select("*, shop:shops(slug, status)")
      .eq("is_active", true)
      .lte("starts_at", maintenant)
      .gte("ends_at", maintenant)
      .order("position")
      .limit(6),

    supabase
      .from("products")
      .select("id, name, name_ar, price, compare_at_price, images, description_ar, shop:shops!inner(name, slug, logo_url, status)")
      .eq("is_online", true)
      .eq("is_draft", false)
      .eq("shops.status", "approved")
      .eq("shops.list_in_marketplace", true)
      .not("compare_at_price", "is", null)
      .order("sold_count", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Promotions de boutique : actives, commencées, non expirées, boutique approuvée.
    supabase
      .from("promotions")
      .select("id, title, title_ar, percent_off, ends_at, shop:shops!inner(name, slug, logo_url, status)")
      .eq("is_active", true)
      .eq("shops.status", "approved")
      .lte("starts_at", maintenant)
      .gte("ends_at", maintenant)
      .order("percent_off", { ascending: false })
      .limit(8),

    // De quoi composer « Coup de cœur du jour » et la tuile Produits.
    supabase
      .from("products")
      .select("id, name, name_ar, price, images, shop:shops!inner(name, slug, status)")
      .eq("is_online", true)
      .eq("is_draft", false)
      .eq("shops.status", "approved")
      .eq("shops.list_in_marketplace", true)
      .gt("stock", 0)
      .order("sold_count", { ascending: false })
      .limit(24),

    supabase.from("practical_services").select("*").eq("is_active", true).order("sort_order").limit(8),

    // G-Shop : les dernières annonces validées.
    supabase.from("deals").select("id, title, images, price").eq("status", "active").order("created_at", { ascending: false }).limit(8),

    // Les boutiques en direct ou sur le point de l'être ; `status` avant `scheduled_at`.
    supabase
      .from("lives")
      .select("id, status, scheduled_at, shop:shops!inner(name, slug, logo_url, status)")
      .in("status", ["live", "scheduled"])
      .eq("shops.status", "approved")
      .order("status")
      .order("scheduled_at", { ascending: true })
      .limit(12),

    supabase
      .from("products")
      .select("id, shop:shops!inner(status)", { count: "exact", head: true })
      .eq("is_online", true)
      .eq("is_draft", false)
      .eq("shops.status", "approved"),

    supabase
      .from("promotions")
      .select("id, shop:shops!inner(status)", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("shops.status", "approved")
      .lte("starts_at", maintenant)
      .gte("ends_at", maintenant),

    // Le plan 3D : les vraies boutiques de chaque étage.
    supabase
      .from("shops")
      .select("slug, name, logo_url, is_open_now, mall_level, category:categories!shops_category_id_fkey(hue, name_fr, name_ar)")
      .eq("status", "approved")
      .gte("mall_level", 0)
      .lte("mall_level", 4)
      .order("mall_unit"),

    supabase.from("shops").select("logo_url").eq("status", "approved").not("logo_url", "is", null).limit(3),
  ]);

  /* ─── Données dérivées ────────────────────────────────────────────── */

  const serviceTiles = Object.values(
    (services.data ?? []).reduce<Record<string, PracticalService>>((acc, s) => {
      acc[s.kind] ??= s;
      return acc;
    }, {}),
  );

  /* Une pastille par boutique, pas par direct (le premier rencontré est le plus pertinent). */
  const boutiquesEnDirect = Object.values(
    (livesRail.data ?? []).reduce<
      Record<string, { id: string; status: string; scheduledAt: string | null; shop: { name: string; slug: string; logo_url: string | null } }>
    >((acc, live) => {
      acc[live.shop.slug] ??= { id: live.id, status: live.status, scheduledAt: live.scheduled_at, shop: live.shop };
      return acc;
    }, {}),
  );
  const slugsEnDirect = new Set(boutiquesEnDirect.filter((l) => l.status === "live").map((l) => l.shop.slug));

  function delaiAvantDirect(scheduledAt: string): string {
    const minutes = Math.max(1, Math.round((new Date(scheduledAt).getTime() - Date.now()) / 60_000));
    if (minutes < 60) return format(t.live.startsInMin, { n: minutes });
    const heures = Math.round(minutes / 60);
    if (heures < 24) return format(t.live.startsInHour, { n: heures });
    return format(t.live.startsInDay, { n: Math.round(heures / 24) });
  }

  const avecPhoto = (catalogue.data ?? []).filter((p) => p.images?.[0]);
  const cartesCoeur: CarteCoeur[] = avecPhoto.slice(0, 8).map((p) => ({
    id: p.id,
    name: p.name,
    name_ar: p.name_ar,
    price: p.price,
    image: p.images[0],
    boutique: p.shop.name,
  }));

  const affiches: Affiche[] = (sponsored.data ?? []).map((s) => ({
    id: s.id,
    titre: s.title,
    sousTitre: s.subtitle,
    image: s.image_url,
    href: s.link_url ?? (s.shop?.slug && s.shop.status === "approved" ? `/boutique/${s.shop.slug}` : null),
  }));

  /* « Cadeau du jour » : une vraie promotion en cours, qui change chaque jour. */
  const promosActives = shopPromos.data ?? [];
  const jour = Math.floor(Date.now() / 86_400_000);
  const promoDuJour = promosActives.length > 0 ? promosActives[jour % promosActives.length] : null;

  const etages: Etage[] = NIVEAUX.map((niveau) => {
    const ici = (boutiquesEtages.data ?? []).filter((s) => s.mall_level === niveau);
    return {
      niveau,
      nomFr: [...new Set(ici.map((s) => s.category?.name_fr).filter(Boolean))].slice(0, 2).join(" · "),
      nomAr: [...new Set(ici.map((s) => s.category?.name_ar).filter(Boolean))].slice(0, 2).join(" · "),
      boutiques: ici.map((s) => ({
        slug: s.slug,
        nom: s.name,
        logo: s.logo_url,
        hue: s.category?.hue ?? 300,
        ouvert: s.is_open_now,
        live: slugsEnDirect.has(s.slug),
      })),
    };
  });

  const discount = promo.data ? percentOff(promo.data.price, promo.data.compare_at_price) : null;

  const tuilesCategories = categories.map((c) => ({
    id: c.id,
    nom: ar ? c.name_ar : c.name_fr,
    href: ANNUAIRES[c.slug] ?? `/marketplace?categorie=${c.slug}`,
    hue: c.hue,
    photo: c.image_url ?? PHOTOS_CATEGORIES[c.slug] ?? null,
    monogramme: c.monogram,
  }));

  const mots = ar ? ["عطر", "فستان", "هاتف", "حلويات", "تاكسي"] : ["un parfum", "une robe", "un téléphone", "une pâtisserie", "un taxi"];

  const tuileHub =
    "press relative flex h-24 flex-col items-center justify-between overflow-hidden rounded-[20px] px-1 pt-[10px] pb-2 text-center";

  return (
    <div className="clair-boutique flex min-h-0 flex-1 flex-col bg-[var(--color-app)] text-ink">
      <DefilementAccueil compacte={<SearchBar flottante withVoice={false} withMenu={false} />}>
        {/* ═══ En-tête violet : à qui l'on parle, et ce qui se passe maintenant ═══ */}
        <header className="relative flex-none overflow-hidden rounded-b-[30px] bg-[linear-gradient(140deg,#7E58A6_0%,#6D4B8F_45%,#3E2A56_100%)] px-[18px] pt-4 pb-[46px] text-white">
          <span
            aria-hidden
            className="animate-halo-a pointer-events-none absolute -top-[70px] -end-[60px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.18),transparent_65%)]"
          />
          <span
            aria-hidden
            className="animate-halo-b pointer-events-none absolute -bottom-[90px] -start-[70px] h-[210px] w-[210px] rounded-full bg-[radial-gradient(circle,rgba(208,69,95,.36),transparent_68%)]"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
              <h1 className="text-[1.6875rem] leading-[1.05] font-black tracking-[-0.6px]">
                {profile?.first_name ? format(t.home.greeting, { name: profile.first_name }) : t.home.greetingAnon}{" "}
                <span className="animate-salut inline-block">👋</span>
              </h1>
              <p className="flex items-start gap-2 text-[0.71875rem] leading-[1.4] font-semibold text-white/88">
                <i
                  aria-hidden
                  className={cx("mt-[5px] h-2 w-2 flex-none rounded-full", status.anyOpen && "animate-point-vert")}
                  style={{ background: status.anyOpen ? "#7EE2A8" : "rgba(255,255,255,.45)" }}
                />
                {status.anyOpen
                  ? format(t.home.activeShops, { n: status.openCount })
                  : format(t.marketplace.allShops, { n: status.totalCount })}
              </p>
            </div>
            <div className="flex flex-none gap-[7px]">
              <LanguageToggle sombre />
              <Link
                href="/notifications"
                aria-label={t.nav.notifications}
                className="press relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/25 bg-white/15 text-white"
              >
                <BellIcon size={17} />
                {counts.notifications > 0 && (
                  <span className="absolute -top-[2px] -end-[2px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#D0455F] px-1 text-[0.5625rem] font-bold text-white">
                    {counts.notifications > 99 ? "99+" : counts.notifications}
                  </span>
                )}
              </Link>
              <Link
                href="/panier"
                aria-label={t.cart.title}
                className="press relative flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white text-[#6D4B8F]"
              >
                <CartIcon size={17} />
                {counts.cart > 0 && (
                  <span className="absolute -top-[2px] -end-[2px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#241F2E] px-1 text-[0.5625rem] font-extrabold text-white">
                    {counts.cart > 99 ? "99+" : counts.cart}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* La recherche à cheval sur le bord du panneau, au texte d'aide animé. */}
        <div className="relative z-10 -mt-[26px] flex-none">
          <SearchBar flottante motsAnimes={mots} placeholder={ar ? "ابحث عن…" : "Chercher…"} />
        </div>

        <div className="flex flex-col gap-7 pt-5">
          {/* ─── Tout Gafsa, en un seul endroit ─── */}
          <section data-rv className="flex flex-col gap-[10px]">
            <EnteteSection couleur="linear-gradient(135deg,#D0455F,#6D4B8F)" titre={ar ? "كل قفصة في مكان واحد" : "Tout Gafsa, en un seul endroit"} />
            <div className="grid grid-cols-4 gap-2 px-4">
              <Link href="/boutiques" data-rvi className={cx(tuileHub, "bg-white shadow-[0_6px_18px_rgba(60,40,90,.08)]")}>
                <span dir="ltr" className="flex h-8 items-center">
                  {(logos.data ?? []).map((l, i) => (
                    <span
                      key={i}
                      className="animate-flotte -mr-2 h-[26px] w-[26px] overflow-hidden rounded-full border-2 border-white bg-[#EDE7F5] shadow-[0_2px_6px_rgba(60,40,90,.15)]"
                      style={{ animationDelay: `${i * 0.3}s` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- logo 26px */}
                      <img src={l.logo_url!} alt="" className="h-full w-full object-cover" />
                    </span>
                  ))}
                </span>
                <span className="flex flex-col items-center leading-[1.1]">
                  <b data-count={status.totalCount} className="text-[1rem] text-[#6D4B8F] tabular-nums">
                    {status.totalCount}
                  </b>
                  <b className="text-[0.6875rem]">{ar ? "المحلات" : "Boutiques"}</b>
                </span>
              </Link>
              <Link href="/marketplace" data-rvi className={cx(tuileHub, "bg-white shadow-[0_6px_18px_rgba(60,40,90,.08)]")}>
                <span className="relative h-8 w-[54px]">
                  {avecPhoto.slice(0, 3).map((p, i) => (
                    <span
                      key={p.id}
                      className="absolute bottom-0 h-7 w-[22px] origin-bottom overflow-hidden rounded-[6px] border-[1.5px] border-white bg-[#EDE7F5] shadow-[0_3px_8px_rgba(60,40,90,.18)]"
                      style={{ left: `${i * 16}px`, transform: `rotate(${(i - 1) * 12}deg)` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- vignette 22px */}
                      <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                    </span>
                  ))}
                </span>
                <span className="flex flex-col items-center leading-[1.1]">
                  <b data-count={nbProduits.count ?? 0} className="text-[1rem] text-[#6D4B8F] tabular-nums">
                    {(nbProduits.count ?? 0).toLocaleString("fr-FR")}
                  </b>
                  <b className="text-[0.6875rem]">{ar ? "المنتجات" : "Produits"}</b>
                </span>
              </Link>
              <Link href="/services" data-rvi className={cx(tuileHub, "bg-white shadow-[0_6px_18px_rgba(60,40,90,.08)]")}>
                <span className="animate-flotte relative h-8 w-8 overflow-hidden rounded-[11px] bg-[#EDE7F5]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vignette 32px */}
                  <img src="/images/svc-taxi.webp" alt="" className="h-full w-full object-cover" />
                  <i className="animate-point-vert absolute top-[3px] right-[3px] h-[7px] w-[7px] rounded-full bg-[#2FB36B] shadow-[0_0_0_1.5px_#fff]" />
                </span>
                <span className="flex flex-col items-center leading-[1.1]">
                  <b data-count={serviceTiles.length} className="text-[1rem] text-[#1D7A46] tabular-nums">
                    {serviceTiles.length}
                  </b>
                  <b className="text-[0.6875rem]">{ar ? "الخدمات" : "Services"}</b>
                </span>
              </Link>
              <a
                href="#promotions"
                data-rvi
                className={cx(tuileHub, "bg-[linear-gradient(150deg,#3E2A56,#241F2E)] text-white shadow-[0_8px_20px_rgba(36,31,46,.25)]")}
              >
                <span aria-hidden className="absolute -top-6 -end-6 h-20 w-20 rounded-full bg-[radial-gradient(circle,rgba(208,69,95,.55),transparent_65%)]" />
                <span className="relative flex h-8 items-center">
                  <span dir="ltr" className="animate-pulse-promo rounded-[10px] bg-[#D0455F] px-[9px] py-[3px] text-[0.875rem] font-black">
                    −%
                  </span>
                </span>
                <span className="relative flex flex-col items-center leading-[1.1]">
                  <b data-count={nbPromotions.count ?? 0} className="text-[1rem] tabular-nums">
                    {nbPromotions.count ?? 0}
                  </b>
                  <b className="text-[0.6875rem]">{ar ? "العروض" : "Bons plans"}</b>
                </span>
              </a>
            </div>
          </section>

          {/* ─── À l'affiche (sponsorisé) ─── */}
          <ALAffiche affiches={affiches} locale={locale} />

          {/* ─── Boutiques en direct : anneau conique qui tourne autour des directs ─── */}
          {LIVES_DANS_LES_MENUS && boutiquesEnDirect.length > 0 && (
            <section data-rv className="flex flex-col gap-3">
              <EnteteSection couleur="#D0455F" titre={ar ? "محلات في البثّ" : "Boutiques en direct"}>
                <Link href="/lives" className="text-[0.75rem] font-extrabold text-[#6D4B8F]">
                  {ar ? "الكلّ" : "Tout voir"}
                </Link>
              </EnteteSection>
              <div className="no-sb flex gap-[14px] overflow-x-auto px-4 pt-[2px] pb-2">
                {boutiquesEnDirect.map((live) => (
                  <Link
                    key={live.shop.slug}
                    href={`/lives/${live.id}`}
                    data-rvi
                    aria-label={`${live.shop.name} — ${live.status === "live" ? t.live.onAir : t.live.scheduled}`}
                    className="flex w-[66px] flex-none flex-col items-center gap-[10px]"
                  >
                    <span className="relative h-[66px] w-[66px] overflow-hidden rounded-full bg-[#DCD3EA]">
                      {live.status === "live" && (
                        <span className="animate-anneau-direct absolute -inset-1/4 bg-[conic-gradient(#D0455F,#F29BB0,#6D4B8F,#D0455F)]" />
                      )}
                      <span className="absolute inset-[3px] overflow-hidden rounded-full border-[2.5px] border-[#F4F1FA] bg-[#EDE7F5]">
                        <Avatar src={live.shop.logo_url} initials={monogram(live.shop.name)} size={56} />
                      </span>
                    </span>
                    <span
                      className="relative -mt-[19px] flex h-[17px] items-center rounded-[9px] px-[7px] text-[0.53125rem] font-black whitespace-nowrap text-white shadow-[0_0_0_2px_#F4F1FA]"
                      style={{ background: live.status === "live" ? "#D0455F" : "#6D4B8F" }}
                    >
                      {live.status === "live" ? (ar ? "مباشر" : "EN DIRECT") : delaiAvantDirect(live.scheduledAt!)}
                    </span>
                    <span className="-mt-1 max-w-[66px] truncate text-[0.6875rem] font-bold text-[#635C74]">{live.shop.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ─── Catégories ─── */}
          <CategoriesRail tuiles={tuilesCategories} titre={ar ? "الأصناف" : "Catégories"} />

          {/* ─── Promotions : coupon perforé + rangée de remises ─── */}
          {(promo.data || promosActives.length > 0) && (
            <section id="promotions" data-rv className="flex scroll-mt-24 flex-col gap-3">
              <EnteteSection couleur="#D0455F" titre={ar ? "العروض" : "Promotions"} />

              {promo.data && (
                <div data-rvi className="mx-4 rounded-[24px] bg-white shadow-[0_10px_26px_rgba(60,40,90,.1)]">
                  <div className="relative h-[160px] overflow-hidden rounded-t-[24px] bg-[#EDE7F5]">
                    {promo.data.images?.[0] ? (
                      // Image seule, sans action : seuls la pastille boutique, le nom et
                      // « زيارة المتجر » réagissent au toucher.
                      <span className="relative block h-[160px] w-full">
                        <Image src={promo.data.images[0]} alt={promo.data.name} fill sizes="(max-width: 520px) 100vw, 520px" className="object-cover" />
                      </span>
                    ) : (
                      <Placeholder label="photo boutique — vitrine" className="h-[160px] w-full" />
                    )}
                    <span aria-hidden className="animate-reflet pointer-events-none absolute -inset-y-[20%] left-0 w-[70px] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)]" />
                    <Link
                      href={`/boutique/${promo.data.shop.slug}`}
                      className="absolute start-3 top-3 flex max-w-[70%] items-center gap-[6px] rounded-full bg-white/96 py-[3px] ps-[3px] pe-[10px] text-[0.6875rem] font-extrabold text-[#241F2E]"
                    >
                      <Avatar src={promo.data.shop.logo_url} initials={monogram(promo.data.shop.name)} size={22} />
                      <span className="truncate">{promo.data.shop.name}</span>
                    </Link>
                    {discount !== null && (
                      <span
                        dir="ltr"
                        className="animate-pulse-promo absolute start-3 bottom-3 rounded-full bg-[#D0455F] px-3 py-[6px] text-[0.9375rem] font-black text-white shadow-[0_6px_14px_rgba(208,69,95,.4)]"
                      >
                        −{discount}%
                      </span>
                    )}
                  </div>
                  {/* La perforation : deux encoches couleur de page, pointillés entre les deux. */}
                  <div aria-hidden className="relative h-4">
                    <span className="absolute -top-2 -left-2 h-4 w-4 rounded-full bg-[#F4F1FA]" />
                    <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[#F4F1FA]" />
                    <span className="absolute inset-x-[14px] top-[7px] h-[2px] bg-[repeating-linear-gradient(90deg,rgba(60,40,90,.16)_0_5px,transparent_5px_10px)]" />
                  </div>
                  {/*
                    Deux liens frères, jamais imbriqués : nom et prix → fiche produit,
                    « زيارة المتجر » → la boutique du produit (slug réel de `shops`).
                  */}
                  <div className="flex items-end gap-[10px] px-4 pb-4">
                    <Link href={lienProduit(promo.data)} className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <b className="text-[0.875rem] leading-[1.3]">{ar && promo.data.name_ar ? promo.data.name_ar : promo.data.name}</b>
                      <span className="flex items-baseline gap-2">
                        <b className="text-[1.1875rem] tracking-[-0.3px] text-[#6D4B8F]">{formatPrice(promo.data.price, locale)}</b>
                        {promo.data.compare_at_price && (
                          <s className="text-[0.75rem] text-[#767085]">{formatPrice(promo.data.compare_at_price, locale)}</s>
                        )}
                      </span>
                    </Link>
                    <Link
                      href={`/boutique/${promo.data.shop.slug}`}
                      className="press flex h-10 flex-none items-center rounded-[20px] bg-[#6D4B8F] px-4 text-[0.75rem] font-extrabold text-white shadow-[0_6px_16px_rgba(109,75,143,.36)]"
                    >
                      {t.product.seeShop}
                    </Link>
                  </div>
                </div>
              )}

              {promosActives.length > 0 && (
                <div className="no-sb flex gap-[10px] overflow-x-auto px-4 pb-1">
                  {promosActives.map((offre) => (
                    <Link
                      key={offre.id}
                      href={`/boutique/${offre.shop.slug}`}
                      data-rvi
                      className="flex w-[200px] flex-none items-center gap-[10px] rounded-[18px] bg-white p-[10px] shadow-[0_6px_18px_rgba(60,40,90,.07)]"
                    >
                      <Avatar src={offre.shop.logo_url} initials={monogram(offre.shop.name)} size={36} />
                      <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
                        <b className="truncate text-[0.78125rem]">{offre.shop.name}</b>
                        <span className="truncate text-[0.6875rem] text-[#635C74]">{ar && offre.title_ar ? offre.title_ar : offre.title}</span>
                      </span>
                      <span dir="ltr" className="flex-none rounded-[10px] bg-[#D0455F] px-2 py-[3px] text-[0.6875rem] font-black text-white">
                        −{offre.percent_off}%
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ─── Coup de cœur du jour ─── */}
          <CoupDeCoeur cartes={cartesCoeur} locale={locale} connecte={Boolean(profile)} />

          {/* ─── Cadeau du jour : une vraie promotion à gratter ─── */}
          {promoDuJour && (
            <CadeauGratter
              locale={locale}
              promo={{
                pourcent: promoDuJour.percent_off,
                titre: ar && promoDuJour.title_ar ? promoDuJour.title_ar : promoDuJour.title,
                boutique: promoDuJour.shop.name,
                slug: promoDuJour.shop.slug,
                fin: promoDuJour.ends_at,
              }}
            />
          )}

          {/* ─── Les étages : le plan 3D du mall ─── */}
          <Etages3D etages={etages} locale={locale} />

          {/* ─── Services pratiques : pastilles de 176 px sur deux lignes ─── */}
          {serviceTiles.length > 0 && (
            <section data-rv className="flex flex-col gap-3">
              <EnteteSection couleur="oklch(.55 .11 165)" titre={ar ? "خدمات عملية" : "Services pratiques"}>
                <Link href="/services" className="text-[0.75rem] font-extrabold text-[#6D4B8F]">
                  {ar ? "الكلّ" : "Tout voir"}
                </Link>
              </EnteteSection>
              <div className="no-sb grid grid-flow-col grid-rows-2 gap-[10px] overflow-x-auto px-4 pb-[6px]">
                {serviceTiles.map((service) => (
                  <ChipService
                    key={service.id}
                    href={LIEN_SERVICE[service.kind] ?? `/services#${service.kind}`}
                    nom={ar && service.name_ar ? service.name_ar : service.name}
                    detail={service.info}
                    imageUrl={service.image_url}
                    monogramme={service.monogram}
                    Dessin={serviceIcon(service.kind) ?? undefined}
                    hue={service.hue}
                  />
                ))}
                {RACCOURCIS.map((r) => (
                  <ChipService
                    key={r.cle}
                    href={r.href}
                    nom={r.cle === "animaux" ? t.shortcuts.animals : t.shortcuts.sos}
                    Dessin={r.cle === "animaux" ? PawIcon : ToolIcon}
                    hue={r.hue}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ─── G-Shop : gardée à la demande de l'utilisateur ─── */}
          {(freeShop.data ?? []).length > 0 && (
            <section data-rv className="flex flex-col gap-3">
              <EnteteSection couleur="oklch(.47 .12 0)" titre={t.deals.title}>
                <Link href="/free-shop" className="text-[0.75rem] font-extrabold text-[#6D4B8F]">
                  {ar ? "الكلّ" : "Tout voir"}
                </Link>
              </EnteteSection>
              <div className="no-sb flex gap-[10px] overflow-x-auto px-4 pb-1">
                {(freeShop.data ?? []).map((annonce) => (
                  <Link
                    key={annonce.id}
                    href={`/free-shop/${annonce.id}`}
                    data-rvi
                    className="w-[168px] flex-none overflow-hidden rounded-[18px] bg-white shadow-[0_6px_18px_rgba(60,40,90,.07)]"
                  >
                    <span className="relative block aspect-[4/3] bg-[#EDE7F5]">
                      {annonce.images[0] ? (
                        <Image src={annonce.images[0]} alt="" fill sizes="168px" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[0.625rem] text-[#767085]">{t.deals.title}</span>
                      )}
                    </span>
                    <span className="flex flex-col gap-[2px] px-[10px] py-[9px]">
                      <span className="truncate text-[0.6875rem] font-bold">{annonce.title}</span>
                      <span dir="ltr" className="text-[0.65625rem] font-bold text-[#6D4B8F]">
                        {annonce.price != null ? formatPrice(annonce.price, locale) : t.deals.free}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </DefilementAccueil>
    </div>
  );
}

/** Le titre d'une section (16/800) et sa pastille de couleur, comme le handoff. */
function EnteteSection({ couleur, titre, children }: { couleur: string; titre: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-[18px]">
      <i aria-hidden className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: couleur }} />
      <h2 className="text-[1rem] leading-none font-extrabold tracking-[-0.2px]">{titre}</h2>
      {children && <div className="ms-auto flex items-center">{children}</div>}
    </div>
  );
}

/** Un service, en pastille de 176 px : photo, dessin ou monogramme, puis l'info du jour. */
function ChipService({
  href,
  nom,
  detail,
  imageUrl,
  monogramme,
  Dessin,
  hue = 300,
}: {
  href: string;
  nom: string;
  detail?: string | null;
  imageUrl?: string | null;
  monogramme?: string;
  Dessin?: ComponentType<{ size?: number; className?: string }>;
  hue?: number;
}) {
  return (
    <Link
      href={href}
      data-rvi
      className="press flex w-[176px] flex-none items-center gap-[10px] rounded-[18px] bg-white p-2 pe-3 shadow-[0_4px_14px_rgba(60,40,90,.06)]"
    >
      <span
        aria-hidden
        className={cx("flex h-[42px] w-[42px] flex-none items-center justify-center overflow-hidden rounded-full", !imageUrl && "cat-surface cat-ink")}
        style={{ "--hue": hue } as React.CSSProperties}
      >
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={42} height={42} className="h-full w-full object-cover" />
        ) : Dessin ? (
          <Dessin size={21} />
        ) : (
          <span className="text-[0.75rem] font-black">{monogramme}</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
        <b className="truncate text-[0.78125rem]">{nom}</b>
        {detail && <span className="truncate text-[0.6875rem] font-semibold text-[#635C74]">{detail}</span>}
      </span>
    </Link>
  );
}
