import { AvantDebut } from "@/components/ui/avant-debut";
import { CompteARebours } from "@/components/ui/compte-a-rebours-boites";
import { EmptyState, Rail, Tag } from "@/components/ui/primitives";
import { RoueDeLaChance, type CaseRoue } from "@/components/roue/roue-de-la-chance";
import { GrilleParDefaut } from "@/components/boutique/layouts/grille-par-defaut";
import { ModeLayout } from "@/components/boutique/layouts/mode-layout";
import { BeauteLayout } from "@/components/boutique/layouts/beaute-layout";
import { MaisonLayout } from "@/components/boutique/layouts/maison-layout";
import { BijouterieLayout } from "@/components/boutique/layouts/bijouterie-layout";
import { ServiceLayout } from "@/components/boutique/layouts/service-layout";
import { TelephonesLayout } from "@/components/boutique/layouts/telephones-layout";
import { ParfumerieLayout } from "@/components/boutique/layouts/parfumerie-layout";
import { ParapharmacieVitrineLayout } from "@/components/boutique/layouts/parapharmacie-vitrine-layout";
import { ElectromenagerLayout } from "@/components/boutique/layouts/electromenager-layout";
import { MotoLayout } from "@/components/boutique/layouts/moto-layout";
import { PatisserieLayout } from "@/components/boutique/layouts/patisserie-layout";
import { AnimalerieLayout } from "@/components/boutique/layouts/animalerie-layout";
import { SportLayout } from "@/components/boutique/layouts/sport-layout";
import { LocationLayout } from "@/components/boutique/layouts/location-layout";
import type { PackBoutique, ProduitBoutique, ZoneLivraison } from "@/components/boutique/layouts/types";
import { rayonBadge, type ThemeBoutique } from "@/lib/boutique-themes";
import type { ConfigVitrine } from "@/lib/boutique-vitrines";
import type { AppLocale } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Live {
  id: string;
  title: string;
  status: string;
  scheduled_at: string | null;
}

interface Promotion {
  id: string;
  percent_off: number;
  title: string;
  title_ar: string | null;
  starts_at: string;
  ends_at: string;
}

/**
 * Puces de sous-catégories, promotion active, roue, puis l'onglet actif —
 * extrait de `page.tsx` sans changement de classe ni de structure.
 */
export function BoutiqueContenu({
  onglet,
  subCategories,
  promo,
  promotions,
  roue,
  casesRoue,
  lives,
  visible,
  packs,
  zones,
  shopId,
  shopSlug,
  shopAddress,
  couverture,
  installments,
  routineDiscount,
  packTiers,
  lookbook,
  locale,
  t,
  userConnecte,
  theme,
  vitrine,
  nomBoutique,
}: {
  onglet: string;
  subCategories: Array<{ category: { id: string; name_fr: string; name_ar: string; hue: number } | null }>;
  promo: {
    percent_off: number;
    title: string;
    title_ar: string | null;
    starts_at: string;
    ends_at: string;
  } | null;
  promotions: Promotion[];
  roue: { id: string; title: string; title_ar: string | null; is_active: boolean } | null;
  casesRoue: CaseRoue[];
  lives: Live[];
  visible: ProduitBoutique[];
  packs: PackBoutique[];
  zones: ZoneLivraison[];
  shopId: string;
  shopSlug: string;
  shopAddress: string | null;
  couverture: string | null;
  installments: number[];
  routineDiscount: number;
  packTiers: Array<{ min: number; pct: number }>;
  lookbook: { imageUrl: string; reperes: Array<{ id: string; productId: string | null; x: number; y: number }> } | null;
  locale: AppLocale;
  t: Dictionary;
  userConnecte: boolean;
  theme: ThemeBoutique;
  /** Le métier du handoff, s'il y en a un — voir `resolveVitrine`. */
  vitrine: ConfigVitrine | null;
  nomBoutique: string;
}) {
  return (
    <div className="no-sb flex flex-1 flex-col gap-[14px] px-4 pt-3 pb-4">
      {/*
        Chips de sous-catégories, chacune dans sa nuance — absentes pour
        Mode, qui a sa propre navigation à deux niveaux (genre puis rayon)
        dans `ModeLayout` ; ce rail générique y ferait doublon.
      */}
      {subCategories.length > 0 &&
        !vitrine &&
        !(theme.productLayout === "service" && theme.id === "services") && (
        <Rail className="flex-none" gap={8}>
          <span className="flex-none whitespace-nowrap rounded-[14px] bg-[var(--color-brand-fill)] px-[13px] py-[6px] text-[0.65625rem] font-semibold text-white">
            {t.common.all}
          </span>
          {subCategories.map(({ category }) =>
            category ? (
              <span
                key={category.id}
                className="cat-surface cat-ink flex-none whitespace-nowrap rounded-[14px] px-[13px] py-[6px] text-[0.65625rem] font-semibold"
                style={{ "--hue": category.hue } as React.CSSProperties}
              >
                {locale === "ar" ? category.name_ar : category.name_fr}
              </span>
            ) : null,
          )}
        </Rail>
      )}

      {promo && (
        <div className="flex flex-none items-center gap-[10px] rounded-[var(--theme-rayon-interieur,18px)] border border-[var(--theme-bordure,rgba(122,31,43,0.15))] bg-[var(--theme-surface,var(--color-brand-tint))] p-[10px]">
          <span className="flex-none rounded-[14px] bg-[var(--color-live-fill)] px-[9px] py-[6px] text-[0.6875rem] font-bold text-white">
            −{promo.percent_off}%
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.59375rem] font-bold text-[var(--color-live)]">⚡ {t.shop.todayOffer}</p>
            <p className="truncate text-[0.71875rem] font-semibold text-[var(--color-ink)]">
              {locale === "ar" && promo.title_ar ? promo.title_ar : promo.title}
            </p>
            {/*
              À venir, elle annonce son décompte avant de démarrer ; une fois
              commencée, son décompte avant la fin — en cases chiffrées, pas
              une date : une promotion préparée pour demain n'a aucune raison
              de rester cachée jusqu'au matin, et « ça presse » se lit mieux
              en secondes qui défilent qu'en date de fin.
            */}
            {new Date(promo.starts_at).getTime() > Date.now() && (
              <p className="text-[0.65625rem] text-[var(--color-muted)]">
                <AvantDebut debut={promo.starts_at} />
              </p>
            )}
          </div>
          {new Date(promo.starts_at).getTime() <= Date.now() && (
            <CompteARebours jusqua={promo.ends_at} className="flex-none" />
          )}
        </div>
      )}

      {/*
        La roue, avant les produits et après la promotion.

        C'est une raison de rester, pas une raison de venir : elle ne
        doit pas couvrir ce que la boutique vend, mais celui qui a fait
        le chemin jusqu'ici mérite de la voir sans chercher.
      */}
      {roue && roue.is_active && casesRoue.length > 0 && (
        <RoueDeLaChance
          wheelId={roue.id}
          titre={(locale === "ar" ? roue.title_ar : roue.title) ?? roue.title}
          cases={casesRoue}
          locale={locale}
          connecte={userConnecte}
        />
      )}

      {onglet === "lives" ? (
        lives.length === 0 ? (
          <EmptyState title={t.live.noneLive} />
        ) : (
          lives.map((live) => (
            <a
              key={live.id}
              href={`/lives/${live.id}`}
              className="flex items-center gap-2 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[0.71875rem] font-semibold">{live.title}</span>
                {/* « Dans 2 h 14 » plutôt qu'une heure : la question
                    qu'on se pose devant un rendez-vous annoncé est
                    « ai-je le temps d'aller faire autre chose ? ». */}
                {live.status === "scheduled" && live.scheduled_at && (
                  <AvantDebut
                    debut={live.scheduled_at}
                    prefixe="Commence dans"
                    className="truncate text-[0.625rem] text-[var(--color-muted)]"
                  />
                )}
              </span>
              <Tag tone={live.status === "live" ? "live" : "tinted"}>
                {live.status === "live" ? t.live.onAir : t.live.scheduled}
              </Tag>
            </a>
          ))
        )
      ) : onglet === "promos" ? (
        promotions.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? theme.emptyState.promos.ar : theme.emptyState.promos.fr}
          />
        ) : (
          <div className="flex flex-col gap-[10px]">
            {promotions.map((promotion) => {
              const badgeFill = theme.promoStyle.accentPropre
                ? "bg-[var(--theme-accent,var(--color-live-fill))]"
                : "bg-[var(--color-live-fill)]";
              return (
                <div
                  key={promotion.id}
                  className="flex items-center gap-[10px] rounded-[var(--theme-rayon-interieur,18px)] border border-[var(--theme-bordure,rgba(122,31,43,0.15))] bg-[var(--theme-surface,var(--color-brand-tint))] p-[10px]"
                >
                  <span
                    className={`flex-none px-[9px] py-[6px] text-[0.6875rem] font-bold text-white ${badgeFill}`}
                    style={{ borderRadius: rayonBadge(theme) }}
                  >
                    −{promotion.percent_off}%
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.71875rem] font-semibold text-[var(--theme-texte,var(--color-ink))]">
                      {locale === "ar" && promotion.title_ar ? promotion.title_ar : promotion.title}
                    </p>
                    <p className="text-[0.65625rem] text-[var(--theme-muted,var(--color-muted))]">
                      {new Date(promotion.starts_at).getTime() > Date.now() ? (
                        <AvantDebut debut={promotion.starts_at} />
                      ) : (
                        <>
                          {t.deals.validUntil} {new Date(promotion.ends_at).toLocaleDateString("fr-FR")}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : vitrine?.id === "mode" ? (
        <ModeLayout
          visible={visible}
          locale={locale}
          theme={theme}
          vitrine={vitrine}
          nomBoutique={nomBoutique}
          couverture={couverture}
          lookbook={lookbook}
        />
      ) : vitrine?.id === "telephones" ? (
        <TelephonesLayout visible={visible} locale={locale} theme={theme} vitrine={vitrine} nomBoutique={nomBoutique} />
      ) : vitrine?.id === "parfumerie" ? (
        <ParfumerieLayout visible={visible} locale={locale} theme={theme} vitrine={vitrine} nomBoutique={nomBoutique} />
      ) : vitrine?.id === "parapharmacie" ? (
        <ParapharmacieVitrineLayout
          visible={visible}
          locale={locale}
          theme={theme}
          vitrine={vitrine}
          nomBoutique={nomBoutique}
          packs={packs}
          shopId={shopId}
          shopSlug={shopSlug}
          packTiers={packTiers}
        />
      ) : vitrine?.id === "electromenager" ? (
        <ElectromenagerLayout
          visible={visible}
          locale={locale}
          theme={theme}
          vitrine={vitrine}
          nomBoutique={nomBoutique}
          installments={installments}
        />
      ) : vitrine?.id === "moto" ? (
        <MotoLayout visible={visible} locale={locale} theme={theme} vitrine={vitrine} nomBoutique={nomBoutique} />
      ) : vitrine?.id === "patisserie" ? (
        <PatisserieLayout visible={visible} locale={locale} theme={theme} vitrine={vitrine} nomBoutique={nomBoutique} />
      ) : vitrine?.id === "animalerie" ? (
        <AnimalerieLayout visible={visible} locale={locale} theme={theme} vitrine={vitrine} nomBoutique={nomBoutique} />
      ) : vitrine?.id === "sport" ? (
        <SportLayout visible={visible} locale={locale} theme={theme} vitrine={vitrine} nomBoutique={nomBoutique} />
      ) : vitrine?.id === "location" ? (
        <LocationLayout
          visible={visible}
          locale={locale}
          theme={theme}
          vitrine={vitrine}
          nomBoutique={nomBoutique}
          shopId={shopId}
        />
      ) : theme.productLayout === "beaute" ? (
        <BeauteLayout visible={visible} locale={locale} theme={theme} routineDiscount={routineDiscount} />
      ) : theme.productLayout === "maison" ? (
        <MaisonLayout visible={visible} locale={locale} theme={theme} couverture={couverture} />
      ) : theme.productLayout === "bijouterie" ? (
        <BijouterieLayout visible={visible} locale={locale} theme={theme} />
      ) : theme.productLayout === "service" && theme.id === "services" ? (
        // "service" est partagée avec Santé — seule Services (livraison)
        // reçoit le formulaire de demande, Santé continue sur
        // GrilleParDefaut ci-dessous tant qu'elle n'a pas son propre besoin.
        <ServiceLayout shopId={shopId} shopSlug={shopSlug} shopAddress={shopAddress} zones={zones} locale={locale} />
      ) : (
        /*
          `GrilleParDefaut` reste le repli pour toute famille qui n'a pas
          de mise en page dédiée — Alimentation, Cafés, Santé, Sport, Fête,
          Immobilier, Enseignement, Auto, Animaux, Services, Défaut.
        */
        <GrilleParDefaut visible={visible} locale={locale} theme={theme} />
      )}
    </div>
  );
}
