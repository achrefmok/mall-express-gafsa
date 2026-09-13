"use server";

import { done, fail, ok, requireProfile } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/format";
import { signaler } from "@/lib/signal";
import { estZone } from "@/lib/taxi-zones";
import { apresReservation, presenceDe } from "@/lib/taxi-presence";

/* ═══════════════════════════════════════════════════════════════════════
   Le matching par trajet : demander une course à plusieurs chauffeurs.

   Le premier chemin de course — un client s'adresse à un chauffeur précis —
   vit dans `taxi-course.ts`. Celui-ci est l'autre moitié, celle que la
   pratique de Gafsa appelle : le client annonce où il va et ce qu'il propose,
   le serveur trouve les chauffeurs compatibles, et le premier qui accepte
   gagne.

   De quoi le serveur est-il le gardien ici ?

   · la **compatibilité** est calculée ici, jamais filtrée à la main par le
     chauffeur : trajet en zones, disponibilité, places ;
   · l'**acceptation est atomique** — deux chauffeurs voient la même demande,
     un seul écrit `driver_id` ;
   · les **places se décomptent** côté base, pas côté écran ;
   · les **destinations personnalisées ne bloquent jamais** : elles partent
     vers les chauffeurs qui ont dit les accepter, et expirent d'elles-mêmes
     sinon.
   ═══════════════════════════════════════════════════════════════════════ */

/** Ce que PostgREST répond quand la migration n'a pas encore été collée. */
const TABLE_ABSENTE = ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"];

/** Combien de temps une demande reste en recherche, comme le chemin direct. */
const MINUTES_VALIDITE = 3;

export interface CommandeMatchingInput {
  pickupLat: number;
  pickupLng: number;
  pickupLabel?: string | null;
  destinationType: "zone" | "autre";
  originZone?: string | null;
  destinationZone?: string | null;
  destinationName?: string | null;
  /** La proposition du client, en dinars. `null` = rien d'annoncé. */
  proposedPrice?: number | null;
  seats?: number;
}

function coordonneeValide(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180
  );
}

/**
 * Créer une demande diffusée, et l'offrir aux chauffeurs compatibles.
 *
 * La demande naît avec `driver_id` nul : c'est ce qui la rend visible aux
 * plusieurs chauffeurs que le matching va lui trouver. Si personne n'est libre
 * au moment où elle naît, elle reste en attente : un chauffeur qui se déclare
 * libre plus tard la verra arriver (voir `offrirDemandes`).
 */
export async function creerDemandeMatching(input: CommandeMatchingInput) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (!coordonneeValide(input.pickupLat, input.pickupLng)) {
    return fail("Point de départ invalide");
  }

  const sieges = Math.min(8, Math.max(1, Math.trunc(input.seats ?? 1)));
  const prix =
    input.proposedPrice === null || input.proposedPrice === undefined
      ? null
      : Math.max(0, Math.min(999, Math.trunc(input.proposedPrice)));

  if (input.destinationType === "zone") {
    if (!estZone(input.originZone) || !estZone(input.destinationZone)) {
      return fail("Choisissez votre zone de départ et votre destination");
    }
  } else {
    const nom = input.destinationName?.trim() ?? "";
    if (nom.length < 2 || nom.length > 80) {
      return fail("Écrivez la destination en quelques mots (2 à 80 caractères)");
    }
  }

  const expiration = new Date(Date.now() + MINUTES_VALIDITE * 60_000).toISOString();
  const departZone = estZone(input.originZone) ? input.originZone : null;
  const arriveeZone =
    input.destinationType === "zone" && estZone(input.destinationZone)
      ? input.destinationZone
      : null;

  const { data: demande, error: writeError } = await supabase
    .from("taxi_requests")
    .insert({
      client_id: profile.id,
      pickup_lat: input.pickupLat,
      pickup_lng: input.pickupLng,
      pickup_label: input.pickupLabel?.trim() || null,
      origin_zone: departZone,
      destination_zone: arriveeZone,
      destination_type: input.destinationType,
      destination_name:
        input.destinationType === "autre" ? input.destinationName?.trim() || null : null,
      proposed_price: prix,
      seats: sieges,
      expires_at: expiration,
    })
    // Chargée pour que le test de collision par client ait un sens.
    .select("id")
    .single();

  if (writeError) {
    if (TABLE_ABSENTE.includes(writeError.code)) {
      return fail("Le matching par trajet n'est pas encore activé.");
    }

    // « Une seule demande ouverte par client » : le client en a déjà une.
    if (writeError.code === "23505") {
      return fail("Vous avez déjà une demande en cours. Attendez sa réponse ou annulez-la.");
    }

    /*
      42501 — la policy a refusé la ligne.

      Ce cas a réellement bloqué toute la recherche côté client, et le message
      générique ci-dessous l'a rendu indéchiffrable. La policy d'insertion
      exigeait un chauffeur approuvé désigné par `driver_id` ; la diffusion,
      elle, naît sans destinataire. Les deux moitiés avaient cessé de se
      parler, et l'écran disait seulement « n'a pas pu être créée ».

      Corrigé par `20260907002000_taxi_insert_diffusee.sql`. La branche reste,
      parce qu'une policy peut être resserrée à nouveau un jour et que le
      prochain à tomber dessus doit lire ce qui bloque, pas le deviner.
    */
    if (writeError.code === "42501") {
      signaler(writeError, {
        ou: "policy d'insertion refusant une demande diffusée",
        quoi: { code: writeError.code, message: writeError.message },
      });
      return fail(
        "Votre compte n'a pas le droit de créer cette demande. " +
          "La migration `20260907002000_taxi_insert_diffusee` corrige ce cas.",
      );
    }

    /*
      Tout le reste part au journal avec son code.

      Le message rendu à l'écran restait volontairement vague — un code
      PostgREST ne veut rien dire pour un client. Mais ne le consigner nulle
      part transformait chaque refus en énigme : c'est exactement ce qui vient
      de se produire. Le visiteur lit une phrase, l'exploitant lit la cause.
    */
    signaler(writeError, {
      ou: "création d'une demande diffusée",
      quoi: { code: writeError.code, message: writeError.message },
    });
    return fail("La demande n'a pas pu être créée.");
  }

  const matches = await offrirDemandes(demande.id as string);

  // Avertir chaque chauffeur qui reçoit la demande : c'est le seul canal qui
  // atteint un téléphone fermé, et donc la moitié du travail du matching.
  const chauffeurs = matches.map((m) => m.driver_id);
  if (chauffeurs.length > 0) {
    await notifierChauffeurs({
      chauffeurs,
      demandeId: demande.id as string,
      depart: departNomPlat(input.pickupLabel?.trim() || null, departZone),
      destination:
        input.destinationType === "zone"
          ? (arriveeZone ?? "")
          : (input.destinationName?.trim() ?? ""),
      prix,
      sieges,
    });
  }

  return ok({ id: demande.id as string, expiresAt: expiration, matched: matches.length });
}

/**
 * Trouver les chauffeurs compatibles avec une demande déjà en attente,
 * et leur écrire une correspondance.
 *
 * Deux usages : juste après la création de la demande (appelée ci-dessus), et
 * quand un chauffeur se déclare libre ou change de trajet — une demande née
 * alors qu'aucun taxi n'était là n'a pas à attendre un chauffeur qui vient de
 * s'allumer.
 */
async function offrirDemandes(
  demandeId: string | null,
): Promise<Array<{ driver_id: string }>> {
  const admin = createAdminClient();

  try {
    const { data: demande } = await admin
      .from("taxi_requests")
      .select("id, pickup_label, origin_zone, destination_zone, destination_type, destination_name, proposed_price, seats, expires_at")
      .eq("id", demandeId ?? "")
      .maybeSingle();

    if (!demande) return [];

    /*
      Les candidats — et la destination n'est plus une condition d'entrée.

      Elle l'était : seul un chauffeur dont la zone d'arrivée déclarée était
      *exactement* celle demandée recevait la course. Avec sept zones, cela
      revenait à exiger que deux personnes aient rempli le même formulaire de
      la même façon, et la plupart des demandes ne trouvaient personne.

      Or ce n'est pas ainsi qu'on prend un taxi à Gafsa. La phrase qu'on entend
      est « je vais vers Lella, ça vous arrange ? » : la destination ouvre la
      conversation, elle ne la ferme pas. Le chauffeur qui va ailleurs peut
      proposer sa route, et le client accepte ou non.

      Ce qui reste une condition, parce que c'est ce qui rend la course
      possible : être approuvé, être libre, et **partir du bon endroit** — un
      chauffeur à l'autre bout de la ville n'est pas un candidat, quelle que
      soit sa bonne volonté. À défaut de zone de départ déclarée, l'accord de
      recevoir les destinations libres tient lieu de consentement.
    */
    const { data: chauffeurs, error } = await admin
      .from("taxi_drivers")
      .select("id, seats_free, origin_zone, destination_zone, accepts_custom")
      .eq("is_approved", true)
      .eq("status", "libre")
      .or(
        [
          // Il part de la même zone que le client, où qu'il aille ensuite.
          demande.origin_zone ? `origin_zone.eq.${demande.origin_zone}` : null,
          // Ou il a explicitement accepté les demandes qui sortent de sa route.
          "accepts_custom.eq.true",
        ]
          .filter(Boolean)
          .join(","),
      )
      .limit(50);

    if (error) {
      // Table absente : rien à déclencher, le code s'en charge plus haut.
      return [];
    }

    const sieges = demande.seats ?? 1;
    const candidats = (chauffeurs ?? []).filter(
      (d) => d.seats_free === null || d.seats_free >= sieges,
    );

    if (candidats.length === 0) return [];

    /*
      L'ordre compte : la diffusion est plafonnée, et c'est le premier qui
      accepte qui gagne. Celui dont la route correspond exactement doit donc
      être servi avant celui qui devra négocier.

        0 — même départ ET même arrivée : la course lui va telle quelle
        1 — même départ, autre arrivée : il proposera peut-être la sienne
        2 — il a seulement accepté les destinations libres
    */
    const rang = (d: {
      origin_zone: string | null;
      destination_zone: string | null;
      accepts_custom: boolean | null;
    }): number => {
      const memeDepart = demande.origin_zone !== null && d.origin_zone === demande.origin_zone;
      const memeArrivee =
        demande.destination_zone !== null && d.destination_zone === demande.destination_zone;

      if (memeDepart && memeArrivee) return 0;
      if (memeDepart) return 1;
      return 2;
    };

    const retenus = [...candidats].sort((a, b) => rang(a) - rang(b)).slice(0, 20);

    const lignes = retenus.map((d) => ({
      request_id: demande.id as string,
      driver_id: d.id,
      pickup_label: demande.pickup_label,
      origin_zone: demande.origin_zone,
      destination_zone: demande.destination_zone,
      destination_type: demande.destination_type,
      destination_name: demande.destination_name,
      proposed_price: demande.proposed_price,
      seats: demande.seats,
      expires_at: demande.expires_at,
    }));

    const { error: insertion } = await admin
      .from("taxi_request_matches")
      .upsert(lignes, { onConflict: "request_id,driver_id", ignoreDuplicates: true });

    if (insertion) return [];
    return retenus.map((d) => ({ driver_id: d.id }));
  } catch (cause) {
    signaler(cause, { ou: "diffusion d'une demande de course", quoi: { demande: demandeId } });
    return [];
  }
}

/**
 * Offrir les demandes en attente à un chauffeur qui vient de se déclarer
 * libre, ou de poser une route. Exporté pour `setDriverStatus`.
 */
export async function offrirDemandesAuChauffeur(driverId: string) {
  try {
    const admin = createAdminClient();

    const { data: driver } = await admin
      .from("taxi_drivers")
      .select("id, status, is_approved, origin_zone, destination_zone, accepts_custom, seats_free")
      .eq("id", driverId)
      .maybeSingle();

    if (!driver || !driver.is_approved || driver.status !== "libre") return;

    const siegesCond = (sieges: number) => driver.seats_free === null || driver.seats_free >= sieges;

    if (driver.origin_zone && driver.destination_zone) {
      const { data: enAttente } = await admin
        .from("taxi_requests")
        .select("id, pickup_label, origin_zone, destination_zone, destination_type, destination_name, proposed_price, seats, expires_at")
        .eq("status", "en_attente")
        .is("driver_id", null)
        .eq("destination_type", "zone")
        .eq("origin_zone", driver.origin_zone)
        .eq("destination_zone", driver.destination_zone)
        .gt("expires_at", new Date().toISOString())
        .limit(30);

      const lignes = (enAttente ?? [])
        .filter((d) => siegesCond(d.seats ?? 1))
        .map((d) => instantane(d, driver.id));

      if (lignes.length > 0) {
        await admin
          .from("taxi_request_matches")
          .upsert(lignes, { onConflict: "request_id,driver_id", ignoreDuplicates: true });

        // Celui qui arrive retrouve du travail : autant le prévenir tout de
        // suite, applis fermées comprises.
        await notifierChauffeurs({
          chauffeurs: [driver.id],
          demandeId: lignes[0].request_id,
          depart: departNomPlat(null, driver.origin_zone),
          destination: driver.destination_zone ?? "",
          prix: lignes[0].proposed_price ?? null,
          sieges: lignes[0].seats ?? 1,
        });
      }
    }

    if (driver.accepts_custom) {
      const { data: enAttente } = await admin
        .from("taxi_requests")
        .select("id, pickup_label, origin_zone, destination_zone, destination_type, destination_name, proposed_price, seats, expires_at")
        .eq("status", "en_attente")
        .is("driver_id", null)
        .eq("destination_type", "autre")
        .gt("expires_at", new Date().toISOString())
        .limit(30);

      const lignes = (enAttente ?? [])
        .filter((d) => siegesCond(d.seats ?? 1))
        .map((d) => instantane(d, driver.id));

      if (lignes.length > 0) {
        await admin
          .from("taxi_request_matches")
          .upsert(lignes, { onConflict: "request_id,driver_id", ignoreDuplicates: true });
      }
    }
  } catch (cause) {
    signaler(cause, { ou: "offre de demandes à un chauffeur", quoi: { chauffeur: driverId } });
  }
}

/** Rendre une demande lisible par un chauffeur donné, sans exposer la sienne. */
function instantane(
  demande: {
    id: string;
    pickup_label: string | null;
    origin_zone: string | null;
    destination_zone: string | null;
    destination_type: "zone" | "autre";
    destination_name: string | null;
    proposed_price: number | null;
    seats: number;
    expires_at: string;
  },
  driverId: string,
) {
  return {
    request_id: demande.id,
    driver_id: driverId,
    pickup_label: demande.pickup_label,
    origin_zone: demande.origin_zone,
    destination_zone: demande.destination_zone,
    destination_type: demande.destination_type,
    destination_name: demande.destination_name,
    proposed_price: demande.proposed_price,
    seats: demande.seats,
    expires_at: demande.expires_at,
  };
}

/** Un nom de départ à montrer, zone ou libellé libre. */
function departNomPlat(libelle: string | null, zone: string | null): string {
  if (libelle) return libelle;
  const trouve = (["gafsa_centre", "ksar", "hay_nour", "hay_sourour", "hay_chabeb", "dwali", "lella"] as const).find(
    (id) => id === zone,
  );
  return trouve ?? "Ma position";
}

/**
 * Le chauffeur accepte ou refuse une demande diffusée.
 *
 * Refuser ne fait que retirer sa propre correspondance : la demande continue
 * vers les autres chauffeurs. Accepter est le seul moment où deux mains se
 * battent pour une course — et une seule doit l'emporter.
 */
export async function repondreDemandeDiffusee(demandeId: string, accepte: boolean) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const admin = createAdminClient();

  if (!accepte) {
    /*
      Le refus ne touche pas la demande : elle vit pour les autres. On retire
      simplement l'offre qu'on a reçue, et l'écran du chauffeur n'a plus rien.
      Si quelqu'un l'a prise entre-temps, il n'y a tout simplement rien à
      retirer.
    */
    const { error: suppression } = await supabase
      .from("taxi_request_matches")
      .delete()
      .eq("request_id", demandeId)
      .eq("driver_id", profile.id);

    if (suppression && !TABLE_ABSENTE.includes(suppression.code)) {
      return fail("Le refus n'a pas pu être enregistré.");
    }
    return done();
  }

  /*
    Assez de places, là, maintenant.

    Une correspondance est un instantané ; les places, elles, bougent. Contrôler
    au moment de l'acceptation empêche d'accepter une course pour laquelle la
    dernière place est déjà partie entre-temps.
  */
  const { data: chauffeur } = await admin
    .from("taxi_drivers")
    .select("*")
    .eq("id", profile.id)
    .maybeSingle();

  if (!chauffeur) return fail("Vous n'êtes pas inscrit comme chauffeur");
  if (!chauffeur.is_approved) return fail("Votre inscription n'est pas encore vérifiée");

  const presence = presenceDe(chauffeur);
  if (!presence.joignable) return fail("Vous n'êtes pas disponible actuellement");

  /*
    Cette demande lui a-t-elle été adressée ?

    Le contrôle manquait. La fonction vérifiait l'approbation, la présence et
    les places, puis écrivait avec la clé de service — sans jamais relire
    `taxi_request_matches`. N'importe quel chauffeur approuvé et libre pouvait
    donc prendre une course dont il connaissait l'identifiant, hors de sa zone
    déclarée. Le cas concret : refuser une demande supprime sa propre ligne de
    correspondance, mais rien n'empêchait de rejouer l'acceptation ensuite.

    La correspondance est la trace de « on vous l'a proposée ». Sans elle, il
    n'y a pas d'offre, donc rien à accepter. Un chauffeur qui trouve une course
    par la recherche de proximité passe par `accepterDemandeProche`, qui crée
    la correspondance après avoir revérifié la distance côté serveur.
  */
  const { data: correspondance } = await admin
    .from("taxi_request_matches")
    .select("request_id")
    .eq("request_id", demandeId)
    .eq("driver_id", profile.id)
    .maybeSingle();

  if (!correspondance) {
    return fail("Cette demande ne vous a pas été proposée.");
  }

  const { data: demande } = await admin
    .from("taxi_requests")
    .select("id, status, seats, proposed_price")
    .eq("id", demandeId)
    .maybeSingle();

  if (!demande || demande.status !== "en_attente") {
    return fail("Cette demande n'est plus en attente");
  }

  const sieges = demande.seats ?? 1;
  if (presence.places !== null && presence.places < sieges) {
    return fail(
      presence.places === 0
        ? "Votre véhicule est complet"
        : `Il ne reste que ${presence.places} place${presence.places > 1 ? "s" : ""}`,
    );
  }

  /*
    L'écriture gagnante : un seul chauffeur peut passer cette ligne.

    La condition `status = 'en_attente'` et `driver_id is null` garantit qu'un
    autre chauffeur, qui a déjà accepté dans la même seconde, n'est pas
    réécrit par-dessus. Celui qui arrive après lit zéro ligne et le sait.
  */
  const { data: pris, error: ecriture } = await admin
    .from("taxi_requests")
    .update({
      driver_id: profile.id,
      status: "acceptee",
      accepted_price: demande.proposed_price,
      responded_at: new Date().toISOString(),
    })
    .eq("id", demandeId)
    .eq("status", "en_attente")
    .is("driver_id", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();

  if (ecriture) return fail("L'acceptation n'a pas pu être enregistrée.");
  if (!pris) {
    return fail("Cette demande vient d'être prise par un autre chauffeur.");
  }

  // La course a un chauffeur : plus personne d'autre ne doit la voir.
  await admin.from("taxi_request_matches").delete().eq("request_id", demandeId);

  await consommerPlaces(profile.id, sieges);
  await notifierClientAccepte(demandeId, profile);
  return done();
}

/**
 * Retirer les places prises, et fermer le véhicule quand il est plein.
 * Même contrat que dans `taxi-course.ts` : relu puis réécrit, pour que le
 * calcul du statut ne vive qu'à un seul endroit.
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

    /*
      Plus de sortie anticipée quand les places sont inconnues.

      Elle empêchait l'écriture entière — donc aussi le passage en « occupé » —
      pour le cas le plus courant : un chauffeur qui n'a jamais renseigné ses
      places. Il restait « libre » après avoir accepté, et pouvait accepter
      encore. La fonction distingue désormais les deux questions :
      le chiffre reste inconnu, la disponibilité ne l'est pas.
    */
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
    signaler(cause, { ou: "décompte des places", quoi: { chauffeur: driverId, sieges } });
  }
}

/** Prévenir les chauffeurs d'une demande fraîche, par la cloche push. */
async function notifierChauffeurs(info: {
  chauffeurs: string[];
  demandeId: string;
  depart: string;
  destination: string;
  prix: number | null;
  sieges: number;
}) {
  try {
    const admin = createAdminClient();

    const titre = "🚕 Nouveau client";
    const corps = [
      `${info.depart} → ${info.destination}`,
      info.prix !== null ? `${info.prix} DT` : null,
      info.sieges > 1 ? `${info.sieges} personnes` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    await admin.from("notifications").insert(
      info.chauffeurs.map((driverId) => ({
        user_id: driverId,
        kind: "taxi_request",
        title: titre,
        body: corps,
        link: `/taxi/chauffeur?demande=${info.demandeId}`,
      })),
    );
  } catch (cause) {
    signaler(cause, { ou: "notification de demande diffusée" });
  }
}

/** Le client apprend qu'un chauffeur l'a pris en charge. */
async function notifierClientAccepte(demandeId: string, chauffeur: { id: string }) {
  try {
    const admin = createAdminClient();

    const { data: demande } = await admin
      .from("taxi_requests")
      .select("client_id")
      .eq("id", demandeId)
      .maybeSingle();

    if (!demande) return;

    const { data: fiche } = await admin
      .from("taxi_drivers")
      .select("display_name")
      .eq("id", chauffeur.id)
      .maybeSingle();

    await admin.from("notifications").insert({
      user_id: demande.client_id,
      kind: "taxi_request",
      title: fiche?.display_name ? `${fiche.display_name} arrive` : "Chauffeur trouvé",
      body:
        "Votre course est acceptée. Retrouvez le chauffeur, son téléphone et la discussion sur l'écran.",
      link: "/taxi",
    });
  } catch (cause) {
    signaler(cause, { ou: "notification d'acceptation au client" });
  }
}

/**
 * « Confirmer la course » : le client entérine après l'échange (téléphone ou
 * messages). Sans changer de statut — `acceptee` reste la course en cours —
 * la confirmation prévient le chauffeur qu'il peut venir.
 */
export async function confirmerCourse(demandeId: string) {
  const { profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const admin = createAdminClient();

  const { data: demande } = await admin
    .from("taxi_requests")
    .select("client_id, driver_id, status")
    .eq("id", demandeId)
    .maybeSingle();

  if (!demande || demande.client_id !== profile.id) return fail("Demande introuvable");
  if (demande.driver_id === null) return fail("Aucun chauffeur n'a encore accepté");
  if (demande.status !== "acceptee") return fail("Cette course n'est pas en cours");

  const clientNom = fullName(profile) || "Un client";

  try {
    await admin.from("notifications").insert({
      user_id: demande.driver_id,
      kind: "taxi_request",
      title: `${clientNom} a confirmé la course`,
      body: "Vous pouvez démarrer. Bonne route !",
      link: "/taxi/chauffeur",
    });
  } catch (cause) {
    signaler(cause, { ou: "notification de confirmation au chauffeur" });
  }

  return done();
}

/** Le client se ravise : la demande est annulée, la diffusion nettoyée. */
export async function annulerDemandeDiffusee(demandeId: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { data: annulee, error: writeError } = await supabase
    .from("taxi_requests")
    .update({ status: "annulee", responded_at: new Date().toISOString() })
    .eq("id", demandeId)
    .eq("client_id", profile.id)
    .eq("status", "en_attente")
    .select("id")
    .maybeSingle();

  if (writeError) return fail("L'annulation n'a pas pu être enregistrée.");

  if (annulee) {
    const admin = createAdminClient();
    await admin.from("taxi_request_matches").delete().eq("request_id", demandeId);
  }

  return done();
}

/* ─── Aux hommes de taxi : déclarer ce qu'on sert ─────────────────────── */

export async function updateDriverRoute(input: {
  originZone: string | null;
  destinationZone: string | null;
  acceptCustom: boolean;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const origine = input.originZone && estZone(input.originZone) ? input.originZone : null;
  const arrivee = input.destinationZone && estZone(input.destinationZone) ? input.destinationZone : null;

  if (origine || arrivee) {
    if (!origine || !arrivee) return fail("Choisissez la zone de départ et la destination");
  }

  const { error: writeError } = await supabase
    .from("taxi_drivers")
    .update({
      origin_zone: origine,
      destination_zone: arrivee,
      accepts_custom: input.acceptCustom,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (writeError) return fail("Le trajet n'a pas pu être enregistré.");

  // Une route neuve peut correspondre à des demandes nées avant elle.
  await offrirDemandesAuChauffeur(profile.id);

  return done();
}
