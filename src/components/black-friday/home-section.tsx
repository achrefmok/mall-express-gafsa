import Link from "next/link";
import { Rail } from "@/components/ui/primitives";
import { CompteARebours } from "./countdown";
import { CarteBlackFriday } from "./bf-card";
import type { EtatBlackFriday, OffreVitrine } from "@/lib/black-friday-server";
import type { AppLocale } from "@/types/database";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";

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
    <section className="flex flex-col gap-3" aria-labelledby="titre-black-friday">
      <div className="mx-4 overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#0d0b10_0%,#241f2e_55%,#5a3a78_100%)] p-[18px] text-white shadow-[0_12px_32px_-12px_rgba(13,11,16,0.6)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.625rem] font-bold tracking-[0.16em] text-white/60 uppercase">
              {actif ? t.bf.now : t.bf.soon}
            </p>
            <h2
              id="titre-black-friday"
              className="mt-[2px] text-[1.5rem] leading-none font-extrabold tracking-[-0.02em]"
            >
              <span aria-hidden>🔥 </span>BLACK FRIDAY
            </h2>
            {actif && meilleure > 0 && (
              <p className="mt-[6px] text-[0.8125rem] font-semibold text-white/85">
                {format(t.bf.homeUpTo, { n: meilleure })}
              </p>
            )}
            {!actif && (
              <p className="mt-[6px] text-[0.8125rem] font-semibold text-white/85">
                {t.bf.homeSoon}
              </p>
            )}
          </div>

          <Link
            href="/black-friday"
            className="press flex-none rounded-full bg-white px-[14px] py-[8px] text-[0.71875rem] font-bold text-[#0d0b10]"
          >
            {actif ? t.bf.seeAll : t.bf.learnMore}
          </Link>
        </div>

        <div className="mt-[14px] border-t border-white/12 pt-[12px]">
          <CompteARebours
            cible={actif ? campagne.fin : campagne.debut}
            serveurMaintenant={etat.maintenant}
            libelle={actif ? t.bf.endsIn : t.bf.startsIn}
            variante="sombre"
          />
        </div>
      </div>

      {actif && (
        <Rail gap={10} className="px-4 pb-[2px]">
          {offres.map((offre, i) => (
            <CarteBlackFriday key={offre.id} offre={offre} locale={locale} priorite={i < 2} />
          ))}
        </Rail>
      )}
    </section>
  );
}
