import { notFound } from "next/navigation";
import { PreviewFrame } from "./preview-frame";

/**
 * Un aperçu mobile intégré au site, sans extension ni outil tiers.
 *
 * Les extensions de prévisualisation chargent la page dans une iframe depuis
 * leur propre contexte, et se heurtent soit à nos en-têtes d'encadrement, soit à
 * leurs propres restrictions sur `localhost`. Servi depuis le site, l'aperçu est
 * de même origine : `frame-ancestors 'self'` l'autorise sans qu'on ait à
 * assouplir quoi que ce soit.
 *
 * Il ne rend pas les outils du navigateur inutiles — ceux-ci restent supérieurs
 * pour inspecter le DOM ou simuler un réseau lent. Il répond à un autre besoin :
 * voir plusieurs largeurs côte à côte, sans quitter l'application.
 *
 * Introuvable en production. Ce n'est pas une page pour les clients, et une
 * adresse qui affiche le site dans le site n'a rien à faire dans un index de
 * moteur de recherche.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <PreviewFrame />;
}
