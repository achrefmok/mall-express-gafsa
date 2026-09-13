import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La fiche publique d'un chauffeur, lue une fois par requête.
 *
 * Le layout s'en sert pour répondre 404, la page pour s'afficher, les
 * métadonnées pour le titre. Sans le cache de React, ce seraient trois appels
 * à la même fonction SQL pour une seule visite.
 *
 * Un identifiant qui n'a pas la forme d'un UUID ne va pas jusqu'à la base :
 * Postgres le refuserait avec une erreur de syntaxe, qu'il n'y a aucune
 * raison de provoquer.
 */
export const lireChauffeur = cache(async (id: string) => {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("taxi_profil_public", { p_chauffeur: id });
  return data ?? null;
});
