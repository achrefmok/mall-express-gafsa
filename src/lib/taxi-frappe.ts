"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * « En train d'écrire… », sans rien écrire en base.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi la diffusion, et surtout pas une table
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le réflexe serait une colonne `typing_at` mise à jour à chaque frappe. Ce
 * serait une écriture toutes les quelques centaines de millisecondes, par
 * personne et par conversation — exactement la forme de trafic qui a déjà
 * épuisé le quota de ce projet une fois, du temps où chaque position GPS
 * partait en temps réel.
 *
 * Un indicateur de frappe n'a aucune valeur passé la seconde qui suit : il ne
 * mérite ni durabilité, ni relecture, ni historique. Le canal `broadcast` de
 * Supabase transporte des messages qui ne touchent jamais Postgres — c'est
 * précisément ce qu'il faut ici, et cela ne coûte rien au quota de base.
 *
 * Deux garde-fous, parce qu'un signal qui ment est pire que pas de signal :
 *
 *   · on n'émet **qu'un signal par seconde et demie**, quelle que soit la
 *     vitesse de frappe. Le destinataire voit « écrit… », pas un stroboscope ;
 *   · l'indicateur **s'éteint tout seul** au bout de trois secondes sans
 *     nouveau signal. Sans cela, quelqu'un qui ferme l'onglet en plein mot
 *     resterait « en train d'écrire » pour l'éternité, et l'autre attendrait
 *     un message qui ne viendrait jamais.
 */

/** Un signal au plus toutes les 1,5 s, même si le doigt va plus vite. */
const CADENCE_MS = 1_500;

/** Sans nouveau signal passé ce délai, l'autre a cessé d'écrire. */
const EXTINCTION_MS = 3_000;

/**
 * Le fil de frappe d'une conversation taxi.
 *
 * `moi` distingue les deux extrémités : on ignore ses propres signaux, sans
 * quoi on se verrait soi-même en train d'écrire.
 */
export function useFrappe(params: {
  driverId: string | null;
  clientId: string | null;
  moi: "client" | "chauffeur";
}) {
  const { driverId, clientId, moi } = params;
  const [autreEcrit, setAutreEcrit] = useState(false);

  const canal = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const dernierEnvoi = useRef(0);
  const extinction = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sujet = driverId && clientId ? `frappe:${driverId}:${clientId}` : null;

  useEffect(() => {
    if (!sujet) return;

    const supabase = createClient();
    const c = supabase
      .channel(sujet, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "frappe" }, (message) => {
        const de = (message.payload as { de?: string } | undefined)?.de;

        // Son propre écho, si jamais `self: false` n'a pas suffi.
        if (de === moi) return;

        setAutreEcrit(true);

        if (extinction.current) clearTimeout(extinction.current);
        extinction.current = setTimeout(() => setAutreEcrit(false), EXTINCTION_MS);
      })
      .subscribe();

    canal.current = c;

    return () => {
      if (extinction.current) clearTimeout(extinction.current);
      extinction.current = null;
      setAutreEcrit(false);
      // `removeChannel` et non `unsubscribe` : le client est mémoïsé pour
      // toute l'application, et un canal seulement désabonné y resterait.
      void supabase.removeChannel(c);
      canal.current = null;
    };
  }, [sujet, moi]);

  /** À appeler à chaque frappe. Se limite elle-même. */
  const signaler = useCallback(() => {
    const maintenant = Date.now();
    if (maintenant - dernierEnvoi.current < CADENCE_MS) return;
    dernierEnvoi.current = maintenant;

    void canal.current?.send({
      type: "broadcast",
      event: "frappe",
      payload: { de: moi },
    });
  }, [moi]);

  return { autreEcrit, signaler };
}
