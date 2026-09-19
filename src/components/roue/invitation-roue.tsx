"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Une invitation par jour, pas une par navigation. */
const CLE_JOUR = "meg-roue-invitation";

/** Après l'écran d'ouverture : cinq secondes, plus le temps de se poser. */
const DELAI = 6200;

interface RoueOuverte {
  wheel_id: string;
  title: string;
  shop_name: string;
  shop_slug: string;
  shop_logo: string | null;
  deja_joue: boolean;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * « La boutique X a une roue de la chance ».
 *
 * ────────────────────────────────────────────────────────────────────────
 * Une fois par jour, et seulement si le tour est jouable
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une fenêtre qui s'ouvre à chaque lancement devient un péage : on apprend à
 * la fermer sans la lire, et le commerçant qui paie les lots n'a plus de
 * public. Elle ne s'ouvre donc qu'une fois par jour — la même cadence que le
 * quota de la roue — et jamais pour quelqu'un qui a déjà joué : `deja_joue`
 * est calculé en base, dans la même fonction qui liste les roues.
 *
 * Elle attend aussi que l'écran d'ouverture soit parti. Deux surfaces
 * empilées au lancement donnent l'impression que l'application ne sait pas ce
 * qu'elle veut montrer.
 *
 * Aucun tour ne se joue ici : l'invitation mène à la boutique. C'est la
 * moitié de son intérêt pour le commerçant — on ne gagne pas un lot sans
 * avoir vu sa vitrine.
 */
export function InvitationRoue() {
  const [roue, setRoue] = useState<RoueOuverte | null>(null);
  const [monte, setMonte] = useState(false);

  useEffect(() => setMonte(true), []);

  useEffect(() => {
    let vivant = true;

    try {
      if (localStorage.getItem(CLE_JOUR) === aujourdhui()) return;
    } catch {
      // Stockage indisponible : on montre une fois, sans mémoire.
    }

    const minuterie = setTimeout(() => {
      void (async () => {
        try {
          const { data } = await createClient().rpc("roues_ouvertes");
          if (!vivant) return;

          const jouable = (data ?? []).find((r) => !r.deja_joue);
          if (!jouable) return;

          setRoue(jouable as RoueOuverte);
          try {
            localStorage.setItem(CLE_JOUR, aujourdhui());
          } catch {}
        } catch {
          // Réseau absent : pas d'invitation, et rien à signaler.
        }
      })();
    }, DELAI);

    return () => {
      vivant = false;
      clearTimeout(minuterie);
    };
  }, []);

  if (!monte || !roue) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${roue.shop_name} — ${roue.title}`}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(36,31,46,0.5)] p-4 pb-8"
      onClick={() => setRoue(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[380px] flex-col items-center gap-3 rounded-[24px] bg-[var(--color-surface-solid)] p-5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
        style={{ animation: "roue-entree 380ms cubic-bezier(0.22, 0.61, 0.36, 1) both" }}
      >
        <span
          aria-hidden
          className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[image:var(--gradient-brand)] text-[1.5rem]"
        >
          🎡
        </span>

        <p className="text-[0.9375rem] font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
          {roue.shop_name} a une roue de la chance
        </p>
        <p className="text-[0.6875rem] leading-[1.5] text-[var(--color-muted)]">
          Un tour par jour, et le lot se retire en boutique.
        </p>

        <Link
          href={`/boutique/${roue.shop_slug}`}
          onClick={() => setRoue(null)}
          className="w-full rounded-full bg-[var(--color-brand)] py-[11px] text-[0.75rem] font-bold text-white"
        >
          Tourner la roue
        </Link>

        <button
          type="button"
          onClick={() => setRoue(null)}
          className="text-[0.65625rem] font-semibold text-[var(--color-muted)]"
        >
          Plus tard
        </button>
      </div>

      <style>{`
        @keyframes roue-entree {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
