import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { LiveRoom } from "@/components/live/live-room";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("lives")
    .select("title, status, shop:shops(name), live_products(product:products(name, price, images))")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { title: "Direct", robots: { index: false, follow: true } };

  const title = `${data.title} — ${data.shop?.name}`;

  /*
    L'aperçu du lien quand il est partagé, sur Facebook ou ailleurs.

    Un direct se partage vers des gens qui sont déjà sur un réseau social : sans
    image ni description, le lien s'affiche en texte nu et personne ne le suit.
    On met donc en avant ce qui donne envie — la boutique, l'état du direct, et
    les articles présentés avec leurs prix.

    L'image est celle du premier article : c'est la seule vignette dont nous
    disposons à coup sûr, la vidéo n'ayant pas d'image d'aperçu côté serveur.
  */
  const articles = (data.live_products ?? [])
    .map((row) => row.product)
    .filter((product) => product !== null);

  const cover = articles.find((product) => product.images?.[0])?.images?.[0];

  const description =
    articles.length > 0
      ? `${data.status === "live" ? "En direct" : "Direct"} chez ${data.shop?.name} · ${articles
          .slice(0, 4)
          .map((product) => product.name)
          .join(", ")}`
      : `${data.status === "live" ? "En direct" : "Direct"} chez ${data.shop?.name} — vente en direct sur Mall Express Gafsa.`;

  return {
    title,
    description,
    robots: { index: false, follow: true }, // un direct est éphémère
    openGraph: {
      title,
      description,
      type: "video.other",
      siteName: "Mall Express Gafsa",
      images: cover ? [{ url: cover }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: live }, profile] = await Promise.all([
    supabase
      .from("lives")
      .select(
        `id, title, status, source, facebook_url, hls_url, live_percent_off, offer_ends_at,
         viewers_count, likes_count, purchases_count, pinned_product_id,
         shop:shops!inner(id, name, slug)`,
      )
      .eq("id", id)
      .maybeSingle(),
    getProfile(),
  ]);

  if (!live) notFound();

  const [pinned, comments, liveProducts, liked, cartCount] = await Promise.all([
    live.pinned_product_id
      ? supabase
          .from("products")
          .select("id, name, price, images, stock")
          .eq("id", live.pinned_product_id)
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null),

    supabase
      .from("live_comments")
      .select("id, body, created_at, author:profiles(first_name, last_name)")
      .eq("live_id", id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => (data ?? []).reverse()),

    supabase
      .from("live_products")
      .select("position, product:products(id, name, price, images, stock, is_online, is_draft)")
      .eq("live_id", id)
      .order("position")
      .then(({ data }) =>
        (data ?? [])
          .map((row) => row.product)
          .filter((product) => product && product.is_online && !product.is_draft)
          .map((product) => ({
            id: product!.id,
            name: product!.name,
            price: product!.price,
            images: product!.images,
            stock: product!.stock,
          })),
      ),

    profile
      ? supabase
          .from("live_likes")
          .select("live_id")
          .match({ live_id: id, user_id: profile.id })
          .maybeSingle()
          .then(({ data }) => Boolean(data))
      : Promise.resolve(false),
    profile
      ? supabase
          .from("cart_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .then(({ count }) => count ?? 0)
      : Promise.resolve(0),
  ]);

  return (
    <LiveRoom
      live={live}
      pinnedProduct={pinned}
      initialComments={comments}
      viewerId={profile?.id ?? null}
      liveProducts={liveProducts}
      initialCartCount={cartCount}
      initiallyLiked={liked}
      contactPhone={profile?.phone ?? ""}
    />
  );
}
