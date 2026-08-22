import Link from "next/link";
import type { Metadata } from "next";

/* ═══════════════════════════════════════════════════════════════════════
   Exploitant
   Renseignez ces valeurs : elles identifient le responsable du traitement.
   Une politique de confidentialité sans exploitant nommé n'a aucune valeur,
   et Meta refuse l'application en revue.
   Pilotées par l'environnement — voir .env.local.example
   ═══════════════════════════════════════════════════════════════════════ */

const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "Mall Express Gafsa",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS ?? "Gafsa, Tunisie",
};

const UPDATED = "11 août 2026";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Quelles données Mall Express Gafsa collecte, pourquoi, combien de temps elles sont conservées, et comment demander leur suppression.",
  alternates: { canonical: "/confidentialite" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-workshop)]">
      <header className="border-b border-[var(--color-hairline)]">
        <div className="mx-auto flex max-w-[820px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="-my-1 py-1 text-[0.9375rem] font-bold text-[var(--color-ink)]">
            Mall Express <span className="text-[var(--color-brand)]">Gafsa</span>
          </Link>
          <Link
            href="/accueil"
            className="rounded-[13px] bg-[var(--color-brand-fill)] px-4 py-[8px] text-[0.75rem] font-bold text-white"
          >
            Parcourir
          </Link>
        </div>
      </header>

      <main id="contenu" className="mx-auto max-w-[820px] px-5 py-12 lg:px-8 lg:py-16">
        <h1 className="text-[1.75rem] leading-[1.2] font-bold tracking-[-0.03125rem] text-[var(--color-ink)] lg:text-[2.125rem]">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-[0.78125rem] text-[var(--color-muted)]">
          Dernière mise à jour : {UPDATED} · Responsable : {OPERATOR.name}, {OPERATOR.address}
          {OPERATOR.email && (
            <>
              {" · "}
              <a href={`mailto:${OPERATOR.email}`} className="font-semibold text-[var(--color-brand)]">
                {OPERATOR.email}
              </a>
            </>
          )}
        </p>

        <div className="mt-10 flex flex-col gap-9">
          <Section title="Ce que nous collectons, et pourquoi">
            <p>
              Nous ne collectons que ce dont le service a besoin pour fonctionner.
              Rien n&apos;est revendu, et aucune donnée n&apos;est transmise à des
              régies publicitaires.
            </p>

            <Table
              head={["Donnée", "Pourquoi", "Quand"]}
              rows={[
                ["Adresse e-mail", "Identifier votre compte, vous permettre de vous reconnecter", "À l'inscription"],
                ["Prénom, nom", "Vous nommer auprès des boutiques et dans vos commentaires", "À l'inscription"],
                ["Téléphone", "Permettre au commerçant de vous joindre pour une livraison", "Si vous le renseignez"],
                ["Ville, photo de profil", "Affichage de votre compte", "Si vous les renseignez"],
                ["Commandes, panier, favoris", "Le service lui-même", "À l'usage"],
                ["Messages, commentaires, réactions", "Vos échanges avec les boutiques et les autres habitants", "À l'usage"],
                ["Adresse de livraison", "Livrer la commande", "À la commande"],
              ]}
            />

            <p>
              Nous ne collectons <strong>ni données de localisation en continu, ni
              historique de navigation, ni empreinte d&apos;appareil</strong>. Le site
              ne dépose aucun mouchard publicitaire.
            </p>
          </Section>

          <Section title="Les cookies que nous déposons">
            <Table
              head={["Cookie", "Rôle", "Durée"]}
              rows={[
                ["Session d'authentification", "Vous garder connecté d'une page à l'autre", "Jusqu'à la déconnexion"],
                ["Langue et taille de texte", "Retrouver vos préférences d'affichage", "1 an"],
              ]}
            />
            <p>
              Aucun cookie de mesure d&apos;audience ni de publicité. Le premier est
              strictement nécessaire au service ; le second n&apos;enregistre qu&apos;un
              choix d&apos;affichage.
            </p>
          </Section>

          <Section title="Les commerçants et leur page Facebook">
            <p>
              Un commerçant peut relier la page Facebook de sa boutique pour que ses
              directs apparaissent sur le site. Dans ce cas, et seulement dans ce cas,
              nous demandons à Facebook deux autorisations :
            </p>
            <ul className="flex list-disc flex-col gap-2 ps-5">
              <li>
                <code className="rounded bg-[var(--color-brand-tint)] px-1 text-[0.75rem]">pages_show_list</code>{" "}
                — connaître la liste de ses pages, pour savoir laquelle relier ;
              </li>
              <li>
                <code className="rounded bg-[var(--color-brand-tint)] px-1 text-[0.75rem]">pages_read_engagement</code>{" "}
                — lire les vidéos en direct de cette page : identifiant, titre, lien
                public, et état de diffusion.
              </li>
            </ul>
            <p>
              <strong>Nous ne publions rien en votre nom</strong>, ne lisons ni vos
              messages privés, ni votre profil personnel, ni vos contacts. Nous
              conservons un jeton d&apos;accès à la page, chiffré au repos par notre
              hébergeur de base de données, inaccessible depuis le navigateur et
              utilisé uniquement par notre serveur pour vérifier si un direct est en
              cours. Le commerçant peut couper ce lien à tout moment depuis
              l&apos;espace vendeur, ce qui supprime le jeton immédiatement — et
              révoquer l&apos;accès depuis les paramètres de son compte Facebook.
            </p>
          </Section>

          <Section title="Qui d'autre voit ces données">
            <Table
              head={["Destinataire", "Ce qu'il voit", "Pourquoi"]}
              rows={[
                ["Le commerçant concerné", "Votre nom, téléphone, adresse de livraison, contenu de la commande", "Préparer et livrer"],
                ["Supabase", "L'ensemble des données, en tant qu'hébergeur de la base", "Hébergement"],
                ["Vercel", "Les journaux techniques des requêtes", "Hébergement du site"],
                ["Facebook", "Rien de votre part — c'est nous qui lisons chez eux", "Relais des directs"],
              ]}
            />
            <p>
              Les autres visiteurs voient uniquement ce que vous publiez
              volontairement : commentaires, bons plans, avis, et votre prénom.
            </p>
          </Section>

          <Section title="Combien de temps nous les gardons">
            <Table
              head={["Donnée", "Conservation"]}
              rows={[
                ["Compte et profil", "Tant que le compte existe"],
                ["Commandes", "3 ans après la dernière commande — obligation comptable"],
                ["Messages et commentaires", "Tant que le compte existe"],
                ["Jeton de page Facebook", "Jusqu'à la déconnexion de la page"],
                ["Journaux techniques", "30 jours"],
              ]}
            />
          </Section>

          <Section title="Vos droits">
            <p>
              Vous pouvez consulter, corriger ou supprimer vos données, et vous
              opposer à leur traitement.
            </p>
            <ul className="flex list-disc flex-col gap-2 ps-5">
              <li>
                <strong>Consulter et corriger</strong> — depuis{" "}
                <Link href="/profil/reglages" className="font-semibold text-[var(--color-brand)]">
                  vos réglages
                </Link>
                , à tout moment.
              </li>
              <li>
                <strong>Supprimer</strong> — voir{" "}
                <Link href="/suppression-donnees" className="font-semibold text-[var(--color-brand)]">
                  la marche à suivre
                </Link>
                .
              </li>
              <li>
                <strong>Nous écrire</strong> —{" "}
                {OPERATOR.email ? (
                  <a href={`mailto:${OPERATOR.email}`} className="font-semibold text-[var(--color-brand)]">
                    {OPERATOR.email}
                  </a>
                ) : (
                  "par la messagerie de l'application"
                )}
                . Nous répondons sous 30 jours.
              </li>
            </ul>
          </Section>

          <Section title="Les mineurs">
            <p>
              Le service n&apos;est pas destiné aux moins de 13 ans et nous ne
              collectons pas sciemment leurs données. Si vous constatez qu&apos;un
              compte appartient à un enfant, signalez-le nous : nous le supprimerons.
            </p>
          </Section>

          <Section title="Modifications">
            <p>
              Toute modification de cette politique est publiée sur cette page, avec
              une nouvelle date de mise à jour. Un changement substantiel — nouvelle
              catégorie de données, nouveau destinataire — est annoncé dans
              l&apos;application avant son entrée en vigueur.
            </p>
          </Section>
        </div>

        <footer className="mt-14 border-t border-[var(--color-hairline)] pt-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              ["/", "Le projet"],
              ["/accueil", "Accueil"],
              ["/suppression-donnees", "Supprimer mes données"],
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[1.125rem] font-bold tracking-[-0.0125rem] text-[var(--color-ink)] lg:text-[1.3125rem]">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-[0.875rem] leading-[1.7] text-[var(--color-muted)]">
        {children}
      </div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <table className="w-full min-w-[520px] border-collapse text-start text-[0.8125rem]">
        <thead>
          <tr>
            {head.map((cell) => (
              <th
                key={cell}
                className="border-b border-[var(--color-outline)] pb-2 pe-4 text-start font-bold text-[var(--color-ink)]"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) => (
                <td
                  key={index}
                  className="border-b border-[var(--color-hairline)] py-[10px] pe-4 align-top leading-[1.5]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
