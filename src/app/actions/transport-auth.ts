"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { fail, ok } from "./_helpers";

/**
 * Connexion et inscription de « Taxi & Louage Gafsa » (src/lib/transport.ts).
 *
 * L'application est ouverte à tous dès maintenant (décision du 2026-10-15),
 * même pendant la préparation de G-Mall : cette inscription ne lit donc pas
 * `app_access`. Elle ne crée jamais qu'un compte **client** — aucun champ
 * boutique, aucun rôle vendeur : elle n'ouvre aucune porte vers l'espace
 * commerçant que la préparation garde fermé. Être chauffeur n'est pas un
 * rôle mais une ligne dans `taxi_drivers`, créée ensuite par le formulaire
 * chauffeur existant (`/profil/chauffeur`).
 */

/** L'origine de la requête : les liens de courriel doivent revenir sur l'application de transport. */
async function origine(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1|taxi\.localhost)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

const suiteSure = (s?: string | null) => (s && s.startsWith("/") && !s.startsWith("//") ? s : null);

export async function inscriptionTransport(input: {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  motDePasse: string;
  chauffeur: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  if (!input.prenom.trim()) return fail("Le prénom est obligatoire");
  if (!email.includes("@")) return fail("Adresse e-mail invalide");
  if (input.motDePasse.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères");
  const telephone = input.telephone.replace(/[^\d+]/g, "");
  if (telephone && telephone.replace(/\D/g, "").length < 8) return fail("Numéro de téléphone invalide");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.motDePasse,
    options: {
      emailRedirectTo: `${await origine()}/auth/callback`,
      // Lu par `handle_new_user` : `role: client` explicite, le seul possible ici.
      data: {
        role: "client",
        first_name: input.prenom.trim(),
        last_name: input.nom.trim(),
        phone: telephone || undefined,
        locale: "fr",
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || /already registered/i.test(error.message)) {
      return fail("Cette adresse est déjà utilisée — connectez-vous.");
    }
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return fail("Trop d'inscriptions en peu de temps. Réessayez dans une heure.");
    }
    return fail(error.message);
  }
  if (data.user && data.user.identities?.length === 0) return fail("Cette adresse est déjà utilisée — connectez-vous.");

  const destination = input.chauffeur ? "/devenir-chauffeur" : "/";

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(destination);
  }

  // Confirmation par courriel encore active côté Supabase : levée pour ce compte
  // (même choix que l'inscription G-Mall), puis session ouverte.
  let confirme = false;
  if (data.user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error: e } = await createAdminClient().auth.admin.updateUserById(data.user.id, { email_confirm: true });
      confirme = !e;
    } catch {
      confirme = false;
    }
  }
  if (!confirme) return ok({ email, awaitingEmail: true });

  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: input.motDePasse });
  if (e2) return ok({ email, awaitingEmail: true });

  revalidatePath("/", "layout");
  redirect(destination);
}

export async function connexionTransport(email: string, motDePasse: string, suite?: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: motDePasse });
  if (error) return fail("E-mail ou mot de passe incorrect");
  revalidatePath("/", "layout");
  // Quel que soit le rôle G-Mall du compte, on reste dans l'application de transport.
  redirect(suiteSure(suite) ?? "/");
}
