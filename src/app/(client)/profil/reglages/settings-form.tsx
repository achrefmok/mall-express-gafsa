"use client";

import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { updateProfile } from "@/app/actions/account";
import { updatePassword } from "@/app/actions/auth";
import { uploadImage } from "@/lib/upload";
import { cx, monogram } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Avatar, Button, Card, Divider, KeyValueRow, SectionTitle, Switch, fieldClass } from "@/components/ui/primitives";
import type { Profile } from "@/types/database";
import { ReplayClientTour } from "@/components/tour/tours";

const FIELD =
  fieldClass({ strong: true });
const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

export function AccountSettingsForm({ profile }: { profile: Profile }) {
  const { t, locale, textScale, simplified, setLocale, cycleTextScale, toggleSimplified } = useI18n();

  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [city, setCity] = useState(profile.city ?? "Gafsa");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const avatarInput = useRef<HTMLInputElement>(null);

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    setFeedback(null);

    try {
      const { publicUrl } = await uploadImage("avatars", file);
      setAvatarUrl(publicUrl);
    } catch (cause) {
      setFeedback({
        kind: "error",
        message: cause instanceof Error ? cause.message : t.common.error,
      });
    }
  }

  function onSave() {
    setFeedback(null);

    startTransition(async () => {
      const result = await updateProfile({ firstName, lastName, phone, city, avatarUrl });
      setFeedback(
        result.ok
          ? { kind: "ok", message: t.common.saved }
          : { kind: "error", message: result.error },
      );
    });
  }

  function onChangePassword() {
    setFeedback(null);

    startTransition(async () => {
      const result = await updatePassword(password);
      if (result.ok) {
        setPassword("");
        setFeedback({ kind: "ok", message: t.common.saved });
      } else {
        setFeedback({ kind: "error", message: result.error });
      }
    });
  }

  const scaleLabel = { normal: "Normal", large: "Grand", xlarge: "Très grand" }[textScale];

  return (
    <>
      <TopBar
        title={t.nav.settings}
        back="/profil"
        action={
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !firstName.trim()}
            className="text-[0.71875rem] font-bold text-[var(--color-brand)] disabled:opacity-40"
          >
            {pending ? t.common.saving : t.common.save}
          </button>
        }
      />

      <div className="col-reading no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[14px] pb-6">
        {/* ─── Identité ──────────────────────────────────────────────── */}
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>{t.vendor.identity}</SectionTitle>

          <Card className="flex items-center gap-3 p-3">
            <Avatar
              src={avatarUrl}
              initials={monogram(firstName, lastName)}
              size={52}
              tone="ink"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.71875rem] font-semibold text-[var(--color-ink)]">Photo de profil</p>
              <p className="text-[0.65625rem] text-[var(--color-muted)]">JPG ou PNG, 2 Mo maximum</p>
            </div>
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              className="flex-none text-[0.65625rem] font-semibold text-[var(--color-brand)]"
            >
              {t.common.change}
            </button>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void onAvatar(event.target.files?.[0])}
            />
          </Card>

          <Card className="flex flex-col gap-[10px] p-3">
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className={LABEL}>{t.auth.firstName}</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className={FIELD}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className={LABEL}>{t.auth.lastName}</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className={FIELD}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t.cart.contactPhone}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+216 …"
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Ville</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
                className={FIELD}
              />
            </label>
          </Card>
        </section>

        {/* ─── Affichage et accessibilité ────────────────────────────── */}
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Affichage</SectionTitle>

          <Card className="flex flex-col gap-[10px] p-3">
            <KeyValueRow label="Langue">
              <button
                type="button"
                onClick={() => setLocale(locale === "ar" ? "fr" : "ar")}
                className="rounded-[10px] bg-[var(--color-brand-tint)] px-3 py-1 text-[0.6875rem] font-bold text-[var(--color-brand)]"
              >
                {locale === "ar" ? "العربية" : "Français"}
              </button>
            </KeyValueRow>

            <Divider />

            <KeyValueRow label={t.a11y.biggerText}>
              <button
                type="button"
                onClick={cycleTextScale}
                className="rounded-[10px] bg-[var(--color-brand-tint)] px-3 py-1 text-[0.6875rem] font-bold text-[var(--color-brand)]"
              >
                {scaleLabel}
              </button>
            </KeyValueRow>

            <Divider />

            <KeyValueRow label={t.a11y.simplified}>
              <Switch checked={simplified} onChange={toggleSimplified} label={t.a11y.simplified} />
            </KeyValueRow>
          </Card>

          <p className="text-[0.59375rem] leading-[1.45] text-[var(--color-muted)]">
            Ces réglages sont enregistrés sur votre compte : vous les retrouverez sur un autre
            appareil.
          </p>
        </section>

        {/* ─── Sécurité ──────────────────────────────────────────────── */}
        <section className="flex flex-none flex-col gap-2">
          <SectionTitle>Sécurité</SectionTitle>

          <Card className="flex flex-col gap-[10px] p-3">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Nouveau {t.auth.password.toLowerCase()}</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                minLength={8}
                autoComplete="new-password"
                placeholder="8 caractères minimum"
                className={cx(FIELD, "placeholder:font-normal placeholder:text-[var(--color-faint)]")}
              />
            </label>

            <Button
              tone="outline"
              size="sm"
              onClick={onChangePassword}
              disabled={pending || password.length < 8}
            >
              {t.common.save}
            </Button>
          </Card>
        </section>

        {/* ─── Fidélité, en lecture seule ────────────────────────────── */}
        <Card className="flex flex-none flex-col gap-[10px] p-3">
          <KeyValueRow label="Points de fidélité">
            <span className="font-bold text-[var(--color-brand)]">{profile.loyalty_points}</span>
          </KeyValueRow>
          <Divider />
          <KeyValueRow label="Code de parrainage">
            <span className="font-mono text-[0.6875rem] font-bold text-[var(--color-ink)]">
              {profile.referral_code ?? "—"}
            </span>
          </KeyValueRow>
        </Card>

        {/* Le guide se revoit à la demande : personne ne retient six écrans du
            premier coup, et le proposer ici évite d'avoir à le subir en boucle. */}
        <ReplayClientTour />

        {feedback && (
          <p
            role="status"
            className={cx(
              "text-[0.6875rem] font-semibold",
              feedback.kind === "ok" ? "text-[var(--color-brand)]" : "text-[var(--color-live)]",
            )}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </>
  );
}
