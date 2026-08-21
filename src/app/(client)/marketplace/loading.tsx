/**
 * Le squelette de la marketplace, à la forme exacte de la grille qui arrive.
 *
 * Un squelette générique vaut mieux qu'une page blanche, mais un squelette qui
 * n'a pas la forme de son écran fait sauter la mise en page au moment où le
 * contenu se pose — le défaut qu'on cherchait précisément à éviter. Les
 * dimensions ci-dessous reprennent celles de la vraie grille.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-3 pt-3" aria-busy="true" aria-label="Chargement">
      <div className="skeleton mx-4 h-9 rounded-[18px]" />

      {/* Les puces de catégorie, sur leur rail. */}
      <div className="no-sb flex gap-2 overflow-hidden px-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton h-7 w-[86px] flex-none rounded-[14px]" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-[10px] px-4 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-[196px] rounded-[16px]" />
        ))}
      </div>
    </div>
  );
}
