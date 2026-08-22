import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { ButtonLink, Card, EmptyState, Tag } from "@/components/ui/primitives";
import type { ServiceRequestStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Mes démarches",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function statusTone(status: ServiceRequestStatus): "tinted" | "outline" | "live" {
  if (status === "rejected") return "live";
  if (status === "resolved") return "outline";
  return "tinted";
}

export default async function MyRequestsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion?suite=/profil/demarches");

  const { t, locale } = await getT();
  const supabase = await createClient();

  const [requests, procedures] = await Promise.all([
    supabase
      .from("service_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(40),

    supabase
      .from("city_infos")
      .select("id, title, subtitle")
      .eq("kind", "admin_procedure")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1),
  ]);

  const rows = requests.data ?? [];
  const firstProcedure = procedures.data?.[0];

  const label: Record<ServiceRequestStatus, string> = {
    submitted: t.services.submitted,
    in_review: t.services.inReview,
    resolved: t.services.resolved,
    rejected: t.services.rejected,
  };

  return (
    <>
      <TopBar title={t.services.myRequests} back="/profil" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-4">
        {rows.length === 0 ? (
          <EmptyState
            title={t.common.empty}
            body="Payer une facture ou déposer une réclamation se fait depuis les services citoyens."
            action={
              <ButtonLink
                href={firstProcedure ? `/services/demarche/${firstProcedure.id}` : "/services"}
                size="sm"
                className="mt-1"
              >
                {t.services.newRequest}
              </ButtonLink>
            }
          />
        ) : (
          <>
            <ButtonLink href="/services" tone="outline" size="sm" block>
              {t.services.newRequest}
            </ButtonLink>

            {rows.map((request) => (
              <Card key={request.id} className="flex flex-none flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
                      {request.title}
                    </p>
                    <p className="text-[0.625rem] text-[var(--color-muted)]">
                      {request.kind === "bill_payment" ? "Facture" : "Réclamation"} ·{" "}
                      {formatDateTime(request.created_at, locale)}
                    </p>
                  </div>
                  <Tag tone={statusTone(request.status)}>{label[request.status]}</Tag>
                </div>

                {request.body && (
                  <p className="text-[0.6875rem] leading-[1.5] text-[var(--color-muted)]">
                    {request.body}
                  </p>
                )}

                {request.response && (
                  <p className="rounded-[12px] bg-[var(--color-brand-tint)] p-2 text-[0.6875rem] leading-[1.5] text-[var(--color-ink)]">
                    <b>Réponse : </b>
                    {request.response}
                  </p>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </>
  );
}
