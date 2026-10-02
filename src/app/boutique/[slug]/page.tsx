import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, createStaticClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser, getTopBarCounts } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { formatRating } from "@/lib/format";
import { avecBlackFriday } from "@/lib/black-friday-server";
import { BackButton } from "@/components/shell/back";
import { ShopTabs } from "./shop-client";
import { jsonLd as jsonLdHtml } from "@/lib/json-ld";
import { reglesModeSombreTheme, resolveTheme, variablesTheme } from "@/lib/boutique-themes";
import { lireAttributsProduits, lireMatieresProduits, lirePacksBoutique, lireZonesLivraison } from "@/lib/boutique-themes/attributs-server";
import { BoutiqueEnTete } from "@/components/boutique/boutique-entete";
import { BoutiqueContenu } from "@/components/boutique/boutique-contenu";
import { BoutiquePanierFlottant } from "@/components/boutique/boutique-panier-flottant";

/**
 * Écran 6 — profil boutique, vue client.
 * Page publique indexable : c'est la vitrine en ligne du commerçant.
 *
 * Cette page ne fait plus que récupérer les données et composer trois
 * morceaux (`BoutiqueEnTete`, `BoutiqueContenu`, `BoutiquePanierFlottant`) —
 * une extraction pure, sans le moindre changement de classe ni de structure :
 * voir le commit qui l'a introduite pour la comparaison avant/après.
 */

export const revalidate = 300;

export async function generateStaticParams() {
  // Pré-rend les boutiques approuvées au build ; les nouvelles arrivent par
  // ISR à leur première visite. Client sans cookie : on est hors requête.
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("shops")
      .select("slug")
      .eq("status", "approved")
      .order("followers_count", { ascending: false })
      .limit(50);

    return (data ?? []).map(({ slug }) => ({ slug }));
  } catch {
    // Base injoignable au build : tout passera par l'ISR à la demande.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("shops")
    .select("name, description, cover_url, mall_level, mall_unit")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (!data) return { title: "Boutique introuvable" };

  const place = data.mall_unit ? ` — Niveau ${data.mall_level}, local ${data.mall_unit}` : "";

  return {
    title: `${data.name} — Mall de Gafsa`,
    description:
      data.description ?? `${data.name}${place}. Découvrez ses produits sur G-Mall.`,
    alternates: { canonical: `/boutique/${slug}` },
    openGraph: {
      title: data.name,
      description: data.description ?? undefined,
      /*
        Plus d image ici : opengraph-image.tsx, a cote, fabrique la carte de
        partage. Une cle images declaree ici, meme a undefined, empechait
        l image du fichier d apparaitre : la boutique partagee arrivait sans
        aucun apercu, quand la fiche produit - sans cette cle - en avait un.
      */
    },
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onglet?: string; sous?: string }>;
}) {
  const { slug } = await params;
  const { onglet = "products", sous } = await searchParams;
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select(
      `id, name, name_ar, description, description_ar, slug, logo_url, cover_url, banner_url,
       mall_level, mall_unit, phone, is_open_now, rating_sum, rating_count, address,
       is_partner, partner_tagline, partner_tagline_ar, accepts_reservations,
       followers_count, posts_count, views_count, status, latitude, longitude,
       category:categories!shops_category_id_fkey(name_fr, name_ar, hue, slug)`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!shop || shop.status !== "approved") notFound();

  const user = await getSessionUser();
  // Le nom et le numéro déjà connus, pour ne pas les faire ressaisir.
  const profile = user ? await getProfile() : null;

  // Le propriétaire regarde sa propre vitrine : on lui offre le chemin du
  // retour vers son espace, où il poursuit ses réglages.
  const estProprietaire = user
    ? Boolean(
        (
          await supabase
            .from("shops")
            .select("id")
            .eq("id", shop.id)
            .eq("owner_id", user.id)
            .maybeSingle()
        ).data,
      )
    : false;

  const [products, promo, promotions, hoursToday, subCategories, following, lives, counts, roue] =
    await Promise.all([
    /*
      `sizes` et la catégorie complète (pas seulement `hue`) ne servaient à
      rien avant la mise en page Mode : elle regroupe les produits par leur
      propre sous-catégorie réelle (femme/homme/enfant/chaussures/
      accessoires, toutes sœurs sous « mode ») et filtre par taille — sur
      des données déjà saisies par le commerçant, jamais inventées.
    */
    supabase
      .from("products")
      .select(
        "id, name, price, compare_at_price, images, stock, sizes, colors, created_at, category:categories(hue, slug, name_fr, name_ar)",
      )
      .eq("shop_id", shop.id)
      .eq("is_online", true)
      .eq("is_draft", false)
      .order("sold_count", { ascending: false })
      .limit(24),

    supabase
      .from("promotions")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .gte("ends_at", new Date().toISOString())
      .order("percent_off", { ascending: false })
      .limit(1)
      .maybeSingle(),

    /*
      L'onglet Promos affiche toutes les offres en cours de la boutique, pas
      seulement la plus forte remise mise en avant dans le bandeau ci-dessus.
    */
    supabase
      .from("promotions")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .gte("ends_at", new Date().toISOString())
      .order("percent_off", { ascending: false })
      .limit(20),

    supabase
      .from("shop_hours")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("weekday", (new Date().getDay() + 6) % 7)
      .maybeSingle(),

    supabase
      .from("shop_categories")
      .select("category:categories(id, slug, name_fr, name_ar, hue)")
      .eq("shop_id", shop.id),

    user
      ? supabase
          .from("shop_follows")
          .select("shop_id")
          .match({ user_id: user.id, shop_id: shop.id })
          .maybeSingle()
          .then(({ data }) => Boolean(data))
      : Promise.resolve(false),

    supabase
      .from("lives")
      .select("id, title, status, scheduled_at")
      .eq("shop_id", shop.id)
      .in("status", ["live", "scheduled"])
      .order("scheduled_at")
      .limit(5),

    getTopBarCounts(),

    /*
      La roue de la boutique, si elle en a une.

      La policy de lecture n'en rend une que si elle est ouverte — active,
      dans sa fenêtre, boutique approuvée — ou si c'est le commerçant qui
      regarde. Il n'y a donc rien à filtrer ici, et rien à oublier.
    */
    supabase
      .from("shop_wheels")
      .select("id, title, title_ar, is_active")
      .eq("shop_id", shop.id)
      .maybeSingle(),
  ]);

  /* Les cases sans leurs poids ni leurs stocks : la fonction les retire. */
  const casesRoue = roue.data
    ? ((await supabase.rpc("roue_lots_publics", { p_wheel: roue.data.id })).data ?? [])
    : [];

  const rating = formatRating(shop.rating_sum, shop.rating_count);

  /*
    L'image du haut : la bannière des réglages d'abord.

    Le commerçant modifie `banner_url` dans ses réglages ; cette page lisait
    `cover_url`, remplie une seule fois à la création. Sa nouvelle bannière
    n'apparaissait donc jamais : il la changeait, revenait, et retrouvait
    l'ancienne image. Les deux colonnes restent, la plus récemment choisie
    l'emporte.
  */
  const enTete = shop.banner_url ?? shop.cover_url;

  /*
    L'ambiance visuelle vient de la catégorie principale de la boutique, pas
    de la boutique elle-même : deux salons de coiffure partagent le même
    thème « Beauté », chacun avec son propre nom, son logo et ses photos.
    Voir `src/lib/boutique-themes.ts` pour la liste des thèmes et leur
    origine — aucune catégorie n'y est inventée.
  */
  const theme = resolveTheme(shop.category?.slug);
  const reglesSombre = reglesModeSombreTheme(theme);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    description: shop.description ?? undefined,
    image: enTete ?? undefined,
    telephone: shop.phone ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Gafsa",
      addressCountry: "TN",
      streetAddress: shop.mall_unit ? `Niveau ${shop.mall_level}, local ${shop.mall_unit}` : undefined,
    },
    ...(shop.rating_count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount: shop.rating_count,
      },
    }),
  };

  const lus = sous
    ? (products.data ?? []).filter(() => true) // filtrage sous-catégorie côté client-tabs
    : (products.data ?? []);

  /*
    Le prix Black Friday, lu avec le client anonyme : cette page est mise en
    cache cinq minutes, et le client de session la rendrait dynamique. La
    carte revérifie la fenêtre à l'affichage — une page servie depuis le cache
    après 00:01 le samedi ne montre donc pas une offre terminée.
  */
  const visible = await avecBlackFriday(lus, createStaticClient());

  /*
    Les attributs sont lus pour tout le monde — une seule requête indexée
    sur `product_id`, bon marché même quand la mise en page du thème ne les
    affiche pas. Un allowlist par `productLayout` a déjà fait oublier deux
    fois une valeur (Parapharmacie, puis Mode) le jour où une mise en page
    en a eu besoin après coup ; plus simple et plus sûr de ne plus en tenir.
    Matières et packs restent ciblés : eux seuls ont un vrai coût (table ou
    jointure à part) et ne servent qu'à Bijouterie/Parapharmacie.
  */
  const idsProduitsVisibles = visible.map((p) => p.id);
  const [attributsParProduit, matieresParProduit, packs, zones] = await Promise.all([
    lireAttributsProduits(supabase, idsProduitsVisibles),
    theme.id === "bijouterie" ? lireMatieresProduits(supabase, idsProduitsVisibles) : Promise.resolve(new Map<string, string[]>()),
    theme.id === "parapharmacie" ? lirePacksBoutique(supabase, shop.id) : Promise.resolve([]),
    theme.id === "services" ? lireZonesLivraison(supabase, shop.id) : Promise.resolve([]),
  ]);

  const visibleEnrichi = visible.map((p) => ({
    ...p,
    attributs: attributsParProduit.get(p.id),
    materiaux: matieresParProduit.get(p.id),
  }));

  return (
    /*
      Deux niveaux, pas un seul : le fond du thème doit couvrir toute la
      largeur de l'écran, marges latérales comprises — sur un moniteur large,
      le contenu reste borné à 1120px, mais le lavande générique de
      `<body>` ne doit plus se voir de part et d'autre d'une boutique
      « Alimentation ». Le niveau extérieur porte donc le fond et
      `data-theme` (pour le mode sombre, voir `reglesModeSombreTheme`), le
      niveau intérieur garde exactement la mise en page d'avant.
    */
    <div
      className="min-h-dvh w-full bg-[var(--theme-fond,var(--color-app))]"
      style={variablesTheme(theme)}
      data-theme={theme.id}
    >
      {reglesSombre && <style dangerouslySetInnerHTML={{ __html: reglesSombre }} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col lg:max-w-[1120px] lg:px-8 lg:py-6">

      <main id="contenu" className="no-sb relative flex flex-1 flex-col overflow-y-auto">
        {estProprietaire && (
          <Link
            href="/vendeur"
            className="sticky top-0 z-30 flex flex-none flex-col items-center gap-[2px] bg-[var(--color-brand)] px-4 py-[9px] text-center text-white"
          >
            <span className="text-[0.75rem] font-bold">{t.preparation.backToSpace}</span>
            <span className="text-[0.625rem] text-white/80">{t.preparation.ownerPreview}</span>
          </Link>
        )}

        {/*
          Une porte de sortie sur la vitrine.

          Cette page n'avait aucune flèche de retour : un visiteur arrivé par un
          lien partagé n'avait que le bouton du navigateur, qui le renvoyait hors
          du site ou sur la page de présentation. La flèche flotte au-dessus de la
          photo de couverture, faute de barre supérieure sur cet écran.
        */}
        {/*
          Le cercle reste blanc translucide, quel que soit le thème : c'est
          ce qui le rend lisible sur n'importe quelle photo de couverture,
          claire ou sombre. Seule la flèche prend la couleur du thème
          (`--theme-accent-fort`) — assez pour se sentir « à sa place » sans
          jouer le contraste du bouton contre une photo qu'on ne maîtrise pas.
        */}
        <div className="absolute z-20 p-3">
          <BackButton
            fallback={estProprietaire ? "/vendeur" : "/marketplace"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.88)] text-[var(--theme-accent-sur-clair,var(--color-ink))] shadow-[0_2px_8px_rgba(30,20,45,0.25)] backdrop-blur-sm"
          />
        </div>

        <BoutiqueEnTete
          shop={shop}
          theme={theme}
          enTete={enTete}
          rating={rating}
          hoursCloseAt={hoursToday.data?.closes_at}
          locale={locale}
          t={t}
          following={following}
          reservationDefaults={{
            fullName: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
            phone: profile?.phone ?? "",
          }}
        />

        <ShopTabs active={onglet} slug={shop.slug} liveCount={(lives.data ?? []).length} />

        <BoutiqueContenu
          onglet={onglet}
          subCategories={subCategories.data ?? []}
          promo={promo.data}
          promotions={promotions.data ?? []}
          roue={roue.data}
          casesRoue={casesRoue}
          lives={lives.data ?? []}
          visible={visibleEnrichi}
          packs={packs}
          zones={zones}
          shopId={shop.id}
          shopSlug={shop.slug}
          shopAddress={shop.address}
          couverture={enTete}
          locale={locale}
          t={t}
          userConnecte={Boolean(user)}
          theme={theme}
        />

        <BoutiquePanierFlottant count={counts.cart} label={t.cart.title} />
      </main>
      </div>
    </div>
  );
}
