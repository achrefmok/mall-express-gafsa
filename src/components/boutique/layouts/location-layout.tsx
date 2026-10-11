"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import { openConversation } from "@/app/actions/account";
import type { ConfigVitrine } from "@/lib/boutique-vitrines";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";
import { HautDeVitrine, OPACITE_HORS_FILTRE, useVitrine } from "./vitrine-commune";
import { nombreDe } from "./comparateur";
import { fondSansPhoto } from "../feuille-produit";

/**
 * Location — handoff « 10-location » : showroom bleu nuit et or, filtre
 * « ماذا تريد أن تكتري؟ », durée de location qui recalcule chaque prix
 * (prix du produit = prix par jour), caution et assurance quand le vendeur
 * les a renseignées (`caution`, `assurance_jour`).
 *
 * Ni badge de disponibilité ni calendrier : aucune table ne dit quels jours
 * un article est déjà loué. La réservation passe donc par la boutique
 * (messagerie), qui confirme la disponibilité — jamais un « متاح » inventé.
 */
export function LocationLayout({
  visible,
  locale,
  theme,
  vitrine,
  nomBoutique,
  shopId,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
  vitrine: ConfigVitrine;
  nomBoutique: string;
  shopId: string;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const etat = useVitrine(visible, vitrine);
  const [jours, setJours] = useState(1);
  const [assurance, setAssurance] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  // Pas de feuille ici : la pièce touchée sur le présentoir amène à sa carte.
  const idOuvert = etat.ouvert?.id;
  useEffect(() => {
    if (idOuvert) document.getElementById(`location-${idOuvert}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [idOuvert]);

  if (visible.length === 0) {
    return <EmptyState title={ar ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  const libelleJours = (n: number) => (ar ? (n === 1 ? "يوم" : n === 2 ? "يومان" : n <= 10 ? `${n} أيام` : `${n} يوما`) : `${n} jour${n > 1 ? "s" : ""}`);

  function demander() {
    startTransition(async () => {
      const result = await openConversation(shopId);
      if (!result.ok) {
        router.push(`/connexion?suite=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      router.push(`/messages/${result.data.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <HautDeVitrine
        vitrine={vitrine}
        produits={visible}
        etat={etat}
        nomBoutique={nomBoutique}
        locale={locale}
        noteDe={(p) => `${formatPrice(p.price, locale)} ${ar ? "/ يوم" : "/ jour"}`}
      />

      <div className="flex items-center justify-between gap-[10px] rounded-[16px] border border-[rgba(60,40,90,.08)] bg-[var(--theme-surface,#fff)] px-[14px] py-3">
        <span className="flex flex-col leading-[1.25]">
          <span className="text-[0.875rem] font-extrabold">{ar ? "مدّة الكراء" : "Durée de location"}</span>
          <span className="text-[0.75rem] text-[var(--theme-muted)]">{ar ? "كل الأسعار محسوبة للمدّة" : "Tous les prix pour cette durée"}</span>
        </span>
        <span className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={() => setJours((j) => Math.max(1, j - 1))}
            disabled={jours <= 1}
            aria-label={ar ? "أنقص يوما" : "Un jour de moins"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--theme-accent-doux)] text-[1.125rem] font-extrabold text-[var(--theme-accent-fort)] disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[56px] text-center text-[1.0625rem] font-black">{libelleJours(jours)}</span>
          <button
            type="button"
            onClick={() => setJours((j) => Math.min(30, j + 1))}
            disabled={jours >= 30}
            aria-label={ar ? "أضف يوما" : "Un jour de plus"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--theme-accent-doux)] text-[1.125rem] font-extrabold text-[var(--theme-accent-fort)] disabled:opacity-40"
          >
            +
          </button>
        </span>
      </div>

      <span className="text-[0.9375rem] font-extrabold">
        {ar ? "للكراء" : "À louer"} · {visible.length}
      </span>

      <div className="flex flex-col gap-3">
        {visible.map((p) => {
          const caution = nombreDe(p.attributs?.caution);
          const assuranceJour = nombreDe(p.attributs?.assurance_jour);
          const avecAssurance = assuranceJour !== null && assurance[p.id];
          const total = p.price * jours + (avecAssurance ? assuranceJour! * jours : 0);
          const surligne = etat.ouvert?.id === p.id;
          return (
            <article
              key={p.id}
              id={`location-${p.id}`}
              className="flex flex-col overflow-hidden rounded-[20px] bg-[var(--theme-surface,#fff)] shadow-[0_8px_22px_rgba(10,20,40,0.08)] transition-opacity duration-300"
              style={{
                opacity: etat.correspond(p) ? 1 : OPACITE_HORS_FILTRE,
                outline: surligne ? "2px solid var(--theme-accent)" : undefined,
              }}
            >
              <div className="relative h-[110px] w-full" style={{ background: p.images[0] ? "var(--theme-accent-doux)" : fondSansPhoto(p) }}>
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- visuel 110px
                  <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[1.25rem] font-black text-white">
                    {p.name.split(/\s+/)[0]}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[0.9375rem] leading-[1.3] font-extrabold">{p.name}</span>
                  <span className="flex flex-none flex-col items-end leading-[1.2]">
                    <span className="text-[0.9375rem] font-black text-[var(--theme-accent-fort)]">{formatPrice(total, locale)}</span>
                    <span className="text-[0.625rem] text-[var(--theme-muted)]">
                      {formatPrice(p.price, locale)} {ar ? "/ يوم" : "/ jour"}
                    </span>
                  </span>
                </div>
                {caution !== null && (
                  <span className="text-[0.75rem] text-[var(--theme-muted)]">
                    {ar ? "الضمان المالي" : "Caution"} : <b className="text-[var(--theme-texte)]">{formatPrice(caution, locale)}</b>
                  </span>
                )}
                {assuranceJour !== null && (
                  <label className="flex min-h-[40px] items-center justify-between gap-2 rounded-[12px] bg-[var(--theme-fond)] px-3 text-[0.8125rem] font-semibold">
                    <span>
                      {ar ? "التأمين" : "Assurance"} +{formatPrice(assuranceJour, locale)} {ar ? "/ يوم" : "/ jour"}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(assurance[p.id])}
                      onChange={(e) => setAssurance((a) => ({ ...a, [p.id]: e.target.checked }))}
                      className="h-5 w-5 accent-[var(--theme-accent)]"
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={demander}
                  disabled={pending}
                  className="min-h-[46px] rounded-[14px] bg-[var(--theme-accent)] px-3 text-[0.875rem] font-extrabold text-[var(--theme-accent-texte)] disabled:opacity-60"
                >
                  {ar ? `اطلب الحجز · ${libelleJours(jours)} · ${formatPrice(total, locale)}` : `Demander · ${libelleJours(jours)} · ${formatPrice(total, locale)}`}
                </button>
                <span className="text-center text-[0.6875rem] text-[var(--theme-muted)]">
                  {ar ? "يؤكّد المتجر التوفّر في المحادثة" : "La boutique confirme la disponibilité par message"}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
