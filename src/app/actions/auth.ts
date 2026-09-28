"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { done, fail, ok } from "./_helpers";

/**
 * Origine à utiliser pour les redirections OAuth et les liens de courriel.
 *
 * En production, `NEXT_PUBLIC_SITE_URL` gagne : derrière un proxy, l'en-tête
 * `host` porte souvent un nom interne, inutilisable dans une redirection.
 *
 * En développement, c'est l'hôte réel de la requête qui gagne. La variable y
 * traîne presque toujours un mauvais port — `3001` alors que le serveur écoute
 * sur `3000`, parce qu'une instance précédente occupait la place — et une
 * redirection OAuth vers le mauvais port échoue sans message exploitable.
 */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (host && /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? "http" : "https");
  const fromRequest = host ? `${proto}://${host}` : null;

  if (process.env.NODE_ENV !== "production" && fromRequest) return fromRequest;

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return configured ?? fromRequest ?? "http://localhost:3000";
}

export async function signUp(input: {
  role: "client" | "vendor";
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  shopName?: string;
  shopLocation?: string;
  referralCode?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email.includes("@")) return fail("Adresse e-mail invalide");
  if (password.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères");
  if (!input.firstName.trim()) return fail("Le prénom est obligatoire");

  if (input.role === "vendor") {
    if (!input.shopName?.trim()) return fail("Le nom de la boutique est obligatoire");
    if (!input.shopLocation?.trim()) return fail("Le local au mall ou l'adresse est obligatoire");
  }

  const supabase = await createClient();

  // `role`, `shop_name` et `shop_location` sont lus par le trigger
  // handle_new_user, qui crée le profil et la boutique en attente. Le rôle
  // `admin` y est neutralisé : il ne peut pas être demandé depuis ici.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback`,
      data: {
        role: input.role,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        shop_name: input.shopName?.trim(),
        shop_location: input.shopLocation?.trim(),
        referral_code: input.referralCode?.trim(),
        locale: "fr",
      },
    },
  });

  if (error) {
    switch (error.code) {
      case "user_already_exists":
        return fail("Cette adresse est déjà utilisée");

      case "email_address_invalid":
        return fail("Cette adresse e-mail est refusée. Vérifiez l'orthographe du domaine.");

      /*
        Le mailer intégré de Supabase est plafonné à quelques envois par heure.
        Tant que « Confirm email » est actif, chaque inscription consomme un
        envoi — et au-delà du quota, plus personne ne peut s'inscrire.
        Désactiver la confirmation supprime l'envoi, donc le plafond.
        `npm run db:check` signale le réglage.
      */
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return fail(
          "Trop d'inscriptions en peu de temps sur ce projet Supabase. Réessayez dans une heure, " +
            "ou désactivez « Confirm email » côté Supabase pour supprimer cette limite.",
        );

      default:
        if (error.message.toLowerCase().includes("already registered")) {
          return fail("Cette adresse est déjà utilisée");
        }
        return fail(error.message);
    }
  }

  // Quand la confirmation d'e-mail est active, GoTrue renvoie un utilisateur
  // factice sans identité plutôt qu'une erreur — c'est volontaire, sinon le
  // formulaire dirait qui possède un compte ici.
  if (data.user && data.user.identities?.length === 0) {
    return fail("Cette adresse est déjà utilisée");
  }

  // Confirmation désactivée sur le projet : la session arrive tout de suite.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(input.role === "vendor" ? "/vendeur" : "/");
  }

  // Confirmation encore active côté projet. On la lève ici pour ce compte,
  // puis on ouvre la session : un commerçant de Gafsa ne doit pas rester
  // bloqué derrière une boîte mail. Un vendeur attend l'approbation de
  // l'administration, pas un lien dans un courriel.
  //
  // Contrepartie assumée : plus de preuve que l'adresse appartient bien à la
  // personne. Le réglage propre est côté Supabase — Authentication → Sign In /
  // Providers → décocher « Confirm email » —, ce que `npm run db:check`
  // rappelle. Ce bloc n'est là que pour ne pas dépendre de ce réglage.
  const confirmed = data.user ? await confirmEmailWithServiceKey(data.user.id) : false;

  if (!confirmed) {
    // Ni session, ni clé secrète disponible : on retombe sur le courriel.
    return ok({ email, awaitingEmail: true });
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return ok({ email, awaitingEmail: true });

  revalidatePath("/", "layout");
  redirect(input.role === "vendor" ? "/vendeur" : "/");
}

/**
 * Marque une adresse comme confirmée avec la clé `service_role`.
 * Renvoie `false` si la clé est absente ou refusée — l'appelant retombe alors
 * sur la confirmation par courriel.
 */
async function confirmEmailWithServiceKey(userId: string): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    return !error;
  } catch {
    return false;
  }
}

export async function signIn(email: string, password: string, next?: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) return fail("E-mail ou mot de passe incorrect");

  revalidatePath("/", "layout");

  // Chaque rôle atterrit sur son espace.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destination = next && next.startsWith("/") ? next : "/";
  if (!next && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "vendor") destination = "/vendeur";
    if (profile?.role === "admin") destination = "/admin";
    if (profile?.role === "exhibitor") destination = "/exposant";
    if (profile?.role === "dahmani_admin") destination = "/lelma3ardh/gestion";
  }

  redirect(destination);
}

/**
 * Démarre un flux OAuth.
 *
 * Signature en `(provider, formData)` et retour `void` : c'est le contrat
 * exigé par `<form action={…}>`. Le formulaire porte `next` dans un champ
 * caché, ce qui garde l'authentification fonctionnelle même sans JavaScript.
 */
export async function signInWithProvider(
  provider: "google" | "facebook",
  formData: FormData,
): Promise<void> {
  const supabase = await createClient();
  const base = await origin();

  const next = String(formData.get("suite") ?? "");
  const callback = new URL("/auth/callback", base);
  // Inscription commerçant : le fournisseur ne sait rien de la boutique. Le
  // retour d'OAuth s'en souvient et mène à la création de boutique.
  if (formData.get("role") === "vendor") callback.searchParams.set("role", "vendor");
  if (next.startsWith("/") && !next.startsWith("//")) {
    callback.searchParams.set("suite", next);
  }

  /*
    Permissions demandées.

    Supabase n'envoie que `email` à Facebook. Meta attend la paire
    `public_profile,email` : `public_profile` porte le nom et la photo, et
    certaines configurations d'application refusent un dialogue qui demande
    `email` seul. Le nommer explicitement ne coûte rien et lève cette ambiguïté.

    Ne rien demander de plus : chaque permission supplémentaire passe par la
    revue de Meta, et une permission non accordée fait échouer tout le dialogue.
  */
  const scopes = provider === "facebook" ? "public_profile,email" : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString(), scopes },
  });

  if (error || !data.url) {
    const back = new URL("/connexion", base);

    /*
      Le cas de loin le plus fréquent : le fournisseur n'est pas activé côté
      Supabase — il faut y coller un identifiant client et un secret. Le
      message brut de GoTrue (« Unsupported provider: provider is not enabled »)
      ne dit rien à un visiteur, et laisse l'exploitant chercher.
    */
    const disabled =
      error?.code === "validation_failed" ||
      /unsupported provider|not enabled/i.test(error?.message ?? "");

    back.searchParams.set(
      "erreur",
      disabled
        ? `La connexion via ${provider === "google" ? "Google" : "Facebook"} n'est pas encore activée. Utilisez votre e-mail et votre mot de passe.`
        : (error?.message ?? "Redirection impossible"),
    );
    redirect(back.toString());
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    // Atterrissage sur les réglages : le champ « nouveau mot de passe » y est
    // déjà, et la session vient d'être ouverte par le callback.
    redirectTo: `${await origin()}/auth/callback?suite=/profil/reglages`,
  });

  // Réponse identique que l'adresse existe ou non : sinon le formulaire
  // devient un révélateur de comptes.
  if (error && !error.message.includes("not found")) return fail(error.message);
  return done();
}

export async function updatePassword(password: string) {
  if (password.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return fail(error.message);
  return done();
}
