import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 bg-[var(--color-app)] px-8 text-center">
      <p className="text-[2.5rem] font-bold text-[var(--color-brand)]">404</p>
      <h1 className="text-[1rem] font-bold text-[var(--color-ink)]">{t.common.notFoundTitle}</h1>
      <p className="max-w-[34ch] text-[0.75rem] leading-relaxed text-[var(--color-muted)]">
        {t.common.notFoundBody}
      </p>

      <div className="mt-2 flex gap-2">
        <Link
          href="/accueil"
          className="rounded-[16px] bg-[var(--color-brand-fill)] px-4 py-[10px] text-[0.75rem] font-semibold text-white"
        >
          {t.nav.home}
        </Link>
        <Link
          href="/marketplace"
          className="rounded-[16px] border border-[var(--color-outline)] px-4 py-[10px] text-[0.75rem] font-semibold text-[var(--color-ink)]"
        >
          {t.nav.marketplace}
        </Link>
      </div>
    </div>
  );
}
