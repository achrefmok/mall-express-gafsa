import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

/**
 * Vidéo courte pour attirer des commerçants — un teaser, pas une visite
 * guidée de l'application. Cinq scènes, quatorze secondes : une accroche,
 * la marque, trois arguments en un mot chacun, un appel à l'action, un
 * carton de fin. Rien sur le fonctionnement réel (code d'activation, tableau
 * de bord…) : ce n'est pas le rôle de cette vidéo, qui doit donner envie
 * avant d'expliquer.
 *
 * Même palette que le reste de l'application (`--gradient-brand`), même
 * logo, pour qu'un commerçant qui la voit puis ouvre g-mall.tn reconnaisse
 * tout de suite où il est arrivé.
 */

/*
  `public/remotion/logo.png` est une copie locale du logo réellement
  configuré dans Admin > Réglages (`app_brand.app_logo_url`), téléchargée une
  fois pour que le rendu n'ait pas à dépendre du réseau. S'il change côté
  admin, retélécharger ce fichier avant de refaire un rendu.
*/
const DEGRADE = "linear-gradient(135deg, #6d4b8f, #241f2e)";
const POLICE = "'Segoe UI', 'Noto Sans Arabic', system-ui, sans-serif";

function Fond() {
  return (
    <AbsoluteFill style={{ backgroundImage: DEGRADE }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 15%, rgba(255,255,255,0.14), transparent 55%), radial-gradient(circle at 15% 85%, rgba(255,170,60,0.16), transparent 55%)",
        }}
      />
    </AbsoluteFill>
  );
}

/** Apparition douce, commune à tout le texte : un fondu qui monte légèrement. */
function useEntree(delai = 0) {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delai);
  const opacite = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const decalage = interpolate(f, [0, 14], [18, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return { opacity: opacite, transform: `translateY(${decalage}px)` };
}

/* ─── Scène 1 — l'accroche ──────────────────────────────────────────── */
function SceneAccroche() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const echelle = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `scale(${echelle})`,
          fontFamily: POLICE,
          fontSize: 92,
          fontWeight: 800,
          color: "white",
          textAlign: "center",
          padding: "0 60px",
        }}
      >
        عندك محل في قفصة؟ 👀
      </div>
    </AbsoluteFill>
  );
}

/* ─── Scène 2 — la marque ───────────────────────────────────────────── */
function SceneMarque() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const echelleLogo = spring({ frame, fps, config: { damping: 14 } });
  const rotationHalo = interpolate(frame, [0, 90], [0, 180]);
  const bas = useEntree(20);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div style={{ position: "relative", width: 300, height: 300, transform: `scale(${echelleLogo})` }}>
        <div
          style={{
            position: "absolute",
            inset: -22,
            borderRadius: 80,
            background:
              "conic-gradient(from 0deg, rgba(255,255,255,0.6), rgba(255,170,60,0.4), transparent 55%, rgba(255,255,255,0.4))",
            transform: `rotate(${rotationHalo}deg)`,
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 64,
            background: "rgba(255,255,255,0.14)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Img src={staticFile("remotion/logo.png")} style={{ width: 210, height: 210, objectFit: "contain" }} />
        </div>
      </div>

      <div style={{ ...bas, fontFamily: POLICE, fontSize: 84, fontWeight: 800, color: "white" }}>جي-مول</div>
      <div style={{ ...bas, fontFamily: POLICE, fontSize: 36, color: "rgba(255,255,255,0.8)" }}>
        مركز التسوق في قفصة، في جيبك
      </div>
    </AbsoluteFill>
  );
}

/* ─── Scène 3 — trois arguments, un mot chacun ───────────────────────── */
const ARGUMENTS = [
  { emoji: "🛍️", texte: "فيترين رقمي لمتجرك" },
  { emoji: "📦", texte: "تحكّم بمتجرك من هاتفك" },
  { emoji: "🎯", texte: "أقرب لزبائن قفصة" },
];

function Argument({ emoji, texte, delai }: { emoji: string; texte: string; delai: number }) {
  const style = useEntree(delai);
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 26,
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 32,
        padding: "26px 40px",
        width: 780,
      }}
    >
      <span style={{ fontSize: 64 }}>{emoji}</span>
      <span style={{ fontFamily: POLICE, fontSize: 44, fontWeight: 700, color: "white" }}>{texte}</span>
    </div>
  );
}

function SceneArguments() {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      {ARGUMENTS.map((a, i) => (
        <Argument key={a.texte} emoji={a.emoji} texte={a.texte} delai={i * 14} />
      ))}
    </AbsoluteFill>
  );
}

/* ─── Scène 4 — l'appel à l'action ───────────────────────────────────── */
function SceneAppel() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const echelleBouton = spring({ frame: frame - 20, fps, config: { damping: 10 } });
  const haut = useEntree(0);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36, padding: "0 70px" }}>
      <div
        style={{
          ...haut,
          fontFamily: POLICE,
          fontSize: 76,
          fontWeight: 800,
          color: "white",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        كن من أوائل تجار جي-مول 🚀
      </div>
      <div
        style={{
          transform: `scale(${Math.max(0, echelleBouton)})`,
          background: "white",
          color: "#6d4b8f",
          fontFamily: POLICE,
          fontSize: 46,
          fontWeight: 800,
          borderRadius: 999,
          padding: "26px 64px",
        }}
      >
        تواصل معنا الآن
      </div>
    </AbsoluteFill>
  );
}

/* ─── Scène 5 — carton de fin ─────────────────────────────────────────── */
function SceneFin() {
  const style = useEntree(0);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 18 }}>
      <div style={{ ...style, fontFamily: POLICE, fontSize: 72, fontWeight: 800, color: "white" }}>جي-مول</div>
      <div style={{ ...style, fontFamily: POLICE, fontSize: 34, color: "rgba(255,255,255,0.75)" }}>g-mall.tn</div>
    </AbsoluteFill>
  );
}

/**
 * 30 im/s — durées en images :
 *   accroche  0.0 s → 2.3 s  (70)
 *   marque    2.0 s → 5.3 s  (100, chevauche 0.3 s pour un fondu doux)
 *   arguments 5.0 s → 9.8 s  (145)
 *   appel     9.5 s → 12.8 s (100)
 *   fin      12.5 s → 14.0 s (45)
 */
export function PubCommercants() {
  return (
    <AbsoluteFill>
      <Fond />
      <Sequence from={0} durationInFrames={70}>
        <SceneAccroche />
      </Sequence>
      <Sequence from={60} durationInFrames={100}>
        <SceneMarque />
      </Sequence>
      <Sequence from={150} durationInFrames={145}>
        <SceneArguments />
      </Sequence>
      <Sequence from={285} durationInFrames={100}>
        <SceneAppel />
      </Sequence>
      <Sequence from={375} durationInFrames={45}>
        <SceneFin />
      </Sequence>
    </AbsoluteFill>
  );
}
