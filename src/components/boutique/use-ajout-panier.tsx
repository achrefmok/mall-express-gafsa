"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart, toggleFavorite } from "@/app/actions/cart";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Ajout au panier et favori depuis la page boutique, partagés par toutes
 * les mises en page par métier : redirection vers la connexion si besoin,
 * message bref (« toast » du handoff : fond #241f2e, 1,8 s), rafraîchis-
 * sement du panier flottant.
 */
export function useAjoutPanier() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current);
  }, []);

  function annoncer(m: string) {
    if (minuteur.current) clearTimeout(minuteur.current);
    setMessage(m);
    minuteur.current = setTimeout(() => setMessage(null), 1800);
  }

  function versConnexion() {
    router.push(`/connexion?suite=${encodeURIComponent(window.location.pathname)}`);
  }

  function ajouter(
    lignes: Array<{ productId: string; quantity?: number; size?: string | null }>,
    apres?: () => void,
  ) {
    startTransition(async () => {
      for (const ligne of lignes) {
        const result = await addToCart(ligne);
        if (!result.ok) {
          if (result.error === "Authentification requise") return versConnexion();
          annoncer(result.error);
          return;
        }
      }
      annoncer(t.product.added);
      apres?.();
      router.refresh();
    });
  }

  function basculerFavori(productId: string, estFavori: boolean | undefined, apres?: (nouveau: boolean) => void) {
    if (estFavori === undefined) return versConnexion();
    startTransition(async () => {
      const result = await toggleFavorite(productId, estFavori);
      if (!result.ok) {
        annoncer(result.error);
        return;
      }
      apres?.(!estFavori);
    });
  }

  return { ajouter, basculerFavori, pending, message, annoncer };
}

/** Le message bref du handoff, en bas d'écran au-dessus du panier flottant. */
export function ToastBoutique({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[84px] z-50 flex justify-center px-4"
    >
      <span className="rounded-[14px] bg-[#241f2e] px-4 py-[10px] text-center text-[0.875rem] font-bold text-white shadow-[0_10px_30px_rgba(20,14,26,.3)]">
        {message}
      </span>
    </div>
  );
}
