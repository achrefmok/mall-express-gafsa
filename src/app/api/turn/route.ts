import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Des identifiants TURN à durée de vie courte, délivrés à qui est connecté.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que cette route remplace
 * ────────────────────────────────────────────────────────────────────────
 *
 * Les identifiants du serveur TURN étaient lus depuis `NEXT_PUBLIC_TURN_USERNAME`
 * et `NEXT_PUBLIC_TURN_CREDENTIAL`. Le préfixe dit exactement ce qui se passait :
 * ces valeurs partaient dans le paquet JavaScript de tout le monde, en clair,
 * et elles ne changeaient jamais.
 *
 * Un serveur TURN relaie de la vidéo. Il se paie à la bande passante, et un
 * identifiant permanent trouvé dans un fichier public est un relais gratuit
 * pour quiconque le ramasse — pour du trafic qui n'a plus rien à voir avec la
 * plateforme, facturé à son propriétaire.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le mécanisme, qui est celui de coturn
 * ────────────────────────────────────────────────────────────────────────
 *
 * On ne stocke aucun identifiant. Le serveur TURN et cette route partagent un
 * secret, et chacun sait en dériver la même chose :
 *
 *     username   = «échéance en secondes Unix»
 *     credential = base64( HMAC-SHA1( secret, username ) )
 *
 * Le serveur TURN recalcule le HMAC à la connexion et refuse tout ce qui ne
 * correspond pas, ou dont l'échéance est passée. Un identifiant ramassé dans
 * le trafic ne vaut donc que quelques heures, et le secret lui-même ne quitte
 * jamais le serveur.
 *
 * C'est le mécanisme d'authentification à long terme décrit par la RFC 5389 et
 * implémenté par coturn sous le nom de `use-auth-secret`. Rien d'exotique :
 * c'est ce que tous les fournisseurs gérés proposent.
 */

/** Six heures : plus qu'un direct ne dure, moins qu'une journée de fuite. */
const DUREE_S = 6 * 3600;

export async function GET() {
  const url = process.env.TURN_URL;
  const secret = process.env.TURN_SECRET;

  /*
    Sans configuration, la route répond « pas de TURN » plutôt qu'une erreur.

    C'est l'état normal du projet aujourd'hui : la connexion directe suffit
    dans la grande majorité des cas, et le client sait se rabattre sur les seuls
    serveurs STUN. Répondre 500 ferait échouer un direct qui aurait très bien
    fonctionné sans relais.
  */
  if (!url || !secret) {
    return NextResponse.json({ iceServers: [] });
  }

  /*
    Il faut être connecté.

    C'est la moitié du correctif : sans compte, pas d'identifiant, donc pas de
    relais gratuit pour un passant. Les directs sont de toute façon réservés
    aux membres.
  */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const echeance = Math.floor(Date.now() / 1000) + DUREE_S;

  /*
    L'identifiant de l'utilisateur est accolé à l'échéance.

    coturn n'en fait rien — il ne vérifie que le HMAC — mais les journaux du
    serveur TURN portent alors le nom d'utilisateur, ce qui permet de retrouver
    d'où vient une consommation anormale. Sans lui, tous les relais se
    ressemblent.
  */
  const username = `${echeance}:${user.id}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");

  return NextResponse.json(
    {
      iceServers: [{ urls: url, username, credential }],
      expiresAt: echeance,
    },
    {
      // Jamais mis en cache : chaque réponse porte une échéance différente, et
      // un intermédiaire qui en garderait une la servirait après sa mort.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
