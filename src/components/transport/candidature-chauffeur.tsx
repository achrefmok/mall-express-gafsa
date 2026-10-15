"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerDriver } from "@/app/actions/taxi";
import { serviceIcon } from "@/components/ui/category-icons";
import type { AppLocale } from "@/types/database";

const IconeTaxi = serviceIcon("taxi")!;
const CHAMP =
  "min-h-[48px] w-full rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-4 text-[0.875rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)] focus:border-[var(--color-brand)]";
const LIBELLE = "text-[0.75rem] font-bold text-[var(--color-muted)]";

/** La candidature chauffeur en un écran : quatre champs, puis la fiche complète. */
export function CandidatureChauffeur({ locale, nom, telephone }: { locale: AppLocale; nom: string; telephone: string }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[18px] bg-[linear-gradient(140deg,#fbbf24,#d97706)] text-[#1a1204]">
          <IconeTaxi size={30} />
        </span>
        <div className="flex flex-col">
          <h1 className="text-[1.375rem] leading-tight font-black">{ar ? "كن سائقا" : "Devenir chauffeur"}</h1>
          <p className="text-[0.8125rem] text-[var(--color-muted)]">
            {ar ? "دقيقة واحدة، ثم مصادقة الإدارة." : "Une minute, puis la validation de l’administration."}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-2 rounded-[18px] bg-[var(--color-surface-solid)] p-4 text-[0.8125rem]">
        {(ar
          ? ["املأ بطاقتك", "تتحقّق الإدارة من هويّتك وسيارتك", "تظهر للحرفاء وتستقبل الطلبات"]
          : ["Remplissez votre fiche", "L’administration vérifie votre identité et votre véhicule", "Vous apparaissez aux clients et recevez des courses"]
        ).map((etape, i) => (
          <li key={etape} className="flex items-center gap-3">
            <b className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.75rem] text-[var(--color-brand)]">
              {i + 1}
            </b>
            {etape}
          </li>
        ))}
      </ol>

      <form
        className="flex flex-col gap-4"
        action={(fd) => {
          setErreur(null);
          start(async () => {
            const r = await registerDriver({
              displayName: String(fd.get("nom") ?? ""),
              phone: String(fd.get("telephone") ?? ""),
              vehicle: String(fd.get("vehicule") ?? "") || undefined,
              plate: String(fd.get("plaque") ?? "") || undefined,
            });
            if (!r.ok) return setErreur(r.error);
            router.push("/profil/chauffeur");
            router.refresh();
          });
        }}
      >
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>{ar ? "الاسم الظاهر للحرفاء" : "Nom affiché aux clients"}</span>
          <input name="nom" required minLength={2} defaultValue={nom} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>{ar ? "الهاتف" : "Téléphone"}</span>
          <input name="telephone" type="tel" inputMode="tel" required defaultValue={telephone} placeholder="+216 …" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>{ar ? "السيارة (اختياري)" : "Véhicule (facultatif)"}</span>
          <input name="vehicule" placeholder={ar ? "مثال: بيجو 301 صفراء" : "Ex. Peugeot 301 jaune"} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>{ar ? "رقم اللوحة (اختياري)" : "Plaque (facultatif)"}</span>
          <input name="plaque" dir="ltr" placeholder="123 TU 4567" className={CHAMP} />
        </label>
        {erreur && (
          <p role="alert" className="rounded-[12px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.8125rem] font-semibold text-[var(--color-live)]">
            {erreur}
          </p>
        )}
        <button type="submit" disabled={pending} className="press min-h-[52px] rounded-[16px] bg-[var(--color-brand-fill)] text-[0.9375rem] font-extrabold text-white disabled:opacity-60">
          {pending ? "…" : ar ? "أرسل ترشّحي" : "Envoyer ma candidature"}
        </button>
      </form>
    </div>
  );
}
