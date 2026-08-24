import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TaxiClient } from "@/components/taxi/taxi-client";

export const metadata: Metadata = {
  title: "Taxi",
  description: "Trouvez un taxi libre à Gafsa : qui est disponible, où il se trouve, et son numéro.",
};

export const dynamic = "force-dynamic";

/**
 * Écran taxi côté client.
 *
 * Les chauffeurs non approuvés sont écartés par la policy de la table, pas par
 * cette requête : la plateforme met en avant des inconnus auprès de ses clients,
 * et cette garantie doit tenir même si quelqu'un interroge l'API directement.
 */
export default async function TaxiPage() {
  const { t } = await getT();
  const supabase = await createClient();

  const profile = await getProfile();

  const [{ data: drivers }, mine] = await Promise.all([
    supabase
      .from("taxi_drivers")
      /*
        `select("*")` plutôt que la liste des colonnes.

        Les places, l'heure de libération et l'accord de prendre quelqu'un en
        route n'existent qu'après la migration. Nommer une colonne absente fait
        échouer *toute* la requête — donc l'écran entier, pas seulement les
        places. L'étoile ramène ce qui existe, et l'affichage s'accommode du
        reste.
      */
      .select("*")
      .eq("is_approved", true)
      .order("is_available", { ascending: false }),

    /*
      L'espace chauffeur n'existe que pour qui a reçu l'accès.

      Un membre qui conduit un taxi contacte l'administration, qui lui ouvre la
      porte. Afficher le lien à tout le monde reviendrait à proposer une
      fonctionnalité qui ne concerne presque personne, et à remplir la file de
      vérification de comptes qui se sont inscrits par curiosité.
    */
    profile
      ? supabase
          .from("taxi_drivers")
          .select("id")
          .eq("id", profile.id)
          .maybeSingle()
          .then(({ data }) => Boolean(data))
      : Promise.resolve(false),
  ]);

  const libres = (drivers ?? []).filter((d) => d.is_available).length;

  return (
    <>
      {/*
        L'écran taxi respire plus large que le reste de l'application.

        `col-reading` borne la lecture à une colonne de texte confortable, ce qui
        est juste pour un article et faux pour une carte : à quatre cent
        cinquante pixels, on ne situe rien. La largeur maximale double donc ici,
        et c'est le seul écran client dans ce cas.
      */}
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1">
        {/*
          Un en-tête compact : la famille de service, le nom, et l'essentiel —
          combien de chauffeurs sont libres à cette seconde.
        */}
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[0.53125rem] font-bold tracking-[0.1em] text-[var(--color-faint)] uppercase">
              {t.taxi.services}
            </p>
            <h1 className="flex items-baseline gap-[7px] text-[1.375rem] leading-[1.15] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
              {t.taxi.title}
              <span className="text-[0.6875rem] font-semibold text-[var(--color-faint)]">
                · تاكسي قفصة
              </span>
            </h1>
          </div>

          <span className="flex items-center gap-[7px] rounded-full bg-[var(--color-surface-solid)] px-[11px] py-[6px] text-[0.59375rem] font-bold text-[var(--color-ink)] shadow-[0_3px_10px_rgba(60,40,90,0.08)]">
            <span
              aria-hidden
              className="h-[6px] w-[6px] rounded-full"
              style={{ background: libres > 0 ? "var(--color-ok, #2f7d5d)" : "var(--color-faint)" }}
            />
            {t.taxi.freeCount.replace("{n}", String(libres))}
          </span>
        </header>

        <TaxiClient
          initialDrivers={drivers ?? []}
          clientId={profile?.id ?? null}
          espaceChauffeur={mine}
        />
      </div>
    </>
  );
}
