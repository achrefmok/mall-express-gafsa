"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openConversation, sendMessage } from "@/app/actions/account";
import { formatPrice } from "@/lib/format";
import type { AppLocale } from "@/types/database";
import type { ZoneLivraison } from "./types";

const TYPES = [
  { cle: "colis", fr: "Colis", ar: "طرد" },
  { cle: "courses", fr: "Courses", ar: "تسوّق" },
  { cle: "document", fr: "Document", ar: "وثيقة" },
] as const;

/**
 * « Que faut-il livrer ? » — Services (livraison).
 *
 * Les tarifs par zone viennent de `delivery_zones`, saisis par le vendeur
 * (`/vendeur/livraison`) — jamais une grille de prix inventée et partagée
 * entre boutiques qui n'ont pas forcément la même couverture. Tant
 * qu'aucune zone n'est enregistrée, le formulaire reste utilisable (type +
 * adresses), seuls le rail de tarifs et l'estimation prix/délai restent
 * absents.
 *
 * « Demander une course » n'ouvre ni commande ni dispatch de chauffeur :
 * il envoie le détail de la demande au vendeur via la messagerie déjà
 * existante (`openConversation` + `sendMessage`) — comme le contact
 * bijoutier pour une gravure, c'est au commerçant de répondre.
 */
export function ServiceLayout({
  shopId,
  shopSlug,
  shopAddress,
  zones,
  locale,
}: {
  shopId: string;
  shopSlug: string;
  shopAddress: string | null;
  zones: ZoneLivraison[];
  locale: AppLocale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<(typeof TYPES)[number]["cle"]>("colis");
  const [arrivee, setArrivee] = useState("");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const zone = zones.find((z) => z.id === zoneId) ?? null;

  function demander() {
    setErreur(null);
    startTransition(async () => {
      const typeLabel = TYPES.find((o) => o.cle === type)!;
      const lignes = [
        `${locale === "ar" ? "طلب توصيل" : "Demande de livraison"} — ${locale === "ar" ? typeLabel.ar : typeLabel.fr}`,
        `${locale === "ar" ? "الانطلاق" : "Départ"} : ${shopAddress || (locale === "ar" ? "غير محدّد" : "non précisé")}`,
        arrivee.trim() ? `${locale === "ar" ? "الوصول" : "Arrivée"} : ${arrivee.trim()}` : null,
        zone
          ? `${locale === "ar" ? "المنطقة" : "Zone"} : ${locale === "ar" && zone.name_ar ? zone.name_ar : zone.name} — ${formatPrice(zone.price, locale)} · ${zone.delay_minutes} min`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const ouverte = await openConversation(shopId);
      if (!ouverte.ok) {
        router.push(`/connexion?suite=${encodeURIComponent(`/boutique/${shopSlug}`)}`);
        return;
      }
      const envoye = await sendMessage(ouverte.data.id, lignes);
      if (!envoye.ok) {
        setErreur(envoye.error);
        return;
      }
      router.push(`/messages/${ouverte.data.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-col gap-[12px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[14px]">
        <span className="text-[0.875rem] font-bold">{locale === "ar" ? "ما الذي يجب توصيله؟" : "Que faut-il livrer ?"}</span>

        <div className="flex gap-[4px] rounded-[14px] bg-[var(--theme-accent-doux)] p-[4px]">
          {TYPES.map((o) => {
            const on = o.cle === type;
            return (
              <button
                key={o.cle}
                type="button"
                onClick={() => setType(o.cle)}
                className="flex-1 rounded-[11px] py-[8px] text-center text-[0.71875rem] font-bold"
                style={{
                  background: on ? "var(--theme-surface,#fff)" : "transparent",
                  color: on ? "var(--theme-accent-fort)" : "var(--theme-muted)",
                }}
              >
                {locale === "ar" ? o.ar : o.fr}
              </button>
            );
          })}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "الانطلاق" : "Départ"}
          </span>
          <span className="rounded-[12px] border border-[var(--theme-bordure)] bg-[var(--theme-accent-doux)] px-3 py-2 text-[0.75rem] font-semibold text-[var(--theme-accent-fort)]">
            {shopAddress || (locale === "ar" ? "عنوان غير محدّد" : "Adresse non précisée")}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
            {locale === "ar" ? "الوصول" : "Arrivée"}
          </span>
          <input
            value={arrivee}
            onChange={(e) => setArrivee(e.target.value)}
            placeholder={locale === "ar" ? "مثال: حي النور، شارع 12" : "Ex. Cité Ennour, rue 12"}
            className="rounded-[12px] border border-[var(--theme-bordure)] bg-transparent px-3 py-2 text-[0.75rem] outline-none"
          />
        </label>

        {zone && (
          <div className="grid grid-cols-2 gap-[8px]">
            <div className="rounded-[12px] bg-[var(--theme-accent-doux)] p-[10px]">
              <p className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
                {locale === "ar" ? "السعر التقديري" : "Prix estimé"}
              </p>
              <p className="text-[0.9375rem] font-bold text-[var(--theme-accent-fort)]">{formatPrice(zone.price, locale)}</p>
            </div>
            <div className="rounded-[12px] bg-[var(--theme-accent-doux)] p-[10px]">
              <p className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">{locale === "ar" ? "الأجل" : "Délai"}</p>
              <p className="text-[0.9375rem] font-bold text-[var(--theme-accent-fort)]">{zone.delay_minutes} min</p>
            </div>
          </div>
        )}

        {erreur && <p className="text-center text-[0.6875rem] font-semibold text-[var(--theme-accent-fort)]">{erreur}</p>}

        <button
          type="button"
          onClick={demander}
          disabled={pending}
          className="rounded-[16px] px-[16px] py-[12px] text-center text-[0.8125rem] font-semibold text-[var(--theme-accent-texte,white)] disabled:opacity-60"
          style={{ background: "var(--theme-accent,var(--color-brand-fill))" }}
        >
          {pending ? (locale === "ar" ? "جارٍ الإرسال…" : "Envoi…") : locale === "ar" ? "اطلبوا توصيلة" : "Demander une course"}
        </button>
      </div>

      {zones.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          <span className="px-[2px] text-[0.75rem] font-bold">{locale === "ar" ? "أسعار حسب المنطقة" : "Tarifs par zone"}</span>
          <div className="flex flex-col gap-[6px]">
            {zones.map((z) => {
              const on = z.id === zoneId;
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setZoneId(on ? null : z.id)}
                  className="flex items-center justify-between gap-[10px] rounded-[14px] border p-[11px] text-start"
                  style={{
                    borderColor: on ? "var(--theme-accent)" : "var(--theme-bordure)",
                    background: on ? "var(--theme-accent-doux)" : "var(--theme-surface)",
                  }}
                >
                  <span className="text-[0.75rem] font-semibold">{locale === "ar" && z.name_ar ? z.name_ar : z.name}</span>
                  <span className="flex flex-none items-center gap-[10px] text-[0.6875rem] font-bold text-[var(--theme-accent-fort)]">
                    {formatPrice(z.price, locale)}
                    <span className="text-[var(--theme-muted,var(--color-muted))]">{z.delay_minutes} min</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
