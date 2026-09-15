"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decompte, formatDecompte } from "@/lib/black-friday";

/**
 * Le compte à rebours, calé sur l'horloge du serveur.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi l'heure du serveur, et comment
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une horloge de téléphone peut être en avance de dix minutes — réglée à la
 * main, fuseau mal choisi, batterie retirée. Affichée telle quelle, elle
 * annoncerait « terminé » à des clients qui peuvent encore acheter, ou
 * « actif » à des clients dont la commande sera facturée au prix normal.
 *
 * Le serveur rend donc son heure avec la page. On calcule **une fois**
 * l'écart entre les deux horloges, et le décompte avance ensuite sur celle du
 * navigateur corrigée de cet écart. Pas de requête toutes les secondes : un
 * écart ne dérive pas en quelques minutes.
 *
 * Ce composant n'autorise rien. Qu'une offre soit active se décide dans la
 * policy de la base ; ceci n'en est que l'affichage.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Au passage de la borne
 * ────────────────────────────────────────────────────────────────────────
 *
 * Quand le décompte atteint zéro, la page se rafraîchit une fois. Les offres
 * apparaissent à 00:01 et disparaissent à 00:01 sans que personne n'ait à
 * recharger : c'est le serveur qui les rend, il suffit de lui redemander.
 */
export function CompteARebours({
  cible,
  serveurMaintenant,
  libelle,
  variante = "clair",
  boites = false,
}: {
  /** L'instant visé, ISO. */
  cible: string;
  /** L'heure du serveur au moment du rendu, ISO. */
  serveurMaintenant: string;
  libelle: string;
  variante?: "clair" | "sombre";
  /**
   * Trois cases chiffrées plutôt qu'une ligne de texte.
   *
   * Sur la bannière de l'accueil, le décompte est l'argument : en cases, il se
   * lit d'un coup d'œil et ne se confond pas avec le reste du texte. La ligne
   * compacte reste la forme par défaut, là où le décompte accompagne sans
   * dominer — l'écran du vendeur, la page de la campagne.
   */
  boites?: boolean;
}) {
  const router = useRouter();

  // L'écart serveur − navigateur, figé au montage.
  const ecart = useRef<number | null>(null);
  const [reste, setReste] = useState<number | null>(null);
  const rafraichi = useRef(false);

  useEffect(() => {
    ecart.current = Date.parse(serveurMaintenant) - Date.now();
    const fin = Date.parse(cible);

    const mettreAJour = () => {
      const maintenant = Date.now() + (ecart.current ?? 0);
      const r = fin - maintenant;
      setReste(r);

      if (r <= 0 && !rafraichi.current) {
        rafraichi.current = true;
        // Un léger délai : laisser au serveur le temps de franchir la borne
        // lui aussi, sans quoi il rendrait encore l'état d'avant.
        window.setTimeout(() => router.refresh(), 1500);
      }

      return r;
    };

    const r = mettreAJour();

    /*
      Une seconde sous la journée, trente au-delà.

      À plus d'un jour, les secondes ne s'affichent pas : réveiller la page
      chaque seconde pour ne rien changer à l'écran serait du gaspillage pur
      — sur un téléphone, c'est de la batterie.
    */
    const pas = r > 86_400_000 ? 30_000 : 1_000;
    const minuteur = window.setInterval(mettreAJour, pas);
    return () => window.clearInterval(minuteur);
  }, [cible, serveurMaintenant, router]);

  const d = decompte(reste ?? 0);
  const sombre = variante === "sombre";

  if (boites) {
    /*
      Au-delà d'un jour, les secondes ne disent rien : on montre alors
      jours · heures · minutes. Sous la journée, les secondes reprennent la
      dernière case — c'est là qu'elles pressent.
    */
    const deux = (n: number) => String(n).padStart(2, "0");
    const cases = reste === null
      ? ["--", "--", "--"]
      : d.jours > 0
        ? [deux(d.jours), deux(d.heures), deux(d.minutes)]
        : [deux(d.heures), deux(d.minutes), deux(d.secondes)];

    return (
      <div className="flex flex-col items-end gap-[6px]" role="timer" aria-live="off">
        <span className="text-[0.53125rem] font-bold tracking-[0.16em] text-white/55 uppercase">
          {libelle}
        </span>
        <span className="flex gap-[5px]" dir="ltr" suppressHydrationWarning>
          {cases.map((valeur, i) => (
            <span
              key={i}
              className={`min-w-[34px] rounded-[12px] px-[7px] py-[9px] text-center font-mono text-[1rem] font-bold tabular-nums ${
                i === 2
                  ? "bg-[var(--color-live-fill)] text-white"
                  : "border border-white/15 bg-white/10 text-white"
              }`}
            >
              {valeur}
            </span>
          ))}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1" role="timer" aria-live="off">
      <span
        className={`text-[0.625rem] font-bold tracking-[0.1em] uppercase ${
          sombre ? "text-white/70" : "text-[var(--color-muted)]"
        }`}
      >
        {libelle}
      </span>
      {/*
        Tabulaires : sans elles, chaque seconde qui passe fait danser la
        largeur des chiffres, et le bloc tremble sous l'œil.

        Avant le montage, un tiret plutôt qu'un zéro : « 00h 00m 00s »
        annoncerait une fin qui n'a pas lieu.
      */}
      <span
        className={`font-mono text-[1.25rem] font-bold tabular-nums tracking-tight ${
          sombre ? "text-white" : "text-[var(--color-ink)]"
        }`}
        dir="ltr"
        suppressHydrationWarning
      >
        {reste === null ? "—" : formatDecompte(d)}
      </span>
    </div>
  );
}
