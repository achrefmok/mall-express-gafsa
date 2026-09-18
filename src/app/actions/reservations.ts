"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireProfile } from "./_helpers";

/**
 * Les réservations chez un partenaire.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce qui n'est pas ici
 * ────────────────────────────────────────────────────────────────────────
 *
 * Aucun contrôle de propriété n'est écrit dans ce fichier. Qui peut lire une
 * réservation, qui peut la décider, qui peut l'annuler : tout cela vit dans
 * les policies de `reservations`. Le répéter ici donnerait deux règles à tenir
 * d'accord, et le jour où elles divergeraient, c'est la plus permissive des
 * deux qu'on découvrirait — par un incident.
 *
 * Ce fichier ne fait donc que trois choses : mettre en forme, traduire les
 * refus de la base en phrases lisibles, et rafraîchir les écrans concernés.
 */

/** Une demande de réservation, envoyée par le client. */
export async function reserver(input: {
  shopId: string;
  productId?: string | null;
  fullName: string;
  phone: string;
  partySize?: number;
  desiredAt: string;
  note?: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const nom = input.fullName.trim();
  const tel = input.phone.trim();
  if (nom.length < 2) return fail("Indiquez votre nom");
  if (tel.length < 6) return fail("Indiquez un numéro où vous joindre");

  const quand = new Date(input.desiredAt);
  if (Number.isNaN(quand.getTime())) return fail("Date invalide");
  if (quand.getTime() <= Date.now()) return fail("Choisissez une date à venir");

  const personnes = Math.min(Math.max(Math.round(input.partySize ?? 1), 1), 100);

  const { data, error: e } = await supabase
    .from("reservations")
    .insert({
      shop_id: input.shopId,
      user_id: profile.id,
      product_id: input.productId || null,
      full_name: nom,
      phone: tel,
      party_size: personnes,
      desired_at: quand.toISOString(),
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();

  if (e) {
    /*
      42501 : la policy d'insertion a refusé. Elle exige une boutique
      approuvée qui accepte les réservations — un commerçant qui vient de
      les couper pendant que le formulaire était ouvert, par exemple.
    */
    if (e.code === "42501") return fail("Cette boutique n'accepte pas de réservation pour le moment");
    return fail(readableError(e));
  }

  revalidatePath("/profil");
  return ok({ id: data.id });
}

/** La décision du commerçant. */
export async function deciderReservation(
  id: string,
  decision: "accepted" | "refused" | "done",
  motif?: string,
) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e, count } = await supabase
    .from("reservations")
    .update(
      {
        status: decision,
        refusal_reason: decision === "refused" ? motif?.trim() || null : null,
        handled_at: new Date().toISOString(),
        handled_by: profile.id,
      },
      { count: "exact" },
    )
    .eq("id", id);

  if (e) return fail(readableError(e));
  // Zéro ligne touchée : la policy a filtré. Ce n'est pas sa réservation.
  if (count === 0) return fail("Cette réservation ne vous appartient pas");

  revalidatePath("/vendeur/reservations");
  revalidatePath("/vendeur");
  return done();
}

/** Le client se désiste, tant que personne n'a répondu. */
export async function annulerReservation(id: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: e, count } = await supabase
    .from("reservations")
    .update({ status: "cancelled" }, { count: "exact" })
    .eq("id", id)
    .eq("user_id", profile.id)
    .eq("status", "pending");

  if (e) return fail(readableError(e));
  if (count === 0) return fail("Cette réservation a déjà été traitée");

  revalidatePath("/profil");
  return done();
}
