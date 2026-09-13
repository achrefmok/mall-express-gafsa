"use server";

import { done, fail, ok, requireProfile } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { signaler } from "@/lib/signal";
import { presenceDe } from "@/lib/taxi-presence";

/* ═══════════════════════════════════════════════════════════════════════
   La négociation, et la recherche dans l'autre sens.

   Deux manques que l'usage a révélés, et qui tiennent au même malentendu :
   on avait modélisé la course comme une commande, alors que c'est un accord.

   · Le client annonçait une destination, et le matching la traitait comme
     une **contrainte** : seul un chauffeur allant exactement là était retenu.
     À Gafsa, la phrase qu'on entend est « je vais vers Lella, ça vous
     arrange ? » — la destination est un point de départ de conversation, pas
     un critère de filtrage. D'où la contre-proposition.

   · Le chauffeur **attendait**. Il ne pouvait pas chercher : `taxi_requests`
     n'est lisible que de ses deux extrémités, et il n'en est pas une tant que
     personne n'a accepté. D'où `demandesProches`, qui passe par une fonction
     SQL parce que c'est la seule façon de lui montrer ce qu'il faut sans lui
     ouvrir la table entière.

   Ce que le serveur garde pour lui, ici comme ailleurs : l'identité du
   client, son téléphone, et le point de départ exact. Le chauffeur voit une
   distance et un libellé — de quoi décider. Le reste n'apparaît qu'une fois
   qu'il a accepté et qu'il est devenu une extrémité de la course.
   ═══════════════════════════════════════════════════════════════════════ */

/** Ce que PostgREST répond quand la migration n'a pas encore été collée. */
const MIGRATION_ABSENTE = ["42P01", "42883", "PGRST202", "PGRST205"];

function migrationManquante(code: string | undefined): boolean {
  return code !== undefined && MIGRATION_ABSENTE.includes(code);
}

export interface DemandeProche {
  id: string;
  pickupLabel: string | null;
  /** Le point de prise en charge, pour le repère sur la carte. */
  pickupLat: number;
  pickupLng: number;
  originZone: string | null;
  destinationZone: string | null;
  destinationType: "zone" | "autre";
  destinationName: string | null;
  destLabel: string | null;
  destLat: number | null;
  destLng: number | null;
  proposedPrice: number | null;
  seats: number;
  expiresAt: string;
  createdAt: string;
  distanceM: number;
  /** Vrai si le matching la lui avait déjà adressée : il la voit deux fois sinon. */
  dejaDiffusee: boolean;
}

/**
 * Les demandes ouvertes autour du chauffeur, triées par proximité.
 *
 * La position vient du navigateur du chauffeur, pas de sa dernière position
 * connue en base : il peut avoir refusé le partage continu tout en voulant
 * chercher maintenant. Elle n'est utilisée que pour trier et filtrer — rien
 * n'est écrit avec.
 */
export async function demandesProches(input: {
  lat: number;
  lng: number;
  rayonM?: number;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (!Number.isFinite(input.lat) || Math.abs(input.lat) > 90) return fail("Latitude invalide");
  if (!Number.isFinite(input.lng) || Math.abs(input.lng) > 180) return fail("Longitude invalide");

  const rayon = Math.max(500, Math.min(30_000, Math.trunc(input.rayonM ?? 8000)));

  const { data, error: rpcError } = await supabase.rpc("taxi_demandes_proches", {
    p_lat: input.lat,
    p_lng: input.lng,
    p_rayon_m: rayon,
    p_limite: 20,
  });

  if (rpcError) {
    if (migrationManquante(rpcError.code)) {
      // La recherche de clients n'est pas encore activée : l'écran retombe
      // sur les demandes diffusées, qui elles fonctionnent déjà.
      return ok<DemandeProche[]>([]);
    }
    return fail("La recherche n'a pas abouti.");
  }

  const lignes = (data ?? []) as Array<Record<string, unknown>>;

  return ok<DemandeProche[]>(
    lignes.map((l) => ({
      id: String(l.id),
      pickupLabel: (l.pickup_label as string | null) ?? null,
      pickupLat: Number(l.pickup_lat ?? 0),
      pickupLng: Number(l.pickup_lng ?? 0),
      originZone: (l.origin_zone as string | null) ?? null,
      destinationZone: (l.destination_zone as string | null) ?? null,
      destinationType: (l.destination_type as "zone" | "autre") ?? "zone",
      destinationName: (l.destination_name as string | null) ?? null,
      destLabel: (l.dest_label as string | null) ?? null,
      destLat: (l.dest_lat as number | null) ?? null,
      destLng: (l.dest_lng as number | null) ?? null,
      proposedPrice: (l.proposed_price as number | null) ?? null,
      seats: Number(l.seats ?? 1),
      expiresAt: String(l.expires_at),
      createdAt: String(l.created_at),
      distanceM: Number(l.distance_m ?? 0),
      dejaDiffusee: Boolean(l.deja_diffusee),
    })),
  );
}

/**
 * Le chauffeur prend une course qu'il a trouvée lui-même.
 *
 * Elle ne lui a pas été diffusée — c'est lui qui est allé la chercher — donc
 * aucune ligne de correspondance n'existe. On en crée une avant d'accepter,
 * pour deux raisons : le contrôle d'appartenance qui garde l'acceptation
 * reste vrai pour tout le monde, et la trace de « qui a vu cette demande »
 * reste complète.
 *
 * La proximité est revérifiée côté serveur par la fonction SQL : un
 * identifiant deviné depuis l'autre bout de la ville ne passe pas.
 */
export async function accepterDemandeProche(input: {
  demandeId: string;
  lat: number;
  lng: number;
}) {
  const { profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const proches = await demandesProches({ lat: input.lat, lng: input.lng, rayonM: 30_000 });
  if (!proches.ok) return proches;

  const cible = proches.data.find((d) => d.id === input.demandeId);
  if (!cible) {
    return fail("Cette course n'est plus disponible près de vous.");
  }

  const admin = createAdminClient();

  try {
    await admin.from("taxi_request_matches").upsert(
      {
        request_id: cible.id,
        driver_id: profile.id,
        pickup_label: cible.pickupLabel,
        origin_zone: cible.originZone,
        destination_zone: cible.destinationZone,
        destination_type: cible.destinationType,
        destination_name: cible.destinationName,
        proposed_price: cible.proposedPrice,
        seats: cible.seats,
        expires_at: cible.expiresAt,
      },
      { onConflict: "request_id,driver_id", ignoreDuplicates: true },
    );
  } catch (cause) {
    signaler(cause, { ou: "diffusion à la volée d'une demande trouvée", quoi: { demande: cible.id } });
    return fail("La course n'a pas pu être prise.");
  }

  // Le chemin d'acceptation reste unique : celui du matching, avec son
  // écriture gagnante atomique et son contrôle de places.
  const { repondreDemandeDiffusee } = await import("./taxi-matching");
  return repondreDemandeDiffusee(cible.id, true);
}

/**
 * Le client pousse sa demande vers un chauffeur qu'il a repéré.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi ce n'est pas une seconde demande
 * ────────────────────────────────────────────────────────────────────────
 *
 * Le réflexe serait d'appeler `demanderCourse`, qui crée une demande adressée.
 * Ce serait une deuxième ligne pour la même course — et l'index unique
 * « une seule demande ouverte par client » la refuserait, avec un message
 * incompréhensible pour quelqu'un qui vient simplement de toucher une carte.
 *
 * La demande diffusée existe déjà. La pousser vers un chauffeur, c'est donc
 * lui écrire une correspondance : il la voit apparaître dans son écran, il est
 * notifié, et il l'accepte par le même chemin atomique que les autres. Rien
 * n'est dupliqué, et le premier qui accepte gagne toujours.
 */
export async function adresserDemandeA(demandeId: string, driverId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  // La demande doit être la sienne, et encore ouverte.
  const { data: demande, error: lectureError } = await supabase
    .from("taxi_requests")
    .select("*")
    .eq("id", demandeId)
    .eq("client_id", profile.id)
    .eq("status", "en_attente")
    .maybeSingle();

  if (lectureError && migrationManquante(lectureError.code)) {
    return fail("Le matching par trajet n'est pas encore activé.");
  }
  if (!demande) return fail("Cette demande n'est plus en cours.");

  const ligne = demande as Record<string, unknown>;

  const admin = createAdminClient();

  // Le chauffeur doit être approuvé — la policy le dit déjà pour l'insertion
  // d'une demande, on le redit ici parce que c'est la clé de service qui écrit.
  const { data: fiche } = await admin
    .from("taxi_drivers")
    .select("id, display_name, is_approved")
    .eq("id", driverId)
    .maybeSingle();

  if (!fiche?.is_approved) return fail("Ce chauffeur n'est pas disponible.");

  const { error: writeError } = await admin.from("taxi_request_matches").upsert(
    {
      request_id: demandeId,
      driver_id: driverId,
      pickup_label: (ligne.pickup_label as string | null) ?? null,
      origin_zone: (ligne.origin_zone as string | null) ?? null,
      destination_zone: (ligne.destination_zone as string | null) ?? null,
      destination_type: (ligne.destination_type as "zone" | "autre" | null) ?? "zone",
      destination_name: (ligne.destination_name as string | null) ?? null,
      proposed_price: (ligne.proposed_price as number | null) ?? null,
      seats: (ligne.seats as number) ?? 1,
      expires_at: String(ligne.expires_at),
    },
    { onConflict: "request_id,driver_id", ignoreDuplicates: true },
  );

  if (writeError) return fail("La demande n'a pas pu être transmise.");

  try {
    await admin.from("notifications").insert({
      user_id: driverId,
      kind: "taxi_request",
      title: "🚕 Un client vous demande",
      body: "Une course vous attend dans votre écran chauffeur.",
      link: `/taxi/chauffeur?demande=${demandeId}`,
    });
  } catch (cause) {
    // La correspondance est écrite : il la verra en ouvrant l'écran. La
    // cloche n'est qu'un raccourci, elle ne conditionne pas la demande.
    signaler(cause, { ou: "notification de demande adressée", quoi: { chauffeur: driverId } });
  }

  return done();
}

/* ─── La contre-proposition ───────────────────────────────────────────── */

/**
 * « Je vais vers Lella, ça vous arrange ? »
 *
 * La proposition ne change pas la destination : elle attend. C'est le client
 * qui bascule, ou pas. Tant qu'il n'a pas répondu, la course garde ce qu'elle
 * avait — sans quoi un chauffeur pourrait réécrire seul le trajet convenu.
 */
export async function proposerDestination(input: {
  demandeId: string;
  label: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const nom = input.label.trim();
  if (nom.length < 2 || nom.length > 80) {
    return fail("Écrivez la destination en quelques mots (2 à 80 caractères)");
  }

  const { error: rpcError } = await supabase.rpc("taxi_proposer_destination", {
    p_demande: input.demandeId,
    p_label: nom,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
  });

  if (rpcError) {
    if (migrationManquante(rpcError.code)) {
      return fail("Les propositions de destination ne sont pas encore activées.");
    }
    // Les exceptions de nos fonctions SQL sont rédigées en français : elles
    // disent exactement ce qui bloque, et méritent d'être lues telles quelles.
    if (rpcError.code === "P0001") return fail(rpcError.message);
    return fail("La proposition n'a pas pu être envoyée.");
  }

  return done();
}

/** Le client tranche. « Oui » remplace la destination, « non » la laisse. */
export async function repondreProposition(demandeId: string, accepte: boolean) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: rpcError } = await supabase.rpc("taxi_repondre_proposition", {
    p_demande: demandeId,
    p_accepte: accepte,
  });

  if (rpcError) {
    if (migrationManquante(rpcError.code)) {
      return fail("Les propositions de destination ne sont pas encore activées.");
    }
    if (rpcError.code === "P0001") return fail(rpcError.message);
    return fail("La réponse n'a pas pu être enregistrée.");
  }

  return done();
}

/* ─── La sortie qui manquait ──────────────────────────────────────────── */

/**
 * Annuler une course déjà acceptée, des deux côtés.
 *
 * Les deux fonctions d'annulation existantes filtrent sur `en_attente` :
 * passé l'acceptation, personne ne pouvait plus renoncer, et les places
 * consommées n'étaient jamais rendues. Un chauffeur qui accepte puis s'éteint
 * laissait la course ouverte pour toujours.
 *
 * La restitution des places et la remise en « libre » se font dans la même
 * transaction SQL que le changement de statut — les séparer laisserait un
 * véhicule marqué complet après une annulation.
 */
export async function annulerCourseAcceptee(demandeId: string, motif?: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: rpcError } = await supabase.rpc("taxi_annuler_course", {
    p_demande: demandeId,
    p_motif: motif?.trim() || null,
  });

  if (rpcError) {
    if (migrationManquante(rpcError.code)) {
      return fail("L'annulation d'une course acceptée n'est pas encore activée.");
    }
    if (rpcError.code === "P0001") return fail(rpcError.message);
    return fail("L'annulation n'a pas pu être enregistrée.");
  }

  return done();
}

/* ─── Ce que le client suit de sa propre course ───────────────────────── */

export interface CourseEnCours {
  id: string;
  status: string;
  driverId: string | null;
  seats: number;
  destLabel: string | null;
  destinationName: string | null;
  acceptedPrice: number | null;
  proposedPrice: number | null;
  expiresAt: string;
  /** La proposition en attente, s'il y en a une. */
  proposition: {
    label: string;
    lat: number | null;
    lng: number | null;
    statut: "pending" | "accepted" | "refused";
  } | null;
  chauffeur: {
    id: string;
    nom: string;
    telephone: string;
    vehicule: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

/**
 * La course ouverte du client, avec le chauffeur quand il y en a un.
 *
 * Une seule requête pour l'écran de suivi : sans elle, le client devait
 * recharger la page pour savoir si quelqu'un avait accepté.
 */
export async function maCourseEnCours() {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data, error: lectureError } = await supabase
    .from("taxi_requests")
    .select("*")
    .eq("client_id", profile.id)
    .in("status", ["en_attente", "acceptee", "driver_arriving", "picked_up", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lectureError) {
    if (migrationManquante(lectureError.code)) return ok<CourseEnCours | null>(null);
    return fail("La course n'a pas pu être relue.");
  }

  if (!data) return ok<CourseEnCours | null>(null);

  const ligne = data as Record<string, unknown>;
  const driverId = (ligne.driver_id as string | null) ?? null;

  let chauffeur: CourseEnCours["chauffeur"] = null;

  if (driverId) {
    const { data: fiche } = await supabase
      .from("taxi_drivers")
      .select("id, display_name, phone, vehicle, plate, lat, lng")
      .eq("id", driverId)
      .maybeSingle();

    if (fiche) {
      chauffeur = {
        id: fiche.id,
        nom: fiche.display_name,
        telephone: fiche.phone,
        vehicule: [fiche.vehicle, fiche.plate].filter(Boolean).join(" · ") || null,
        lat: fiche.lat ?? null,
        lng: fiche.lng ?? null,
      };
    }
  }

  const propLabel = (ligne.proposed_dest_label as string | null) ?? null;
  const propStatut = (ligne.proposal_status as "pending" | "accepted" | "refused" | null) ?? null;

  return ok<CourseEnCours | null>({
    id: String(ligne.id),
    status: String(ligne.status),
    driverId,
    seats: Number(ligne.seats ?? 1),
    destLabel: (ligne.dest_label as string | null) ?? null,
    destinationName: (ligne.destination_name as string | null) ?? null,
    acceptedPrice: (ligne.accepted_price as number | null) ?? null,
    proposedPrice: (ligne.proposed_price as number | null) ?? null,
    expiresAt: String(ligne.expires_at),
    proposition:
      propLabel && propStatut
        ? {
            label: propLabel,
            lat: (ligne.proposed_dest_lat as number | null) ?? null,
            lng: (ligne.proposed_dest_lng as number | null) ?? null,
            statut: propStatut,
          }
        : null,
    chauffeur,
  });
}

/* ─── Le chauffeur relit sa course, et l'état de sa proposition ───────── */

export async function maCourseChauffeur() {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data, error: lectureError } = await supabase
    .from("taxi_requests")
    .select("*")
    .eq("driver_id", profile.id)
    .in("status", ["acceptee", "driver_arriving", "picked_up", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lectureError) {
    if (migrationManquante(lectureError.code)) return ok<null>(null);
    return fail("La course n'a pas pu être relue.");
  }

  return ok(data ?? null);
}

/**
 * Le nombre de places d'un chauffeur, tel qu'il le déclare.
 * Sert à l'écran chauffeur pour n'afficher que ce qu'il peut prendre.
 */
export async function mesPlaces() {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data } = await supabase
    .from("taxi_drivers")
    .select("*")
    .eq("id", profile.id)
    .maybeSingle();

  if (!data) return ok<{ places: number | null; statut: string }>({ places: null, statut: "hors_ligne" });

  const presence = presenceDe(data);
  return ok({ places: presence.places, statut: presence.statut });
}
