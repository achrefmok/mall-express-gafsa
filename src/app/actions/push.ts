"use server";

import { fail, done, requireProfile } from "./_helpers";

/* ═══════════════════════════════════════════════════════════════════════
   Abonnements aux notifications poussées.

   Un enregistrement par appareil et par navigateur : le même client sur son
   téléphone et sur son ordinateur en a deux, et doit être prévenu sur les deux.
   ═══════════════════════════════════════════════════════════════════════ */

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  if (!input.endpoint.startsWith("https://")) return fail("Abonnement invalide");
  if (!input.p256dh || !input.auth) return fail("Clés de chiffrement manquantes");

  /*
    Conflit sur l'adresse, et non sur l'utilisateur.

    Un navigateur qui redemande un abonnement rend parfois la même adresse. Sans
    ce `upsert`, la personne se retrouverait avec deux enregistrements identiques
    et recevrait chaque notification en double — le genre de défaut qui fait
    couper les notifications pour de bon.

    Le propriétaire est réécrit au passage : un appareil partagé, ou un compte
    changé sur le même téléphone, doit prévenir la personne qui s'y est connectée
    en dernier, pas la précédente.
  */
  const { error: writeError } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: profile.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 200) ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (writeError) return fail(writeError.message);
  return done();
}

/** Retirer cet appareil. Appelé quand la personne coupe les notifications. */
export async function removePushSubscription(endpoint: string) {
  const { supabase, profile, error } = await requireProfile();
  if (!profile) return fail(error);

  const { error: writeError } = await supabase
    .from("push_subscriptions")
    .delete()
    .match({ user_id: profile.id, endpoint });

  if (writeError) return fail(writeError.message);
  return done();
}
