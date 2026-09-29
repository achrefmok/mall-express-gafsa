import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig, interpolate, spring, staticFile } from "remotion";
import { useLoader } from "@react-three/fiber";
import { SRGBColorSpace, TextureLoader } from "three";
import { RoundedBox, Sparkles, ContactShadows } from "@react-three/drei";

/**
 * Le logo en relief, pas en aplat — une vraie scène 3D (WebGL, via
 * `@remotion/three`), pas un effet CSS qui l'imite.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi une oscillation, et non une rotation complète
 * ────────────────────────────────────────────────────────────────────────
 *
 * La texture du logo est posée sur un simple plan : vue de dos, une face
 * plane est invisible par défaut dans Three.js. Un tour complet ferait donc
 * disparaître le logo à mi-rotation. Une bascule — comme on tourne un objet
 * dans la main pour le montrer sous deux angles, jamais jusqu'à son dos —
 * vend la même profondeur sans jamais présenter de face vide.
 *
 * Déterministe, comme tout Remotion : la rotation vient de `useCurrentFrame()`,
 * jamais d'un `useFrame()` r3f — sinon deux rendus de la même image ne
 * donneraient pas deux fois le même résultat.
 */
function Logo3D() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const texture = useLoader(TextureLoader, staticFile("remotion/logo.png"));
  // Sans ceci, les pixels transparents du PNG s'affichent avec le noir que
  // l'export a mis dans leur canal couleur — Three.js ignore l'alpha d'une
  // texture tant qu'on ne le lui dit pas explicitement.
  texture.colorSpace = SRGBColorSpace;

  const entree = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  const bascule =
    interpolate(frame, [0, 45], [1.15, 0], { extrapolateRight: "clamp" }) + Math.sin(frame / 48) * 0.32;
  const inclinaison = 0.12 + Math.sin(frame / 70) * 0.05;
  const flottement = Math.sin(frame / 26) * 0.12;

  return (
    <group
      rotation={[inclinaison, bascule, 0]}
      // Décalé vers le haut du cadre : la vidéo est verticale, le texte de la
      // scène occupe le bas, le logo n'a rien à y faire chevaucher.
      position={[0, 1.35 + flottement, 0]}
      scale={Math.max(0.001, entree)}
    >
      <RoundedBox args={[2.6, 2.6, 0.32]} radius={0.26} smoothness={6} castShadow receiveShadow>
        <meshStandardMaterial color="#6d4b8f" metalness={0.4} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0, 0.175]} castShadow>
        <planeGeometry args={[2.08, 2.08]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.55}
          metalness={0.05}
          transparent
          alphaTest={0.1}
        />
      </mesh>
    </group>
  );
}

export function Scene3DLogo() {
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      shadows
      camera={{ position: [0, 0.4, 9.5], fov: 32 }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[3, 4, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Lumière de contour, chaude, pour détacher le logo du fond sans le blanchir. */}
      <pointLight position={[-3, -1, -2]} intensity={0.7} color="#ffaa3c" />

      <Logo3D />

      <Sparkles count={70} scale={[6, 8, 4]} size={2.4} speed={0.25} color="#ffd699" opacity={0.55} />

      <ContactShadows position={[0, -0.35, 0]} opacity={0.45} scale={8} blur={2.6} far={2} color="#1a1224" />
    </ThreeCanvas>
  );
}
