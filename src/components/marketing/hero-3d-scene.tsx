"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Le centre de la vignette de héros — remplace les deux halos flous qui
 * tenaient cette place. Vraie 3D (WebGL, pas un pseudo-3D en CSS) : demandé
 * explicitement, et limité à cette seule page — le reste du site continue
 * d'éviter les librairies lourdes pour rester fluide sur un téléphone
 * d'entrée de gamme (voir les commentaires « Mouvement » de globals.css).
 *
 * `three` nu, jamais `@react-three/fiber` : ce dernier étend globalement
 * l'espace JSX pour reconnaître `<mesh>`, `<group>`… et TypeScript applique
 * cette extension à tout le programme dès qu'un seul fichier l'importe — un
 * `<div>` ordinaire ailleurs dans l'application cesse alors de
 * type-vérifier (voir le commentaire sur `remotion/` dans tsconfig.json,
 * qui a heurté exactement ce problème). La boucle de rendu est donc écrite
 * à la main, comme n'importe quel script `three` en dehors de React.
 *
 * Volontairement sobre : pas d'environnement HDRI (une texture de plus à
 * télécharger pour un éclairage qu'un couple de lumières reproduit presque
 * aussi bien), peu de polygones, pixel ratio plafonné. Des formes abstraites
 * plutôt qu'un objet précis — rien qui ne vende un produit donné, assez
 * neutre pour rester juste quel que soit le commerce du jour.
 */
export function Hero3DScene() {
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hote = conteneur.current;
    if (!hote) return;

    const reduitLeMouvement = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    hote.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const soleil = new THREE.DirectionalLight(0xffffff, 1.2);
    soleil.position.set(3, 4, 2);
    scene.add(soleil);
    const accent = new THREE.PointLight(0xd0455f, 0.6, 12);
    accent.position.set(-3, -2, 2);
    scene.add(accent);

    const groupe = new THREE.Group();
    scene.add(groupe);

    const forme = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.3, 1),
      new THREE.MeshStandardMaterial({ color: 0x6d4b8f, roughness: 0.22, metalness: 0.12 }),
    );
    groupe.add(forme);

    const anneau = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.4, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xd0455f, roughness: 0.3, metalness: 0.1 }),
    );
    anneau.position.set(1.5, -1.1, -1);
    anneau.scale.setScalar(0.38);
    groupe.add(anneau);

    const eclat = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x8d64b6, roughness: 0.25, metalness: 0.15 }),
    );
    eclat.position.set(-1.6, 1.2, -1.4);
    eclat.scale.setScalar(0.26);
    groupe.add(eclat);

    let pointeurX = 0;
    let pointeurY = 0;
    function onPointer(e: PointerEvent) {
      const rect = hote!.getBoundingClientRect();
      pointeurX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointeurY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    hote.addEventListener("pointermove", onPointer);

    function redimensionner() {
      const { width, height } = hote!.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    redimensionner();
    const observateur = new ResizeObserver(redimensionner);
    observateur.observe(hote);

    let image = 0;
    let arret = false;
    const horloge = new THREE.Clock();

    function animer() {
      if (arret) return;
      image = requestAnimationFrame(animer);
      const delta = horloge.getDelta();

      if (!reduitLeMouvement) {
        forme.rotation.x += delta * 0.12;
        forme.rotation.y += delta * 0.18;
        anneau.rotation.x += delta * 0.3;
        anneau.rotation.y += delta * 0.22;
        eclat.rotation.x += delta * 0.2;
        eclat.rotation.z += delta * 0.15;

        const t = horloge.getElapsedTime();
        forme.position.y = Math.sin(t * 0.8) * 0.12;
        anneau.position.y = -1.1 + Math.sin(t * 1.1 + 1) * 0.18;
        eclat.position.y = 1.2 + Math.sin(t * 0.9 + 2) * 0.15;

        // Légère parallaxe : le groupe suit le pointeur sans jamais le
        // rattraper complètement — un dixième de l'écart à chaque image,
        // pour un mouvement qui amortit au lieu de s'arrêter net.
        groupe.rotation.y += (pointeurX * 0.3 - groupe.rotation.y) * 0.05;
        groupe.rotation.x += (-pointeurY * 0.2 - groupe.rotation.x) * 0.05;
      }

      renderer.render(scene, camera);
    }
    animer();

    return () => {
      arret = true;
      cancelAnimationFrame(image);
      observateur.disconnect();
      hote.removeEventListener("pointermove", onPointer);
      hote.removeChild(renderer.domElement);
      renderer.dispose();
      [forme, anneau, eclat].forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    };
  }, []);

  return <div ref={conteneur} className="h-full w-full" />;
}
