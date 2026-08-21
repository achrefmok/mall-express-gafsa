/**
 * Le squelette d'une boutique : couverture, logo débordant, puis la grille.
 * Le décalage négatif du logo est repris tel quel — sans lui, tout remonte de
 * vingt-quatre pixels à l'arrivée du contenu.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-[var(--color-app)]" aria-busy="true" aria-label="Chargement">
      <div className="skeleton h-[110px] w-full" />

      <div className="-mt-6 flex flex-col gap-2 px-4">
        <div className="skeleton h-16 w-16 rounded-full border-[3px] border-[var(--color-app)]" />
        <div className="skeleton h-5 w-1/2 rounded-[10px]" />
        <div className="skeleton h-3 w-1/3 rounded-[8px]" />
      </div>

      <div className="grid grid-cols-2 gap-[10px] p-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-[196px] rounded-[16px]" />
        ))}
      </div>
    </div>
  );
}
