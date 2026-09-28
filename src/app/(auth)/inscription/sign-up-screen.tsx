"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { signInWithProvider, signUp } from "@/app/actions/auth";
import { cx } from "@/lib/format";
import { Button, Card, fieldClass } from "@/components/ui/primitives";

/**
 * Écran 13 — inscription client et vendeur en un seul écran.
 * Le vendeur ne voit apparaître ses deux champs supplémentaires qu'après
 * avoir choisi son rôle : le formulaire reste court dans les deux cas.
 */
export function SignUpScreen({
  initialRole,
  lockedRole = false,
  referralCode,
  providers = [],
}: {
  initialRole: "client" | "vendor";
  /** L'adresse a déjà tranché : on n'affiche plus le choix du rôle. */
  lockedRole?: boolean;
  referralCode?: string;
  /** Fournisseurs tiers activés sur le projet. Vide = section masquée. */
  providers?: Array<"google" | "facebook">;
}) {
  const { t, locale, setLocale } = useI18n();

  const [role, setRole] = useState<"client" | "vendor">(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const result = await signUp({
        role,
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        shopName: String(formData.get("shopName") ?? ""),
        shopLocation: String(formData.get("shopLocation") ?? ""),
        referralCode,
      });

      // En cas de succès, `signUp` redirige côté serveur : ce code n'est
      // atteint que si la session n'a pas pu être ouverte, ou en cas d'erreur.
      if (result.ok) setSentTo(result.data.email);
      else setError(result.error);
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[1.25rem] font-bold text-[var(--color-brand)]">
          ✓
        </div>
        <h1 className="text-[1.125rem] font-bold text-[var(--color-ink)]">{t.auth.checkEmail}</h1>
        <p className="text-[0.75rem] leading-relaxed text-[var(--color-muted)]">
          {format(t.auth.checkEmailBody, { email: sentTo })}
        </p>
        <Link href="/connexion" className="mt-2 text-[0.75rem] font-bold text-[var(--color-brand)]">
          {t.auth.signIn}
        </Link>
      </div>
    );
  }

  const fieldLabel = "text-[0.625rem] text-[var(--color-muted)]";
  const fieldInput = fieldClass({ strong: true });

  /*
    Les deux champs de la boutique sont posés sur une carte teintée : leur fond
    doit être opaque pour rester lisible.

    Ils ajoutaient auparavant `bg-white` par-dessus le style de base, qui pose
    déjà un fond. Deux utilitaires qui règlent la même propriété ne se
    départagent pas par leur ordre dans l'attribut mais par leur ordre dans la
    feuille de style : le résultat tenait du hasard. L'option `solid` le décide.
  */
  const fieldSolid = fieldClass({ strong: true, solid: true });

  return (
    <>
      <header className="flex flex-none items-center justify-between px-[18px] pt-4 pb-2">
        <h1 className="text-[1.1875rem] font-bold tracking-[-0.0125rem] text-[var(--color-ink)]">
          {t.auth.createAccount}
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
        {/* ─── Choix du rôle ───────────────────────────────────────────── */}
        {!lockedRole && (
        <div className="flex flex-none gap-[10px]" role="radiogroup" aria-label={t.auth.roleClient}>
          {(
            [
              { value: "client", title: t.auth.roleClient, body: t.auth.roleClientBody },
              { value: "vendor", title: t.auth.roleVendor, body: t.auth.roleVendorBody },
            ] as const
          ).map((option) => {
            const active = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setRole(option.value)}
                className={cx(
                  "flex flex-1 flex-col gap-1 rounded-[18px] p-3 text-start transition-colors",
                  active
                    ? "bg-[var(--color-brand-fill)] text-white"
                    : "border border-[var(--color-surface-edge)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
                )}
              >
                <span className="text-[0.78125rem] font-bold">{option.title}</span>
                <span
                  className={cx(
                    "text-[0.625rem] leading-[1.4]",
                    active ? "opacity-85" : "text-[var(--color-muted)]",
                  )}
                >
                  {option.body}
                </span>
              </button>
            );
          })}
        </div>
        )}

        {/* ─── Formulaire ──────────────────────────────────────────────── */}
        <Card className="flex flex-none flex-col gap-[10px] p-[14px_12px]">
          <form action={onSubmit} className="flex flex-col gap-[10px]">
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={fieldLabel}>{t.auth.firstName}</span>
                <input name="firstName" required autoComplete="given-name" className={fieldInput} />
              </label>
              <label className="flex flex-1 flex-col gap-[5px]">
                <span className={fieldLabel}>{t.auth.lastName}</span>
                <input name="lastName" autoComplete="family-name" className={fieldInput} />
              </label>
            </div>

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

            {/* Vendeur : les deux champs annoncés par l'encart plus bas. */}
            {role === "vendor" && (
              <div className="flex animate-slide-up flex-col gap-[10px] rounded-[14px] bg-[var(--color-brand-tint)] p-3">
                <label className="flex flex-col gap-[5px]">
                  <span className={fieldLabel}>{t.auth.vendorStep1}</span>
                  <input
                    name="shopName"
                    required
                    autoComplete="organization"
                    className={fieldSolid}
                  />
                </label>
                <label className="flex flex-col gap-[5px]">
                  <span className={fieldLabel}>{t.auth.vendorStep2}</span>
                  <input
                    name="shopLocation"
                    required
                    placeholder="Niveau 1 — Local B12"
                    className={fieldSolid}
                  />
                </label>
              </div>
            )}

            {error && (
              <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
                {error}
              </p>
            )}

            <Button type="submit" block disabled={pending}>
              {pending ? t.common.loading : t.auth.createAccount}
            </Button>

            <p className="text-center text-[0.625rem] leading-[1.5] text-[var(--color-muted)]">
              {role === "client" ? t.auth.clientInstant : t.auth.vendorNote}
            </p>
          </form>
        </Card>

        {/* ─── Fournisseurs tiers ──────────────────────────────────────── */}
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
              {role === "vendor" && <input type="hidden" name="role" value="vendor" />}
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

        {/*
          ─── Encart vendeur ────────────────────────────────────────────

          Il vantait le parcours commerçant à qui hésitait encore, du temps où
          les deux rôles se choisissaient sur le même écran. Sur un espace
          client dédié il n'a plus lieu d'être : il détaille deux champs que le
          visiteur ne verra jamais, et le pont vers l'autre inscription est déjà
          en tête d'écran. Conservé quand le choix du rôle est offert.
        */}
        {!lockedRole && role === "client" && (
          <div className="flex flex-none flex-col gap-2 rounded-[18px] bg-[var(--color-brand-tint)] p-3">
            <p className="text-[0.65625rem] font-bold text-[var(--color-ink)]">{t.auth.vendorExtra}</p>
            <div className="flex gap-2">
              {[t.auth.vendorStep1, t.auth.vendorStep2].map((step, index) => (
                <div key={step} className="flex flex-1 flex-col gap-1">
                  <span className="text-[0.6875rem] font-bold text-[var(--color-brand)]">{index + 1}</span>
                  <span className="text-[0.59375rem] leading-[1.35] text-[var(--color-ink)]">{step}</span>
                </div>
              ))}
            </div>
            <p className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">{t.auth.vendorNote}</p>
          </div>
        )}

        <p className="text-center text-[0.6875rem] text-[var(--color-muted)]">
          {t.auth.haveAccount}{" "}
          <Link href="/connexion" className="font-bold text-[var(--color-brand)]">
            {t.auth.signIn}
          </Link>
        </p>

        <p className="text-center text-[0.59375rem] leading-[1.5] text-[var(--color-muted)]">
          {t.auth.legal}
        </p>
      </div>
    </>
  );
}
