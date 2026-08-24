"use client";

import { AnimatePresence, m } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { envoyerMessageTaxi } from "@/app/actions/taxi-chat";
import { usePoll } from "@/lib/use-poll";
import { cx, monogram } from "@/lib/format";
import { Avatar } from "@/components/ui/primitives";

/**
 * Négocier une course, par écrit.
 *
 * À Gafsa, le prix d'un taxi se discute. L'appel téléphonique le fait mal : on
 * appelle, le chauffeur conduit et décroche à moitié, on raccroche, on rappelle.
 * Trois messages règlent la même chose sans obliger personne à s'arrêter.
 *
 * Le fil est propre à un couple client-chauffeur : deux clients qui écrivent au
 * même chauffeur ne se voient pas.
 *
 * **La messagerie s'active d'elle-même.** Tant que la table n'existe pas, le
 * composant le détecte à la première lecture et propose l'appel — l'écran reste
 * utilisable, et il suffira de passer la migration pour que la conversation
 * apparaisse sans toucher au code.
 */

interface Message {
  id: string;
  from_driver: boolean;
  body: string;
  created_at: string;
  read_at?: string | null;
}

/** Ce que PostgREST répond quand la table n'est pas encore là. */
const TABLE_ABSENTE = ["42P01", "PGRST205", "PGRST202"];

export function DriverChat({
  driverId,
  driverName,
  clientId,
  destination,
  onClose,
}: {
  driverId: string;
  driverName: string;
  /** Absent : personne n'est connecté, on ne peut pas ouvrir de fil. */
  clientId: string | null;
  /** Sert à proposer la destination en réponse rapide. */
  destination: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const [messages, setMessages] = useState<Message[]>([]);
  const [brouillon, setBrouillon] = useState("");
  const [etat, setEtat] = useState<"chargement" | "pret" | "indisponible">("chargement");
  const [envoi, setEnvoi] = useState(false);

  const filRef = useRef<HTMLDivElement>(null);

  const relire = useCallback(async () => {
    if (!clientId) {
      setEtat("indisponible");
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("taxi_messages")
      .select("id, from_driver, body, created_at, read_at")
      .eq("driver_id", driverId)
      .eq("client_id", clientId)
      .order("created_at")
      .limit(50);

    if (error) {
      // Table absente : la fonctionnalité n'est pas encore ouverte, ce n'est pas
      // une panne. Toute autre erreur laisse le fil en l'état plutôt que de
      // l'effacer sous les yeux de quelqu'un qui écrivait.
      if (TABLE_ABSENTE.includes(error.code)) setEtat("indisponible");
      return;
    }

    setMessages(data ?? []);
    setEtat("pret");

    /*
      Lire un fil ouvert, c'est l'avoir lu.

      Sans ce marquage, le compteur de la liste des conversations resterait
      allumé après qu'on a tout lu — et un compteur qui ne s'éteint jamais
      apprend à être ignoré. Ce sont les messages du chauffeur qu'on marque : les
      siens ne se comptent pas.
    */
    const aMarquer = (data ?? [])
      .filter((m) => m.from_driver && m.read_at === null)
      .map((m) => m.id);

    if (aMarquer.length > 0) {
      await supabase
        .from("taxi_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", aMarquer);
    }
  }, [driverId, clientId]);

  useEffect(() => {
    void relire();
  }, [relire]);

  /*
    Cinq secondes, et seulement quand la conversation est ouverte.

    C'est le rythme d'une négociation : on écrit, on attend une réponse, on
    répond. Les positions des chauffeurs, elles, se relisent toutes les trente
    secondes — un fil de discussion ne supporterait pas cette latence, et une
    carte n'a pas besoin de la cadence d'un fil.

    Le crochet suspend tout quand l'onglet passe à l'arrière-plan.
  */
  usePoll(relire, etat === "pret" ? 5_000 : 30_000);

  // Le fil se tient toujours sur le dernier message : c'est celui qu'on attend.
  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function envoyer(texte: string) {
    const corps = texte.trim();
    if (!corps || !clientId || envoi) return;

    setEnvoi(true);
    setBrouillon("");

    /*
      Le message apparaît avant d'être confirmé.

      Sur une connexion mobile, l'aller-retour se voit ; un champ qui se vide
      sans que rien n'apparaisse donne l'impression d'avoir perdu ce qu'on
      venait d'écrire. La ligne provisoire porte un identifiant temporaire, et
      la relecture qui suit la remplace par la vraie.
    */
    const provisoire: Message = {
      id: `local-${Date.now()}`,
      from_driver: false,
      body: corps,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, provisoire]);

    /*
      L'envoi passe par une action serveur, et non par une écriture directe.

      C'est ce qui permet de prévenir le chauffeur : la table des notifications
      n'accepte aucune écriture venue d'un navigateur, et c'est très bien ainsi.
      Sans cette étape, le message arrivait bien en base et n'était jamais lu —
      le chauffeur n'avait aucune raison d'ouvrir l'application.
    */
    const result = await envoyerMessageTaxi({ driverId, clientId, body: corps });

    if (!result.ok) {
      // L'envoi a échoué : on retire la ligne provisoire plutôt que de laisser
      // croire que le chauffeur a reçu le message.
      setMessages((m) => m.filter((x) => x.id !== provisoire.id));
      setBrouillon(corps);
    } else {
      await relire();
    }

    setEnvoi(false);
  }

  const reponsesRapides = [destination, t.taxi.quickPrice, t.taxi.quickHurry].filter(
    (x): x is string => Boolean(x),
  );

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-[10px] rounded-[18px] bg-[var(--color-surface-solid)] p-3 shadow-[0_6px_18px_rgba(60,40,90,0.07)]"
    >
      <header className="flex items-center gap-[10px]">
        <Avatar initials={monogram(driverName)} size={30} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">{driverName}</p>
          <p className="truncate text-[0.5625rem] text-[var(--color-brand)]">{t.taxi.online}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t.taxi.closeChat}
          className="press flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[0.75rem] leading-none text-[var(--color-muted)]"
        >
          ✕
        </button>
      </header>

      {etat === "indisponible" ? (
        <p className="rounded-[12px] bg-[var(--color-field)] px-3 py-[10px] text-[0.625rem] leading-[1.5] text-[var(--color-muted)]">
          {clientId ? t.taxi.chatOff : t.taxi.chatSignIn}
        </p>
      ) : (
        <>
          <div
            ref={filRef}
            className="no-sb flex max-h-[168px] min-h-[52px] flex-col gap-[6px] overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <m.p
                  key={message.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cx(
                    "max-w-[86%] rounded-[14px] px-[11px] py-[8px] text-[0.65625rem] leading-[1.5]",
                    message.from_driver
                      ? "self-start bg-[var(--color-field)] text-[var(--color-ink)]"
                      : "self-end bg-[var(--color-brand-fill)] text-white",
                  )}
                >
                  {message.body}
                </m.p>
              ))}
            </AnimatePresence>

            {messages.length === 0 && etat === "pret" && (
              <p className="self-start rounded-[14px] bg-[var(--color-field)] px-[11px] py-[8px] text-[0.65625rem] leading-[1.5] text-[var(--color-muted)]">
                {t.taxi.writeToDriver}
              </p>
            )}
          </div>

          {/* Trois phrases qui couvrent l'essentiel d'une négociation de course :
              où l'on va, à quel prix, et si c'est urgent. */}
          <div className="no-sb flex gap-[6px] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {reponsesRapides.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => void envoyer(phrase)}
                disabled={envoi}
                className="press flex-none rounded-full border border-[var(--color-outline)] px-[11px] py-[6px] text-[0.59375rem] font-semibold whitespace-nowrap text-[var(--color-ink)] disabled:opacity-50"
              >
                {phrase}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void envoyer(brouillon);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={brouillon}
              onChange={(event) => setBrouillon(event.target.value)}
              placeholder={t.taxi.writeToDriver}
              maxLength={500}
              className="min-w-0 flex-1 rounded-full bg-[var(--color-field)] px-[13px] py-[9px] text-[0.65625rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
            />
            <button
              type="submit"
              disabled={envoi || brouillon.trim().length === 0}
              className="press flex-none rounded-full bg-[var(--color-ink)] px-[13px] py-[9px] text-[0.625rem] font-bold text-[var(--color-app)] disabled:opacity-40"
            >
              {t.taxi.send}
            </button>
          </form>
        </>
      )}
    </m.div>
  );
}
