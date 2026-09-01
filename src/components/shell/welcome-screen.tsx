"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";

const SEEN_KEY = "meg-welcome-seen";

/**
 * L'écran de bienvenue, une seule fois dans la vie de l'application.
 *
 * Il dit ce qu'est le site en trois mots pendant que la page se charge derrière
 * lui, puis s'efface. Ce n'est pas un tutoriel — le guide pas à pas existe
 * ailleurs — c'est le temps d'une respiration, celui qui manque à une
 * application web qui s'ouvre sur un écran à moitié construit.
 *
 * Trois décisions le rendent supportable plutôt qu'agaçant :
 *
 *   · **Il ne bloque rien.** Un toucher l'efface immédiatement, et il part seul
 *     après deux secondes. Un écran d'accueil dont on ne peut pas sortir est un
 *     péage, pas une présentation.
 *   · **Une seule fois.** Le drapeau est posé à l'ouverture, pas à la
 *     fermeture : quelqu'un qui le balaie aussitôt ne doit pas le revoir.
 *   · **Il se saute entièrement** si le système demande des animations
 *     réduites, ou si la page est déjà visitée.
 *
 * La profondeur vient d'un `perspective` sur le conteneur et d'un `translateZ`
 * sur le logo : les deux plans n'arrivent pas à la même vitesse, ce qui donne le
 * relief sans image 3D ni bibliothèque. C'est la seule 3D de l'application, et
 * elle dure une seconde.
 */
export function WelcomeScreen() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;

    // Le logo de l'application, changé par l'administration. Rien à voir avec
    // les réglages serveur : `app_brand` est lisible par tous.
    void (async () => {
      try {
        const { data } = await createClient()
          .from("app_brand")
          .select("app_logo_url")
          .eq("id", true)
          .maybeSingle();
        setLogo(data?.app_logo_url ?? null);
      } catch {
        // L'accueil n'attend pas le logo : si la lecture échoue, on garde le
        // monogramme et l'écran de bienvenue reste inaltéré.
      }
    })();

    // Une animation d'accueil est exactement ce que ce réglage écarte.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      localStorage.setItem(SEEN_KEY, "1");
      return;
    }

    localStorage.setItem(SEEN_KEY, "1");
    setVisible(true);

    const out = setTimeout(() => setLeaving(true), 1900);
    const gone = setTimeout(() => setVisible(false), 2320);

    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, []);

  if (!visible || !mounted) return null;

  function dismiss() {
    setLeaving(true);
    setTimeout(() => setVisible(false), 380);
  }

  return createPortal(
    <div
      role="presentation"
      onClick={dismiss}
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 bg-[image:var(--gradient-brand)]"
      style={{
        perspective: "800px",
        opacity: leaving ? 0 : 1,
        transition: "opacity 380ms ease-out",
      }}
    >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo de l'application, chargé dynamiquement
          <img
            src={logo}
            alt=""
            className="flex h-[86px] w-[86px] items-center justify-center rounded-[26px] object-cover"
            style={{
              animation: "welcome-mark 900ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
            }}
          />
        ) : (
          <span
            className="flex h-[86px] w-[86px] items-center justify-center rounded-[26px] bg-white/15 text-[1.875rem] font-bold text-white backdrop-blur-sm"
            style={{
              animation: "welcome-mark 900ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
            }}
          >
            M
          </span>
        )}

      <div className="flex flex-col items-center gap-1 px-8 text-center">
        <p
          className="text-[1.25rem] font-bold tracking-[-0.01875rem] text-white"
          style={{ animation: "enter-up 520ms cubic-bezier(0.22,0.61,0.36,1) 220ms both" }}
        >
          {t.brand.first} {t.brand.second}
        </p>
        <p
          className="text-[0.75rem] leading-[1.5] text-white/80"
          style={{ animation: "enter-up 520ms cubic-bezier(0.22,0.61,0.36,1) 340ms both" }}
        >
          {t.welcome.tagline}
        </p>
      </div>

      {/*
        Les mots-clés, décalés l'un après l'autre. Trente millisecondes de plus
        par élément : assez pour que l'œil suive la séquence, trop peu pour
        qu'on attende la fin.
      */}
      <div className="flex flex-wrap items-center justify-center gap-[6px] px-8">
        {[t.nav.marketplace, t.nav.lives, t.nav.deals, t.nav.services].map((mot, i) => (
          <span
            key={mot}
            className="rounded-[10px] bg-white/12 px-[10px] py-[5px] text-[0.625rem] font-semibold text-white/90"
            style={{
              animation: `enter-up 420ms cubic-bezier(0.22,0.61,0.36,1) ${480 + i * 70}ms both`,
            }}
          >
            {mot}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes welcome-mark {
          from { opacity: 0; transform: translateZ(-140px) scale(0.86); }
          to   { opacity: 1; transform: translateZ(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
