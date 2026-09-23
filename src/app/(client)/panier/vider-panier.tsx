"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { viderPanier } from "@/app/actions/cart";

/**
 * Vider le panier.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Deux touchers, pas un
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le bouton demande confirmation en se transformant, plutôt qu'en ouvrant une
 * fenêtre. Une boîte de dialogue pour vider un panier est disproportionnée ;
 * mais un seul toucher, à côté de la liste, effacerait un quart d'heure de
 * courses sur une fausse manœuvre — et rien ici ne se défait.
 *
 * Il reste discret, en petit et sans couleur d'alerte : c'est une action de
 * ménage, pas une action qu'on veut encourager. Le bouton qui doit attirer
 * l'œil sur cet écran s'appelle « Commander ».
 */
export function ViderPanier() {
  const { t } = useI18n();
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [pending, startTransition] = useTransition();

  function vider() {
    startTransition(async () => {
      const r = await viderPanier();
      if (r.ok) router.refresh();
      setConfirme(false);
    });
  }

  return (
    <button
      type="button"
      onClick={() => (confirme ? vider() : setConfirme(true))}
      onBlur={() => setConfirme(false)}
      disabled={pending}
      className={
        "self-end rounded-full px-3 py-[6px] text-[0.65625rem] font-bold transition-colors " +
        (confirme
          ? "bg-[var(--color-live-fill)] text-white"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")
      }
    >
      {pending ? "…" : confirme ? t.cart.clearConfirm : t.cart.clear}
    </button>
  );
}
