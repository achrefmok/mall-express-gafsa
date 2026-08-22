"use client";

import { useState } from "react";

/*
  Les largeurs demandées, plus une tablette.

  Ce sont les tailles réelles des téléphones visés : 320 px reste la largeur du
  plus petit écran encore en circulation, et c'est là que les mises en page
  cassent en premier — pas sur les grands.
*/
const APPAREILS = [
  { nom: "iPhone SE", w: 320, h: 568 },
  { nom: "Android compact", w: 360, h: 800 },
  { nom: "iPhone 8", w: 375, h: 667 },
  { nom: "iPhone 13/14", w: 390, h: 844 },
  { nom: "iPhone Plus", w: 414, h: 896 },
  { nom: "Tablette", w: 768, h: 1024 },
] as const;

type Appareil = (typeof APPAREILS)[number];

const ECRANS = [
  { chemin: "/accueil", nom: "Accueil" },
  { chemin: "/marketplace", nom: "Marketplace" },
  { chemin: "/boutiques", nom: "Boutiques" },
  { chemin: "/lives", nom: "Lives" },
  { chemin: "/bons-plans", nom: "Bons plans" },
  { chemin: "/services", nom: "Services" },
  { chemin: "/taxi", nom: "Taxi" },
  { chemin: "/sos", nom: "SOS" },
  { chemin: "/profil", nom: "Profil" },
] as const;

const CHAMP =
  "rounded-[10px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-2 py-[6px] text-[0.75rem] text-[var(--color-ink)]";

export function PreviewFrame() {
  const [appareil, setAppareil] = useState<Appareil>(APPAREILS[3]);
  const [chemin, setChemin] = useState<string>(ECRANS[0].chemin);
  const [paysage, setPaysage] = useState(false);
  /* Forcer le rechargement de l'iframe sans changer son adresse. */
  const [cle, setCle] = useState(0);

  const largeur = paysage ? appareil.h : appareil.w;
  const hauteur = paysage ? appareil.w : appareil.h;

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-[var(--color-app)] p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="me-2 text-[0.875rem] font-bold text-[var(--color-ink)]">Aperçu mobile</h1>

        <select
          value={appareil.nom}
          onChange={(e) => setAppareil(APPAREILS.find((a) => a.nom === e.target.value) ?? APPAREILS[3])}
          className={CHAMP}
          aria-label="Appareil"
        >
          {APPAREILS.map((a) => (
            <option key={a.nom} value={a.nom}>
              {a.nom} — {a.w}×{a.h}
            </option>
          ))}
        </select>

        <select
          value={chemin}
          onChange={(e) => setChemin(e.target.value)}
          className={CHAMP}
          aria-label="Écran"
        >
          {ECRANS.map((e) => (
            <option key={e.chemin} value={e.chemin}>
              {e.nom}
            </option>
          ))}
        </select>

        <input
          value={chemin}
          onChange={(e) => setChemin(e.target.value)}
          aria-label="Adresse"
          className={`${CHAMP} min-w-[180px] flex-1`}
        />

        <button type="button" onClick={() => setPaysage((p) => !p)} className={CHAMP}>
          {paysage ? "Portrait" : "Paysage"}
        </button>

        <button type="button" onClick={() => setCle((k) => k + 1)} className={CHAMP}>
          Recharger
        </button>
      </header>

      <div className="flex flex-1 items-start justify-center overflow-auto">
        {/*
          La bordure imite un téléphone, mais la mesure qui compte est la
          largeur intérieure : c'est elle que la page voit, et donc elle qui
          déclenche les points de rupture.
        */}
        <div
          className="flex-none overflow-hidden rounded-[28px] border-[10px] border-[#1c1720] shadow-[0_18px_48px_rgba(30,20,45,0.28)]"
          style={{ width: largeur, height: hauteur }}
        >
          <iframe
            key={`${cle}-${chemin}-${largeur}`}
            src={chemin}
            title={`Aperçu ${chemin}`}
            className="h-full w-full border-0 bg-[var(--color-app)]"
          />
        </div>
      </div>

      <p className="text-center text-[0.6875rem] text-[var(--color-muted)]">
        {largeur} × {hauteur} px · même origine, donc aucun assouplissement de sécurité nécessaire
      </p>
    </div>
  );
}
