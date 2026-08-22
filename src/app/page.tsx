import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/marketing/reveal";
import { LaunchButtons } from "@/components/marketing/launch-buttons";

/* ═══════════════════════════════════════════════════════════════════════
   Coordonnées
   Pilotées par l'environnement : une adresse ou un numéro inventé dans le
   code finirait en ligne. Seuls les canaux renseignés sont affichés ; les
   deux derniers existent toujours, ils passent par l'application.
   Voir .env.local.example
   ═══════════════════════════════════════════════════════════════════════ */

const CONTACT = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE,
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS ?? "Gafsa, Tunisie",
};

/* ═══════════════════════════════════════════════════════════════════════
   Équipe
   Décrite par fonction, pas par personne : mieux vaut une page honnête
   qu'une page peuplée de noms qui n'existent pas. Remplacez `role` par le
   nom réel et `initials` par ses initiales dès que le poste est tenu.
   ═══════════════════════════════════════════════════════════════════════ */

const TEAM = [
  {
    initials: "DP",
    role: "Direction du projet",
    focus: "Choix des priorités, relation avec la municipalité et le mall.",
    hue: 300,
  },
  {
    initials: "RC",
    role: "Relation commerçants",
    focus: "Accueil des boutiques, vérification des dossiers, formation aux lives.",
    hue: 25,
  },
  {
    initials: "TP",
    role: "Technique et produit",
    focus: "Développement, hébergement, sécurité des données et des paiements.",
    hue: 210,
  },
  {
    initials: "SU",
    role: "Support aux utilisateurs",
    focus: "Réponses aux messages, litiges de commande, modération des bons plans.",
    hue: 150,
  },
];

const FEATURES = [
  {
    tag: "MP",
    title: "Marketplace de proximité",
    body: "Le stock réel des boutiques du mall et du centre-ville. Retrait sur place en trente minutes, ou livraison dans Gafsa.",
    hue: 300,
  },
  {
    tag: "LV",
    title: "Ventes en direct",
    body: "Le commerçant diffuse depuis la caméra de son téléphone ou relaie son direct Facebook. Commentaires en temps réel, produits épinglés, achat sans quitter le flux.",
    hue: 10,
  },
  {
    tag: "BP",
    title: "Bons plans vérifiés",
    body: "Les habitants publient les promotions qu'ils trouvent. Trois confirmations et le bon plan passe « Vérifié ».",
    hue: 40,
  },
  {
    tag: "SC",
    title: "Services citoyens",
    body: "Horaires de prière, pharmacie de garde, alertes municipales, démarches administratives à déposer en ligne.",
    hue: 165,
  },
];

const STEPS_CLIENT = [
  "Ouvrez le site ou installez l'application — aucun compte n'est nécessaire pour regarder.",
  "Commandez auprès d'une boutique : paiement à la livraison, à l'appel, ou retrait au mall.",
  "Suivez vos boutiques, gagnez des points de fidélité, parrainez vos proches.",
];

const STEPS_VENDOR = [
  "Créez votre compte commerçant en trois minutes : nom de la boutique et local suffisent.",
  "L'administration vérifie votre dossier. Pendant ce temps, préparez jusqu'à cinq produits.",
  "Votre boutique passe en ligne. Vous gérez stock, promotions, horaires et directs.",
];

export const metadata: Metadata = {
  /*
    Le titre le plus important du site, et il ne se laisse pas au gabarit.

    C'est la ligne bleue que Google affiche, et le signal de contenu le plus
    fort d'une page. « Notre projet » ne disait ni ce qu'est le site, ni où il
    se trouve : personne ne cherche « notre projet ». Le nom et la ville y
    figurent désormais, parce que c'est ce que tapent les gens — « mall gafsa »,
    « boutiques gafsa en ligne ».

    `absolute` évite le suffixe du gabarit, qui répéterait « Mall Express
    Gafsa » deux fois dans le même titre.
  */
  title: {
    absolute: "Mall Express Gafsa — les boutiques du mall de Gafsa en ligne",
  },
  description:
    "Mall Express Gafsa réunit les boutiques de Gafsa dans une seule application : marketplace de proximité, ventes en direct, bons plans vérifiés et services citoyens. À parcourir dans le navigateur ou à installer.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Mall Express Gafsa — le commerce de Gafsa, en ligne",
    description:
      "Marketplace de proximité, ventes en direct, bons plans vérifiés et services citoyens.",
    type: "website",
  },
};

/**
 * Compteurs de la page, mis en cache cinq minutes.
 *
 * La page ne peut pas être statique : la coque racine lit la langue et
 * l'échelle typographique dans les cookies, ce qui rend tout l'arbre
 * dynamique. `unstable_cache` obtient le même effet là où il compte — quatre
 * requêtes toutes les cinq minutes, et non à chaque visite.
 *
 * `createStaticClient` : aucun cookie, donc rien de la session du visiteur ne
 * peut se retrouver dans une valeur partagée par tous.
 */
const stats = unstable_cache(
  async () => {
    const supabase = createStaticClient();

    const [shops, products, categories, deals] = await Promise.all([
      supabase.from("shops").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_online", true),
      supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("deals").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);

    return {
      shops: shops.count ?? 0,
      products: products.count ?? 0,
      categories: categories.count ?? 0,
      deals: deals.count ?? 0,
    };
  },
  ["presentation-stats"],
  { revalidate: 300 },
);

export default async function PresentationPage() {
  const { shops, products, categories, deals } = await stats();

  const figures = [
    { value: shops, label: "boutiques en ligne" },
    { value: products, label: "produits référencés" },
    { value: categories, label: "catégories" },
    { value: deals, label: "bons plans actifs" },
  ];

  return (
    <div className="min-h-dvh bg-[var(--color-workshop)]">
      {/* ═══ En-tête ═══════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-hairline)] bg-[var(--color-workshop)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1140px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <p className="text-[1.0625rem] font-bold tracking-[-0.01875rem] text-[var(--color-ink)]">
            Mall Express <span className="text-[var(--color-brand)]">Gafsa</span>
          </p>

          <nav aria-label="Sections" className="hidden items-center gap-7 md:flex">
            {[
              ["#projet", "Le projet"],
              ["#fonctionnement", "Fonctionnement"],
              ["#equipe", "L'équipe"],
              ["#contact", "Contact"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-[0.8125rem] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-brand)]"
              >
                {label}
              </a>
            ))}
          </nav>

          <Link
            href="/accueil"
            className="rounded-[14px] bg-[var(--color-brand-fill)] px-4 py-[9px] text-[0.78125rem] font-bold whitespace-nowrap text-white"
          >
            Parcourir
          </Link>
        </div>
      </header>

      <main id="contenu">
        {/* ═══ Hero ════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden">
          {/* Halos décoratifs : le fond ne doit pas être un aplat vide. */}
          <div
            aria-hidden
            className="animate-float pointer-events-none absolute -top-32 -end-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(109,75,143,0.20),transparent_65%)] blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -start-32 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(208,69,95,0.14),transparent_65%)] blur-2xl"
          />

          <div className="relative mx-auto grid max-w-[1140px] items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <Reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-outline)] bg-[var(--color-veil)] px-3 py-[6px] text-[0.71875rem] font-bold text-[var(--color-brand)]">
                  <span
                    aria-hidden
                    className="animate-live-dot h-[7px] w-[7px] rounded-full bg-[var(--color-live-fill)]"
                  />
                  Gafsa · Tunisie
                </p>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-5 text-[2.125rem] leading-[1.1] font-bold tracking-[-0.05rem] text-[var(--color-ink)] sm:text-[2.75rem] lg:text-[3.25rem]">
                  Le commerce de Gafsa,
                  <br />
                  <span className="text-[var(--color-brand)]">à portée de pouce.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-5 max-w-[54ch] text-[0.9375rem] leading-[1.65] text-[var(--color-muted)] sm:text-[1rem]">
                  Une seule application pour le stock réel des boutiques du mall,
                  les ventes en direct, les bons plans confirmés par les habitants
                  et les services de la ville. Pensée pour un téléphone d&apos;entrée
                  de gamme, en français comme en arabe.
                </p>
              </Reveal>

              <Reveal delay={240} className="mt-9">
                <LaunchButtons />
              </Reveal>
            </div>

            {/* Aperçu : la vraie coque de l'application, à sa largeur réelle. */}
            <Reveal delay={200} className="justify-self-center lg:justify-self-end">
              <div className="relative w-[280px] rounded-[34px] border border-[var(--color-surface-edge)] bg-[var(--color-app)] p-3 shadow-[0_30px_70px_rgba(60,40,90,0.20)] sm:w-[320px]">
                <div className="flex flex-col gap-3 rounded-[26px] bg-[var(--color-field)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">
                      Mall Express <span className="text-[var(--color-brand)]">Gafsa</span>
                    </p>
                    <span className="flex h-2 w-2 rounded-full bg-[var(--color-live-fill)]" />
                  </div>

                  <div className="rounded-[18px] bg-[image:var(--gradient-brand)] p-4 text-white">
                    <p className="text-[0.65625rem] opacity-80">En direct maintenant</p>
                    <p className="mt-1 text-[0.875rem] font-bold">Collection automne</p>
                    <p className="mt-2 text-[0.625rem] opacity-80">128 spectateurs · 3 produits épinglés</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[300, 25, 165].map((hue, index) => (
                      <div
                        key={hue}
                        className="cat-surface cat-ring flex h-[58px] flex-col items-center justify-center gap-1 rounded-[16px]"
                        style={{ "--hue": hue } as React.CSSProperties}
                      >
                        <span className="cat-ink text-[0.8125rem] font-bold">
                          {["MD", "AL", "SA"][index]}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-veil)] p-2">
                    <span className="ph-stripe h-9 w-9 flex-none rounded-[12px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
                        Retrait au mall en 30 min
                      </p>
                      <p className="text-[0.59375rem] text-[var(--color-muted)]">
                        Niveau 1 — Local B12
                      </p>
                    </div>
                    <span className="flex-none rounded-[10px] bg-[var(--color-brand-fill)] px-2 py-1 text-[0.59375rem] font-bold text-white">
                      Voir
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══ Chiffres ════════════════════════════════════════════════ */}
        <section className="border-y border-[var(--color-hairline)] bg-white/45">
          <div className="mx-auto grid max-w-[1140px] grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4 lg:px-8">
            {figures.map((figure, index) => (
              <Reveal key={figure.label} delay={index * 70} className="text-center">
                <p className="text-[1.875rem] leading-none font-bold text-[var(--color-brand)] lg:text-[2.375rem]">
                  {figure.value}
                </p>
                <p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">{figure.label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═══ Le projet ═══════════════════════════════════════════════ */}
        <section id="projet" className="mx-auto max-w-[1140px] scroll-mt-24 px-5 py-16 lg:px-8 lg:py-24">
          <Reveal>
            <p className="text-[0.75rem] font-bold tracking-[0.0875rem] text-[var(--color-brand)] uppercase">
              Le projet
            </p>
            <h2 className="mt-3 max-w-[26ch] text-[1.6875rem] leading-[1.2] font-bold tracking-[-0.03125rem] text-[var(--color-ink)] lg:text-[2.125rem]">
              Un commerce de quartier qui garde ses habitudes, avec les outils
              d&apos;aujourd&apos;hui.
            </h2>
            <p className="mt-4 max-w-[68ch] text-[0.90625rem] leading-[1.7] text-[var(--color-muted)]">
              À Gafsa, on achète parce qu&apos;on connaît le vendeur. Nous
              n&apos;avons pas voulu remplacer cette relation par un catalogue
              anonyme : le paiement à la livraison reste la norme, l&apos;appel
              téléphonique aussi, et le retrait au mall se fait en trente minutes.
              Ce que la plateforme ajoute, c&apos;est la visibilité — savoir qui a
              quoi en stock, à quel prix, et à quelle heure la boutique ferme.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((feature, index) => (
              <Reveal
                key={feature.title}
                delay={index * 80}
                className="card flex flex-col gap-3 p-6 transition-transform hover:-translate-y-1"
              >
                <span
                  className="cat-surface cat-ink cat-ring flex h-11 w-11 items-center justify-center rounded-[16px] text-[0.875rem] font-bold"
                  style={{ "--hue": feature.hue } as React.CSSProperties}
                >
                  {feature.tag}
                </span>
                <h3 className="text-[1rem] font-bold text-[var(--color-ink)]">{feature.title}</h3>
                <p className="text-[0.84375rem] leading-[1.6] text-[var(--color-muted)]">
                  {feature.body}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═══ Fonctionnement ══════════════════════════════════════════ */}
        <section
          id="fonctionnement"
          className="scroll-mt-24 border-y border-[var(--color-hairline)] bg-white/45"
        >
          <div className="mx-auto max-w-[1140px] px-5 py-16 lg:px-8 lg:py-24">
            <Reveal>
              <p className="text-[0.75rem] font-bold tracking-[0.0875rem] text-[var(--color-brand)] uppercase">
                Fonctionnement
              </p>
              <h2 className="mt-3 text-[1.6875rem] leading-[1.2] font-bold tracking-[-0.03125rem] text-[var(--color-ink)] lg:text-[2.125rem]">
                Trois étapes, de chaque côté.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-14">
              {(
                [
                  { title: "Vous achetez", steps: STEPS_CLIENT, cta: null },
                  {
                    title: "Vous tenez une boutique",
                    steps: STEPS_VENDOR,
                    cta: { href: "/inscription?role=vendeur", label: "Ouvrir ma boutique" },
                  },
                ] as const
              ).map((column, columnIndex) => (
                <Reveal key={column.title} delay={columnIndex * 120}>
                  <h3 className="text-[1.125rem] font-bold text-[var(--color-ink)]">{column.title}</h3>

                  <ol className="mt-5 flex flex-col gap-5">
                    {column.steps.map((step, index) => (
                      <li key={step} className="flex gap-4">
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.8125rem] font-bold text-[var(--color-brand)]">
                          {index + 1}
                        </span>
                        <p className="pt-[6px] text-[0.84375rem] leading-[1.6] text-[var(--color-muted)]">
                          {step}
                        </p>
                      </li>
                    ))}
                  </ol>

                  {column.cta && (
                    <Link
                      href={column.cta.href}
                      className="mt-6 inline-flex min-h-[46px] items-center rounded-[16px] bg-[var(--color-ink)] px-6 text-[0.84375rem] font-bold text-[var(--color-app)] transition-transform hover:-translate-y-0.5"
                    >
                      {column.cta.label}
                    </Link>
                  )}
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Équipe ══════════════════════════════════════════════════ */}
        <section id="equipe" className="mx-auto max-w-[1140px] scroll-mt-24 px-5 py-16 lg:px-8 lg:py-24">
          <Reveal>
            <p className="text-[0.75rem] font-bold tracking-[0.0875rem] text-[var(--color-brand)] uppercase">
              L&apos;équipe
            </p>
            <h2 className="mt-3 text-[1.6875rem] leading-[1.2] font-bold tracking-[-0.03125rem] text-[var(--color-ink)] lg:text-[2.125rem]">
              Qui tient la plateforme.
            </h2>
            <p className="mt-4 max-w-[62ch] text-[0.90625rem] leading-[1.7] text-[var(--color-muted)]">
              Une petite équipe, sur place. Chaque dossier de boutique est vérifié
              à la main avant sa mise en ligne — c&apos;est plus lent, et c&apos;est
              ce qui fait que le catalogue reste fiable.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((member, index) => (
              <Reveal
                key={member.role}
                delay={index * 80}
                className="card flex flex-col items-start gap-3 p-6 transition-transform hover:-translate-y-1"
              >
                <span
                  className="cat-surface cat-ink cat-ring flex h-14 w-14 items-center justify-center rounded-full text-[1rem] font-bold"
                  style={{ "--hue": member.hue } as React.CSSProperties}
                >
                  {member.initials}
                </span>
                <h3 className="text-[0.90625rem] font-bold text-[var(--color-ink)]">{member.role}</h3>
                <p className="text-[0.78125rem] leading-[1.6] text-[var(--color-muted)]">
                  {member.focus}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═══ Contact ═════════════════════════════════════════════════ */}
        <section
          id="contact"
          className="scroll-mt-24 border-t border-[var(--color-hairline)] bg-white/45"
        >
          <div className="mx-auto grid max-w-[1140px] gap-12 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-24">
            <Reveal>
              <p className="text-[0.75rem] font-bold tracking-[0.0875rem] text-[var(--color-brand)] uppercase">
                Contact
              </p>
              <h2 className="mt-3 text-[1.6875rem] leading-[1.2] font-bold tracking-[-0.03125rem] text-[var(--color-ink)] lg:text-[2.125rem]">
                Une question, un dossier, un litige ?
              </h2>
              <p className="mt-4 text-[0.90625rem] leading-[1.7] text-[var(--color-muted)]">
                Les commerçants et les acheteuses passent par la messagerie de
                l&apos;application : la conversation reste attachée à la commande,
                ce qui évite de tout réexpliquer.
              </p>
            </Reveal>

            <Reveal delay={120} className="flex flex-col gap-3">
              {CONTACT.email && (
                <ContactRow tag="@" label="Écrire un courriel" value={CONTACT.email} href={`mailto:${CONTACT.email}`} />
              )}
              {CONTACT.phone && (
                <ContactRow
                  tag="TL"
                  label="Appeler"
                  value={CONTACT.phone}
                  href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}
                />
              )}
              <ContactRow tag="MS" label="Messagerie de l'application" value="Depuis votre compte" href="/messages" />
              <ContactRow tag="BQ" label="Inscrire ma boutique" value="Trois minutes" href="/inscription?role=vendeur" />
              <ContactRow tag="LO" label="Où nous trouver" value={CONTACT.address} />
            </Reveal>
          </div>
        </section>

        {/* ═══ Dernier appel ═══════════════════════════════════════════ */}
        <section className="mx-auto max-w-[1140px] px-5 py-16 lg:px-8 lg:py-24">
          <Reveal className="flex flex-col items-center gap-7 rounded-[28px] bg-[image:var(--gradient-brand)] px-6 py-14 text-center text-white lg:px-16">
            <h2 className="max-w-[24ch] text-[1.625rem] leading-[1.2] font-bold tracking-[-0.03125rem] lg:text-[2.125rem]">
              Commencez par regarder. Le compte peut attendre.
            </h2>
            <p className="max-w-[54ch] text-[0.875rem] leading-[1.65] opacity-85">
              Le catalogue, les directs et les bons plans sont consultables sans
              inscription. Le compte ne sert qu&apos;à commander, commenter et
              suivre vos boutiques.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/accueil"
                className="inline-flex min-h-[52px] items-center justify-center rounded-[18px] bg-white px-7 text-[0.9375rem] font-bold text-[var(--color-on-light)] transition-transform hover:-translate-y-0.5"
              >
                Parcourir le site
              </Link>
              <Link
                href="/inscription"
                className="inline-flex min-h-[52px] items-center justify-center rounded-[18px] border border-white/40 px-7 text-[0.9375rem] font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                Créer mon compte
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ═══ Pied de page ══════════════════════════════════════════════ */}
      <footer className="border-t border-[var(--color-hairline)]">
        <div className="mx-auto flex max-w-[1140px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="text-[0.75rem] text-[var(--color-muted)]">
            Mall Express Gafsa — Gafsa, Tunisie
          </p>
          <nav aria-label="Liens" className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              ["/accueil", "Accueil"],
              ["/marketplace", "Marketplace"],
              ["/lives", "Lives"],
              ["/bons-plans", "Bons plans"],
              ["/services", "Services"],
              ["/confidentialite", "Confidentialité"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="-my-1 py-1 text-[0.75rem] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-brand)]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

function ContactRow({
  tag,
  label,
  value,
  href,
}: {
  tag: string;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-[var(--color-brand-tint)] text-[0.78125rem] font-bold text-[var(--color-brand)]">
        {tag}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-bold text-[var(--color-ink)]">{label}</span>
        <span className="block truncate text-[0.78125rem] text-[var(--color-muted)]">{value}</span>
      </span>
      {href && (
        <span aria-hidden className="flex-none text-[0.8125rem] text-[var(--color-faint)]">
          →
        </span>
      )}
    </>
  );

  const className =
    "card flex items-center gap-4 p-4 transition-transform" + (href ? " hover:-translate-y-0.5" : "");

  if (!href) return <div className={className}>{content}</div>;

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {content}
    </a>
  );
}
