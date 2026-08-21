/**
 * Les formes d'attente réutilisables.
 *
 * Un squelette n'a d'intérêt que s'il a la forme de ce qui arrive : sinon la
 * mise en page saute au moment où le contenu se pose, ce qu'on cherchait
 * précisément à éviter. Trois formes couvrent les écrans du projet — une liste
 * de fiches, une grille de vignettes, une carte suivie d'une liste — et chacune
 * reprend les dimensions réelles de son écran.
 *
 * `aria-busy` et un libellé sont portés par le conteneur : un lecteur d'écran
 * annonce une attente au lieu de lire une succession de blocs vides.
 */

function Enveloppe({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pt-3" aria-busy="true" aria-label="Chargement">
      {children}
    </div>
  );
}

/** Une pile de fiches : bons plans, directs, commandes, panier. */
export function ListSkeleton({ rows = 4, height = 84 }: { rows?: number; height?: number }) {
  return (
    <Enveloppe>
      <div className="skeleton h-6 w-2/5 rounded-[10px]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton rounded-[18px]" style={{ height }} />
      ))}
    </Enveloppe>
  );
}

/** Une carte en haut, une liste dessous : taxi, SOS, boutiques. */
export function MapSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Enveloppe>
      <div className="skeleton h-[38vh] min-h-[220px] rounded-[18px]" />
      <div className="skeleton h-4 w-1/3 rounded-[8px]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-[62px] rounded-[18px]" />
      ))}
    </Enveloppe>
  );
}

/** Des tuiles de service, deux par ligne. */
export function TileSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Enveloppe>
      <div className="skeleton h-[86px] rounded-[18px]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-[56px] rounded-[18px]" />
      ))}
    </Enveloppe>
  );
}
