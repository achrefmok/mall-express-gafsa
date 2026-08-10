import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Client Supabase des composants serveur, Server Actions et Route Handlers.
 * À créer par requête — jamais en variable de module : le cookie de session
 * fuiterait d'un visiteur à l'autre.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : les cookies sont en lecture
            // seule. Le middleware a déjà rafraîchi la session, rien à faire.
          }
        },
      },
    },
  );
}

/**
 * Client anonyme sans cookie, pour les contextes hors requête :
 * `generateStaticParams`, `sitemap`, tâches de build.
 *
 * Ces fonctions s'exécutent en dehors de toute requête HTTP — `cookies()` y
 * lève. Il n'y a de toute façon pas de session à propager : ce qu'on y lit
 * est public, et les policies RLS s'appliquent au rôle `anon`.
 */
export function createStaticClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/**
 * Client `service_role` : contourne toutes les policies RLS.
 * Réservé aux tâches de maintenance côté serveur (cron). Ne jamais dériver
 * de ce client une réponse rendue à un visiteur non vérifié.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  }

  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
