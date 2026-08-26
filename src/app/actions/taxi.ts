"use server";

import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireAdmin, requireProfile } from "./_helpers";
import type { Database } from "@/types/database";
import { NUMERO_INVALIDE, numeroValide } from "@/lib/phone";

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
  if (!numeroValide(phone)) return fail(NUMERO_INVALIDE);

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

/**
 * Déclarer son état, et le nombre de places qui restent.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Une déclaration n'expire pas parce qu'on ferme l'application
 * ────────────────────────────────────────────────────────────────────────
 *
 * C'est tout l'objet de cette action, et la raison pour laquelle elle ne se
 * contente pas de `is_available`. L'ancien modèle avait deux états et déduisait
 * le reste de la fraîcheur de la position : un chauffeur qui rangeait son
 * téléphone disparaissait de la carte au bout de dix minutes, quoi qu'il ait
 * déclaré. Ce qu'il décide est désormais écrit, daté, et tenu par le serveur —
 * seul un délai long et explicite le retire, jamais un écran qui s'éteint.
 *
 * Le troisième état est celui qui manquait le plus : « en course, mais il me
 * reste des places ». C'est le fonctionnement ordinaire d'un louage, et
 * l'application ne savait pas l'exprimer — le chauffeur devait choisir entre se
 * dire libre, ce qui était faux, et se dire occupé, ce qui lui coûtait des
 * clients.
 *
 * `is_available` continue d'être écrit en parallèle. Les écrans qui ne
 * connaissent pas encore le nouveau statut — l'administration, les anciennes
 * requêtes — restent justes pendant la transition.
 */
export async function setDriverStatus(input: {
  statut: "libre" | "places" | "occupe" | "hors_ligne";
  /** Places restantes. `null` laisse le champ tel quel. */
  places?: number | null;
  /** Nombre total de sièges du véhicule, quand le chauffeur le renseigne. */
  total?: number | null;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const maintenant = new Date().toISOString();

  /*
    Typé plutôt que libre.

    Un objet `Record<string, unknown>` passerait toute faute de frappe sans
    broncher : PostgREST répondrait 200, la colonne ne serait pas écrite, et le
    chauffeur croirait s'être déclaré libre. Le type de la table est la seule
    barrière qui attrape cela avant le déploiement.
  */
  const patch: Database["public"]["Tables"]["taxi_drivers"]["Update"] = {
    status: input.statut,
    status_since: maintenant,
    // Se déclarer, c'est se manifester : inutile d'exiger un battement séparé
    // pour la seule action qui prouve le mieux que quelqu'un est là.
    last_seen_at: maintenant,
    is_available: input.statut === "libre" || input.statut === "places",
    updated_at: maintenant,
  };

  if (input.places !== undefined && input.places !== null) {
    patch.seats_free = Math.max(0, Math.min(8, Math.trunc(input.places)));
  }
  if (input.total !== undefined && input.total !== null) {
    patch.seats_total = Math.max(1, Math.min(8, Math.trunc(input.total)));
  }

  const { error: writeError } = await supabase
    .from("taxi_drivers")
    .update(patch)
    .eq("id", profile.id);

  if (writeError) {
    /*
      Repli tant que la migration n'est pas collée.

      Les changements de schéma passent à la main par l'éditeur SQL, donc il
      existe forcément une fenêtre où le code connaît `status` et la base non.
      Plutôt que de renvoyer une erreur incompréhensible à un chauffeur au feu
      rouge, on retombe sur la seule colonne qui existe partout : il perd le
      détail des places, il garde libre/occupé.
    */
    const { error: repli } = await supabase
      .from("taxi_drivers")
      .update({
        is_available: input.statut === "libre" || input.statut === "places",
        updated_at: maintenant,
      })
      .eq("id", profile.id);

    if (repli) return fail(readableError(repli));
  }

  revalidatePath("/taxi");
  revalidatePath("/taxi/chauffeur");
  return done();
}

/**
 * « Je suis là. »
 *
 * Un battement discret, envoyé quand l'écran du chauffeur est ouvert. Il ne
 * change pas sa disponibilité — c'est le principe même de la séparation entre
 * ce qu'on déclare et ce qu'on mesure — mais il permet de dire au client « vu
 * il y a deux minutes » sans exiger que le GPS soit autorisé.
 *
 * Un chauffeur peut refuser la localisation et rester parfaitement joignable.
 * Confondre les deux était l'autre moitié du défaut corrigé ici.
 */
export async function signalerPresence() {
  const { supabase, profile } = await requireProfile();
  if (!profile) return done();

  // Silencieuse de bout en bout : elle part toutes les minutes, et un échec
  // n'apprend rien à personne. Rien dans l'écran n'en dépend.
  await supabase
    .from("taxi_drivers")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", profile.id);

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

/**
 * Ouvrir — ou fermer — l'espace chauffeur à un membre.
 *
 * L'accès ne s'auto-attribue pas : un membre qui conduit un taxi contacte
 * l'administration, qui lui ouvre l'espace depuis cet écran. Sans cette porte,
 * n'importe quel compte pouvait créer une fiche de chauffeur et se retrouver en
 * file d'attente de vérification — du bruit pour l'administration, et une
 * fonctionnalité visible de tous alors qu'elle ne concerne presque personne.
 *
 * L'ouverture ne vaut pas approbation : la fiche naît avec `is_approved` à faux
 * et reste invisible des clients jusqu'au contrôle des pièces.
 */
export async function grantDriverAccess(input: {
  profileId: string;
  displayName: string;
  phone: string;
}) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const displayName = input.displayName.trim();
  const phone = input.phone.trim();

  if (displayName.length < 2) return fail("Nom trop court");
  if (!numeroValide(phone)) return fail(NUMERO_INVALIDE);

  const { error: writeError } = await supabase.from("taxi_drivers").upsert({
    id: input.profileId,
    display_name: displayName,
    phone,
    updated_at: new Date().toISOString(),
  });

  if (writeError) return fail(readableError(writeError));

  revalidatePath("/admin/taxi");
  return done();
}

/** Retirer l'accès. La fiche disparaît, le membre redevient un client ordinaire. */
export async function revokeDriverAccess(profileId: string) {
  const { supabase, profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase.from("taxi_drivers").delete().eq("id", profileId);
  if (writeError) return fail(readableError(writeError));

  revalidatePath("/admin/taxi");
  revalidatePath("/taxi");
  return done();
}
