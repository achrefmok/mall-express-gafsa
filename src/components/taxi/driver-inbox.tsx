"use client";

import { AnimatePresence, m } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { envoyerMessageTaxi } from "@/app/actions/taxi-chat";
import { usePoll } from "@/lib/use-poll";
import { cx, monogram } from "@/lib/format";
import { Avatar } from "@/components/ui/primitives";

/**
 * Les clients qui écrivent au chauffeur — et sa façon de leur répondre.
 *
 * **C'est la moitié manquante de la messagerie.** Le client avait un fil dans la
 * fiche taxi ; le chauffeur n'avait rien. Ses messages s'enregistraient bien en
 * base, personne ne les lui montrait, et les deux côtés en concluaient que la
 * messagerie ne marchait pas. Cinq messages attendaient ainsi dans la table
 * sans avoir jamais été lus.
 *
 * Un fil par client, le plus récent d'abord. Un chauffeur consulte cet écran au
 * feu rouge : la liste doit tenir en un coup d'œil, et répondre en un geste —
 * d'où les réponses toutes faites, qui couvrent l'essentiel de ce qu'il a à
 * dire quand il conduit.
 */

interface Message {
  id: string;
  client_id: string;
  from_driver: boolean;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface Fil {
  clientId: string;
  nom: string;
  messages: Message[];
  nonLus: number;
}

export function DriverInbox({ driverId }: { driverId: string }) {
  const { t } = useI18n();

  const [messages, setMessages] = useState<Message[]>([]);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [charge, setCharge] = useState(false);

  const filRef = useRef<HTMLDivElement>(null);

  const relire = useCallback(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("taxi_messages")
      .select("id, client_id, from_driver, body, created_at, read_at")
      .eq("driver_id", driverId)
      .order("created_at")
      .limit(200);

    if (!data) return;
    setMessages(data);
    setCharge(true);

    /*
      Les noms des clients, cherchés une seule fois chacun.

      Un fil sans nom n'est qu'un identifiant : le chauffeur ne saurait pas à qui
      il parle. La jointure est faite à part plutôt que dans la requête des
      messages — les policies de `profiles` et de `taxi_messages` ne sont pas les
      mêmes, et une jointure refusée ferait échouer toute la lecture.
    */
    const inconnus = [...new Set(data.map((m) => m.client_id))].filter((id) => !noms[id]);
    if (inconnus.length === 0) return;

    const { data: profils } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", inconnus);

    if (profils) {
      setNoms((actuels) => ({
        ...actuels,
        ...Object.fromEntries(
          profils.map((p) => [
            p.id,
            [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || t.taxi.aClient,
          ]),
        ),
      }));
    }
  }, [driverId, noms, t]);

  useEffect(() => {
    void relire();
    // `relire` change à chaque fois que `noms` bouge ; la relance périodique
    // ci-dessous suffit à tenir la liste à jour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  /*
    Dix secondes quand un fil est ouvert, une minute sinon.

    Le chauffeur qui négocie attend une réponse ; celui qui a l'écran ouvert sur
    sa disponibilité n'a pas besoin qu'on interroge la base sans arrêt. Le
    crochet suspend tout quand l'onglet passe à l'arrière-plan.
  */
  usePoll(relire, ouvert ? 10_000 : 60_000);

  const fils: Fil[] = useMemo(() => {
    const par = new Map<string, Message[]>();
    for (const message of messages) {
      const liste = par.get(message.client_id) ?? [];
      liste.push(message);
      par.set(message.client_id, liste);
    }

    return [...par.entries()]
      .map(([clientId, liste]) => ({
        clientId,
        nom: noms[clientId] ?? t.taxi.aClient,
        messages: liste,
        // Non lus : ce que le client a écrit et que le chauffeur n'a pas encore
        // ouvert. Ses propres messages ne se comptent pas.
        nonLus: liste.filter((m) => !m.from_driver && m.read_at === null).length,
      }))
      .sort((a, b) => {
        const da = a.messages[a.messages.length - 1]?.created_at ?? "";
        const db = b.messages[b.messages.length - 1]?.created_at ?? "";
        return db.localeCompare(da);
      });
  }, [messages, noms, t]);

  const filOuvert = fils.find((f) => f.clientId === ouvert) ?? null;

  // Le fil se tient sur le dernier message : c'est celui qu'on attend.
  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: "smooth" });
  }, [filOuvert?.messages.length]);

  /*
    Ouvrir un fil le marque comme lu.

    Le compteur ne doit pas survivre à la lecture : un chiffre qui reste après
    qu'on a tout lu apprend à l'ignorer, et le jour où il compte vraiment
    personne ne le regarde plus.
  */
  async function ouvrir(clientId: string) {
    setOuvert(clientId);

    const aMarquer = messages
      .filter((m) => m.client_id === clientId && !m.from_driver && m.read_at === null)
      .map((m) => m.id);

    if (aMarquer.length === 0) return;

    const maintenant = new Date().toISOString();
    setMessages((actuels) =>
      actuels.map((m) => (aMarquer.includes(m.id) ? { ...m, read_at: maintenant } : m)),
    );

    const supabase = createClient();
    await supabase.from("taxi_messages").update({ read_at: maintenant }).in("id", aMarquer);
  }

  async function repondre(texte: string) {
    const corps = texte.trim();
    if (!corps || !filOuvert || envoi) return;

    setEnvoi(true);
    setBrouillon("");

    // La ligne apparaît avant d'être confirmée : sur une connexion mobile,
    // l'aller-retour se voit, et un champ qui se vide sans rien afficher donne
    // l'impression d'avoir perdu ce qu'on venait d'écrire.
    const provisoire: Message = {
      id: `local-${Date.now()}`,
      client_id: filOuvert.clientId,
      from_driver: true,
      body: corps,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((actuels) => [...actuels, provisoire]);

    // Même chemin que côté client : c'est l'action serveur qui prévient
    // l'autre partie, la table des notifications étant fermée aux navigateurs.
    const result = await envoyerMessageTaxi({
      driverId,
      clientId: filOuvert.clientId,
      body: corps,
    });

    if (!result.ok) {
      setMessages((actuels) => actuels.filter((m) => m.id !== provisoire.id));
      setBrouillon(corps);
    } else {
      await relire();
    }

    setEnvoi(false);
  }

  if (!charge) return null;

  if (fils.length === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-[18px] bg-[var(--color-surface-solid)] p-3">
        <h2 className="text-[0.75rem] font-bold text-[var(--color-ink)]">{t.taxi.inbox}</h2>
        <p className="text-[0.65625rem] leading-[1.5] text-[var(--color-muted)]">
          {t.taxi.inboxEmpty}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-[18px] bg-[var(--color-surface-solid)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[0.75rem] font-bold text-[var(--color-ink)]">{t.taxi.inbox}</h2>
        {filOuvert && (
          <button
            type="button"
            onClick={() => setOuvert(null)}
            className="press text-[0.5625rem] font-bold text-[var(--color-brand)]"
          >
            {t.common.back}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!filOuvert ? (
          <m.div
            key="liste"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="flex flex-col"
          >
            {fils.map((fil) => {
              const dernier = fil.messages[fil.messages.length - 1];

              return (
                <button
                  key={fil.clientId}
                  type="button"
                  onClick={() => void ouvrir(fil.clientId)}
                  className="press flex items-center gap-[10px] border-b border-[var(--color-hairline)] py-[10px] text-start last:border-b-0"
                >
                  <Avatar initials={monogram(fil.nom)} size={30} />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
                      {fil.nom}
                    </span>
                    <span
                      className={cx(
                        "block truncate text-[0.625rem]",
                        fil.nonLus > 0
                          ? "font-semibold text-[var(--color-ink)]"
                          : "text-[var(--color-muted)]",
                      )}
                    >
                      {dernier?.from_driver ? `${t.taxi.youPrefix} ` : ""}
                      {dernier?.body}
                    </span>
                  </span>

                  {fil.nonLus > 0 && (
                    <span className="flex h-[19px] min-w-[19px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-fill)] px-[5px] text-[0.5625rem] font-bold text-white">
                      {fil.nonLus}
                    </span>
                  )}
                </button>
              );
            })}
          </m.div>
        ) : (
          <m.div
            key={filOuvert.clientId}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-[9px]">
              <Avatar initials={monogram(filOuvert.nom)} size={28} />
              <p className="truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
                {filOuvert.nom}
              </p>
            </div>

            <div
              ref={filRef}
              className="no-sb flex max-h-[220px] min-h-[70px] flex-col gap-[6px] overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {filOuvert.messages.map((message) => (
                <p
                  key={message.id}
                  className={cx(
                    "max-w-[86%] rounded-[14px] px-[11px] py-[8px] text-[0.65625rem] leading-[1.5]",
                    message.from_driver
                      ? "self-end bg-[var(--color-brand-fill)] text-white"
                      : "self-start bg-[var(--color-field)] text-[var(--color-ink)]",
                  )}
                >
                  {message.body}
                </p>
              ))}
            </div>

            {/* Trois phrases qui règlent l'essentiel d'une course, sans quitter
                la route des yeux plus d'une seconde. */}
            <div className="no-sb flex gap-[6px] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {[t.taxi.quickComing, t.taxi.quickBusy, t.taxi.quickPriceOk].map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => void repondre(phrase)}
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
                void repondre(brouillon);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={brouillon}
                onChange={(event) => setBrouillon(event.target.value)}
                placeholder={t.taxi.writeToClient}
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
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
