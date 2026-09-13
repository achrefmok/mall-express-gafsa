import "server-only";

import { ImageResponse } from "next/og";
import sharp from "sharp";
import { COULEURS_MARQUE, NOM_APPLICATION, lireLogo } from "@/lib/brand";

/**
 * Les images de partage, dans l'identité du mall.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qu'on voit quand on colle un lien
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un lien collé dans WhatsApp, Messenger ou Facebook s'affiche avec l'image
 * désignée par `og:image`. Le site n'en fournissait qu'une pour les fiches
 * produit — la photo brute, sans nom, sans prix, sans marque — et aucune
 * ailleurs : une boutique partagée arrivait en simple lien bleu.
 *
 * Ces cartes sont fabriquées à la demande, avec le logo de l'administration,
 * le nom, le prix, et la remise quand il y en a une.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Trois formats, une seule carte
 * ────────────────────────────────────────────────────────────────────────
 *
 *   · `og`    — 1200 × 630, l'aperçu d'un lien, attendu par tous les réseaux ;
 *   · `post`  — 1080 × 1350, le portrait d'un post Instagram ;
 *   · `story` — 1080 × 1920, le plein écran d'une story.
 *
 * Instagram ne lit pas les liens : il faut lui tendre une image. Les deux
 * formats verticaux sont faits pour ça, et c'est le bouton « Image » de
 * `BoutonPartage` qui les envoie à la feuille de partage du téléphone. Le
 * contenu est le même dans les trois ; seule la mise en page change —
 * l'image en tête plutôt qu'à côté, le texte plus grand, lisible sur un
 * téléphone tenu à bout de bras.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Deux contraintes du moteur de rendu
 * ────────────────────────────────────────────────────────────────────────
 *
 *   · il ne lit ni le WebP ni l'AVIF — or `upload.ts` enregistre souvent en
 *     WebP. Chaque image passe donc par `sharp`, qui la ramène en PNG à la
 *     taille exacte où elle sera dessinée ;
 *   · sa police par défaut n'a pas de glyphes arabes. On charge Cairo — la
 *     police de l'application — et l'on retombe sur la police par défaut si
 *     le chargement échoue : un aperçu en caractères latins vaut mieux
 *     qu'aucun aperçu.
 */

export const TAILLE_OG = { width: 1200, height: 630 };

export type FormatPartage = "og" | "post" | "story";

export const FORMATS_PARTAGE: Record<FormatPartage, { width: number; height: number }> = {
  og: TAILLE_OG,
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

async function enImage(url: string | null | undefined, largeur: number, hauteur = largeur): Promise<string | null> {
  if (!url) return null;
  try {
    const reponse = await fetch(url, { next: { revalidate: 3600 } });
    if (!reponse.ok) return null;
    const png = await sharp(Buffer.from(await reponse.arrayBuffer()))
      .resize(largeur, hauteur, { fit: "cover" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

async function enLogo(url: string | null, taille: number): Promise<string | null> {
  if (!url) return null;
  try {
    const reponse = await fetch(url, { next: { revalidate: 3600, tags: ["brand"] } });
    if (!reponse.ok) return null;
    const png = await sharp(Buffer.from(await reponse.arrayBuffer()))
      .resize(taille, taille, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Cairo en TTF, depuis Google Fonts.
 *
 * Sans en-tête de navigateur, l'API de Google Fonts sert du TrueType — le
 * seul format que ce moteur lit, avec l'OpenType. Gardé une journée.
 */
async function policeCairo(): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch("https://fonts.googleapis.com/css2?family=Cairo:wght@700", { next: { revalidate: 86400 } })
    ).text();
    const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    if (!url) return null;
    return await (await fetch(url, { next: { revalidate: 86400 } })).arrayBuffer();
  } catch {
    return null;
  }
}

export interface ContenuPartage {
  /** Un bandeau au-dessus du titre : « BLACK FRIDAY », « BOUTIQUE »… */
  bandeau?: string | null;
  titre: string;
  sousTitre?: string | null;
  image?: string | null;
  prix?: string | null;
  ancienPrix?: string | null;
  reduction?: number | null;
  /** L'habillage Black Friday : fond sombre. */
  sombre?: boolean;
  /** Par défaut, l'aperçu de lien. */
  format?: FormatPartage;
}

export async function carteDePartage(c: ContenuPartage): Promise<ImageResponse> {
  const format = c.format ?? "og";
  const taille = FORMATS_PARTAGE[format];
  const vertical = format !== "og";

  // L'image vit à côté du texte en paysage, au-dessus en portrait.
  const largeurImage = vertical ? taille.width - 2 * 72 : 470;
  const hauteurImage = format === "story" ? largeurImage : format === "post" ? 620 : 470;

  const [logo, image, police] = await Promise.all([
    lireLogo().then((u) => enLogo(u, 88)),
    enImage(c.image, largeurImage, hauteurImage),
    policeCairo(),
  ]);

  const encre = c.sombre ? "#ffffff" : COULEURS_MARQUE.encre;
  const doux = c.sombre ? "rgba(255,255,255,0.7)" : "#6b6478";
  const accent = c.sombre ? "#ffffff" : COULEURS_MARQUE.violet;
  const fond = c.sombre
    ? "linear-gradient(160deg, #0d0b10 0%, #241f2e 55%, #5a3a78 100%)"
    : COULEURS_MARQUE.fond;

  const echelle = vertical ? 1.3 : 1;

  const entete = (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} width={72 * echelle} height={72 * echelle} alt="" style={{ borderRadius: 18, background: "#fff" }} />
      ) : (
        <div style={{ display: "flex", width: 72 * echelle, height: 72 * echelle, borderRadius: 18, background: COULEURS_MARQUE.violet }} />
      )}
      <span style={{ fontSize: 30 * echelle, fontWeight: 700, color: encre }}>{NOM_APPLICATION}</span>
    </div>
  );

  const bandeau = c.bandeau ? (
    <div style={{ display: "flex" }}>
      <span
        style={{
          fontSize: 26 * echelle,
          fontWeight: 700,
          letterSpacing: 4,
          padding: "8px 18px",
          borderRadius: 999,
          background: c.sombre ? "#ffffff" : COULEURS_MARQUE.violet,
          color: c.sombre ? "#0d0b10" : "#ffffff",
        }}
      >
        {c.bandeau}
      </span>
    </div>
  ) : null;

  const tailleTitre = (c.titre.length > 40 ? 52 : 64) * (vertical ? 1.15 : 1);

  const prix =
    c.prix || c.reduction ? (
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 20, marginTop: 8 }}>
        {c.reduction ? (
          <span
            style={{
              fontSize: 44 * echelle,
              fontWeight: 700,
              color: c.sombre ? "#0d0b10" : "#fff",
              background: c.sombre ? "#fff" : "#111",
              padding: "4px 16px",
              borderRadius: 14,
            }}
          >
            −{c.reduction}%
          </span>
        ) : null}
        {c.prix && <span style={{ fontSize: 56 * echelle, fontWeight: 700, color: accent }}>{c.prix}</span>}
        {c.ancienPrix && (
          <span style={{ fontSize: 34 * echelle, color: doux, textDecoration: "line-through" }}>{c.ancienPrix}</span>
        )}
      </div>
    ) : null;

  const pied = (
    <span style={{ fontSize: 24 * echelle, fontWeight: 700, color: doux }}>
      Découvrez-le sur {NOM_APPLICATION} →
    </span>
  );

  const polices = police ? [{ name: "Cairo", data: police, weight: 700 as const, style: "normal" as const }] : undefined;

  if (vertical) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: fond,
            padding: 72,
            fontFamily: police ? "Cairo" : undefined,
          }}
        >
          {entete}

          {image ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                width={largeurImage}
                height={hauteurImage}
                alt=""
                style={{ borderRadius: 44, objectFit: "cover" }}
              />
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {bandeau}
            <span style={{ fontSize: tailleTitre, fontWeight: 700, lineHeight: 1.08, color: encre }}>{c.titre}</span>
            {c.sousTitre && <span style={{ fontSize: 34, color: doux }}>{c.sousTitre}</span>}
            {prix}
          </div>

          {pied}
        </div>
      ),
      { ...taille, fonts: polices },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: c.sombre ? "linear-gradient(135deg, #0d0b10 0%, #241f2e 55%, #5a3a78 100%)" : fond,
          padding: 64,
          fontFamily: police ? "Cairo" : undefined,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingRight: image ? 48 : 0 }}>
          {entete}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {bandeau}
            <span style={{ fontSize: tailleTitre, fontWeight: 700, lineHeight: 1.08, color: encre }}>{c.titre}</span>
            {c.sousTitre && <span style={{ fontSize: 30, color: doux }}>{c.sousTitre}</span>}
            {prix}
          </div>

          {pied}
        </div>

        {image && (
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} width={470} height={470} alt="" style={{ borderRadius: 36, objectFit: "cover" }} />
          </div>
        )}
      </div>
    ),
    { ...taille, fonts: polices },
  );
}
