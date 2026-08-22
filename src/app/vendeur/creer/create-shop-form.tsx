"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMyShop } from "@/app/actions/vendor";
import { useI18n } from "@/lib/i18n/provider";
import { cx } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Button, Card, SectionTitle, fieldClass } from "@/components/ui/primitives";
import type { Category } from "@/types/database";

const FIELD =
  fieldClass({ strong: true });
const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

export function CreateShopForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { t, locale } = useI18n();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createMyShop({ name, categoryId, address, phone });

      if (result.ok) {
        router.replace("/vendeur");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <TopBar title="Créer ma boutique" />

      <form
        onSubmit={onSubmit}
        className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[14px] pb-6"
      >
        <p className="flex-none text-[0.71875rem] leading-[1.5] text-[var(--color-muted)]">
          Votre compte est vendeur, mais aucune boutique ne lui est encore
          rattachée. Renseignez l&apos;essentiel : vous pourrez tout compléter
          ensuite, et votre dossier partira en validation.
        </p>

        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.vendor.identity}</SectionTitle>

          <Card className="flex flex-col gap-[10px] p-3">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Nom de la boutique</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                autoFocus
                autoComplete="organization"
                placeholder="Ex. Épicerie Ennour"
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Catégorie</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className={FIELD}
              >
                <option value="">— À choisir plus tard —</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {locale === "ar" ? category.name_ar : category.name_fr}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Adresse ou emplacement dans le mall</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                autoComplete="street-address"
                placeholder="Ex. Niveau 1, unité 24"
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t.cart.contactPhone}</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+216 …"
                className={FIELD}
              />
            </label>
          </Card>
        </section>

        <Button type="submit" block disabled={pending || name.trim().length < 2}>
          {pending ? t.common.saving : "Créer la boutique"}
        </Button>

        {error && (
          <p role="status" className={cx("text-[0.6875rem] font-semibold text-[var(--color-live)]")}>
            {error}
          </p>
        )}

        <p className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">
          La boutique est créée « en attente ». Vous pouvez préparer jusqu&apos;à
          cinq produits avant sa validation par l&apos;administration.
        </p>
      </form>
    </>
  );
}
