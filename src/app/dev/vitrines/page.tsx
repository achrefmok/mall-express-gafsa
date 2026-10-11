import Link from "next/link";
import { notFound } from "next/navigation";
import { THEMES, variablesTheme } from "@/lib/boutique-themes";
import { VITRINES, type VitrineId } from "@/lib/boutique-vitrines";
import { BoutiqueContenu } from "@/components/boutique/boutique-contenu";
import type { ProduitBoutique } from "@/components/boutique/layouts/types";
import { getT } from "@/lib/i18n/server";

/**
 * Labo des vitrines par métier — produits fictifs, aucune vraie boutique.
 *
 * Introuvable en production, comme `/dev/boutique-themes` : sert à vérifier
 * chaque présentoir, filtre et catalogue sur téléphone, y compris en
 * dégradation (`?vide=1` : aucun attribut, aucune déclinaison, aucune
 * photo — l'état réel de toute boutique qui vient de s'inscrire).
 */

const THEME_DE: Record<VitrineId, string> = {
  mode: "mode",
  telephones: "electronique",
  parfumerie: "beaute",
  cosmetiques: "beaute",
  parapharmacie: "parapharmacie",
  electromenager: "electronique",
  moto: "auto",
  patisserie: "alimentation",
  animalerie: "animaux",
  sport: "sport",
  location: "services",
};

const I = "/images/";

type Fictif = [nom: string, prix: number, image: string | null, attributs?: Record<string, string>, extra?: Partial<ProduitBoutique>];

const DONNEES: Record<VitrineId, Fictif[]> = {
  mode: [
    ["Robe brodée jasmin", 129, I + "cat-mode.webp", { type: "Robes" }, { sizes: ["S", "M", "L"], category: { hue: 300, slug: "mode-femme" } }],
    ["Blazer laine", 160, null, { type: "Vestes" }, { sizes: ["S", "M"], colors: ["#4a4458", "#2c2736"], category: { hue: 300, slug: "mode-femme" } }],
    ["Robe automne", 89, null, { type: "Robes" }, { compare_at_price: 125, sizes: ["M", "L", "XL"], colors: ["#b5532f", "#8e3a1f"], category: { hue: 300, slug: "mode-femme" } }],
    ["Chemise lin", 75, null, { type: "Chemises" }, { sizes: ["S", "M", "L", "XL"], colors: ["#e8dcc6", "#a8957a"], category: { hue: 300, slug: "mode-femme" } }],
    ["Sac cuir", 210, I + "cat-beaute.webp", {}, { category: { hue: 300, slug: "mode-accessoires" } }],
  ],
  telephones: [
    ["Galaxy S24", 3290, null, { marque: "Samsung", stockage: "256 Go", ram: "8 Go", ecran: "6,2″", batterie: "4000", camera: "50 MP", garantie_mois: "12" }, { compare_at_price: 3590, sizes: ["256 Go", "512 Go"], colors: ["#1b2a4a", "#0a0f1c"] }],
    ["iPhone 15", 3890, null, { marque: "Apple iPhone", stockage: "128 Go", ram: "6 Go", ecran: "6,1″", batterie: "3349", camera: "48 MP" }, { colors: ["#f2d8c9", "#b99384"] }],
    ["Redmi Note 13", 899, null, { marque: "Xiaomi", stockage: "256 Go", ram: "8 Go", batterie: "5000", camera: "108 MP" }, { colors: ["#2d6b5f", "#123029"] }],
    ["Oppo Reno 11", 1490, null, { marque: "Oppo", ram: "12 Go", camera: "50 MP" }, { colors: ["#6a4fb0", "#24184a"] }],
    ["Écouteurs sans fil", 129, I + "cat-electro.webp", { marque: "Samsung, iPhone, Xiaomi, Oppo" }],
    ["Chargeur rapide 65W", 45, null, { marque: "Samsung, Xiaomi" }, { colors: ["#e9eef7", "#b9c4d8"] }],
  ],
  parfumerie: [
    ["Jasmin de Gafsa", 145, I + "cat-beaute.webp", { famille_olfactive: "Floral", note_tete: "Bergamote", note_coeur: "Jasmin, rose", note_fond: "Musc blanc", sillage: "4", tenue_heures: "8 h" }, { sizes: ["30 ml", "50 ml", "100 ml"] }],
    ["Oud Royal", 260, null, { famille_olfactive: "Oriental", note_tete: "Safran", note_coeur: "Rose", note_fond: "Oud, ambre", sillage: "5", tenue_heures: "12 h" }, { colors: ["#5a2a1c", "#1c0f0a"] }],
    ["Cèdre bleu", 180, null, { famille_olfactive: "Boisé", note_fond: "Cèdre, vétiver", tenue_heures: "6 h" }, { colors: ["#3b4a5a", "#141c24"] }],
    ["Agrumes d'été", 95, null, { famille_olfactive: "Frais", note_tete: "Citron, néroli", sillage: "2" }, { colors: ["#f2c14e", "#e08a1e"] }],
  ],
  cosmetiques: [
    ["Rouge à lèvres mat", 39, I + "cat-beaute.webp", { besoin: "Maquillage", marque: "Velours" }, { colors: ["#a8323e", "#c45a62", "#7a2433", "#d98a8a"], category: { hue: 340, slug: "beaute-maquillage" } }],
    ["Palette fards à paupières 12 teintes", 59, null, { besoin: "Maquillage" }, { colors: ["#c9a27e", "#8a5a44", "#e6c9b0", "#5a3a2e", "#b98a8a"], category: { hue: 340, slug: "beaute-maquillage" } }],
    ["Sérum vitamine C", 72, null, { besoin: "Soin visage", peau: "Peau terne", ingredients: "Vitamine C, acide hyaluronique", marque: "Éclat" }, { sizes: ["15 ml", "30 ml"], category: { hue: 340, slug: "beaute-soin" } }],
    ["Brosse soufflante kératine", 129, null, { besoin: "Cheveux" }, { category: { hue: 340, slug: "beaute" } }],
    ["Épilateur électrique 5 en 1", 99, null, { besoin: "Corps" }, { category: { hue: 340, slug: "beaute-soin" } }],
  ],
  parapharmacie: [
    ["Crème hydratante intense", 49, I + "svc-pharmacie.webp", { marque: "Avène", peau: "Peau sèche", moment: "matin et soir", ingredients: "Eau thermale, glycérine, karité" }],
    ["Gel nettoyant purifiant", 35, null, { marque: "Uriage", peau: "Peau grasse", moment: "matin", ingredients: "Zinc, acide salicylique" }, { colors: ["#6fc2b0", "#2f7f6d"] }],
    ["Sérum apaisant", 72, null, { marque: "La Roche-Posay", peau: "Peau sensible", moment: "soir", ingredients: "Niacinamide, panthénol" }, { colors: ["#e3eef0", "#9bb8bd"] }],
    ["Lait bébé", 28, null, { besoin: "Bébé", moment: "soir" }, { colors: ["#fde6d8", "#f2b8a0"] }],
  ],
  electromenager: [
    ["Réfrigérateur 420 L", 2390, I + "cat-maison.webp", { piece: "Cuisine", classe_energie: "A++", capacite: "420 L", garantie_mois: "24", bruit_db: "39" }],
    ["Lave-linge 8 kg", 1450, null, { piece: "Lavage", classe_energie: "A+++", capacite: "8 kg", garantie_mois: "36", bruit_db: "52" }, { colors: ["#dfe6ea", "#8a9aa5"] }],
    ["Climatiseur 12000 BTU", 1690, null, { piece: "Climatisation", classe_energie: "A", garantie_mois: "24" }, { colors: ["#eef3f6", "#a9bac6"] }],
    ["Mixeur plongeant", 119, null, { piece: "Petit électro" }, { colors: ["#2a323b", "#11161b"] }],
  ],
  moto: [
    ["Plaquettes de frein avant", 38, null, { reference: "BRK-2210", compatibilite: "Yamaha, Honda, SYM" }, { stock: 12, colors: ["#3a3a3a", "#141414"] }],
    ["Filtre à air", 22, null, { reference: "AIR-115", compatibilite: "Kymco, SYM", montage_prix: "10" }, { stock: 3, colors: ["#f2b705", "#8a6a00"] }],
    ["Bougie d'allumage", 12, null, { reference: "SPK-08", compatibilite: "Yamaha, Honda, SYM, Kymco" }, { stock: 30, colors: ["#d0d0d0", "#6d6d6d"] }],
    ["Casque intégral", 189, I + "cat-sport.webp", { reference: "HLM-01" }, { stock: 0 }],
  ],
  patisserie: [
    ["Baklawa aux pistaches", 45, I + "cat-cafes.webp", { occasion: "Traditionnel, Mariage", unite: "kg", disponible: "طازج الآن" }],
    ["Gâteau d'anniversaire chocolat", 65, null, { occasion: "Anniversaire", unite: "pièce", disponible: "Sur commande · 24 h" }, { colors: ["#5a3020", "#2a140a"] }],
    ["Croissant beurre", 1.2, null, { occasion: "Quotidien", unite: "pièce", disponible: "Maintenant" }, { colors: ["#e8b86a", "#a86c22"] }],
    ["Makroud", 28, null, { occasion: "Traditionnel", unite: "kg" }, { colors: ["#c98b3a", "#7a4a12"] }],
  ],
  animalerie: [
    ["Croquettes chat adulte", 59, null, { animal: "Chat", note: "Saumon · sans céréales" }, { sizes: ["4 kg", "10 kg"], colors: ["#e8a04a", "#a85f12"], category: { hue: 30, slug: "animaux-chats", name_fr: "Chats", name_ar: "قطط" } }],
    ["Laisse réglable", 25, null, {}, { colors: ["#2f7f8a", "#134a52"], category: { hue: 30, slug: "animaux-chiens", name_fr: "Chiens", name_ar: "كلاب" } }],
    ["Graines pour canaris", 12, null, { animal: "Oiseaux" }, { colors: ["#f2d36b", "#b39020"] }],
    ["Aquarium 60 L", 210, null, { animal: "Poissons" }, { colors: ["#7cc6e0", "#1e6f8c"] }],
  ],
  sport: [
    ["Chaussures running", 189, I + "cat-sport.webp", { sport: "Course", niveau: "3" }, { sizes: ["40", "41", "42", "43"] }],
    ["Ballon de football", 65, null, { sport: "Football", niveau: "Débutant" }, { colors: ["#1d231f", "#5a6a50"] }],
    ["Haltères 2 × 5 kg", 99, null, { sport: "Musculation", niveau: "4" }, { colors: ["#30363a", "#0f1110"] }],
    ["Lunettes de natation", 35, null, { sport: "Natation" }, { colors: ["#2e7fbf", "#0e3b5c"] }],
  ],
  location: [
    ["Clio 5 automatique", 120, I + "svc-louage.webp", { type: "Voiture", caution: "1000", assurance_jour: "15" }],
    ["Tente 6 places", 35, null, { type: "Camping", caution: "200" }, { colors: ["#3f6b3a", "#1d3a1a"] }],
    ["Sono 2000 W", 150, null, { type: "Sonorisation", caution: "500" }, { colors: ["#294778", "#0b1220"] }],
    ["Chaises de fête (×50)", 90, null, { type: "Fêtes" }, { colors: ["#e6be6e", "#8a6a20"] }],
  ],
};

function produits(id: VitrineId, vide: boolean): ProduitBoutique[] {
  return DONNEES[id].map(([name, price, image, attributs, extra], i) => ({
    id: `${id}-${i}`,
    name,
    price,
    compare_at_price: vide ? null : (extra?.compare_at_price ?? null),
    images: vide || !image ? [] : [image],
    stock: extra?.stock ?? 8,
    created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    sizes: vide ? [] : extra?.sizes,
    colors: vide ? [] : extra?.colors,
    category: extra?.category ?? { hue: 280 },
    attributs: vide ? undefined : attributs,
  }));
}

export default async function LaboVitrines({
  searchParams,
}: {
  searchParams: Promise<{ metier?: string; vide?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { metier = "telephones", vide } = await searchParams;
  const id = (metier in VITRINES ? metier : "telephones") as VitrineId;
  const vitrine = VITRINES[id];
  const theme = THEMES[THEME_DE[id]] ?? THEMES.default;
  const { t, locale } = await getT();
  const sansDonnees = vide === "1";

  return (
    <div
      className="clair-boutique min-h-dvh w-full bg-[var(--theme-fond)] text-ink"
      style={variablesTheme(theme, vitrine)}
      data-theme={theme.id}
    >
      <div className="mx-auto flex max-w-[520px] flex-col">
        <nav className="no-sb flex gap-2 overflow-x-auto px-4 pt-3 pb-1 text-[0.75rem] font-bold">
          {(Object.keys(VITRINES) as VitrineId[]).map((k) => (
            <Link
              key={k}
              href={`/dev/vitrines?metier=${k}${sansDonnees ? "&vide=1" : ""}`}
              className="flex-none rounded-full border px-3 py-1"
              style={{ background: k === id ? "var(--theme-accent)" : "#fff", color: k === id ? "#fff" : "inherit" }}
            >
              {VITRINES[k].label.fr}
            </Link>
          ))}
          <Link href={`/dev/vitrines?metier=${id}${sansDonnees ? "" : "&vide=1"}`} className="flex-none rounded-full border px-3 py-1">
            {sansDonnees ? "avec données" : "sans données"}
          </Link>
        </nav>
        <BoutiqueContenu
          onglet="products"
          subCategories={[]}
          promo={null}
          promotions={[]}
          roue={null}
          casesRoue={[]}
          lives={[]}
          visible={produits(id, sansDonnees)}
          packs={[]}
          zones={[]}
          shopId="00000000-0000-0000-0000-000000000000"
          shopSlug="labo"
          shopAddress={null}
          couverture={null}
          installments={[3, 6, 12]}
          packTiers={[]}
          lookbook={null}
          locale={locale}
          t={t}
          userConnecte={false}
          theme={theme}
          vitrine={vitrine}
          nomBoutique={`${vitrine.label.fr} Labo`}
        />
      </div>
    </div>
  );
}
