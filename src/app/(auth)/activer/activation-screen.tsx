"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { activerBoutique } from "@/app/actions/activation";
import { Button, Card, fieldClass } from "@/components/ui/primitives";

/**
 * Le pendant commerçant de l'écran d'inscription, mais sans rôle à choisir :
 * le code en tient lieu. `activerBoutique` redirige lui-même vers le tableau
 * de bord en cas de succès — ce composant ne gère que l'échec.
 */
export function ActivationScreen() {
  const { t, locale, setLocale } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const result = await activerBoutique({
        code: String(formData.get("code") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
      });

      // Le succès quitte la page depuis le serveur (redirect) : on n'arrive
      // ici qu'après un échec.
      if (result && !result.ok) setError(result.error);
    });
  }

  const fieldLabel = "text-[0.625rem] text-[var(--color-muted)]";
  const fieldInput = fieldClass({ strong: true });

  return (
    <>
      <header className="flex flex-none items-center justify-between px-[18px] pt-4 pb-2">
        <h1 className="text-[1.1875rem] font-bold tracking-[-0.0125rem] text-[var(--color-ink)]">
          {t.activation.pageTitle}
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

      <div className="no-sb flex flex-1 flex-col gap-[14px] overflow-y-auto px-4 pt-2 pb-6">
        <p className="text-[0.75rem] leading-[1.5] text-[var(--color-muted)]">{t.activation.intro}</p>

        <Card className="flex flex-none flex-col gap-[10px] p-[14px_12px]">
          <form action={onSubmit} className="flex flex-col gap-[10px]">
            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.activation.codeLabel}</span>
              <input
                name="code"
                required
                autoCapitalize="characters"
                placeholder={t.activation.codePlaceholder}
                className={`${fieldInput} text-center font-mono text-[1.0625rem] tracking-[0.2em] uppercase`}
                style={{ letterSpacing: "0.2em" }}
              />
            </label>

            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={fieldLabel}>{t.activation.firstNameLabel}</span>
                <input name="firstName" required autoComplete="given-name" className={fieldInput} />
              </label>
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={fieldLabel}>{t.activation.lastNameLabel}</span>
                <input name="lastName" autoComplete="family-name" className={fieldInput} />
              </label>
            </div>

            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.activation.emailLabel}</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                className={fieldInput}
              />
              <span className="text-[0.625rem] text-[var(--color-muted)]">{t.activation.emailHint}</span>
            </label>

            <label className="flex flex-col gap-[5px]">
              <span className={fieldLabel}>{t.activation.passwordLabel}</span>
              <span className="flex items-center gap-2 rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 py-[11px] focus-within:border-[var(--color-brand)]">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
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

            <Button type="submit" block disabled={pending}>
              {pending ? t.common.loading : t.activation.submit}
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-1 p-[12px]">
          <p className="text-[0.65625rem] leading-[1.5] text-[var(--color-muted)]">{t.activation.noCode}</p>
        </Card>

        <Link href="/preparation" className="text-center text-[0.75rem] font-bold text-[var(--color-brand)]">
          {t.activation.backHome}
        </Link>
      </div>
    </>
  );
}
