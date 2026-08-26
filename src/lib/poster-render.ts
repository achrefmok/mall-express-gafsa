/**
 * Peindre l'affiche sur un canvas.
 *
 * Ce module ne décide de rien : la géométrie vient de `poster.ts`, qui est
 * testé, et les couleurs de ses thèmes. Ici on remplit des rectangles déjà
 * calculés — c'est délibéré, parce que ce qui se dessine ne se vérifie pas
 * automatiquement, alors qu'un rectangle, si.
 *
 * Le fichier ne s'exécute que dans un navigateur : il touche `document`,
 * `Image` et `OffscreenCanvas`. Les écrans qui l'utilisent sont marqués
 * `"use client"`.
 */

import {
  FORMATS,
  THEMES,
  disposition,
  prixAffiche,
  type CleFormat,
  type CleTheme,
  type Cadre,
} from "./poster";
import { formatPrice } from "./format";
import type { AppLocale } from "@/types/database";

export interface ProduitAffiche {
  id: string;
  nom: string;
  prix: number;
  comparaison: number | null;
  /** URL publique de la photo. `null` : le produit n'en a pas. */
  image: string | null;
}

export interface OptionsAffiche {
  format: CleFormat;
  theme: CleTheme;
  boutique: string;
  telephone: string | null;
  /** Phrase d'accroche saisie par le vendeur. Vide : on n'écrit rien. */
  accroche: string;
  produits: ProduitAffiche[];
  locale: AppLocale;
  /** Photos déjà chargées, par identifiant de produit. */
  images: Map<string, CanvasImageSource>;
}

/*
  Une pile de polices, et non une police.

  L'affiche est rendue sur le téléphone du vendeur, pas sur un serveur : on
  n'en contrôle donc pas les polices installées. La pile part des sans-serif
  système, qui existent partout et couvrent l'arabe sur Android comme sur iOS.
  Charger une police distante rendrait l'export dépendant du réseau au pire
  moment — celui où l'on appuie sur « Télécharger ».
*/
const PILE = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const police = (taille: number, graisse = 700) => `${graisse} ${Math.round(taille)}px ${PILE}`;

/**
 * Charger les photos sans salir le canvas.
 *
 * Une image posée sur un canvas depuis un autre domaine le « salit » : le
 * navigateur refuse ensuite `toBlob()`, et le téléchargement échoue au tout
 * dernier moment, sans message utile. Passer par `fetch` puis `createImageBitmap`
 * évite entièrement la question : ce sont des octets, plus une ressource
 * distante.
 *
 * Une photo qui manque n'interrompt rien. Le produit s'affichera avec sa
 * pastille de couleur et son nom — une affiche à laquelle il manque une image
 * reste publiable, une affiche qui refuse de se générer ne l'est pas.
 */
export async function chargerImages(
  produits: ProduitAffiche[],
): Promise<Map<string, CanvasImageSource>> {
  const paires = await Promise.all(
    produits.map(async (produit) => {
      if (!produit.image) return null;

      try {
        const reponse = await fetch(produit.image, { mode: "cors", cache: "force-cache" });
        if (!reponse.ok) return null;

        const bitmap = await createImageBitmap(await reponse.blob());
        return [produit.id, bitmap as CanvasImageSource] as const;
      } catch {
        return null;
      }
    }),
  );

  return new Map(paires.filter((p): p is readonly [string, CanvasImageSource] => p !== null));
}

/** Un rectangle aux coins arrondis, avec repli pour les navigateurs anciens. */
function cheminArrondi(ctx: CanvasRenderingContext2D, c: Cadre, rayon: number) {
  const r = Math.min(rayon, c.w / 2, c.h / 2);
  ctx.beginPath();

  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(c.x, c.y, c.w, c.h, r);
    return;
  }

  ctx.moveTo(c.x + r, c.y);
  ctx.arcTo(c.x + c.w, c.y, c.x + c.w, c.y + c.h, r);
  ctx.arcTo(c.x + c.w, c.y + c.h, c.x, c.y + c.h, r);
  ctx.arcTo(c.x, c.y + c.h, c.x, c.y, r);
  ctx.arcTo(c.x, c.y, c.x + c.w, c.y, r);
  ctx.closePath();
}

/**
 * Dessiner une image en « couvrant » son cadre.
 *
 * Le comportement d'un `object-fit: cover` : on remplit tout le cadre et l'on
 * rogne le débord, plutôt que de déformer. Une chemise étirée en largeur pour
 * tenir dans un carré est une chemise que personne n'achète.
 */
function dessinerCouvrant(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  c: Cadre,
) {
  const largeur = "width" in image ? Number(image.width) : 0;
  const hauteur = "height" in image ? Number(image.height) : 0;
  if (!largeur || !hauteur) return;

  const echelle = Math.max(c.w / largeur, c.h / hauteur);
  const l = largeur * echelle;
  const h = hauteur * echelle;

  ctx.drawImage(image, c.x + (c.w - l) / 2, c.y + (c.h - h) / 2, l, h);
}

/**
 * Écrire un texte qui tient, en réduisant puis en tronquant.
 *
 * Les noms de produits vont de « Sac » à « Ensemble deux pièces en lin brodé
 * main, coloris sable ». Une taille fixe rend l'un ridicule et fait déborder
 * l'autre. On réduit donc jusqu'à un plancher lisible, et seulement au-delà on
 * coupe — dans cet ordre, parce qu'un nom entier en petit vaut mieux qu'un nom
 * tronqué en grand.
 */
function texteAjuste(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  largeurMax: number,
  taille: number,
  graisse = 700,
  plancher = 0.62,
) {
  let actuelle = taille;

  ctx.font = police(actuelle, graisse);
  while (ctx.measureText(texte).width > largeurMax && actuelle > taille * plancher) {
    actuelle -= 1;
    ctx.font = police(actuelle, graisse);
  }

  let final = texte;
  if (ctx.measureText(final).width > largeurMax) {
    while (final.length > 1 && ctx.measureText(`${final}…`).width > largeurMax) {
      final = final.slice(0, -1);
    }
    final = `${final}…`;
  }

  ctx.fillText(final, x, y);
  return actuelle;
}

/** Une pastille pleine, aux bouts ronds, calibrée sur son texte. */
function pastille(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  taille: number,
  fond: string,
  encre: string,
  /*
    Par quoi `y` est-il tenu ?

    Le ruban de remise se pose à une distance connue du haut de sa carte ; le
    numéro de téléphone, lui, doit être centré sur son bandeau. Sans ce choix,
    la pastille du numéro remontait au-dessus de la ligne du pied et venait
    mordre sur la dernière photo — une superposition qu'on ne voit qu'en
    regardant l'image, jamais en lisant le code.
  */
  ancrage: "haut" | "milieu" = "haut",
) {
  ctx.font = police(taille, 800);
  const l = ctx.measureText(texte).width;
  const padH = taille * 0.62;
  const padV = taille * 0.4;
  const largeur = l + padH * 2;
  const hauteur = taille + padV * 2;
  const haut = ancrage === "milieu" ? y - hauteur / 2 : y;

  ctx.fillStyle = fond;
  cheminArrondi(ctx, { x, y: haut, w: largeur, h: hauteur }, hauteur / 2);
  ctx.fill();

  ctx.fillStyle = encre;
  ctx.textAlign = "start";
  ctx.textBaseline = "middle";
  ctx.fillText(texte, x + padH, haut + hauteur / 2);

  return { largeur, hauteur };
}

/**
 * Peindre l'affiche complète.
 *
 * Le canvas est dimensionné ici, aux pixels réels du format exporté. La taille
 * d'affichage à l'écran est affaire de CSS : dessiner à la taille de l'aperçu
 * produirait un fichier de 340 px de large, inutilisable une fois publié.
 */
export function dessinerAffiche(canvas: HTMLCanvasElement, options: OptionsAffiche) {
  const format = FORMATS[options.format];
  const theme = THEMES[options.theme];
  const produits = options.produits.slice(0, 6);
  const plan = disposition(produits.length, format);

  canvas.width = format.largeur;
  canvas.height = format.hauteur;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, format.largeur, format.hauteur);

  /* ─── Le fond ──────────────────────────────────────────────────────── */

  const degrade = ctx.createLinearGradient(0, 0, format.largeur * 0.35, format.hauteur);
  degrade.addColorStop(0, theme.fond[0]);
  degrade.addColorStop(1, theme.fond[1]);
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, format.largeur, format.hauteur);

  /*
    Deux halos très diffus.

    Un aplat de dégradé seul paraît plat une fois posé dans un fil d'actualité
    saturé de photos. Deux taches de lumière donnent de la profondeur sans rien
    ajouter à lire, et coûtent deux appels de dessin.
  */
  for (const [cx, cy, r, alpha] of [
    [format.largeur * 0.85, format.hauteur * 0.08, format.largeur * 0.55, 0.14],
    [format.largeur * 0.1, format.hauteur * 0.92, format.largeur * 0.45, 0.1],
  ] as const) {
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    halo.addColorStop(0, theme.accent);
    halo.addColorStop(1, "transparent");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, format.largeur, format.hauteur);
    ctx.globalAlpha = 1;
  }

  const echelle = Math.min(format.largeur, format.hauteur) / 1080;
  ctx.direction = options.locale === "ar" ? "rtl" : "ltr";

  /* ─── L'en-tête ────────────────────────────────────────────────────── */

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  const { entete } = plan;
  const tailleNom = 58 * echelle * (format.cle === "paysage" ? 0.8 : 1);

  ctx.fillStyle = theme.encre;
  texteAjuste(ctx, options.boutique, entete.x, entete.y + tailleNom, entete.w, tailleNom, 800);

  if (options.accroche.trim()) {
    const tailleAccroche = 30 * echelle * (format.cle === "paysage" ? 0.85 : 1);
    ctx.fillStyle = theme.discret;
    texteAjuste(
      ctx,
      options.accroche.trim(),
      entete.x,
      entete.y + tailleNom + tailleAccroche * 1.5,
      entete.w,
      tailleAccroche,
      600,
    );
  }

  /* ─── Les produits ─────────────────────────────────────────────────── */

  const rayon = 34 * echelle;

  produits.forEach((produit, index) => {
    const cadre = plan.produits[index];
    if (!cadre) return;

    /*
      La bande de texte se mesure sur ce qu'elle contient.

      Elle valait auparavant une fraction de la hauteur de la carte. Sur une
      story à un seul produit, cette fraction donnait trois cent cinquante
      pixels pour deux lignes de texte : un trou noir entre le nom et le prix,
      qui ne se voyait qu'une fois l'affiche rendue. On additionne désormais les
      hauteurs réelles, et l'on plafonne à 42 % pour qu'une vignette de six ne
      soit pas mangée par sa propre légende.
    */
    const padTexte = 20 * echelle;
    const taillePrix = Math.max(
      20,
      (produits.length <= 2 ? 46 : produits.length <= 4 ? 36 : 30) * echelle,
    );
    const tailleNomProduit = Math.max(15, taillePrix * 0.56);

    const hTexte = Math.min(
      cadre.h * 0.42,
      padTexte * 1.5 + tailleNomProduit * 1.2 + taillePrix,
    );
    const zonePhoto: Cadre = { ...cadre, h: cadre.h - hTexte };

    ctx.save();
    cheminArrondi(ctx, cadre, rayon);
    ctx.fillStyle = theme.carte;
    ctx.fill();
    ctx.restore();

    /*
      La photo est découpée à sa zone, et non à la carte entière.

      « Couvrir » veut dire déborder : l'image dépasse toujours d'un côté, et le
      découpage à la carte laissait ce débord recouvrir la bande de texte. Le
      nom et le prix se retrouvaient écrits en blanc sur une photo claire,
      illisibles — sur toutes les affiches, sans qu'aucun test ne s'en plaigne.
    */
    ctx.save();
    cheminArrondi(ctx, cadre, rayon);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(zonePhoto.x, zonePhoto.y, zonePhoto.w, zonePhoto.h);
    ctx.clip();

    const image = options.images.get(produit.id);
    if (image) {
      dessinerCouvrant(ctx, image, zonePhoto);
    } else {
      /*
        Pas de photo : un aplat, et rien qui ressemble à une image cassée.

        Le produit garde sa place et son prix. Le vendeur voit immédiatement
        quel article manque d'une photo, ce qui est plus utile qu'un cadre vide.
      */
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(zonePhoto.x, zonePhoto.y, zonePhoto.w, zonePhoto.h);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    /* ─── Le ruban de remise ─────────────────────────────────────────── */

    const prix = prixAffiche(produit.prix, produit.comparaison);
    const tailleRuban = Math.max(18, 26 * echelle * (produits.length > 4 ? 0.8 : 1));

    if (prix.remise !== null) {
      ctx.save();
      pastille(
        ctx,
        `-${prix.remise} %`,
        cadre.x + 18 * echelle,
        cadre.y + 18 * echelle,
        tailleRuban,
        theme.accent,
        theme.surAccent,
      );
      ctx.restore();
    }

    /* ─── Nom et prix ────────────────────────────────────────────────── */

    const basTexte = cadre.y + cadre.h;
    const largeurTexte = cadre.w - padTexte * 2;

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = theme.encreCarte;
    ctx.globalAlpha = 0.78;
    texteAjuste(
      ctx,
      produit.nom,
      cadre.x + padTexte,
      cadre.y + zonePhoto.h + padTexte * 0.55 + tailleNomProduit,
      largeurTexte,
      tailleNomProduit,
      600,
    );
    ctx.globalAlpha = 1;

    ctx.fillStyle = theme.encreCarte;
    ctx.font = police(taillePrix, 800);
    const texteP = formatPrice(prix.actuel, options.locale);
    ctx.fillText(texteP, cadre.x + padTexte, basTexte - padTexte * 0.7);

    /*
      Le prix barré, à côté et seulement s'il y a la place.

      Sur une affiche à six produits, l'espace manque : on garde alors le prix
      réel seul. Un prix barré à moitié tronqué fait douter des deux chiffres.
    */
    if (prix.barre !== null) {
      const largeurP = ctx.measureText(texteP).width;
      const tailleBarre = taillePrix * 0.52;
      ctx.font = police(tailleBarre, 600);
      const texteB = formatPrice(prix.barre, options.locale);
      const largeurB = ctx.measureText(texteB).width;

      if (largeurP + 14 * echelle + largeurB <= largeurTexte) {
        const bx = cadre.x + padTexte + largeurP + 14 * echelle;
        const by = basTexte - padTexte * 0.7;

        ctx.globalAlpha = 0.55;
        ctx.fillStyle = theme.encreCarte;
        ctx.fillText(texteB, bx, by);

        ctx.strokeStyle = theme.encreCarte;
        ctx.lineWidth = Math.max(1.5, 2 * echelle);
        ctx.beginPath();
        ctx.moveTo(bx, by - tailleBarre * 0.3);
        ctx.lineTo(bx + largeurB, by - tailleBarre * 0.3);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  });

  /* ─── Le pied ──────────────────────────────────────────────────────── */

  const { pied } = plan;
  const taillePied = Math.max(18, 28 * echelle * (format.cle === "paysage" ? 0.85 : 1));

  ctx.textAlign = "start";
  ctx.textBaseline = "middle";

  if (options.telephone) {
    /*
      Le numéro en pastille pleine, pas en petit texte gris.

      C'est la seule chose que l'affiche demande de faire : appeler. Tout le
      reste — photos, prix, remises — sert à amener l'œil jusqu'ici.
    */
    pastille(
      ctx,
      options.telephone,
      pied.x,
      pied.y + pied.h / 2,
      taillePied,
      theme.accent,
      theme.surAccent,
      "milieu",
    );
  }

  ctx.fillStyle = theme.discret;
  ctx.font = police(taillePied * 0.78, 600);
  ctx.textAlign = "end";
  ctx.fillText("Mall Express Gafsa", pied.x + pied.w, pied.y + pied.h / 2);
  ctx.textAlign = "start";
}

/**
 * Le fichier à télécharger.
 *
 * PNG et non JPEG : les aplats et le texte d'une affiche sont exactement ce que
 * le JPEG dégrade le plus visiblement, avec des halos autour des lettres. Le
 * fichier est plus lourd, mais il est publié une fois et regardé mille.
 */
export function versBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
