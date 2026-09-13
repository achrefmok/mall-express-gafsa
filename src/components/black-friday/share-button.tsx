"use client";

import { useState } from "react";
import { compterPartage } from "@/app/actions/black-friday";
import { useI18n } from "@/lib/i18n/provider";

type Retour = "copie" | "preparation" | "enregistree" | "echec" | null;

/**
 * Partager, par le geste natif du téléphone.
 *
 * `navigator.share` ouvre la feuille de partage du système — WhatsApp,
 * Messenger, Facebook, les SMS, tout ce que la personne a installé — sans
 * qu'on ait à dresser la liste des réseaux ni à maintenir leurs adresses de
 * partage.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Instagram, honnêtement
 * ────────────────────────────────────────────────────────────────────────
 *
 * Instagram n'a pas d'adresse de partage web, et aucun site ne peut publier
 * à la place de quelqu'un. Ce qu'il accepte, c'est une **image** reçue par
 * la feuille de partage du téléphone. D'où les deux boutons « Image » et
 * « Story » : ils fabriquent la carte au format d'Instagram (1080 × 1350
 * pour un post, 1080 × 1920 pour une story) et la tendent à la feuille du
 * système, où Instagram figure s'il est installé. Aucun contournement : le
 * geste que ferait la personne avec une photo de sa galerie, en un toucher.
 *
 * Là où le téléphone ne sait pas partager un fichier (ordinateur, vieux
 * navigateurs), l'image est enregistrée : elle se publie ensuite comme
 * n'importe quelle photo.
 *
 * L'aperçu qui s'affiche une fois le **lien** collé ne dépend pas de ce
 * bouton : il vient des balises Open Graph de la page visée.
 */
export function BoutonPartage({
  chemin,
  titre,
  texte,
  offreId,
  clair = false,
  image,
}: {
  /** Chemin relatif de la page à partager. */
  chemin: string;
  titre: string;
  texte: string;
  /** Pour compter le partage d'une offre Black Friday. */
  offreId?: string;
  clair?: boolean;
  /** Base des images de partage (`/partage/produit/<id>`), sans le format. */
  image?: string;
}) {
  const { t } = useI18n();
  const [retour, setRetour] = useState<Retour>(null);

  function signaler(r: Exclude<Retour, null>) {
    setRetour(r);
    window.setTimeout(() => setRetour(null), 2400);
  }

  const adresse = () => new URL(chemin, window.location.origin).toString();

  async function partager() {
    const url = adresse();
    if (offreId) void compterPartage(offreId);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titre, text: texte, url });
        return;
      } catch (cause) {
        // Annulé par la personne : rien à faire, et surtout pas de repli.
        if (cause instanceof DOMException && cause.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      signaler("copie");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${texte} ${url}`)}`, "_blank", "noopener");
    }
  }

  async function partagerImage(formatImage: "post" | "story") {
    if (!image) return;
    setRetour("preparation");
    if (offreId) void compterPartage(offreId);

    try {
      const reponse = await fetch(`${image}/${formatImage}`);
      if (!reponse.ok) throw new Error(String(reponse.status));
      const blob = await reponse.blob();
      const fichier = new File([blob], `mall-express-gafsa-${formatImage}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [fichier] })) {
        try {
          // Le lien voyage dans le texte : Instagram l'ignore, WhatsApp et
          // Facebook l'affichent sous l'image.
          await navigator.share({ files: [fichier], title: titre, text: `${texte} ${adresse()}` });
          setRetour(null);
          return;
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === "AbortError") {
            setRetour(null);
            return;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = fichier.name;
      lien.click();
      URL.revokeObjectURL(url);
      signaler("enregistree");
    } catch {
      signaler("echec");
    }
  }

  const secondaire = clair
    ? "bg-white/15 text-white"
    : "bg-[var(--color-field)] text-[var(--color-ink)]";

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={partager}
          className={`press flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[0.75rem] font-bold ${
            clair
              ? "bg-white text-[#0d0b10]"
              : "border border-[var(--color-outline)] bg-[var(--color-surface-solid)] text-[var(--color-ink)]"
          }`}
        >
          <span aria-hidden>{retour === "copie" ? "✓" : "↗"}</span>
          {retour === "copie" ? t.share.copied : t.share.share}
        </button>

        {image && (
          <>
            <button
              type="button"
              onClick={() => partagerImage("post")}
              disabled={retour === "preparation"}
              aria-label={`${t.share.image} — ${t.share.imageHint}`}
              className={`press flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[0.75rem] font-bold disabled:opacity-60 ${secondaire}`}
            >
              <span aria-hidden>📸</span>
              {t.share.image}
            </button>
            <button
              type="button"
              onClick={() => partagerImage("story")}
              disabled={retour === "preparation"}
              aria-label={`${t.share.story} — ${t.share.imageHint}`}
              className={`press flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[0.75rem] font-bold disabled:opacity-60 ${secondaire}`}
            >
              <span aria-hidden>▯</span>
              {t.share.story}
            </button>
          </>
        )}
      </div>

      <p
        aria-live="polite"
        className={`min-h-[1em] text-[0.6875rem] font-medium ${clair ? "text-white/75" : "text-[var(--color-muted)]"}`}
      >
        {retour === "preparation" && t.share.preparing}
        {retour === "enregistree" && t.share.saved}
        {retour === "echec" && t.share.imageFailed}
      </p>
    </div>
  );
}
