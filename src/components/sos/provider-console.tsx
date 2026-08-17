"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  registerProvider,
  setProviderAvailability,
  updateProviderPosition,
} from "@/app/actions/sos";
import { SOS_TRADES, type SosTrade } from "@/lib/sos";
import { shouldPublishPosition } from "@/lib/geo";
import { Button, Card } from "@/components/ui/primitives";

const FIELD =
  "w-full rounded-[12px] border border-[var(--color-outline)] bg-white px-3 py-2 text-[12px] text-[var(--color-ink)]";

export interface ProviderProfile {
  trade: SosTrade;
  display_name: string;
  phone: string;
  description: string | null;
  travels: boolean;
  is_available: boolean;
  is_approved: boolean;
  position_updated_at: string | null;
}

/**
 * L'espace du dépanneur.
 *
 * Sa fiche, un interrupteur disponible/occupé, et le partage de position. Un
 * artisan consulte cet écran les mains sales, entre deux interventions : chaque
 * champ ajouté est un champ qu'il ne remplira pas.
 *
 * Le métier reste modifiable — un serrurier qui fait aussi de la vitrerie
 * changera de rubrique selon la saison — mais un seul à la fois : deux métiers
 * cochés videraient le filtre de son sens.
 */
export function ProviderConsole({ initial }: { initial: ProviderProfile }) {
  const { t } = useI18n();
  const [provider, setProvider] = useState(initial);
  const [trade, setTrade] = useState<SosTrade>(initial.trade);
  const [name, setName] = useState(initial.display_name);
  const [phone, setPhone] = useState(initial.phone);
  const [description, setDescription] = useState(initial.description ?? "");
  const [travels, setTravels] = useState(initial.travels);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const watchRef = useRef<number | null>(null);
  /* Dernière position réellement publiée, pour ne pas republier du bruit. */
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  /*
    Le partage de position s'arrête avec l'écran. `watchPosition` continue sinon
    à consommer le GPS en arrière-plan : batterie vidée, et position publiée par
    quelqu'un qui ne sait plus qu'il la partage.
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
      const result = await registerProvider({
        trade,
        displayName: name,
        phone,
        description: description || undefined,
        travels,
      });

      if (!result.ok) return setError(result.error);

      setProvider((current) => ({
        ...current,
        trade,
        display_name: name.trim(),
        phone: phone.trim(),
        description: description.trim() || null,
        travels,
      }));
    });
  }

  function onToggle() {
    const next = !provider.is_available;
    setProvider((current) => ({ ...current, is_available: next }));

    startTransition(async () => {
      const result = await setProviderAvailability(next);
      if (!result.ok) {
        setProvider((current) => ({ ...current, is_available: !next }));
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

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };

        // Même garde-fou que pour les taxis : cinquante mètres, ou vingt-cinq
        // secondes. Publier chaque tremblement du capteur coûtait le quota
        // mensuel de messages temps réel en une journée.
        if (!shouldPublishPosition(lastSentRef.current, next)) return;
        lastSentRef.current = { ...next, at: Date.now() };

        void updateProviderPosition(next.lat, next.lng);
        setProvider((current) => ({
          ...current,
          position_updated_at: new Date().toISOString(),
        }));
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
      {!provider.is_approved && (
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-[var(--color-live)]">
            {t.sos.pendingApproval}
          </p>
        </Card>
      )}

      <Card className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold text-[var(--color-ink)]">{t.sos.availability}</p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {provider.is_available ? t.sos.free : t.sos.busy}
          </p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          role="switch"
          aria-checked={provider.is_available}
          disabled={pending}
          className="relative h-7 w-12 flex-none rounded-full transition-colors"
          style={{
            background: provider.is_available ? "var(--color-ok, #2f7d5d)" : "var(--color-track)",
          }}
        >
          <span
            className="absolute top-1 h-5 w-5 rounded-full bg-white transition-[inset-inline-start]"
            style={{ insetInlineStart: provider.is_available ? "26px" : "4px" }}
          />
        </button>
      </Card>

      <Button tone={sharing ? "outline" : "primary"} onClick={onShare} disabled={sharing}>
        {sharing ? t.sos.positionShared : t.sos.sharePosition}
      </Button>

      <Card className="p-3">
        <form onSubmit={onSave} className="flex flex-col gap-[10px]">
          <label className="flex flex-col gap-[5px]">
            <span className="text-[10px] text-[var(--color-muted)]">{t.sos.trade}</span>
            <select
              value={trade}
              onChange={(e) => setTrade(e.target.value as SosTrade)}
              className={FIELD}
            >
              {SOS_TRADES.map((key) => (
                <option key={key} value={key}>
                  {t.sos.trades[key]}
                </option>
              ))}
            </select>
          </label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.sos.proName}
            className={FIELD}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder={t.sos.proPhone}
            className={FIELD}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder={t.sos.proDescription}
            className={FIELD}
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={travels}
              onChange={(e) => setTravels(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            <span className="text-[11px] text-[var(--color-ink)]">{t.sos.proTravels}</span>
          </label>

          {error && (
            <p role="alert" className="text-[11px] font-semibold text-[var(--color-live)]">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "…" : t.common.save}
          </Button>
        </form>
      </Card>
    </div>
  );
}
