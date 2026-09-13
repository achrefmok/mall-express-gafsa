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


  return (
    <>
      {/*
        L'écran taxi respire plus large que le reste de l'application.

        `col-reading` borne la lecture à une colonne de texte confortable, ce qui
        est juste pour un article et faux pour une carte : à quatre cent
        cinquante pixels, on ne situe rien. La largeur maximale double donc ici,
        et c'est le seul écran client dans ce cas.
      */}
      {/*
        `overflow-hidden` et `min-h-0`, et non plus `overflow-y-auto`.

        La carte réclame désormais la hauteur restante. Dans un conteneur qui
        défile, un enfant en `flex-1` ne se borne à rien : il prend sa hauteur
        naturelle, pousse le conteneur, et la carte finit sous la barre
        d'onglets. Le défilement descend donc d'un cran — il vit maintenant
        dans le panneau, qui est le seul contenu qui puisse être plus long que
        l'écran.
      */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 flex-col gap-2 overflow-hidden px-4 pt-1 pb-2">
        {/*
          Un en-tête réduit au strict nécessaire.

          Il portait aussi le nombre de chauffeurs libres. Ce compteur est
          passé sur la carte, où il est à sa place : c'est une information de
          carte, elle change avec elle, et la répéter deux fois à trois
          centimètres d'écart n'apprenait rien de plus tout en volant de la
          hauteur à ce que l'on est venu regarder.
        */}
        <header className="flex-none">
          <p className="text-[0.53125rem] font-bold tracking-[0.1em] text-[var(--color-faint)] uppercase">
            {t.taxi.services}
          </p>
          <h1 className="text-[1.25rem] leading-[1.15] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
            {t.taxi.title}
          </h1>
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
