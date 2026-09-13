"use server";

import { done, fail, ok, requireAdmin } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { signaler } from "@/lib/signal";
import { TAXI_ZONES, type TaxiZoneId } from "@/lib/taxi-zones";

/* ═══════════════════════════════════════════════════════════════════════
   Une flotte de chauffeurs qui n'existent pas, dans une base qui existe.

   ────────────────────────────────────────────────────────────────────────
   Pourquoi de vrais comptes, et non des repères dessinés
   ────────────────────────────────────────────────────────────────────────

   Le réflexe serait de peindre six taxis sur la carte côté navigateur. Ce
   serait une maquette : elle ne dirait rien de ce qu'on veut éprouver — les
   policies, l'unicité du matching, le décompte des places, l'expiration.
   Les défauts qui ont coûté le plus cher à ce projet étaient tous côté base,
   et aucun n'aurait été visible sur des marqueurs factices.

   La flotte est donc réelle : des comptes, des profils, des lignes dans
   `taxi_drivers`. Elle traverse exactement les mêmes policies que n'importe
   quel chauffeur, et c'est le seul moyen d'en tirer une conclusion.

   ────────────────────────────────────────────────────────────────────────
   Deux verrous, parce qu'un seul se contourne
   ────────────────────────────────────────────────────────────────────────

   Ce module crée des comptes et écrit avec la clé de service. Il n'a rien à
   faire en production, et « rien à faire » ne suffit pas : il faut que ce
   soit impossible.

     · `NODE_ENV` — sur Vercel, la production l'est toujours ;
     · `requireAdmin()` — même en développement, un visiteur de passage ne
       fabrique pas une flotte.

   Les comptes portent `@simulation.mall-express.test`. Le domaine `.test`
   est réservé par la RFC 2606 et Supabase le refuse à l'inscription
   publique : aucun compte réel ne peut entrer en collision. Le nettoyage
   existant les emporte :

     node scripts/clean-test-accounts.mjs @simulation.mall-express.test
   ═══════════════════════════════════════════════════════════════════════ */

/** Le domaine des comptes simulés. Réservé, donc sans collision possible. */
const DOMAINE = "@simulation.mall-express.test";

/** Un mot de passe fixe : ces comptes ne se connectent jamais depuis l'écran. */
const MOT_DE_PASSE = "simulation-mall-express-2026";

export type StatutSimule = "libre" | "places" | "occupe" | "hors_ligne";

export interface ChauffeurSimule {
  id: string;
  nom: string;
  telephone: string;
  vehicule: string | null;
  plaque: string | null;
  statut: StatutSimule;
  lat: number | null;
  lng: number | null;
  placesTotal: number | null;
  placesLibres: number | null;
  zoneDepart: string | null;
  zoneArrivee: string | null;
  accepteLibre: boolean;
  approuve: boolean;
}

/**
 * La flotte de départ.
 *
 * Six profils choisis pour couvrir les cas qui se comportent différemment,
 * pas pour faire nombre. Chacun existe parce qu'il casse quelque chose que
 * les autres ne cassent pas :
 *
 *   01, 02  deux libres au même endroit — la course concurrente se teste là ;
 *   03      occupé : il ne doit apparaître dans aucune proposition ;
 *   04      hors ligne : il ne doit pas même figurer sur la carte ;
 *   05      libre sans places déclarées — le cas par défaut, celui qui a
 *           laissé un chauffeur « libre » après acceptation pendant des
 *           semaines ;
 *   06      libre mais sur un autre trajet, et refusant les destinations
 *           libres : c'est lui qui vérifie que la destination n'est plus une
 *           contrainte mais une préférence.
 */
const FLOTTE: ReadonlyArray<{
  cle: string;
  nom: string;
  telephone: string;
  vehicule: string;
  plaque: string;
  statut: StatutSimule;
  zone: TaxiZoneId;
  /** Décalage en degrés depuis le centre de la zone, pour ne pas les empiler. */
  decalage: [number, number];
  placesTotal: number | null;
  placesLibres: number | null;
  zoneArrivee: TaxiZoneId | null;
  accepteLibre: boolean;
}> = [
  {
    cle: "sim01", nom: "Taxi 01 · Sim", telephone: "20000001",
    vehicule: "Peugeot 301", plaque: "SIM 001", statut: "libre",
    zone: "gafsa_centre", decalage: [0.001, 0.001],
    placesTotal: 4, placesLibres: 4, zoneArrivee: "lella", accepteLibre: true,
  },
  {
    cle: "sim02", nom: "Taxi 02 · Sim", telephone: "20000002",
    vehicule: "Citroën C-Elysée", plaque: "SIM 002", statut: "libre",
    zone: "gafsa_centre", decalage: [-0.0012, 0.0008],
    placesTotal: 4, placesLibres: 4, zoneArrivee: "lella", accepteLibre: true,
  },
  {
    cle: "sim03", nom: "Taxi 03 · Sim", telephone: "20000003",
    vehicule: "Dacia Logan", plaque: "SIM 003", statut: "occupe",
    zone: "ksar", decalage: [0.0008, -0.0011],
    placesTotal: 4, placesLibres: 0, zoneArrivee: null, accepteLibre: false,
  },
  {
    cle: "sim04", nom: "Taxi 04 · Sim", telephone: "20000004",
    vehicule: "Renault Symbol", plaque: "SIM 004", statut: "hors_ligne",
    zone: "hay_nour", decalage: [0.0005, 0.0014],
    placesTotal: 4, placesLibres: 4, zoneArrivee: null, accepteLibre: false,
  },
  {
    cle: "sim05", nom: "Taxi 05 · Sim", telephone: "20000005",
    vehicule: "Hyundai Accent", plaque: "SIM 005", statut: "libre",
    zone: "hay_sourour", decalage: [-0.0009, -0.0006],
    // Places non renseignées : le cas par défaut, et le plus révélateur.
    placesTotal: null, placesLibres: null, zoneArrivee: "gafsa_centre", accepteLibre: true,
  },
  {
    cle: "sim06", nom: "Taxi 06 · Sim", telephone: "20000006",
    vehicule: "Skoda Fabia", plaque: "SIM 006", statut: "libre",
    zone: "dwali", decalage: [0.0011, 0.0009],
    placesTotal: 4, placesLibres: 2, zoneArrivee: "hay_chabeb", accepteLibre: false,
  },
];

/**
 * Les deux verrous, appliqués avant tout.
 *
 * Retourne un message d'erreur, ou `null` quand la voie est libre.
 */
async function garde(): Promise<string | null> {
  if (process.env.NODE_ENV === "production") {
    return "Le simulateur est désactivé en production.";
  }

  const { profile, error } = await requireAdmin();
  if (!profile) return error;

  return null;
}

function emailDe(cle: string): string {
  return `${cle}${DOMAINE}`;
}

/* ─── Lire la flotte ──────────────────────────────────────────────────── */

export async function listerFlotte() {
  const refus = await garde();
  if (refus) return fail(refus);

  const admin = createAdminClient();

  /*
    On repère les simulés par leur téléphone, pas par leur nom.

    Le nom est modifiable depuis l'écran chauffeur ; le téléphone de ces
    comptes ne l'est jamais, puisqu'ils n'ont pas d'utilisateur pour le
    changer. C'est le seul champ sur lequel le filtre reste vrai.
  */
  const telephones = FLOTTE.map((f) => f.telephone);

  const { data, error: lectureError } = await admin
    .from("taxi_drivers")
    .select("*")
    .in("phone", telephones);

  if (lectureError) return fail("La flotte n'a pas pu être relue.");

  const lignes = (data ?? []) as Array<Record<string, unknown>>;

  return ok<ChauffeurSimule[]>(
    lignes
      .map((d) => ({
        id: String(d.id),
        nom: String(d.display_name),
        telephone: String(d.phone),
        vehicule: (d.vehicle as string | null) ?? null,
        plaque: (d.plate as string | null) ?? null,
        statut: ((d.status as StatutSimule) ?? "hors_ligne"),
        lat: (d.lat as number | null) ?? null,
        lng: (d.lng as number | null) ?? null,
        placesTotal: (d.seats_total as number | null) ?? null,
        placesLibres: (d.seats_free as number | null) ?? null,
        zoneDepart: (d.origin_zone as string | null) ?? null,
        zoneArrivee: (d.destination_zone as string | null) ?? null,
        accepteLibre: Boolean(d.accepts_custom),
        approuve: Boolean(d.is_approved),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom)),
  );
}

/* ─── Créer la flotte ─────────────────────────────────────────────────── */

/**
 * Crée les six chauffeurs, ou remet ceux qui existent dans leur état initial.
 *
 * Idempotente : la relancer ne double personne. C'est ce qui permet de s'en
 * servir comme d'un bouton « remettre à zéro » entre deux essais, sans avoir
 * à tout supprimer d'abord.
 */
export async function creerFlotte() {
  const refus = await garde();
  if (refus) return fail(refus);

  const admin = createAdminClient();
  let crees = 0;
  let reinitialises = 0;

  for (const f of FLOTTE) {
    const zone = TAXI_ZONES.find((z) => z.id === f.zone)!;
    const lat = zone.lat + f.decalage[0];
    const lng = zone.lng + f.decalage[1];

    // Le compte existe-t-il déjà ? On le retrouve par son téléphone.
    const { data: existant } = await admin
      .from("taxi_drivers")
      .select("id")
      .eq("phone", f.telephone)
      .maybeSingle();

    let id = existant?.id ?? null;

    if (!id) {
      /*
        Le compte d'authentification d'abord : le trigger `handle_new_user`
        crée le profil derrière, et c'est lui qui rend la clé étrangère de
        `taxi_drivers` satisfaisable.
      */
      const { data: cree, error: authError } = await admin.auth.admin.createUser({
        email: emailDe(f.cle),
        password: MOT_DE_PASSE,
        email_confirm: true,
        user_metadata: { first_name: f.nom, role: "client" },
      });

      if (authError || !cree.user) {
        // Déjà pris : le compte existe sans fiche chauffeur, on le retrouve.
        const { data: liste } = await admin.auth.admin.listUsers({ perPage: 200 });
        const trouve = liste?.users.find((u) => u.email === emailDe(f.cle));
        if (!trouve) {
          signaler(authError, { ou: "création d'un chauffeur simulé", quoi: { cle: f.cle } });
          continue;
        }
        id = trouve.id;
      } else {
        id = cree.user.id;
        crees += 1;
      }
    } else {
      reinitialises += 1;
    }

    const { error: writeError } = await admin.from("taxi_drivers").upsert(
      {
        id,
        display_name: f.nom,
        phone: f.telephone,
        vehicle: f.vehicule,
        plate: f.plaque,
        // Approuvés d'office : la file de vérification n'est pas le sujet ici.
        is_approved: true,
        status: f.statut,
        status_since: new Date().toISOString(),
        is_available: f.statut === "libre" || f.statut === "places",
        lat,
        lng,
        position_updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        seats_total: f.placesTotal,
        seats_free: f.placesLibres,
        origin_zone: f.zone,
        destination_zone: f.zoneArrivee,
        accepts_custom: f.accepteLibre,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (writeError) {
      signaler(writeError, { ou: "écriture d'un chauffeur simulé", quoi: { cle: f.cle } });
    }
  }

  return ok({ crees, reinitialises });
}

/* ─── Piloter un chauffeur simulé ─────────────────────────────────────── */

export async function deplacerSimule(input: { id: string; lat: number; lng: number }) {
  const refus = await garde();
  if (refus) return fail(refus);

  if (!Number.isFinite(input.lat) || Math.abs(input.lat) > 90) return fail("Latitude invalide");
  if (!Number.isFinite(input.lng) || Math.abs(input.lng) > 180) return fail("Longitude invalide");

  const admin = createAdminClient();

  const { error: writeError } = await admin
    .from("taxi_drivers")
    .update({
      lat: input.lat,
      lng: input.lng,
      position_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (writeError) return fail("La position n'a pas pu être écrite.");
  return done();
}

/**
 * Changer l'état d'un chauffeur simulé.
 *
 * Écrit `is_available` en parallèle de `status`, exactement comme le fait
 * `setDriverStatus` pour un vrai chauffeur : la simulation doit produire des
 * lignes indiscernables de la réalité, sans quoi elle testerait autre chose.
 */
export async function etatSimule(input: { id: string; statut: StatutSimule }) {
  const refus = await garde();
  if (refus) return fail(refus);

  const admin = createAdminClient();

  const { error: writeError } = await admin
    .from("taxi_drivers")
    .update({
      status: input.statut,
      status_since: new Date().toISOString(),
      is_available: input.statut === "libre" || input.statut === "places",
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (writeError) return fail("L'état n'a pas pu être écrit.");
  return done();
}

/**
 * Simuler la perte du GPS.
 *
 * On efface la position, on ne touche pas au statut — c'est précisément la
 * distinction que `taxi-presence.ts` défend : un chauffeur dont on ignore la
 * position reste joignable, et il doit rester dans la liste avec la mention
 * « position inconnue » plutôt que disparaître.
 */
export async function perdreGpsSimule(id: string) {
  const refus = await garde();
  if (refus) return fail(refus);

  const admin = createAdminClient();

  const { error: writeError } = await admin
    .from("taxi_drivers")
    .update({ lat: null, lng: null, position_updated_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (writeError) return fail("La position n'a pas pu être effacée.");
  return done();
}

/* ─── Accepter une course au nom d'un simulé ──────────────────────────── */

/**
 * Le chauffeur simulé accepte une demande.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi cette fonction ne réutilise pas `repondreDemandeDiffusee`
 * ────────────────────────────────────────────────────────────────────────
 *
 * Elle le voudrait — c'est le chemin réel, avec son contrôle d'appartenance
 * et son décompte. Mais cette fonction lit `auth.uid()` par `requireProfile()`
 * : elle agit *au nom de la personne connectée*, qui est ici l'administrateur
 * en train de tester, jamais le chauffeur simulé.
 *
 * On reproduit donc **la seule chose qui compte pour la concurrence** :
 * l'écriture gagnante conditionnelle. Les trois conditions ci-dessous sont
 * copiées mot pour mot de `taxi-matching.ts` — si elles y changent et pas
 * ici, la simulation cesserait de prouver quoi que ce soit. C'est le prix,
 * et il est écrit ici pour qu'on le sache.
 */
export async function accepterPourSimule(input: { id: string; demandeId: string }) {
  const refus = await garde();
  if (refus) return fail(refus);

  const admin = createAdminClient();

  const { data: pris, error: writeError } = await admin
    .from("taxi_requests")
    .update({
      driver_id: input.id,
      status: "acceptee",
      responded_at: new Date().toISOString(),
    })
    .eq("id", input.demandeId)
    .eq("status", "en_attente")
    .is("driver_id", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, seats")
    .maybeSingle();

  if (writeError) return fail("L'acceptation n'a pas pu être enregistrée.");
  if (!pris) return fail("Cette demande vient d'être prise par un autre chauffeur.");

  // La diffusion s'éteint pour tout le monde, comme sur le chemin réel.
  await admin.from("taxi_request_matches").delete().eq("request_id", input.demandeId);

  // Et le véhicule cesse d'être proposé.
  await etatSimule({ id: input.id, statut: "occupe" });

  return done();
}

/* ─── Effacer la flotte ───────────────────────────────────────────────── */

/**
 * Supprime les comptes simulés, et tout ce qui pend après eux.
 *
 * L'ordre suit les clés étrangères : les demandes d'abord — elles référencent
 * le chauffeur en `restrict` du côté des commandes et en `cascade` ici, mais
 * les laisser produirait des courses orphelines dans les écrans —, puis la
 * fiche, puis le compte, dont la suppression emporte le profil en cascade.
 */
export async function supprimerFlotte() {
  const refus = await garde();
  if (refus) return fail(refus);

  const admin = createAdminClient();
  const telephones = FLOTTE.map((f) => f.telephone);

  const { data: fiches } = await admin
    .from("taxi_drivers")
    .select("id")
    .in("phone", telephones);

  const ids = (fiches ?? []).map((f) => f.id);
  if (ids.length === 0) return ok({ supprimes: 0 });

  await admin.from("taxi_request_matches").delete().in("driver_id", ids);
  await admin.from("taxi_requests").delete().in("driver_id", ids);
  await admin.from("taxi_messages").delete().in("driver_id", ids);
  await admin.from("taxi_drivers").delete().in("id", ids);

  let supprimes = 0;
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) supprimes += 1;
    else signaler(error, { ou: "suppression d'un compte simulé", quoi: { id } });
  }

  return ok({ supprimes });
}
