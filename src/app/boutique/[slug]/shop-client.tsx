"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { toggleFollowShop } from "@/app/actions/cart";
import { countShopView, openConversation } from "@/app/actions/account";
import { telHref, whatsAppHref } from "@/lib/contact";
import { cx } from "@/lib/format";

export function FollowButton({
  shopId,
  initiallyFollowing,
}: {
  shopId: string;
  initiallyFollowing: boolean;
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
          : "bg-[var(--color-brand-fill)] text-white",
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

  const tabs = [
    { key: "products", label: t.shop.tabs.products },
    { key: "promos", label: t.shop.tabs.promos },
    { key: "posts", label: t.shop.tabs.posts },
    { key: "lives", label: `${t.shop.tabs.lives}${liveCount > 0 ? ` (${liveCount})` : ""}` },
  ];

  return (
    <div className="mt-3 flex flex-none border-y border-[var(--color-hairline)]">
      {tabs.map((tab) => {
        const current = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/boutique/${slug}?onglet=${tab.key}`}
            scroll={false}
            aria-current={current ? "page" : undefined}
            className={cx(
              "flex-1 py-[10px] text-center text-[0.71875rem]",
              current
                ? "border-b-2 border-[var(--color-brand)] font-semibold text-[var(--color-brand)]"
                : "text-[var(--color-muted)]",
            )}
          >
            {tab.label}
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
}: {
  shopId: string;
  shopName: string;
  phone: string | null;
  labels: { message: string; call: string; whatsApp: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const tel = telHref(phone);
  const wa = whatsAppHref(
    phone,
    `Bonjour ${shopName}, je vous contacte depuis Mall Express Gafsa.`,
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
