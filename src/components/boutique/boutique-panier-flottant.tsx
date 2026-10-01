import Link from "next/link";
import { CartIcon } from "@/components/ui/icons";

/**
 * Le panier, à portée de pouce depuis la vitrine.
 *
 * On ajoute plusieurs articles d'affilée dans une même boutique, et rien
 * ne menait ensuite à la caisse : il fallait quitter la page par la
 * flèche de retour, puis retrouver l'icône du panier ailleurs. Cette
 * page n'a pas de barre d'onglets — elle vit hors de la coque client —,
 * d'où un bouton flottant plutôt qu'un onglet.
 *
 * Thématisé — `--theme-accent` en fond, `--theme-accent-texte` en texte,
 * jamais l'inverse : sur Électronique ou Fête, l'accent est clair et
 * demande un texte sombre, exactement l'accord que chaque thème a déjà
 * vérifié pour ses propres boutons (`scripts/check-theme-contrast.mjs`).
 * Un repli au violet de marque pour toute page qui ne poserait pas ces
 * variables — aucune n'existe aujourd'hui, mais un composant ne doit pas
 * dépendre silencieusement d'un contexte qu'il ne vérifie pas.
 */
export function BoutiquePanierFlottant({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px]">
      <Link
        href="/panier"
        aria-label={label}
        className="press pointer-events-auto absolute end-4 bottom-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--theme-accent,var(--color-brand-fill))] text-[var(--theme-accent-texte,white)] shadow-[0_14px_28px_rgba(0,0,0,0.28)]"
      >
        <CartIcon size={21} />
        <span className="absolute -top-[2px] -end-[2px] flex h-[20px] min-w-[20px] items-center justify-center rounded-full border-2 border-[var(--color-app)] bg-[var(--color-ink)] px-1 text-[0.59375rem] font-extrabold text-[var(--color-app)]">
          {count > 99 ? "99+" : count}
        </span>
      </Link>
    </div>
  );
}
