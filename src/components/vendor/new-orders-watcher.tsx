"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { MotionProvider } from "@/components/ui/motion";

/**
 * Prévenir le vendeur qu'une commande vient d'arriver.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi un abonnement ici, et un sondage ailleurs
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le reste de l'application relit périodiquement plutôt que de s'abonner, et
 * pour une bonne raison : sur la carte des taxis, chaque position publiée était
 * diffusée à tous les spectateurs, et le coût croissait comme le produit des
 * chauffeurs par les spectateurs.
 *
 * Ici le calcul s'inverse. Une commande est un événement rare — quelques-unes
 * par jour et par boutique — et les destinataires sont au nombre d'un : le
 * propriétaire. Un abonnement filtré sur `shop_id` ne transporte donc presque
 * rien, tandis qu'un sondage interrogerait la base toutes les trente secondes
 * pour n'apprendre, la plupart du temps, rien du tout.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que le vendeur voit
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une bannière, et le tableau de bord qui se met à jour derrière elle. Pas de
 * son, pas de fenêtre modale : un vendeur consulte cet écran en servant un
 * client au comptoir, et une interruption qu'il faut fermer arrive toujours au
 * mauvais moment.
 *
 * Il reçoit déjà une notification poussée quand l'application est fermée. Ceci
 * couvre l'autre moitié : quand elle est ouverte, et qu'aucune notification ne
 * s'affiche parce que l'écran est au premier plan.
 */

export function NewOrdersWatcher({ shopId }: { shopId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [arrivees, setArrivees] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    const canal = supabase
      .channel(`boutique:${shopId}:commandes`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          // Le filtre est essentiel : sans lui, chaque vendeur recevrait les
          // commandes de tous les autres, et la facture suivrait.
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          setArrivees((n) => n + 1);

          /*
            Le rendu vient du serveur : c'est lui qu'on rafraîchit.

            Insérer la commande dans un état local obligerait à reconstruire ici
            tout ce que la page calcule — le chiffre d'affaires sur sept jours,
            le décompte, les articles. `router.refresh()` laisse ce travail où
            il est déjà écrit.
          */
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [shopId, router]);

  return (
    <MotionProvider>
      <AnimatePresence>
        {arrivees > 0 && (
          <m.button
            type="button"
            onClick={() => setArrivees(0)}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
            className="press flex w-full items-center gap-[10px] rounded-[14px] bg-[var(--color-brand-fill)] px-3 py-[10px] text-start text-white"
          >
            {/* Un point qui bat : quelque chose vient d'arriver, à l'instant. */}
            <m.span
              aria-hidden
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="h-[7px] w-[7px] flex-none rounded-full bg-white"
            />

            <span className="min-w-0 flex-1 text-[0.6875rem] font-bold">
              {arrivees === 1
                ? t.vendor.newOrder
                : t.vendor.newOrders.replace("{n}", String(arrivees))}
            </span>

            <span aria-hidden className="flex-none text-[0.75rem] leading-none opacity-70">
              ✕
            </span>
          </m.button>
        )}
      </AnimatePresence>
    </MotionProvider>
  );
}
