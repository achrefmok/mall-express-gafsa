import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyShop } from "@/lib/queries";
import { normalizeFacebookLiveUrl } from "@/lib/live/facebook";
import { TopBar } from "@/components/shell/top-bar";
import { Card } from "@/components/ui/primitives";
import { SharedLiveConfirm } from "./shared-live-confirm";

export const metadata: Metadata = {
  title: "Relayer ce direct",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Arrivée d'un partage système.
 *
 * Déclaré comme `share_target` dans le manifeste : le commerçant diffuse sur
 * Facebook, touche « Partager », choisit Mall Express, et atterrit ici avec le
 * lien déjà transmis. Un bouton, et le direct est en ligne.
 *
 * Facebook ne place pas toujours l'adresse dans le même paramètre — parfois
 * dans `url`, parfois noyée dans le texte partagé. On cherche donc dans les
 * deux.
 */
export default async function ShareTargetPage({
  searchParams,
}: {
  searchParams: Promise<{ lien?: string; texte?: string; titre?: string }>;
}) {
  const shop = await getMyShop();
  if (!shop) redirect("/vendeur/creer");

  const { lien, texte, titre } = await searchParams;
  const candidate = firstFacebookUrl(lien) ?? firstFacebookUrl(texte);
  const checked = candidate ? normalizeFacebookLiveUrl(candidate) : null;

  return (
    <>
      <TopBar title="Relayer ce direct" back="/vendeur/lives" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[14px] pb-6">
        {checked?.ok ? (
          <SharedLiveConfirm
            url={checked.url}
            suggestedTitle={titre?.trim() || ""}
            shopName={shop.name}
            approved={shop.status === "approved"}
          />
        ) : (
          <Card className="flex flex-col gap-3 p-4">
            <p className="text-[13px] font-bold text-[var(--color-ink)]">
              Ce partage ne contient pas de lien de vidéo Facebook
            </p>

            <p className="text-[12px] leading-[1.6] text-[var(--color-muted)]">
              {checked && !checked.ok
                ? checked.error
                : "Rien d'exploitable n'est arrivé. Depuis Facebook, partagez la vidéo elle-même — pas votre page ni votre profil."}
            </p>

            {candidate && (
              <p className="rounded-[12px] bg-[var(--color-brand-tint)] p-2 text-[10.5px] break-all text-[var(--color-muted)]">
                Reçu : {candidate}
              </p>
            )}

            <Link
              href="/vendeur/lives/nouveau"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[16px] bg-[var(--color-brand)] px-4 text-[12.5px] font-bold text-white"
            >
              Programmer un direct à la main
            </Link>
          </Card>
        )}
      </div>
    </>
  );
}

/**
 * Première adresse Facebook trouvée dans une chaîne.
 *
 * Le texte partagé par Facebook mêle souvent une légende et l'adresse ; on
 * extrait donc plutôt que de supposer que le paramètre ne contient qu'une URL.
 */
function firstFacebookUrl(value: string | undefined): string | null {
  if (!value) return null;

  const match = /https?:\/\/[^\s]*facebook\.com[^\s]*/i.exec(value) ?? /https?:\/\/fb\.watch[^\s]*/i.exec(value);
  return match?.[0] ?? null;
}
