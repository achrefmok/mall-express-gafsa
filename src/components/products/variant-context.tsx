"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
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
  productId: string;
  colors: string[];
  images: string[];
  variantImages: VariantImages;
  color: string | null;
  setColor: (color: string | null) => void;
  /** Enregistre une image fabriquée à l'instant, pour ne plus la redemander. */
  noterFabriquee: (color: string, url: string) => void;
}

const VariantContext = createContext<VariantValue | null>(null);

export function VariantProvider({
  productId,
  colors,
  images,
  variantImages,
  children,
}: {
  productId: string;
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

    Une seule couleur déclarée fait exception : il n'y a rien à choisir, c'est
    la couleur de l'article. La retenir d'emblée évite un panier qui prétend
    l'ignorer alors que la fiche n'en propose pas d'autre.
  */
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);

  /*
    Les images fabriquées pendant la visite.

    Le serveur les enregistre en base, mais la page a déjà été rendue : sans ce
    relevé local, revenir sur un coloris qu'on vient de faire fabriquer
    relancerait un appel pour s'entendre répondre la même adresse. On les
    superpose donc à ce que le serveur avait envoyé, et la fiche apprend au fur
    et à mesure de ce que le client regarde.
  */
  const [fabriquees, setFabriquees] = useState<VariantImages>({});

  const noterFabriquee = useCallback((couleur: string, url: string) => {
    setFabriquees((f) => (f[couleur]?.url === url ? f : { ...f, [couleur]: { url, generated: true } }));
  }, []);

  const value = useMemo<VariantValue>(
    () => ({
      productId,
      colors,
      images,
      // Ce que le vendeur a déposé l'emporte : une vraie photo arrivée entre-temps
      // ne doit pas être recouverte par une fabrication de cette visite.
      variantImages: { ...fabriquees, ...variantImages },
      color,
      setColor,
      noterFabriquee,
    }),
    [productId, colors, images, variantImages, fabriquees, color, noterFabriquee],
  );

  return <VariantContext.Provider value={value}>{children}</VariantContext.Provider>;
}

export function useVariant() {
  const ctx = useContext(VariantContext);
  if (!ctx) throw new Error("useVariant doit être utilisé sous <VariantProvider>");
  return ctx;
}
