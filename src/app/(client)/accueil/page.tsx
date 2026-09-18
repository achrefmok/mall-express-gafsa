import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMallStatus, getProfile, getTopBarCounts } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { cx, formatPrice, monogram, percentOff } from "@/lib/format";
import { SearchBar } from "@/components/shell/search-bar";
import { AccessibilityBar } from "@/components/shell/accessibility-bar";
import { ProductCard } from "@/components/cards/product-card";
import { ImageZoom } from "@/components/ui/image-zoom";
import { SponsoredCarousel, type SponsoredSlot } from "@/components/home/sponsored-carousel";
import { PartnersRail, type PartenaireAccueil } from "@/components/home/partners-rail";
import { Avatar, Placeholder, Rail } from "@/components/ui/primitives";
import { categoryIcon } from "@/components/ui/category-icons";
import { BellIcon, CartIcon } from "@/components/ui/icons";
import { LanguageToggle } from "@/components/shell/language-toggle";
import type { PracticalService } from "@/types/database";
import { lienProduit } from "@/lib/product-url";
import { lireLogo } from "@/lib/brand";
import { avecBlackFriday, lireEtatBlackFriday, lireOffresActives } from "@/lib/black-friday-server";
import { SectionBlackFriday } from "@/components/black-friday/home-section";

export const metadata: Metadata = {
  title: "G-Mall — boutiques, marketplace et services",
  alternates: { canonical: "/accueil" },
};

/*
  Rendu à la demande, et il faut le dire ainsi.

  Cette page déclarait `revalidate = 60` avec le commentaire « mis en cache une
  minute pour absorber les pics ». Ce cache n'a jamais existé : la page lit des
  cookies — la session pour les compteurs de la barre, la langue pour les
  textes —, ce qui force le rendu dynamique. La construction le confirmait déjà,
  en la marquant `ƒ` et non `○`.

  Une directive qui ment coûte plus qu'elle ne rapporte : on croit la page
  protégée d'un pic de trafic alors qu'elle interroge Supabase à chaque visite.

  La rendre réellement statique demanderait de sortir la langue du cookie — elle
  passerait par le chemin d'URL — et d'isoler les compteurs derrière leur propre
  frontière. C'est un chantier d'architecture, pas un réglage ; il n'est pas
  entrepris ici. Les neuf requêtes de la page partent au moins en parallèle.
*/
export const dynamic = "force-dynamic";

/*
  Un clic, et l'on est dans le service.

  Chaque pastille menait à `/services#<genre>` — une page de services, puis
  il fallait y chercher le bon bloc. Pour le taxi, c'était une page de trop :
  la page des services renvoie elle-même vers `/taxi`. Pour le louage,
  c'était pire : `/services` n'affiche pas les louages, l'ancre ne menait
  nulle part.

  Chaque genre a désormais son adresse directe. Les pharmacies et la prière
  vivent sur `/services`, et l'ancre y fait défiler jusqu'au bon bloc : c'est
  bien l'expérience visée, sans étape intermédiaire.
*/
const LIEN_SERVICE: Record<string, string> = {
  taxi: "/taxi",
  louage: "/louage",
  pharmacy: "/services#pharmacy",
  prayer: "/services#prayer",
};

/** Les raccourcis qui ne sont pas des services pratiques en base. */
const RACCOURCIS = [
  { cle: "animaux", nom: "Animaux", emoji: "🐾", hue: 190, href: "/marketplace?categorie=animaux" },
  { cle: "sos", nom: "SOS", emoji: "🛠", hue: 20, href: "/sos" },
] as const;

export default async function HomePage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [
    status,
    categories,
    counts,
    profile,
    sponsored,
    liveShops,
    promo,
    shopPromos,
    catalogue,
    services,
    shopsByCategory,
    etatBf,
    offresBf,
    partenaires,
    freeShop,
    exposants,
  ] = await Promise.all([
    getMallStatus(),
    getCategories(),
    getTopBarCounts(),
    getProfile(),

    /*
      La boutique est jointe pour son `slug`, pas pour son nom.

      Le lien se construisait sur `shop_id`, alors que `/boutique/[slug]` attend
      un slug : une publicité rattachée à une boutique menait donc à une page
      introuvable. Le défaut ne se voyait pas, faute d'emplacement actif.
    */
    supabase
      .from("sponsored_slots")
      .select("*, shop:shops(slug, status)")
      .eq("is_active", true)
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString())
      .order("position")
      .limit(6),

    // Boutiques en direct d'abord, puis les plus suivies — la rangée
    // d'avatars ne doit jamais être vide.
    supabase
      .from("shops")
      .select("id, name, slug, logo_url, followers_count, lives(id, status)")
      .eq("status", "approved")
      .order("followers_count", { ascending: false })
      .limit(10),

    supabase
      .from("products")
      .select("id, name, name_ar, price, compare_at_price, images, description_ar, shop:shops!inner(name, slug, logo_url, status)")
      .eq("is_online", true)
      .eq("is_draft", false)
      .eq("shops.status", "approved")
      .not("compare_at_price", "is", null)
      .order("sold_count", { ascending: false })
      .limit(1)
      .maybeSingle(),

    /*
      Les promotions de boutique, absentes de cet écran jusqu'ici.

      La requête voisine ne cherche qu'un produit à prix barré : deux mécanismes
      distincts, et un commerçant qui créait « −10% sur toute la boutique » ne
      voyait rien apparaître ici. C'était le défaut le plus visible pour un
      vendeur, puisqu'il croyait sa promotion perdue.

      Les trois bornes comptent autant l'une que l'autre : active, commencée, non
      expirée. Sans la borne de début, une promotion programmée pour la semaine
      prochaine s'afficherait aujourd'hui ; sans celle de fin, elle resterait
      après son terme — le pire des deux, puisqu'un client s'y déplacerait.

      `shops!inner` avec le filtre de statut : une boutique suspendue ne doit pas
      continuer d'annoncer ses remises depuis la page d'accueil.
    */
    supabase
      .from("promotions")
      .select("id, title, title_ar, percent_off, ends_at, shop:shops!inner(name, slug, logo_url, status)")
      .eq("is_active", true)
      .eq("shops.status", "approved")
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString())
      .order("percent_off", { ascending: false })
      .limit(6),

    /*
      De quoi remplir l'écran quand aucun direct n'est en cours.

      Le rail des directs est vide la plupart du temps — un commerçant diffuse
      une heure par semaine, pas en continu — et l'accueil s'ouvrait alors sur
      une bande de pastilles grises qui ne menaient nulle part. Autant montrer
      ce que les boutiques mises en avant ont à vendre.

      Une seule requête, large, plutôt que deux : on demande douze articles des
      boutiques approuvées et l'on choisit ensuite ceux des boutiques à la une.
      Interroger d'abord les boutiques mises en avant aurait ajouté un
      aller-retour, et rendu la section vide le jour où plus aucune ne l'est.
    */
    supabase
      .from("products")
      .select(
        "id, name, price, compare_at_price, images, stock, category:categories(hue), shop:shops!inner(name, slug, status, is_featured)",
      )
      .eq("is_online", true)
      .eq("is_draft", false)
      .eq("shops.status", "approved")
      .gt("stock", 0)
      .order("sold_count", { ascending: false })
      .limit(12),

    supabase
      .from("practical_services")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .limit(8),

    /*
      Combien de boutiques par catégorie.

      La tuile annonçait une catégorie sans dire ce qu'il y avait derrière : on
      la touchait pour découvrir une grille vide. Le compte se lit avant de
      cliquer, et il vient d'une seule requête — la colonne `category_id` des
      boutiques approuvées, comptée ici plutôt que par douze agrégats.
    */
    supabase.from("shops").select("category_id").eq("status", "approved"),
    /*
      Le Black Friday : l'état de la campagne et, pendant, dix offres.

      Dans le même Promise.all que le reste — deux requêtes de plus en
      parallèle, pas deux allers-retours de plus. Hors campagne, la seconde
      rend une liste vide en quelques millisecondes.
    */
    lireEtatBlackFriday(),
    lireOffresActives(10),
    /*
      Les partenaires mis en avant.

      Le drapeau est posé par l'administration seule — un déclencheur
      empêche un commerçant de se l'attribuer —, et le rang décide de
      l'ordre. Sans rang, le plus récemment approuvé vient d'abord.
    */
    supabase
      .from("shops")
      .select(
        `id, slug, name, name_ar, logo_url, banner_url, cover_url,
         partner_tagline, partner_tagline_ar, accepts_reservations,
         category:categories!shops_category_id_fkey(hue)`,
      )
      .eq("status", "approved")
      .eq("is_partner", true)
      .order("partner_rank", { ascending: true, nullsFirst: false })
      .order("approved_at", { ascending: false })
      .limit(8),
    /*
      Free Shop : les dernières annonces validées. La policy écarte déjà
      celles qui attendent ou ont été refusées ; le filtre ci-dessous ne
      sert qu'à ne pas rapporter les expirées.
    */
    supabase
      .from("deals")
      .select("id, title, images, price")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8),
    /* Les stands publiés, toutes éditions confondues. */
    supabase
      .from("expo_exhibitors")
      .select("id, slug, name, name_ar, cover_url")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  /* Combien de boutiques approuvées derrière chaque catégorie. */
  const shopCount = (shopsByCategory.data ?? []).reduce<Record<string, number>>((acc, row) => {
    if (row.category_id) acc[row.category_id] = (acc[row.category_id] ?? 0) + 1;
    return acc;
  }, {});

  // Une tuile par type de service pratique (Taxi, Louage, Prière, Pharmacie)
  const serviceTiles = Object.values(
    (services.data ?? []).reduce<Record<string, PracticalService>>((acc, service) => {
      acc[service.kind] ??= service;
      return acc;
    }, {}),
  );

  const shops = liveShops.data ?? [];
  const withLiveFirst = [...shops].sort((a, b) => {
    const aLive = a.lives?.some((l) => l.status === "live") ? 1 : 0;
    const bLive = b.lives?.some((l) => l.status === "live") ? 1 : 0;
    return bLive - aLive;
  });

  /*
    Y a-t-il vraiment un direct à l'antenne ?

    Le rail affiche toutes les boutiques, celles qui diffusent en tête. Sans
    aucun direct, il ne restait qu'une bande de pastilles grises sous un titre
    qui promettait « en direct maintenant » — le genre de section qu'on apprend
    à ignorer.
  */
  const anyLive = shops.some((shop) => shop.lives?.some((l) => l.status === "live"));

  /*
    Trois articles pour prendre la place, en préférant les boutiques à la une.

    La préférence se fait ici plutôt que dans la requête : PostgREST ne trie pas
    sur une colonne de table jointe, et un second appel n'aurait servi qu'à
    obtenir un ordre. Si aucune boutique n'est mise en avant, on garde les plus
    vendus — la section reste pleine, ce qui est tout son intérêt.
  */
  const allProducts = catalogue.data ?? [];
  const featured = allProducts.filter((p) => p.shop?.is_featured);
  // Le prix Black Friday sur ces trois cartes : une requête, rien hors campagne.
  const highlights = await avecBlackFriday((featured.length > 0 ? featured : allProducts).slice(0, 3));

  const discount = promo.data ? percentOff(promo.data.price, promo.data.compare_at_price) : null;

  /*
    Le logo choisi dans l'administration, sinon celui livré avec l'application.
    Lecture mise en cache une minute par `lireMarque` : elle ne coûte rien à la
    page.
  */
  const logoApp = (await lireLogo()) ?? "/brand/app-icon.png";

  return (
    <>
      {/*
        ═══ Le panneau d'en-tête ═══════════════════════════════════════

        Quatre choses tenaient chacune sa bande : le surtitre, la salutation,
        l'état du mall, puis la recherche. Réunies sur une même surface
        violette arrondie, elles deviennent un seul bloc — celui qui dit à
        qui l'on parle et ce qui se passe maintenant —, et la barre de
        recherche vient à cheval sur son bord inférieur plutôt que de
        commencer une cinquième bande.

        L'en-tête et la recherche restent hors de la zone qui défile : la
        recherche est la porte de sortie de toutes les autres sections, elle
        ne doit jamais demander de remonter.
      */}
      <header className="relative flex-none overflow-hidden rounded-b-[30px] bg-[image:var(--gradient-brand)] px-[18px] pt-[16px] pb-[40px] text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-[70px] -end-[60px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_65%)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-[90px] -start-[70px] h-[210px] w-[210px] rounded-full bg-[radial-gradient(circle,var(--color-live-tint),transparent_68%)]"
        />

        <div className="relative flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[7px]">
              <span className="relative h-[26px] w-[26px] flex-none overflow-hidden rounded-[9px] bg-white/15 ring-1 ring-white/25">
                <Image src={logoApp} alt="" fill sizes="26px" className="object-cover" />
              </span>
              <p className="text-[0.59375rem] font-bold tracking-[0.22em] text-white/70 uppercase">
                {t.marketplace.eyebrow}
              </p>
            </div>
            <h1 className="mt-[7px] truncate text-[1.6875rem] leading-[1.05] font-extrabold tracking-[-0.02em]">
              {profile?.first_name
                ? format(t.home.greeting, { name: profile.first_name })
                : t.home.greetingAnon}
            </h1>
            {/* Aucune boutique ouverte ne veut pas dire qu'il n'y a rien à voir :
                on annonce alors le catalogue plutôt qu'un zéro. */}
            <div className="mt-[7px] flex items-center gap-[7px]">
              <span
                aria-hidden
                className="animate-live-dot h-2 w-2 flex-none rounded-full"
                style={{ background: status.anyOpen ? "#7ee2a8" : "rgba(255,255,255,0.45)" }}
              />
              <p className="truncate text-[0.71875rem] font-medium text-white/85">
                {status.anyOpen
                  ? format(t.home.activeShops, { n: status.openCount })
                  : format(t.marketplace.allShops, { n: status.totalCount })}
              </p>
            </div>
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
                <span className="absolute -top-[1px] -end-[1px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--color-live-fill)] px-1 text-[0.53125rem] font-bold text-white">
                  {counts.notifications > 99 ? "99+" : counts.notifications}
                </span>
              )}
            </Link>

            <Link
              href="/panier"
              aria-label={t.cart.title}
              className="press relative flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white text-[var(--color-brand)]"
            >
              <CartIcon size={17} />
              {counts.cart > 0 && (
                <span className="absolute -top-[2px] -end-[2px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--color-ink)] px-1 text-[0.53125rem] font-extrabold text-white">
                  {counts.cart > 99 ? "99+" : counts.cart}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* La pilule de recherche, posée sur le bord du panneau. */}
      <div className="relative z-10 -mt-[26px] flex-none">
        <SearchBar flottante />
      </div>

      <div className="no-sb flex flex-1 flex-col gap-7 overflow-y-auto pt-4 pb-5">
        <AccessibilityBar />

        {/*
          ─── 1 · Affiches sponsorisées ───────────────────────────────

          En ouverture, avec un titre de section : une affiche sans titre
          au-dessus se confondait avec une bannière du site lui-même. La
          mention « sponsorisé » reste posée sur l'image, comme il se doit.
        */}
        {(sponsored.data ?? []).length > 0 && (
          <section className="flex flex-col gap-3">
            <EnteteSection hue={40} titre={t.accueil.sponsoredTitle}>
              <span className="rounded-full border border-[var(--color-outline)] px-[9px] py-1 text-[0.53125rem] font-bold tracking-[0.14em] text-[var(--color-faint)]">
                {t.home.sponsoredBadge}
              </span>
            </EnteteSection>
            <SponsoredCarousel slots={(sponsored.data ?? []) as SponsoredSlot[]} />
          </section>
        )}

        {/*
          ─── 2 · Black Friday ────────────────────────────────────────

          Haut de page pendant vingt-quatre heures : c'est alors la chose la
          plus importante de l'application, et une section qu'il faut
          chercher en faisant défiler est une section qu'on rate.
        */}
        <SectionBlackFriday etat={etatBf} offres={offresBf} locale={locale} />

        {/*
          ─── 3 · En direct, et les boutiques ───────────────────────────────────────

          Toujours là, en direct ou non : un commerçant diffuse une heure par
          semaine, et sans ce rail l'accueil ne montrait aucun visage de
          commerce le reste du temps. L'anneau framboise et l'étiquette
          disent qui est à l'antenne.
        */}
        {withLiveFirst.length > 0 && (
          <section className="flex flex-col gap-3">
            <EnteteSection
              hue="var(--color-brand)"
              titre={anyLive ? t.home.liveNow : t.home.partners}
            >
              {anyLive && (
                <span className="text-[0.6875rem] font-semibold text-[var(--color-muted)]">
                  {format(t.accueil.liveCount, {
                    n: withLiveFirst.filter((s) => s.lives?.some((l) => l.status === "live")).length,
                  })}
                </span>
              )}
            </EnteteSection>

            <Rail gap={14} className="px-4">
              {withLiveFirst.map((shop) => {
                const live = shop.lives?.find((l) => l.status === "live");
                return (
                  <Link
                    key={shop.id}
                    href={live ? `/lives/${live.id}` : `/boutique/${shop.slug}`}
                    className="w-[66px] flex-none text-center"
                  >
                    <span
                      className="relative flex h-[66px] w-[66px] items-center justify-center rounded-full p-[3px]"
                      style={{
                        background: live
                          ? "linear-gradient(135deg, var(--color-live), var(--color-brand-strong))"
                          : "var(--color-outline)",
                      }}
                    >
                      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-app)] bg-[var(--color-surface-solid)] text-[0.625rem] font-bold text-[var(--color-muted)]">
                        {shop.logo_url ? (
                          <Image
                            src={shop.logo_url}
                            alt=""
                            width={58}
                            height={58}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          monogram(shop.name)
                        )}
                      </span>
                      {live && (
                        <span className="absolute -bottom-[3px] start-1/2 -translate-x-1/2 rounded-full bg-[var(--color-live-fill)] px-[7px] py-[3px] text-[0.4375rem] font-bold tracking-[0.12em] text-white rtl:translate-x-1/2">
                          LIVE
                        </span>
                      )}
                    </span>
                    <span className="mt-[9px] block truncate text-[0.65625rem] font-bold text-[var(--color-ink)]">
                      {shop.name}
                    </span>
                    {shop.followers_count > 0 && (
                      <span className="block truncate text-[0.59375rem] text-[var(--color-muted)]">
                        {shop.followers_count} {t.shop.followers}
                      </span>
                    )}
                  </Link>
                );
              })}
            </Rail>
          </section>
        )}

        {/*
          ─── 4 · Nos partenaires ─────────────────────────────────────────

          Les commerces qui soutiennent l'application. La section disparaît
          quand il n'y en a aucun : un titre suivi du vide fait croire à une
          panne, et cette place vaut mieux que ça.
        */}
        {(partenaires.data ?? []).length > 0 && (
          <section className="flex flex-col gap-3">
            <EnteteSection hue={280} titre={t.home.partners} />
            <PartnersRail
              partenaires={(partenaires.data ?? []) as unknown as PartenaireAccueil[]}
              locale={locale}
            />
          </section>
        )}

        {/*
          ─── 5 · Catégories ──────────────────────────────────────────

          La photo occupe toute la carte, le nom se lit sur un voile en bas :
          une catégorie se reconnaît à son image avant de se lire, et une part
          des clients visés lit peu le français.

          Deux rangées qui glissent sur téléphone : onze catégories en deux
          colonnes feraient six écrans de haut, et l'accueil ne montrerait plus
          rien d'autre. Sur grand écran, une grille de quatre, sans défilement.

          Fête & Événements et Sport & Loisirs mènent à leur annuaire : ce sont
          des lieux, pas des produits.
        */}
        <section className="flex flex-col gap-3">
          <EnteteSection hue={300} titre={t.home.categories} />
          <div className="no-sb grid auto-cols-[45%] grid-flow-col grid-rows-2 gap-[10px] overflow-x-auto px-4 pb-1 sm:auto-cols-[31%] lg:grid-flow-row lg:grid-cols-4 lg:grid-rows-none lg:overflow-visible">
            {categories.map((category) => (
              <CarteCategorie
                key={category.id}
                category={category}
                nom={locale === "ar" ? category.name_ar : category.name_fr}
                compte={
                  shopCount[category.id]
                    ? format(t.home.shopCount, { n: shopCount[category.id] })
                    : null
                }
              />
            ))}
          </div>
        </section>

        {/* ─── 6 · Promotions du moment ───────────────────────────────── */}
        {(promo.data || (shopPromos.data ?? []).length > 0) && (
          <section className="flex flex-col gap-3">
            <EnteteSection hue={25} titre={t.home.promos}>
              <Link href="/free-shop" className="text-[0.6875rem] font-bold text-[var(--color-brand)]">
                {t.common.seeAll} →
              </Link>
            </EnteteSection>

            {/*
              Les remises de boutique, en tête et sur un rail.

              Elles portent sur un commerce entier, là où la carte qui suit
              porte sur un seul article : les présenter dans le même format
              laisserait croire à un produit en promotion, et le client
              chercherait un prix qui n'existe pas.
            */}
            {(shopPromos.data ?? []).length > 0 && (
              <Rail gap={10} className="px-4">
                {(shopPromos.data ?? []).map((offer) => (
                  <Link
                    key={offer.id}
                    href={`/boutique/${offer.shop?.slug}`}
                    className="press flex w-[196px] flex-none items-center gap-[10px] rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-[10px] shadow-[var(--shadow-card)]"
                  >
                    <Avatar
                      src={offer.shop?.logo_url}
                      initials={monogram(offer.shop?.name)}
                      size={34}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
                        {offer.shop?.name}
                      </p>
                      <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                        {locale === "ar" && offer.title_ar ? offer.title_ar : offer.title}
                      </p>
                    </div>
                    {/* Le signe reste devant le nombre, même en arabe. */}
                    <span
                      dir="ltr"
                      className="flex-none rounded-[10px] bg-[var(--color-live-fill)] px-2 py-[3px] text-[0.59375rem] font-bold text-white"
                    >
                      −{offer.percent_off}%
                    </span>
                  </Link>
                ))}
              </Rail>
            )}

            {/*
              L'article en promotion prend la forme d'un coupon.

              Encoches sur les côtés, ligne perforée, remise posée sur la
              photo : la carte dit « bon à découper » avant même d'être lue,
              là où une vignette de plus se serait fondue dans la page. La
              photo garde ses cent-soixante-huit pixels et porte ce qui la
              qualifie — qui vend, et de combien on économise.

              L'ensemble reste un lien vers la fiche ; seule la photo dérive
              vers l'agrandissement, comme partout ailleurs.
            */}
            {promo.data && (
              <div className="mx-4 rounded-[20px] bg-[var(--color-surface-solid)] shadow-[0_8px_22px_rgba(60,40,90,0.1)]">
                <div className="relative overflow-hidden rounded-t-[20px] bg-[var(--color-track)]">
                  {promo.data.images?.[0] ? (
                    <ImageZoom
                      images={promo.data.images}
                      alt={promo.data.name}
                      className="block w-full cursor-zoom-in"
                    >
                      <span className="relative block h-[168px] w-full">
                        <Image
                          src={promo.data.images[0]}
                          alt={promo.data.name}
                          fill
                          sizes="(max-width: 520px) 100vw, 520px"
                          priority
                          className="fade-in-img object-cover"
                        />
                      </span>
                    </ImageZoom>
                  ) : (
                    <Placeholder label="photo boutique — vitrine" className="h-[168px] w-full" />
                  )}

                  <Link
                    href={`/boutique/${promo.data.shop?.slug}`}
                    className="press absolute start-3 top-3 flex max-w-[70%] items-center gap-[6px] rounded-full bg-[var(--color-surface-solid)]/96 py-1 pe-[10px] ps-1 shadow-[0_3px_10px_rgba(36,31,46,0.16)]"
                  >
                    <Avatar
                      src={promo.data.shop?.logo_url}
                      initials={monogram(promo.data.shop?.name)}
                      size={20}
                    />
                    <span className="truncate text-[0.625rem] font-bold text-[var(--color-ink)]">
                      {promo.data.shop?.name}
                    </span>
                  </Link>

                  {discount !== null && (
                    <span
                      dir="ltr"
                      className="absolute start-3 bottom-3 rounded-full bg-[var(--color-live-fill)] px-[11px] py-[6px] text-[0.75rem] font-extrabold text-white shadow-[0_4px_12px_rgba(60,40,90,0.34)]"
                    >
                      −{discount}%
                    </span>
                  )}
                </div>

                {/* La perforation : deux encoches du fond de l'application, et
                    des pointillés entre les deux. */}
                <div className="relative h-4" aria-hidden>
                  <span className="absolute -top-2 -start-2 h-4 w-4 rounded-full bg-[var(--color-app)]" />
                  <span className="absolute -top-2 -end-2 h-4 w-4 rounded-full bg-[var(--color-app)]" />
                  <span className="absolute start-[14px] end-[14px] top-[7px] h-[2px] bg-[repeating-linear-gradient(90deg,var(--color-outline)_0_5px,transparent_5px_10px)]" />
                </div>

                <Link href={lienProduit(promo.data)} className="block px-4 pt-[2px] pb-4">
                  <p className="text-[0.875rem] leading-[1.3] font-bold tracking-[-0.01em] text-[var(--color-ink)]">
                    {locale === "ar" && promo.data.name_ar ? promo.data.name_ar : promo.data.name}
                  </p>
                  {promo.data.description_ar && (
                    <p
                      lang="ar"
                      dir="rtl"
                      className="mt-[3px] line-clamp-2 text-[0.71875rem] leading-[1.55] text-[var(--color-muted)]"
                    >
                      {promo.data.description_ar}
                    </p>
                  )}
                  <div className="mt-[9px] flex items-end gap-[9px]">
                    <div className="min-w-0 flex-1">
                      <p className="text-[1.125rem] leading-none font-extrabold tracking-[-0.02em] text-[var(--color-brand)]">
                        {formatPrice(promo.data.price, locale)}
                      </p>
                      {promo.data.compare_at_price && (
                        <p className="mt-1 text-[0.6875rem] text-[var(--color-faint)] line-through">
                          {formatPrice(promo.data.compare_at_price, locale)}
                        </p>
                      )}
                    </div>
                    <span className="flex-none rounded-full bg-[var(--color-brand-fill)] px-[14px] py-[10px] text-[0.6875rem] font-bold whitespace-nowrap text-white shadow-[0_6px_16px_rgba(109,75,143,0.36)]">
                      {t.product.seeShop}
                    </span>
                  </div>
                </Link>
              </div>
            )}
          </section>
        )}

        {/*
          ─── 7 · Free Shop ───────────────────────────────────────────────

          Les annonces des membres, approuvées. Trois seulement : c'est un
          aperçu qui donne envie d'ouvrir la section, pas la section. La
          policy de lecture écarte déjà tout ce qui n'est pas validé — il
          n'y a donc rien à filtrer ici, et rien à oublier de filtrer.
        */}
        {(freeShop.data ?? []).length > 0 && (
          <section className="flex flex-col gap-3">
            <EnteteSection hue={0} titre={t.deals.title}>
              <Link href="/free-shop" className="text-[0.6875rem] font-bold text-[var(--color-brand)]">
                {t.common.seeAll} →
              </Link>
            </EnteteSection>

            <Rail gap={10} className="px-4">
              {(freeShop.data ?? []).map((annonce) => (
                <Link
                  key={annonce.id}
                  href={`/free-shop/${annonce.id}`}
                  className="w-[168px] flex-none overflow-hidden rounded-[18px] bg-[var(--color-surface-solid)]"
                >
                  <span className="relative block aspect-[4/3] bg-[var(--color-app)]">
                    {annonce.images[0] ? (
                      <Image src={annonce.images[0]} alt="" fill sizes="168px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[0.625rem] text-[var(--color-faint)]">
                        {t.deals.title}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col gap-[2px] px-[10px] py-[9px]">
                    <span className="truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
                      {annonce.title}
                    </span>
                    <span dir="ltr" className="text-[0.65625rem] font-bold text-[var(--color-brand)]">
                      {annonce.price != null ? formatPrice(annonce.price, locale) : t.deals.free}
                    </span>
                  </span>
                </Link>
              ))}
            </Rail>
          </section>
        )}

        {/*
          ─── 8 · Société Dahmani — Lelma3ardh ────────────────────────────

          Les stands de l'exposition, qui restent ouverts quand le marché
          ferme. L'ambre les distingue du violet du mall : on n'y commande
          pas, et leur donner l'apparence d'une boutique ferait chercher un
          panier qui n'existe pas.
        */}
        {(exposants.data ?? []).length > 0 && (
          <section className="flex flex-col gap-3">
            <EnteteSection hue={35} titre="Société Dahmani — Lelma3ardh">
              <Link
                href="/lelma3ardh"
                className="text-[0.6875rem] font-bold text-[var(--color-brand)]"
              >
                {t.common.seeAll} →
              </Link>
            </EnteteSection>

            <Rail gap={10} className="px-4">
              {(exposants.data ?? []).map((x) => (
                <Link
                  key={x.id}
                  href={`/lelma3ardh/${x.slug}`}
                  className="w-[136px] flex-none overflow-hidden rounded-[18px] bg-[var(--color-surface-solid)]"
                >
                  <span className="relative block aspect-square bg-[rgba(138,90,31,0.1)]">
                    {x.cover_url ? (
                      <Image src={x.cover_url} alt="" fill sizes="136px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[0.75rem] font-bold text-[rgba(138,90,31,0.5)]">
                        {monogram(x.name)}
                      </span>
                    )}
                  </span>
                  <span className="block truncate px-[9px] py-[8px] text-[0.65625rem] font-bold text-[var(--color-ink)]">
                    {locale === "ar" ? (x.name_ar ?? x.name) : x.name}
                  </span>
                </Link>
              ))}
            </Rail>
          </section>
        )}

        {/*
          ─── 9 · La sélection, ou le direct ──────────────────────────

          L'une ou l'autre, jamais les deux. Un direct est un rendez-vous :
          tant qu'il en existe un, rien ne doit lui disputer cette place. Le
          reste du temps — c'est-à-dire presque toujours — la place revient à
          ce que les boutiques mises en avant ont à vendre.
        */}
        {!anyLive && highlights.length > 0 && (
          <section className="flex flex-col gap-3">
            <EnteteSection hue={300} titre={t.home.featured} />
            <Rail gap={10} className="px-4">
              {highlights.map((product, i) => (
                /*
                  Arrivée décalée de soixante millisecondes par carte. Assez
                  pour que l'œil suive la rangée, trop peu pour qu'on attende
                  la dernière.
                */
                <div
                  key={product.id}
                  className="enter-item w-[150px] flex-none"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <ProductCard product={product} locale={locale} imageHeight={112} />
                </div>
              ))}
            </Rail>
          </section>
        )}

        {/*
          ─── 10 · Services pratiques ──────────────────────────────────

          Des chips de deux lignes sur deux rangées, plutôt que des pastilles
          rondes : le nom seul ne disait pas l'essentiel — une pharmacie de
          garde, c'est son horaire ; un taxi, c'est le nombre de chauffeurs
          en ligne. La seconde ligne porte ce que l'administration a
          renseigné.
        */}
        {serviceTiles.length > 0 && (
          <section className="flex flex-col gap-3">
            <EnteteSection hue={165} titre={t.home.practicalServices}>
              <Link href="/services" className="text-[0.6875rem] font-bold text-[var(--color-brand)]">
                {t.common.seeAll} →
              </Link>
            </EnteteSection>

            <div className="no-sb grid grid-flow-col grid-rows-2 gap-[10px] overflow-x-auto px-4 pb-[6px]">
              {etatBf.campagne && etatBf.campagne.phase !== "termine" && (
                <ChipService
                  href="/black-friday"
                  nom={t.bf.title}
                  detail={etatBf.campagne.phase === "actif" ? t.bf.now : t.bf.soon}
                  emoji="🔥"
                  sombre
                />
              )}

              {serviceTiles.map((service) => (
                <ChipService
                  key={service.id}
                  href={LIEN_SERVICE[service.kind] ?? `/services#${service.kind}`}
                  nom={locale === "ar" && service.name_ar ? service.name_ar : service.name}
                  detail={service.info}
                  imageUrl={service.image_url}
                  monogramme={service.monogram}
                  hue={service.hue}
                />
              ))}

              {RACCOURCIS.map((r) => (
                <ChipService
                  key={r.cle}
                  href={r.href}
                  nom={r.cle === "animaux" ? t.shortcuts.animals : t.shortcuts.sos}
                  emoji={r.emoji}
                  hue={r.hue}
                />
              ))}
            </div>
          </section>
        )}

        {/* ─── 11 · Invitation commerçants ─────────────────────────────── */}
        <div className="relative mx-4 overflow-hidden rounded-[24px] bg-[image:var(--gradient-brand)] p-[18px] text-white shadow-[0_12px_30px_rgba(109,75,143,0.26)]">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-[70px] -end-[56px] h-[190px] w-[190px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_66%)]"
          />
          {/* Le reflet qui traverse : une seule couche animée en `transform`,
              rien à repeindre. Il s'arrête si le système demande moins de
              mouvement. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -start-[70px] w-[70px] -translate-x-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)] motion-safe:animate-[shimmer_5s_ease-in-out_infinite]"
          />

          <div className="relative">
            <p className="text-[0.875rem] leading-[1.25] font-extrabold tracking-[-0.01em]">
              {t.home.merchantTitle}
            </p>
            <p className="mt-[6px] text-[0.6875rem] leading-[1.5] text-white/80">
              {t.home.merchantBody}
            </p>
          </div>

          <Link
            href="/inscription?role=vendeur"
            className="press relative mt-[14px] flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-[0.71875rem] font-bold text-[var(--color-on-light)]"
          >
            {t.home.merchantCta}
          </Link>
        </div>
      </div>
    </>
  );
}

/**
 * Le titre d'une section, avec sa pastille de couleur.
 *
 * La pastille reprend la règle de teinte des catégories — `oklch(0.47 0.12
 * <teinte>)` — ou une couleur du thème quand la section n'en a pas. C'est
 * assez pour distinguer sept sections empilées sans dessiner sept cadres, et
 * le titre reprend la taille qu'il mérite : quinze pixels, là où onze le
 * faisaient passer pour une légende.
 */
function EnteteSection({
  hue,
  titre,
  children,
}: {
  hue: number | string;
  titre: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-[18px]">
      <span
        aria-hidden
        className="h-[9px] w-[9px] flex-none rounded-full"
        style={{ background: typeof hue === "number" ? `oklch(0.47 0.12 ${hue})` : hue }}
      />
      <h2 className="text-[0.9375rem] leading-none font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
        {titre}
      </h2>
      {children && <div className="ms-auto flex items-center">{children}</div>}
    </div>
  );
}

/**
 * Un service, en chip de deux lignes.
 *
 * Le rond garde la photo quand l'administration en a téléversé une, le
 * monogramme ou l'emoji sinon : un service ajouté ce matin s'affiche
 * correctement avant qu'on lui ait choisi une image.
 */
function ChipService({
  href,
  nom,
  detail,
  imageUrl,
  monogramme,
  emoji,
  hue = 300,
  sombre = false,
}: {
  href: string;
  nom: string;
  detail?: string | null;
  imageUrl?: string | null;
  monogramme?: string;
  emoji?: string;
  hue?: number;
  /** Le Black Friday, qui n'emprunte à aucune teinte de catégorie. */
  sombre?: boolean;
}) {
  return (
    <Link
      href={href}
      className="press flex w-[170px] flex-none items-center gap-[10px] rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-2 pe-[11px] shadow-[0_4px_14px_rgba(60,40,90,0.06)]"
    >
      <span
        aria-hidden
        className={cx(
          "flex h-[42px] w-[42px] flex-none items-center justify-center overflow-hidden rounded-full text-[1.0625rem]",
          sombre
            ? "bg-[linear-gradient(135deg,#0d0b10,#5a3a78)]"
            : imageUrl
              ? "bg-[var(--color-track)]"
              : "cat-surface cat-ink",
        )}
        style={sombre ? undefined : ({ "--hue": hue } as React.CSSProperties)}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            width={42}
            height={42}
            className="fade-in-img h-full w-full object-cover"
          />
        ) : (
          (emoji ?? <span className="text-[0.8125rem] font-bold">{monogramme}</span>)
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
          {nom}
        </span>
        {detail && (
          <span className="mt-[3px] block truncate text-[0.59375rem] font-semibold text-[var(--color-muted)]">
            {detail}
          </span>
        )}
      </span>
    </Link>
  );
}

/* ─── Les catégories de l'accueil ─────────────────────────────────────── */

/**
 * Les photos livrées avec l'application, quand l'administration n'en a pas
 * encore téléversé. Une catégorie sans photo garde son dessin sur fond teinté :
 * elle reste reconnaissable, et rien ne manque à l'écran.
 */
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

function CarteCategorie({
  category,
  nom,
  compte,
}: {
  category: Awaited<ReturnType<typeof getCategories>>[number];
  nom: string;
  compte: string | null;
}) {
  const photo = category.image_url ?? PHOTOS_CATEGORIES[category.slug] ?? null;
  const Dessin = categoryIcon(category.slug);

  return (
    <Link
      href={ANNUAIRES[category.slug] ?? `/marketplace?categorie=${category.slug}`}
      className="press cat-surface relative block aspect-[4/3] overflow-hidden rounded-[20px] shadow-[0_8px_20px_rgba(60,40,90,0.12)]"
      style={{ "--hue": category.hue } as React.CSSProperties}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 31vw, 260px"
          className="fade-in-img object-cover"
        />
      ) : (
        <span aria-hidden className="cat-ink absolute inset-0 flex items-center justify-center pb-5">
          {Dessin ? <Dessin size={54} /> : <span className="text-[1.75rem] font-black">{category.monogram}</span>}
        </span>
      )}

      {/* Le voile : sans lui, un nom blanc sur une photo claire devient illisible. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,14,26,0.82)_0%,rgba(20,14,26,0.25)_48%,rgba(20,14,26,0)_72%)]"
      />

      <span className="absolute inset-x-[10px] bottom-[9px]">
        <span className="block text-[0.84375rem] leading-tight font-extrabold text-white">{nom}</span>
        {compte && (
          <span className="mt-[2px] block text-[0.59375rem] font-semibold text-white/75">{compte}</span>
        )}
      </span>
    </Link>
  );
}
