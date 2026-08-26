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
import { NotifyLiveButton } from "@/components/live/notify-live-button";
import { ProductCard } from "@/components/cards/product-card";
import { ImageZoom } from "@/components/ui/image-zoom";
import { SponsoredCarousel, type SponsoredSlot } from "@/components/home/sponsored-carousel";
import { Avatar, Card, CategoryTile, Placeholder, Rail, SectionTitle } from "@/components/ui/primitives";
import { BellIcon, CartIcon, LiveDot } from "@/components/ui/icons";
import type { PracticalService } from "@/types/database";
import { lienProduit } from "@/lib/product-url";

export const metadata: Metadata = {
  title: "Mall Express Gafsa — boutiques, marketplace et services",
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
  const highlights = (featured.length > 0 ? featured : allProducts).slice(0, 3);

  const next = status.nextLive;
  const minutesToLive = next?.scheduled_at
    ? Math.max(0, Math.round((new Date(next.scheduled_at).getTime() - Date.now()) / 60_000))
    : null;

  const discount = promo.data ? percentOff(promo.data.price, promo.data.compare_at_price) : null;

  return (
    <>
      {/*
        On salue la personne avant de nommer l'application.

        « Mall Express Gafsa » en gros titre occupait le tiers supérieur de
        l'écran pour dire ce que l'icône de l'application dit déjà. La salutation
        et le nombre de boutiques ouvertes, eux, disent quelque chose de
        nouveau : à qui l'on parle, et s'il se passe quelque chose maintenant.

        Les deux pastilles rondes reprennent les deux seules destinations qu'on
        cherche depuis l'accueil. La messagerie quitte cette barre : elle vit
        dans le profil, et trois icônes côte à côte se ressemblaient trop pour
        qu'on les distingue d'un coup d'œil.
      */}
      <header className="flex flex-none items-start gap-3 px-[18px] pt-[14px] pb-[2px]">
        <div className="min-w-0 flex-1">
          <p className="text-[0.5625rem] font-extrabold tracking-[0.08125rem] text-[var(--color-muted)]">
            {t.marketplace.eyebrow}
          </p>
          <h1 className="mt-[2px] truncate text-[1.5rem] leading-[1.14] font-extrabold tracking-[-0.04375rem] text-[var(--color-ink)]">
            {profile?.first_name
              ? format(t.home.greeting, { name: profile.first_name })
              : t.home.greetingAnon}
          </h1>
          {/* Aucune boutique ouverte ne veut pas dire qu'il n'y a rien à voir :
              on annonce alors le catalogue plutôt qu'un zéro. */}
          <p className="truncate text-[0.71875rem] text-[var(--color-muted)]">
            {status.anyOpen
              ? format(t.home.activeShops, { n: status.openCount })
              : format(t.marketplace.allShops, { n: status.totalCount })}
          </p>
        </div>

        <div className="flex flex-none gap-2">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="press relative flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[var(--color-surface-solid)] text-[var(--color-ink)] shadow-[0_6px_16px_rgba(60,40,90,0.09)]"
          >
            <BellIcon size={17} />
            {counts.notifications > 0 && (
              <span className="absolute -top-[1px] -end-[1px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--color-brand-fill)] px-1 text-[0.53125rem] font-bold text-white">
                {counts.notifications > 99 ? "99+" : counts.notifications}
              </span>
            )}
          </Link>

          <Link
            href="/panier"
            aria-label={t.cart.title}
            className="press relative flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-white shadow-[0_8px_18px_rgba(109,75,143,0.28)]"
          >
            <CartIcon size={17} />
            {counts.cart > 0 && (
              <span className="absolute -top-[1px] -end-[1px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--color-surface-solid)] px-1 text-[0.53125rem] font-extrabold text-[var(--color-brand)] shadow-[0_2px_6px_rgba(60,40,90,0.18)]">
                {counts.cart > 99 ? "99+" : counts.cart}
              </span>
            )}
          </Link>
        </div>
      </header>

      <SearchBar />

      <div className="no-sb flex flex-1 flex-col gap-[18px] overflow-y-auto pt-3 pb-4">
        <AccessibilityBar />

        {/* ─── Bandeau contextuel ─────────────────────────────────────── */}
        <Card className="mx-4 flex flex-none items-center gap-[10px] p-[11px_13px]">
          <LiveDot size={8} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
              {format(status.anyOpen ? t.home.contextOpen : t.home.contextClosed, {
                n: status.anyOpen ? status.openCount : status.totalCount,
              })}
            </p>
            <p className="truncate text-[0.65625rem] text-[var(--color-muted)]">
              {next && minutesToLive !== null
                ? format(t.home.nextLive, { shop: next.shop?.name ?? "", min: minutesToLive })
                : t.home.noLive}
            </p>
          </div>
          {next && <NotifyLiveButton liveId={next.id} />}
        </Card>

        {/*
          ─── 1 · Sponsorisé ──────────────────────────────────────────

          Une bannière pleine largeur que l'on fait glisser du doigt, et non
          plus une vignette de 96 pixels avec titre, sous-titre et cadre. Un
          annonceur qui paie une mise en avant n'achète pas une fiche de plus
          dans une liste : il achète une image qu'on regarde.
        */}
        <SponsoredCarousel slots={(sponsored.data ?? []) as SponsoredSlot[]} />

        {/*
          ─── 2 · En direct maintenant, ou la sélection ─────────────────

          L'une ou l'autre, jamais les deux. Un direct est un rendez-vous : tant
          qu'il en existe un, rien ne doit lui disputer cette place. Le reste du
          temps — c'est-à-dire presque toujours — la place revient à ce que les
          boutiques mises en avant ont à vendre.
        */}
        {!anyLive && highlights.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle className="px-4">{t.home.featured}</SectionTitle>

            {/*
              Un rail que l'on fait glisser, et plus de « Tout voir ».

              Une rangée qui déborde de l'écran se comprend sans qu'on
              l'explique : c'est le geste que tout le monde connaît. Le lien
              qu'on remplace ne servait qu'à réparer une grille de trois
              vignettes qui n'en montrait que trois.
            */}
            <Rail gap={10} className="px-4">
              {highlights.map((product, i) => (
                /*
                  Arrivée décalée de soixante millisecondes par carte. Assez pour
                  que l'œil suive la rangée de gauche à droite, trop peu pour
                  qu'on attende la dernière — au-delà de trois ou quatre cartes,
                  un décalage devient une file d'attente.
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
          Les boutiques, toujours là — en direct ou non.

          Ce rail ne s'affichait que pendant un direct, c'est-à-dire presque
          jamais : un commerçant diffuse une heure par semaine. Le reste du
          temps, l'accueil ne montrait aucun visage de commerce, alors que ce
          sont eux qu'on vient voir. Il devient « Nos partenaires » hors
          diffusion, et reprend son titre de direct dès qu'une boutique est à
          l'antenne — les mêmes pastilles, le même geste, un seul mot qui change.
        */}
        {withLiveFirst.length > 0 && (
          <section className="flex flex-col gap-2 px-4">
            <SectionTitle>{anyLive ? t.home.liveNow : t.home.partners}</SectionTitle>
            <Rail gap={14}>
              {withLiveFirst.map((shop) => {
                const live = shop.lives?.find((l) => l.status === "live");
                return (
                  <Link
                    key={shop.id}
                    href={live ? `/lives/${live.id}` : `/boutique/${shop.slug}`}
                    className="relative flex flex-none flex-col items-center gap-[5px]"
                  >
                    <span
                      className={
                        live
                          ? "flex h-[58px] w-[58px] items-center justify-center rounded-full border-2 border-[var(--color-live)] text-[0.625rem] font-bold text-[var(--color-brand)]"
                          : "flex h-[58px] w-[58px] items-center justify-center rounded-full border-[1.5px] border-[var(--color-track)] text-[0.625rem] font-bold text-[var(--color-muted)]"
                      }
                    >
                      {shop.logo_url ? (
                        <Image
                          src={shop.logo_url}
                          alt=""
                          width={54}
                          height={54}
                          className="h-[54px] w-[54px] rounded-full object-cover"
                        />
                      ) : (
                        monogram(shop.name)
                      )}
                    </span>
                    {live && (
                      <span className="absolute bottom-4 start-1/2 -translate-x-1/2 rounded-[3px] bg-[var(--color-live-fill)] px-[5px] py-[1px] text-[0.4375rem] font-bold text-white rtl:translate-x-1/2">
                        LIVE
                      </span>
                    )}
                    <span className="max-w-[64px] truncate text-[0.625rem] text-[var(--color-muted)]">
                      {shop.name}
                    </span>
                  </Link>
                );
              })}
            </Rail>
          </section>
        )}

        {/* ─── 3 · Promotions du moment ───────────────────────────────── */}
        {(promo.data || (shopPromos.data ?? []).length > 0) && (
          <section className="flex flex-col gap-2 px-4">
            <SectionTitle>{t.home.promos}</SectionTitle>

            {/*
              Les remises de boutique, en tête et sur un rail.

              Elles portent sur un commerce entier, là où la carte qui suit
              porte sur un seul article : les présenter dans le même format
              laisserait croire à un produit en promotion, et le client
              chercherait un prix qui n'existe pas. D'où une tuile compacte qui
              nomme la boutique et mène à sa page, où la remise est détaillée.
            */}
            {(shopPromos.data ?? []).length > 0 && (
              <Rail gap={10}>
                {(shopPromos.data ?? []).map((offer) => (
                  <Link
                    key={offer.id}
                    href={`/boutique/${offer.shop?.slug}`}
                    className="flex w-[196px] flex-none items-center gap-[10px] rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-[10px] shadow-[var(--shadow-card)]"
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
                    <span className="flex-none rounded-[10px] bg-[var(--color-live-fill)] px-2 py-[3px] text-[0.59375rem] font-bold text-white">
                      −{offer.percent_off}%
                    </span>
                  </Link>
                ))}
              </Rail>
            )}

            {/*
              L'article en promotion prend toute la place, et ses repères
              passent sur la photo.

              La carte les empilait sous l'image : logo, nom, remise, titre,
              prix — cinq lignes de texte pour un seul article, et l'image
              réduite à une bande de cent-cinquante pixels. La photo occupe
              désormais cent-soixante-huit pixels dans un cadre à gros rayon, et
              porte ce qui la qualifie : qui vend, et de combien on économise.

              L'ensemble reste un lien vers la fiche ; seule la photo dérive vers
              l'agrandissement, comme partout ailleurs dans l'application.
            */}
            {promo.data && (
              <div className="rounded-[26px] bg-[var(--color-surface-solid)] p-2 shadow-[0_12px_30px_rgba(60,40,90,0.1)]">
                <div className="relative overflow-hidden rounded-[20px] bg-[var(--color-track)]">
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
                    className="press absolute start-3 top-3 flex max-w-[70%] items-center gap-[6px] rounded-[14px] bg-[var(--color-surface-solid)]/96 py-1 pe-[9px] ps-1 shadow-[0_4px_10px_rgba(60,40,90,0.14)]"
                  >
                    <Avatar
                      src={promo.data.shop?.logo_url}
                      initials={monogram(promo.data.shop?.name)}
                      size={20}
                    />
                    <span className="truncate text-[0.59375rem] font-bold text-[var(--color-ink)]">
                      {promo.data.shop?.name}
                    </span>
                  </Link>

                  {discount !== null && (
                    <span className="absolute start-3 bottom-3 rounded-[10px] bg-[var(--color-brand-fill)] px-[9px] py-1 text-[0.5625rem] font-extrabold text-white">
                      −{discount}%
                    </span>
                  )}
                </div>

                <Link href={lienProduit(promo.data)} className="block px-2 pt-3 pb-1">
                  <p className="text-[1rem] leading-[1.25] font-extrabold tracking-[-0.01875rem] text-[var(--color-ink)]">
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
                  <p className="mt-[9px] flex items-baseline gap-2 text-[0.8125rem] font-extrabold text-[var(--color-brand)]">
                    {formatPrice(promo.data.price, locale)}
                    {promo.data.compare_at_price && (
                      <span className="text-[0.65625rem] font-normal text-[var(--color-faint)] line-through">
                        {formatPrice(promo.data.compare_at_price, locale)}
                      </span>
                    )}
                    <span className="ms-auto text-[0.65625rem] font-extrabold whitespace-nowrap text-[var(--color-brand)]">
                      {t.product.seeShop}
                    </span>
                  </p>
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ─── 4 · Catégories ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-[10px]">
          <SectionTitle className="px-4">{t.home.categories}</SectionTitle>
          {/*
            Toutes les catégories sur un rail, et plus de tuile « Plus ».

            La grille n'en montrait que sept sur douze, et renvoyait le reste
            derrière un bouton. Faire glisser la rangée les donne toutes, sans
            détour ni page intermédiaire.
          */}
          <Rail gap={12} className="px-4">
            {categories.map((category) => (
              <div key={category.id} className="w-[74px] flex-none">
                <CategoryTile
                  hue={category.hue}
                  monogram={category.monogram}
                  slug={category.slug}
                  imageUrl={category.image_url}
                  size={66}
                  radius={22}
                  label={locale === "ar" ? category.name_ar : category.name_fr}
                  /* Le compte seulement s'il y a quelque chose à compter :
                     « 0 boutiques » sous chaque tuile décourage sans informer,
                     et une catégorie sans boutique attribuée n'est pas vide pour
                     autant — ses produits, eux, sont bien là. */
                  caption={
                    shopCount[category.id]
                      ? format(t.home.shopCount, { n: shopCount[category.id] })
                      : undefined
                  }
                  href={`/marketplace?categorie=${category.slug}`}
                />
              </div>
            ))}
          </Rail>
        </section>

        {/* ─── 5 · Services pratiques ─────────────────────────────────── */}
        {serviceTiles.length > 0 && (
          <section className="flex flex-col gap-2 px-4">
            <SectionTitle>{t.home.practicalServices}</SectionTitle>
            {/*
              Des pastilles rondes plutôt que des fiches encadrées.

              Un service n'est pas un produit : il n'a ni prix ni photo de
              vitrine, et l'encadrer comme une carte le faisait ressembler à une
              offre. Le rond, lui, se lit comme un raccourci — la forme que
              prennent partout les contacts et les destinations.

              La photo quand elle existe, le monogramme sinon : un service ajouté
              depuis l'administration s'affiche correctement avant qu'on lui ait
              choisi une image.
            */}
            <Rail gap={16} className="py-[2px]">
              {serviceTiles.map((service) => (
                <Link
                  key={service.id}
                  href={`/services#${service.kind}`}
                  className="press flex w-[76px] flex-none flex-col items-center gap-[7px]"
                >
                  <span
                    className={cx(
                      "flex h-[58px] w-[58px] flex-none items-center justify-center overflow-hidden rounded-full text-[0.9375rem] font-semibold tracking-[0.03125rem]",
                      service.image_url
                        ? "bg-[var(--color-track)] shadow-[0_8px_18px_rgba(60,40,90,0.10)]"
                        : "cat-surface cat-ink",
                    )}
                    style={{ "--hue": service.hue } as React.CSSProperties}
                    aria-hidden
                  >
                    {service.image_url ? (
                      /* Même raison que les tuiles de catégorie : le fichier
                         source fait 480 px, la pastille 58. */
                      <Image
                        src={service.image_url}
                        alt=""
                        width={58}
                        height={58}
                        className="fade-in-img h-full w-full object-cover"
                      />
                    ) : (
                      service.monogram
                    )}
                  </span>
                  <span className="flex flex-col items-center gap-[1px] text-center">
                    <span className="text-[0.65625rem] leading-tight font-bold text-[var(--color-ink)]">
                      {locale === "ar" && service.name_ar ? service.name_ar : service.name}
                    </span>
                    {service.info && (
                      <span className="line-clamp-1 text-[0.53125rem] leading-tight font-semibold text-[var(--color-faint)]">
                        {service.info}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </Rail>
          </section>
        )}

        {/* ─── 6 · Invitation commerçants ─────────────────────────────── */}
        <div className="mx-4 flex flex-none items-center gap-3 rounded-[18px] bg-[image:var(--gradient-brand)] p-[14px] text-white">
          <div className="min-w-0 flex-1">
            <p className="text-[0.78125rem] font-bold">{t.home.merchantTitle}</p>
            <p className="text-[0.65625rem] leading-[1.45] opacity-85">{t.home.merchantBody}</p>
          </div>
          <Link
            href="/inscription?role=vendeur"
            className="flex-none whitespace-nowrap rounded-[13px] bg-white px-3 py-[7px] text-[0.65625rem] font-bold text-[var(--color-on-light)]"
          >
            {t.home.merchantCta}
          </Link>
        </div>
      </div>
    </>
  );
}
