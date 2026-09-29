import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { Scene3DLogo } from "./Scene3DLogo";

/**
 * Vidéo courte pour attirer des commerçants — un teaser, pas une visite
 * guidée de l'application. Cinq scènes, quatorze secondes : une accroche,
 * la marque en relief (vraie 3D WebGL, voir `Scene3DLogo.tsx`), trois
 * arguments en un mot chacun, un appel à l'action, un carton de fin. Rien
 * sur le fonctionnement réel (code d'activation, tableau de bord…) : ce
 * n'est pas le rôle de cette vidéo, qui doit donner envie avant d'expliquer.
 *
 * Même palette que le reste de l'application (`--gradient-brand`), même
 * logo, pour qu'un commerçant qui la voit puis ouvre g-mall.tn reconnaisse
 * tout de suite où il est arrivé.
 */

const DEGRADE = "linear-gradient(135deg, #6d4b8f, #241f2e)";
const POLICE = "'Segoe UI', 'Noto Sans Arabic', system-ui, sans-serif";

/**
 * Un champ d'étoiles fixe, pas un motif répété : chaque point a sa propre
 * position et sa propre profondeur (taille et flou liés), pour qu'une dérive
 * lente donne une vraie impression de parallaxe plutôt qu'un fond texturé.
 */
const ETOILES = Array.from({ length: 46 }, (_, i) => {
  // Une suite déterministe (et non `Math.random()`) : deux rendus de la même
  // image doivent produire deux fois le même résultat, sinon un rendu
  // multi-cœur assemblerait des images qui ne se recollent pas.
  const graine = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    x: graine(i * 2) * 100,
    y: graine(i * 2 + 1) * 100,
    taille: 1.5 + graine(i * 3) * 2.5,
    profondeur: 0.4 + graine(i * 5) * 0.6,
  };
});

function Fond() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundImage: DEGRADE }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 15%, rgba(255,255,255,0.14), transparent 55%), radial-gradient(circle at 15% 85%, rgba(255,170,60,0.16), transparent 55%)",
        }}
      />
      {/* Le champ d'étoiles : chaque point dérive à sa propre vitesse, selon sa profondeur. */}
      <AbsoluteFill>
        {ETOILES.map((e, i) => {
          const derive = Math.sin(frame / (40 + e.profondeur * 60) + i) * 10 * e.profondeur;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${e.x}%`,
                top: `${e.y}%`,
                width: e.taille * e.profondeur + 2,
                height: e.taille * e.profondeur + 2,
                borderRadius: "50%",
                background: "white",
                opacity: 0.12 + e.profondeur * 0.22,
                transform: `translateY(${derive}px)`,
              }}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/*
  Apparition douce, commune à tout le texte : un fondu qui monte légèrement.
  En deux versions, pour une seule et bonne raison — les règles des hooks :
  `useEntree` s'utilise directement dans un composant, `styleEntree` prend un
  `frame` déjà obtenu plus haut, pour les boucles (`.map`) où appeler un hook
  serait interdit, le nombre d'itérations dût-il ne jamais varier.
*/
function styleEntree(frame: number, delai = 0) {
  const f = Math.max(0, frame - delai);
  const opacite = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const decalage = interpolate(f, [0, 14], [18, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return { opacity: opacite, transform: `translateY(${decalage}px)` };
}

function useEntree(delai = 0) {
  const frame = useCurrentFrame();
  return styleEntree(frame, delai);
}

/* ─── Scène 1 — l'accroche, en perspective ───────────────────────────── */
const MOTS_ACCROCHE = ["عندك", "محل", "في", "قفصة؟"];

function SceneAccroche() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bascule = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const pulsationEmoji = 1 + Math.sin(frame / 5) * 0.08;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 900 }}>
      <div
        style={{
          transform: `rotateX(${(1 - bascule) * 35}deg)`,
          transformStyle: "preserve-3d",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: 18,
          padding: "0 60px",
          direction: "rtl",
        }}
      >
        {MOTS_ACCROCHE.map((mot, i) => {
          const e = styleEntree(frame, i * 5);
          return (
            <span
              key={mot}
              style={{
                ...e,
                fontFamily: POLICE,
                fontSize: 92,
                fontWeight: 800,
                color: "white",
                textShadow: "0 12px 30px rgba(0,0,0,0.35)",
              }}
            >
              {mot}
            </span>
          );
        })}
        <span style={{ fontSize: 92, transform: `scale(${pulsationEmoji})`, display: "inline-block" }}>👀</span>
      </div>
    </AbsoluteFill>
  );
}

/* ─── Scène 2 — la marque, en relief ──────────────────────────────────── */
function SceneMarque() {
  const bas = useEntree(24);

  return (
    <AbsoluteFill>
      <Scene3DLogo />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 300, gap: 14 }}>
        <div style={{ ...bas, fontFamily: POLICE, fontSize: 84, fontWeight: 800, color: "white" }}>جي-مول</div>
        <div style={{ ...bas, fontFamily: POLICE, fontSize: 36, color: "rgba(255,255,255,0.8)" }}>
          مركز التسوق في قفصة، في جيبك
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/* ─── Scène 3 — trois arguments, en tuiles inclinées ─────────────────── */
const ARGUMENTS = [
  { emoji: "🛍️", texte: "فيترين رقمي لمتجرك", lueur: "rgba(224,140,255,0.35)" },
  { emoji: "📦", texte: "تحكّم بمتجرك من هاتفك", lueur: "rgba(255,170,60,0.3)" },
  { emoji: "🎯", texte: "أقرب لزبائن قفصة", lueur: "rgba(120,220,255,0.3)" },
];

function Argument({
  emoji,
  texte,
  lueur,
  delai,
  cote,
}: {
  emoji: string;
  texte: string;
  lueur: string;
  delai: number;
  cote: 1 | -1;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delai);
  const entree = spring({ frame: f, fps, config: { damping: 16, stiffness: 130 } });
  const rotationEntree = (1 - entree) * 55 * cote;
  const opacite = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const flottement = Math.sin((frame + delai) / 28) * 6;

  return (
    <div
      style={{
        opacity: opacite,
        transform: `perspective(1000px) rotateY(${rotationEntree}deg) translateY(${flottement}px)`,
        transformStyle: "preserve-3d",
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 26,
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 32,
        padding: "26px 40px",
        width: 780,
        boxShadow: `0 20px 50px rgba(0,0,0,0.25), 0 0 60px ${lueur}`,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: 32,
          background: `radial-gradient(circle at 15% 30%, ${lueur}, transparent 60%)`,
          pointerEvents: "none",
        }}
      />
      <span style={{ fontSize: 64, position: "relative" }}>{emoji}</span>
      <span style={{ fontFamily: POLICE, fontSize: 44, fontWeight: 700, color: "white", position: "relative" }}>
        {texte}
      </span>
    </div>
  );
}

function SceneArguments() {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      {ARGUMENTS.map((a, i) => (
        <Argument key={a.texte} {...a} delai={i * 14} cote={i % 2 === 0 ? 1 : -1} />
      ))}
    </AbsoluteFill>
  );
}

/* ─── Scène 4 — l'appel à l'action, avec halo pulsé ──────────────────── */
function SceneAppel() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const echelleBouton = spring({ frame: frame - 20, fps, config: { damping: 10 } });
  const pulsationHalo = 1 + Math.sin(frame / 10) * 0.12;
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

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.28), transparent 68%)",
            transform: `scale(${pulsationHalo})`,
          }}
        />
        <div
          style={{
            position: "relative",
            transform: `scale(${Math.max(0, echelleBouton)})`,
            background: "white",
            color: "#6d4b8f",
            fontFamily: POLICE,
            fontSize: 46,
            fontWeight: 800,
            borderRadius: 999,
            padding: "26px 64px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
          }}
        >
          تواصل معنا الآن
        </div>
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
