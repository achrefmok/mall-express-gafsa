import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { ProcedureForm } from "./procedure-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("city_infos").select("title").eq("id", id).maybeSingle();

  return {
    title: data?.title ?? "Démarche",
    robots: { index: false, follow: false },
  };
}

export default async function ProcedurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale } = await getT();
  const supabase = await createClient();

  const { data: procedure } = await supabase
    .from("city_infos")
    .select("*")
    .eq("id", id)
    .eq("kind", "admin_procedure")
    .maybeSingle();

  if (!procedure) notFound();

  const user = await getSessionUser();

  // Le libellé sert à deviner la nature de la démarche : une facture se
  // règle, une réclamation se dépose. Rien d'autre ne les distingue en base.
  const kind = /factur|paiement|payer/i.test(procedure.title) ? "bill_payment" : "complaint";

  return (
    <ProcedureForm
      procedure={{
        id: procedure.id,
        title: locale === "ar" && procedure.title_ar ? procedure.title_ar : procedure.title,
        subtitle:
          locale === "ar" && procedure.subtitle_ar ? procedure.subtitle_ar : procedure.subtitle,
        body: procedure.body,
        hue: procedure.hue,
        monogram: procedure.monogram,
      }}
      kind={kind}
      signedIn={Boolean(user)}
    />
  );
}
