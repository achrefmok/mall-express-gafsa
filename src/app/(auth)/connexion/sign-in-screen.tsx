"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { requestPasswordReset, signIn, signInWithProvider } from "@/app/actions/auth";
import { Button, Card, fieldClass } from "@/components/ui/primitives";

export function SignInScreen({
  next,
  initialError,
  providers = [],
}: {
  next?: string;
  initialError?: string;
  /** Fournisseurs tiers activés sur le projet. Vide = section masquée. */
  providers?: Array<"google" | "facebook">;
}) {
  const { t, locale, setLocale } = useI18n();

  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  const fieldLabel = "text-[0.625rem] text-[var(--color-muted)]";
  const fieldInput =
    fieldClass({ strong: true });

  function onSubmit(formData: FormData) {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      // signIn redirige en cas de succès ; on ne reçoit une valeur que si
      // l'authentification a échoué.
      const result = await signIn(
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
        next,
      );
      if (result && !result.ok) setError(result.error);
    });
  }

  function onForgot(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    if (!email) {
      setError(t.auth.email);
      return;
    }

    startTransition(async () => {
      await requestPasswordReset(email);
      setNotice(t.auth.resetSent);
    });
  }

  return (
    <>
      <header className="flex flex-none items-center justify-between px-[18px] pt-4 pb-2">
        <h1 className="text-[1.1875rem] font-bold tracking-[-0.0125rem] text-[var(--color-ink)]">
          {t.auth.signInTitle}
        </h1>
        <button
          type="button"
          onClick={() => setLocale(locale === "ar" ? "fr" : "ar")}
          lang={locale === "ar" ? "fr" : "ar"}
          className="-m-2 p-2 text-[0.71875rem] font-bold text-[var(--color-brand)]"
        >
          {locale === "ar" ? t.a11y.french : t.a11y.arabic}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-4 pt-4 pb-6">
        <Card className="flex flex-none flex-col p-[14px_12px]">
          <form className="flex flex-col gap-[10px]">
            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.auth.email}</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                className={fieldInput}
              />
            </label>

            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.auth.password}</span>
              <span className="flex items-center gap-2 rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 py-[11px] focus-within:border-[var(--color-brand)]">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent text-[0.78125rem] font-semibold text-[var(--color-ink)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="-me-1 flex-none px-2 py-2 text-[0.625rem] font-bold text-[var(--color-brand)]"
                >
                  {showPassword ? t.auth.hide : t.auth.show}
                </button>
              </span>
            </label>

            {error && (
              <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-[0.6875rem] font-semibold text-[var(--color-brand)]">
                {notice}
              </p>
            )}

            <Button type="submit" formAction={onSubmit} block disabled={pending}>
              {pending ? t.common.loading : t.auth.signIn}
            </Button>

            <button
              type="submit"
              formAction={onForgot}
              formNoValidate
              className="py-2 text-center text-[0.65625rem] font-semibold text-[var(--color-muted)]"
            >
              {t.auth.forgotPassword}
            </button>
          </form>
        </Card>

        {providers.length > 0 && (
          <div className="flex flex-none items-center gap-[10px]">
            <span className="h-px flex-1 bg-[var(--color-hairline)]" />
            <span className="text-[0.625rem] text-[var(--color-muted)]">{t.common.or}</span>
            <span className="h-px flex-1 bg-[var(--color-hairline)]" />
          </div>
        )}

        <div className="flex flex-none flex-col gap-2">
          {(
            [
              { provider: "google" as const, label: t.auth.withGoogle },
              { provider: "facebook" as const, label: t.auth.withFacebook },
            ] as const
          )
            .filter(({ provider }) => providers.includes(provider))
            .map(({ provider, label }) => (
            <form key={provider} action={signInWithProvider.bind(null, provider)}>
              <input type="hidden" name="suite" value={next ?? ""} />
              <button
                type="submit"
                className="w-full rounded-[16px] border border-[var(--color-outline)] bg-[var(--color-veil)] px-3 py-3 text-[0.75rem] font-semibold text-[var(--color-ink)]"
              >
                {label}
              </button>
            </form>
          ))}
          <Link
            href="/accueil"
            className="rounded-[16px] px-3 py-3 text-center text-[0.75rem] font-semibold text-[var(--color-brand)]"
          >
            {t.auth.asGuest}
          </Link>
        </div>

        <p className="text-center text-[0.6875rem] text-[var(--color-muted)]">
          {t.auth.noAccount}{" "}
          <Link href="/inscription" className="font-bold text-[var(--color-brand)]">
            {t.auth.createAccount}
          </Link>
        </p>
      </div>
    </>
  );
}
