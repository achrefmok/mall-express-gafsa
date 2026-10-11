import Image from "next/image";
import { formatCount, monogram } from "@/lib/format";
import { BoutonPartage } from "@/components/black-friday/share-button";
import { FollowButton, ShopContact, CountShopView } from "@/app/boutique/[slug]/shop-client";
import { ReservationSheet } from "@/components/partners/reservation-sheet";
import { StoriesRail } from "@/components/boutique/stories-rail";
import { BlocInfos, CouvertureRelief, type HoraireJour } from "@/components/boutique/entete-client";
import type { ConfigVitrine } from "@/lib/boutique-vitrines";
import type { StoryBoutique } from "@/lib/boutique-themes/attributs-server";
import type { AppLocale } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Un nombre isolé en LTR au milieu d'un texte arabe (U+2066 … U+2069). */
const ltr = (s: string) => `⁦${s}⁩`;

/**
 * L'en-tête de la vitrine, commun à toutes les boutiques (handoff,
 * « Structure commune ») : couverture de 200px en relief, carte blanche
 * qui la chevauche (logo à anneau tournant et pastille « + متابعة », nom,
 * description, chiffres, contact), bloc statut / emplacement, stories.
 *
 * Seules des données réelles : les visites sont le total
 * (`shops.views_count`), pas un « aujourd'hui » qu'aucune table ne compte ;
 * pas de temps de marche inventé sous l'emplacement.
 */
export function BoutiqueEnTete({
  shop,
  vitrine,
  enTete,
  rating,
  horaires,
  locale,
  t,
  following,
  stories,
  reservationDefaults,
}: {
  shop: {
    id: string;
    slug: string;
    name: string;
    name_ar: string | null;
    logo_url: string | null;
    description: string | null;
    description_ar: string | null;
    mall_level: number | null;
    mall_unit: string | null;
    phone: string | null;
    is_open_now: boolean;
    accepts_reservations: boolean;
    latitude: number | null;
    longitude: number | null;
    followers_count: number;
    views_count: number;
    rating_count: number;
    status: string;
    is_partner: boolean;
    partner_tagline: string | null;
    partner_tagline_ar: string | null;
    category: { name_fr: string; name_ar: string } | null;
  };
  vitrine: ConfigVitrine | null;
  enTete: string | null;
  rating: string;
  horaires: HoraireJour[];
  locale: AppLocale;
  t: Dictionary;
  following: boolean;
  stories: StoryBoutique[];
  reservationDefaults: { fullName: string; phone: string };
}) {
  const ar = locale === "ar";
  const nom = ar && shop.name_ar ? shop.name_ar : shop.name;
  const sousTitre =
    (shop.is_partner && (ar ? shop.partner_tagline_ar ?? shop.partner_tagline : shop.partner_tagline)) ||
    (ar ? shop.category?.name_ar : shop.category?.name_fr) ||
    null;
  const description = ar && shop.description_ar ? shop.description_ar : shop.description;

  const emplacement = shop.mall_unit
    ? ar
      ? `الطابق ${shop.mall_level ?? 0} · المحل ${shop.mall_unit}`
      : `Niveau ${shop.mall_level ?? 0} · Local ${shop.mall_unit}`
    : shop.latitude !== null
      ? t.shop.findUs
      : null;
  const lienCarte =
    shop.latitude !== null && shop.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`
      : null;

  const chiffre = "flex flex-1 flex-col items-center leading-[1.2]";
  const filet = <span aria-hidden className="h-7 w-px bg-[rgba(60,40,90,.1)]" />;

  return (
    <>
      <CouvertureRelief src={enTete}>
        {/* Le bouton retour occupe le coin de départ : le partage prend l'autre. */}
        <div className="absolute end-[14px] top-3 z-[3]">
          <BoutonPartage
            variante="rond"
            chemin={`/boutique/${shop.slug}`}
            titre={shop.name}
            texte={`${shop.name} — ${t.brand.first}${t.brand.second}`}
            image={`/partage/boutique/${shop.slug}`}
          />
        </div>
      </CouvertureRelief>

      <div className="relative z-[2] mx-3 -mt-11 flex flex-none flex-col gap-[14px] rounded-[24px] bg-[var(--theme-surface,#fff)] px-[14px] pb-[14px] shadow-[0_14px_34px_rgba(60,40,90,.12)]">
        <div className="-mt-[30px] flex items-end gap-3 pb-[6px]">
          <div className="relative h-[78px] w-[78px] flex-none">
            <div aria-hidden className="absolute -inset-[3px] overflow-hidden rounded-[25px]">
              <div
                className="animate-anneau-logo absolute -inset-[40%]"
                style={{
                  background:
                    "conic-gradient(var(--theme-accent),color-mix(in srgb,var(--theme-accent) 35%,white),var(--theme-accent))",
                }}
              />
            </div>
            <span
              className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[22px] border-[3px] border-white text-[1.4375rem] font-black tracking-[-0.5px] text-white"
              style={{ background: "color-mix(in srgb,var(--theme-accent) 70%,#120d17)" }}
            >
              {shop.logo_url ? (
                <Image src={shop.logo_url} alt="" width={78} height={78} className="h-full w-full object-cover" />
              ) : (
                monogram(shop.name)
              )}
            </span>
            <FollowButton shopId={shop.id} initiallyFollowing={following} variante="logo" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col pb-[2px]">
            <h1
              className="flex items-center gap-[6px] text-[1.125rem] leading-[1.2] font-extrabold"
              style={{ fontFamily: "var(--theme-police)" }}
            >
              <span className="min-w-0 truncate">{nom}</span>
              {/* Une boutique visible du public a été validée par l'administration du mall. */}
              {shop.status === "approved" && (
                <span
                  title={ar ? "متجر موثّق من G-Mall" : "Boutique validée par G-Mall"}
                  className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[var(--theme-accent)] text-[0.5625rem] font-black text-[var(--theme-accent-texte)]"
                >
                  ✓
                </span>
              )}
            </h1>
            {sousTitre && <span className="truncate text-[0.75rem] text-[var(--theme-muted)]">{sousTitre}</span>}
          </div>
        </div>

        {description && <p className="text-[0.875rem] leading-[1.5] text-[var(--theme-texte)]">{description}</p>}

        <div className="flex items-center justify-between border-y border-[rgba(60,40,90,.08)] px-1 py-[10px]">
          <div className={chiffre}>
            <b className="text-[1.0625rem]">{ltr(formatCount(shop.followers_count))}</b>
            <span className="text-[0.6875rem] text-[var(--theme-muted)]">{t.shop.followers}</span>
          </div>
          {filet}
          <div className={chiffre}>
            <b className="flex items-center gap-[3px] text-[1.0625rem] whitespace-nowrap">
              {ltr(rating)}
              <span className="text-[0.875rem] text-[oklch(.72_.15_75)]">★</span>
            </b>
            <span className="text-[0.6875rem] text-[var(--theme-muted)]">
              {ltr(formatCount(shop.rating_count))} {ar ? "تقييم" : "avis"}
            </span>
          </div>
          {filet}
          <div className={chiffre}>
            <b className="text-[1.0625rem]">{ltr(formatCount(shop.views_count))}</b>
            <span className="text-[0.6875rem] text-[var(--theme-muted)]">{t.common.views}</span>
          </div>
        </div>

        {/*
          Le bouton principal ouvre la messagerie — le seul canal qui laisse
          une trace des deux côtés —, avec le libellé du métier ; l'appel et
          WhatsApp suivent en icônes.
        */}
        <ShopContact
          variante="handoff"
          shopId={shop.id}
          shopName={shop.name}
          phone={shop.phone}
          labels={{
            message: vitrine ? (ar ? vitrine.libelleAction.ar : vitrine.libelleAction.fr) : t.shop.askVendor,
            call: t.taxi.call,
            whatsApp: t.common.whatsApp,
          }}
        />

        {/* Réserver engage une date : sa propre ligne, sous les contacts. */}
        {shop.accepts_reservations && (
          <ReservationSheet shopId={shop.id} shopName={shop.name} defaults={reservationDefaults} label="Réserver" />
        )}

        <BlocInfos
          ouvert={shop.is_open_now}
          horaires={horaires}
          emplacement={emplacement}
          sousEmplacement={shop.mall_unit ? "Mall Express Gafsa" : null}
          lienCarte={lienCarte}
          locale={locale}
        />
        {/*
          La visite est comptée depuis le navigateur : la page est servie en
          cache cinq minutes, un incrément serveur n'en compterait qu'une.
        */}
        <CountShopView shopId={shop.id} />
      </div>

      {stories.length > 0 && (
        <div className="pt-4">
          <StoriesRail stories={stories} shopSlug={shop.slug} shopName={shop.name} />
        </div>
      )}
    </>
  );
}
