"use client";

import { Card } from "@/components/ui/primitives";
import type { ThemeId } from "@/lib/boutique-themes";
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

const CHAMPS_PARAPHARMACIE: Champ[] = [{ cle: "besoin", label: "Besoin", placeholder: "Bébé, Solaire…" }];

const TYPES_PEAU = ["Peau sèche", "Peau grasse", "Mixte", "Sensible"];
const ETAPES_SOIN = ["Nettoyer", "Traiter", "Hydrater & protéger"];

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

/**
 * Champs par métier — `product_attributes`, lus par les mises en page
 * boutique correspondantes (`ElectroniqueLayout`, `BeauteLayout`,
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

  if (familleId === "electronique") {
    return (
      <Card className="flex flex-col gap-[10px] p-3">
        <span className={LABEL}>Caractéristiques</span>
        {CHAMPS_ELECTRONIQUE.map((c) => (
          <ChampTexte key={c.cle} champ={c} value={value} onChange={onChange} />
        ))}
      </Card>
    );
  }

  if (familleId === "beaute") {
    const slugActuel = categories.find((c) => c.id === categoryId)?.slug;
    if (slugActuel === "beaute-parfums") {
      return (
        <Card className="flex flex-col gap-[10px] p-3">
          <span className={LABEL}>Pyramide olfactive</span>
          {CHAMPS_PARFUM.map((c) => (
            <ChampTexte key={c.cle} champ={c} value={value} onChange={onChange} />
          ))}
        </Card>
      );
    }
    if (slugActuel === "beaute-soin") {
      return (
        <Card className="flex flex-col gap-[10px] p-3">
          <span className={LABEL}>Type de peau</span>
          <div className="flex flex-wrap gap-[6px]">
            {TYPES_PEAU.map((peau) => (
              <button
                key={peau}
                type="button"
                onClick={() => onChange({ ...value, peau: value.peau === peau ? "" : peau })}
                className="rounded-[12px] px-[11px] py-[5px] text-[0.625rem] font-semibold"
                style={{
                  background: value.peau === peau ? "var(--color-brand-fill)" : "var(--color-brand-tint)",
                  color: value.peau === peau ? "#fff" : "var(--color-brand)",
                }}
              >
                {peau}
              </button>
            ))}
          </div>
          <span className={LABEL}>Geste de la routine</span>
          <p className="text-[0.625rem] leading-[1.45] text-[var(--color-muted)]">
            Pour proposer ce produit dans la routine en plusieurs étapes de votre boutique.
          </p>
          <div className="flex flex-wrap gap-[6px]">
            {ETAPES_SOIN.map((etape) => (
              <button
                key={etape}
                type="button"
                onClick={() => onChange({ ...value, etape: value.etape === etape ? "" : etape })}
                className="rounded-[12px] px-[11px] py-[5px] text-[0.625rem] font-semibold"
                style={{
                  background: value.etape === etape ? "var(--color-brand-fill)" : "var(--color-brand-tint)",
                  color: value.etape === etape ? "#fff" : "var(--color-brand)",
                }}
              >
                {etape}
              </button>
            ))}
          </div>
        </Card>
      );
    }
    return null;
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

  if (familleId === "parapharmacie") {
    return (
      <Card className="flex flex-col gap-[10px] p-3">
        <span className={LABEL}>Besoin</span>
        {CHAMPS_PARAPHARMACIE.map((c) => (
          <ChampTexte key={c.cle} champ={c} value={value} onChange={onChange} />
        ))}
      </Card>
    );
  }

  return null;
}
