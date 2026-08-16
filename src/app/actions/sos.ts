"use server";

import { revalidatePath } from "next/cache";
import { isSosTrade } from "@/lib/sos";
import { done, fail, ok, readableError, requireAdmin, requireProfile } from "./_helpers";

/* ═══════════════════════════════════════════════════════════════════════
   Actions « SOS ».

   Décalquées de `taxi.ts`, y compris dans ce qu'elles refusent de faire :
   `is_approved` n'apparaît que dans les actions gardées par `requireAdmin`. La
   policy le fige déjà côté base, mais ne jamais l'écrire ailleurs évite qu'une
   retouche distraite de ce fichier n'ouvre la porte des mois plus tard.
   ═══════════════════════════════════════════════════════════════════════ */

export async function registerProvider(input: {
  trade: string;
  displayName: string;
  phone: string;
  description?: string;
  travels?: boolean;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const displayName = input.displayName.trim();
  const phone = input.phone.trim();

  // Le métier est vérifié ici en plus de la contrainte `check` : un message
  // lisible vaut mieux qu'une erreur Postgres remontée telle quelle.
  if (!isSosTrade(input.trade)) return fail("Métier inconnu");
  if (displayName.length < 2) return fail("Nom trop court");
  if (phone.length < 6) return fail("Numéro de téléphone invalide");

  const { error: writeError } = await supabase.from("sos_providers").upsert({
    id: profile.id,
    trade: input.trade,
    display_name: displayName,
    phone,
    description: input.description?.trim() || null,
    travels: input.travels ?? true,
    updated_at: new Date().toISOString(),
  });

  if (writeError) return fail(readableError(writeError));

  revalidatePath("/sos");
  revalidatePath("/sos/pro");
  return done();
}

/** Libre ou occupé. Le dépanneur seul en décide. */
export async function setProviderAvailability(available: boolean) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("sos_providers")
    .update({ is_available: available, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (writeError) return fail(readableError(writeError));

  revalidatePath("/sos");
  return done();
}

/**
 * Publier sa position.
 *
 * Facultatif ici, contrairement au taxi : un plombier travaille souvent depuis
 * un atelier fixe, et son adresse compte moins que son numéro. Ceux qui se
 * déplacent y gagnent d'être classés par proximité.
 */
export async function updateProviderPosition(lat: number, lng: number) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return fail("Latitude invalide");
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) return fail("Longitude invalide");

  const { error: writeError } = await supabase
    .from("sos_providers")
    .update({
      lat,
      lng,
      position_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (writeError) return fail(readableError(writeError));
  return ok({ lat, lng });
}

/**
 * Approuver ou révoquer un dépanneur.
 *
 * Le seul endroit du code où `is_approved` est écrit pour cette table, et il est
 * gardé par `requireAdmin`. Révoquer remet aussi la fiche en « occupé » : la
 * laisser marquée libre enverrait des clients vers quelqu'un que la plateforme
 * ne reconnaît plus.
 */
export async function setProviderApproval(providerId: string, approved: boolean) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("sos_providers")
    .update({
      is_approved: approved,
      ...(approved ? {} : { is_available: false }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", providerId);

  if (writeError) return fail(readableError(writeError));

  revalidatePath("/admin/sos");
  revalidatePath("/sos");
  return done();
}

/**
 * Ouvrir l'espace dépanneur à un membre, pour un métier donné.
 *
 * L'accès ne s'auto-attribue pas. C'est le point que tu voulais : un compte
 * client ordinaire ne voit rien de ce service tant que l'administration ne l'a
 * pas désigné, et elle le désigne pour *un métier précis* — pas comme
 * « dépanneur » en général.
 *
 * Ouvrir ne vaut pas approuver : la fiche naît invisible et le reste jusqu'au
 * contrôle des pièces.
 */
export async function grantProviderAccess(input: {
  profileId: string;
  trade: string;
  displayName: string;
  phone: string;
}) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const displayName = input.displayName.trim();
  const phone = input.phone.trim();

  if (!isSosTrade(input.trade)) return fail("Métier inconnu");
  if (displayName.length < 2) return fail("Nom trop court");
  if (phone.length < 6) return fail("Numéro de téléphone requis");

  const { error: writeError } = await supabase.from("sos_providers").upsert({
    id: input.profileId,
    trade: input.trade,
    display_name: displayName,
    phone,
    updated_at: new Date().toISOString(),
  });

  if (writeError) return fail(readableError(writeError));

  revalidatePath("/admin/sos");
  return done();
}

/** Retirer l'accès. La fiche disparaît, le membre redevient un client ordinaire. */
export async function revokeProviderAccess(profileId: string) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase.from("sos_providers").delete().eq("id", profileId);
  if (writeError) return fail(readableError(writeError));

  revalidatePath("/admin/sos");
  revalidatePath("/sos");
  return done();
}
