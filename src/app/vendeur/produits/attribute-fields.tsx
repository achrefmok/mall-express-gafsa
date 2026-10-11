"use client";

import { Card } from "@/components/ui/primitives";
import type { ThemeId } from "@/lib/boutique-themes";
import { resolveVitrine, type VitrineId } from "@/lib/boutique-vitrines";
import type { Category } from "@/types/database";

const LABEL = "text-[0.625rem] text-[var(--color-muted)]";
const FIELD =
  "rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 py-2 text-[0.75rem] outline-none";

interface Champ {
  cle: string;
  label: string;
  placeholder?: string;
}

const CHAMPS_ELECTRONIQUE: Champ[] = [
  { cle: "marque", label: "Marque", placeholder: "Samsung, Apple…" },
  { cle: "stockage", label: "Stockage", placeholder: "128 Go" },
  { cle: "ecran", label: "Écran", placeholder: "6,1″" },
  { cle: "batterie", label: "Batterie (mAh)", placeholder: "5000" },
  { cle: "garantie_mois", label: "Garantie (mois)", placeholder: "12" },
];

const CHAMPS_PARFUM: Champ[] = [
  { cle: "famille_olfactive", label: "Famille olfactive", placeholder: "Oriental, Boisé…" },
  { cle: "note_tete", label: "Note de tête", placeholder: "Bergamote" },
  { cle: "note_coeur", label: "Note de cœur", placeholder: "Jasmin, rose" },
  { cle: "note_fond", label: "Note de fond", placeholder: "Vanille, musc" },
  { cle: "tenue_heures", label: "Tenue", placeholder: "8 h" },
];

const CHAMPS_MAISON: Champ[] = [
  { cle: "dimensions", label: "Dimensions", placeholder: "L 220 × P 90 cm" },
  { cle: "materiau", label: "Matériau", placeholder: "Lin, chêne…" },
];
const PIECES = ["Salon", "Chambre", "Cuisine", "Bain", "Extérieur"];

const CHAMPS_BIJOUTERIE: Champ[] = [
  { cle: "poids_g", label: "Poids (g)", placeholder: "4,2" },
  { cle: "collection", label: "Collection", placeholder: "Mariage, quotidien…" },
  { cle: "taux_jour", label: "Cours du jour (facultatif)", placeholder: "300 DT / g" },
];

const CHAMPS_PARAPHARMACIE: Champ[] = [
  { cle: "besoin", label: "Besoin", placeholder: "Bébé, Solaire…" },
  { cle: "marque", label: "Marque", placeholder: "Avène, Uriage…" },
];


/*
  Le genre (Femme/Homme/Enfant) vient déjà de la catégorie du produit —
  rien à ajouter ici. Le type de vêtement (Robes/Pulls/Chaussures…) est en
  revanche un second axe que la catégorie ne porte pas : une robe et un
  pull peuvent tous deux être « Femme ». Suggestions courantes, mais texte
  libre — jamais une liste fermée qui empêcherait d'ajouter un type que le
  commerçant vend vraiment.
*/
const TYPES_VETEMENT = ["Robes", "Pulls", "Chaussures", "Pantalons", "Vestes", "Chemises", "Sacs", "T-shirts"];

function ChampTexte({
  champ,
  value,
  onChange,
}: {
  champ: Champ;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL}>{champ.label}</span>
      <input
        value={value[champ.cle] ?? ""}
        onChange={(e) => onChange({ ...value, [champ.cle]: e.target.value })}
        placeholder={champ.placeholder}
        className={FIELD}
      />
    </label>
  );
}

interface ChampChoix extends Champ {
  options: string[];
  /** Plusieurs choix possibles, enregistrés « A, B ». */
  multiple?: boolean;
  /** Texte libre en plus des puces (une valeur qui n'est pas dans la liste). */
  libre?: boolean;
}

/** Puces de suggestion, simple ou multiple — toujours modifiables en texte libre si `libre`. */
function ChampPuces({
  champ,
  value,
  onChange,
}: {
  champ: ChampChoix;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const brut = value[champ.cle] ?? "";
  const choisis = champ.multiple ? brut.split(",").map((s) => s.trim()).filter(Boolean) : [brut];
  function basculer(option: string) {
    if (!champ.multiple) {
      onChange({ ...value, [champ.cle]: brut === option ? "" : option });
      return;
    }
    const suivants = choisis.includes(option) ? choisis.filter((c) => c !== option) : [...choisis, option];
    onChange({ ...value, [champ.cle]: suivants.join(", ") });
  }
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{champ.label}</span>
      <div className="flex flex-wrap gap-[6px]">
        {champ.options.map((option) => {
          const on = choisis.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => basculer(option)}
              aria-pressed={on}
              className="rounded-[12px] px-[11px] py-[5px] text-[0.625rem] font-semibold"
              style={{
                background: on ? "var(--color-brand-fill)" : "var(--color-brand-tint)",
                color: on ? "#fff" : "var(--color-brand)",
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
      {champ.libre && (
        <input
          value={brut}
          onChange={(e) => onChange({ ...value, [champ.cle]: e.target.value })}
          placeholder={champ.placeholder}
          className={FIELD}
        />
      )}
    </div>
  );
}

const AIDE_DECLINAISONS =
  "Les déclinaisons (stockage, contenance, poids du sac, taille) se saisissent dans « Tailles » ci-dessus : le client choisit la sienne avant l'ajout au panier.";

/**
 * Les champs de chaque vitrine du handoff — exactement les clés que lisent
 * `src/components/boutique/layouts/<métier>-layout.tsx`. Une valeur vide
 * n'est pas enregistrée ; la vitrine masque alors la ligne correspondante.
 */
const CHAMPS_VITRINE: Partial<Record<VitrineId, { titre: string; aide: string; champs: Array<Champ | ChampChoix> }>> = {
  telephones: {
    titre: "Fiche technique",
    aide: `Affichée sur la fiche et dans le comparateur. La marque alimente le filtre « ماركتي » — pour un accessoire, indiquez toutes les marques compatibles. ${AIDE_DECLINAISONS}`,
    champs: [
      ...CHAMPS_ELECTRONIQUE,
      { cle: "ram", label: "RAM", placeholder: "8 Go" },
      { cle: "camera", label: "Caméra", placeholder: "50 MP" },
    ],
  },
  electromenager: {
    titre: "Fiche appareil",
    aide: "La pièce alimente le filtre « لأيّ غرفة؟ », la classe énergie l'étiquette à 7 segments ; garantie et bruit servent au comparateur.",
    champs: [
      { cle: "piece", label: "Pièce", options: ["Cuisine", "Lavage", "Climatisation", "Petit électro"], libre: false },
      { cle: "classe_energie", label: "Classe énergie", options: ["A+++", "A++", "A+", "A", "B", "C", "D"] },
      { cle: "capacite", label: "Capacité", placeholder: "420 L, 8 kg…" },
      { cle: "garantie_mois", label: "Garantie (mois)", placeholder: "24" },
      { cle: "bruit_db", label: "Bruit (dB)", placeholder: "42" },
    ],
  },
  parfumerie: {
    titre: "Pyramide olfactive",
    aide: `La famille alimente le filtre « عائلتي العطرية » ; notes, sillage et tenue s'affichent sur le flacon. ${AIDE_DECLINAISONS}`,
    champs: [
      { cle: "famille_olfactive", label: "Famille olfactive", options: ["Floral", "Boisé", "Oriental", "Frais"], libre: true, placeholder: "Ou une autre famille…" },
      ...CHAMPS_PARFUM.filter((c) => c.cle !== "famille_olfactive"),
      { cle: "sillage", label: "Sillage (1 léger → 5 intense)", options: ["1", "2", "3", "4", "5"] },
    ],
  },
  cosmetiques: {
    titre: "Fiche beauté",
    aide: "Le besoin alimente le filtre « احتياجي » ; les teintes s'affichent depuis les couleurs du produit, le type de peau et les ingrédients sur la fiche. "+AIDE_DECLINAISONS,
    champs: [
      { cle: "besoin", label: "Besoin", options: ["Maquillage", "Soin visage", "Cheveux", "Corps"] },
      { cle: "peau", label: "Type de peau", options: ["Peau sèche", "Peau grasse", "Peau mixte", "Peau sensible"], multiple: true, libre: true, placeholder: "Ou une autre précision…" },
      { cle: "marque", label: "Marque", placeholder: "L'Oréal, Flormar…" },
      { cle: "ingredients", label: "Ingrédients clés", placeholder: "Vitamine C, acide hyaluronique…" },
    ],
  },
  parapharmacie: {
    titre: "Conseil soin",
    aide: "Le type de peau alimente le filtre « نوع بشرتي » et la jauge « مناسب لبشرتك » ; le moment et les ingrédients s'affichent sur la fiche.",
    champs: [
      { cle: "peau", label: "Type de peau", options: ["Peau sèche", "Peau grasse", "Peau sensible", "Bébé & enfant"], multiple: true },
      { cle: "moment", label: "Moment d'application", options: ["Matin", "Soir", "Matin et soir"] },
      { cle: "ingredients", label: "Ingrédients clés", placeholder: "Niacinamide, panthénol…" },
      ...CHAMPS_PARAPHARMACIE,
    ],
  },
  moto: {
    titre: "Pièce détachée",
    aide: "La compatibilité alimente le filtre « الموتو متاعي » et la grille ✓ / × de chaque pièce. Le montage n'apparaît que si vous en indiquez le prix.",
    champs: [
      { cle: "reference", label: "Référence", placeholder: "BRK-2210" },
      { cle: "compatibilite", label: "Compatible avec", options: ["Yamaha", "Honda", "SYM", "Kymco", "Peugeot"], multiple: true, libre: true, placeholder: "Ou d'autres marques, séparées par des virgules" },
      { cle: "montage_prix", label: "Montage à l'atelier (DT, facultatif)", placeholder: "10" },
    ],
  },
  patisserie: {
    titre: "Fiche gourmandise",
    aide: "L'occasion alimente le filtre « المناسبة » ; l'unité et la disponibilité s'affichent sur la ligne du menu.",
    champs: [
      { cle: "occasion", label: "Occasion", options: ["Anniversaire", "Mariage", "Tous les jours", "Traditionnel"], multiple: true },
      { cle: "unite", label: "Prix par", placeholder: "kg, pièce, boîte…" },
      { cle: "disponible", label: "Disponibilité", placeholder: "Frais maintenant, sur commande 24 h…" },
    ],
  },
  animalerie: {
    titre: "Pour quel animal ?",
    aide: `L'animal alimente le filtre « حيواني » (à défaut, la sous-catégorie du produit). ${AIDE_DECLINAISONS}`,
    champs: [
      { cle: "animal", label: "Animal", options: ["Chat", "Chien", "Oiseaux", "Poissons"], multiple: true },
      { cle: "note", label: "Précision", placeholder: "Saumon, sans céréales…" },
    ],
  },
  sport: {
    titre: "Fiche équipement",
    aide: `Le sport alimente le filtre « رياضتي », le niveau la barre à 5 segments. ${AIDE_DECLINAISONS}`,
    champs: [
      { cle: "sport", label: "Sport", options: ["Course", "Football", "Musculation", "Natation"], multiple: true, libre: true, placeholder: "Ou un autre sport…" },
      { cle: "niveau", label: "Niveau", options: ["Débutant", "Loisir", "Confirmé", "Avancé", "Élite"] },
    ],
  },
  location: {
    titre: "Location",
    aide: "Le prix du produit est le prix par jour. Le type alimente le filtre « ماذا تريد أن تكتري؟ » ; caution et assurance s'affichent si vous les indiquez.",
    champs: [
      { cle: "type", label: "Type", options: ["Voiture", "Fêtes", "Sonorisation", "Camping"] },
      { cle: "caution", label: "Caution (DT)", placeholder: "500" },
      { cle: "assurance_jour", label: "Assurance (DT / jour, facultatif)", placeholder: "15" },
    ],
  },
};

/** Le métier par défaut d'une famille quand la catégorie du produit ne tranche pas. */
const VITRINE_PAR_FAMILLE: Partial<Record<ThemeId, VitrineId>> = {
  electronique: "telephones",
  parapharmacie: "parapharmacie",
  auto: "moto",
  alimentation: "patisserie",
  animaux: "animalerie",
  sport: "sport",
};

/**
 * Champs par métier — `product_attributes`, lus par les mises en page
 * boutique correspondantes (`BeauteLayout`, les vitrines par métier,
 * `MaisonLayout`, `BijouterieLayout`, `ParapharmacieLayout`). Rien d'autre
 * ne change dans `ProductEditor` : un vendeur hors de ces métiers ne voit
 * aucun champ de plus.
 *
 * Volontairement pas de « form builder » générique — cinq petits blocs
 * conditionnels suffisent et restent lisibles un par un.
 */
export function AttributFields({
  familleId,
  categoryId,
  categories,
  value,
  onChange,
  materiaux,
  onChangeMateriaux,
}: {
  familleId: ThemeId;
  categoryId: string | null;
  categories: Category[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  materiaux: string[];
  onChangeMateriaux: (m: string[]) => void;
}) {
  if (familleId === "mode") {
    return (
      <Card className="flex flex-col gap-2 p-3">
        <span className={LABEL}>Type de vêtement</span>
        <p className="text-[0.625rem] leading-[1.45] text-[var(--color-muted)]">
          Pour affiner le rayon dans l&apos;onglet {value.type ? `« ${value.type} »` : "choisi"} de votre boutique,
          en plus de Femme/Homme/Enfant.
        </p>
        <div className="flex flex-wrap gap-[6px]">
          {TYPES_VETEMENT.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ ...value, type: value.type === type ? "" : type })}
              className="rounded-[12px] px-[11px] py-[5px] text-[0.625rem] font-semibold"
              style={{
                background: value.type === type ? "var(--color-brand-fill)" : "var(--color-brand-tint)",
                color: value.type === type ? "#fff" : "var(--color-brand)",
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <input
          value={value.type ?? ""}
          onChange={(e) => onChange({ ...value, type: e.target.value })}
          placeholder="Ou un autre type…"
          className={FIELD}
        />
      </Card>
    );
  }

  /*
    Les métiers du handoff (vitrines) : la catégorie du produit d'abord —
    un frigo d'une boutique « Électronique » reçoit les champs
    d'électroménager —, sinon le métier par défaut de la famille.
  */
  const slugProduit = categories.find((c) => c.id === categoryId)?.slug;
  const vitrine = resolveVitrine(slugProduit)?.id ?? VITRINE_PAR_FAMILLE[familleId] ?? null;
  const bloc = vitrine ? CHAMPS_VITRINE[vitrine] : null;
  if (bloc) {
    return (
      <Card className="flex flex-col gap-[10px] p-3">
        <span className={LABEL}>{bloc.titre}</span>
        <p className="text-[0.625rem] leading-[1.45] text-[var(--color-muted)]">{bloc.aide}</p>
        {bloc.champs.map((c) =>
          "options" in c ? (
            <ChampPuces key={c.cle} champ={c} value={value} onChange={onChange} />
          ) : (
            <ChampTexte key={c.cle} champ={c} value={value} onChange={onChange} />
          ),
        )}
      </Card>
    );
  }

  if (familleId === "maison") {
    return (
      <Card className="flex flex-col gap-[10px] p-3">
        <span className={LABEL}>Pièce</span>
        <div className="flex flex-wrap gap-[6px]">
          {PIECES.map((piece) => (
            <button
              key={piece}
              type="button"
              onClick={() => onChange({ ...value, piece: value.piece === piece ? "" : piece })}
              className="rounded-[12px] px-[11px] py-[5px] text-[0.625rem] font-semibold"
              style={{
                background: value.piece === piece ? "var(--color-brand-fill)" : "var(--color-brand-tint)",
                color: value.piece === piece ? "#fff" : "var(--color-brand)",
              }}
            >
              {piece}
            </button>
          ))}
        </div>
        {CHAMPS_MAISON.map((c) => (
          <ChampTexte key={c.cle} champ={c} value={value} onChange={onChange} />
        ))}
      </Card>
    );
  }

  if (familleId === "bijouterie") {
    return (
      <Card className="flex flex-col gap-[10px] p-3">
        <span className={LABEL}>Matière</span>
        <div className="flex flex-wrap items-center gap-2">
          {materiaux.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChangeMateriaux(materiaux.filter((x) => x !== m))}
              className="rounded-[12px] bg-[var(--color-brand-tint)] px-3 py-1 text-[0.65625rem] font-semibold text-[var(--color-brand)]"
            >
              {m} ✕
            </button>
          ))}
          <input
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const v = e.currentTarget.value.trim();
              if (v && !materiaux.includes(v)) onChangeMateriaux([...materiaux, v]);
              e.currentTarget.value = "";
            }}
            placeholder="Or 18 ct, Argent 925…"
            className="w-36 rounded-[12px] border border-dashed border-[rgba(109,75,143,0.4)] px-3 py-1 text-[0.65625rem] outline-none"
          />
        </div>
        {CHAMPS_BIJOUTERIE.map((c) => (
          <ChampTexte key={c.cle} champ={c} value={value} onChange={onChange} />
        ))}
      </Card>
    );
  }

  return null;
}
