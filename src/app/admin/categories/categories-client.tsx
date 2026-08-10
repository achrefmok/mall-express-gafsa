"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { upsertCategory } from "@/app/actions/admin";
import { Button, Card, Divider, Switch } from "@/components/ui/primitives";
import type { Category } from "@/types/database";

const FIELD =
  "w-full rounded-[10px] border border-[var(--color-outline)] bg-white px-2 py-[7px] text-[11px] outline-none focus:border-[var(--color-brand)]";

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
            <span
              className="cat-surface cat-ring cat-ink flex h-9 w-9 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
              style={{ "--hue": category.hue } as React.CSSProperties}
            >
              {category.monogram}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-semibold text-[var(--color-ink)]">
                {category.parent_id && <span className="text-[var(--color-faint)]">— </span>}
                {category.name_fr}
              </p>
              <p className="truncate text-[10px] text-[var(--color-muted)]">
                {category.name_ar} · teinte {category.hue}
              </p>
            </div>

            <ActiveToggle category={category} />
          </div>
        ))}
      </Card>

      {/* ─── Création ──────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-2 p-3">
        <p className="text-[11px] font-bold text-[var(--color-ink)]">{t.common.add}</p>

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
          <span className="text-[10px] text-[var(--color-muted)]">Teinte · {hue}</span>
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
            className="cat-surface cat-ring cat-ink flex h-12 w-12 flex-none items-center justify-center rounded-[16px] text-[17px] font-semibold"
            style={{ "--hue": hue } as React.CSSProperties}
          >
            {mono || nameFr.slice(0, 2).toUpperCase() || "??"}
          </span>
          <span
            className="cat-surface cat-ink rounded-[14px] px-[13px] py-[6px] text-[10.5px] font-semibold"
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
          <p role="alert" className="text-[10.5px] font-semibold text-[var(--color-live)]">
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
