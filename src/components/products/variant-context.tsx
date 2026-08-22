"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { VariantImages } from "@/types/database";

/**
 * La couleur choisie, partagée entre la galerie et les sélecteurs.
 *
 * Les deux vivent aux deux extrémités de la fiche — la galerie en haut, les
 * pastilles de couleur juste avant le bouton d'achat — et doivent pourtant
 * décrire le même article. Un état local dans l'un des deux aurait obligé à
 * rassembler toute la fiche dans un seul composant client, ce qui aurait retiré
 * du rendu serveur le titre, le prix et la description : exactement ce que
 * Google lit sur la page qui l'amène ici.
 *
 * Le fournisseur enveloppe donc la fiche entière et laisse passer les parties
 * serveur par `children`. Seuls les deux îlots qui ont besoin de la couleur
 * s'abonnent.
 */

interface VariantValue {
  colors: string[];
  images: string[];
  variantImages: VariantImages;
  color: string | null;
  setColor: (color: string | null) => void;
}

const VariantContext = createContext<VariantValue | null>(null);

export function VariantProvider({
  colors,
  images,
  variantImages,
  children,
}: {
  colors: string[];
  images: string[];
  variantImages: VariantImages;
  children: React.ReactNode;
}) {
  /*
    Aucune couleur présélectionnée.

    La fiche s'ouvrait sur `colors[0]`, ce qui affichait un choix que personne
    n'avait fait — et l'ajout au panier enregistrait cette couleur par défaut.
    Un client qui n'avait pas regardé les pastilles commandait donc la première
    de la liste. Tant que rien n'est touché, la galerie montre l'article dans
    son ensemble et le panier ne retient pas de couleur.
  */
  const [color, setColor] = useState<string | null>(null);

  const value = useMemo<VariantValue>(
    () => ({ colors, images, variantImages, color, setColor }),
    [colors, images, variantImages, color],
  );

  return <VariantContext.Provider value={value}>{children}</VariantContext.Provider>;
}

export function useVariant() {
  const ctx = useContext(VariantContext);
  if (!ctx) throw new Error("useVariant doit être utilisé sous <VariantProvider>");
  return ctx;
}
