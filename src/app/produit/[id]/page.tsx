import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatPrice, formatRating, monogram, percentOff } from "@/lib/format";
import { Avatar, Card, Tag } from "@/components/ui/primitives";
import { ProductGallery } from "@/components/products/product-gallery";
import { VariantProvider } from "@/components/products/variant-context";
import { ProductActions, ProductTopBar } from "./product-actions";
import { jsonLd as jsonLdHtml } from "@/lib/json-ld";
import { ProductReviews } from "@/components/products/product-reviews";
import { fullName } from "@/lib/format";
import { lienProduit } from "@/lib/product-url";
import { identifiantProduit } from "./resoudre";

/**
 * Écran 3 — fiche produit.
 * Page publique et indexable : c'est la porte d'entrée depuis Google pour
 * un habitant qui cherche un article précis à Gafsa.
 */

/*
  `revalidate = 300` figurait ici et n'a jamais rien mis en cache : la page lit
  la langue et la session en cookie, ce qui force le rendu dynamique. La
  construction la marquait `ƒ`, comme les autres.

  On le déclare donc franchement. La fiche produit reste la porte d'entrée
  depuis Google et mériterait d'être servie depuis le cache : cela suppose de
  sortir la langue du cookie et le favori du rendu initial — un chantier
  d'architecture, laissé de côté ici.
*/
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const productId = await identifiantProduit(supabase, id);
  if (!productId) return { title: "Produit introuvable" };

  const { data } = await supabase
    .from("products")
    .select("id, name, description, price, images, shop:shops(name)")
    .eq("id", productId)
    .maybeSingle();

  if (!data) return { title: "Produit introuvable" };

  const title = `${data.name} — ${data.shop?.name ?? "Mall Express Gafsa"}`;

  return {
    title,
    description:
      data.description ??
      `${data.name} à ${formatPrice(data.price)} chez ${data.shop?.name ?? "une boutique du mall de Gafsa"}.`,
    /*
      La canonique pointe la forme lisible, jamais celle qu'on a reçue.

      Un même produit est atteignable par son identifiant nu — les anciens liens
      — et par son adresse en toutes lettres. Sans canonique, un moteur de
      recherche voit deux pages identiques et partage le crédit entre elles.
    */
    alternates: { canonical: lienProduit(data) },
    openGraph: {
      title,
      description: data.description ?? undefined,
      images: data.images?.[0] ? [data.images[0]] : undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getT();
  const supabase = await createClient();

  /*
    L'adresse peut être lisible ou porter l'identifiant nu ; les deux mènent
    ici. Un identifiant complet est reconnu sans toucher à la base.
  */
  const productId = await identifiantProduit(supabase, id);
  if (!productId) notFound();

  const { data: product } = await supabase
    .from("products")
    /*
      `*` plutôt qu'une liste de colonnes, et ce n'est pas de la paresse.

      Nommer `variant_images` dans le `select` rend la page tributaire d'une
      migration : tant que la colonne n'existe pas, PostgREST refuse la requête
      entière, `product` vaut `null`, et la fiche répond « introuvable ». Toute
      la boutique tombe pour une colonne facultative — ce qui s'est produit
      exactement, avant que ce commentaire ne soit écrit.

      Avec `*`, la colonne remonte quand elle existe et manque simplement
      sinon. Le code la lit avec un repli, et la fonctionnalité s'active d'elle-
      même une fois la migration passée. Le surcoût est d'une seule ligne lue.
    */
    .select(
      `*,
       shop:shops!inner(id, name, slug, logo_url, phone, mall_level, mall_unit, status, pickup_in_store, rating_sum, rating_count),
       category:categories(hue, name_fr, name_ar)`,
    )
    .eq("id", productId)
    .maybeSingle();

  if (!product || product.shop?.status !== "approved") notFound();

  const user = await getSessionUser();

  let isFavorite = false;
  if (user) {
    const { data } = await supabase
      .from("favorites")
      .select("product_id")
      .match({ user_id: user.id, product_id: id })
      .maybeSingle();
    isFavorite = Boolean(data);
  }

  /*
    Les avis de ce produit, et le droit d'en laisser un.

    Trois lectures, lancées ensemble : la note d'une boutique qui vend cent
    références ne dit rien de l'article qu'on regarde, et c'est pourtant tout ce
    que la fiche affichait.

    Le droit de noter se décide par l'achat — l'action serveur le revérifie de
    toute façon, mais l'écran ne doit pas proposer un bouton dont on sait qu'il
    sera refusé.
  */
  const [avisResultat, achatResultat] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, rating, body, created_at, user_id, auteur:profiles(first_name, last_name)")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(20),

    user
      ? supabase
          .from("order_items")
          .select("id, order:orders!inner(user_id, status)")
          .eq("product_id", productId)
          .eq("order.user_id", user.id)
          .neq("order.status", "cancelled")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const avisBruts = avisResultat.data ?? [];

  const avis = avisBruts.map((a) => ({
    id: a.id,
    rating: a.rating,
    body: a.body,
    created_at: a.created_at,
    auteur: fullName(a.auteur) || t.taxi.aClient,
    sien: user?.id === a.user_id,
  }));

  // `null` et non zéro : « 0 sur 5 » se lit comme une très mauvaise note, alors
  // que personne n'a encore rien dit.
  const moyenne =
    avis.length > 0 ? avis.reduce((somme, a) => somme + a.rating, 0) / avis.length : null;

  const discount = percentOff(product.price, product.compare_at_price);

  const name = locale === "ar" && product.name_ar ? product.name_ar : product.name;
  const description =
    locale === "ar" && product.description_ar ? product.description_ar : product.description;

  // Données structurées : permet à Google d'afficher prix et disponibilité.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images ?? undefined,
    brand: { "@type": "Brand", name: product.shop.name },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "TND",
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: product.shop.name },
    },
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-[var(--color-app)] lg:max-w-[1000px] lg:px-8 lg:py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      {/*
        Le fournisseur enveloppe la fiche entière, pas seulement la galerie.

        La couleur choisie sert à deux endroits éloignés — la galerie en haut,
        les pastilles au-dessus du bouton d'achat. Tout le contenu textuel
        traverse ce fournisseur en `children` et reste rendu côté serveur : le
        titre, le prix et la description sont ce que Google lit sur la page qui
        amène ici, ils ne doivent pas devenir du JavaScript.
      */}
      <VariantProvider
        productId={product.id}
        colors={product.colors ?? []}
        images={product.images ?? []}
        variantImages={product.variant_images ?? {}}
      >
      <main
        id="contenu"
        className="no-sb flex flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:content-start lg:gap-8"
      >
        {/*
          Les commandes flottent sur la photo au lieu de s'aligner au-dessus.

          Une barre pleine largeur volait cinquante pixels de haut à l'image, sur
          l'écran où l'image *est* l'argument de vente. Posées en pastilles
          blanches sur la photo, elles restent visibles sans rien lui prendre.
        */}
        <div className="relative flex-none">
          <ProductGallery alt={product.name} />
          <ProductTopBar
            productId={product.id}
            productName={product.name}
            isFavorite={isFavorite}
          />
          {discount !== null && (
            <span className="absolute start-[14px] top-[56px] rounded-[10px] bg-[var(--color-brand-fill)] px-[9px] py-1 text-[0.59375rem] font-bold text-white">
              −{discount}%
            </span>
          )}
        </div>

        <div className="flex flex-col gap-[13px] p-4 lg:p-0">
          {/* La boutique et sa note, sur une seule ligne : qui vend, et ce que
              les autres en ont pensé. */}
          <div className="flex items-center gap-2">
            <Link
              href={`/boutique/${product.shop.slug}`}
              className="press flex min-w-0 flex-1 items-center gap-[7px]"
            >
              <Avatar
                src={product.shop.logo_url}
                initials={monogram(product.shop.name)}
                size={26}
              />
              <span className="min-w-0">
                <span className="block truncate text-[0.71875rem] font-bold text-[var(--color-ink)]">
                  {product.shop.name}
                </span>
                {product.shop.mall_unit && (
                  <span className="block text-[0.59375rem] text-[var(--color-muted)]">
                    {format(t.product.walkTime, {
                      level: product.shop.mall_level ?? 0,
                      unit: product.shop.mall_unit,
                      min: 3,
                    })}
                  </span>
                )}
              </span>
            </Link>

            {product.shop.rating_count > 0 && (
              <span className="flex flex-none items-center gap-1 rounded-[11px] bg-[var(--color-brand-tint)] px-[9px] py-[5px] text-[0.625rem] font-bold text-[var(--color-brand)]">
                {formatRating(product.shop.rating_sum, product.shop.rating_count)} ★
                <span className="font-semibold text-[var(--color-muted)]">
                  ({product.shop.rating_count})
                </span>
              </span>
            )}
          </div>

          {/* Le nom prend la largeur, le prix reste calé à droite : l'œil trouve
              le montant au même endroit quelle que soit la longueur du titre. */}
          <div className="flex items-start gap-[10px]">
            <h1 className="min-w-0 flex-1 text-[1.1875rem] leading-[1.25] font-bold tracking-[-0.01875rem] text-[var(--color-ink)]">
              {name}
            </h1>
            <div className="flex-none text-end">
              <p className="text-[1.1875rem] font-extrabold whitespace-nowrap text-[var(--color-brand)]">
                {formatPrice(product.price, locale)}
              </p>
              {product.compare_at_price && (
                <p className="text-[0.65625rem] whitespace-nowrap text-[var(--color-faint)] line-through">
                  {formatPrice(product.compare_at_price, locale)}
                </p>
              )}
            </div>
          </div>

          {description && (
            <p className="text-[0.71875rem] leading-[1.6] text-[var(--color-muted)]">
              {description}
            </p>
          )}

          {/* ─── Retrait et stock, côte à côte ───────────────────────── */}
          <div className="flex gap-2">
            {product.shop.mall_unit && (
              <Card className="flex-1 p-[10px_11px]">
                <p className="text-[0.625rem] text-[var(--color-muted)]">{t.cart.pickup}</p>
                <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">
                  {product.shop.mall_unit}
                </p>
              </Card>
            )}
            <Card className="flex-1 p-[10px_11px]">
              <p className="text-[0.625rem] text-[var(--color-muted)]">{t.product.stockLabel}</p>
              <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">
                {product.stock > 0
                  ? format(t.product.inStock, { n: product.stock })
                  : t.product.outOfStock}
              </p>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag tone="tinted" className="px-[11px] py-[6px] text-[0.65625rem]">
              {t.product.cod}
            </Tag>
            {product.shop.phone && (
              <a
                href={`tel:${product.shop.phone}`}
                className="press rounded-[13px] border border-[var(--color-outline)] px-[11px] py-[6px] text-[0.65625rem] font-semibold text-[var(--color-ink)]"
              >
                {t.product.callToOrder}
              </a>
            )}
          </div>

          <ProductReviews
            productId={product.id}
            avis={avis}
            moyenne={moyenne}
            peutNoter={Boolean(achatResultat.data)}
          />

          <ProductActions
            product={{
              id: product.id,
              name: product.name,
              stock: product.stock,
              colors: product.colors ?? [],
              sizes: product.sizes ?? [],
              shopSlug: product.shop.slug,
            }}
          />
        </div>
      </main>
      </VariantProvider>
    </div>
  );
}
