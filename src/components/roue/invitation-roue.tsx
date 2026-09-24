"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Écrans où l'invitation n'a rien à faire : elle intercepterait un formulaire. */
const ROUTES_EXCLUES = ["/connexion", "/inscription"];

/**
 * Les roues déjà proposées, et le jour où elles l'ont été.
 *
 * Une simple date suffisait, et c'était le défaut : le premier jour où un
 * commerçant ouvrait sa roue, on l'annonçait — puis plus rien de la
 * journée, même si trois autres boutiques en ouvraient une. La deuxième
 * roue n'existait pour personne.
 */
const CLE_VUES = "meg-roues-proposees";

/** Une seule invitation par lancement : deux d'affilée sont un péage. */
const CLE_SESSION = "meg-roue-session";

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

/** Ce qui a déjà été proposé, et quand. Les entrées d'hier sont oubliées. */
function lireVues(): Record<string, string> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_VUES) ?? "{}") as Record<string, string>;
    const jour = aujourdhui();
    // Seul le jour courant compte : le reste ne sert qu'à faire grossir le stockage.
    return Object.fromEntries(Object.entries(brut).filter(([, j]) => j === jour));
  } catch {
    return {};
  }
}

function ecrireVues(vues: Record<string, string>) {
  try {
    localStorage.setItem(CLE_VUES, JSON.stringify(vues));
  } catch {}
}

/** Les huit parts, en fête : violet de la marque, framboise, ambre, vert. */
const PARTS = ["#6d4b8f", "#e0556f", "#f0a83c", "#2f9e6b", "#8a5fb0", "#e8734a", "#f5c45e", "#3fb389"];

/**
 * La roue, dessinée et tournant lentement.
 *
 * Un emoji de grande roue tenait cette place. Il disait « fête foraine », pas
 * « vous pouvez gagner quelque chose » — et il ne bougeait pas. Une roue qui
 * tourne, même lentement, se regarde : c'est le mouvement qui retient l'œil,
 * pas la couleur.
 *
 * Dessinée plutôt qu'importée : huit parts, un pointeur, un halo qui respire.
 * Quelques lignes de SVG contre une image à charger — et elle s'affiche avant
 * même que le réseau ait répondu, ce qui est le propre d'une fenêtre qui
 * s'ouvre d'elle-même.
 *
 * Elle tourne en douze secondes et sans à-coups : une rotation rapide aurait
 * l'air d'un chargement, et on attendrait qu'elle s'arrête.
 */
function RouetteAnimee() {
  return (
    <span aria-hidden className="relative flex h-[104px] w-[104px] items-center justify-center">
      <span
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(224,85,111,0.45),transparent_68%)]"
        style={{ animation: "roue-halo 2.6s ease-in-out infinite" }}
      />

      <svg
        viewBox="0 0 100 100"
        className="relative h-[92px] w-[92px] drop-shadow-[0_8px_20px_rgba(36,31,46,0.28)]"
        style={{ animation: "roue-tourne 12s linear infinite" }}
      >
        {PARTS.map((teinte, i) => {
          const part = 360 / PARTS.length;
          const p = (a: number) => [
            50 + 46 * Math.cos(((a - 90) * Math.PI) / 180),
            50 + 46 * Math.sin(((a - 90) * Math.PI) / 180),
          ];
          const [x1, y1] = p(i * part);
          const [x2, y2] = p((i + 1) * part);

          return (
            <path
              key={teinte + i}
              d={`M50 50 L${x1.toFixed(2)} ${y1.toFixed(2)} A46 46 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
              fill={teinte}
              stroke="#ffffff"
              strokeWidth="1.4"
            />
          );
        })}
        <circle cx="50" cy="50" r="9" fill="#ffffff" />
        <circle cx="50" cy="50" r="3.4" fill="#6d4b8f" />
      </svg>

      {/* Le pointeur ne tourne pas : c'est la roue qui passe devant lui. */}
      <span className="absolute top-0 start-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[13px] border-x-transparent border-t-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)] rtl:translate-x-1/2" />
    </span>
  );
}

/**
 * « La boutique X a une roue de la chance ».
 *
 * ────────────────────────────────────────────────────────────────────────
 * Une roue par lancement, chacune une fois par jour
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une fenêtre qui s'ouvre à chaque page devient un péage : on apprend à la
 * fermer sans la lire, et le commerçant qui paie les lots n'a plus de public.
 * Elle ne s'ouvre donc qu'une fois par lancement de l'application.
 *
 * Mais une fois par **jour**, comme c'était écrit d'abord, était pire : le
 * premier commerçant à ouvrir sa roue prenait la journée, et la deuxième roue
 * n'existait pour personne. Chaque roue a donc sa propre mémoire — proposée
 * une fois par jour, la suivante au lancement d'après.
 *
 * Jamais pour quelqu'un qui a déjà joué : `deja_joue` est calculé en base,
 * dans la même fonction qui liste les roues.
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
  const pathname = usePathname();
  const exclu = ROUTES_EXCLUES.includes(pathname);
  const [roue, setRoue] = useState<RoueOuverte | null>(null);
  const [monte, setMonte] = useState(false);

  useEffect(() => setMonte(true), []);

  useEffect(() => {
    // Ne pas même armer le minuteur sur un écran d'authentification : la
    // roue ne doit jamais venir intercepter un formulaire de connexion.
    if (exclu) return;

    let vivant = true;

    /*
      Déjà invité pendant ce lancement : on n'insiste pas. `sessionStorage`
      meurt avec l'application fermée, donc la prochaine ouverture pourra
      proposer la roue suivante.
    */
    try {
      if (sessionStorage.getItem(CLE_SESSION) === "1") return;
    } catch {
      // Stockage indisponible : on montre une fois, sans mémoire.
    }

    const minuterie = setTimeout(() => {
      void (async () => {
        try {
          const { data } = await createClient().rpc("roues_ouvertes");
          if (!vivant) return;

          const vues = lireVues();
          const jour = aujourdhui();

          /*
            Une roue jouable, et pas déjà proposée aujourd'hui. Le même jour,
            une roue nouvelle passe donc devant celle d'hier ; le lendemain,
            toutes redeviennent proposables — une par lancement.
          */
          const jouable = (data ?? []).find((r) => !r.deja_joue && vues[r.wheel_id] !== jour);
          if (!jouable) return;

          setRoue(jouable as RoueOuverte);

          try {
            sessionStorage.setItem(CLE_SESSION, "1");
            ecrireVues({ ...vues, [jouable.wheel_id]: jour });
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
  }, [exclu]);

  if (!monte || !roue || exclu) return null;

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
        <RouetteAnimee />

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
        @keyframes roue-tourne {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes roue-halo {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.6;  transform: scale(1.08); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
