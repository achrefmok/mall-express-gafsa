"use client";

import { useRef, useState, useTransition } from "react";
import { tournerLaRoue } from "@/app/actions/roue";
import { Button, Card } from "@/components/ui/primitives";
import type { AppLocale } from "@/types/database";

export interface CaseRoue {
  id: string;
  label: string;
  label_ar: string | null;
  is_win: boolean;
  /**
   * L'ordre voulu par le commerçant.
   *
   * La colonne s'appelle `position` dans la table, `rang` ici : `position` est
   * un mot réservé de PostgreSQL, refusé dans la signature d'une fonction.
   */
  rang: number;
}

/** Les teintes des parts, alternées : lisibles, et sans dépendre des lots. */
const TEINTES = ["#6d4b8f", "#8a5fb0", "#5a3a78", "#9a6fc0", "#4a2f66", "#7d54a0"];

/**
 * La roue de la chance.
 *
 * ────────────────────────────────────────────────────────────────────────
 * L'ordre des opérations, qui est tout
 * ────────────────────────────────────────────────────────────────────────
 *
 * On demande d'abord, on tourne ensuite. La base choisit le lot sous verrou,
 * rend son identifiant, et l'animation se contente de s'arrêter en face. La
 * tentation inverse — tourner, puis annoncer où l'on s'est arrêté — donne une
 * roue que l'on truque depuis la console du navigateur, et une roue truquable
 * ne vaut plus rien : ni pour le commerçant qui paie les lots, ni pour les
 * clients honnêtes.
 *
 * L'attente est donc réelle, pas décorative : les trois secondes de rotation
 * couvrent un aller-retour déjà terminé. C'est le seul endroit où faire
 * patienter est honnête.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le dessin
 * ────────────────────────────────────────────────────────────────────────
 *
 * En SVG et en CSS, sans bibliothèque : une roue est un disque découpé en
 * parts égales et une rotation. Importer trois cents kilo-octets d'animation
 * pour cela ferait payer chaque visiteur, y compris ceux qui ne joueront
 * jamais.
 */
export function RoueDeLaChance({
  wheelId,
  titre,
  cases,
  locale,
  connecte,
}: {
  wheelId: string;
  titre: string;
  cases: CaseRoue[];
  locale: AppLocale;
  connecte: boolean;
}) {
  const [angle, setAngle] = useState(0);
  const [resultat, setResultat] = useState<{ label: string; code: string; gagne: boolean } | null>(
    null,
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [tourne, setTourne] = useState(false);
  const [pending, startTransition] = useTransition();
  const tours = useRef(0);

  if (cases.length === 0) return null;

  const part = 360 / cases.length;
  const libelle = (c: CaseRoue) => (locale === "ar" ? (c.label_ar ?? c.label) : c.label);

  function jouer() {
    setErreur(null);
    setResultat(null);

    startTransition(async () => {
      const r = await tournerLaRoue(wheelId);

      if (!r.ok) {
        setErreur(r.error);
        return;
      }

      const gagnant = cases.findIndex((c) => c.id === r.data.prize_id);
      /*
        Le lot tiré peut ne pas être dans les cases affichées — un stock
        épuisé entre le chargement de la page et le tour. On s'arrête alors
        sur la première case plutôt que de tourner dans le vide : le texte
        du résultat, lui, dit la vérité.
      */
      const index = gagnant >= 0 ? gagnant : 0;

      // Cinq tours complets, puis la part visée, pointeur en haut.
      tours.current += 5;
      setAngle(tours.current * 360 - index * part - part / 2);
      setTourne(true);

      setTimeout(() => {
        setTourne(false);
        setResultat({
          label: locale === "ar" ? (r.data.label_ar ?? r.data.label) : r.data.label,
          code: r.data.code,
          gagne: r.data.is_win,
        });
      }, 3200);
    });
  }

  return (
    <Card className="flex flex-col items-center gap-3 p-4">
      <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">{titre}</p>

      <div className="relative h-[240px] w-[240px]">
        {/* Le pointeur, en haut : c'est lui qui désigne, pas le hasard du regard. */}
        <span
          aria-hidden
          className="absolute start-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-[var(--color-live)] rtl:translate-x-1/2"
        />

        <svg
          viewBox="0 0 200 200"
          className="h-full w-full drop-shadow-[0_10px_24px_rgba(36,31,46,0.18)]"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: tourne ? "transform 3.1s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          }}
        >
          {cases.map((c, i) => {
            const debut = (i * part - 90) * (Math.PI / 180);
            const fin = ((i + 1) * part - 90) * (Math.PI / 180);
            const grand = part > 180 ? 1 : 0;
            const x1 = 100 + 96 * Math.cos(debut);
            const y1 = 100 + 96 * Math.sin(debut);
            const x2 = 100 + 96 * Math.cos(fin);
            const y2 = 100 + 96 * Math.sin(fin);
            const milieu = (i * part + part / 2 - 90) * (Math.PI / 180);

            return (
              <g key={c.id}>
                <path
                  d={`M100 100 L${x1} ${y1} A96 96 0 ${grand} 1 ${x2} ${y2} Z`}
                  fill={TEINTES[i % TEINTES.length]}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={100 + 62 * Math.cos(milieu)}
                  y={100 + 62 * Math.sin(milieu)}
                  fill="#ffffff"
                  fontSize="8"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${i * part + part / 2} ${100 + 62 * Math.cos(milieu)} ${100 + 62 * Math.sin(milieu)})`}
                >
                  {libelle(c).slice(0, 16)}
                </text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="16" fill="#ffffff" />
        </svg>
      </div>

      {resultat && (
        <div
          className={
            "flex w-full flex-col items-center gap-1 rounded-[16px] p-3 text-center " +
            (resultat.gagne ? "bg-[rgba(31,122,61,0.1)]" : "bg-[var(--color-app)]")
          }
        >
          <p
            className={
              "text-[0.8125rem] font-bold " +
              (resultat.gagne ? "text-[#0f7a3d]" : "text-[var(--color-muted)]")
            }
          >
            {resultat.label}
          </p>
          {resultat.gagne && (
            <>
              <p dir="ltr" className="text-[1.0625rem] font-extrabold tracking-[0.18em] text-[var(--color-ink)]">
                {resultat.code}
              </p>
              <p className="text-[0.625rem] leading-[1.5] text-[var(--color-muted)]">
                Montrez ce code en boutique pour retirer votre lot.
              </p>
            </>
          )}
        </div>
      )}

      {erreur && <p className="text-[0.65625rem] text-[var(--color-live)]">{erreur}</p>}

      {connecte ? (
        <Button onClick={jouer} disabled={pending || tourne} className="w-full">
          {tourne ? "…" : resultat ? "Rejouer" : "Tourner la roue"}
        </Button>
      ) : (
        <p className="text-center text-[0.65625rem] text-[var(--color-muted)]">
          Connectez-vous pour tourner la roue.
        </p>
      )}
    </Card>
  );
}
