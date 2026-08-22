"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { upsertCategory } from "@/app/actions/admin";
import { uploadImage } from "@/lib/upload";
import { cx } from "@/lib/format";
import { Button, Card, Divider, Switch, fieldClass } from "@/components/ui/primitives";
import type { Category } from "@/types/database";

const FIELD =
  fieldClass({ size: "xs", solid: true });

/**
 * Ajouter une catégorie revient à choisir une teinte : le reste du système
 * (pastille, chip, filet produit) en découle automatiquement. L'aperçu
 * ci-dessous montre exactement ce que la teinte produira.
 */
export function CategoryManager({ categories }: { categories: Category[] }) {
  const { t } = useI18n();
  const router = useRouter();

  const [slug, setSlug] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [hue, setHue] = useState(200);
  const [mono, setMono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate() {
    setError(null);
    startTransition(async () => {
      const result = await upsertCategory({
        slug,
        nameFr,
        nameAr,
        hue,
        monogram: mono || nameFr.slice(0, 2),
        sortOrder: categories.length + 1,
      });

      if (result.ok) {
        setSlug("");
        setNameFr("");
        setNameAr("");
        setMono("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
      {/* ─── Liste ─────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-2 p-3">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center gap-[10px]">
            <CategoryImage category={category} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.71875rem] font-semibold text-[var(--color-ink)]">
                {category.parent_id && <span className="text-[var(--color-faint)]">— </span>}
                {category.name_fr}
              </p>
              <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                {category.name_ar} · teinte {category.hue}
              </p>
            </div>

            <ActiveToggle category={category} />
          </div>
        ))}
      </Card>

      {/* ─── Création ──────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-2 p-3">
        <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">{t.common.add}</p>

        <div className="flex gap-2">
          <input
            value={nameFr}
            onChange={(e) => {
              setNameFr(e.target.value);
              if (!slug) {
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[̀-ͯ]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
              }
            }}
            placeholder="Nom (fr)"
            aria-label="Nom en français"
            className={FIELD}
          />
          <input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder="الاسم"
            aria-label="Nom en arabe"
            dir="rtl"
            lang="ar"
            className={FIELD}
          />
        </div>

        <div className="flex gap-2">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug"
            aria-label="Identifiant d'URL"
            className={FIELD}
          />
          <input
            value={mono}
            onChange={(e) => setMono(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="MO"
            aria-label="Monogramme"
            className={`${FIELD} w-20`}
          />
        </div>

        <Divider />

        <label className="flex flex-col gap-2">
          <span className="text-[0.625rem] text-[var(--color-muted)]">Teinte · {hue}</span>
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(Number.parseInt(e.target.value, 10))}
            className="w-full accent-[var(--color-brand)]"
          />
        </label>

        {/* Aperçu : la pastille, la chip et le filet produit tels qu'ils
            apparaîtront réellement dans l'application. */}
        <div className="flex items-center gap-3 rounded-[12px] bg-[var(--color-app)] p-2">
          <span
            className="cat-surface cat-ring cat-ink flex h-12 w-12 flex-none items-center justify-center rounded-[16px] text-[1.0625rem] font-semibold"
            style={{ "--hue": hue } as React.CSSProperties}
          >
            {mono || nameFr.slice(0, 2).toUpperCase() || "??"}
          </span>
          <span
            className="cat-surface cat-ink rounded-[14px] px-[13px] py-[6px] text-[0.65625rem] font-semibold"
            style={{ "--hue": hue } as React.CSSProperties}
          >
            {nameFr || "Catégorie"}
          </span>
          <span
            className="cat-rule h-[2px] flex-1 rounded"
            style={{ "--hue": hue } as React.CSSProperties}
          />
        </div>

        {error && (
          <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
            {error}
          </p>
        )}

        <Button size="sm" block onClick={onCreate} disabled={pending || !nameFr.trim() || !slug.trim()}>
          {pending ? t.common.loading : t.common.add}
        </Button>
      </Card>
    </div>
  );
}

function ActiveToggle({ category }: { category: Category }) {
  const router = useRouter();
  const [active, setActive] = useState(category.is_active);
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={active}
      disabled={pending}
      label={category.name_fr}
      onChange={(next) => {
        setActive(next);
        startTransition(async () => {
          const result = await upsertCategory({
            id: category.id,
            slug: category.slug,
            nameFr: category.name_fr,
            nameAr: category.name_ar,
            hue: category.hue,
            monogram: category.monogram,
            sortOrder: category.sort_order,
            isActive: next,
          });
          if (result.ok) router.refresh();
          else setActive(!next);
        });
      }}
    />
  );
}

/**
 * La photo de la catégorie, changée en un toucher.
 *
 * La pastille de couleur *est* le bouton : pas de champ d'adresse à remplir, pas
 * de ligne supplémentaire dans une liste déjà dense. On touche la catégorie, on
 * choisit une image, elle apparaît. Toucher une catégorie qui en a déjà une la
 * remplace ; le bouton « × » la retire et rend la main au dessin.
 *
 * La colonne reste facultative : tant qu'aucune image n'est choisie, l'accueil
 * affiche l'icône dessinée. Rien ne casse, chaque photo ajoutée améliore l'écran.
 */
function CategoryImage({ category }: { category: Category }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(imageUrl: string | null) {
    startTransition(async () => {
      const result = await upsertCategory({
        id: category.id,
        slug: category.slug,
        nameFr: category.name_fr,
        nameAr: category.name_ar,
        hue: category.hue,
        monogram: category.monogram,
        sortOrder: category.sort_order,
        isActive: category.is_active,
        imageUrl,
      });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);

    try {
      const { publicUrl } = await uploadImage("shop-assets", file);
      save(publicUrl);
    } catch {
      setError("Envoi impossible");
    }
  }

  return (
    <span className="relative flex-none">
      <label
        title={error ?? "Changer la photo"}
        className={cx(
          "press flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-[14px] text-[0.8125rem] font-semibold",
          category.image_url ? "bg-[var(--color-track)]" : "cat-surface cat-ring cat-ink",
          pending && "opacity-50",
        )}
        style={{ "--hue": category.hue } as React.CSSProperties}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={pending}
          onChange={(event) => void onPick(event.target.files?.[0])}
        />
        {category.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette de 36 px dans une liste d'administration
          <img src={category.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          category.monogram
        )}
      </label>

      {category.image_url && (
        <button
          type="button"
          onClick={() => save(null)}
          disabled={pending}
          aria-label={`Retirer la photo de ${category.name_fr}`}
          className="absolute -end-[6px] -top-[6px] flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(36,31,46,0.78)] text-[0.6875rem] leading-none text-white"
        >
          ×
        </button>
      )}
    </span>
  );
}
