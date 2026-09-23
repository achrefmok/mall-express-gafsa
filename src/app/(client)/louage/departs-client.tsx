"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { annoncerDepart, annulerPlace, cloreDepart, reserverPlace } from "@/app/actions/louage";
import { cx, formatPrice } from "@/lib/format";
import { telHref, whatsAppHref } from "@/lib/contact";
import { Button, Card, EmptyState, Tag, fieldClass } from "@/components/ui/primitives";
import type { AppLocale } from "@/types/database";

const CHAMP = fieldClass({ size: "sm", solid: true });
const ETIQ = "text-[0.625rem] text-[var(--color-muted)]";

export interface DepartLouage {
  id: string;
  destination: string;
  departure_point: string | null;
  driver_name: string;
  phone: string;
  departs_at: string;
  price_per_seat: number | null;
  note: string | null;
  seats_total: number;
  seats_left: number;
  mine: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** L'heure seule : la date est portée par le groupe (« Aujourd'hui », « Demain »). */
const heure = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Aujourd'hui, demain, ou la date.
 *
 * « 24/09 » demande de vérifier quel jour on est. « Aujourd'hui » ne demande
 * rien — et c'est la seule question qu'on se pose devant un départ de louage.
 */
function jourDit(iso: string): string {
  const d = new Date(iso);
  const jour = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const aujourdhui = new Date();
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()).getTime();

  if (jour === base) return "Aujourd'hui";
  if (jour === base + 86_400_000) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Dans une heure : le départ par défaut du formulaire du chauffeur. */
function dansUneHeure(): string {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/**
 * Les départs de louage annoncés.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Ce que le voyageur cherche, dans l'ordre
 * ────────────────────────────────────────────────────────────────────────
 *
 * Où ça va, à quelle heure, combien de places restent. Trois renseignements,
 * et la carte les donne dans cet ordre — le nom du chauffeur et son numéro
 * viennent après, parce qu'on les lit une fois la place choisie.
 *
 * Les départs sont groupés par jour plutôt que datés un par un : sur une liste
 * de quinze, « Aujourd'hui 14:30 » se lit d'un coup d'œil là où « 24/09 14:30 »
 * demande de vérifier quel jour on est.
 *
 * Les places restantes sont calculées en base, pas ici : deux voyageurs qui
 * réservent en même temps doivent voir le même chiffre, et c'est le verrou de
 * `louage_reserver` qui l'assure — pas cet écran.
 */
export function DepartsLouage({
  departs,
  connecte,
  defauts,
  locale,
}: {
  departs: DepartLouage[];
  connecte: boolean;
  defauts: { nom: string; phone: string };
  locale: AppLocale;
}) {
  const [formulaire, setFormulaire] = useState(false);

  /* Groupés par jour, dans l'ordre où ils partent. */
  const parJour = departs.reduce<Record<string, DepartLouage[]>>((acc, d) => {
    const cle = jourDit(d.departs_at);
    (acc[cle] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">Départs annoncés</p>
        {connecte && (
          <button
            type="button"
            onClick={() => setFormulaire((v) => !v)}
            className="text-[0.6875rem] font-bold text-[var(--color-brand)]"
          >
            {formulaire ? "Fermer" : "+ Je pars, j'annonce"}
          </button>
        )}
      </div>

      {formulaire && <FormulaireDepart defauts={defauts} onFini={() => setFormulaire(false)} />}

      {departs.length === 0 ? (
        <EmptyState
          title="Aucun départ annoncé"
          body="Les chauffeurs annoncent ici leur destination, l'heure et les places restantes."
        />
      ) : (
        Object.entries(parJour).map(([jour, liste]) => (
          <section key={jour} className="flex flex-col gap-2">
            <p className="text-[0.65625rem] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              {jour}
            </p>
            {liste.map((d) => (
              <CarteDepart key={d.id} depart={d} connecte={connecte} defauts={defauts} locale={locale} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function CarteDepart({
  depart: d,
  connecte,
  defauts,
  locale,
}: {
  depart: DepartLouage;
  connecte: boolean;
  defauts: { nom: string; phone: string };
  locale: AppLocale;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [places, setPlaces] = useState("1");
  const [nom, setNom] = useState(defauts.nom);
  const [tel, setTel] = useState(defauts.phone);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complet = d.seats_left <= 0;
  const appel = telHref(d.phone);
  const wa = whatsAppHref(d.phone, `Bonjour, une place pour ${d.destination} ?`);

  function reserver() {
    setErreur(null);
    startTransition(async () => {
      const r = await reserverPlace({
        departureId: d.id,
        seats: Number(places) || 1,
        fullName: nom,
        phone: tel,
      });

      if (r.ok) {
        setOuvert(false);
        setMessage(`Place réservée. Appelez ${d.driver_name} au ${d.phone} pour confirmer.`);
        router.refresh();
      } else setErreur(r.error);
    });
  }

  function clore(statut: "parti" | "annule") {
    startTransition(async () => {
      const r = await cloreDepart(d.id, statut);
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-[10px] p-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          dir="ltr"
          className="flex h-[46px] w-[52px] flex-none flex-col items-center justify-center rounded-[14px] bg-[var(--color-brand-tint)] text-[0.8125rem] font-extrabold text-[var(--color-brand)] tabular-nums"
        >
          {heure(d.departs_at)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-bold text-[var(--color-ink)]">
            {d.destination}
          </p>
          {d.departure_point && (
            <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
              Départ : {d.departure_point}
            </p>
          )}
          <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
            {d.driver_name}
            {d.price_per_seat != null ? ` · ${formatPrice(d.price_per_seat, locale)} la place` : ""}
          </p>
        </div>

        {/*
          Les places restantes, en couleur d'alerte quand il n'en reste qu'une.

          C'est le chiffre qui décide d'appeler maintenant plutôt que tout à
          l'heure — il mérite de se voir avant le reste de la carte.
        */}
        <Tag tone={complet ? "tinted" : d.seats_left === 1 ? "live" : "tinted"}>
          {complet ? "Complet" : `${d.seats_left} place${d.seats_left > 1 ? "s" : ""}`}
        </Tag>
      </div>

      {d.note && (
        <p className="text-[0.625rem] leading-[1.5] text-[var(--color-muted)]">{d.note}</p>
      )}

      {message && (
        <p className="rounded-[10px] bg-[rgba(31,122,61,0.1)] px-[10px] py-[6px] text-[0.625rem] text-[#0f7a3d]">
          {message}
        </p>
      )}
      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      {ouvert ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_72px] gap-2">
            <label className="flex flex-col gap-1">
              <span className={ETIQ}>Votre nom</span>
              <input value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} className={CHAMP} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={ETIQ}>Places</span>
              <input
                value={places}
                onChange={(e) => setPlaces(e.target.value.replace(/\D/g, "").slice(0, 1))}
                inputMode="numeric"
                dir="ltr"
                className={CHAMP}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className={ETIQ}>Téléphone</span>
            <input
              value={tel}
              onChange={(e) => setTel(e.target.value.slice(0, 20))}
              inputMode="tel"
              dir="ltr"
              placeholder="20 000 000"
              className={CHAMP}
            />
          </label>

          <div className="flex gap-2">
            <Button size="sm" onClick={reserver} disabled={pending} className="flex-1">
              {pending ? "…" : "Réserver"}
            </Button>
            <Button size="sm" onClick={() => setOuvert(false)} disabled={pending}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {d.mine ? (
            <>
              <Button size="sm" onClick={() => clore("parti")} disabled={pending}>
                C&apos;est parti
              </Button>
              <Button size="sm" onClick={() => clore("annule")} disabled={pending}>
                Annuler le départ
              </Button>
            </>
          ) : (
            connecte &&
            !complet && (
              <Button size="sm" onClick={() => setOuvert(true)}>
                Réserver une place
              </Button>
            )
          )}

          {appel && (
            <a
              href={appel}
              dir="ltr"
              className="rounded-full border border-[var(--color-outline)] px-3 py-[7px] text-[0.65625rem] font-bold text-[var(--color-ink)]"
            >
              ☎ {d.phone}
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#e6f4ea] px-3 py-[7px] text-[0.65625rem] font-bold text-[#0f7a3d]"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Annoncer son départ.
 *
 * Six champs, dont deux préremplis par le compte. Un chauffeur annonce depuis
 * la station, debout, souvent d'une main : chaque champ de plus est un départ
 * qui ne sera pas annoncé.
 */
function FormulaireDepart({
  defauts,
  onFini,
}: {
  defauts: { nom: string; phone: string };
  onFini: () => void;
}) {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [point, setPoint] = useState("");
  const [nom, setNom] = useState(defauts.nom);
  const [tel, setTel] = useState(defauts.phone);
  const [places, setPlaces] = useState("8");
  const [quand, setQuand] = useState(dansUneHeure);
  const [prix, setPrix] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await annoncerDepart({
        destination,
        departurePoint: point,
        driverName: nom,
        phone: tel,
        seatsTotal: Number(places) || 8,
        departsAt: new Date(quand).toISOString(),
        pricePerSeat: prix.trim() ? Number(prix.replace(",", ".")) : null,
      });

      if (r.ok) {
        onFini();
        router.refresh();
      } else setErreur(r.error);
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-2 border-dashed p-3">
      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Destination</span>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value.slice(0, 60))}
          placeholder="Tunis, Sfax, Tozeur…"
          className={CHAMP}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Point de départ (facultatif)</span>
        <input
          value={point}
          onChange={(e) => setPoint(e.target.value.slice(0, 60))}
          placeholder="Station de Gafsa"
          className={CHAMP}
        />
      </label>

      <div className="grid grid-cols-[1fr_78px] gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Départ vers</span>
          <input
            type="datetime-local"
            value={quand}
            onChange={(e) => setQuand(e.target.value)}
            dir="ltr"
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Places</span>
          <input
            value={places}
            onChange={(e) => setPlaces(e.target.value.replace(/\D/g, "").slice(0, 1))}
            inputMode="numeric"
            dir="ltr"
            className={CHAMP}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Votre nom</span>
          <input value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQ}>Téléphone</span>
          <input
            value={tel}
            onChange={(e) => setTel(e.target.value.slice(0, 20))}
            inputMode="tel"
            dir="ltr"
            className={CHAMP}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={ETIQ}>Prix par place (facultatif)</span>
        <input
          value={prix}
          onChange={(e) => setPrix(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 7))}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          className={cx(CHAMP, "w-28")}
        />
      </label>

      {erreur && <p className="text-[0.625rem] text-[var(--color-live)]">{erreur}</p>}

      <Button size="sm" block onClick={envoyer} disabled={pending || !destination.trim()}>
        {pending ? "…" : "Annoncer le départ"}
      </Button>
    </Card>
  );
}

/** Les places que le voyageur a réservées, pour qu'il puisse s'en défaire. */
export function MesPlaces({
  places,
  locale,
}: {
  places: Array<{
    id: string;
    seats: number;
    depart: { destination: string; departs_at: string; driver_name: string; phone: string } | null;
  }>;
  locale: AppLocale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (places.length === 0) return null;
  void locale;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.8125rem] font-bold text-[var(--color-ink)]">Mes places</p>

      {places.map((p) => (
        <Card key={p.id} className="flex flex-none items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
              {p.depart?.destination ?? "Départ retiré"}
            </p>
            <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
              {p.depart ? `${jourDit(p.depart.departs_at)} ${heure(p.depart.departs_at)} · ` : ""}
              {p.seats} place{p.seats > 1 ? "s" : ""}
              {p.depart ? ` · ${p.depart.driver_name}` : ""}
            </p>
          </div>

          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await annulerPlace(p.id);
                if (r.ok) router.refresh();
              })
            }
          >
            Annuler
          </Button>
        </Card>
      ))}
    </div>
  );
}
