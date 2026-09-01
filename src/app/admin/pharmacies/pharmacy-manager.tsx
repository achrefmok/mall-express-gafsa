"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { savePharmacyDuty, removePharmacyDuty } from "@/app/actions/admin";
import { cx } from "@/lib/format";
import { Button, Card, Divider, fieldClass } from "@/components/ui/primitives";

export interface PharmacyItem {
  id: string;
  on_date: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

const FIELD = fieldClass({ size: "xs", solid: true });

/** Centre de Gafsa, valeur du départ quand on ajoute une pharmacie sans position. */
const GAFSA = { lat: 34.425, lng: 8.784 };

/** Ajoute `n` jours à une date « YYYY-MM-DD », sans passer par UTC. */
function shift(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const local = new Date(y, m - 1, d + n);
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  return `${local.getFullYear()}-${mm}-${dd}`;
}

export function PharmacyManager({
  date,
  today,
  items,
}: {
  date: string;
  today: string;
  items: PharmacyItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = (d: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (d === today) p.delete("date");
    else p.set("date", d);
    router.push(`/admin/pharmacies${p.toString() ? `?${p.toString()}` : ""}`);
  };

  return (
    <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-[10px] pb-6">
      {/* ─── Choix du jour ──────────────────────────────────────────── */}
      <Card className="flex items-center gap-2 p-[10px]">
        <button
          type="button"
          onClick={() => go(shift(date, -1))}
          aria-label="Jour précédent"
          className="press flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-[var(--color-brand-tint)] text-[var(--color-brand)]"
        >
          ‹
        </button>

        <label className="flex min-w-0 flex-1 flex-col items-center gap-[2px]">
          <span className="text-[0.53125rem] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
            Jour de garde
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && go(e.target.value)}
            className={cx(FIELD, "w-full text-center")}
          />
        </label>

        <button
          type="button"
          onClick={() => go(shift(date, 1))}
          aria-label="Jour suivant"
          className="press flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-[var(--color-brand-tint)] text-[var(--color-brand)]"
        >
          ›
        </button>
      </Card>

      {/* ─── Les pharmacies de ce jour ──────────────────────────────── */}
      {items.length === 0 ? (
        <Card className="p-3 text-center">
          <p className="text-[0.71875rem] text-[var(--color-muted)]">
            Aucune pharmacie de garde pour ce jour.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <PharmacyRow key={item.id} item={item} />
          ))}
        </div>
      )}

      <Divider />

      <AddPharmacy date={date} />
    </div>
  );
}

/** Une pharmacie du jour, éditable et supprimable. */
function PharmacyRow({ item }: { item: PharmacyItem }) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [address, setAddress] = useState(item.address ?? "");
  const [phone, setPhone] = useState(item.phone ?? "");
  const [lat, setLat] = useState(item.latitude === null ? "" : String(item.latitude));
  const [lng, setLng] = useState(item.longitude === null ? "" : String(item.longitude));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await savePharmacyDuty({
        id: item.id,
        onDate: item.on_date ?? "",
        name,
        address,
        phone,
        latitude: lat === "" ? null : Number(lat),
        longitude: lng === "" ? null : Number(lng),
      });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <Card className="flex flex-col gap-2 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom de la pharmacie"
        aria-label="Nom"
        className={FIELD}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Adresse"
          aria-label="Adresse"
          className={FIELD}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Téléphone"
          aria-label="Téléphone"
          className={`${FIELD} sm:w-40`}
        />
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitude"
          aria-label="Latitude"
          className={`${FIELD} flex-1`}
        />
        <input
          type="number"
          step="any"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Longitude"
          aria-label="Longitude"
          className={`${FIELD} flex-1`}
        />
      </div>

      {error && (
        <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending || !name.trim()}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <RemoveButton item={item} />
      </div>
    </Card>
  );
}

function RemoveButton({ item }: { item: PharmacyItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      tone="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removePharmacyDuty(item.id);
          if (result.ok) router.refresh();
        })
      }
    >
      Supprimer
    </Button>
  );
}

/** Ajouter une pharmacie pour ce jour. */
function AddPharmacy({ date }: { date: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [lat, setLat] = useState(String(GAFSA.lat));
  const [lng, setLng] = useState(String(GAFSA.lng));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await savePharmacyDuty({
        onDate: date,
        name,
        address,
        phone,
        latitude: lat === "" ? null : Number(lat),
        longitude: lng === "" ? null : Number(lng),
      });
      if (result.ok) {
        setName("");
        setAddress("");
        setPhone("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-2 p-3">
      <p className="text-[0.6875rem] font-bold text-[var(--color-ink)]">Ajouter une pharmacie</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom de la pharmacie"
        aria-label="Nom"
        className={FIELD}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Adresse"
          aria-label="Adresse"
          className={FIELD}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Téléphone"
          aria-label="Téléphone"
          className={`${FIELD} sm:w-40`}
        />
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitude"
          aria-label="Latitude"
          className={`${FIELD} flex-1`}
        />
        <input
          type="number"
          step="any"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Longitude"
          aria-label="Longitude"
          className={`${FIELD} flex-1`}
        />
      </div>

      {error && (
        <p role="alert" className="text-[0.65625rem] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}

      <Button size="sm" block onClick={create} disabled={pending || !name.trim()}>
        {pending ? "Ajout…" : "Ajouter"}
      </Button>
    </Card>
  );
}
