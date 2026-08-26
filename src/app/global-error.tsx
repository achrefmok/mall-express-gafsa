"use client";

import { useEffect } from "react";

/*
  Le dernier filet.

  `error.tsx` ne rattrape que les erreurs d'un segment : il est rendu *dans* la
  coque racine. Si c'est cette coque qui échoue — le fournisseur de langue, la
  police, la lecture des préférences —, il n'est jamais monté, et le visiteur
  reçoit l'écran brut de Next : une phrase en anglais sur fond blanc.

  `global-error.tsx` remplace le document entier, `<html>` et `<body>` compris.
  Ce qui veut dire qu'il ne dispose de rien : ni contexte React, ni feuille de
  style — celle-ci est importée par la coque qui vient de tomber. D'où les
  styles en ligne et les textes en dur. Cet écran doit s'afficher même quand
  tout le reste a échoué ; c'est sa seule raison d'être.

  Le lien est un `<a>` natif, jamais le routeur : dans cet état, le routeur fait
  peut-être partie du problème. Un rechargement complet, lui, repart de zéro.
*/

/*
  Les textes de cet écran sont en français, en dur, et le resteront.

  `global-error.tsx` remplace la disposition racine — fournisseur de langue
  compris. Il s'affiche précisément quand tout le reste a échoué, et rien de ce
  qui charge le dictionnaire n'est disponible pour l'aider. Une traduction
  demanderait de lire le cookie de langue à la main pour deux phrases qu'on
  espère ne jamais montrer.
*/
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erreur racine", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "0 32px",
          textAlign: "center",
          background: "#f4f1fa",
          color: "#241f2e",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "rgba(208, 69, 95, 0.12)",
            color: "#d0455f",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          !
        </div>

        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Mall Express est momentanément indisponible</h1>

        <p style={{ margin: 0, maxWidth: "34ch", fontSize: 13, lineHeight: 1.6, color: "#6f6880" }}>
          Rechargez la page. Si cela persiste, réessayez dans quelques minutes —
          vos commandes et votre panier sont conservés.
        </p>

        {error.digest && (
          <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, color: "#a79fb5" }}>
            {error.digest}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              cursor: "pointer",
              borderRadius: 16,
              padding: "12px 18px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              background: "#6d4b8f",
              color: "#fff",
            }}
          >
            Réessayer
          </button>
          <a
            href="/accueil"
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 16,
              padding: "12px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "#6d4b8f",
              textDecoration: "none",
            }}
          >
            Accueil
          </a>
        </div>
      </body>
    </html>
  );
}
