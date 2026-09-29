import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { enabledOAuthProviders } from "@/lib/auth/providers";
import { APP_SPACE } from "@/lib/space";
import { SignUpScreen } from "./sign-up-screen";

export const metadata: Metadata = {
  title: "Créer mon compte",
  description:
    "Rejoignez G-Mall en trois minutes — client ou commerçant. Zéro commission les trois premiers mois.",
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

  /*
    Tant que G-Mall n'est pas ouvert au public, cet écran n'a plus lieu
    d'être : un visiteur n'a rien à faire ici, et un commerçant n'entre que
    par le code que l'administration lui a remis — voir /activer et
    `src/app/actions/activation.ts`. Laisser l'inscription libre pendant la
    préparation reviendrait à ouvrir une seconde porte à côté de celle
    qu'on vient de fermer : n'importe qui pourrait s'inscrire comme
    commerçant sans jamais être passé par l'administration.

    La redirection se décide ici, sur le serveur, avant tout rendu — elle
    tient donc même pour quelqu'un qui tape l'adresse à la main ou qui
    appelle la page sans passer par le bouton « Créer ma boutique ».
  */
  const supabase = await createClient();
  const { data: acces } = await supabase
    .from("app_access")
    .select("public_access")
    .eq("id", true)
    .maybeSingle();

  if (!(acces?.public_access ?? false)) redirect("/activer");

  const forcedRole = APP_SPACE === "vendor" ? "vendor" : APP_SPACE === "client" ? "client" : null;

  const askedForVendor = params.role === "vendeur" || params.role === "vendor";

  return (
    <SignUpScreen
      initialRole={forcedRole ?? (askedForVendor ? "vendor" : "client")}
      lockedRole={forcedRole !== null}
      referralCode={params.parrain}
      providers={await enabledOAuthProviders()}
    />
  );
}
