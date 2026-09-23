"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile } from "./_helpers";

/**
 * Les départs de louage.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce fichier ne compte jamais les places
 * ────────────────────────────────────────────────────────────────────────
 *
 * `louage_reserver` verrouille la ligne du départ, compte les places prises et
 * insère — le tout dans une même transaction. Compter ici, puis insérer,
 * laisserait passer deux voyageurs sur la dernière place : ils se
 * présenteraient ensemble à la station, et le chauffeur en renverrait un.
 *
 * La table des places n'a d'ailleurs aucune policy d'insertion : il n'existe
 * pas de chemin sans verrou, pas même depuis PostgREST.
 */

const MESSAGES: Record<string, string> = {
  LOUAGE_CONNEXION: "Connectez-vous pour réserver",
  LOUAGE_COORDONNEES: "Indiquez votre nom et votre téléphone",
  LOUAGE_FERME: "Ce départ n'est plus ouvert",
  LOUAGE_COMPLET: "Il ne reste plus assez de places",
  LOUAGE_SOI_MEME: "Vous êtes le chauffeur de ce départ",
  LOUAGE_PAS_A_VOUS: "Cette place ne vous appartient pas",
};

const lisible = (message: string, defaut: string) => {
  const connu = Object.keys(MESSAGES).find((cle) => message.includes(cle));
  return connu ? MESSAGES[connu] : defaut;
};

/** Annoncer un départ. */
export async function annoncerDepart(input: {
  destination: string;
  departurePoint?: string;
  driverName: string;
  phone: string;
  seatsTotal: number;
  departsAt: string;
  pricePerSeat?: number | null;
  note?: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const destination = input.destination.trim();
  const nom = input.driverName.trim();
  const tel = input.phone.trim();

  if (destination.length < 2) return fail("Indiquez la destination");
  if (nom.length < 2) return fail("Indiquez votre nom");
  if (tel.length < 6) return fail("Indiquez un numéro où vous joindre");

  const depart = new Date(input.departsAt);
  if (Number.isNaN(depart.getTime())) return fail("Heure de départ invalide");
  /*
    Une heure de départ dans le passé n'est pas une faute de frappe : c'est un
    départ qu'on annonce trop tard, et personne ne le verra. On le refuse
    plutôt que de le laisser encombrer la liste.
  */
  if (depart.getTime() <= Date.now() - 30 * 60_000) {
    return fail("Cette heure est déjà passée");
  }

  const { data, error: e } = await supabase
    .from("louage_departures")
    .insert({
      driver_id: profile.id,
      driver_name: nom,
      phone: tel,
      destination,
      departure_point: input.departurePoint?.trim() || null,
      seats_total: Math.min(Math.max(Math.round(input.seatsTotal), 1), 9),
      departs_at: depart.toISOString(),
      price_per_seat: input.pricePerSeat ?? null,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();

  if (e) return fail(readableError(e));

  revalidatePath("/louage");
  return ok({ id: data.id });
}

/** Réserver une ou plusieurs places. */
export async function reserverPlace(input: {
  departureId: string;
  seats: number;
  fullName: string;
  phone: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data, error: e } = await supabase.rpc("louage_reserver", {
    p_departure: input.departureId,
    p_seats: Math.min(Math.max(Math.round(input.seats), 1), 9),
    p_name: input.fullName,
    p_phone: input.phone,
  });

  if (e) return fail(lisible(e.message, readableError(e)));

  const ligne = Array.isArray(data) ? data[0] : null;
  if (!ligne) return fail("La réservation n'a rien rendu");

  revalidatePath("/louage");
  return ok(ligne);
}

/** Annuler une place — par le voyageur ou par le chauffeur. */
export async function annulerPlace(seatId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e } = await supabase.rpc("louage_annuler_place", { p_seat: seatId });
  if (e) return fail(lisible(e.message, readableError(e)));

  revalidatePath("/louage");
  return done();
}

/** Le départ est parti, ou il n'aura pas lieu. */
export async function cloreDepart(departureId: string, statut: "parti" | "annule") {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e, count } = await supabase
    .from("louage_departures")
    .update({ status: statut }, { count: "exact" })
    .eq("id", departureId)
    .eq("driver_id", profile.id);

  if (e) return fail(readableError(e));
  // Zéro ligne : la policy a filtré. Ce n'est pas son départ.
  if (count === 0) return fail("Ce départ ne vous appartient pas");

  revalidatePath("/louage");
  return done();
}
