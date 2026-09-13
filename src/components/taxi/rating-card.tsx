"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { courseANoter, noterCourse, type CourseANoter } from "@/app/actions/taxi-avis";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { monogram } from "@/lib/format";

/** Les courses que la personne a choisi de ne pas noter, sur cet appareil. */
const CLE_IGNOREES = "meg-avis-ignores";

function ignorees(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(CLE_IGNOREES) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * « Comment s'est passée votre course ? »
 *
 * Posée en haut du formulaire taxi, la prochaine fois que la personne ouvre
 * l'écran après une course terminée. Pas plus tôt : pendant la course, on
 * n'a rien à juger ; pas ailleurs : c'est ici qu'on revient quand on a
 * besoin d'un taxi, donc ici qu'on se souvient du dernier.
 *
 * « Plus tard » la fait disparaître sur cet appareil, et pour cette course
 * seulement. Ce n'est qu'une commodité : le serveur n'en sait rien, et la
 * course reste notable pendant une semaine depuis un autre appareil.
 */
export function CarteNotation() {
  const { t } = useI18n();
  const [course, setCourse] = useState<CourseANoter | null>(null);
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [merci, setMerci] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let annule = false;
    void courseANoter().then((r) => {
      if (annule || !r.ok || !r.data) return;
      if (ignorees().includes(r.data.courseId)) return;
      setCourse(r.data);
    });
    return () => {
      annule = true;
    };
  }, []);

  if (!course) return null;

  if (merci) {
    return (
      <p role="status" className="rounded-[16px] bg-[#dcefe5] px-4 py-3 text-center text-[0.8125rem] font-bold text-[#1c6244]">
        {t.reviews.thanks}
      </p>
    );
  }

  function envoyer() {
    if (!course || note < 1) return;
    setErreur(null);
    startTransition(async () => {
      const r = await noterCourse({
        courseId: course.courseId,
        chauffeurId: course.chauffeurId,
        note,
        commentaire: commentaire.trim() || null,
      });
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      setMerci(true);
      window.setTimeout(() => setCourse(null), 2400);
    });
  }

  function plusTard() {
    if (!course) return;
    try {
      window.localStorage.setItem(CLE_IGNOREES, JSON.stringify([...ignorees(), course.courseId].slice(-20)));
    } catch {
      // Stockage indisponible (navigation privée) : la carte revient la prochaine fois, sans plus.
    }
    setCourse(null);
  }

  return (
    <section
      aria-labelledby="titre-notation"
      className="flex flex-col gap-3 rounded-[18px] border border-[var(--color-brand)] bg-[var(--color-brand-tint)] p-4"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-solid)] text-[0.8125rem] font-bold text-[var(--color-brand)]">
          {course.photo ? (
            <Image src={course.photo} alt="" fill sizes="44px" className="object-cover" />
          ) : (
            monogram(course.nom)
          )}
        </span>
        <div className="min-w-0">
          <h3 id="titre-notation" className="text-[0.9375rem] font-bold text-[var(--color-ink)]">
            {t.reviews.rateTitle}
          </h3>
          {course.nom && (
            <p className="truncate text-[0.75rem] text-[var(--color-muted)]">
              {format(t.reviews.rateWith, { name: course.nom })}
            </p>
          )}
        </div>
      </div>

      {/*
        Cinq boutons plutôt qu'un curseur : un toucher par étoile, des cibles
        de quarante-quatre pixels, et un groupe radio que les lecteurs d'écran
        annoncent correctement. `dir="ltr"` : les étoiles se remplissent de
        gauche à droite dans les deux langues, comme sur toutes les applications
        que les gens utilisent déjà.
      */}
      <div role="radiogroup" aria-label={t.reviews.rateTitle} className="flex justify-center gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={note === n}
            aria-label={format(t.reviews.starsAria, { n })}
            onClick={() => setNote(n)}
            className={`flex h-11 w-11 items-center justify-center text-[1.75rem] leading-none transition-transform active:scale-90 ${
              n <= note ? "text-[#f5a623]" : "text-[var(--color-faint)]"
            }`}
          >
            {n <= note ? "★" : "☆"}
          </button>
        ))}
      </div>

      {note > 0 && (
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={t.reviews.commentPlaceholder}
          className="min-h-[64px] w-full rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-3 py-2 text-[0.8125rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]"
        />
      )}

      {erreur && (
        <p role="alert" className="text-[0.75rem] font-medium text-[var(--color-live)]">
          {erreur}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={plusTard}
          className="min-h-11 flex-1 rounded-[12px] text-[0.8125rem] font-semibold text-[var(--color-muted)]"
        >
          {t.reviews.later}
        </button>
        <button
          type="button"
          onClick={envoyer}
          disabled={note < 1 || pending}
          className="min-h-11 flex-[2] rounded-[12px] bg-[var(--color-brand-fill)] text-[0.8125rem] font-bold text-white disabled:opacity-40"
        >
          {pending ? t.reviews.sending : t.reviews.send}
        </button>
      </div>
    </section>
  );
}
