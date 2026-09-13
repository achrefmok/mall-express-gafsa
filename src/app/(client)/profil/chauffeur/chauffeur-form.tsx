"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { enregistrerProfilChauffeur, type ProfilChauffeurInput } from "@/app/actions/taxi-profil";
import { setDriverStatus } from "@/app/actions/taxi";
import { uploadImage } from "@/lib/upload";
import { TAXI_ZONES } from "@/lib/taxi-zones";
import type { TaxiStatus } from "@/types/database";
import { useI18n } from "@/lib/i18n/provider";

const LANGUES = ["Arabe", "Français", "Anglais", "Italien", "Allemand"];

const ETATS: ReadonlyArray<{ cle: TaxiStatus; libelle: "statusFree" | "statusBusy" | "statusOffline"; puce: string }> = [
  { cle: "libre", libelle: "statusFree", puce: "🟢" },
  { cle: "occupe", libelle: "statusBusy", puce: "🟠" },
  { cle: "hors_ligne", libelle: "statusOffline", puce: "⚫" },
];

/**
 * La bascule de disponibilité.
 *
 * Elle passe par `setDriverStatus`, l'action de la console de course — pas
 * par une écriture à part. C'est cette action qui, au passage à « libre »,
 * rediffuse au chauffeur les demandes nées pendant qu'il était éteint. Une
 * seconde voie aurait changé le statut sans cette moitié-là.
 */
export function BasculeStatut({ initial }: { initial: TaxiStatus }) {
  const { t } = useI18n();
  const [statut, setStatut] = useState<TaxiStatus>(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choisir(cle: TaxiStatus) {
    const avant = statut;
    setStatut(cle);
    setErreur(null);
    startTransition(async () => {
      const r = await setDriverStatus({ statut: cle });
      if (!r.ok) {
        setStatut(avant);
        setErreur(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.driver.availability}>
        {ETATS.map((e) => (
          <button
            key={e.cle}
            type="button"
            role="radio"
            aria-checked={statut === e.cle || (e.cle === "libre" && statut === "places")}
            disabled={pending}
            onClick={() => choisir(e.cle)}
            className={`flex min-h-12 flex-col items-center justify-center gap-[2px] rounded-[14px] text-[0.75rem] font-bold transition-colors disabled:opacity-60 ${
              statut === e.cle || (e.cle === "libre" && statut === "places")
                ? "bg-[var(--color-ink)] text-[var(--color-app)]"
                : "bg-[var(--color-field)] text-[var(--color-ink)]"
            }`}
          >
            <span aria-hidden>{e.puce}</span>
            {t.driver[e.libelle]}
          </button>
        ))}
      </div>
      {erreur && <p role="alert" className="text-[0.71875rem] text-[var(--color-live)]">{erreur}</p>}
    </div>
  );
}

/**
 * La fiche du chauffeur.
 *
 * Trois blocs, dans l'ordre où un client les lit : qui, quelle voiture, où.
 * Le numéro de permis vient en dernier, avec la mention qu'il reste privé —
 * un chauffeur hésite à le donner s'il croit qu'il sera affiché.
 */
export function FormulaireChauffeur({ initial }: { initial: ProfilChauffeurInput }) {
  const { t, locale } = useI18n();
  const [f, setF] = useState<ProfilChauffeurInput>(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [pending, startTransition] = useTransition();
  const fichier = useRef<HTMLInputElement | null>(null);

  const maj = <K extends keyof ProfilChauffeurInput>(cle: K, valeur: ProfilChauffeurInput[K]) =>
    setF((v) => ({ ...v, [cle]: valeur }));

  const basculerDans = (cle: "serviceZones" | "languages", valeur: string) =>
    setF((v) => ({
      ...v,
      [cle]: v[cle].includes(valeur) ? v[cle].filter((x) => x !== valeur) : [...v[cle], valeur],
    }));

  async function televerser(file: File) {
    setErreur(null);
    setEnvoiPhoto(true);
    try {
      const r = await uploadImage("avatars", file);
      maj("photoUrl", r.publicUrl);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : t.driver.photoFailed);
    } finally {
      setEnvoiPhoto(false);
    }
  }

  function enregistrer() {
    setErreur(null);
    setOk(false);
    startTransition(async () => {
      const r = await enregistrerProfilChauffeur(f);
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      setOk(true);
      window.setTimeout(() => setOk(false), 2200);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enregistrer();
      }}
      className="flex flex-col gap-3"
    >
      <Bloc titre={t.driver.personal}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fichier.current?.click()}
            className="relative h-20 w-20 flex-none overflow-hidden rounded-full bg-[var(--color-brand-tint)]"
            aria-label={t.driver.changePhoto}
          >
            {f.photoUrl ? (
              <Image src={f.photoUrl} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[1.5rem]">📷</span>
            )}
            {envoiPhoto && <span className="absolute inset-0 animate-pulse bg-black/30" />}
          </button>
          <input
            ref={fichier}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void televerser(file);
            }}
          />
          <p className="text-[0.75rem] text-[var(--color-muted)]">
            {t.driver.photoHint}
          </p>
        </div>

        <Champ libelle={t.driver.fullName}>
          <input value={f.displayName} onChange={(e) => maj("displayName", e.target.value)} maxLength={60} className={CHAMP} />
        </Champ>
        <Champ libelle={t.driver.phone}>
          <input value={f.phone} onChange={(e) => maj("phone", e.target.value)} inputMode="tel" autoComplete="tel" className={CHAMP} />
        </Champ>
        <label className="flex min-h-11 items-center gap-2 text-[0.8125rem] text-[var(--color-ink)]">
          <input
            type="checkbox"
            checked={f.showPhone}
            onChange={(e) => maj("showPhone", e.target.checked)}
            className="h-5 w-5 accent-[var(--color-brand)]"
          />
          {t.driver.showPhone}
        </label>
        <Champ libelle={t.driver.bio}>
          <textarea
            value={f.bio ?? ""}
            onChange={(e) => maj("bio", e.target.value)}
            maxLength={400}
            rows={3}
            placeholder={t.driver.bioPlaceholder}
            className={`${CHAMP} min-h-[88px] py-3`}
          />
        </Champ>
      </Bloc>

      <Bloc titre={t.driver.vehicle}>
        <div className="grid grid-cols-2 gap-2">
          <Champ libelle={t.driver.brand}>
            <input value={f.vehicleBrand ?? ""} onChange={(e) => maj("vehicleBrand", e.target.value)} maxLength={30} placeholder="Peugeot" className={CHAMP} />
          </Champ>
          <Champ libelle={t.driver.model}>
            <input value={f.vehicleModel ?? ""} onChange={(e) => maj("vehicleModel", e.target.value)} maxLength={30} placeholder="301" className={CHAMP} />
          </Champ>
          <Champ libelle={t.driver.color}>
            <input value={f.vehicleColor ?? ""} onChange={(e) => maj("vehicleColor", e.target.value)} maxLength={30} placeholder="Jaune" className={CHAMP} />
          </Champ>
          <Champ libelle={t.driver.year}>
            <input
              value={f.vehicleYear ?? ""}
              onChange={(e) => maj("vehicleYear", e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 4)) : null)}
              inputMode="numeric"
              placeholder="2019"
              className={CHAMP}
            />
          </Champ>
        </div>
        <Champ libelle={t.driver.plate}>
          <input value={f.plate ?? ""} onChange={(e) => maj("plate", e.target.value)} maxLength={20} placeholder="123 TU 4567" className={`${CHAMP} font-mono`} />
        </Champ>
      </Bloc>

      <Bloc titre={t.driver.activity}>
        <fieldset className="flex flex-col gap-2">
          <legend className={LEGENDE}>{t.driver.zones}</legend>
          <div className="flex flex-wrap gap-2">
            {TAXI_ZONES.map((z) => (
              <Pastille key={z.id} actif={f.serviceZones.includes(z.id)} onClick={() => basculerDans("serviceZones", z.id)}>
                {locale === "ar" ? z.ar : z.fr}
              </Pastille>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={LEGENDE}>{t.driver.languages}</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUES.map((l) => (
              <Pastille key={l} actif={f.languages.includes(l)} onClick={() => basculerDans("languages", l)}>
                {t.driver.languageNames[l] ?? l}
              </Pastille>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <Champ libelle={t.driver.experience}>
            <input
              value={f.experienceYears ?? ""}
              onChange={(e) => maj("experienceYears", e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 2)) : null)}
              inputMode="numeric"
              className={CHAMP}
            />
          </Champ>
          <Champ libelle={t.driver.license}>
            <input value={f.licenseNumber ?? ""} onChange={(e) => maj("licenseNumber", e.target.value)} maxLength={40} className={`${CHAMP} font-mono`} />
          </Champ>
        </div>
        <p className="text-[0.6875rem] text-[var(--color-muted)]">
          {t.driver.licenseNote}
        </p>
      </Bloc>

      {erreur && (
        <p role="alert" className="rounded-[12px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.8125rem] text-[var(--color-live)]">
          {erreur}
        </p>
      )}

      {/* Collé en bas : il reste sous le pouce, quelle que soit la longueur de la fiche. */}
      <div className="sticky bottom-0 -mx-4 bg-[var(--color-app)] px-4 pt-2 pb-1">
        <button
          type="submit"
          disabled={pending || envoiPhoto}
          className="min-h-12 w-full rounded-[14px] bg-[var(--color-brand-fill)] text-[0.875rem] font-bold text-white disabled:opacity-50"
        >
          {pending ? t.driver.saving : ok ? t.driver.saved : t.driver.save}
        </button>
      </div>
    </form>
  );
}

const CHAMP =
  "min-h-11 w-full rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 text-[0.875rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]";
const LEGENDE = "mb-1 text-[0.625rem] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase";

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{titre}</h2>
      {children}
    </section>
  );
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LEGENDE}>{libelle}</span>
      {children}
    </label>
  );
}

function Pastille({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`min-h-10 rounded-full px-4 text-[0.75rem] font-semibold transition-colors ${
        actif ? "bg-[var(--color-brand-fill)] text-white" : "bg-[var(--color-field)] text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}
