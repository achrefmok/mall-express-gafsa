import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

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
 */
export default async function PreparationPage() {
  const { t } = await getT();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[image:var(--gradient-brand)] px-6 text-center text-white">
      <p className="text-[1.5rem] font-extrabold tracking-[-0.02em]">
        {t.brand.first}
        {t.brand.second}
      </p>

      <div className="flex max-w-[440px] flex-col gap-2">
        <h1 className="text-[1.125rem] leading-[1.4] font-bold">{t.preparation.title}</h1>
        <p className="text-[0.875rem] leading-[1.5] text-white/80">{t.preparation.body}</p>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-[0.75rem] text-white/70">{t.preparation.vendorLink}</p>
        <Link
          href="/connexion"
          className="rounded-full bg-white px-6 py-[10px] text-[0.8125rem] font-bold text-[var(--color-brand)]"
        >
          {t.preparation.signIn}
        </Link>
      </div>
    </div>
  );
}
