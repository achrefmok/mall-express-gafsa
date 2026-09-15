import Link from "next/link";
import { Rail } from "@/components/ui/primitives";
import { CompteARebours } from "./countdown";
import { CarteBlackFriday } from "./bf-card";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import type { EtatBlackFriday, OffreVitrine } from "@/lib/black-friday-server";
import type { AppLocale } from "@/types/database";

/**
 * Le Black Friday sur l'accueil.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Quand la section existe, et quand elle se tait
 * ────────────────────────────────────────────────────────────────────────
 *
 *   · aucune campagne, ou campagne terminée — rien. Une bannière qui
 *     annonce une opération passée est pire qu'une absence : elle fait
 *     cliquer pour rien ;
 *   · campagne à venir — la bannière et le compte à rebours, sans produits.
 *     Montrer les prix avant l'heure, ce serait les révéler aux concurrents
 *     et les promettre à des clients qui ne peuvent pas encore les payer ;
 *   · campagne en cours — la bannière, le décompte jusqu'à la fin, et les
 *     offres. Sans offre, rien : « jusqu'à −0 % » ne vend rien.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Un panneau, pas une bande
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le titre et le décompte partagent la même surface sombre que les offres,
 * arrondie à vingt-quatre et posée sur le fond lilas de l'application. La
 * campagne se lit alors comme un objet unique — une affiche — au lieu d'une
 * bannière suivie d'une rangée de cartes qui pourrait appartenir à la
 * section voisine.
 *
 * Composant serveur, sans état : le seul JavaScript envoyé est celui du
 * compte à rebours, quelques centaines d'octets.
 */
export async function SectionBlackFriday({
  etat,
  offres,
  locale,
}: {
  etat: EtatBlackFriday;
  offres: OffreVitrine[];
  locale: AppLocale;
}) {
  const campagne = etat.campagne;
  if (!campagne || campagne.phase === "termine") return null;

  const actif = campagne.phase === "actif";
  if (actif && offres.length === 0) return null;

  const { t } = await getT();
  const meilleure = Math.max(0, ...offres.map((o) => o.reduction ?? 0));

  return (
    <section aria-labelledby="titre-black-friday" className="px-4">
      <div className="overflow-hidden rounded-[24px] bg-[linear-gradient(150deg,#241f2e_0%,#120f18_100%)] shadow-[0_12px_30px_rgba(36,31,46,0.24)]">
        <div className="relative overflow-hidden p-[18px]">
          {/* Le halo framboise : la seule couleur chaude de l'application,
              réservée à ce qui presse. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-[50px] -end-[40px] h-[150px] w-[150px] rounded-full bg-[radial-gradient(circle,var(--color-live-tint),transparent_66%)]"
          />

          <div className="relative flex items-end justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-block rounded-full border border-[var(--color-live)]/45 bg-[var(--color-live-tint)] px-[9px] py-1 text-[0.5rem] font-extrabold tracking-[0.18em] text-[var(--color-live)] uppercase">
                {actif ? t.bf.now : t.bf.soon}
              </span>
              <h2
                id="titre-black-friday"
                className="mt-[9px] text-[1.6875rem] leading-[0.94] font-black tracking-[-0.045em] text-white"
              >
                BLACK
                <br />
                FRIDAY
              </h2>
              <p className="mt-[10px] text-[0.75rem] font-semibold text-white/80">
                {actif && meilleure > 0 ? format(t.bf.homeUpTo, { n: meilleure }) : t.bf.homeSoon}
              </p>
            </div>

            <div className="flex flex-none flex-col items-end gap-[10px]">
              <CompteARebours
                cible={actif ? campagne.fin : campagne.debut}
                serveurMaintenant={etat.maintenant}
                libelle={actif ? t.bf.endsIn : t.bf.startsIn}
                variante="sombre"
                boites
              />
              <Link
                href="/black-friday"
                className="press rounded-full bg-white px-[14px] py-[8px] text-[0.6875rem] font-bold whitespace-nowrap text-[#0d0b10]"
              >
                {actif ? t.bf.seeAll : t.bf.learnMore}
              </Link>
            </div>
          </div>
        </div>

        {actif && (
          <Rail gap={10} className="px-[18px] pb-[18px]">
            {offres.map((offre, i) => (
              <CarteBlackFriday key={offre.id} offre={offre} locale={locale} priorite={i < 2} />
            ))}
          </Rail>
        )}
      </div>
    </section>
  );
}
