"use client";

import { useEffect, useState } from "react";
import { decompte, formatDecompte } from "@/lib/black-friday";

/**
 * « Démarre dans 02h 14m 31s ».
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi un compte à rebours, et pas une date
 * ────────────────────────────────────────────────────────────────────────
 *
 * « Demain à 9 h » demande un calcul : quel jour sommes-nous, quelle heure
 * est-il, combien de temps me reste-t-il pour autre chose. « Dans 2 h 14 » ne
 * demande rien — et c'est la question qu'on se pose vraiment devant une vente
 * annoncée. C'est aussi ce qui fait revenir : une durée qui fond donne envie
 * de rester, une date fixe donne envie d'oublier.
 *
 * Le rendu est différé au montage : l'heure du serveur et celle du téléphone
 * ne sont jamais identiques, et un compte à rebours calculé pendant le rendu
 * serveur ferait diverger le premier affichage du navigateur — l'avertissement
 * d'hydratation de React, et une valeur fausse d'une seconde ou deux.
 *
 * Le pas est d'une seconde sous le jour, d'une minute au-delà : afficher des
 * secondes sur trois jours fait clignoter un écran que personne ne regarde.
 */
export function AvantDebut({
  debut,
  prefixe = "Démarre dans",
  className,
  /** Appelé quand l'échéance passe : la page peut se rafraîchir. */
  auDebut,
}: {
  debut: string;
  prefixe?: string;
  className?: string;
  auDebut?: () => void;
}) {
  const [reste, setReste] = useState<number | null>(null);

  useEffect(() => {
    const echeance = new Date(debut).getTime();
    if (Number.isNaN(echeance)) return;

    const majour = () => {
      const restant = echeance - Date.now();
      setReste(restant);
      if (restant <= 0) auDebut?.();
      return restant;
    };

    if (majour() <= 0) return;

    const pas = echeance - Date.now() > 86_400_000 ? 60_000 : 1_000;
    const minuterie = setInterval(() => {
      if (majour() <= 0) clearInterval(minuterie);
    }, pas);

    return () => clearInterval(minuterie);
  }, [debut, auDebut]);

  if (reste === null || reste <= 0) return null;

  return (
    <span className={className}>
      {prefixe}{" "}
      {/* Un décompte se lit de gauche à droite, même en arabe. */}
      <span dir="ltr" className="font-bold tabular-nums">
        {formatDecompte(decompte(reste))}
      </span>
    </span>
  );
}
