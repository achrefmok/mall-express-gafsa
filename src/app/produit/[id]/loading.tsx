/**
 * Le squelette d'une fiche produit.
 *
 * L'image d'abord, en carré : c'est elle qui occupe le haut de l'écran, et
 * réserver sa place empêche le texte de sauter quand elle se pose.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-[var(--color-app)]" aria-busy="true" aria-label="Chargement">
      <div className="skeleton aspect-square w-full" />

      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-5 w-3/4 rounded-[10px]" />
        <div className="skeleton h-6 w-1/3 rounded-[10px]" />
        <div className="skeleton h-[52px] w-full rounded-[18px]" />

        <div className="flex flex-col gap-2 pt-2">
          <div className="skeleton h-3 w-full rounded-[8px]" />
          <div className="skeleton h-3 w-5/6 rounded-[8px]" />
          <div className="skeleton h-3 w-2/3 rounded-[8px]" />
        </div>
      </div>
    </div>
  );
}
