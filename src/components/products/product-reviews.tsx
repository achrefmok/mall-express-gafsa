"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { laisserAvis, retirerAvis } from "@/app/actions/reviews";
import { cx, monogram } from "@/lib/format";
import { Avatar } from "@/components/ui/primitives";

/**
 * Ce que les gens ont pensé de ce produit précis.
 *
 * La fiche n'affichait que la note de la boutique. C'est une information, mais
 * pas celle qu'on cherche : un vendeur qui tient cent références peut avoir
 * quatre étoiles et vendre un article médiocre parmi les quatre-vingt-dix-neuf
 * autres. On note l'article, pas le commerçant.
 *
 * Le formulaire n'apparaît qu'à ceux qui ont acheté — l'action serveur le
 * vérifie, et l'écran ne propose pas ce qu'elle refuserait. Sans cette
 * condition une note ne coûte rien à produire, et une moyenne qui ne coûte rien
 * n'apprend rien.
 */

export interface Avis {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  auteur: string;
  /** Vrai si c'est l'avis de la personne connectée : elle peut le modifier. */
  sien: boolean;
}

function Etoiles({ note, taille = 13 }: { note: number; taille?: number }) {
  return (
    <span
      className="inline-flex gap-[1px] leading-none"
      style={{ fontSize: `${taille}px` }}
      aria-label={`${note} / 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden
          className={n <= note ? "text-[#e0a33c]" : "text-[var(--color-outline)]"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function ProductReviews({
  productId,
  avis,
  moyenne,
  peutNoter,
}: {
  productId: string;
  avis: Avis[];
  /** `null` quand personne n'a encore noté : on ne montre pas « 0 sur 5 ». */
  moyenne: number | null;
  /** L'a-t-elle acheté ? Décidé côté serveur, pas ici. */
  peutNoter: boolean;
}) {
  const { t } = useI18n();

  const mien = avis.find((a) => a.sien) ?? null;
  const [note, setNote] = useState(mien?.rating ?? 0);
  const [texte, setTexte] = useState(mien?.body ?? "");
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function envoyer() {
    if (note < 1) return;
    setErreur(null);

    startTransition(async () => {
      const result = await laisserAvis({ productId, note, commentaire: texte });
      if (!result.ok) return setErreur(result.error);
      setOuvert(false);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[0.8125rem] font-bold text-[var(--color-ink)]">
          {t.product.reviews}
        </h2>

        {moyenne !== null && (
          <span className="flex items-center gap-[6px]">
            <Etoiles note={Math.round(moyenne)} />
            <span className="text-[0.6875rem] font-semibold text-[var(--color-ink)]">
              {moyenne.toFixed(1)}
            </span>
            <span className="text-[0.59375rem] text-[var(--color-muted)]">({avis.length})</span>
          </span>
        )}
      </div>

      {/* ─── Donner son avis ─────────────────────────────────────────── */}

      {peutNoter && !ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="press self-start rounded-full border border-[var(--color-ink)] px-[14px] py-[8px] text-[0.65625rem] font-bold text-[var(--color-ink)]"
        >
          {mien ? t.product.editReview : t.product.writeReview}
        </button>
      )}

      {peutNoter && ouvert && (
        <div className="flex flex-col gap-[10px] rounded-[16px] bg-[var(--color-surface-solid)] p-3">
          {/* Les étoiles se touchent : c'est le geste, sur un téléphone. */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNote(n)}
                aria-label={`${n} / 5`}
                aria-pressed={note === n}
                className={cx(
                  "press text-[22px] leading-none transition-colors",
                  n <= note ? "text-[#e0a33c]" : "text-[var(--color-outline)]",
                )}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder={t.product.reviewPlaceholder}
            className="w-full resize-none rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-app)] px-3 py-2 text-[0.71875rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
          />

          {erreur && (
            <p role="alert" className="text-[0.625rem] font-semibold text-[var(--color-live)]">
              {erreur}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="press flex-1 rounded-full border border-[var(--color-outline)] py-[9px] text-[0.65625rem] font-semibold text-[var(--color-muted)]"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={envoyer}
              disabled={pending || note < 1}
              className="press flex-[2] rounded-full bg-[var(--color-ink)] py-[9px] text-[0.65625rem] font-bold text-[var(--color-app)] disabled:opacity-45"
            >
              {pending ? "…" : t.common.send}
            </button>
          </div>

          {mien && (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await retirerAvis(productId);
                  setOuvert(false);
                  setNote(0);
                  setTexte("");
                })
              }
              className="press self-center text-[0.59375rem] font-semibold text-[var(--color-muted)] underline underline-offset-2"
            >
              {t.product.removeReview}
            </button>
          )}
        </div>
      )}

      {/* ─── Ce que les autres ont écrit ─────────────────────────────── */}

      {avis.length === 0 ? (
        <p className="text-[0.65625rem] leading-[1.6] text-[var(--color-muted)]">
          {peutNoter ? t.product.beFirstToReview : t.product.noReviewsYet}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {avis.map((a) => (
            <li key={a.id} className="flex gap-[10px]">
              <Avatar initials={monogram(a.auteur)} size={30} />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[0.65625rem] font-bold text-[var(--color-ink)]">
                    {a.auteur}
                  </span>
                  <Etoiles note={a.rating} taille={11} />
                </div>

                {a.body && (
                  <p className="mt-[2px] text-[0.65625rem] leading-[1.55] text-[var(--color-muted)]">
                    {a.body}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
