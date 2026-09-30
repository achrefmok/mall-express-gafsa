import { notFound } from "next/navigation";
import { THEMES, rayonBadge, variablesTheme, type ThemeBoutique } from "@/lib/boutique-themes";
import { ProductCard } from "@/components/cards/product-card";
import { Placeholder } from "@/components/ui/primitives";

/**
 * Le labo des thèmes de boutique — données fictives, pas de vraie boutique.
 *
 * Introuvable en production, comme `/apercu` juste à côté : ce n'est pas un
 * écran pour un client, et une adresse qui affiche des données inventées
 * n'a rien à faire dans un index de moteur de recherche ni devant un
 * visiteur réel.
 *
 * Chaque thème est montré deux fois — palette claire, palette sombre — en
 * forçant directement les jetons du mode voulu plutôt qu'en dépendant du
 * réglage du système : c'est un outil de revue, pas une démonstration du
 * vrai basculement `prefers-color-scheme` (que la page boutique, elle,
 * applique réellement — voir `reglesModeSombreTheme`).
 */
export default function LaboThemesBoutique() {
  if (process.env.NODE_ENV === "production") notFound();

  const themes = Object.values(THEMES);

  return (
    <div className="flex min-h-dvh flex-col gap-10 bg-[#f4f1fa] p-6">
      <header>
        <h1 className="text-[1.25rem] font-extrabold text-[#241f2e]">Labo — thèmes de boutique</h1>
        <p className="mt-1 max-w-[640px] text-[0.8125rem] leading-[1.5] text-[#635c74]">
          {themes.length} thème(s) implémenté(s) sur treize spécifiés — voir{" "}
          <code>src/lib/boutique-themes/</code>. Chacun en clair et en sombre, avec une
          boutique fictive, sa couverture, ses produits, un état vide et son nom en arabe.
        </p>
      </header>

      {themes.map((theme) => (
        <section key={theme.id} className="flex flex-col gap-4">
          <h2 className="text-[1rem] font-bold text-[#241f2e]">
            {theme.label} — <span className="font-normal italic">{theme.ambiance.nom}</span>
          </h2>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <VitrineFictive theme={theme} mode="clair" avecCouverture />
            <VitrineFictive theme={theme} mode="sombre" avecCouverture={false} />
          </div>
        </section>
      ))}
    </div>
  );
}

const PRODUITS_FICTIFS = [
  { id: "p1", name: "Article de démonstration", price: 45, compare_at_price: null, images: [], stock: 4 },
  { id: "p2", name: "Deuxième article, un nom un peu plus long pour voir", price: 120, compare_at_price: 150, images: [], stock: 0 },
];

/**
 * Une vitrine minimale, pas la page boutique entière : `BoutiqueEnTete`
 * appelle de vraies actions serveur (suivre, contacter, compter la visite)
 * qui n'ont pas de sens sur un identifiant inventé. Ce composant montre les
 * mêmes jetons — voile, police, badge, rayon, palette — sans les brancher à
 * rien de réel.
 */
function VitrineFictive({
  theme,
  mode,
  avecCouverture,
}: {
  theme: ThemeBoutique;
  mode: "clair" | "sombre";
  avecCouverture: boolean;
}) {
  const palette = theme.palettes[mode];
  const voile = theme.couverture.voile[mode];

  const style = {
    ...variablesTheme(theme),
    // On écrase la sélection automatique de `variablesTheme` (qui choisit
    // clair sauf thème sombre par nature) pour montrer explicitement le mode
    // demandé, quel que soit `sombreParNature`.
    "--theme-fond": palette.background,
    "--theme-surface": palette.surface,
    "--theme-accent": palette.accent,
    "--theme-accent-texte": palette.accentTexte,
    "--theme-accent-doux": palette.accentDoux,
    "--theme-accent-fort": palette.accentFort,
    "--theme-texte": palette.text,
    "--theme-muted": palette.muted,
    "--theme-bordure": palette.border,
    "--theme-voile": voile,
  } as React.CSSProperties;

  return (
    <div
      className="overflow-hidden rounded-[20px] border"
      style={{ ...style, background: "var(--theme-fond)", borderColor: "var(--theme-bordure)" }}
    >
      <div className="flex items-center justify-between px-4 py-2 text-[0.625rem] font-bold uppercase" style={{ color: "var(--theme-muted)" }}>
        <span>{mode === "clair" ? "Palette claire" : "Palette sombre"}</span>
        {theme.sombreParNature && <span>Sombre par nature</span>}
      </div>

      {/* Couverture, avec ou sans photo — le fallback thématisé n'est pas encore implémenté (voir TODO.md). */}
      {avecCouverture ? (
        <div className="relative h-[100px] w-full" style={{ background: "var(--theme-accent-doux)" }}>
          <span aria-hidden className="absolute inset-0" style={{ backgroundImage: "var(--theme-voile)" }} />
        </div>
      ) : (
        <Placeholder label="sans couverture" className="h-[100px] w-full" />
      )}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-[0.875rem] font-bold"
            style={{ background: "var(--theme-accent)", color: "var(--theme-accent-texte)" }}
          >
            DM
          </span>
          <div>
            <p className="font-semibold" style={{ fontFamily: theme.typographie.fontFamily, color: "var(--theme-texte)", fontWeight: theme.typographie.poidsTitre }}>
              Boutique de démonstration
            </p>
            <p dir="rtl" className="text-[0.75rem]" style={{ fontFamily: theme.typographie.fontFamily, color: "var(--theme-muted)" }}>
              متجر تجريبي — الاسم بالعربية
            </p>
          </div>
        </div>

        <span
          className="inline-flex w-fit items-center gap-[6px] px-[10px] py-[5px] text-[0.625rem] font-bold"
          style={{ background: "var(--theme-accent-doux)", color: "var(--theme-accent-fort)", borderRadius: rayonBadge(theme) }}
        >
          <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--theme-accent-fort)" }} />
          Ouvert maintenant
        </span>

        {/* Promotion, selon promoStyle */}
        <div
          className="flex items-center gap-[10px] p-[10px]"
          style={{
            background: "var(--theme-accent-doux)",
            borderRadius: theme.promoStyle.forme === "pilule" ? "18px" : theme.promoStyle.forme === "ruban" ? "6px" : "10px",
          }}
        >
          <span
            className="flex-none px-[9px] py-[6px] text-[0.6875rem] font-bold text-white"
            style={{ background: theme.promoStyle.accentPropre ? "var(--theme-accent)" : "#d0455f", borderRadius: "10px" }}
          >
            −30%
          </span>
          <p className="text-[0.71875rem] font-semibold" style={{ color: "var(--theme-texte)" }}>
            Promotion de démonstration
          </p>
        </div>

        {/* Produits, avec le rayon du thème */}
        <div className="grid grid-cols-2 gap-2" style={{ "--pc-rayon": theme.formes.rayon, "--pc-rayon-interieur": theme.formes.rayonInterieur } as React.CSSProperties}>
          {PRODUITS_FICTIFS.map((p) => (
            <ProductCard key={p.id} product={p} showShop={false} imageHeight={90} />
          ))}
        </div>

        {/* État vide, thématisé, FR + AR */}
        <div className="flex flex-col items-center gap-1 py-4 text-center">
          <p className="text-[0.75rem] font-semibold" style={{ color: "var(--theme-texte)" }}>
            {theme.emptyState.produits.fr}
          </p>
          <p dir="rtl" className="text-[0.6875rem]" style={{ color: "var(--theme-muted)" }}>
            {theme.emptyState.produits.ar}
          </p>
        </div>

        {/* Roue — couleurs seulement à ce stade, voir TODO.md pour l'aperçu interactif complet */}
        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] font-bold" style={{ color: "var(--theme-muted)" }}>
            Roue :
          </span>
          {theme.wheelStyle.teintes.map((teinte) => (
            <span key={teinte} className="h-4 w-4 rounded-full" style={{ background: teinte }} />
          ))}
        </div>
      </div>
    </div>
  );
}
