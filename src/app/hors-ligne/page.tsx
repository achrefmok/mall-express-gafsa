import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { ButtonLink } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false, follow: false },
};

/** Page de repli servie par le service worker quand le réseau est absent. */
export default async function OfflinePage() {
  const { t } = await getT();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 bg-[var(--color-app)] px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[20px] font-bold text-[var(--color-brand)]">
        ⚡
      </div>
      <h1 className="text-[18px] font-bold text-[var(--color-ink)]">{t.common.offline}</h1>
      <p className="max-w-[34ch] text-[12px] leading-relaxed text-[var(--color-muted)]">
        {t.common.offlineBody}
      </p>
      <ButtonLink href="/accueil" size="sm" className="mt-2">
        {t.nav.home}
      </ButtonLink>
    </div>
  );
}
