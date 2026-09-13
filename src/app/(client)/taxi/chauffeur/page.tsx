import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { DriverConsole } from "@/components/taxi/driver-console";
import { DriverInbox } from "@/components/taxi/driver-inbox";
import { DriverRequests } from "@/components/taxi/driver-requests";
import { DriverNearby } from "@/components/taxi/driver-nearby";
import { MotionProvider } from "@/components/ui/motion";

export const metadata: Metadata = {
  title: "Espace chauffeur",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * L'espace du chauffeur : sa fiche, sa disponibilité, sa position.
 *
 * Ouvert à tout compte connecté — c'est ainsi qu'un chauffeur s'inscrit. Ce
 * n'est pas une faille : la fiche reste invisible des clients tant que
 * l'administration ne l'a pas approuvée, et la policy interdit au chauffeur de
 * s'approuver lui-même.
 */
export default async function DriverPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/taxi/chauffeur");

  const { t } = await getT();
  const supabase = await createClient();

  const { data: driver } = await supabase
    .from("taxi_drivers")
    /*
      Toutes les colonnes, et non une liste.

      Les migrations sont collées à la main dans l'éditeur SQL de Supabase :
      nommer `status` ou `seats_free` ferait échouer la requête *entière* tant
      que le DDL n'est pas passé, et le chauffeur perdrait l'accès à son espace
      pour une colonne qu'il n'utilise pas encore. `*` rend le tout indifférent
      à l'ordre des deux opérations.
    */
    .select("*")
    .eq("id", profile.id)
    .maybeSingle();

  /*
    Pas de fiche, pas d'espace. L'accès s'ouvre depuis l'administration, jamais
    en devinant l'adresse — et la garde est ici, côté serveur, pas seulement dans
    le lien qu'on affiche ou non.
  */
  if (!driver) redirect("/taxi");

  return (
    <>
      <TopBar title={t.taxi.driverSpace} back="/taxi" />

      {/*
        Sans ce fournisseur, rien de cet écran ne s'animait.

        Les composants utilisent `m` — la version réduite de Framer Motion, qui
        attend son moteur d'un `LazyMotion` placé au-dessus. Sans lui, tout
        s'affiche au bon endroit et rien ne bouge : l'interrupteur à trois états
        sautait d'une position à l'autre, les cartes de demande apparaissaient
        d'un coup. Aucune erreur nulle part — la vue client, elle, avait son
        fournisseur, ce qui laissait croire que tout marchait.
      */}
      <MotionProvider>
        <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        {/*
          Les demandes de course passent avant tout le reste.

          C'est ici qu'atterrit la notification, et un chauffeur qui l'ouvre au
          feu rouge a quelques secondes : la course qu'on lui propose doit être
          la première chose sous son pouce, pas quelque chose à chercher sous sa
          fiche d'immatriculation.

          `Suspense` parce que le composant lit le paramètre d'adresse laissé
          par la notification ; sans lui, la page entière basculerait en rendu
          dynamique côté client.
        */}
        <Suspense fallback={null}>
          <DriverRequests driverId={profile.id} />
        </Suspense>

        {/*
          Chercher, et non plus seulement attendre.

          Les demandes ci-dessus sont celles qu'on lui a adressées. Celles-ci
          sont celles qu'il va chercher : les courses ouvertes autour de lui,
          qu'aucun appariement ne lui avait envoyées — parce qu'il n'avait pas
          déclaré de trajet, parce que sa zone ne correspondait pas, ou parce
          qu'elles sont nées avant qu'il ne se déclare libre.

          Placé juste après, et avant la fiche : un chauffeur qui ouvre cet
          écran cherche du travail. La plaque d'immatriculation attend.
        */}
        <DriverNearby />

        <DriverConsole initial={driver} />

        {/*
          Les messages viennent après la fiche, mais avant tout le reste.

          Un chauffeur ouvre cet écran pour deux choses : se déclarer libre, et
          voir qui le cherche. La seconde n'existait pas — les clients écrivaient
          dans le vide.
        */}
        <DriverInbox driverId={profile.id} />
        </div>
      </MotionProvider>
    </>
  );
}
