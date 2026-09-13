import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { numeroAppelable } from "@/lib/phone";
import { whatsAppHref } from "@/lib/contact";
import { TopBar } from "@/components/shell/top-bar";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.louage.title, description: t.louage.metaDescription };
}

/*
  Cinq minutes de cache : la liste des louages change quand l'administration
  la modifie, pas à chaque visite.
*/
export const revalidate = 300;

/**
 * Les louages, en accès direct.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi cette page existe
 * ────────────────────────────────────────────────────────────────────────
 *
 * La pastille « Louage » de l'accueil menait à `/services#louage`. Or la page
 * des services **n'affichait pas** les louages — seulement les prières, les
 * pharmacies et les démarches. Le raccourci atterrissait donc en haut d'une
 * page qui ne contenait pas ce qu'on cherchait, sans ancre à rejoindre.
 *
 * Un clic, et l'on voit les louages et leurs numéros. C'est tout.
 */
export default async function PageLouage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data } = await supabase
    .from("practical_services")
    .select("id, name, name_ar, phone, address, info")
    .eq("kind", "louage")
    .eq("is_active", true)
    .order("sort_order");

  const louages = data ?? [];

  return (
    <>
      <TopBar title={t.louage.title} back="/accueil" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
        <p className="text-[0.8125rem] leading-[1.5] text-[var(--color-muted)]">{t.louage.intro}</p>

        {louages.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-[var(--color-outline)] p-5 text-center text-[0.8125rem] text-[var(--color-muted)]">
            {t.louage.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {louages.map((l) => {
              const nom = locale === "ar" && l.name_ar ? l.name_ar : l.name;
              const wa = whatsAppHref(l.phone, format(t.louage.whatsappMessage, { name: nom }));

              return (
                <li
                  key={l.id}
                  className="flex flex-col gap-3 rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[1.125rem]">
                      🚐
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{nom}</p>
                      {l.info && <p className="mt-[2px] text-[0.75rem] text-[var(--color-muted)]">{l.info}</p>}
                      {l.address && <p className="mt-[2px] text-[0.6875rem] text-[var(--color-faint)]">{l.address}</p>}
                    </div>
                  </div>

                  {l.phone && (
                    <div className="flex gap-2">
                      <a
                        href={`tel:${numeroAppelable(l.phone)}`}
                        className="press flex min-h-11 flex-1 items-center justify-center rounded-[12px] bg-[var(--color-brand-fill)] text-[0.8125rem] font-bold text-white"
                      >
                        📞 {t.taxi.call}
                      </a>
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="press flex min-h-11 flex-1 items-center justify-center rounded-[12px] bg-[#e6f4ea] text-[0.8125rem] font-bold text-[#0f7a3d]"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
