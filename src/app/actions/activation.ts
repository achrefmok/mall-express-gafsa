"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { done, fail, ok, readableError, requireAdmin } from "./_helpers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { signaler } from "@/lib/signal";

/**
 * Activation d'une boutique par code.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Le partage des rôles
 * ────────────────────────────────────────────────────────────────────────
 *
 * L'administration crée la boutique et le code depuis ce fichier, avec
 * `requireAdmin()` en tête de chaque fonction : un appel direct à l'API sans
 * ce rôle échoue avant de toucher quoi que ce soit.
 *
 * `activerBoutique`, elle, n'exige aucun rôle — son appelant n'a pas encore
 * de compte — et c'est le code lui-même qui en tient lieu de preuve : lu et
 * consommé uniquement via la clé de service, jamais par une policy RLS
 * conditionnée à une identité qui n'existe pas encore (voir la migration
 * `20260929001000_code_activation_boutique.sql`).
 */

/** Sans 0/O/1/I/L : un code qu'on peut lire à voix haute sans confusion. */
const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function genererCode(): string {
  const octets = crypto.getRandomValues(new Uint8Array(8));
  let code = "";
  for (const o of octets) code += ALPHABET_CODE[o % ALPHABET_CODE.length];
  return code;
}

export interface CodeActivation {
  id: string;
  code: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  shop: { id: string; name: string; slug: string };
}

/* ─── Administration ─────────────────────────────────────────────────── */

/**
 * Crée la boutique et son code en une seule fois.
 *
 * La boutique naît `approved` : c'est l'administration qui vient de la
 * créer pour un commerçant qu'elle a déjà rencontré, il n'y a personne
 * d'autre à qui demander une validation. `owner_id` reste vide jusqu'à ce
 * que le code soit consommé — voir `activerBoutique`.
 */
export async function creerBoutiqueAvecCode(input: {
  name: string;
  categoryId?: string | null;
  address?: string;
  phone?: string;
  mallLevel?: number | null;
  mallUnit?: string;
  validityDays: number;
}) {
  const { profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const name = input.name.trim();
  if (name.length < 2) return fail("Le nom de la boutique est obligatoire");

  const jours = Math.round(input.validityDays);
  if (!Number.isFinite(jours) || jours < 1 || jours > 90) {
    return fail("La validité doit être comprise entre 1 et 90 jours");
  }

  const admin = createAdminClient();

  const { data: base } = await admin.rpc("slugify", { input: name });
  let slug = base || "boutique";
  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const { data: taken } = await admin.from("shops").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base || "boutique"}-${suffix}`;
  }

  const { data: shop, error: shopError } = await admin
    .from("shops")
    // `owner_id` omis : la colonne accepte désormais `null`, en attendant
    // que le code soit consommé. `status` omis aussi, pour sa valeur par
    // défaut `pending` — l'administration l'approuve depuis /admin/boutiques
    // une fois la boutique activée, exactement comme une boutique ordinaire.
    .insert({
      slug,
      name,
      category_id: input.categoryId || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      mall_level: input.mallLevel ?? null,
      mall_unit: input.mallUnit?.trim() || null,
    })
    .select("id, name, slug")
    .single();

  if (shopError || !shop) {
    signaler(shopError, { ou: "création d'une boutique par code", quoi: { name } });
    return fail("Impossible de créer la boutique");
  }

  // Collision improbable (32 possibilités sur 8 tirages) mais vérifiée
  // quand même : la colonne `code` est unique, on retire simplement.
  let code = "";
  let creation = null;
  for (let essai = 0; essai < 5 && !creation; essai += 1) {
    code = genererCode();
    const { data, error: codeError } = await admin
      .from("shop_activation_codes")
      .insert({
        shop_id: shop.id,
        code,
        expires_at: new Date(Date.now() + jours * 86_400_000).toISOString(),
        created_by: profile.id,
      })
      .select("id, code, expires_at, used_at, revoked_at, created_at")
      .single();

    if (!codeError) creation = data;
    else if (codeError.code !== "23505") {
      await admin.from("shops").delete().eq("id", shop.id);
      signaler(codeError, { ou: "génération d'un code d'activation", quoi: { shopId: shop.id } });
      return fail("Impossible de générer le code — la boutique n'a pas été créée");
    }
  }

  if (!creation) {
    await admin.from("shops").delete().eq("id", shop.id);
    return fail("Impossible de générer un code unique — réessayez");
  }

  revalidatePath("/admin/activation");
  revalidatePath("/admin/boutiques");

  return ok({
    id: creation.id as string,
    code: creation.code as string,
    expiresAt: creation.expires_at as string,
    shop: { id: shop.id as string, name: shop.name as string, slug: shop.slug as string },
  });
}

/** Les codes des trente derniers jours, du plus récent au plus ancien. */
export async function listerCodesActivation() {
  const { profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const admin = createAdminClient();
  const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data, error: e } = await admin
    .from("shop_activation_codes")
    .select("id, code, expires_at, used_at, revoked_at, created_at, shop:shops(id, name, slug)")
    .gte("created_at", depuis)
    .order("created_at", { ascending: false })
    .limit(100);

  if (e) return fail(readableError(e));

  return ok(
    (data ?? []).map((c) => {
      const shop = c.shop as unknown as { id: string; name: string; slug: string };
      return {
        id: c.id,
        code: c.code,
        expiresAt: c.expires_at,
        usedAt: c.used_at,
        revokedAt: c.revoked_at,
        createdAt: c.created_at,
        shop,
      };
    }) satisfies CodeActivation[],
  );
}

/** Un code révoqué ne peut plus être consommé, même s'il n'a pas expiré. */
export async function revoquerCode(codeId: string) {
  const { profile, error } = await requireAdmin();
  if (!profile) return fail(error);

  const admin = createAdminClient();
  const { error: e } = await admin
    .from("shop_activation_codes")
    .update({ revoked_at: new Date().toISOString(), revoked_by: profile.id })
    .eq("id", codeId)
    .is("used_at", null)
    .is("revoked_at", null);

  if (e) return fail(readableError(e));

  revalidatePath("/admin/activation");
  return done();
}

/* ─── Le commerçant ──────────────────────────────────────────────────── */

/**
 * Consomme le code et ouvre le compte, dans cet ordre précis.
 *
 * Le compte est créé avant que la boutique ne change de propriétaire : sans
 * compte, il n'y a personne à qui la rattacher. Le code n'est marqué
 * consommé qu'ensuite, avec une condition `used_at is null` dans la requête
 * elle-même — pas une simple vérification avant l'écriture — pour qu'une
 * double soumission du même code, à la milliseconde près, ne puisse pas
 * l'emporter deux fois. Toute étape qui échoue défait celles qui ont
 * précédé : jamais de compte sans boutique, jamais de code consommé pour
 * rien.
 */
export async function activerBoutique(input: {
  code: string;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}) {
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  const email = input.email.trim().toLowerCase();

  if (!code) return fail("Entrez le code reçu de l'administration");
  if (!email.includes("@")) return fail("Adresse e-mail invalide");
  if (input.password.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères");
  if (!input.firstName.trim()) return fail("Le prénom est obligatoire");

  const admin = createAdminClient();

  const { data: ligne, error: lectureError } = await admin
    .from("shop_activation_codes")
    .select("id, shop_id, expires_at, used_at, revoked_at")
    .eq("code", code)
    .maybeSingle();

  if (lectureError) return fail(readableError(lectureError));
  if (!ligne) return fail("Code invalide");
  if (ligne.revoked_at) return fail("Ce code a été révoqué");
  if (ligne.used_at) return fail("Ce code a déjà été utilisé");
  if (new Date(ligne.expires_at).getTime() < Date.now()) return fail("Ce code a expiré");

  const { data: boutique } = await admin
    .from("shops")
    .select("id, owner_id")
    .eq("id", ligne.shop_id)
    .maybeSingle();

  if (!boutique) return fail("La boutique liée à ce code n'existe plus");
  if (boutique.owner_id) return fail("Cette boutique a déjà un propriétaire");

  const { data: cree, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: "vendor",
      first_name: input.firstName.trim(),
      last_name: input.lastName?.trim() || "",
    },
  });

  if (authError || !cree.user) {
    if (authError?.code === "email_exists" || /already registered|already exists/i.test(authError?.message ?? "")) {
      return fail("Cette adresse est déjà utilisée");
    }
    signaler(authError, { ou: "création du compte à l'activation", quoi: { shopId: ligne.shop_id } });
    return fail("Impossible de créer le compte");
  }

  const userId = cree.user.id;

  // Le code d'abord : s'il est déjà pris (course entre deux soumissions),
  // on n'a encore touché à aucune boutique.
  const { data: consomme, error: codeError } = await admin
    .from("shop_activation_codes")
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq("id", ligne.id)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (codeError || !consomme) {
    await admin.auth.admin.deleteUser(userId);
    return fail("Ce code vient d'être utilisé ou révoqué — réessayez avec un code valide");
  }

  const { data: attribuee, error: ownerError } = await admin
    .from("shops")
    .update({ owner_id: userId })
    .eq("id", ligne.shop_id)
    .is("owner_id", null)
    .select("id, slug")
    .maybeSingle();

  if (ownerError || !attribuee) {
    // Le code est déjà consommé : on le rend, plutôt que de le perdre pour rien.
    await admin
      .from("shop_activation_codes")
      .update({ used_at: null, used_by: null })
      .eq("id", ligne.id);
    await admin.auth.admin.deleteUser(userId);
    signaler(ownerError, { ou: "attribution de la boutique à l'activation", quoi: { shopId: ligne.shop_id } });
    return fail("Cette boutique vient d'être attribuée — contactez l'administration");
  }

  // La session s'ouvre avec le mot de passe que la personne vient de choisir :
  // c'est la même preuve que verrait une connexion normale juste après.
  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (sessionError) {
    // Le compte existe et la boutique est à lui : il lui suffit de se connecter.
    redirect("/connexion");
  }

  redirect("/vendeur?bienvenue=1");
}
