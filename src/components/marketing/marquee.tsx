/**
 * Le ruban de catégories qui défile — pur CSS (`animation` + duplication de
 * la liste), aucun JavaScript : une boucle `requestAnimationFrame` pour un
 * simple défilement aurait coûté un budget d'images par seconde pour rien.
 */
const ITEMS = [
  "Mode",
  "Beauté",
  "High-tech",
  "Maison",
  "Parapharmacie",
  "Bijouterie",
  "Livraison dans Gafsa",
  "Bons plans vérifiés",
  "Ventes en direct",
];

export function Marquee() {
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <div className="overflow-hidden border-y border-[var(--color-hairline)] bg-[var(--color-ink)] py-[14px]">
      <div className="animate-marquee flex w-max gap-10">
        {doubled.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-10 text-[1.125rem] font-bold whitespace-nowrap text-white"
          >
            {item}
            <span
              aria-hidden
              className="h-2 w-2 flex-none rounded-full"
              style={{ background: i % 3 === 0 ? "oklch(0.62 0.17 10)" : "#8b6bb3" }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
