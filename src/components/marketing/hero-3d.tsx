"use client";

import dynamic from "next/dynamic";

/*
  `three` et `@react-three/fiber` touchent `window`/`WebGLRenderingContext` au
  chargement : rendus côté serveur, ils font tomber le rendu de toute la
  page. `ssr: false`, comme pour la carte Leaflet (`shops-map.tsx`) — même
  piège, même remède.

  Le halo flou qui tenait cette place avant reste affiché pendant le
  chargement (`loading`), pour qu'il n'y ait pas de trou le temps que la
  scène 3D arrive.
*/
const Hero3DScene = dynamic(() => import("./hero-3d-scene").then((m) => m.Hero3DScene), {
  ssr: false,
  loading: () => <HeroHalo />,
});

function HeroHalo() {
  return (
    <div
      aria-hidden
      className="animate-float absolute inset-0 m-auto h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle,rgba(109,75,143,0.22),transparent_65%)] blur-2xl"
    />
  );
}

/** Décoratif pur : rien ici ne porte d'information que le reste de la page ne donne déjà. */
export function Hero3D() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Hero3DScene />
    </div>
  );
}
