import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 bg-[var(--color-app)] px-8 text-center">
      <p className="text-[40px] font-bold text-[var(--color-brand)]">404</p>
      <h1 className="text-[16px] font-bold text-[var(--color-ink)]">Page introuvable</h1>
      <p className="max-w-[34ch] text-[12px] leading-relaxed text-[var(--color-muted)]">
        Cette page n&apos;existe pas ou n&apos;est plus disponible.
      </p>

      <div className="mt-2 flex gap-2">
        <Link
          href="/accueil"
          className="rounded-[16px] bg-[var(--color-brand)] px-4 py-[10px] text-[12px] font-semibold text-white"
        >
          {t.nav.home}
        </Link>
        <Link
          href="/marketplace"
          className="rounded-[16px] border border-[var(--color-outline)] px-4 py-[10px] text-[12px] font-semibold text-[var(--color-ink)]"
        >
          {t.nav.marketplace}
        </Link>
      </div>
    </div>
  );
}
