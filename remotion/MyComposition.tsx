import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/**
 * Composition de départ — un point de repère pour vérifier que Remotion
 * tourne correctement dans ce projet, pas un rendu destiné à g-mall.tn.
 *
 * Isolé du reste de l'application : Remotion a son propre bundler (Webpack,
 * via `@remotion/bundler`) et son propre processus de rendu (Chrome
 * headless via `@remotion/renderer`) — rien ici ne passe par le serveur
 * Next.js ni par ses pages.
 */
export function MyComposition({ titre = "G-Mall" }: { titre?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entree = spring({ frame, fps, config: { damping: 200 } });
  const opacite = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundImage: "linear-gradient(135deg, #6d4b8f, #241f2e)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: opacite,
          transform: `scale(${entree})`,
          color: "white",
          fontSize: 90,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        {titre}
      </div>
    </AbsoluteFill>
  );
}
