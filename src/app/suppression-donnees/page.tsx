import Link from "next/link";
import type { Metadata } from "next";

/**
 * Instructions de suppression des données.
 *
 * Meta exige cette page — ou un point d'accès de rappel — pour toute
 * application qui lit des données de ses utilisateurs. C'est l'URL à coller
 * dans « Suppression des données utilisateur » lors de la revue.
 */

const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "Mall Express Gafsa",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
};

export const metadata: Metadata = {
  title: "Supprimer mes données",
  description:
    "Comment supprimer votre compte Mall Express Gafsa et les données associées, et comment couper la liaison avec votre page Facebook.",
  alternates: { canonical: "/suppression-donnees" },
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-workshop)]">
      <header className="border-b border-[var(--color-hairline)]">
        <div className="mx-auto flex max-w-[820px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="text-[0.9375rem] font-bold text-[var(--color-ink)]">
            Mall Express <span className="text-[var(--color-brand)]">Gafsa</span>
          </Link>
          <Link
            href="/confidentialite"
            className="-my-1 py-1 text-[0.75rem] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-brand)]"
          >
            Confidentialité
          </Link>
        </div>
      </header>

      <main id="contenu" className="mx-auto max-w-[820px] px-5 py-12 lg:px-8 lg:py-16">
        <h1 className="text-[1.75rem] leading-[1.2] font-bold tracking-[-0.03125rem] text-[var(--color-ink)] lg:text-[2.125rem]">
          Supprimer mes données
        </h1>

        <p className="mt-4 text-[0.875rem] leading-[1.7] text-[var(--color-muted)]">
          Trois demandes distinctes, selon ce que vous voulez effacer.
        </p>

        <div className="mt-10 flex flex-col gap-5">
          <Step
            number="1"
            title="Couper la liaison avec ma page Facebook"
            immediate
          >
            <p>
              Espace vendeur →{" "}
              <Link href="/vendeur/reglages" className="font-semibold text-[var(--color-brand)]">
                Réglages
              </Link>{" "}
              → <em>Direct Facebook</em> → <strong>Déconnecter</strong>.
            </p>
            <p>
              Le jeton d&apos;accès à votre page est supprimé immédiatement et nous
              cessons toute lecture. Vos directs déjà relayés restent visibles dans
              l&apos;historique de la boutique ; demandez leur suppression à
              l&apos;étape 3 si vous le souhaitez.
            </p>
            <p>
              Vous pouvez aussi révoquer l&apos;accès depuis Facebook : <em>Paramètres
              et confidentialité → Paramètres → Applications et sites web</em>.
            </p>
          </Step>

          <Step number="2" title="Supprimer une donnée en particulier" immediate>
            <p>
              Un commentaire, un bon plan, un avis, une photo de profil : chacun se
              supprime depuis l&apos;écran où il apparaît. Vos coordonnées se
              modifient dans{" "}
              <Link href="/profil/reglages" className="font-semibold text-[var(--color-brand)]">
                vos réglages
              </Link>
              .
            </p>
          </Step>

          <Step number="3" title="Supprimer mon compte et tout ce qui s'y rattache">
            <p>
              Écrivez-nous{" "}
              {OPERATOR.email ? (
                <>
                  à{" "}
                  <a
                    href={`mailto:${OPERATOR.email}?subject=${encodeURIComponent("Suppression de mon compte")}`}
                    className="font-semibold text-[var(--color-brand)]"
                  >
                    {OPERATOR.email}
                  </a>
                </>
              ) : (
                <>par la messagerie de l&apos;application</>
              )}
              , depuis l&apos;adresse du compte concerné, avec pour objet
              « Suppression de mon compte ».
            </p>

            <p className="font-semibold text-[var(--color-ink)]">
              Nous supprimons sous 30 jours :
            </p>
            <ul className="flex list-disc flex-col gap-1 ps-5">
              <li>votre profil, vos coordonnées, votre photo ;</li>
              <li>vos favoris, votre panier, vos boutiques suivies ;</li>
              <li>vos messages, commentaires, avis et bons plans ;</li>
              <li>votre jeton de page Facebook, s&apos;il en reste un ;</li>
              <li>vos identifiants de connexion.</li>
            </ul>

            <p className="font-semibold text-[var(--color-ink)]">Ce que nous devons garder :</p>
            <p>
              Les <strong>commandes déjà passées</strong>, pendant trois ans, pour
              satisfaire aux obligations comptables — les nôtres et celles du
              commerçant. Elles sont alors dissociées de votre identité : il ne reste
              que le montant, la date et les articles, sans votre nom, votre téléphone
              ni votre adresse.
            </p>
          </Step>
        </div>

        <div className="mt-10 rounded-[18px] border border-[var(--color-outline)] bg-[var(--color-field)] p-5">
          <p className="text-[0.8125rem] leading-[1.65] text-[var(--color-muted)]">
            Une suppression est définitive : ni les données ni le compte ne peuvent
            être rétablis. {OPERATOR.name} confirme chaque suppression par écrit.
          </p>
        </div>

        <footer className="mt-14 border-t border-[var(--color-hairline)] pt-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              ["/", "Le projet"],
              ["/accueil", "Accueil"],
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
        </footer>
      </main>
    </div>
  );
}

function Step({
  number,
  title,
  immediate,
  children,
}: {
  number: string;
  title: string;
  /** Le visiteur peut le faire seul, sans nous écrire. */
  immediate?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.8125rem] font-bold text-[var(--color-brand)]">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1rem] font-bold text-[var(--color-ink)]">{title}</h2>
          <p className="mt-[2px] text-[0.6875rem] font-semibold text-[var(--color-brand)]">
            {immediate ? "Immédiat, par vous-même" : "Sous 30 jours, sur demande"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 text-[0.84375rem] leading-[1.7] text-[var(--color-muted)]">
        {children}
      </div>
    </section>
  );
}
