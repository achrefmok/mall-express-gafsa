import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { AddAdminForm, MemberCard, MemberSearch } from "./members-client";
import type { AdminMember } from "@/types/database";

export const metadata: Metadata = {
  title: "Membres",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { t, locale } = await getT();
  const me = await getProfile();
  const supabase = await createClient();

  // `admin_members` joint auth.users : c'est le seul moyen d'afficher les
  // adresses, que PostgREST n'expose pas.
  const { data, error } = await supabase.rpc("admin_members", {
    search: q?.trim() || null,
    max_rows: 200,
  });

  const members = (data ?? []) as AdminMember[];
  const admins = members.filter((member) => member.role === "admin");

  return (
    <>
      <TopBar title={t.nav.members} back="/admin" />

      <div className="no-sb flex flex-1 flex-col gap-[10px] overflow-y-auto px-4 pt-2 pb-4 lg:grid lg:grid-cols-2 lg:content-start">
        <div className="lg:col-span-full">
          <AddAdminForm adminCount={admins.length} />
        </div>
        <div className="lg:col-span-full">
          <MemberSearch initial={q ?? ""} />
        </div>

        {error ? (
          <EmptyState
            title="Annuaire indisponible"
            body={
              error.message.includes("admin_members")
                ? "La migration 20260810000700 n'est pas appliquée."
                : error.message
            }
          />
        ) : members.length === 0 ? (
          <EmptyState title={q ? "Aucun résultat" : t.common.empty} />
        ) : (
          members.map((member) => (
            <MemberCard key={member.id} member={member} isMe={member.id === me?.id} locale={locale} />
          ))
        )}
      </div>
    </>
  );
}
