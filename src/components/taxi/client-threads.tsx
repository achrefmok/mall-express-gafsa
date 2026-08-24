"use client";

import { m } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { usePoll } from "@/lib/use-poll";
import { cx, monogram } from "@/lib/format";
import { Avatar } from "@/components/ui/primitives";

/**
 * Les conversations en cours du client, sur la page taxi elle-même.
 *
 * Le fil de discussion n'apparaissait qu'après avoir touché un chauffeur dans le
 * tableau. Quelqu'un qui avait écrit la veille, ou qui revenait après avoir
 * fermé l'application, ne voyait donc rien : la réponse du chauffeur existait,
 * mais il fallait deviner lequel des chauffeurs rouvrir pour la lire. Une
 * conversation qu'on ne retrouve pas est une conversation perdue.
 *
 * Elles se présentent donc d'emblée, avec le nombre de messages non lus et le
 * début de la dernière phrase — assez pour savoir s'il faut ouvrir, et où.
 *
 * Le bloc disparaît entièrement quand il n'y a aucune conversation : sur un
 * écran dont la carte est le sujet, une carte vide intitulée « Conversations »
 * ne fait qu'occuper la place.
 */

interface Ligne {
  driverId: string;
  nom: string;
  dernier: string;
  duChauffeur: boolean;
  nonLus: number;
  quand: string;
}

export function ClientThreads({
  clientId,
  selection,
  onOuvrir,
}: {
  /** Absent : personne n'est connecté, il n'y a pas de conversation. */
  clientId: string | null;
  selection: string | null;
  onOuvrir: (driverId: string) => void;
}) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<
    Array<{ driver_id: string; from_driver: boolean; body: string; created_at: string; read_at: string | null }>
  >([]);
  const [noms, setNoms] = useState<Record<string, string>>({});

  const relire = useCallback(async () => {
    if (!clientId) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("taxi_messages")
      .select("driver_id, from_driver, body, created_at, read_at")
      .eq("client_id", clientId)
      .order("created_at")
      .limit(200);

    if (!data) return;
    setMessages(data);

    /*
      Les noms des chauffeurs, une seule fois chacun.

      Cherchés à part et non par jointure : les policies de `taxi_drivers` et de
      `taxi_messages` sont distinctes, et une jointure refusée ferait échouer la
      lecture entière au lieu de la seule colonne du nom.
    */
    const inconnus = [...new Set(data.map((m) => m.driver_id))].filter((id) => !noms[id]);
    if (inconnus.length === 0) return;

    const { data: chauffeurs } = await supabase
      .from("taxi_drivers")
      .select("id, display_name")
      .in("id", inconnus);

    if (chauffeurs) {
      setNoms((actuels) => ({
        ...actuels,
        ...Object.fromEntries(chauffeurs.map((c) => [c.id, c.display_name])),
      }));
    }
  }, [clientId, noms]);

  useEffect(() => {
    void relire();
    // `relire` change avec `noms` ; la relance périodique suffit à tenir la
    // liste à jour sans boucler à chaque nom découvert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  /*
    Vingt secondes.

    Plus lent que le fil ouvert — cinq secondes, parce qu'on y attend une
    réponse — et plus rapide que la carte, dont trente secondes suffisent. Ici on
    guette l'arrivée d'un message sans le lire : le compteur peut attendre un
    battement.
  */
  usePoll(relire, 20_000);

  const lignes: Ligne[] = useMemo(() => {
    const par = new Map<string, typeof messages>();
    for (const message of messages) {
      const liste = par.get(message.driver_id) ?? [];
      liste.push(message);
      par.set(message.driver_id, liste);
    }

    return [...par.entries()]
      .map(([driverId, liste]) => {
        const dernier = liste[liste.length - 1];
        return {
          driverId,
          nom: noms[driverId] ?? t.taxi.taxi,
          dernier: dernier?.body ?? "",
          duChauffeur: dernier?.from_driver === true,
          // Non lus : ce que le chauffeur a écrit et qu'on n'a pas encore ouvert.
          nonLus: liste.filter((m) => m.from_driver && m.read_at === null).length,
          quand: dernier?.created_at ?? "",
        };
      })
      .sort((a, b) => b.quand.localeCompare(a.quand));
  }, [messages, noms, t]);

  if (!clientId || lignes.length === 0) return null;

  const total = lignes.reduce((n, l) => n + l.nonLus, 0);

  return (
    <m.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col gap-1 rounded-[18px] bg-[var(--color-surface-solid)] p-3 shadow-[0_6px_18px_rgba(60,40,90,0.07)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[0.6875rem] font-bold text-[var(--color-ink)]">
          {t.taxi.myConversations}
        </h2>
        {total > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-brand-fill)] px-[5px] text-[0.53125rem] font-bold text-white">
            {total}
          </span>
        )}
      </div>

      {lignes.map((ligne) => (
        <button
          key={ligne.driverId}
          type="button"
          onClick={() => onOuvrir(ligne.driverId)}
          className={cx(
            "press -mx-1 flex items-center gap-[9px] rounded-[12px] px-1 py-[7px] text-start transition-colors",
            selection === ligne.driverId && "bg-[var(--color-brand-tint)]",
          )}
        >
          <Avatar initials={monogram(ligne.nom)} size={26} />

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.65625rem] font-bold text-[var(--color-ink)]">
              {ligne.nom}
            </span>
            <span
              className={cx(
                "block truncate text-[0.59375rem]",
                ligne.nonLus > 0
                  ? "font-semibold text-[var(--color-ink)]"
                  : "text-[var(--color-muted)]",
              )}
            >
              {ligne.duChauffeur ? "" : `${t.taxi.youPrefix} `}
              {ligne.dernier}
            </span>
          </span>

          {ligne.nonLus > 0 && (
            <span className="flex h-[17px] min-w-[17px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-fill)] px-[4px] text-[0.5rem] font-bold text-white">
              {ligne.nonLus}
            </span>
          )}
        </button>
      ))}
    </m.section>
  );
}
