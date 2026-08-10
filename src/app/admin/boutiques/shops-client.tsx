"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { setShopFeatured } from "@/app/actions/admin";
import { Switch } from "@/components/ui/primitives";

/** « Mettre une boutique à la une » de l'écran 14. */
export function FeatureToggle({ shopId, featured }: { shopId: string; featured: boolean }) {
  const { t } = useI18n();
  const [on, setOn] = useState(featured);
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={on}
      disabled={pending}
      label={t.admin.featureShop}
      onChange={(next) => {
        setOn(next);
        startTransition(async () => {
          const result = await setShopFeatured(shopId, next);
          if (!result.ok) setOn(!next);
        });
      }}
    />
  );
}
