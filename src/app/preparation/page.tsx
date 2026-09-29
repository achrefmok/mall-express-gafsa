import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { lireLogo } from "@/lib/brand";
import { LanguageToggle } from "@/components/shell/language-toggle";
import { InstallGuide } from "@/components/pwa/install-guide";
import { ChevronRightIcon } from "@/components/ui/icons";

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
 * Ce n'est pas un mur : c'est la porte d'entrée des commerçants. Le titre
 * s'adresse directement à eux — ce n'est plus « l'application est en
 * travaux », mais « préparez votre lancement » — puis les trois pas qui
 * mènent du code reçu de l'administration jusqu'à la boutique prête à
 * ouvrir, en passant par l'installation de l'application, pendant que le
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
      {/*
        Le décor a gagné un peu de vie — deux nappes qui dérivent doucement
        (`animate-float`, déjà utilisée ailleurs dans l'app) plutôt que figées
        — et une troisième, plus chaude, qui rappelle la vitrine plutôt que
        l'attente. Toujours `aria-hidden`, toujours sous le seuil où une
        texture devient un objet qu'on cherche à nommer.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-float absolute -top-24 -end-20 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_68%)]" />
        <div
          className="animate-float absolute -bottom-28 -start-24 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,170,60,0.16),transparent_68%)]"
          style={{ animationDelay: "-3.5s" }}
        />
        <div
          className="animate-float absolute top-[38%] start-1/2 h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.07),transparent_70%)]"
          style={{ animationDelay: "-1.5s" }}
        />
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
        <section className="animate-slide-up flex flex-col items-center gap-3 pt-2 text-center">
          {/*
            Le cadre du logo, désormais dans un anneau dégradé qui tourne
            lentement derrière lui — un halo de vitrine, pas un chargement :
            assez lent pour ne jamais se lire comme une attente.
          */}
          <span className="relative flex h-[92px] w-[92px] items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-[-10px] rounded-[30px] opacity-70 blur-[2px]"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(255,255,255,0.55), rgba(255,170,60,0.35), transparent 55%, rgba(255,255,255,0.35))",
                animation: "spin 14s linear infinite",
              }}
            />
            <span className="relative flex h-full w-full items-center justify-center rounded-[26px] bg-white/14 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/25">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo de la marque, servi tel quel */}
              <img
                src={logo ?? "/brand/app-icon.png"}
                alt=""
                width={68}
                height={68}
                className="h-full w-full object-contain"
              />
            </span>
          </span>

          <span className="rounded-full bg-white/16 px-3 py-[5px] text-[0.6875rem] font-bold ring-1 ring-white/25">
            {t.launchPage.badge}
          </span>

          <p className="text-[0.9375rem] font-semibold text-white/90">{t.launchPage.welcome}</p>

          <h1 className="max-w-[360px] text-[1.5rem] leading-[1.35] font-extrabold tracking-[-0.01em]">
            {t.launchPage.whyTitle}
          </h1>
          <p className="max-w-[360px] text-[0.8125rem] leading-[1.5] text-white/70">{t.launchPage.tagline}</p>
        </section>

        {/* ─── Trois pas, en ligne du temps ───────────────────────────── */}
        <section className="flex flex-col gap-4 rounded-[24px] bg-white/12 p-4 ring-1 ring-white/20">
          <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-white/60 uppercase">
            {t.launchPage.stepsEyebrow}
          </p>

          <div className="relative flex flex-col gap-4 ps-[2px]">
            {/*
              La ligne qui relie les trois étapes : un dégradé vertical, pas
              un simple trait — elle s'efface après le dernier point plutôt
              que de s'arrêter net.
            */}
            <span
              aria-hidden
              className="absolute top-[13px] bottom-[13px] start-[13px] w-px bg-gradient-to-b from-white/50 via-white/25 to-transparent"
            />
            {steps.map((step, index) => (
              <div key={step.title} className="relative flex items-start gap-3">
                <span className="relative z-10 mt-[1px] flex h-[27px] w-[27px] flex-none items-center justify-center rounded-full bg-white text-[0.75rem] font-extrabold text-[var(--color-brand)] shadow-[0_3px_10px_rgba(0,0,0,0.25)]">
                  {index + 1}
                </span>
                <span className="flex flex-col gap-[3px] pt-[2px]">
                  <span className="text-[0.84375rem] font-bold">{step.title}</span>
                  <span className="text-[0.71875rem] leading-[1.55] text-white/75">{step.body}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-1 flex flex-col gap-2">
            {/*
              Tant que l'accès public est fermé, il n'y a plus d'inscription
              libre : `/inscription` redirige elle-même vers `/activer` (voir
              cette page et `signUp()`, qui referment la porte encore une
              fois côté serveur si jamais quelqu'un appelait directement
              l'action). Le bouton mène donc ici tout de suite, plutôt que de
              faire décrire un détour à quelqu'un qui, de toute façon, tient
              déjà son code en main.
            */}
            <Link
              href="/activer"
              className="press flex w-full items-center justify-center gap-1 rounded-[16px] bg-white py-3 text-center text-[0.8125rem] font-bold text-[var(--color-brand)] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
            >
              {t.launchPage.createShop}
              <ChevronRightIcon size={15} className="rtl:rotate-180" />
            </Link>
            <Link
              href="/connexion"
              className="press w-full rounded-[16px] py-3 text-center text-[0.8125rem] font-bold text-white ring-1 ring-white/40"
            >
              {t.launchPage.haveAccount}
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
