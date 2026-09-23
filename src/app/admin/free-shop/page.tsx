import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { FreeShopModeration, type PublicationAModerer } from "./free-shop-client";

export const metadata: Metadata = {
  title: "G-Shop",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * La modération du G-Shop.
 *
 * Toute publication d'un membre attend ici avant d'être publique. Le tri par
 * défaut montre les publications en attente, les plus anciennes d'abord :
 * celle qui attend depuis trois jours passe avant celle de ce matin, sans quoi
 * une file se creuse par le bas et n'est jamais vidée.
 *
 * Les décisions ne sont pas prises par un `update` mais par `freeshop_moderer`,
 * qui pose la décision, sa date, son auteur et son motif d'un seul geste — et
 * refuse un refus sans motif. Un membre à qui l'on dit « refusé » sans rien
 * d'autre republie la même chose le lendemain.
 */
export default async function AdminFreeShopPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data } = await supabase
    .from("deals")
    .select(
      `id, title, body, body_ar, images, price, phone, whatsapp, location_label,
       status, moderation, rejection_reason, created_at, expires_at,
       author:profiles!deals_author_id_fkey(id, first_name, last_name, phone),
       category:categories!deals_category_id_fkey(name_fr, name_ar, hue),
       shop:shops!deals_shop_id_fkey(name, slug)`,
    )
    .order("created_at", { ascending: true })
    .limit(300);

  const publications = (data ?? []) as unknown as PublicationAModerer[];

  return (
    <>
      <TopBar title="G-Shop" />

      {publications.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          body="Les publications des membres arriveront ici avant d'être visibles."
        />
      ) : (
        <FreeShopModeration publications={publications} locale={locale} />
      )}
    </>
  );
}
