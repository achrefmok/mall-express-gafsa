"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { creerBoutiqueAvecCode, revoquerCode, type CodeActivation } from "@/app/actions/activation";
import { Button, Card, SectionTitle, Tag, fieldClass } from "@/components/ui/primitives";
import type { Category } from "@/types/database";

type Nouveau = { code: string; expiresAt: string; shopName: string };

/** L'état d'un code, calculé à l'affichage : rien n'est stocké de plus que ce que la base sait déjà. */
function statut(c: CodeActivation, t: ReturnType<typeof useI18n>["t"]): { label: string; tone: "outline" | "tinted" | "live" } {
  if (c.revokedAt) return { label: t.activation.statusRevoked, tone: "outline" };
  if (c.usedAt) return { label: t.activation.statusUsed, tone: "tinted" };
  if (new Date(c.expiresAt).getTime() < Date.now()) return { label: t.activation.statusExpired, tone: "outline" };
  return { label: t.activation.statusPending, tone: "live" };
}

export function ActivationAdminClient({
  categories,
  initialCodes,
}: {
  categories: Category[];
  initialCodes: CodeActivation[];
}) {
  const { t, locale } = useI18n();
  const [codes, setCodes] = useState(initialCodes);
  const [nouveau, setNouveau] = useState<Nouveau | null>(null);
  const [copie, setCopie] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [revocation, setRevocation] = useState<string | null>(null);

  const fieldLabel = "text-[0.625rem] text-[var(--color-muted)]";
  const fieldInput = fieldClass({ strong: true });

  function onCreer(formData: FormData) {
    setError(null);
    setNouveau(null);

    startTransition(async () => {
      const result = await creerBoutiqueAvecCode({
        name: String(formData.get("name") ?? ""),
        categoryId: String(formData.get("categoryId") ?? "") || null,
        address: String(formData.get("address") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        mallLevel: formData.get("mallLevel") ? Number(formData.get("mallLevel")) : null,
        mallUnit: String(formData.get("mallUnit") ?? ""),
        validityDays: Number(formData.get("validityDays") ?? 7),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNouveau({ code: result.data.code, expiresAt: result.data.expiresAt, shopName: result.data.shop.name });
      setCodes((prev) => [
        {
          id: result.data.id,
          code: result.data.code,
          expiresAt: result.data.expiresAt,
          usedAt: null,
          revokedAt: null,
          createdAt: new Date().toISOString(),
          shop: result.data.shop,
        },
        ...prev,
      ]);
      (document.getElementById("form-activation") as HTMLFormElement | null)?.reset();
    });
  }

  function onRevoquer(id: string) {
    if (!window.confirm(t.activation.revokeConfirm)) return;

    setRevocation(id);
    startTransition(async () => {
      const result = await revoquerCode(id);
      setRevocation(null);
      if (result.ok) {
        setCodes((prev) =>
          prev.map((c) => (c.id === id ? { ...c, revokedAt: new Date().toISOString() } : c)),
        );
      }
    });
  }

  function copier(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
    });
  }

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
      <p className="text-[0.75rem] leading-[1.5] text-[var(--color-muted)]">{t.activation.adminIntro}</p>

      {nouveau && (
        <Card className="flex flex-col gap-2 border-2 border-[var(--color-brand)] p-4">
          <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">
            {t.activation.createdTitle} — {nouveau.shopName}
          </p>
          <p className="text-[0.65625rem] leading-[1.5] text-[var(--color-muted)]">{t.activation.createdBody}</p>
          <p className="rounded-[14px] bg-[var(--color-brand-tint)] py-3 text-center font-mono text-[1.5rem] font-bold tracking-[0.25em] text-[var(--color-brand)]">
            {nouveau.code}
          </p>
          <p className="text-[0.625rem] text-[var(--color-muted)]">
            {t.activation.expiresOn} {new Date(nouveau.expiresAt).toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR")}
          </p>
          <Button type="button" onClick={() => copier(nouveau.code)}>
            {copie ? t.activation.copied : t.activation.copyCode}
          </Button>
        </Card>
      )}

      <section className="flex flex-none flex-col gap-2">
        <SectionTitle>{t.activation.formTitle}</SectionTitle>
        <Card className="flex flex-col gap-[10px] p-[14px_12px]">
          <form id="form-activation" action={onCreer} className="flex flex-col gap-[10px]">
            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.activation.shopName}</span>
              <input name="name" required className={fieldInput} />
            </label>

            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.activation.category}</span>
              <select name="categoryId" className={fieldInput}>
                <option value="">—</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {locale === "ar" ? cat.name_ar : cat.name_fr}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.activation.address}</span>
              <input name="address" className={fieldInput} />
            </label>

            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={fieldLabel}>{t.activation.phone}</span>
                <input name="phone" type="tel" className={fieldInput} />
              </label>
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={fieldLabel}>{t.activation.mallLevel}</span>
                <input name="mallLevel" type="number" className={fieldInput} />
              </label>
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={fieldLabel}>{t.activation.mallUnit}</span>
                <input name="mallUnit" className={fieldInput} />
              </label>
            </div>

            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.activation.validityDays}</span>
              <input name="validityDays" type="number" min={1} max={90} defaultValue={7} className={fieldInput} />
            </label>

            {error && (
              <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
                {error}
              </p>
            )}

            <Button type="submit" block disabled={pending}>
              {pending ? t.common.loading : t.activation.create}
            </Button>
          </form>
        </Card>
      </section>

      <section className="flex flex-none flex-col gap-2">
        <SectionTitle>{t.activation.listTitle}</SectionTitle>
        {codes.length === 0 ? (
          <p className="text-[0.71875rem] text-[var(--color-muted)]">{t.activation.listEmpty}</p>
        ) : (
          <Card className="flex flex-col gap-[10px] p-3">
            {codes.map((c, index) => {
              const s = statut(c, t);
              const peutRevoquer = !c.usedAt && !c.revokedAt;
              return (
                <div key={c.id} className={index > 0 ? "flex flex-col gap-1 border-t border-[var(--color-hairline)] pt-[10px]" : "flex flex-col gap-1"}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
                      {c.shop.name}
                    </span>
                    <Tag tone={s.tone}>{s.label}</Tag>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[0.8125rem] font-bold tracking-[0.15em] text-[var(--color-brand)]">
                      {c.code}
                    </span>
                    {peutRevoquer && (
                      <button
                        type="button"
                        onClick={() => onRevoquer(c.id)}
                        disabled={pending && revocation === c.id}
                        className="text-[0.65625rem] font-bold text-[var(--color-live)]"
                      >
                        {t.activation.revoke}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
