import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/dictionaries";
import { formatPrice, monogram } from "@/lib/format";
import { Avatar, Card, Placeholder, Tag } from "@/components/ui/primitives";
import { ProductActions, ProductTopBar } from "./product-actions";

/**
 * Écran 3 — fiche produit.
 * Page publique et indexable : c'est la porte d'entrée depuis Google pour
 * un habitant qui cherche un article précis à Gafsa.
 */

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("name, description, price, images, shop:shops(name)")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { title: "Produit introuvable" };

  const title = `${data.name} — ${data.shop?.name ?? "Mall Express Gafsa"}`;

  return {
    title,
    description:
      data.description ??
      `${data.name} à ${formatPrice(data.price)} chez ${data.shop?.name ?? "une boutique du mall de Gafsa"}.`,
    alternates: { canonical: `/produit/${id}` },
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

  const { data: product } = await supabase
    .from("products")
    .select(
      `id, name, name_ar, description, description_ar, price, compare_at_price, stock,
       images, colors, sizes, mall_pickup_available, category_id,
       shop:shops!inner(id, name, slug, logo_url, phone, mall_level, mall_unit, status, pickup_in_store),
       category:categories(hue, name_fr, name_ar)`,
    )
    .eq("id", id)
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ProductTopBar productId={product.id} productName={product.name} isFavorite={isFavorite} />

      <main
        id="contenu"
        className="no-sb flex flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:content-start lg:gap-8"
      >
        {product.images?.[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            width={520}
            height={228}
            priority
            className="h-[228px] w-full flex-none object-cover lg:h-[420px] lg:rounded-[18px]"
          />
        ) : (
          <Placeholder
            label="photo produit — pleine largeur"
            className="h-[228px] w-full flex-none lg:h-[420px] lg:rounded-[18px]"
          />
        )}

        <div className="flex flex-col gap-[10px] p-4 lg:p-0">
          <Link
            href={`/boutique/${product.shop.slug}`}
            className="flex items-center gap-[6px] text-[11px] font-semibold text-[var(--color-brand)]"
          >
            <Avatar src={product.shop.logo_url} initials={monogram(product.shop.name)} size={16} />
            {product.shop.name}
          </Link>

          <h1 className="text-[20px] font-semibold text-[var(--color-ink)]">{name}</h1>

          <p className="text-[18px] font-bold text-[var(--color-brand)]">
            {formatPrice(product.price, locale)}
            {product.compare_at_price && (
              <span className="ms-[6px] text-[13px] font-normal text-[var(--color-faint)] line-through">
                {formatPrice(product.compare_at_price, locale)}
              </span>
            )}
          </p>

          {description && (
            <p className="text-[12px] leading-[1.6] text-[var(--color-muted)]">{description}</p>
          )}

          {/* ─── Encart d'emplacement ────────────────────────────────── */}
          {product.shop.mall_unit && (
            <Card className="flex items-center gap-[10px] p-[10px_12px]">
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[12px] font-bold text-[var(--color-brand)]">
                {product.shop.mall_unit}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-bold text-[var(--color-ink)]">
                  {format(t.product.walkTime, {
                    level: product.shop.mall_level ?? 0,
                    unit: product.shop.mall_unit,
                    min: 3,
                  })}
                </p>
                <p className="text-[10.5px] text-[var(--color-muted)]">
                  {product.stock > 0
                    ? format(t.product.inStock, { n: product.stock })
                    : t.product.outOfStock}
                </p>
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Tag tone="tinted" className="px-[11px] py-[6px] text-[10.5px]">
              {t.product.cod}
            </Tag>
            {product.shop.phone && (
              <a
                href={`tel:${product.shop.phone}`}
                className="rounded-[13px] border border-[var(--color-outline)] px-[11px] py-[6px] text-[10.5px] font-semibold text-[var(--color-ink)]"
              >
                {t.product.callToOrder}
              </a>
            )}
          </div>

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
    </div>
  );
}
