"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/account";
import { useI18n } from "@/lib/i18n/provider";

const CHAMP =
  "min-h-[46px] w-full rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-4 text-[0.875rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]";

/** Nom et téléphone — via l'action de profil existante (mêmes contrôles que G-Mall). */
export function FormulaireProfilTransport({ prenom, nom, telephone }: { prenom: string; nom: string; telephone: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-3 rounded-[18px] bg-[var(--color-surface-solid)] p-4"
      action={(fd) => {
        setMessage(null);
        start(async () => {
          const r = await updateProfile({
            firstName: String(fd.get("prenom") ?? ""),
            lastName: String(fd.get("nom") ?? ""),
            phone: String(fd.get("telephone") ?? ""),
          });
          setMessage(r.ok ? { ok: true, texte: ar ? "تمّ الحفظ" : "Enregistré" } : { ok: false, texte: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[0.75rem] font-bold text-[var(--color-muted)]">{ar ? "الاسم" : "Prénom"}</span>
          <input name="prenom" defaultValue={prenom} required className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.75rem] font-bold text-[var(--color-muted)]">{ar ? "اللقب" : "Nom"}</span>
          <input name="nom" defaultValue={nom} className={CHAMP} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[0.75rem] font-bold text-[var(--color-muted)]">{ar ? "الهاتف" : "Téléphone"}</span>
        <input name="telephone" type="tel" inputMode="tel" defaultValue={telephone} placeholder="+216 …" className={CHAMP} />
      </label>
      {message && (
        <p role="status" className="text-[0.8125rem] font-bold" style={{ color: message.ok ? "var(--color-success)" : "var(--color-live)" }}>
          {message.texte}
        </p>
      )}
      <button type="submit" disabled={pending} className="min-h-[46px] rounded-[14px] bg-[var(--color-brand-fill)] text-[0.875rem] font-extrabold text-white disabled:opacity-60">
        {pending ? "…" : ar ? "حفظ" : "Enregistrer"}
      </button>
    </form>
  );
}
