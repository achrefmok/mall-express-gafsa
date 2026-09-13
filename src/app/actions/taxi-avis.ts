"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, requireProfile } from "./_helpers";
import { getT } from "@/lib/i18n/server";

/* ═══════════════════════════════════════════════════════════════════════
   Les avis sur les chauffeurs, côté client.

   Ces actions ne sont pas la barrière : `taxi_noter_course` vérifie tout —
   la course, son propriétaire, son état, l'unicité. Elles traduisent ses
   refus, et elles trouvent la course à noter.
   ═══════════════════════════════════════════════════════════════════════ */

const MIGRATION_ABSENTE = ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"];

/** Une semaine : au-delà, on ne demande plus. Personne ne note un trajet oublié. */
const FENETRE_MS = 7 * 24 * 60 * 60 * 1000;

export interface CourseANoter {
  courseId: string;
  chauffeurId: string;
  nom: string;
  photo: string | null;
}

/**
 * La dernière course terminée de la personne, si elle n'est pas encore notée.
 *
 * Deux lectures ordinaires, sous RLS : la personne lit ses propres courses et
 * ses propres avis. Tant que la migration des avis n'est pas collée, la
 * seconde échoue — et l'on ne propose rien, plutôt qu'un formulaire qui
 * échouerait à l'envoi.
 */
export async function courseANoter() {
  const { supabase, profile } = await requireProfile();
  if (!profile) return ok<CourseANoter | null>(null);

  const { data: course } = await supabase
    .from("taxi_requests")
    .select("id, driver_id")
    .eq("client_id", profile.id)
    .eq("status", "completed")
    .gte("created_at", new Date(Date.now() - FENETRE_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!course?.driver_id) return ok<CourseANoter | null>(null);

  const { data: avis, error } = await supabase
    .from("taxi_driver_reviews")
    .select("id")
    .eq("request_id", course.id)
    .maybeSingle();

  if (error || avis) return ok<CourseANoter | null>(null);

  const { data: fiche } = await supabase
    .from("taxi_drivers")
    .select("display_name, photo_url")
    .eq("id", course.driver_id)
    .maybeSingle();

  return ok<CourseANoter | null>({
    courseId: course.id,
    chauffeurId: course.driver_id,
    nom: fiche?.display_name ?? "",
    photo: fiche?.photo_url ?? null,
  });
}

export async function noterCourse(input: {
  courseId: string;
  chauffeurId: string;
  note: number;
  commentaire: string | null;
}) {
  const { t } = await getT();
  const { supabase, profile } = await requireProfile();
  if (!profile) return fail(t.reviews.errLogin);

  const note = Math.trunc(Number(input.note));
  if (!(note >= 1 && note <= 5)) return fail(t.reviews.errInvalid);

  const { error } = await supabase.rpc("taxi_noter_course", {
    p_course: input.courseId,
    p_note: note,
    p_commentaire: input.commentaire?.trim().slice(0, 500) || null,
  });

  if (error) {
    if (MIGRATION_ABSENTE.includes(error.code)) return fail(t.reviews.errUnavailable);

    // Les refus de la fonction sont des clés : on les rend dans la langue de l'écran.
    const messages: Record<string, string> = {
      AVIS_CONNEXION: t.reviews.errLogin,
      AVIS_NOTE: t.reviews.errInvalid,
      AVIS_PAS_A_VOUS: t.reviews.errNotYours,
      AVIS_NON_TERMINEE: t.reviews.errNotCompleted,
      AVIS_DEJA: t.reviews.errAlready,
    };
    return fail(messages[error.message] ?? t.reviews.errFailed);
  }

  revalidatePath(`/chauffeurs/${input.chauffeurId}`);
  return done();
}
