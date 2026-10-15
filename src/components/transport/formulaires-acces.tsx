"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { connexionTransport, inscriptionTransport } from "@/app/actions/transport-auth";
import { serviceIcon } from "@/components/ui/category-icons";
import { useI18n } from "@/lib/i18n/provider";

const IconeTaxi = serviceIcon("taxi")!;

const CHAMP =
  "min-h-[48px] w-full rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-4 text-[0.875rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)] focus:border-[var(--color-brand)]";
const LIBELLE = "text-[0.75rem] font-bold text-[var(--color-muted)]";

/** L'en-tête commun : pictogramme ambre, nom de l'application, sous-titre. */
function EnTete({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  const { locale } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 pt-10 pb-2 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(140deg,#fbbf24,#d97706)] text-[#1a1204] shadow-[0_14px_30px_rgba(245,158,11,.3)]">
        <IconeTaxi size={34} />
      </span>
      <span className="text-[0.75rem] font-extrabold tracking-[0.14em] text-[var(--color-brand)] uppercase">
        {locale === "ar" ? "تاكسي ولواج قفصة" : "Taxi & Louage Gafsa"}
      </span>
      <h1 className="text-[1.5rem] leading-[1.15] font-black tracking-[-0.4px]">{titre}</h1>
      <p className="max-w-[300px] text-[0.8125rem] leading-[1.5] text-[var(--color-muted)]">{sousTitre}</p>
    </div>
  );
}

export function ConnexionTransport({ suite }: { suite?: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-5 px-5 pb-10">
      <EnTete
        titre={ar ? "تسجيل الدخول" : "Connexion"}
        sousTitre={ar ? "نفس حسابك في G-Mall، أو أنشئ حسابا في دقيقة." : "Le même compte que sur G-Mall, ou créez-en un en une minute."}
      />
      <form
        className="flex flex-col gap-4"
        action={(fd) => {
          setErreur(null);
          start(async () => {
            const r = await connexionTransport(String(fd.get("email")), String(fd.get("mdp")), suite);
            if (r && !r.ok) setErreur(r.error);
          });
        }}
      >
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>{ar ? "البريد الإلكتروني" : "E-mail"}</span>
          <input name="email" type="email" required autoComplete="email" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>{ar ? "كلمة السر" : "Mot de passe"}</span>
          <input name="mdp" type="password" required autoComplete="current-password" className={CHAMP} />
        </label>
        {erreur && (
          <p role="alert" className="rounded-[12px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.8125rem] font-semibold text-[var(--color-live)]">
            {erreur}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="press min-h-[52px] rounded-[16px] bg-[var(--color-brand-fill)] text-[0.9375rem] font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "…" : ar ? "دخول" : "Se connecter"}
        </button>
      </form>
      <div className="flex flex-col items-center gap-2 text-[0.8125rem]">
        <Link href="/mot-de-passe-oublie" className="font-semibold text-[var(--color-muted)]">
          {ar ? "نسيت كلمة السر؟" : "Mot de passe oublié ?"}
        </Link>
        <Link href={suite ? `/inscription?suite=${encodeURIComponent(suite)}` : "/inscription"} className="font-extrabold text-[var(--color-brand)]">
          {ar ? "ليس لديك حساب؟ أنشئ حسابا" : "Pas de compte ? Créer un compte"}
        </Link>
      </div>
    </div>
  );
}

export function InscriptionTransport({ chauffeurParDefaut }: { chauffeurParDefaut: boolean }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [chauffeur, setChauffeur] = useState(chauffeurParDefaut);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attenteCourriel, setAttenteCourriel] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (attenteCourriel) {
    return (
      <div className="flex flex-col gap-5 px-5 pb-10">
        <EnTete
          titre={ar ? "تحقّق من بريدك" : "Vérifiez vos e-mails"}
          sousTitre={
            ar
              ? `أرسلنا رابط التأكيد إلى ${attenteCourriel}.`
              : `Un lien de confirmation a été envoyé à ${attenteCourriel}.`
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-10">
      <EnTete
        titre={ar ? "إنشاء حساب" : "Créer mon compte"}
        sousTitre={ar ? "اطلب تاكسي أو احجز مقعدك في اللواج — أو اشتغل كسائق." : "Commandez un taxi, réservez votre louage — ou roulez comme chauffeur."}
      />

      {/* Deux parcours, un seul compte : le choix chauffeur mène ensuite à sa fiche. */}
      <div role="radiogroup" className="grid grid-cols-2 gap-2">
        {[
          [false, ar ? "أنا حريف" : "Je suis client", ar ? "أطلب وأحجز" : "Je commande et je réserve"],
          [true, ar ? "أنا سائق" : "Je suis chauffeur", ar ? "أستقبل الطلبات" : "Je reçois des courses"],
        ].map(([valeur, titre, detail]) => {
          const actif = chauffeur === valeur;
          return (
            <button
              key={String(valeur)}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => setChauffeur(valeur as boolean)}
              className="flex flex-col items-start gap-1 rounded-[16px] border-2 p-3 text-start"
              style={{
                borderColor: actif ? "var(--color-brand)" : "var(--color-outline)",
                background: actif ? "var(--color-brand-tint)" : "var(--color-surface-solid)",
              }}
            >
              <b className="text-[0.875rem]">{titre as string}</b>
              <span className="text-[0.6875rem] text-[var(--color-muted)]">{detail as string}</span>
            </button>
          );
        })}
      </div>

      <form
        className="flex flex-col gap-4"
        action={(fd) => {
          setErreur(null);
          start(async () => {
            const r = await inscriptionTransport({
              prenom: String(fd.get("prenom") ?? ""),
              nom: String(fd.get("nom") ?? ""),
              telephone: String(fd.get("telephone") ?? ""),
              email: String(fd.get("email") ?? ""),
              motDePasse: String(fd.get("mdp") ?? ""),
              chauffeur,
            });
            if (!r) return;
            if (!r.ok) setErreur(r.error);
            else if (r.data?.awaitingEmail) setAttenteCourriel(r.data.email);
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-[6px]">
            <span className={LIBELLE}>{ar ? "الاسم" : "Prénom"}</span>
            <input name="prenom" required autoComplete="given-name" className={CHAMP} />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className={LIBELLE}>{ar ? "اللقب" : "Nom"}</span>
            <input name="nom" autoComplete="family-name" className={CHAMP} />
          </label>
        </div>
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>
            {ar ? "الهاتف" : "Téléphone"}
            {chauffeur ? " *" : ""}
          </span>
          <input name="telephone" type="tel" inputMode="tel" required={chauffeur} autoComplete="tel" placeholder="+216 …" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>{ar ? "البريد الإلكتروني" : "E-mail"}</span>
          <input name="email" type="email" required autoComplete="email" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={LIBELLE}>{ar ? "كلمة السر (8 أحرف على الأقل)" : "Mot de passe (8 caractères minimum)"}</span>
          <input name="mdp" type="password" required minLength={8} autoComplete="new-password" className={CHAMP} />
        </label>
        {erreur && (
          <p role="alert" className="rounded-[12px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.8125rem] font-semibold text-[var(--color-live)]">
            {erreur}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="press min-h-[52px] rounded-[16px] bg-[var(--color-brand-fill)] text-[0.9375rem] font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "…" : chauffeur ? (ar ? "التالي: بطاقة السائق" : "Continuer : ma fiche chauffeur") : ar ? "إنشاء حسابي" : "Créer mon compte"}
        </button>
      </form>
      <Link href="/connexion" className="text-center text-[0.8125rem] font-extrabold text-[var(--color-brand)]">
        {ar ? "لديك حساب؟ سجّل الدخول" : "Déjà un compte ? Se connecter"}
      </Link>
    </div>
  );
}
