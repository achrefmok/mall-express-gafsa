"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";

/** Posé pour compatibilité : le guide pas à pas attend que l'accueil ait été vu. */
const SEEN_KEY = "meg-welcome-seen";
/** Une fois par lancement : `sessionStorage` meurt avec l'application fermée. */
const SESSION_KEY = "meg-splash-session";
/** Le logo de l'administration, gardé pour le lancement suivant. */
const LOGO_CACHE_KEY = "meg-logo-url";
const LOGO_PAR_DEFAUT = "/brand/logo-mall-gafsa.png";

/** Visible 1,25 s, puis fondu de 0,38 s : un peu plus de 1,6 s en tout. */
const DUREE_AFFICHAGE = 1250;
const DUREE_FONDU = 380;

/**
 * L'écran d'ouverture, à chaque lancement de l'application.
 *
 * Logo → apparition douce → léger rebond d'échelle → l'application. Il dure un
 * peu plus d'une seconde et demie, et il ne retient rien : la page se charge
 * derrière lui pendant qu'il joue, un toucher l'efface tout de suite, et il se
 * saute entièrement quand le système demande moins d'animations.
 *
 * Une fois par lancement, pas à chaque page : `sessionStorage` survit à la
 * navigation et aux rechargements d'un même lancement, et disparaît quand
 * l'application est fermée. Le rejouer à chaque changement de page serait un
 * péage.
 *
 * Le logo : celui que l'administration a choisi, s'il y en a un — mis en
 * mémoire au lancement précédent, pour l'afficher sans attendre le réseau —,
 * sinon le logo de l'application livré avec elle. On ne l'échange jamais au
 * milieu de l'animation : un logo qui change sous les yeux fait amateur.
 */
export function WelcomeScreen() {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [logo, setLogo] = useState(LOGO_PAR_DEFAUT);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let dejaJoue = false;
    try {
      dejaJoue = sessionStorage.getItem(SESSION_KEY) === "1";
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(SEEN_KEY, "1");
      const enCache = localStorage.getItem(LOGO_CACHE_KEY);
      if (enCache) setLogo(enCache);
    } catch {
      // Stockage indisponible (navigation privée stricte) : on joue, sans mémoire.
    }

    if (dejaJoue) return;

    // Mettre à jour le logo pour le prochain lancement, sans toucher à celui-ci.
    void (async () => {
      try {
        const { data } = await createClient()
          .from("app_brand")
          .select("app_logo_url")
          .eq("id", true)
          .maybeSingle();
        try {
          if (data?.app_logo_url) localStorage.setItem(LOGO_CACHE_KEY, data.app_logo_url);
          else localStorage.removeItem(LOGO_CACHE_KEY);
        } catch {}
      } catch {
        // Réseau absent : le logo en place reste valable.
      }
    })();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setVisible(true);
    const out = setTimeout(() => setLeaving(true), DUREE_AFFICHAGE);
    const gone = setTimeout(() => setVisible(false), DUREE_AFFICHAGE + DUREE_FONDU);

    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, []);

  if (!visible || !mounted) return null;

  function dismiss() {
    setLeaving(true);
    setTimeout(() => setVisible(false), DUREE_FONDU);
  }

  return createPortal(
    <div
      role="presentation"
      onClick={dismiss}
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-5 bg-[image:var(--gradient-brand)]"
      style={{ opacity: leaving ? 0 : 1, transition: `opacity ${DUREE_FONDU}ms ease-out` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- logo servi tel quel, avant tout le reste */}
      <img
        src={logo}
        alt=""
        onError={() => setLogo(LOGO_PAR_DEFAUT)}
        className="h-[108px] w-[108px] rounded-[30px] object-cover shadow-[0_18px_44px_rgba(0,0,0,0.3)]"
        style={{ animation: "splash-logo 820ms cubic-bezier(0.22, 0.61, 0.36, 1) both" }}
      />

      <div
        className="flex flex-col items-center gap-1 px-8 text-center"
        style={{ animation: "splash-texte 560ms cubic-bezier(0.22, 0.61, 0.36, 1) 240ms both" }}
      >
        <p className="text-[1.3125rem] font-extrabold tracking-[-0.02em] text-white">
          {t.brand.first} {t.brand.second}
        </p>
        <p className="text-[0.75rem] leading-[1.5] text-white/75">{t.welcome.tagline}</p>
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
      `}</style>
    </div>,
    document.body,
  );
}
