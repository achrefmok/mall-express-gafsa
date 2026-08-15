"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireAdmin, requireProfile } from "./_helpers";

/* ═══════════════════════════════════════════════════════════════════════
   Actions « taxi ».

   Un profil qui possède une ligne dans `taxi_drivers` est chauffeur : pas de
   rôle supplémentaire, la table suffit à le désigner.

   `is_approved` n'apparaît dans aucune de ces actions, et c'est délibéré. La
   policy le fige déjà côté base, mais ne jamais l'écrire ici évite qu'une
   modification distraite de ce fichier n'ouvre la porte plus tard.
   ═══════════════════════════════════════════════════════════════════════ */

export async function registerDriver(input: {
  displayName: string;
  phone: string;
  vehicle?: string;
  plate?: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const displayName = input.displayName.trim();
  const phone = input.phone.trim();

  if (displayName.length < 2) return fail("Nom trop court");
  if (phone.length < 6) return fail("Numéro de téléphone invalide");

  const { error: writeError } = await supabase.from("taxi_drivers").upsert({
    id: profile.id,
    display_name: displayName,
    phone,
    vehicle: input.vehicle?.trim() || null,
    plate: input.plate?.trim() || null,
    updated_at: new Date().toISOString(),
  });

  if (writeError) return fail(readableError(writeError));

  revalidatePath("/taxi");
  revalidatePath("/taxi/chauffeur");
  return done();
}

/** Libre ou occupé. Le chauffeur seul en décide — personne ne sait à sa place. */
export async function setDriverAvailability(available: boolean) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("taxi_drivers")
    .update({ is_available: available, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (writeError) return fail(readableError(writeError));

  revalidatePath("/taxi");
  return done();
}

/**
 * Publier sa position.
 *
 * Envoyée depuis le téléphone du chauffeur, jamais devinée. `position_updated_at`
 * accompagne les coordonnées : une position sans horodatage ne permet pas de
 * distinguer un chauffeur qui vient de bouger d'un autre dont le téléphone est
 * éteint depuis deux heures.
 */
export async function updateDriverPosition(lat: number, lng: number) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return fail("Latitude invalide");
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) return fail("Longitude invalide");

  const { error: writeError } = await supabase
    .from("taxi_drivers")
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
 * Approuver ou révoquer un chauffeur.
 *
 * Le seul endroit du code où `is_approved` est écrit, et il est gardé par
 * `requireAdmin`. La policy de la table le refuse déjà au chauffeur lui-même :
 * cette action est le pendant administratif de cette interdiction, pas un
 * contournement.
 *
 * Révoquer remet aussi le chauffeur en « occupé » : le laisser marqué libre
 * alors qu'il vient d'être retiré enverrait des clients vers quelqu'un que la
 * plateforme ne reconnaît plus.
 */
export async function setDriverApproval(driverId: string, approved: boolean) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("taxi_drivers")
    .update({
      is_approved: approved,
      ...(approved ? {} : { is_available: false }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", driverId);

  if (writeError) return fail(readableError(writeError));

  revalidatePath("/admin/taxi");
  revalidatePath("/taxi");
  return done();
}
