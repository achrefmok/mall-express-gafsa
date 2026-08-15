"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { registerDriver, setDriverAvailability, updateDriverPosition } from "@/app/actions/taxi";
import { Button, Card } from "@/components/ui/primitives";

const FIELD =
  "w-full rounded-[12px] border border-[var(--color-outline)] bg-white px-3 py-2 text-[12px] text-[var(--color-ink)]";

export interface DriverProfile {
  display_name: string;
  phone: string;
  vehicle: string | null;
  plate: string | null;
  is_available: boolean;
  is_approved: boolean;
  position_updated_at: string | null;
}

/**
 * L'espace du chauffeur.
 *
 * Trois choses seulement : sa fiche, un interrupteur libre/occupé, et le partage
 * de sa position. Un chauffeur consulte cet écran au feu rouge — chaque champ
 * ajouté est un champ qu'il ne remplira pas.
 */
export function DriverConsole({ initial }: { initial: DriverProfile | null }) {
  const { t } = useI18n();
  const [driver, setDriver] = useState(initial);
  const [name, setName] = useState(initial?.display_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [vehicle, setVehicle] = useState(initial?.vehicle ?? "");
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const watchRef = useRef<number | null>(null);

  /*
    Le partage de position s'arrête avec l'écran.

    `watchPosition` continue sinon à consommer le GPS en arrière-plan, ce qui
    vide la batterie d'un chauffeur qui a simplement changé d'onglet — et publie
    une position qu'il ne sait plus qu'il partage.
  */
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await registerDriver({
        displayName: name,
        phone,
        vehicle: vehicle || undefined,
        plate: plate || undefined,
      });

      if (!result.ok) return setError(result.error);

      setDriver((current) => ({
        display_name: name.trim(),
        phone: phone.trim(),
        vehicle: vehicle.trim() || null,
        plate: plate.trim() || null,
        is_available: current?.is_available ?? false,
        is_approved: current?.is_approved ?? false,
        position_updated_at: current?.position_updated_at ?? null,
      }));
    });
  }

  function onToggle() {
    const next = !driver?.is_available;
    setDriver((current) => (current ? { ...current, is_available: next } : current));
    startTransition(async () => {
      const result = await setDriverAvailability(next);
      if (!result.ok) {
        setDriver((current) => (current ? { ...current, is_available: !next } : current));
        setError(result.error);
      }
    });
  }

  function onShare() {
    if (!("geolocation" in navigator)) {
      setError("Votre appareil ne permet pas le partage de position.");
      return;
    }

    setError(null);
    setSharing(true);

    /*
      `watchPosition` plutôt qu'un relevé unique : un taxi se déplace, et une
      position figée au moment de l'inscription enverrait les clients au mauvais
      endroit une heure plus tard.
    */
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void updateDriverPosition(position.coords.latitude, position.coords.longitude);
        setDriver((current) =>
          current ? { ...current, position_updated_at: new Date().toISOString() } : current,
        );
      },
      () => {
        setSharing(false);
        setError("Position refusée. Autorisez la localisation dans les réglages du navigateur.");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {driver && !driver.is_approved && (
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-[var(--color-live)]">
            {t.taxi.pendingApproval}
          </p>
        </Card>
      )}

      {driver && (
        <Card className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold text-[var(--color-ink)]">{t.taxi.availability}</p>
            <p className="text-[10px] text-[var(--color-muted)]">
              {driver.is_available ? t.taxi.free : t.taxi.busy}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggle}
            role="switch"
            aria-checked={driver.is_available}
            disabled={pending}
            className="relative h-7 w-12 flex-none rounded-full transition-colors"
            style={{
              background: driver.is_available ? "var(--color-ok, #2f7d5d)" : "var(--color-track)",
            }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white transition-[inset-inline-start]"
              style={{ insetInlineStart: driver.is_available ? "26px" : "4px" }}
            />
          </button>
        </Card>
      )}

      {driver && (
        <Button tone={sharing ? "outline" : "primary"} onClick={onShare} disabled={sharing}>
          {sharing ? t.taxi.positionShared : t.taxi.sharePosition}
        </Button>
      )}

      <Card className="p-3">
        <form onSubmit={onSave} className="flex flex-col gap-[10px]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.taxi.driverName}
            className={FIELD}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder={t.taxi.driverPhone}
            className={FIELD}
          />
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder={t.taxi.driverVehicle}
            className={FIELD}
          />
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder={t.taxi.driverPlate}
            className={FIELD}
          />

          {error && (
            <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "…" : driver ? t.common.save : t.taxi.register}
          </Button>
        </form>
      </Card>
    </div>
  );
}
