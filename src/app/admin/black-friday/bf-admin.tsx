"use client";

import { useState, useTransition } from "react";
import { basculerCampagne, creerCampagne, modererOffre } from "@/app/actions/black-friday";
import { formatPrice } from "@/lib/format";
import { pourcentageReduction, type PhaseCampagne } from "@/lib/black-friday";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";

export interface CampagneAdmin {
  id: string;
  fridayDate: string;
  debut: string;
  fin: string;
  active: boolean;
  phase: PhaseCampagne;
}

export interface OffreAdmin {
  id: string;
  prixBf: number;
  prixNormal: number;
  active: boolean;
  moderee: boolean;
  note: string | null;
  partages: number;
  vues: number;
  produit: string;
  image: string | null;
  boutique: string;
  boutiqueId: string;
}

const PHASES: Record<PhaseCampagne, "phaseScheduled" | "phaseRunning" | "phaseEnded" | null> = {
  aucune: null,
  avant: "phaseScheduled",
  actif: "phaseRunning",
  termine: "phaseEnded",
};

/**
 * Programmer, suspendre, modérer, et lire le bilan.
 *
 * La modération ne supprime pas : elle retire l'offre du public et laisse
 * au commerçant une note qui dit pourquoi. Supprimer aurait effacé la trace
 * — et le commerçant, ne comprenant pas, aurait recréé la même offre.
 */
export function AdminBlackFriday({
  campagnes,
  offres,
  campagneCible,
  vendrediPropose,
}: {
  campagnes: CampagneAdmin[];
  offres: OffreAdmin[];
  campagneCible: string | null;
  vendrediPropose: string;
}) {
  const { t, locale } = useI18n();
  const [date, setDate] = useState(vendrediPropose);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cible = campagnes.find((c) => c.id === campagneCible) ?? null;

  const boutiques = new Set(offres.map((o) => o.boutiqueId)).size;
  const enLigne = offres.filter((o) => o.active && !o.moderee).length;
  const actives = cible?.phase === "actif" ? enLigne : 0;
  const terminees = cible?.phase === "termine" ? offres.length : 0;

  const plusVues = [...offres].sort((a, b) => b.vues - a.vues).slice(0, 5);
  const plusPartagees = [...offres].filter((o) => o.partages > 0).sort((a, b) => b.partages - a.partages).slice(0, 5);

  function agir(action: () => Promise<{ ok: boolean; error?: string }>) {
    setErreur(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setErreur(r.error ?? t.bfAdmin.failed);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {erreur && (
        <p role="alert" className="rounded-[12px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.8125rem] text-[var(--color-live)]">
          {erreur}
        </p>
      )}

      {/* ─── Programmer ─────────────────────────────────────────────── */}
      <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
        <h2 className="mb-1 text-[0.9375rem] font-bold text-[var(--color-ink)]">{t.bfAdmin.schedule}</h2>
        <p className="mb-3 text-[0.75rem] text-[var(--color-muted)]">
          {t.bfAdmin.scheduleHint}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 text-[0.8125rem] text-[var(--color-ink)]"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => agir(() => creerCampagne(date))}
            className="min-h-11 rounded-[12px] bg-[var(--color-brand-fill)] px-4 text-[0.8125rem] font-bold text-white disabled:opacity-50"
          >
            {t.bfAdmin.scheduleButton}
          </button>
        </div>
      </section>

      {/* ─── Campagnes ──────────────────────────────────────────────── */}
      {campagnes.length > 0 && (
        <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
          <h2 className="mb-3 text-[0.9375rem] font-bold text-[var(--color-ink)]">{t.bfAdmin.campaigns}</h2>
          <ul className="flex flex-col gap-2">
            {campagnes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[var(--color-field)] px-3 py-2">
                <span className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">
                  {format(t.bfAdmin.friday, { date: c.fridayDate })}
                  <span className="ms-2 text-[0.6875rem] font-normal text-[var(--color-muted)]">
                    {PHASES[c.phase] ? t.bfAdmin[PHASES[c.phase]!] : "—"}
                    {!c.active && t.bfAdmin.disabledSuffix}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => agir(() => basculerCampagne(c.id, !c.active))}
                  className={`min-h-9 rounded-full px-3 text-[0.6875rem] font-bold disabled:opacity-50 ${
                    c.active ? "bg-[var(--color-live-tint)] text-[var(--color-live)]" : "bg-[#dcefe5] text-[#1c6244]"
                  }`}
                >
                  {c.active ? t.bfAdmin.disable : t.bfAdmin.enable}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Bilan ──────────────────────────────────────────────────── */}
      {cible && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Chiffre valeur={boutiques} libelle={t.bfAdmin.shops} />
          <Chiffre valeur={offres.length} libelle={t.bfAdmin.products} />
          <Chiffre valeur={actives} libelle={t.bfAdmin.activeOffers} />
          <Chiffre valeur={terminees} libelle={t.bfAdmin.endedOffers} />
        </section>
      )}

      {(plusVues.length > 0 || plusPartagees.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          <Classement titre={t.bfAdmin.mostViewed} lignes={plusVues.map((o) => ({ id: o.id, nom: o.produit, boutique: o.boutique, valeur: format(t.bfAdmin.views, { n: o.vues }) }))} />
          <Classement
            titre={t.bfAdmin.mostShared}
            lignes={plusPartagees.map((o) => ({ id: o.id, nom: o.produit, boutique: o.boutique, valeur: format(t.bfAdmin.sharesCount, { n: o.partages }) }))}
            vide={t.bfAdmin.noShares}
          />
        </section>
      )}

      {/* ─── Offres et modération ───────────────────────────────────── */}
      {offres.length > 0 && (
        <section className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
          <h2 className="mb-3 text-[0.9375rem] font-bold text-[var(--color-ink)]">{t.bfAdmin.offers}</h2>
          <ul className="flex flex-col gap-2">
            {offres.map((o) => {
              const r = pourcentageReduction(o.prixNormal, o.prixBf);
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[var(--color-field)] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-semibold text-[var(--color-ink)]">{o.produit}</p>
                    <p className="text-[0.6875rem] text-[var(--color-muted)]">
                      {o.boutique} · {formatPrice(o.prixNormal, locale)} <span aria-hidden>{locale === "ar" ? "←" : "→"}</span> <strong>{formatPrice(o.prixBf, locale)}</strong>
                      {r !== null && <span dir="ltr"> (−{r}%)</span>}
                      {!o.active && t.bfAdmin.notEnabledSuffix}
                      {o.moderee && t.bfAdmin.removedSuffix}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (o.moderee) {
                        agir(() => modererOffre(o.id, false));
                        return;
                      }
                      const note = window.prompt(t.bfAdmin.reasonPrompt, "");
                      if (note === null) return;
                      agir(() => modererOffre(o.id, true, note));
                    }}
                    className="min-h-9 rounded-full bg-[var(--color-surface-solid)] px-3 text-[0.6875rem] font-bold text-[var(--color-ink)] disabled:opacity-50"
                  >
                    {o.moderee ? t.bfAdmin.restore : t.bfAdmin.remove}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="flex flex-col gap-[2px] rounded-[16px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-3">
      <span className="text-[1.375rem] font-extrabold tabular-nums text-[var(--color-ink)]">{valeur}</span>
      <span className="text-[0.6875rem] font-semibold text-[var(--color-muted)]">{libelle}</span>
    </div>
  );
}

function Classement({
  titre,
  lignes,
  vide,
}: {
  titre: string;
  lignes: Array<{ id: string; nom: string; boutique: string; valeur: string }>;
  vide?: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-4">
      <h3 className="mb-2 text-[0.8125rem] font-bold text-[var(--color-ink)]">{titre}</h3>
      {lignes.length === 0 ? (
        <p className="text-[0.75rem] text-[var(--color-muted)]">{vide ?? "—"}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {lignes.map((l, i) => (
            <li key={l.id} className="flex items-baseline gap-2 text-[0.75rem]">
              <span className="w-4 flex-none tabular-nums text-[var(--color-faint)]">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--color-ink)]">
                {l.nom} <span className="text-[var(--color-muted)]">· {l.boutique}</span>
              </span>
              <span className="flex-none font-semibold tabular-nums text-[var(--color-ink)]">{l.valeur}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
