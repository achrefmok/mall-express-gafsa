"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { toggleFollowShop } from "@/app/actions/cart";
import { countShopView, openConversation } from "@/app/actions/account";
import { telHref, whatsAppHref } from "@/lib/contact";
import { cx } from "@/lib/format";
import { GridIcon, LiveDot, SparkIcon } from "@/components/ui/icons";

export function FollowButton({
  shopId,
  initiallyFollowing,
  variante = "bouton",
}: {
  shopId: string;
  initiallyFollowing: boolean;
  /** `logo` : la pastille « + متابعة » posée sur le bas du logo (handoff). */
  variante?: "bouton" | "logo";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const previous = following;
    setFollowing(!previous);

    startTransition(async () => {
      const result = await toggleFollowShop(shopId, previous);
      if (!result.ok) {
        setFollowing(previous);
        if (result.error === "Authentification requise") router.push("/connexion");
      } else {
        router.refresh();
      }
    });
  }

  if (variante === "logo") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={following}
        className="absolute -bottom-[10px] left-1/2 z-[2] h-6 -translate-x-1/2 rounded-[12px] border-2 border-white px-[10px] text-[0.6875rem] font-extrabold whitespace-nowrap shadow-[0_4px_10px_rgba(60,40,90,.25)]"
        style={{
          background: following ? "var(--theme-accent-doux)" : "var(--theme-accent)",
          color: following ? "var(--theme-accent-fort)" : "var(--theme-accent-texte)",
        }}
      >
        {following ? `✓ ${t.shop.following}` : `+ ${t.shop.follow}`}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={following}
      className={cx(
        "flex-none rounded-[16px] px-4 py-2 text-[0.6875rem] font-semibold transition-colors",
        following
          ? "border border-[var(--color-outline)] text-[var(--color-muted)]"
          : "bg-[var(--theme-accent,var(--color-brand-fill))] text-[var(--theme-accent-texte,white)]",
      )}
    >
      {following ? t.shop.following : t.shop.follow}
    </button>
  );
}

export function ShopTabs({
  active,
  slug,
  liveCount,
}: {
  active: string;
  slug: string;
  liveCount: number;
}) {
  const { t } = useI18n();

  /*
    Pas d'onglet "Posts" : aucune table ne porte cette donnée, et
    `shops.posts_count` n'est incrémenté nulle part — voir TODO.md. Un
    onglet qui mène toujours à une grille de produits vide serait pire
    qu'absent : il promettrait un contenu qui n'existe pas.
  */
  const tabs = [
    { key: "products", label: t.shop.tabs.products, icon: <GridIcon size={16} /> },
    { key: "promos", label: t.shop.tabs.promos, icon: <SparkIcon size={16} /> },
    { key: "lives", label: t.shop.tabs.lives, icon: <LiveDot size={9} />, badge: liveCount },
  ];

  /*
    Trois petites pastilles plutôt qu'une bande pleine largeur avec un mot
    par onglet : l'intitulé reste accessible (aria-label, titre), juste
    plus discret visuellement — l'essentiel de l'écran revient aux rayons
    et aux produits qui suivent.
  */
  return (
    <div className="mt-4 flex flex-none items-center gap-2 px-4">
      {tabs.map((tab) => {
        const current = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/boutique/${slug}?onglet=${tab.key}`}
            scroll={false}
            aria-current={current ? "page" : undefined}
            aria-label={tab.label}
            title={tab.label}
            className={cx(
              "relative flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors",
              current
                ? "bg-[var(--theme-accent,var(--color-brand-fill))] text-[var(--theme-accent-texte,white)]"
                : "bg-[var(--color-surface-solid)] text-[var(--color-muted)]",
            )}
          >
            {tab.icon}
            {Boolean(tab.badge) && (
              <span className="absolute -top-[2px] -end-[2px] flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[var(--color-live-fill)] px-[3px] text-[0.5rem] font-bold text-white">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

const PILL =
  "rounded-[12px] border border-[var(--color-outline)] px-[10px] py-[5px] text-[0.625rem] font-semibold";

/**
 * Joindre le vendeur, par le canal que le client choisit.
 *
 * La messagerie du site vient en premier : c'est le seul canal dont les deux
 * parties gardent une trace consultable, et le seul qui fonctionne pour un client
 * qui écrit à 23 h. L'appel et WhatsApp suivent, parce qu'à Gafsa c'est ainsi
 * qu'on prend contact quand on est pressé.
 *
 * Le bouton de messagerie ouvre — ou retrouve — la conversation avant de
 * naviguer : arriver sur une liste vide en se demandant où écrire est le
 * décrochage le plus banal de ce parcours.
 */
export function ShopContact({
  shopId,
  shopName,
  phone,
  labels,
  variante = "pilules",
}: {
  shopId: string;
  shopName: string;
  phone: string | null;
  labels: { message: string; call: string; whatsApp: string };
  variante?: "pilules" | "handoff";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const tel = telHref(phone);
  const wa = whatsAppHref(
    phone,
    `Bonjour ${shopName}, je vous contacte depuis G-Mall.`,
  );

  function onMessage() {
    startTransition(async () => {
      const result = await openConversation(shopId);

      if (!result.ok) {
        // Un visiteur non connecté ne peut pas ouvrir de conversation : on
        // l'envoie se connecter, puis revenir ici.
        router.push(`/connexion?suite=${encodeURIComponent(`/boutique?contact=${shopId}`)}`);
        return;
      }

      router.push(`/messages/${result.data.id}`);
    });
  }

  /*
    Variante du handoff : un bouton principal plein (libellé du métier —
    « اسأل البائع », « اطلب عيّنة »…) qui ouvre la messagerie, puis l'appel
    et WhatsApp en icônes de 46px.
  */
  if (variante === "handoff") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onMessage}
          disabled={pending}
          className="press min-h-[46px] min-w-0 flex-1 truncate rounded-[14px] bg-[var(--theme-accent)] px-3 text-[0.875rem] font-extrabold whitespace-nowrap text-[var(--theme-accent-texte)] disabled:opacity-60"
        >
          {pending ? "…" : labels.message}
        </button>
        {tel && (
          <a
            href={tel}
            aria-label={labels.call}
            title={labels.call}
            className="press flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-[var(--theme-accent-doux)] text-[var(--theme-accent-fort)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
            </svg>
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={labels.whatsApp}
            title={labels.whatsApp}
            className="press flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-[#e2f5ea] text-[#1d7a46]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5z" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onMessage}
        disabled={pending}
        className={cx(PILL, "text-[var(--color-ink)] disabled:opacity-60")}
      >
        {pending ? "…" : labels.message}
      </button>

      {tel && (
        <a href={tel} className={cx(PILL, "text-[var(--color-ink)]")}>
          {labels.call}
        </a>
      )}

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(PILL, "border-transparent bg-[#e6f4ea] text-[#0f7a3d]")}
        >
          {labels.whatsApp}
        </a>
      )}
    </div>
  );
}

/**
 * Compter la visite, une fois, sans rien afficher.
 *
 * Le comptage vit dans le navigateur parce que la page est servie en cache
 * pendant cinq minutes : un incrément pendant le rendu n'aurait compté qu'une
 * visite par intervalle, quel que soit le nombre de visiteurs.
 *
 * Effet de bord : les robots d'indexation ne comptent plus, ce qui rend le chiffre
 * plus honnête qu'un comptage serveur.
 *
 * Le verrou par référence est nécessaire, pas décoratif : React monte deux fois
 * chaque composant en développement, et sans lui chaque visite locale compterait
 * double — un écart qu'on ne remarquerait qu'en cherchant longtemps.
 */
export function CountShopView({ shopId }: { shopId: string }) {
  const counted = useRef(false);

  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    void countShopView(shopId);
  }, [shopId]);

  return null;
}
