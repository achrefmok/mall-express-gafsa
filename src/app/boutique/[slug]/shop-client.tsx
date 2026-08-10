"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { toggleFollowShop } from "@/app/actions/cart";
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
        "flex-none rounded-[16px] px-4 py-2 text-[11px] font-semibold transition-colors",
        following
          ? "border border-[var(--color-outline)] text-[var(--color-muted)]"
          : "bg-[var(--color-brand)] text-white",
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
              "flex-1 py-[10px] text-center text-[11.5px]",
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
