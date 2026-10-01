import { AvantDebut } from "@/components/ui/avant-debut";
import { EmptyState, Rail, Tag } from "@/components/ui/primitives";
import { ProductCard, type ProductCardData } from "@/components/cards/product-card";
import { RoueDeLaChance, type CaseRoue } from "@/components/roue/roue-de-la-chance";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Live {
  id: string;
  title: string;
  status: string;
  scheduled_at: string | null;
}

/**
 * Puces de sous-catégories, promotion active, roue, puis l'onglet actif —
 * extrait de `page.tsx` sans changement de classe ni de structure.
 */
export function BoutiqueContenu({
  onglet,
  subCategories,
  promo,
  roue,
  casesRoue,
  lives,
  visible,
  locale,
  t,
  userConnecte,
  theme,
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
  roue: { id: string; title: string; title_ar: string | null; is_active: boolean } | null;
  casesRoue: CaseRoue[];
  lives: Live[];
  visible: ProductCardData[];
  locale: AppLocale;
  t: Dictionary;
  userConnecte: boolean;
  theme: ThemeBoutique;
}) {
  return (
    <div className="no-sb flex flex-1 flex-col gap-[14px] px-4 pt-3 pb-4">
      {/* Chips de sous-catégories, chacune dans sa nuance */}
      {subCategories.length > 0 && (
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
        <div className="flex flex-none items-center gap-[10px] rounded-[18px] border border-[rgba(122,31,43,0.15)] bg-[var(--color-brand-tint)] p-[10px]">
          <span className="flex-none rounded-[14px] bg-[var(--color-live-fill)] px-[9px] py-[6px] text-[0.6875rem] font-bold text-white">
            −{promo.percent_off}%
          </span>
          <div className="min-w-0">
            <p className="text-[0.71875rem] font-semibold text-[var(--color-ink)]">
              {locale === "ar" && promo.title_ar ? promo.title_ar : promo.title}
            </p>
            {/*
              À venir, elle annonce son décompte ; commencée, sa date de
              fin. Une promotion préparée pour demain n'a aucune raison
              de rester cachée jusqu'au matin : l'annoncer fait revenir,
              et c'est le seul intérêt de la programmer.
            */}
            <p className="text-[0.65625rem] text-[var(--color-muted)]">
              {new Date(promo.starts_at).getTime() > Date.now() ? (
                <AvantDebut debut={promo.starts_at} />
              ) : (
                <>
                  {t.deals.validUntil} {new Date(promo.ends_at).toLocaleDateString("fr-FR")}
                </>
              )}
            </p>
          </div>
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
      ) : visible.length === 0 ? (
        <EmptyState
          title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => (
            <ProductCard
              key={product.id}
              product={{ ...product, shop: null }}
              locale={locale}
              showShop={false}
              imageHeight={118}
            />
          ))}
        </div>
      )}
    </div>
  );
}
