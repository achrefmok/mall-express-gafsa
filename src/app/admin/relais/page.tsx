import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { timeAgo } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, SectionTitle, Tag } from "@/components/ui/primitives";
import type { AppLocale } from "@/types/database";

export const metadata: Metadata = {
  title: "Relais Facebook",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Contrôle humain des directs Facebook relayés.
 *
 * Pourquoi cet écran existe
 * ─────────────────────────
 * Un direct Facebook arrive par l'un de deux chemins, et un seul prouve que la
 * vidéo appartient au commerçant :
 *
 *   · page connectée — la vidéo est lue par `{pageId}/live_videos` avec le
 *     jeton de la page. La propriété est acquise par construction : ce jeton
 *     n'ouvre que les pages que le commerçant administre.
 *
 *   · adresse collée — le commerçant colle un lien, ou le partage depuis le
 *     système. Rien ne prouve que la vidéo est la sienne : n'importe quel
 *     direct public de Facebook est acceptable, y compris celui d'un média.
 *
 * Le second chemin n'est pas une négligence. Il sert le commerçant qui diffuse
 * depuis son profil personnel, et pour un profil la Graph API n'expose rien —
 * mesuré : toute lecture d'une vidéo non possédée est refusée en `code 100`,
 * même avec un jeton d'application valide. Aucune vérification automatique
 * n'est donc possible dans ce cas, par aucun moyen.
 *
 * Le choix retenu est de ne rien bloquer — un vendeur en pleine vente ne doit
 * pas buter sur un refus — et de rendre la distinction visible ici. C'est
 * `facebook_video_id` qui la porte : renseigné par le chemin vérifié, laissé
 * vide par un collage manuel. La colonne existait déjà.
 */
export default async function AdminRelaysPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: lives } = await supabase
    .from("lives")
    .select("id, title, status, facebook_url, facebook_video_id, created_at, shop:shops!inner(name, slug)")
    .eq("source", "facebook")
    .order("created_at", { ascending: false })
    .limit(80);

  const rows = lives ?? [];
  const toReview = rows.filter((live) => !live.facebook_video_id);
  const verified = rows.filter((live) => live.facebook_video_id);

  return (
    <>
      <TopBar title="Relais Facebook" back="/admin/reglages" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
        {rows.length === 0 ? (
          <EmptyState title={t.common.empty} body="Aucun direct Facebook relayé pour l'instant." />
        ) : (
          <>
            <section className="flex flex-none flex-col gap-2">
              <SectionTitle>À contrôler — {toReview.length}</SectionTitle>
              <p className="text-[10.5px] leading-relaxed text-[var(--color-muted)]">
                Adresses collées à la main. La propriété de la vidéo n&apos;est pas prouvée : ouvrez
                le lien et vérifiez qu&apos;il s&apos;agit bien de la page ou du profil du
                commerçant.
              </p>

              {toReview.length === 0 ? (
                <p className="text-[11px] text-[var(--color-muted)]">
                  Rien à contrôler : tous les relais viennent d&apos;une page connectée.
                </p>
              ) : (
                toReview.map((live) => (
                  <RelayRow key={live.id} live={live} locale={locale} needsReview />
                ))
              )}
            </section>

            <section className="flex flex-none flex-col gap-2">
              <SectionTitle>Vérifiés par la page connectée — {verified.length}</SectionTitle>
              {verified.length === 0 ? (
                <p className="text-[11px] text-[var(--color-muted)]">
                  Aucune boutique n&apos;a encore connecté sa page Facebook.
                </p>
              ) : (
                verified.map((live) => <RelayRow key={live.id} live={live} locale={locale} />)
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

/** Une ligne de relais. Le lien s'ouvre sur Facebook, seul endroit où trancher. */
function RelayRow({
  live,
  locale,
  needsReview,
}: {
  live: {
    id: string;
    title: string;
    status: string;
    facebook_url: string | null;
    created_at: string;
    shop: { name: string; slug: string } | null;
  };
  locale: AppLocale;
  needsReview?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-[6px] p-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <p className="truncate text-[12px] font-bold text-[var(--color-ink)]">
            {live.shop?.name ?? "Boutique inconnue"}
          </p>
          <p className="truncate text-[10.5px] text-[var(--color-muted)]">
            « {live.title} » · {live.status} · {timeAgo(live.created_at, locale)}
          </p>
        </div>
        <Tag tone={needsReview ? "live" : "tinted"}>{needsReview ? "à contrôler" : "vérifié"}</Tag>
      </div>

      {live.facebook_url && (
        /*
          `rel="noreferrer"` autant que `noopener` : l'adresse d'un écran
          d'administration n'a pas à partir chez Facebook en en-tête `Referer`.
        */
        <a
          href={live.facebook_url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-[10px] text-[var(--color-brand)] underline"
        >
          {live.facebook_url}
        </a>
      )}
    </Card>
  );
}
