import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/ui/primitives";
import {
  ExpositionClient,
  type EditionAffichee,
  type ExposantAffiche,
  type ProduitAffiche,
} from "./exposition-client";

export const metadata: Metadata = {
  title: "Société Dahmani — Lelma3ardh",
  description:
    "Les exposants de Société Dahmani à Gafsa : leurs stands, leurs produits et leurs prix, consultables même après la fin de l'exposition.",
};

export const dynamic = "force-dynamic";

/**
 * Lelma3ardh — l'exposition qui ne ferme pas.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que cette page corrige
 * ────────────────────────────────────────────────────────────────────────
 *
 * Une exposition dure cinq jours. Celui qui n'est pas passé n'a rien vu ;
 * celui qui est passé a oublié le nom du stand où il avait repéré quelque
 * chose. Tout le travail d'un exposant — installer, présenter, expliquer —
 * s'évapore à la fermeture des portes. Ici, le stand devient une page qui
 * reste.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Deux façons d'entrer, parce qu'on ne cherche pas tous la même chose
 * ────────────────────────────────────────────────────────────────────────
 *
 * Par les stands, pour qui a un nom en tête ou veut flâner ; par les produits,
 * pour qui cherche un tapis et se moque de savoir chez qui. Dans un marché
 * réel, la seconde entrée n'existe pas : il faut passer devant chaque étal.
 * C'est la seule chose que le numérique fait mieux qu'une allée, et ce serait
 * dommage de ne pas la donner.
 *
 * La recherche filtre les deux vues à la fois, sur le nom du produit comme
 * sur celui du stand : quelqu'un qui tape « dattes » ne sait pas si c'est un
 * produit ou une enseigne, et n'a pas à le savoir.
 */
export default async function Lelma3ardhPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { vue } = await searchParams;
  const { locale } = await getT();
  const supabase = await createClient();

  const [expos, exposants, produits, profile] = await Promise.all([
    supabase
      .from("expos")
      .select("id, slug, name, name_ar, description, description_ar, place, cover_url, starts_on, ends_on")
      .eq("is_published", true)
      .order("starts_on", { ascending: false })
      .limit(10),

    supabase
      .from("expo_exhibitors")
      .select("id, expo_id, slug, name, name_ar, description, description_ar, logo_url, cover_url, stand_no, images")
      .eq("status", "approved")
      .order("name")
      .limit(200),

    supabase
      .from("expo_products")
      .select("id, exhibitor_id, name, name_ar, images, price, compare_at_price, is_available")
      .order("position")
      .limit(600),

    getProfile(),
  ]);

  const peutGerer = profile?.role === "dahmani_admin" || profile?.role === "admin";

  return (
    <>
      <TopBar title="Lelma3ardh" back="/accueil" />

      {(expos.data ?? []).length === 0 ? (
        <div className="col-reading flex flex-1 flex-col gap-3 px-4 pt-4">
          <EmptyState
            title="Aucune exposition"
            body="Les éditions et leurs exposants apparaîtront ici."
          />
          {peutGerer && (
            <Link
              href="/lelma3ardh/gestion"
              className="rounded-full bg-[#8a5a1f] py-[10px] text-center text-[0.71875rem] font-bold text-white"
            >
              Créer la première édition
            </Link>
          )}
        </div>
      ) : (
        <ExpositionClient
          editions={(expos.data ?? []) as unknown as EditionAffichee[]}
          exposants={(exposants.data ?? []) as unknown as ExposantAffiche[]}
          produits={(produits.data ?? []) as unknown as ProduitAffiche[]}
          locale={locale}
          vueInitiale={vue === "produits" ? "produits" : "stands"}
          peutGerer={peutGerer}
        />
      )}
    </>
  );
}
