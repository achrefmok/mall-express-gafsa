import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { lireLogo } from "@/lib/brand";
import { LanguageToggle } from "@/components/shell/language-toggle";
import { InstallGuide } from "@/components/pwa/install-guide";

export const metadata: Metadata = {
  title: "G-Mall — en préparation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * La seule page qu'un visiteur ou un compte client peut atteindre tant que
 * `app_access.public_access` vaut faux — voir `src/lib/supabase/middleware.ts`,
 * qui y redirige avant même la garde de rôle habituelle.
 *
 * Volontairement hors de la coque cliente : un visiteur qu'on refuse
 * d'accueillir n'a pas à voir la barre d'onglets d'une application à
 * laquelle il n'entre pas.
 *
 * Ce n'est pas un mur : c'est la porte d'entrée des commerçants. La page dit
 * ce qui arrive, montre en trois pas comment s'y préparer, et propose
 * d'installer l'application dès maintenant — c'est le seul moment où un
 * commerçant a le temps de le faire calmement.
 *
 * L'arabe s'affiche d'abord (langue par défaut de l'application), le français
 * est à un toucher.
 */
export default async function PreparationPage() {
  const [{ t }, logo] = await Promise.all([getT(), lireLogo()]);

  const steps = [
    { title: t.launchPage.step1Title, body: t.launchPage.step1Body },
    { title: t.launchPage.step2Title, body: t.launchPage.step2Body },
    { title: t.launchPage.step3Title, body: t.launchPage.step3Body },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[image:var(--gradient-brand)] text-white">
      {/* Deux nappes de lumière, à peine visibles : de la profondeur, pas un motif. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -end-20 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_68%)]" />
        <div className="absolute -bottom-28 -start-24 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,170,60,0.16),transparent_68%)]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-5 px-5 pt-5 pb-10">
        {/* ─── En-tête : la langue, à portée de pouce ─────────────────── */}
        <div className="flex items-center justify-between">
          <p className="text-[1.125rem] font-extrabold tracking-[-0.02em]">
            {t.brand.first}
            {t.brand.second}
          </p>
          <LanguageToggle sombre />
        </div>

        {/* ─── Ce qui arrive ──────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex h-[92px] w-[92px] items-center justify-center rounded-[26px] bg-white/14 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/25">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo de la marque, servi tel quel */}
            <img
              src={logo ?? "/brand/app-icon.png"}
              alt=""
              width={68}
              height={68}
              className="h-full w-full object-contain"
            />
          </span>

          <span className="rounded-full bg-white/16 px-3 py-[5px] text-[0.6875rem] font-bold ring-1 ring-white/25">
            {t.launchPage.badge}
          </span>

          <h1 className="max-w-[360px] text-[1.375rem] leading-[1.35] font-extrabold">{t.preparation.title}</h1>
          <p className="max-w-[360px] text-[0.875rem] leading-[1.55] text-white/85">{t.preparation.body}</p>
          <p className="max-w-[360px] text-[0.75rem] leading-[1.5] text-white/70">{t.launchPage.tagline}</p>
        </section>

        {/* ─── Trois pas pour un commerçant ───────────────────────────── */}
        <section className="flex flex-col gap-3 rounded-[24px] bg-white/12 p-4 ring-1 ring-white/20">
          <h2 className="text-[0.9375rem] font-extrabold">{t.launchPage.whyTitle}</h2>

          <ol className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white text-[0.8125rem] font-extrabold text-[var(--color-brand)]">
                  {index + 1}
                </span>
                <span className="flex flex-col gap-[2px]">
                  <span className="text-[0.8125rem] font-bold">{step.title}</span>
                  <span className="text-[0.71875rem] leading-[1.5] text-white/75">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-1 flex flex-col gap-2">
            <Link
              href="/inscription"
              className="press w-full rounded-[16px] bg-white py-3 text-center text-[0.8125rem] font-bold text-[var(--color-brand)]"
            >
              {t.launchPage.createShop}
            </Link>
            <Link
              href="/connexion"
              className="press w-full rounded-[16px] py-3 text-center text-[0.8125rem] font-bold text-white ring-1 ring-white/40"
            >
              {t.launchPage.haveAccount}
            </Link>
            {/*
              Un code reçu de l'administration : la boutique existe déjà,
              il ne reste qu'à l'activer. Voir src/app/actions/activation.ts.
            */}
            <Link
              href="/activer"
              className="press w-full py-2 text-center text-[0.71875rem] font-semibold text-white/70 underline underline-offset-2"
            >
              {t.launchPage.haveCode}
            </Link>
          </div>
        </section>

        {/* ─── Installer l'application ────────────────────────────────── */}
        <section className="flex flex-col gap-3 rounded-[24px] bg-white/12 p-4 ring-1 ring-white/20">
          <div>
            <h2 className="text-[0.9375rem] font-extrabold">{t.launchPage.installTitle}</h2>
            <p className="mt-1 text-[0.71875rem] leading-[1.5] text-white/75">{t.launchPage.installBody}</p>
          </div>
          <InstallGuide tone="dark" />
        </section>

        <p className="text-center text-[0.65625rem] leading-[1.5] text-white/60">{t.launchPage.footnote}</p>
      </div>
    </div>
  );
}
