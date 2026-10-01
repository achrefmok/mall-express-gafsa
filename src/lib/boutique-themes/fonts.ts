import { Amiri, Changa, El_Messiri, Lalezar, Reem_Kufi } from "next/font/google";

/**
 * Les polices de titre des thèmes, auto-hébergées comme Cairo
 * (`src/app/layout.tsx`) — jamais une feuille de style chargée depuis
 * Google au premier rendu. Chacune n'apporte que les poids réellement
 * utilisés par son thème, pour ne pas alourdir le paquet d'une page qui
 * n'affiche jamais qu'une seule police de titre à la fois.
 *
 * `variable` enregistre une propriété CSS (`--font-amiri`…) sur l'élément
 * qui porte la classe — jamais le nom de la police lui-même : un thème ne
 * peut donc pas simplement écrire `"Amiri"` dans son `fontFamily`, il doit
 * référencer `var(--font-amiri)`. Voir chaque fichier de thème.
 */
export const amiri = Amiri({
  subsets: ["latin", "arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const changa = Changa({
  subsets: ["latin", "arabic"],
  weight: ["600", "700"],
  variable: "--font-changa",
  display: "swap",
});

export const elMessiri = El_Messiri({
  subsets: ["latin", "arabic"],
  weight: ["600"],
  variable: "--font-el-messiri",
  display: "swap",
});

export const lalezar = Lalezar({
  subsets: ["latin", "arabic"],
  weight: ["400"],
  variable: "--font-lalezar",
  display: "swap",
});

export const reemKufi = Reem_Kufi({
  subsets: ["latin", "arabic"],
  weight: ["500"],
  variable: "--font-reem-kufi",
  display: "swap",
});

/**
 * À poser sur l'élément racine de toute page qui affiche une boutique
 * thématisée (la page boutique elle-même, et le labo de prévisualisation) :
 * sans cette classe, les variables CSS que les thèmes référencent n'existent
 * simplement pas, et chaque titre retombe silencieusement sur Cairo.
 */
export const POLICES_THEMES = [
  amiri.variable,
  changa.variable,
  elMessiri.variable,
  lalezar.variable,
  reemKufi.variable,
].join(" ");
