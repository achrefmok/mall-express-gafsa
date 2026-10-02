"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateShopAdmin } from "@/app/actions/admin";
import { formatCount, formatPrice, formatRating } from "@/lib/format";
import { Button, Card, Divider, KeyValueRow, SectionTitle, Tag, fieldClass } from "@/components/ui/primitives";
import type { Category } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

interface ShopDetail {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  status: string;
  category_id: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook_url: string | null;
  mall_level: number | null;
  mall_unit: string | null;
  followers_count: number;
  views_count: number;
  rating_sum: number;
  rating_count: number;
  submitted_at: string;
  approved_at: string | null;
  created_at: string;
}

interface ShopStats {
  productsCount: number;
  openReportsCount: number;
  ordersCount: number;
  revenueTotal: number;
  ordersLast30d: number;
  revenueLast30d: number;
}

const STATUS_TONE: Record<string, "outline" | "tinted" | "live"> = {
  approved: "tinted",
  pending: "outline",
  rejected: "live",
};

export function ShopDetailClient({
  shop,
  categories,
  stats,
  t,
}: {
  shop: ShopDetail;
  categories: Category[];
  stats: ShopStats;
  t: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const field = fieldClass({ strong: true });

  function onSave(formData: FormData) {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateShopAdmin(shop.id, {
        name: String(formData.get("name") ?? ""),
        nameAr: String(formData.get("nameAr") ?? ""),
        categoryId: String(formData.get("categoryId") ?? "") || null,
        address: String(formData.get("address") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        whatsapp: String(formData.get("whatsapp") ?? ""),
        instagram: String(formData.get("instagram") ?? ""),
        facebookUrl: String(formData.get("facebookUrl") ?? ""),
        mallLevel: formData.get("mallLevel") ? Number(formData.get("mallLevel")) : null,
        mallUnit: String(formData.get("mallUnit") ?? ""),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
      <div className="flex items-center justify-between">
        <Tag tone={STATUS_TONE[shop.status] ?? "outline"}>
          {shop.status === "approved"
            ? "Approuvée"
            : shop.status === "pending"
              ? t.admin.shopStatusPending
              : t.admin.shopStatusRejected}
        </Tag>
        <a
          href={`/boutique/${shop.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.6875rem] font-bold text-[var(--color-brand)]"
        >
          Voir la vitrine ↗
        </a>
      </div>

      {/* ─── Statistiques ───────────────────────────────────────────── */}
      <section className="flex flex-none flex-col gap-2">
        <SectionTitle>Statistiques</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: formatCount(shop.followers_count), label: "Abonnés" },
            { value: formatCount(shop.views_count), label: "Vues" },
            { value: formatRating(shop.rating_sum, shop.rating_count), label: "★ Note" },
            { value: String(stats.productsCount), label: "Produits" },
            { value: String(stats.ordersCount), label: "Commandes" },
            { value: formatPrice(stats.revenueTotal, "fr"), label: "Chiffre d'affaires" },
          ].map((s) => (
            <Card key={s.label} className="p-[11px]">
              <p className="text-[1rem] font-bold text-[var(--color-brand)]">{s.value}</p>
              <p className="text-[0.59375rem] text-[var(--color-muted)]">{s.label}</p>
            </Card>
          ))}
        </div>
        <Card className="flex flex-col gap-[6px] p-3">
          <KeyValueRow label="30 derniers jours">
            <span className="font-bold text-[var(--color-ink)]">
              {stats.ordersLast30d} commande{stats.ordersLast30d > 1 ? "s" : ""} · {formatPrice(stats.revenueLast30d, "fr")}
            </span>
          </KeyValueRow>
          {stats.openReportsCount > 0 && (
            <>
              <Divider />
              <KeyValueRow label="Signalements ouverts">
                <span className="font-bold text-[var(--color-live)]">{stats.openReportsCount}</span>
              </KeyValueRow>
            </>
          )}
        </Card>
      </section>

      {/* ─── Fiche ──────────────────────────────────────────────────── */}
      <section className="flex flex-none flex-col gap-2">
        <SectionTitle>Informations</SectionTitle>
        <Card className="flex flex-col gap-[10px] p-[14px_12px]">
          <form action={onSave} className="flex flex-col gap-[10px]">
            <label className="flex flex-col gap-[5px]">
              <span className={LABEL}>Nom</span>
              <input name="name" defaultValue={shop.name} required className={field} />
            </label>

            <label className="flex flex-col gap-[5px]">
              <span className={LABEL}>الاسم بالعربية</span>
              <input name="nameAr" dir="rtl" defaultValue={shop.name_ar ?? ""} className={field} />
            </label>

            <label className="flex flex-col gap-[5px]">
              <span className={LABEL}>Catégorie</span>
              <select name="categoryId" defaultValue={shop.category_id ?? ""} className={field}>
                <option value="">—</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_fr}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-[5px]">
              <span className={LABEL}>Adresse</span>
              <input name="address" defaultValue={shop.address ?? ""} className={field} />
            </label>

            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={LABEL}>Niveau</span>
                <input name="mallLevel" type="number" defaultValue={shop.mall_level ?? ""} className={field} />
              </label>
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={LABEL}>Local</span>
                <input name="mallUnit" defaultValue={shop.mall_unit ?? ""} className={field} />
              </label>
            </div>

            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={LABEL}>Téléphone</span>
                <input name="phone" type="tel" defaultValue={shop.phone ?? ""} className={field} />
              </label>
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={LABEL}>WhatsApp</span>
                <input name="whatsapp" type="tel" defaultValue={shop.whatsapp ?? ""} className={field} />
              </label>
            </div>

            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={LABEL}>Instagram</span>
                <input name="instagram" defaultValue={shop.instagram ?? ""} className={field} />
              </label>
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={LABEL}>Facebook</span>
                <input name="facebookUrl" defaultValue={shop.facebook_url ?? ""} className={field} />
              </label>
            </div>

            {error && (
              <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
                {error}
              </p>
            )}
            {saved && !error && (
              <p role="status" className="text-[0.6875rem] font-semibold text-[var(--color-success)]">
                Enregistré
              </p>
            )}

            <Button type="submit" disabled={pending} block>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
