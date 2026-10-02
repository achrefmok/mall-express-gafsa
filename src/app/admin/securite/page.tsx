import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { fullName, timeAgo } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Card, EmptyState, SectionTitle, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Sécurité",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MIGRATION_ABSENTE = ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"];

/**
 * Surveillance, pas détection d'intrusion.
 *
 * L'app n'a ni scan de fichier ni pare-feu applicatif — rien de tel n'a de
 * sens pour un catalogue de boutiques. Ce que cet écran rassemble, ce sont
 * des signaux réels, calculés depuis les données existantes :
 *
 *   · un rôle changé récemment (`role_changes`, journal tenu par
 *     `setMemberRole`) — un compte promu administrateur mérite un regard,
 *     que ce soit l'administration elle-même ou quelqu'un d'autre ;
 *   · une boutique approuvée puis dont le catalogue change en masse dans
 *     l'heure qui suit — le genre de pic qu'un compte détourné produirait,
 *     une vraie boutique remplissant son catalogue sur plusieurs jours ;
 *   · les files d'attente qui dépassent un délai raisonnable — une boutique
 *     en attente depuis plus de 3 jours, un signalement ouvert depuis plus
 *     de 48 h : moins une menace qu'une « action requise » qu'on risque
 *     d'oublier au milieu du reste.
 *
 * Rien n'est inventé : pas de score de risque, pas de probabilité — des
 * compteurs et des dates, that's it.
 */
export default async function AdminSecurityPage() {
  const { locale } = await getT();
  const supabase = await createClient();
  // `role_changes` n'existe pas encore dans les types générés tant que la
  // migration n'est pas collée (même raison que `product_packs` ailleurs) :
  // client non typé pour cette seule table.
  const client = supabase as unknown as SupabaseClient;

  const [roleChanges, pendingShops, openReports, approvedShops] = await Promise.all([
    client
      .from("role_changes")
      .select(
        "id, previous_role, new_role, created_at, target:profiles!role_changes_target_id_fkey(first_name, last_name), author:profiles!role_changes_changed_by_fkey(first_name, last_name)",
      )
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("shops")
      .select("id, name, submitted_at")
      .eq("status", "pending")
      .lt("submitted_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
      .order("submitted_at")
      .limit(20),

    supabase
      .from("reports")
      .select("id, target_type, reason, created_at")
      .eq("status", "open")
      .lt("created_at", new Date(Date.now() - 48 * 3_600_000).toISOString())
      .order("created_at")
      .limit(20),

    // Fenêtre large : le filtrage « édité en masse juste après » se fait en
    // mémoire ci-dessous, une seule requête produits par boutique serait
    // bien plus coûteuse que cette unique lecture groupée.
    supabase
      .from("shops")
      .select("id, name, approved_at, products:products(updated_at)")
      .eq("status", "approved")
      .not("approved_at", "is", null)
      .gte("approved_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .limit(200),
  ]);

  const erreurJournal = roleChanges.error && !MIGRATION_ABSENTE.includes(roleChanges.error.code ?? "");

  // Boutique approuvée puis au moins 5 produits modifiés dans l'heure qui suit.
  const boutiquesSuspectes = (approvedShops.data ?? [])
    .map((shop) => {
      const approuveeLe = new Date(shop.approved_at!).getTime();
      const editionsRapides = (shop.products ?? []).filter((p) => {
        const delta = new Date(p.updated_at).getTime() - approuveeLe;
        return delta >= 0 && delta < 3_600_000;
      }).length;
      return { id: shop.id, name: shop.name, editionsRapides };
    })
    .filter((s) => s.editionsRapides >= 5);

  const rien =
    (roleChanges.data ?? []).length === 0 &&
    (pendingShops.data ?? []).length === 0 &&
    (openReports.data ?? []).length === 0 &&
    boutiquesSuspectes.length === 0;

  return (
    <>
      <TopBar title="Sécurité" back="/admin" />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
        {rien && !erreurJournal && <EmptyState title="Rien à signaler" />}

        {boutiquesSuspectes.length > 0 && (
          <section className="flex flex-none flex-col gap-2">
            <SectionTitle>Catalogue modifié en masse après approbation</SectionTitle>
            {boutiquesSuspectes.map((s) => (
              <Card key={s.id} className="flex items-center justify-between gap-2 p-3">
                <Link href={`/admin/boutiques/${s.id}`} className="min-w-0 flex-1 truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
                  {s.name}
                </Link>
                <Tag tone="live">{s.editionsRapides} produits modifiés en moins d&apos;1 h</Tag>
              </Card>
            ))}
          </section>
        )}

        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Changements de rôle récents</SectionTitle>
          {erreurJournal ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">Journal indisponible.</p>
          ) : (roleChanges.data ?? []).length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">Aucun changement enregistré.</p>
          ) : (
            (roleChanges.data ?? []).map((r) => {
              const target = r.target as unknown as { first_name: string | null; last_name: string | null } | null;
              const author = r.author as unknown as { first_name: string | null; last_name: string | null } | null;
              return (
                <Card key={r.id} className="flex flex-col gap-[2px] p-3">
                  <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">
                    {fullName(target) || "Compte supprimé"} · {r.previous_role} → {r.new_role}
                  </p>
                  <p className="text-[0.625rem] text-[var(--color-muted)]">
                    {timeAgo(r.created_at, locale)} par {fullName(author) || "—"}
                  </p>
                </Card>
              );
            })
          )}
        </section>

        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Boutiques en attente depuis plus de 3 jours</SectionTitle>
          {(pendingShops.data ?? []).length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">Aucune.</p>
          ) : (
            (pendingShops.data ?? []).map((s) => (
              <Card key={s.id} className="flex items-center justify-between gap-2 p-3">
                <span className="min-w-0 flex-1 truncate text-[0.75rem] font-bold text-[var(--color-ink)]">{s.name}</span>
                <span className="flex-none text-[0.625rem] text-[var(--color-muted)]">{timeAgo(s.submitted_at, locale)}</span>
              </Card>
            ))
          )}
        </section>

        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Signalements ouverts depuis plus de 48 h</SectionTitle>
          {(openReports.data ?? []).length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">Aucun.</p>
          ) : (
            (openReports.data ?? []).map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-2 p-3">
                <span className="min-w-0 flex-1 truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
                  {r.target_type} {r.reason ? `— ${r.reason}` : ""}
                </span>
                <span className="flex-none text-[0.625rem] text-[var(--color-muted)]">{timeAgo(r.created_at, locale)}</span>
              </Card>
            ))
          )}
        </section>
      </div>
    </>
  );
}
