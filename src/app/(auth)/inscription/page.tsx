import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/queries";
import { enabledOAuthProviders } from "@/lib/auth/providers";
import { APP_SPACE, crossSpaceHref } from "@/lib/space";
import { SignUpScreen } from "./sign-up-screen";

export const metadata: Metadata = {
  title: "Créer mon compte",
  description:
    "Rejoignez Mall Express Gafsa en trois minutes — client ou commerçant. Zéro commission les trois premiers mois.",
};

/**
 * L'inscription prend la couleur de l'espace qui la sert.
 *
 * Sur l'hébergement client, on crée un compte d'acheteur ; sur celui du vendeur,
 * on ouvre une boutique. Le choix du rôle disparaît alors : il n'a plus de sens
 * une fois que l'adresse elle-même l'a exprimé, et le laisser permettait de
 * créer un compte client sur le site des commerçants — puis de se demander
 * pourquoi la console reste inaccessible.
 *
 * Sans découpage (`APP_SPACE` à `all`), l'écran garde ses deux choix : un seul
 * hébergement doit continuer de servir tout le monde.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; parrain?: string }>;
}) {
  if (await getSessionUser()) redirect("/accueil");

  const params = await searchParams;

  const forcedRole = APP_SPACE === "vendor" ? "vendor" : APP_SPACE === "client" ? "client" : null;

  const askedForVendor = params.role === "vendeur" || params.role === "vendor";

  return (
    <SignUpScreen
      initialRole={forcedRole ?? (askedForVendor ? "vendor" : "client")}
      lockedRole={forcedRole !== null}
      /*
        Le pont vers l'autre espace.

        Un commerçant qui atterrit sur l'inscription client doit pouvoir
        rejoindre celle des boutiques sans qu'on lui demande de retenir une
        seconde adresse. `null` quand rien n'est découpé : le lien serait alors
        un aller-retour sur place.
      */
      otherSpaceUrl={
        forcedRole === "client"
          ? crossSpaceHref("vendor", "/inscription")
          : forcedRole === "vendor"
            ? crossSpaceHref("client", "/inscription")
            : null
      }
      referralCode={params.parrain}
      providers={await enabledOAuthProviders()}
    />
  );
}
