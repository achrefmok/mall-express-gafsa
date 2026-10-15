import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const TAILLES: Record<string, { cote: number; marge: number }> = {
  "32": { cote: 32, marge: 0 },
  "180": { cote: 180, marge: 0 },
  "192": { cote: 192, marge: 0 },
  "512": { cote: 512, marge: 0 },
  // Android découpe l'icône masquable selon la forme du lanceur : marge de sécurité.
  "masquable-512": { cote: 512, marge: 0.18 },
};

export function generateStaticParams() {
  return Object.keys(TAILLES).map((taille) => ({ taille }));
}

/**
 * L'icône de « Taxi & Louage Gafsa » : un taxi sombre sur un carré ambre,
 * dessinée ici plutôt que figée dans `public/` — une seule source pour
 * toutes les tailles, jamais désynchronisées.
 */
export async function GET(_: Request, { params }: { params: Promise<{ taille: string }> }) {
  const { taille } = await params;
  const t = TAILLES[taille] ?? TAILLES["192"];
  const dessin = Math.round(t.cote * (1 - t.marge * 2) * 0.62);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(140deg,#fbbf24,#d97706)",
          borderRadius: t.marge > 0 || t.cote <= 32 ? 0 : Math.round(t.cote * 0.22),
        }}
      >
        <svg width={dessin} height={dessin} viewBox="0 0 24 24" fill="none" stroke="#1a1204" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4h6l1 3" />
          <path d="M5 17h14v-4.5l-1.8-4.3A2 2 0 0 0 15.4 7H8.6a2 2 0 0 0-1.8 1.2L5 12.5z" />
          <path d="M5 12.5h14" />
          <circle cx="8" cy="17" r="1.6" fill="#1a1204" />
          <circle cx="16" cy="17" r="1.6" fill="#1a1204" />
        </svg>
      </div>
    ),
    { width: t.cote, height: t.cote },
  );
}
