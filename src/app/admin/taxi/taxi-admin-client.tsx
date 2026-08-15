"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDriverApproval } from "@/app/actions/taxi";
import { Button, Card, Tag } from "@/components/ui/primitives";

export interface AdminDriver {
  id: string;
  display_name: string;
  phone: string;
  vehicle: string | null;
  plate: string | null;
  is_approved: boolean;
  is_available: boolean;
}

/** Une ligne de chauffeur, approuvable ou révocable. */
export function DriverRow({ driver }: { driver: AdminDriver }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setDriverApproval(driver.id, !driver.is_approved);
      router.refresh();
    });
  }

  return (
    <Card className="flex items-center gap-[10px] p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-bold text-[var(--color-ink)]">
          {driver.display_name}
        </p>
        <p className="truncate text-[10px] text-[var(--color-muted)]">
          {driver.phone}
          {driver.vehicle && ` · ${driver.vehicle}`}
          {driver.plate && ` · ${driver.plate}`}
        </p>
      </div>

      <Tag tone={driver.is_approved ? "tinted" : "live"}>
        {driver.is_approved ? "approuvé" : "à vérifier"}
      </Tag>

      <Button
        tone={driver.is_approved ? "outline" : "primary"}
        onClick={toggle}
        disabled={pending}
        className="flex-none"
      >
        {pending ? "…" : driver.is_approved ? "Révoquer" : "Approuver"}
      </Button>
    </Card>
  );
}
