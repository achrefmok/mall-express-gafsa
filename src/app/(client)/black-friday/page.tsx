import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatDate } from "@/lib/format";
import { lireEtatBlackFriday, lireOffresActives } from "@/lib/black-friday-server";
import { TopBar } from "@/components/shell/top-bar";
import { CompteARebours } from "@/components/black-friday/countdown";
import { CarteBlackFriday } from "@/components/black-friday/bf-card";
import { BoutonPartage } from "@/components/black-friday/share-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.bf.title, description: t.bf.metaDescription };
}

/*
  Dynamique, et c'est obligatoire.

  Cette page change d'état à 00:01 le vendredi et à 00:01 le samedi. Une
  version mise en cache ne serait pas « un peu périmée » : elle montrerait des
  offres terminées à des clients qui les paieraient au prix normal, ou
  cacherait des offres ouvertes. L'heure qui fait foi est celle de la requête.
*/
export const dynamic = "force-dynamic";

export default async function PageBlackFriday() {
  const { t, locale } = await getT();
  const [etat, offres] = await Promise.all([lireEtatBlackFriday(), lireOffresActives(60)]);

  const c = etat.campagne;
  const meilleure = Math.max(0, ...offres.map((o) => o.reduction ?? 0));

  return (
    <>
      <TopBar title={t.bf.title} back="/accueil" />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto pb-6">
        <header className="mx-4 mt-2 overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#0d0b10_0%,#241f2e_55%,#5a3a78_100%)] p-5 text-white">
          <p className="text-[0.625rem] font-bold tracking-[0.16em] text-white/60 uppercase">
            {t.brand.first}{t.brand.second}
          </p>
          <h1 className="mt-1 text-[2rem] leading-none font-extrabold tracking-[-0.03em]">
            <span aria-hidden>🔥 </span>BLACK FRIDAY
          </h1>

          <p className="mt-2 max-w-[34ch] text-[0.8125rem] leading-[1.5] text-white/80">
            {!c && t.bf.noCampaign}
            {c?.phase === "avant" && format(t.bf.upcoming, { date: formatDate(c.debut, locale) })}
            {c?.phase === "actif" &&
              (meilleure > 0 ? format(t.bf.upTo, { n: meilleure }) : t.bf.activeGeneric)}
            {c?.phase === "termine" && t.bf.ended}
          </p>

          {c && c.phase !== "termine" && (
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-white/12 pt-4">
              <CompteARebours
                cible={c.phase === "actif" ? c.fin : c.debut}
                serveurMaintenant={etat.maintenant}
                libelle={c.phase === "actif" ? t.bf.endsIn : t.bf.startsIn}
                variante="sombre"
              />
              <BoutonPartage
                chemin="/black-friday"
                titre={t.bf.shareTitle}
                texte={meilleure > 0 ? format(t.bf.shareUpTo, { n: meilleure }) : t.bf.shareGeneric}
                image="/partage/black-friday/campagne"
                clair
              />
            </div>
          )}
        </header>

        {c?.phase === "actif" && offres.length > 0 && (
          <section aria-label={t.bf.offersLabel} className="px-4">
            <p className="mb-3 text-[0.75rem] font-semibold text-[var(--color-muted)]">
              {format(t.bf.offersCount, { n: offres.length })}
            </p>
            {/*
              Une grille qui s'adapte, pas un rail.

              L'accueil montre un avant-goût qui défile ; ici, on est venu pour
              comparer. Deux colonnes sur téléphone, quatre à six sur grand
              écran, et toutes les offres d'un coup d'œil.
            */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] justify-items-center gap-3">
              {offres.map((offre, i) => (
                <CarteBlackFriday key={offre.id} offre={offre} locale={locale} priorite={i < 4} />
              ))}
            </div>
          </section>
        )}

        {c?.phase === "actif" && offres.length === 0 && (
          <p className="mx-4 rounded-[16px] bg-[var(--color-surface-solid)] p-4 text-center text-[0.8125rem] text-[var(--color-muted)]">
            {t.bf.preparing}
          </p>
        )}

        {(c?.phase === "avant" || c?.phase === "termine" || !c) && (
          <Link
            href="/marketplace"
            className="press mx-4 flex min-h-12 items-center justify-center rounded-[16px] bg-[var(--color-brand-fill)] text-[0.8125rem] font-bold text-white"
          >
            {t.bf.browse}
          </Link>
        )}
      </div>
    </>
  );
}
