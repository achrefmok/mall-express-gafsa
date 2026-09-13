"use server";

import { revalidatePath } from "next/cache";
import { done, fail, readableError, requireProfile } from "./_helpers";
import { NUMERO_INVALIDE, numeroValide } from "@/lib/phone";
import { getT } from "@/lib/i18n/server";

/**
 * Le chauffeur met à jour sa fiche.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que cette action n'écrit jamais
 * ────────────────────────────────────────────────────────────────────────
 *
 * `is_approved`, bien sûr — la policy de `taxi_drivers` le fige déjà, et ne
 * jamais le nommer ici évite qu'une modification distraite ne rouvre la porte.
 * Ni `status` : la disponibilité se change par `setDriverStatus`, qui fait
 * aussi la remise en diffusion des demandes en attente. L'écrire ici aurait
 * contourné cette seconde moitié.
 *
 * ────────────────────────────────────────────────────────────────────────
 * La photo
 * ────────────────────────────────────────────────────────────────────────
 *
 * On n'accepte qu'une adresse de notre propre stockage. Une URL quelconque
 * serait refusée par l'optimiseur d'images — seul l'hôte Supabase y est
 * autorisé — et la fiche publique afficherait une image cassée. Mieux vaut
 * le refuser ici, avec un message.
 */

const PREFIXE_STOCKAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;

function texte(valeur: unknown, max: number): string | null {
  if (typeof valeur !== "string") return null;
  const t = valeur.trim();
  return t ? t.slice(0, max) : null;
}

function liste(valeur: unknown, max: number): string[] {
  if (!Array.isArray(valeur)) return [];
  return [...new Set(valeur.map((v) => (typeof v === "string" ? v.trim().slice(0, 30) : "")).filter(Boolean))].slice(0, max);
}

function entier(valeur: unknown, min: number, max: number): number | null {
  const n = Number(valeur);
  if (valeur === null || valeur === "" || !Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export interface ProfilChauffeurInput {
  displayName: string;
  phone: string;
  photoUrl: string | null;
  bio: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehicleYear: number | null;
  plate: string | null;
  serviceZones: string[];
  languages: string[];
  experienceYears: number | null;
  licenseNumber: string | null;
  showPhone: boolean;
}

export async function enregistrerProfilChauffeur(input: ProfilChauffeurInput) {
  const { t } = await getT();
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  // Réservé à qui possède une fiche : l'accès s'ouvre depuis l'administration.
  const { data: fiche } = await supabase
    .from("taxi_drivers")
    .select("id")
    .eq("id", profile.id)
    .maybeSingle();

  if (!fiche) return fail(t.driver.errNotOpen);

  const nom = texte(input.displayName, 60);
  if (!nom || nom.length < 2) return fail(t.driver.errName);

  const telephone = input.phone.trim();
  if (!numeroValide(telephone)) return fail(NUMERO_INVALIDE);

  const photo = texte(input.photoUrl, 500);
  if (photo && !photo.startsWith(PREFIXE_STOCKAGE)) {
    return fail(t.driver.errPhoto);
  }

  const annee = entier(input.vehicleYear, 1980, new Date().getFullYear() + 1);
  const experience = entier(input.experienceYears, 0, 60);

  // Le véhicule d'origine, en texte libre, est recomposé pour les écrans qui
  // ne connaissent pas encore les champs détaillés : la carte, la liste.
  const marque = texte(input.vehicleBrand, 30);
  const modele = texte(input.vehicleModel, 30);
  const vehicule = [marque, modele].filter(Boolean).join(" ") || null;

  const { error: writeError } = await supabase
    .from("taxi_drivers")
    .update({
      display_name: nom,
      phone: telephone,
      photo_url: photo,
      bio: texte(input.bio, 400),
      vehicle: vehicule,
      vehicle_brand: marque,
      vehicle_model: modele,
      vehicle_color: texte(input.vehicleColor, 30),
      vehicle_year: annee,
      plate: texte(input.plate, 20),
      service_zones: liste(input.serviceZones, 10),
      languages: liste(input.languages, 6),
      experience_years: experience,
      show_phone: Boolean(input.showPhone),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (writeError) return fail(readableError(writeError));

  /*
    Le numéro de permis, à part.

    Il ne va pas dans `taxi_drivers`, lisible par tous : il vit dans
    `taxi_driver_private`, que seuls le chauffeur et l'administration lisent.
  */
  const { error: privError } = await supabase.from("taxi_driver_private").upsert({
    id: profile.id,
    license_number: texte(input.licenseNumber, 40),
    updated_at: new Date().toISOString(),
  });

  if (privError) return fail(readableError(privError));

  revalidatePath("/profil/chauffeur");
  revalidatePath(`/chauffeurs/${profile.id}`);
  revalidatePath("/taxi");
  return done();
}
