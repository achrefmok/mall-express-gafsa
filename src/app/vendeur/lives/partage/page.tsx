import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyShop } from "@/lib/queries";
import { resolveFacebookLiveUrl } from "@/lib/live/facebook";
import { TopBar } from "@/components/shell/top-bar";
import { SharedLiveConfirm } from "./shared-live-confirm";
import { QuickRelay } from "./quick-relay";

export const metadata: Metadata = {
  title: "Passer en direct",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Arrivée d'un partage système.
 *
 * Déclaré comme `share_target` dans le manifeste : le commerçant diffuse sur
 * Facebook, touche « Partager », choisit G-Mall, et atterrit ici avec le
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
  const checked = candidate ? await resolveFacebookLiveUrl(candidate) : null;

  return (
    <>
      <TopBar title="Passer en direct" back="/vendeur/lives" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[14px] pb-6">
        {checked?.ok ? (
          <SharedLiveConfirm
            url={checked.url}
            suggestedTitle={titre?.trim() || ""}
            shopName={shop.name}
            approved={shop.status === "approved"}
          />
        ) : (
          /*
            Deux arrivées sur le même écran : un partage entrant inexploitable,
            ou une visite directe depuis le tableau de bord. Dans les deux cas,
            la suite est la même — d'où un seul composant, qui porte le message
            d'échec quand il y en a un.
          */
          <QuickRelay
            shopName={shop.name}
            approved={shop.status === "approved"}
            initialError={
              checked && !checked.ok
                ? checked.error
                : candidate
                  ? `Ce lien n'a pas été reconnu : ${candidate}`
                  : undefined
            }
          />
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
