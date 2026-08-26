"use server";

import { done, fail, ok, readableError, requireProfile } from "./_helpers";
import { fullName } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import { distanceMeters } from "@/lib/geo";
import { apresReservation, presenceDe } from "@/lib/taxi-presence";
import { signaler } from "@/lib/signal";

/* ═══════════════════════════════════════════════════════════════════════
   Demander une course, et y répondre.

   Jusqu'ici, joindre un chauffeur voulait dire l'appeler ou lui écrire, et le
   chauffeur devait avoir l'écran ouvert pour le savoir. Une demande de course
   est une chose plus simple et plus ferme : elle dit qui, d'où, vers où, à
   quelle distance ; elle fait sonner le téléphone même application fermée ; et
   elle expire toute seule si personne ne répond, plutôt que de rester en
   suspens et de laisser un client attendre une voiture qui ne viendra pas.

   Ce que la notification transporte est décidé ici et nulle part ailleurs. Le
   navigateur du client fournit un point de départ et une destination ; il ne
   fournit ni son propre nom, ni la distance, ni l'identité du chauffeur
   destinataire — tout cela est relu en base.
   ═══════════════════════════════════════════════════════════════════════ */

/** Réponse de PostgREST quand la migration n'a pas encore été collée. */
const TABLE_ABSENTE = ["42P01", "PGRST205", "PGRST202"];

const MINUTES_VALIDITE = 3;

export interface DemandeInput {
  driverId: string;
  pickupLat: number;
  pickupLng: number;
  pickupLabel?: string | null;
  destLat?: number | null;
  destLng?: number | null;
  destLabel?: string | null;
  seats?: number;
}

function coordonneeValide(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180
  );
}

/**
 * Envoyer une demande de course à un chauffeur.
 *
 * Le chauffeur est relu avant l'écriture, et pas seulement pour l'existence :
 * un chauffeur qui vient de se déclarer occupé ne doit pas recevoir la demande
 * qu'un client a préparée trente secondes plus tôt sur une liste devenue
 * périmée. Mieux vaut un refus immédiat et lisible qu'une demande qui expire.
 */
export async function demanderCourse(input: DemandeInput) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (!coordonneeValide(input.pickupLat, input.pickupLng)) {
    return fail("Point de départ invalide");
  }

  const sieges = Math.min(8, Math.max(1, Math.trunc(input.seats ?? 1)));

  const { data: chauffeur, error: lectureError } = await supabase
    .from("taxi_drivers")
    .select("*")
    .eq("id", input.driverId)
    .maybeSingle();

  if (lectureError) return fail(readableError(lectureError));
  if (!chauffeur) return fail("Chauffeur introuvable");
  if (!chauffeur.is_approved) return fail("Ce chauffeur n'est pas encore vérifié");

  const presence = presenceDe(chauffeur);
  if (!presence.joignable) return fail("Ce chauffeur n'est pas disponible actuellement");

  /*
    Assez de places ?

    Contrôlé seulement quand le chauffeur les a renseignées. Beaucoup n'y
    toucheront jamais, et refuser une course parce qu'un champ facultatif est
    vide serait leur faire payer une donnée qu'on ne leur a pas demandée.
  */
  if (presence.places !== null && presence.places < sieges) {
    return fail(
      presence.places === 0
        ? "Ce véhicule est complet"
        : `Il ne reste que ${presence.places} place${presence.places > 1 ? "s" : ""}`,
    );
  }

  /*
    La distance est calculée ici, à partir de la position en base.

    Elle apparaît dans la notification du chauffeur, et c'est sur elle qu'il
    décide d'accepter. La laisser venir du navigateur reviendrait à permettre
    d'annoncer « à 200 m » depuis l'autre bout de la ville.
  */
  const distance =
    chauffeur.lat !== null && chauffeur.lng !== null
      ? Math.round(
          distanceMeters(
            { lat: chauffeur.lat, lng: chauffeur.lng },
            { lat: input.pickupLat, lng: input.pickupLng },
          ),
        )
      : null;

  const expiration = new Date(Date.now() + MINUTES_VALIDITE * 60_000).toISOString();

  const { data: demande, error: writeError } = await supabase
    .from("taxi_requests")
    .insert({
      client_id: profile.id,
      driver_id: input.driverId,
      pickup_lat: input.pickupLat,
      pickup_lng: input.pickupLng,
      pickup_label: input.pickupLabel?.trim() || null,
      dest_lat: input.destLat ?? null,
      dest_lng: input.destLng ?? null,
      dest_label: input.destLabel?.trim() || null,
      distance_m: distance,
      // Vingt-cinq kilomètres à l'heure : la vitesse d'un taxi en ville à Gafsa,
      // déjà retenue ailleurs dans l'application. Une estimation cohérente vaut
      // mieux qu'une estimation juste par endroits.
      duration_min: distance === null ? null : Math.max(1, Math.round(distance / 1000 / 25 * 60)),
      seats: sieges,
      expires_at: expiration,
    })
    .select("id")
    .single();

  if (writeError) {
    if (TABLE_ABSENTE.includes(writeError.code)) {
      return fail("Les demandes de course ne sont pas encore activées.");
    }
    // Index unique : une demande de ce client à ce chauffeur attend déjà.
    if (writeError.code === "23505") {
      return fail("Vous avez déjà une demande en attente auprès de ce chauffeur.");
    }
    return fail(readableError(writeError));
  }

  await notifierChauffeur({
    driverId: input.driverId,
    demandeId: demande.id,
    clientNom: fullName(profile) || "Un client",
    distance,
    depart: input.pickupLabel?.trim() || null,
    destination: input.destLabel?.trim() || null,
    sieges,
  });

  return ok({ id: demande.id as string, expiresAt: expiration });
}

/**
 * La notification qui fait sonner le téléphone du chauffeur.
 *
 * C'est le seul moyen d'atteindre quelqu'un qui n'a pas l'application ouverte,
 * et c'est donc le cœur de tout ce dispositif. Le titre porte ce qui décide :
 * qui appelle et à quelle distance. Le corps porte la destination — sans elle,
 * un chauffeur ne peut pas juger si la course l'arrange.
 *
 * Le lien mène droit à la demande. Le service worker sait déjà ouvrir un lien
 * au clic sur une notification ; il n'y a rien à ajouter de ce côté.
 */
async function notifierChauffeur(info: {
  driverId: string;
  demandeId: string;
  clientNom: string;
  distance: number | null;
  depart: string | null;
  destination: string | null;
  sieges: number;
}) {
  try {
    const admin = createAdminClient();

    const distanceTexte =
      info.distance === null
        ? null
        : info.distance < 1000
          ? `à ${info.distance} m`
          : `à ${(info.distance / 1000).toFixed(1)} km`;

    const titre = [info.clientNom, distanceTexte].filter(Boolean).join(" · ");

    /*
      Le corps répond à la question que se pose le chauffeur : où va-t-il ?

      Quand la destination est inconnue — le client n'a rempli que son point de
      départ — on ne met pas « destination inconnue », qui sonne comme une
      panne. On dit d'où part la course, ce qui reste une information utile.
    */
    const corps = info.destination
      ? `Vers ${info.destination}${info.sieges > 1 ? ` · ${info.sieges} personnes` : ""}`
      : info.depart
        ? `Départ : ${info.depart}`
        : "Course demandée";

    await admin.from("notifications").insert({
      user_id: info.driverId,
      kind: "taxi_request",
      title: titre,
      body: corps,
      link: `/taxi/chauffeur?demande=${info.demandeId}`,
    });
  } catch (cause) {
    /*
      La demande existe même si la cloche a échoué.

      Elle apparaîtra dans l'écran du chauffeur à sa prochaine ouverture, et
      elle expirera d'elle-même sinon. Faire échouer la demande parce que la
      notification n'est pas partie priverait le client du seul canal qui lui
      reste — le fil de discussion.

      Mais on le consigne : un chauffeur qui ne reçoit plus rien avait jusqu'ici
      exactement la même signature qu'un chauffeur que personne n'appelle.
    */
    signaler(cause, {
      ou: "notification de demande de course",
      quoi: { chauffeur: info.driverId, demande: info.demandeId },
    });
  }
}

/**
 * Le chauffeur accepte ou refuse.
 *
 * Accepter décrémente les places et fait passer le véhicule à « complet » quand
 * il n'en reste plus. C'est ce qui empêche un cinquième passager de réserver
 * dans une voiture de quatre.
 */
export async function repondreDemande(demandeId: string, accepte: boolean) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data: demande, error: lectureError } = await supabase
    .from("taxi_requests")
    .select("*")
    .eq("id", demandeId)
    .maybeSingle();

  if (lectureError) return fail(readableError(lectureError));
  if (!demande) return fail("Demande introuvable");
  if (demande.driver_id !== profile.id) return fail("Cette demande ne vous est pas adressée");

  if (demande.status !== "en_attente") return fail("Cette demande n'est plus en attente");

  /*
    L'échéance fait foi, même si le nettoyage périodique n'est pas encore passé.

    Sans ce contrôle, un chauffeur qui rouvre l'application une heure plus tard
    accepterait une course que le client a abandonnée depuis longtemps, et
    partirait le chercher.
  */
  if (Date.parse(demande.expires_at) <= Date.now()) {
    await supabase
      .from("taxi_requests")
      .update({ status: "expiree", responded_at: new Date().toISOString() })
      .eq("id", demandeId);
    return fail("Cette demande a expiré");
  }

  const { error: writeError } = await supabase
    .from("taxi_requests")
    .update({
      status: accepte ? "acceptee" : "refusee",
      responded_at: new Date().toISOString(),
    })
    .eq("id", demandeId)
    // Une seconde main sur la même ligne perdrait sinon en silence : la
    // condition garantit qu'on ne réécrit pas une réponse déjà donnée.
    .eq("status", "en_attente");

  if (writeError) return fail(readableError(writeError));

  if (accepte) await consommerPlaces(profile.id, demande.seats);

  /*
    Le nom du chauffeur vient de sa fiche, pas de son profil.

    C'est celui que le client a vu sur la carte au moment de demander ; lui
    renvoyer son prénom d'état civil l'obligerait à faire le rapprochement.
  */
  const { data: fiche } = await supabase
    .from("taxi_drivers")
    .select("display_name")
    .eq("id", profile.id)
    .maybeSingle();

  await notifierClient(demande.client_id, accepte, fiche?.display_name ?? "Le chauffeur");

  return done();
}

/**
 * Retirer les places prises, et fermer le véhicule quand il est plein.
 *
 * Relue puis réécrite plutôt que décrémentée en SQL : le calcul du statut qui
 * en découle vit dans `apresReservation`, avec ses tests, et le dupliquer en
 * SQL garantirait qu'un jour les deux divergent.
 */
async function consommerPlaces(driverId: string, sieges: number) {
  try {
    const admin = createAdminClient();

    const { data: chauffeur } = await admin
      .from("taxi_drivers")
      .select("*")
      .eq("id", driverId)
      .maybeSingle();

    if (!chauffeur) return;

    const presence = presenceDe(chauffeur);
    const suite = apresReservation({ statut: presence.statut, places: presence.places }, sieges);

    // Places non renseignées : rien à décompter, et rien à décider à sa place.
    if (suite.places === null) return;

    await admin
      .from("taxi_drivers")
      .update({
        seats_free: suite.places,
        status: suite.statut,
        status_since: new Date().toISOString(),
        is_available: suite.statut !== "occupe" && suite.statut !== "hors_ligne",
        updated_at: new Date().toISOString(),
      })
      .eq("id", driverId);
  } catch (cause) {
    // Une place mal décomptée ne doit pas annuler une course acceptée — mais
    // un décompte qui échoue silencieusement laisse un véhicule complet
    // ouvert aux réservations, ce qu'il faut pouvoir constater.
    signaler(cause, { ou: "décompte des places", quoi: { chauffeur: driverId, sieges } });
  }
}

async function notifierClient(clientId: string, accepte: boolean, chauffeur: string) {
  try {
    const admin = createAdminClient();

    await admin.from("notifications").insert({
      user_id: clientId,
      kind: "taxi_request",
      title: accepte ? `${chauffeur} arrive` : `${chauffeur} n'est pas disponible`,
      body: accepte
        ? "Votre course est acceptée. Retrouvez le chauffeur sur la carte."
        : "Essayez un autre chauffeur sur la carte.",
      link: "/taxi",
    });
  } catch (cause) {
    // Voir plus haut : la réponse vaut, la cloche n'est qu'un rappel.
    signaler(cause, { ou: "notification de réponse au client", quoi: { client: clientId } });
  }
}

/** Le client se ravise. Les places ne sont pas rendues : elles n'ont pas été prises. */
export async function annulerDemande(demandeId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("taxi_requests")
    .update({ status: "annulee", responded_at: new Date().toISOString() })
    .eq("id", demandeId)
    .eq("client_id", profile.id)
    .eq("status", "en_attente");

  if (writeError) return fail(readableError(writeError));
  return done();
}
