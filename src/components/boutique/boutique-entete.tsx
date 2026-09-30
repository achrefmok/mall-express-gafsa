import Image from "next/image";
import { format } from "@/lib/i18n/format";
import { formatCount, formatTime, monogram } from "@/lib/format";
import { BoutonPartage } from "@/components/black-friday/share-button";
import { Card, Placeholder } from "@/components/ui/primitives";
import { PinIcon } from "@/components/ui/icons";
import { FollowButton, ShopContact, CountShopView } from "@/app/boutique/[slug]/shop-client";
import { ReservationSheet } from "@/components/partners/reservation-sheet";
import { rayonBadge, type ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * L'en-tête de la vitrine — couverture, identité, contact, emplacement.
 *
 * Extrait de `page.tsx` tel quel, sans le moindre changement de classe ni de
 * structure : c'est une extraction, pas une refonte. La refonte vient
 * ensuite, une fois que cette page rend exactement comme avant depuis des
 * fichiers plus courts.
 */
export function BoutiqueEnTete({
  shop,
  theme,
  enTete,
  rating,
  hoursCloseAt,
  locale,
  t,
  following,
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
    posts_count: number;
    followers_count: number;
    views_count: number;
    category: { name_fr: string; name_ar: string } | null;
  };
  theme: ThemeBoutique;
  enTete: string | null;
  rating: string;
  hoursCloseAt: string | null | undefined;
  locale: AppLocale;
  t: Dictionary;
  following: boolean;
  reservationDefaults: { fullName: string; phone: string };
}) {
  return (
    <>
      {enTete ? (
        /*
          `fill` dans un cadre de hauteur fixe, et un `sizes` déclaré.

          La couverture est recadrée : elle occupe toute la largeur sur une
          hauteur imposée, quel que soit le format du fichier envoyé par le
          commerçant. Déclarer 520 × 110 annonçait un rapport que le rendu ne
          tenait pas, et sans `sizes` le navigateur supposait la pleine largeur
          de l'écran — il téléchargeait donc une variante trop lourde pour un
          bandeau de cent-dix pixels.
        */
        <span className="relative block h-[110px] w-full flex-none">
          <Image
            src={enTete}
            alt=""
            fill
            priority
            sizes="(max-width: 520px) 100vw, 520px"
            className="object-cover"
          />
          {/*
            Le voile de l'ambiance : jamais opaque, jamais devant le texte
            qui suit — juste de quoi teinter la photo du commerçant sans la
            remplacer. Une boutique « Électronique » y gagne un motif de
            grille très pâle en plus du dégradé, une boutique « Mode » n'a
            que le dégradé.
          */}
          {theme.voileCouverture !== "none" && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: theme.voileCouverture }}
            />
          )}
          {theme.motif !== "none" && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: theme.motif, backgroundSize: theme.motifTaille }}
            />
          )}
        </span>
      ) : (
        <Placeholder label="photo de couverture" className="h-[110px] w-full flex-none" />
      )}

      <div className="-mt-6 flex flex-none flex-col gap-2 px-4">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--color-app)] bg-[var(--color-brand-fill)] text-[1.125rem] font-bold text-white">
          {shop.logo_url ? (
            <Image src={shop.logo_url} alt="" width={64} height={64} className="h-full w-full object-cover" />
          ) : (
            monogram(shop.name)
          )}
        </span>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-[1.1875rem] font-semibold text-[var(--color-ink)]"
              style={{ fontFamily: "var(--theme-police)" }}
            >
              {locale === "ar" && shop.name_ar ? shop.name_ar : shop.name}
            </h1>
            <p className="text-[0.6875rem] text-[var(--color-muted)]">
              {locale === "ar" ? shop.category?.name_ar : shop.category?.name_fr}
              {shop.mall_level !== null && ` · Niveau ${shop.mall_level}`}
            </p>
            <div className="mt-2">
              <BoutonPartage
                chemin={`/boutique/${shop.slug}`}
                titre={shop.name}
                texte={`${shop.name} — ${t.brand.first}${t.brand.second}`}
                image={`/partage/boutique/${shop.slug}`}
              />
            </div>
          </div>
          <FollowButton shopId={shop.id} initiallyFollowing={following} />
          {/*
            La visite est comptée depuis le navigateur, et non pendant le rendu :
            cette page est servie en cache cinq minutes (`revalidate = 300`), si
            bien qu'un incrément côté serveur n'aurait compté qu'une visite par
            intervalle, quel que soit le nombre de visiteurs réels.
          */}
          <CountShopView shopId={shop.id} />
        </div>

        {/*
          Plus de statistique "posts" : aucune table ne porte cette donnée,
          et `shops.posts_count` n'est incrémenté nulle part — c'est un
          compteur mort, toujours à 0. Voir TODO.md.
        */}
        <div className="mt-[2px] flex justify-between gap-3 text-[0.6875rem] text-[var(--color-muted)]">
          <span className="whitespace-nowrap">
            <b className="text-[var(--color-ink)]">{formatCount(shop.followers_count)}</b>{" "}
            {t.shop.followers}
          </span>
          <span className="whitespace-nowrap">
            <b className="text-[var(--color-ink)]">{formatCount(shop.views_count)}</b>{" "}
            {t.common.views}
          </span>
          <span className="whitespace-nowrap">
            <b className="text-[var(--color-ink)]">{rating}</b> ★ {t.shop.reviews}
          </span>
        </div>

        {(shop.description || shop.description_ar) && (
          <p className="text-[0.75rem] leading-[1.5] text-[var(--color-ink)]">
            {locale === "ar" && shop.description_ar ? shop.description_ar : shop.description}
          </p>
        )}

        <div className="mt-[2px] flex flex-none flex-wrap items-center gap-2">
          <span
            className="flex items-center gap-[6px] bg-[var(--theme-accent-doux)] px-[10px] py-[5px] text-[0.625rem] font-bold text-[var(--theme-accent-fort)]"
            style={{ borderRadius: rayonBadge(theme) }}
          >
            <span
              className={`inline-block h-[6px] w-[6px] rounded-full ${
                shop.is_open_now ? "bg-[var(--color-success)]" : "bg-[var(--color-faint)]"
              }`}
            />
            {shop.is_open_now && hoursCloseAt
              ? format(t.shop.openUntil, { time: formatTime(hoursCloseAt) })
              : t.shop.closed}
          </span>

          {/*
            Trois portes vers le vendeur, et non plus une seule.

            Le lien précédent choisissait à la place du visiteur : un numéro
            renseigné menait à l'appel, et la messagerie du site devenait
            alors inaccessible depuis la boutique — alors qu'elle est le seul
            canal qui laisse une trace consultable des deux côtés. Un client
            qui veut écrire à 23 h n'appelle pas ; un client pressé n'écrit pas.
          */}
          <ShopContact
            shopId={shop.id}
            shopName={shop.name}
            phone={shop.phone}
            labels={{
              message: t.shop.askVendor,
              call: t.taxi.call,
              whatsApp: t.common.whatsApp,
            }}
          />

          {/*
            Réserver, quand la boutique le propose.

            Sous la barre de contact et non dedans : appeler, écrire et
            réserver ne sont pas trois gestes du même poids. Les deux
            premiers ouvrent une conversation, le troisième engage une
            date et un nombre de personnes — il mérite sa propre ligne.

            Un visiteur non connecté le voit aussi : lui cacher le bouton
            jusqu'à la connexion, c'est lui cacher la raison de se
            connecter. L'action l'enverra s'identifier, et la policy
            d'insertion refuse de toute façon sans session.
          */}
          {shop.accepts_reservations && (
            <div className="w-full">
              <ReservationSheet
                shopId={shop.id}
                shopName={shop.name}
                defaults={reservationDefaults}
                label="Réserver"
              />
            </div>
          )}
        </div>

        {/*
          Où se trouve la boutique, et comment y aller.

          La page disait « Niveau 1 » dans une ligne de texte gris, sous le
          nom. Or c'est l'information qui décide du déplacement : quelqu'un
          qui consulte une vitrine depuis chez lui veut savoir s'il peut y
          passer. Elle prend donc une carte à elle, avec l'itinéraire au bout.

          L'itinéraire s'ouvre dans l'application de cartographie du
          téléphone : c'est elle qui connaît le trafic et qui parle pendant le
          trajet. Sans coordonnées, la carte reste et se contente d'indiquer
          le local — à l'intérieur d'un mall, « Niveau 1, local B12 » guide
          mieux qu'un point sur une carte.
        */}
        {(shop.mall_unit || (shop.latitude !== null && shop.longitude !== null)) && (
          <Card className="mt-1 flex items-center gap-[10px] p-[12px_13px]">
            <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
              <PinIcon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">
                {shop.mall_unit
                  ? format(t.product.walkTime, {
                      level: shop.mall_level ?? 0,
                      unit: shop.mall_unit,
                      min: 3,
                    })
                  : t.shop.findUs}
              </p>
              <p className="text-[0.625rem] leading-[1.35] text-[var(--color-muted)]">
                {locale === "ar" ? shop.category?.name_ar : shop.category?.name_fr}
              </p>
            </div>
            {shop.latitude !== null && shop.longitude !== null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="press flex-none rounded-[16px] bg-[var(--color-brand-fill)] px-[13px] py-2 text-[0.65625rem] font-bold whitespace-nowrap text-white shadow-[0_8px_18px_rgba(109,75,143,0.26)]"
              >
                {t.shop.guideMe}
              </a>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
