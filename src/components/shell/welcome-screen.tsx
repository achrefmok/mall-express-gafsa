"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/** Posé pour compatibilité : le guide pas à pas attend que l'accueil ait été vu. */
const SEEN_KEY = "meg-welcome-seen";
/** Une fois par lancement : `sessionStorage` meurt avec l'application fermée. */
const SESSION_KEY = "meg-splash-session";
/** Le logo de l'administration, gardé pour le lancement suivant. */
const LOGO_CACHE_KEY = "meg-logo-url";
const LOGO_PAR_DEFAUT = "/brand/app-icon.png";

/**
 * Visible 4,6 s, puis fondu de 0,4 s : cinq secondes en tout.
 *
 * C'est long pour un écran d'ouverture — et c'est voulu : il porte désormais
 * les sponsors, qui ont besoin d'être vus, pas entrevus. Deux garde-fous
 * empêchent que ces cinq secondes deviennent un péage : un toucher l'efface
 * à l'instant, et la page se charge derrière lui pendant qu'il joue, si bien
 * que l'application est prête quand il s'en va.
 */
const DUREE_AFFICHAGE = 4600;
const DUREE_FONDU = 400;

/**
 * Le décor de l'écran d'ouverture.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Trois couches, et aucune ne doit se remarquer
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un aplat dégradé est plat, au sens propre : rien n'y accroche la lumière,
 * et l'écran a l'air d'un fond d'attente. Trois couches très pâles suffisent
 * à lui donner de la profondeur sans jamais réclamer l'attention.
 *
 *   · deux nappes de lumière, floutées et à peine visibles, qui dérivent
 *     lentement sur des trajets et des durées différents ;
 *   · deux arcs fins, posés hors cadre, qui rappellent la courbure du logo
 *     sans qu'on puisse dire ce qu'ils représentent ;
 *   · deux ondes qui s'écartent du centre, comme si le logo venait d'être
 *     posé sur une surface.
 *
 * Tout est en dégradés CSS et en SVG : aucune image à charger sur un écran
 * qui doit s'afficher avant tout le reste. Et tout est `aria-hidden` — un
 * lecteur d'écran n'a rien à y lire.
 *
 * Pas de `blur()` sur les nappes, et c'est mesuré : avec un flou de 70 px,
 * l'écran était identique à l'œil. Un dégradé radial qui s'éteint dans le
 * transparent est déjà flou par nature — le filtre ne faisait que payer une
 * passe de rendu de plus, précisément pendant que l'application démarre
 * derrière, sur le téléphone le plus lent du parc.
 *
 * Le repère des opacités : au-delà de 0,08 sur le blanc, une forme cesse
 * d'être une texture et devient un objet — on cherche alors à la nommer.
 */
function Decor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* ─── Les nappes de lumière ────────────────────────────────────── */}
      <span
        className="absolute -top-[18vmax] -left-[12vmax] h-[62vmax] w-[62vmax] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(196,160,236,0.30), rgba(196,160,236,0.06) 55%, transparent 72%)",
          animation: "splash-derive-a 19s ease-in-out infinite",
        }}
      />
      <span
        className="absolute -right-[16vmax] -bottom-[20vmax] h-[58vmax] w-[58vmax] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(224,85,111,0.22), rgba(224,85,111,0.05) 55%, transparent 72%)",
          animation: "splash-derive-b 23s ease-in-out infinite",
        }}
      />

      {/* ─── Les arcs, coupés par le cadre ────────────────────────────── */}
      <svg
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <circle cx="332" cy="150" r="172" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1.2" />
        <circle cx="332" cy="150" r="232" fill="none" stroke="#ffffff" strokeOpacity="0.045" strokeWidth="1" />
        <circle cx="46" cy="706" r="196" fill="none" stroke="#ffffff" strokeOpacity="0.055" strokeWidth="1.2" />
      </svg>

      {/* ─── Les ondes, sous le logo ──────────────────────────────────── */}
      <span className="absolute inset-0 flex items-center justify-center">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="absolute h-[210px] w-[210px] rounded-full border border-white/25"
            style={{
              animation: `splash-onde 4.4s cubic-bezier(0.22, 0.61, 0.36, 1) ${i * 2.2}s infinite`,
            }}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * L'écran d'ouverture, à chaque lancement de l'application.
 *
 * Logo → apparition douce → léger rebond d'échelle → le nom → les sponsors →
 * l'application. Il dure cinq secondes et il ne retient rien : la page se
 * charge derrière lui pendant qu'il joue, un toucher l'efface tout de suite,
 * et il se saute entièrement quand le système demande moins d'animations.
 *
 * Une fois par lancement, pas à chaque page : `sessionStorage` survit à la
 * navigation et aux rechargements d'un même lancement, et disparaît quand
 * l'application est fermée. Le rejouer à chaque changement de page serait un
 * péage.
 *
 * Le logo : celui que l'administration a choisi. Il arrive du serveur, qui
 * l'a déjà lu pour les icônes de la page — donc juste au premier lancement
 * comme aux suivants. La copie gardée en mémoire ne sert plus qu'au cas où
 * le serveur n'a rien à dire : page servie hors ligne par le cache. On ne
 * l'échange jamais au milieu de l'animation : un logo qui change sous les
 * yeux fait amateur.
 */
export function WelcomeScreen({ logo: logoServeur }: { logo?: string | null }) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [logo, setLogo] = useState(logoServeur ?? LOGO_PAR_DEFAUT);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let dejaJoue = false;
    try {
      dejaJoue = sessionStorage.getItem(SESSION_KEY) === "1";
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(SEEN_KEY, "1");
      const enCache = localStorage.getItem(LOGO_CACHE_KEY);
      if (!logoServeur && enCache) setLogo(enCache);
    } catch {
      // Stockage indisponible (navigation privée stricte) : on joue, sans mémoire.
    }

    if (dejaJoue) return;

    // Garder ce logo pour une ouverture hors ligne, où le serveur ne répond pas.
    try {
      if (logoServeur) localStorage.setItem(LOGO_CACHE_KEY, logoServeur);
      else localStorage.removeItem(LOGO_CACHE_KEY);
    } catch {}

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setVisible(true);
    const out = setTimeout(() => setLeaving(true), DUREE_AFFICHAGE);
    const gone = setTimeout(() => setVisible(false), DUREE_AFFICHAGE + DUREE_FONDU);

    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, [logoServeur]);

  if (!visible || !mounted) return null;

  function dismiss() {
    setLeaving(true);
    setTimeout(() => setVisible(false), DUREE_FONDU);
  }

  return createPortal(
    <div
      role="presentation"
      onClick={dismiss}
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-5 overflow-hidden bg-[image:var(--gradient-brand)]"
      style={{ opacity: leaving ? 0 : 1, transition: `opacity ${DUREE_FONDU}ms ease-out` }}
    >
      <Decor />

      <span
        className="relative flex items-center justify-center"
        style={{ animation: "splash-logo 820ms cubic-bezier(0.22, 0.61, 0.36, 1) both" }}
      >
        {/*
          Deux halos plutôt qu'un.

          Le premier, large et très pâle, décolle le logo du fond. Le second,
          serré et un peu plus dense, lui donne une arête lumineuse — c'est ce
          second cercle qui fait la différence entre « une image posée sur un
          dégradé » et « un objet éclairé ».
        */}
        <span
          aria-hidden
          className="absolute h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_70%)]"
          style={{ animation: "splash-souffle 5.2s ease-in-out infinite" }}
        />
        <span
          aria-hidden
          className="absolute h-[186px] w-[186px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),transparent_62%)]"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- logo servi tel quel, avant tout le reste */}
        <img
          src={logo}
          alt=""
          onError={() => setLogo(LOGO_PAR_DEFAUT)}
          className="relative h-[148px] w-[148px] rounded-[32px] object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.32)]"
        />
      </span>

      <div
        className="relative flex flex-col items-center gap-1 px-8 text-center"
        style={{ animation: "splash-texte 560ms cubic-bezier(0.22, 0.61, 0.36, 1) 240ms both" }}
      >
        <p className="text-[1.3125rem] font-extrabold tracking-[-0.02em] text-white">
          {t.brand.first}{t.brand.second}
        </p>
        <p className="text-[0.75rem] leading-[1.5] text-white/75">{t.welcome.tagline}</p>
      </div>

      {/*
        La ligne des sponsors.

        Quatre emplacements, vides tant que personne n'a payé pour eux. Les
        laisser visibles n'est pas un oubli : un écran d'ouverture qui montre
        d'un coup quatre logos le jour où ils arrivent surprend ; un cadre qui
        attend depuis toujours se remplit sans que personne ne le remarque.
        Et un annonceur voit où il ira avant de signer.

        Le mot reste au singulier et en petit : cet écran appartient à
        l'application, pas à ses sponsors.
      */}
      <div
        className="relative flex flex-col items-center gap-[10px]"
        style={{ animation: "splash-texte 560ms cubic-bezier(0.22, 0.61, 0.36, 1) 520ms both" }}
      >
        <p className="text-[0.5625rem] font-bold tracking-[0.18em] text-white/55 uppercase">
          Sponsorisé par
        </p>
        <div className="flex items-center gap-[10px]">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              aria-hidden
              className="h-[42px] w-[42px] rounded-[13px] border border-white/20 bg-white/10"
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes splash-logo {
          0%   { opacity: 0; transform: scale(0.78); }
          62%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-texte {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes splash-souffle {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.06); }
        }
        /*
          Les nappes de lumière dérivent sur des trajets différents et des
          durées premières entre elles : elles ne se recroisent donc jamais
          au même endroit, et l'œil ne trouve pas la boucle.
        */
        @keyframes splash-derive-a {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          50%  { transform: translate3d(6%, -4%, 0) scale(1.1); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes splash-derive-b {
          0%   { transform: translate3d(0, 0, 0) scale(1.05); }
          50%  { transform: translate3d(-5%, 5%, 0) scale(1); }
          100% { transform: translate3d(0, 0, 0) scale(1.05); }
        }
        @keyframes splash-onde {
          0%   { opacity: 0;    transform: scale(0.6); }
          22%  { opacity: 0.14; }
          100% { opacity: 0;    transform: scale(1.75); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
