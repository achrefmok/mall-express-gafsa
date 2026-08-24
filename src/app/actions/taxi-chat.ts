"use server";

import { done, fail, requireUser } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Envoyer un message de taxi — et prévenir celui à qui il s'adresse.
 *
 * **C'est la seconde moitié qui manquait.** Les messages s'enregistraient bien :
 * cinq attendaient en base, tous écrits par des clients, aucun lu. Personne
 * n'était averti, et la conversation ne fonctionnait donc qu'à la condition
 * absurde que les deux personnes aient l'écran ouvert au même instant — le
 * client depuis le trottoir, le chauffeur au volant.
 *
 * L'envoi passe désormais par ici plutôt que par une écriture directe depuis le
 * navigateur, pour une seule raison : la notification. La table `notifications`
 * n'accepte aucune écriture d'un navigateur, et c'est très bien ainsi — sans
 * quoi n'importe qui pourrait faire apparaître n'importe quoi dans la cloche de
 * n'importe qui.
 *
 * Le message, lui, reste écrit avec la session de l'expéditeur : les policies
 * s'appliquent, et l'on ne peut toujours pas écrire au nom d'un autre. Seule la
 * notification emprunte la clé de service, sur un contenu que l'action a
 * entièrement déterminé — jamais sur ce que le navigateur a envoyé.
 */
export async function envoyerMessageTaxi(input: {
  driverId: string;
  clientId: string;
  body: string;
}) {
  const { supabase, user, error } = await requireUser();
  if (!user) return fail(error);

  const corps = input.body.trim();
  if (corps.length === 0) return fail("Message vide");
  if (corps.length > 500) return fail("Message trop long");

  /*
    De quel côté du fil écrit-on ?

    On ne le demande pas au navigateur : il suffirait de mentir pour faire
    passer un message pour celui du chauffeur. On le déduit de l'identité — si
    l'auteur est le chauffeur du fil, c'est lui ; sinon c'est le client, et il
    ne peut alors écrire que dans son propre fil.
  */
  const fromDriver = user.id === input.driverId;
  if (!fromDriver && user.id !== input.clientId) return fail("Conversation inaccessible");

  const { error: writeError } = await supabase.from("taxi_messages").insert({
    driver_id: input.driverId,
    client_id: input.clientId,
    from_driver: fromDriver,
    body: corps,
  });

  if (writeError) return fail("Le message n'a pas pu être envoyé.");

  const destinataire = fromDriver ? input.clientId : input.driverId;

  /*
    Quelqu'un qui s'écrit à lui-même n'a pas besoin d'être prévenu.

    Le cas existe déjà en base — un chauffeur qui essaie la messagerie depuis la
    vue client — et il n'a rien d'anormal.
  */
  if (destinataire === user.id) return done();

  await notifier(destinataire, fromDriver, corps, input.driverId);
  return done();
}

/**
 * La notification, avec le nom de qui écrit.
 *
 * Elle échoue en silence si elle échoue : un message envoyé mais non annoncé
 * vaut mieux qu'un message perdu parce que la cloche n'a pas marché. C'est la
 * conversation qui porte le service, la notification n'est qu'un rappel.
 */
async function notifier(
  destinataire: string,
  fromDriver: boolean,
  corps: string,
  driverId: string,
) {
  try {
    const admin = createAdminClient();

    let expediteur = fromDriver ? "Un chauffeur" : "Un client";

    if (fromDriver) {
      const { data } = await admin
        .from("taxi_drivers")
        .select("display_name")
        .eq("id", driverId)
        .maybeSingle();
      if (data?.display_name) expediteur = data.display_name;
    }

    await admin.from("notifications").insert({
      user_id: destinataire,
      kind: "new_message",
      title: `${expediteur} · taxi`,
      // Le message dans le corps de la notification : c'est souvent tout ce
      // qu'il faut pour décider s'il vaut la peine d'ouvrir l'application.
      body: corps.slice(0, 140),
      link: fromDriver ? "/taxi" : "/taxi/chauffeur",
    });
  } catch {
    // Voir plus haut : la notification ne fait pas échouer l'envoi.
  }
}
