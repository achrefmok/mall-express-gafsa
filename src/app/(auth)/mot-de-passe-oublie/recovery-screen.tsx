"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { requestPasswordReset } from "@/app/actions/auth";
import { Button, Card, fieldClass } from "@/components/ui/primitives";

export function RecoveryScreen() {
  const { t } = useI18n();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "").trim();

    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (result.ok) setSentTo(email);
      else setError(result.error);
    });
  }

  return (
    <>
      <header className="flex flex-none items-center px-[18px] pt-4 pb-2">
        <h1 className="text-[1.1875rem] font-bold tracking-[-0.0125rem] text-[var(--color-ink)]">
          {t.recovery.title}
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-4 pt-4 pb-6">
        {sentTo ? (
          <Card className="flex flex-col gap-2 p-[14px_12px]">
            <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">{t.recovery.sentTitle}</p>
            <p className="text-[0.71875rem] leading-[1.5] text-[var(--color-muted)]">
              {t.recovery.sentBody.replace("{email}", sentTo)}
            </p>
          </Card>
        ) : (
          <Card className="flex flex-col gap-[10px] p-[14px_12px]">
            <p className="text-[0.71875rem] leading-[1.5] text-[var(--color-muted)]">{t.recovery.body}</p>
            <form action={onSubmit} className="flex flex-col gap-[10px]">
              <label className="flex flex-col gap-[5px]">
                <span className="text-[0.625rem] text-[var(--color-muted)]">{t.auth.email}</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  className={fieldClass({ strong: true })}
                />
              </label>

              {error && (
                <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
                  {error}
                </p>
              )}

              <Button type="submit" block disabled={pending}>
                {pending ? t.common.loading : t.recovery.send}
              </Button>
            </form>
          </Card>
        )}

        <Card className="flex flex-col gap-1 p-[12px]">
          <p className="text-[0.71875rem] font-bold text-[var(--color-ink)]">{t.recovery.noEmailTitle}</p>
          <p className="text-[0.65625rem] leading-[1.5] text-[var(--color-muted)]">{t.recovery.noEmailBody}</p>
        </Card>

        <Link href="/connexion" className="text-center text-[0.75rem] font-bold text-[var(--color-brand)]">
          {t.recovery.back}
        </Link>
      </div>
    </>
  );
}
