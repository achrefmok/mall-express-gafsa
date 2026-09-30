#!/usr/bin/env node
/**
 * Vérifie le contraste WCAG de chaque paire texte/fond déclarée par chaque
 * thème de boutique — en clair et en sombre — et échoue (code de sortie 1)
 * si une paire tombe sous le seuil AA.
 *
 * Volontairement séparé d'un test Vitest : ce script tourne aussi bien en
 * développement (`npm run check:theme-contrast`) qu'en CI, sans dépendre du
 * reste de la suite, et sa sortie est lisible par un humain — le format
 * attendu de `npm run check`, voir les autres scripts de `scripts/`.
 */

import { THEMES } from "../src/lib/boutique-themes/index.js";

/*
  Une couleur peut être un hex (#rrggbb) ou une rgba() translucide — les
  jetons `accentDoux` en sont toujours une, posée par-dessus le fond de la
  page. On la compose avec ce fond avant de mesurer quoi que ce soit :
  mesurer la rgba seule reviendrait à ignorer ce que l'œil voit vraiment.
*/
function versRgb(couleur, fond) {
  const rgba = couleur.match(/rgba?\(([^)]+)\)/);
  if (!rgba) return hexToRgb(couleur);

  const [r, g, b, a = "1"] = rgba[1].split(",").map((s) => s.trim());
  const alpha = parseFloat(a);
  const avantPlan = [Number(r), Number(g), Number(b)];
  if (alpha >= 1 || !fond) return avantPlan;

  const arriere = hexToRgb(fond);
  return avantPlan.map((c, i) => c * alpha + arriere[i] * (1 - alpha));
}

/** Luminance relative WCAG — la formule elle-même, pas une approximation. */
function luminance(couleur, fond) {
  const [r, g, b] = versRgb(couleur, fond).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/**
 * Le ratio WCAG entre deux couleurs, toujours ≥ 1. `fond` sert à composer
 * une couleur translucide (`accentDoux`, en rgba) — sans lui, une couleur
 * pleine se compose avec elle-même sans effet.
 */
export function contraste(a, b, fond) {
  const l1 = luminance(a, fond ?? b);
  const l2 = luminance(b, fond ?? a);
  const [clair, sombre] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (clair + 0.05) / (sombre + 0.05);
}

/*
  Les paires à vérifier pour chaque mode d'un thème. `grand` = seuil AA de
  3:1 (texte ≥ 24px ou ≥ 19px gras — titres, prix) ; sinon 4.5:1 (texte
  courant). Une paire absente d'un thème (ex. pas de `accentFort`) est
  simplement ignorée plutôt que de faire échouer le script sur une valeur
  optionnelle.
*/
const PAIRES = [
  { nom: "texte sur fond", de: "text", vers: "background", seuil: 4.5 },
  { nom: "texte sur surface", de: "text", vers: "surface", seuil: 4.5 },
  { nom: "muted sur fond", de: "muted", vers: "background", seuil: 4.5 },
  { nom: "muted sur surface", de: "muted", vers: "surface", seuil: 4.5 },
  { nom: "texte blanc/sombre sur accent (bouton plein)", de: "accentTexte", vers: "accent", seuil: 4.5 },
  { nom: "accent sur fond (titre, grand)", de: "accent", vers: "background", seuil: 3 },
  { nom: "accentFort sur accentDoux (badge)", de: "accentFort", vers: "accentDoux", seuil: 4.5, composite: true },
];

function verifierMode(id, mode, palette) {
  const problemes = [];
  for (const paire of PAIRES) {
    const de = palette[paire.de];
    const vers = palette[paire.vers];
    if (!de || !vers) continue;
    const ratio = paire.composite
      ? contraste(de, vers, palette.background)
      : contraste(de, vers);
    if (ratio < paire.seuil) {
      problemes.push(
        `  ✗ [${id}/${mode}] ${paire.nom} : ${de} sur ${vers} → ${ratio.toFixed(2)}:1 (minimum ${paire.seuil}:1)`,
      );
    }
  }
  return problemes;
}

let total = 0;
let echecs = [];

for (const theme of Object.values(THEMES)) {
  total += 1;
  echecs.push(...verifierMode(theme.id, "clair", theme.palettes.clair));
  echecs.push(...verifierMode(theme.id, "sombre", theme.palettes.sombre));
}

console.log(`Thèmes vérifiés : ${total} (clair + sombre = ${total * 2} palettes)`);

if (echecs.length > 0) {
  console.log(`\n${echecs.length} paire(s) sous le seuil AA :\n`);
  echecs.forEach((l) => console.log(l));
  process.exit(1);
}

console.log("Toutes les paires vérifiées respectent le seuil AA. ✓");
