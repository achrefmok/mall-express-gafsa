import { cx } from "@/lib/format";
import type { DeliveryMethod, OrderStatus } from "@/types/database";

/**
 * Où en est ma commande ?
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que remplace cette frise
 * ────────────────────────────────────────────────────────────────────────
 *
 * La commande n'affichait qu'une étiquette : « À préparer ». Le mot est juste
 * et ne répond à aucune des questions qu'on se pose en attendant une
 * livraison — qu'est-ce qui s'est déjà passé, qu'est-ce qui vient ensuite,
 * est-ce que quelqu'un a seulement vu ma commande.
 *
 * Une étiquette dit un état. Une frise dit un trajet, et c'est le trajet qu'on
 * attend.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qu'elle ne prétend pas savoir
 * ────────────────────────────────────────────────────────────────────────
 *
 * La base ne conserve que l'état **courant** d'une commande, pas l'historique
 * de ses changements. La frise ne peut donc pas dater chaque étape : elle dit
 * lesquelles sont franchies, laquelle est en cours, lesquelles restent — sans
 * inventer d'heures que personne n'a enregistrées.
 *
 * C'est une limite assumée plutôt que masquée. Afficher « Préparée à 14 h 32 »
 * en le déduisant de la date de création serait faux le jour où un vendeur
 * prépare une commande le lendemain, et ce jour-là le client s'en apercevrait.
 */

/*
  Le retrait en boutique n'a pas d'expédition.

  Servir la même frise aux deux ferait attendre à quelqu'un qui vient chercher
  son colis une étape de livraison qui n'arrivera jamais. Deux trajets, parce
  qu'il y a deux façons de recevoir une commande.
*/
const TRAJET_LIVRAISON: OrderStatus[] = ["pending", "to_prepare", "ready", "shipped", "delivered"];
const TRAJET_RETRAIT: OrderStatus[] = ["pending", "to_prepare", "ready", "delivered"];

export interface EtapesLibelles {
  pending: string;
  to_prepare: string;
  ready: string;
  shipped: string;
  delivered: string;
  deliveredPickup: string;
  cancelled: string;
  cancelledNote: string;
}

export function OrderTimeline({
  status,
  delivery,
  libelles,
}: {
  status: OrderStatus;
  delivery: DeliveryMethod;
  libelles: EtapesLibelles;
}) {
  /*
    Une commande annulée n'a pas de suite.

    Continuer à montrer « Expédiée » en gris, comme une étape à venir, laisserait
    croire qu'elle finira par arriver. On dit ce qui s'est passé, et on s'arrête.
  */
  if (status === "cancelled") {
    return (
      <div className="flex items-start gap-[10px] rounded-[12px] bg-[var(--color-field)] px-3 py-[10px]">
        <span
          aria-hidden
          className="mt-[5px] h-[7px] w-[7px] flex-none rounded-full bg-[var(--color-live)]"
        />
        <span className="min-w-0">
          <span className="block text-[0.6875rem] font-bold text-[var(--color-live)]">
            {libelles.cancelled}
          </span>
          <span className="block text-[0.59375rem] leading-[1.5] text-[var(--color-muted)]">
            {libelles.cancelledNote}
          </span>
        </span>
      </div>
    );
  }

  const trajet = delivery === "pickup" ? TRAJET_RETRAIT : TRAJET_LIVRAISON;
  const actuelle = trajet.indexOf(status);

  const nommer = (etape: OrderStatus): string => {
    // Au retrait, la dernière étape n'est pas « livrée » mais « récupérée ».
    if (etape === "delivered" && delivery === "pickup") return libelles.deliveredPickup;
    return libelles[etape as keyof EtapesLibelles] as string;
  };

  return (
    <ol className="flex flex-col">
      {trajet.map((etape, index) => {
        const franchie = index < actuelle;
        const encours = index === actuelle;
        const derniere = index === trajet.length - 1;

        return (
          <li key={etape} className="flex gap-[10px]">
            {/* La colonne des pastilles et du trait. Le trait s'arrête à la
                dernière étape : le prolonger suggérerait une suite. */}
            <span className="flex flex-none flex-col items-center">
              <span
                aria-hidden
                className={cx(
                  "mt-[5px] h-[9px] w-[9px] rounded-full border-2 transition-colors",
                  franchie && "border-[var(--color-ok,#2f7d5d)] bg-[var(--color-ok,#2f7d5d)]",
                  encours && "border-[var(--color-brand-fill)] bg-[var(--color-brand-fill)]",
                  !franchie && !encours && "border-[var(--color-outline)] bg-transparent",
                )}
              />
              {!derniere && (
                <span
                  aria-hidden
                  className={cx(
                    "w-[2px] flex-1",
                    franchie ? "bg-[var(--color-ok,#2f7d5d)]" : "bg-[var(--color-outline)]",
                  )}
                />
              )}
            </span>

            <span className={cx("min-w-0 pb-[10px]", derniere && "pb-0")}>
              <span
                className={cx(
                  "block text-[0.65625rem] leading-[1.4]",
                  encours
                    ? "font-bold text-[var(--color-ink)]"
                    : franchie
                      ? "font-semibold text-[var(--color-muted)]"
                      : "text-[var(--color-faint)]",
                )}
              >
                {nommer(etape)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
