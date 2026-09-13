"use client";

import Link from "next/link";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { creerDemandeMatching, annulerDemandeDiffusee } from "@/app/actions/taxi-matching";
import {
  adresserDemandeA,
  annulerCourseAcceptee,
  maCourseEnCours,
  repondreProposition,
  type CourseEnCours,
} from "@/app/actions/taxi-propositions";
import { createClient } from "@/lib/supabase/client";
import { chercherLieux, lieuExact, suggestionsInitiales, type Lieu } from "@/lib/taxi-lieux";
import { zoneLaPlusProche } from "@/lib/taxi-zones";
import { usePoll } from "@/lib/use-poll";
import { numeroAppelable } from "@/lib/phone";
import { whatsAppHref } from "@/lib/contact";
import { monogram } from "@/lib/format";
import type { Point } from "@/lib/taxi-match";
import { BottomSheet, type HauteurSheet } from "./bottom-sheet";
import { CarteNotation } from "./rating-card";
import { useEstBureau } from "@/lib/use-media";

/* ═══════════════════════════════════════════════════════════════════════
   Le parcours du client, d'un bout à l'autre.

   Il tenait auparavant dans trois panneaux superposés à l'écran taxi, et il
   s'arrêtait à la liste : choisir un chauffeur ouvrait une discussion, sans
   qu'aucune course n'existe jamais en base. Le chemin « diffusion » — le
   client annonce où il va, plusieurs chauffeurs voient passer la demande —
   était écrit côté serveur et côté chauffeur, mais **aucun écran client ne le
   déclenchait**.

   C'est ce que ce composant fait. Quatre moments, un seul panneau :

     saisie    → d'où, vers où, combien de personnes, quel budget
     recherche → la demande part, les chauffeurs compatibles sont prévenus
     resultats → qui est autour, et à qui pousser la demande
     course    → un chauffeur a accepté ; on suit, on discute, on peut renoncer

   Rien ne remplace brutalement rien : le panneau garde sa place et son fond,
   seul son contenu se recompose. C'est la différence entre un écran qui se
   transforme et une page qui se recharge.
   ═══════════════════════════════════════════════════════════════════════ */

type Etape = "saisie" | "recherche" | "resultats" | "course";

const RESSORT = { type: "spring" as const, stiffness: 320, damping: 32 };

/** Le premier message, pré-rempli : le chauffeur sait d où vient le contact. */
const MESSAGE_WHATSAPP = "Bonjour, je cherche un taxi via Mall Express Gafsa.";

/** Le rendu des états de course, dans l'ordre du parcours. */
const ETATS_COURSE: Record<string, { titre: string; corps: string; teinte: string }> = {
  acceptee: { titre: "Course confirmée", corps: "Le chauffeur a accepté votre course.", teinte: "var(--color-brand)" },
  driver_arriving: { titre: "Le chauffeur arrive", corps: "Il se dirige vers votre point de départ.", teinte: "var(--color-brand)" },
  picked_up: { titre: "Vous êtes à bord", corps: "Bonne route.", teinte: "var(--color-success)" },
  in_progress: { titre: "En route", corps: "Vous êtes en chemin vers votre destination.", teinte: "var(--color-success)" },
  completed: { titre: "Course terminée", corps: "Merci d'avoir voyagé avec nous.", teinte: "var(--color-success)" },
};

export interface ChauffeurProche {
  id: string;
  nom: string;
  telephone: string;
  vehicule: string | null;
  distance: number | null;
  placesLibres: number | null;
  libre: boolean;
}

export function CourseSheet({
  ouvert,
  onFermer,
  depart,
  departNom,
  onDepartNom,
  onRelocaliser,
  etatPosition,
  chauffeursProches,
  chauffeursTous,
  clientId,
  onDestination,
  onDiscuter,
  extra,
}: {
  ouvert: boolean;
  onFermer: () => void;
  depart: Point | null;
  departNom: string | null;
  onDepartNom: (nom: string | null, point: Point | null) => void;
  onRelocaliser: () => void;
  etatPosition: "attente" | "trouvee" | "refusee";
  chauffeursProches: ChauffeurProche[];
  /** Tous les taxis joignables, quelle que soit la distance. Repli quand la
      recherche de proximité ne rend rien : un numéro vaut mieux qu un vide. */
  chauffeursTous: ChauffeurProche[];
  clientId: string | null;
  onDestination: (point: Point | null, nom: string | null) => void;
  onDiscuter: (driverId: string) => void;
  /** La liste complète, montrée tout en bas quand le panneau est déployé. */
  extra?: React.ReactNode;
}) {
  const reduit = useReducedMotion();
  const estBureau = useEstBureau();

  const [etape, setEtape] = useState<Etape>("saisie");
  const [hauteur, setHauteur] = useState<HauteurSheet>("moitie");

  const [saisieDest, setSaisieDest] = useState("");
  const [destination, setDestination] = useState<Lieu | null>(null);
  const [destinationLibre, setDestinationLibre] = useState<string | null>(null);
  const [passagers, setPassagers] = useState(1);
  const [budget, setBudget] = useState("");

  const [demandeId, setDemandeId] = useState<string | null>(null);
  const [nbTrouves, setNbTrouves] = useState(0);
  const [course, setCourse] = useState<CourseEnCours | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canal = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  /* ─── Reprendre une course déjà en cours ────────────────────────────────
     Quelqu'un qui ferme l'onglet pendant sa course doit la retrouver en
     rouvrant, pas repartir d'un formulaire vide. */
  useEffect(() => {
    if (!ouvert || !clientId) return;
    let annule = false;

    void maCourseEnCours().then((r) => {
      if (annule || !r.ok || !r.data) return;
      setCourse(r.data);
      setDemandeId(r.data.id);
      setEtape(r.data.status === "en_attente" ? "resultats" : "course");
      setHauteur("moitie");
    });

    return () => { annule = true; };
  }, [ouvert, clientId]);

  /* ─── Suivre sa course ──────────────────────────────────────────────────
     Le temps réel d'abord, le sondage en filet : un canal peut se rompre sans
     rien dire, et rester bloqué sur « recherche » pendant que le chauffeur
     attend en bas de chez soi est le pire des défauts possibles ici. */
  const relire = useCallback(async () => {
    if (!demandeId) return;
    const r = await maCourseEnCours();
    if (!r.ok) return false;

    if (!r.data) {
      // Expirée ou annulée ailleurs : on revient au formulaire plutôt que de
      // laisser un écran qui n'attend plus rien.
      setCourse(null);
      setDemandeId(null);
      setEtape("saisie");
      return;
    }

    setCourse(r.data);
    setEtape(r.data.status === "en_attente" ? "resultats" : "course");
  }, [demandeId]);

  usePoll(relire, 12_000);

  useEffect(() => {
    if (!demandeId) return;

    const supabase = createClient();
    const c = supabase
      .channel(`course-${demandeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "taxi_requests", filter: `id=eq.${demandeId}` },
        () => void relire(),
      )
      .subscribe();

    canal.current = c;

    /*
      `removeChannel`, et pas `unsubscribe`.

      Le client Supabase est mémoïsé pour toute l'application : un canal
      seulement désabonné reste dans sa liste, et rouvrir le panneau en empile
      un second sous le même nom. Le retirer vraiment est la seule façon de ne
      pas accumuler.
    */
    return () => {
      void supabase.removeChannel(c);
      canal.current = null;
    };
  }, [demandeId, relire]);

  /* ─── La destination ────────────────────────────────────────────────── */

  const suggestions = saisieDest.trim().length >= 1
    ? chercherLieux(saisieDest)
    : suggestionsInitiales();

  function choisirLieu(lieu: Lieu) {
    setDestination(lieu);
    setDestinationLibre(null);
    setSaisieDest(lieu.nom);
    onDestination({ lat: lieu.lat, lng: lieu.lng }, lieu.nom);
  }

  function libreCommeDestination() {
    const nom = saisieDest.trim();
    if (nom.length < 2) return;

    const exact = lieuExact(nom);
    if (exact) { choisirLieu(exact); return; }

    setDestination(null);
    setDestinationLibre(nom);
    // Sans coordonnées : la destination libre est un nom, pas un point. La
    // carte ne trace donc pas d'itinéraire, et c'est honnête — on ne sait pas
    // où c'est.
    onDestination(null, nom);
  }

  /* Le troisième cran, ou un grand écran : dans les deux cas, tout est visible. */
  const avance = estBureau || hauteur === "plein";

  const destinationPrete = destination !== null || destinationLibre !== null;
  const peutChercher = depart !== null && destinationPrete && !pending;

  /* ─── Lancer la recherche ───────────────────────────────────────────── */

  function chercher() {
    if (!depart || !destinationPrete) return;

    setErreur(null);
    setEtape("recherche");
    setHauteur("moitie");

    const zoneDepart = zoneLaPlusProche(depart);
    const prix = budget.trim() === "" ? null : Number.parseInt(budget.trim(), 10);

    startTransition(async () => {
      const r = await creerDemandeMatching({
        pickupLat: depart.lat,
        pickupLng: depart.lng,
        pickupLabel: departNom,
        destinationType: destination?.zone ? "zone" : "autre",
        originZone: zoneDepart,
        destinationZone: destination?.zone ?? null,
        destinationName: destination?.zone ? null : (destinationLibre ?? destination?.nom ?? null),
        proposedPrice: Number.isFinite(prix as number) ? prix : null,
        seats: passagers,
      });

      if (!r.ok) {
        setErreur(r.error);
        setEtape("saisie");
        return;
      }

      setDemandeId(r.data.id);
      setNbTrouves(r.data.matched);

      /*
        On laisse l'animation vivre.

        La demande part en quelques centaines de millisecondes ; basculer aussi
        vite donne l'impression que rien n'a été cherché. Une seconde et demie
        est le temps qu'il faut pour lire « X chauffeurs trouvés » — et c'est
        une information, pas un remplissage.
      */
      window.setTimeout(() => setEtape("resultats"), reduit ? 0 : 1600);
    });
  }

  function annuler() {
    const id = demandeId;
    if (!id) { setEtape("saisie"); return; }

    startTransition(async () => {
      // Deux portes, selon l'avancement : la demande en recherche s'annule
      // seule, la course acceptée demande la fonction qui rend les places.
      const r = course && course.status !== "en_attente"
        ? await annulerCourseAcceptee(id)
        : await annulerDemandeDiffusee(id);

      if (!r.ok) { setErreur(r.error); return; }

      setDemandeId(null);
      setCourse(null);
      setEtape("saisie");
    });
  }

  function repondreProp(accepte: boolean) {
    if (!demandeId) return;
    startTransition(async () => {
      const r = await repondreProposition(demandeId, accepte);
      if (!r.ok) { setErreur(r.error); return; }
      await relire();
    });
  }

  function pousserVers(driverId: string) {
    if (!demandeId) return;
    startTransition(async () => {
      const r = await adresserDemandeA(demandeId, driverId);
      if (!r.ok) setErreur(r.error);
    });
  }

  /* ─── Rendu ─────────────────────────────────────────────────────────── */

  const entete = (
    <EnteteEtape
      etape={etape}
      course={course}
      nbTrouves={nbTrouves}
      compact={!estBureau && hauteur === "pied"}
      onDeplier={() => setHauteur("moitie")}
      onRetour={etape === "resultats" || etape === "course" ? annuler : undefined}
    />
  );

  const contenu = (
    <>
      {erreur && (
        <p
          role="alert"
          className="mb-3 rounded-[12px] bg-[var(--color-live-tint)] px-3 py-2 text-[0.8125rem] font-medium text-[var(--color-live)]"
        >
          {erreur}
        </p>
      )}

      {/*
        `mode="popLayout"` plutôt que `wait` : le contenu sortant quitte le flux
        immédiatement, donc l'entrant ne descend pas de trente pixels avant de
        remonter. C'est cette secousse qui fait « page rechargée ».
      */}
      <AnimatePresence mode="popLayout" initial={false}>
        {etape === "saisie" && (
          <m.div
            key="saisie"
            initial={reduit ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduit ? undefined : { opacity: 0, y: -8 }}
            transition={RESSORT}
            className="flex flex-col gap-4"
          >
            {/*
              La course précédente, si elle attend sa note. Le composant se
              monte à chaque retour au formulaire — donc juste après une
              course terminée — et ne rend rien s'il n'y a rien à noter.
            */}
            {clientId && <CarteNotation />}

            <ChampDepart
              depart={depart}
              departNom={departNom}
              etat={etatPosition}
              onRelocaliser={onRelocaliser}
              onNom={onDepartNom}
            />

            <ChampDestination
              saisie={saisieDest}
              onSaisie={(v) => { setSaisieDest(v); setDestination(null); setDestinationLibre(null); }}
              suggestions={suggestions}
              choisie={destination?.nom ?? destinationLibre}
              onChoisir={choisirLieu}
              onLibre={libreCommeDestination}
            />

            {/*
              Passagers et budget ne s'affichent qu'au troisième cran.

              Ce sont des réglages, pas des questions : on part à un, sans
              budget annoncé, et c'est le cas de la grande majorité des
              courses. Les poser au même niveau que « où allez-vous ? » ferait
              quatre champs à remplir pour un geste qui n'en demande qu'un —
              et pousserait le bouton hors de l'écran à mi-hauteur.

              Sur grand écran la place ne manque pas : tout est visible d'un
              coup, et le repli n'aurait aucune raison d'être.
            */}
            {avance ? (
              <m.div
                initial={reduit ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3">
                  <Passagers valeur={passagers} onChange={setPassagers} />
                  <Budget valeur={budget} onChange={setBudget} />
                </div>
              </m.div>
            ) : (
              <button
                type="button"
                onClick={() => setHauteur("plein")}
                className="flex min-h-[44px] w-full items-center justify-between rounded-[14px] border border-dashed border-[var(--color-outline)] px-4 text-[0.8125rem] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
              >
                <span>
                  {passagers > 1 || budget.trim() !== ""
                    ? `${passagers} passager${passagers > 1 ? "s" : ""}${budget.trim() ? ` · ${budget.trim()} DT` : ""}`
                    : "Passagers et budget"}
                </span>
                <span aria-hidden>↑</span>
              </button>
            )}

            {/*
              Le bouton reste au bas du panneau, quoi qu'il arrive au-dessus.

              Il passait sous la ligne de flottaison dès que la liste de
              suggestions s'ouvrait : quatre champs, dix propositions, et le
              seul geste qui compte se retrouvait à faire défiler pour être
              atteint — sur l'écran d'une application qu'on ouvre en marchant.

              `sticky` plutôt que `fixed` : il reste dans le flux, donc il ne
              recouvre jamais le dernier champ, et il s'arrête naturellement
              quand le panneau est replié. Le dégradé au-dessus évite que le
              contenu qui défile ne semble sortir de nulle part.
            */}
            <div className="sticky bottom-0 -mx-5 mt-1 bg-[var(--color-surface-solid)] px-5 pt-3 pb-1 before:pointer-events-none before:absolute before:inset-x-0 before:-top-5 before:h-5 before:bg-[linear-gradient(to_bottom,transparent,var(--color-surface-solid))] before:content-['']">
              <BoutonRecherche
                actif={peutChercher}
                envoi={pending}
                reduit={Boolean(reduit)}
                onClick={chercher}
              />
            </div>

            {!depart && etatPosition !== "attente" && (
              <p className="text-center text-[0.75rem] text-[var(--color-muted)]">
                Autorisez la localisation ou saisissez votre point de départ.
              </p>
            )}
          </m.div>
        )}

        {etape === "recherche" && (
          <m.div
            key="recherche"
            initial={reduit ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduit ? undefined : { opacity: 0, scale: 0.98 }}
            transition={RESSORT}
          >
            <AnimationRecherche nbTrouves={nbTrouves} reduit={Boolean(reduit)} />
          </m.div>
        )}

        {etape === "resultats" && (
          <m.div
            key="resultats"
            initial={reduit ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduit ? undefined : { opacity: 0, y: -8 }}
            transition={RESSORT}
            className="flex flex-col gap-3"
          >
            {chauffeursProches.length === 0 ? (
              <>
                <VideResultats aDautres={chauffeursTous.length > 0} />

                {/*
                  Personne tout près ne veut pas dire personne.

                  L'écran s'arrêtait à « aucun chauffeur libre autour de vous »,
                  ce qui est vrai du rayon de cinq kilomètres et faux de la
                  ville : un taxi à sept kilomètres, ou un taxi dont on ignore
                  la position, reste joignable — et c'est son numéro que le
                  client venait chercher.

                  Sa demande continue de vivre en parallèle. Ces cartes ne la
                  remplacent pas : elles donnent de quoi appeler tout de suite
                  plutôt que d'attendre en regardant un écran vide.
                */}
                {chauffeursTous.map((c, i) => (
                  <CarteChauffeur
                    key={c.id}
                    chauffeur={c}
                    index={i}
                    reduit={Boolean(reduit)}
                    onDiscuter={() => onDiscuter(c.id)}
                    onDemander={() => pousserVers(c.id)}
                    occupe={pending}
                  />
                ))}
              </>
            ) : (
              chauffeursProches.map((c, i) => (
                <CarteChauffeur
                  key={c.id}
                  chauffeur={c}
                  index={i}
                  reduit={Boolean(reduit)}
                  onDiscuter={() => onDiscuter(c.id)}
                  onDemander={() => pousserVers(c.id)}
                  occupe={pending}
                />
              ))
            )}
          </m.div>
        )}

        {etape === "course" && course && (
          <m.div
            key="course"
            initial={reduit ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduit ? undefined : { opacity: 0, y: -8 }}
            transition={RESSORT}
            className="flex flex-col gap-4"
          >
            {course.proposition?.statut === "pending" && (
              <CarteProposition
                label={course.proposition.label}
                occupe={pending}
                onAccepter={() => repondreProp(true)}
                onRefuser={() => repondreProp(false)}
              />
            )}

            <SuiviCourse
              course={course}
              onDiscuter={() => course.chauffeur && onDiscuter(course.chauffeur.id)}
              onAnnuler={annuler}
              occupe={pending}
            />
          </m.div>
        )}
      </AnimatePresence>

      {/*
        La liste complète, en dernier.

        Elle porte les filtres et l'accès à l'espace chauffeur — des choses
        utiles qu'on ne consulte pas à chaque course. Sur téléphone elle ne se
        découvre qu'en tirant le panneau à fond, ce qui est le bon ordre : la
        carte d'abord, le formulaire ensuite, l'annuaire en dernier.
      */}
      {extra && <div className="mt-4">{extra}</div>}
    </>
  );

  /*
    Deux formes, une seule instance.

    Sur téléphone, un tiroir qu'on tire du bas par-dessus la carte. Sur grand
    écran, une colonne dans le flux, à côté d'elle — un tiroir y serait absurde,
    la place ne manque pas.

    Le composant est monté **une seule fois** et choisit sa forme : rendre les
    deux et en masquer une par CSS donnerait deux états de formulaire, deux
    abonnements sur la même course, et une saisie qui disparaît au
    redimensionnement.
  */
  if (estBureau) {
    return (
      <aside
        aria-label="Commander un taxi"
        className="flex w-[380px] flex-none flex-col overflow-hidden rounded-[20px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] shadow-[0_6px_20px_rgba(60,40,90,0.06)]"
      >
        <div className="flex-none border-b border-[var(--color-hairline)] px-5 py-4">{entete}</div>
        <div className="no-sb min-h-0 flex-1 overflow-y-auto px-5 py-4">{contenu}</div>
      </aside>
    );
  }

  return (
    <BottomSheet
      ouvert={ouvert}
      hauteur={hauteur}
      onHauteur={setHauteur}
      onFermer={etape === "saisie" ? onFermer : undefined}
      entete={entete}
      titre="Commander un taxi"
    >
      {contenu}
    </BottomSheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   L'en-tête, qui dit toujours où on en est
   ═══════════════════════════════════════════════════════════════════════ */

function EnteteEtape({
  etape,
  course,
  nbTrouves,
  compact,
  onDeplier,
  onRetour,
}: {
  etape: Etape;
  course: CourseEnCours | null;
  nbTrouves: number;
  /** Panneau replié : l'en-tête devient le seul point d'entrée. */
  compact?: boolean;
  onDeplier?: () => void;
  onRetour?: () => void;
}) {
  /*
    Replié, l'en-tête n'informe plus : il invite.

    À dix-huit pour cent de hauteur, il ne reste que lui. Un titre y serait du
    texte mort au-dessus d'une carte — alors que c'est la seule bande que le
    pouce atteint sans rien tirer. Elle porte donc l'action, en pleine largeur.
  */
  if (compact && etape === "saisie") {
    return (
      <button
        type="button"
        onClick={onDeplier}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[16px] bg-[var(--color-brand-fill)] px-5 text-white transition-transform active:scale-[0.985]"
      >
        <span className="flex items-center gap-2 text-[0.9375rem] font-bold">
          <span aria-hidden>🚕</span>
          Demander une course
        </span>
        <span aria-hidden className="text-[0.75rem] opacity-80">
          ↑
        </span>
      </button>
    );
  }
  const titres: Record<Etape, string> = {
    saisie: "Où allez-vous ?",
    recherche: "Recherche en cours",
    resultats:
      nbTrouves > 0
        ? `${nbTrouves} chauffeur${nbTrouves > 1 ? "s" : ""} prévenu${nbTrouves > 1 ? "s" : ""}`
        : "Chauffeurs autour de vous",
    course: course ? (ETATS_COURSE[course.status]?.titre ?? "Course en cours") : "Course en cours",
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[1.0625rem] font-bold text-[var(--color-ink)]">{titres[etape]}</h2>
      {onRetour && (
        <button
          type="button"
          onClick={onRetour}
          className="min-h-[36px] rounded-full px-3 text-[0.75rem] font-semibold text-[var(--color-live)] transition-colors hover:bg-[var(--color-live-tint)]"
        >
          Annuler
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Saisie
   ═══════════════════════════════════════════════════════════════════════ */

function ChampDepart({
  depart,
  departNom,
  etat,
  onRelocaliser,
  onNom,
}: {
  depart: Point | null;
  departNom: string | null;
  etat: "attente" | "trouvee" | "refusee";
  onRelocaliser: () => void;
  onNom: (nom: string | null, point: Point | null) => void;
}) {
  const [edite, setEdite] = useState(false);
  const [saisie, setSaisie] = useState(departNom ?? "");

  const libelle =
    departNom ?? (etat === "trouvee" && depart ? "Ma position actuelle" : etat === "attente" ? "Localisation…" : "Position indisponible");

  if (edite) {
    const propositions = chercherLieux(saisie, 5);
    return (
      <div className="flex flex-col gap-2">
        <Etiquette icone="📍" texte="Départ" />
        <input
          autoFocus
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Quartier, rue, point de repère…"
          className="min-h-[48px] w-full rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-field)] px-4 text-[0.875rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]"
        />
        <div className="flex flex-col gap-1">
          {propositions.map((l) => (
            <button
              key={l.nom}
              type="button"
              onClick={() => { onNom(l.nom, { lat: l.lat, lng: l.lng }); setEdite(false); }}
              className="min-h-[44px] rounded-[12px] px-3 text-start text-[0.8125rem] text-[var(--color-ink)] transition-colors hover:bg-[var(--color-field)]"
            >
              {l.nom}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { onNom(null, null); onRelocaliser(); setEdite(false); }}
            className="min-h-[44px] rounded-[12px] px-3 text-start text-[0.8125rem] font-semibold text-[var(--color-brand)]"
          >
            ↻ Utiliser ma position GPS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Etiquette icone="📍" texte="Départ" />
      <button
        type="button"
        onClick={() => { setSaisie(departNom ?? ""); setEdite(true); }}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-field)] px-4 text-start"
      >
        <span className="truncate text-[0.875rem] font-medium text-[var(--color-ink)]">{libelle}</span>
        <span className="flex-none text-[0.6875rem] font-semibold text-[var(--color-brand)]">Modifier</span>
      </button>
    </div>
  );
}

function ChampDestination({
  saisie,
  onSaisie,
  suggestions,
  choisie,
  onChoisir,
  onLibre,
}: {
  saisie: string;
  onSaisie: (v: string) => void;
  suggestions: Lieu[];
  choisie: string | null;
  onChoisir: (l: Lieu) => void;
  onLibre: () => void;
}) {
  const [focus, setFocus] = useState(false);
  const libreDispo = saisie.trim().length >= 2 && !suggestions.some((s) => s.nom === saisie.trim());

  return (
    <div className="flex flex-col gap-2">
      <Etiquette icone="🎯" texte="Destination" />
      <input
        value={saisie}
        onChange={(e) => onSaisie(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => window.setTimeout(() => setFocus(false), 160)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onLibre(); } }}
        placeholder="Où allez-vous ?"
        enterKeyHint="search"
        className="min-h-[48px] w-full rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-field)] px-4 text-[0.875rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]"
      />

      {choisie && !focus && (
        <p className="text-[0.75rem] font-medium text-[var(--color-success)]">✓ {choisie}</p>
      )}

      {focus && (
        <div className="flex flex-col gap-1">
          {suggestions.map((l) => (
            <button
              key={l.nom}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChoisir(l)}
              className="flex min-h-[44px] items-center gap-2 rounded-[12px] px-3 text-start transition-colors hover:bg-[var(--color-field)]"
            >
              <span aria-hidden className="text-[0.875rem]">
                {l.genre === "zone" ? "🏘" : l.genre === "transport" ? "🚉" : l.genre === "sante" ? "🏥" : l.genre === "commerce" ? "🛍" : "🏛"}
              </span>
              <span className="truncate text-[0.8125rem] text-[var(--color-ink)]">{l.nom}</span>
            </button>
          ))}

          {/*
            La destination libre, et pourquoi elle mérite sa ligne.

            Le répertoire ne contiendra jamais toute la ville. Refuser ce qui
            n'y figure pas reviendrait à dire au client que sa destination
            n'existe pas — alors que le chauffeur, lui, la connaît. Elle part
            donc telle qu'écrite, vers les chauffeurs qui ont accepté de
            recevoir les destinations hors répertoire.
          */}
          {libreDispo && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onLibre}
              className="flex min-h-[44px] items-center gap-2 rounded-[12px] px-3 text-start transition-colors hover:bg-[var(--color-field)]"
            >
              <span aria-hidden>✏️</span>
              <span className="truncate text-[0.8125rem] font-semibold text-[var(--color-brand)]">
                Aller à « {saisie.trim()} »
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Passagers({ valeur, onChange }: { valeur: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Etiquette icone="👤" texte="Passagers" />
      <div className="flex items-center justify-between rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-field)] px-2">
        <button
          type="button"
          aria-label="Un passager de moins"
          onClick={() => onChange(Math.max(1, valeur - 1))}
          className="min-h-[44px] min-w-[44px] text-[1.125rem] font-bold text-[var(--color-ink)] disabled:opacity-30"
          disabled={valeur <= 1}
        >
          −
        </button>
        <span className="text-[0.9375rem] font-bold tabular-nums text-[var(--color-ink)]">{valeur}</span>
        <button
          type="button"
          aria-label="Un passager de plus"
          onClick={() => onChange(Math.min(8, valeur + 1))}
          className="min-h-[44px] min-w-[44px] text-[1.125rem] font-bold text-[var(--color-ink)] disabled:opacity-30"
          disabled={valeur >= 8}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Budget({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Etiquette icone="💰" texte="Budget (facultatif)" />
      <div className="flex items-center rounded-[14px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3">
        <input
          value={valeur}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
          inputMode="numeric"
          placeholder="—"
          aria-label="Budget proposé en dinars"
          className="min-h-[44px] w-full bg-transparent text-[0.875rem] text-[var(--color-ink)] outline-none"
        />
        <span className="flex-none text-[0.75rem] font-semibold text-[var(--color-muted)]">DT</span>
      </div>
    </div>
  );
}

/**
 * Le bouton qui lance la recherche, et ses trois états.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Pourquoi un composant pour un bouton
 * ────────────────────────────────────────────────────────────────────────
 *
 * Parce que c'est le seul geste irréversible de l'écran, et que ce qui le
 * précède compte autant que ce qui le suit. Trois états, trois messages :
 *
 *   · **inactif** — il manque un départ ou une destination. Le bouton reste
 *     lisible plutôt que fantôme : quelque chose qu'on ne peut pas toucher
 *     doit rester quelque chose qu'on peut lire ;
 *   · **prêt** — pleine couleur, et un reflet qui traverse lentement. Assez
 *     pour attirer l'œil, trop lent pour distraire ;
 *   · **en envoi** — la demande part. Le libellé change et le bouton se
 *     verrouille, ce qui est la seule protection contre le double toucher
 *     avant que la réponse du serveur n'arrive.
 *
 * Le reflet est une couche à part, animée en `transform` seul : la peindre
 * dans le fond du bouton obligerait à recomposer le bouton lui-même à chaque
 * image.
 */
function BoutonRecherche({
  actif,
  envoi,
  reduit,
  onClick,
}: {
  actif: boolean;
  envoi: boolean;
  reduit: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!actif}
      onClick={onClick}
      aria-busy={envoi}
      className={`relative min-h-[54px] w-full overflow-hidden rounded-[16px] text-[0.9375rem] font-bold transition-all duration-200 active:scale-[0.985] ${
        actif
          ? "bg-[var(--color-brand-fill)] text-white shadow-[0_6px_18px_-6px_rgba(122,79,208,0.55)]"
          : "cursor-not-allowed bg-[var(--color-field)] text-[var(--color-muted)]"
      }`}
    >
      {actif && !envoi && !reduit && (
        <m.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]"
          animate={{ x: ["-120%", "420%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.1 }}
        />
      )}

      <span className="relative flex items-center justify-center gap-2">
        {envoi ? (
          <>
            {!reduit && (
              <m.span
                aria-hidden
                className="h-[14px] w-[14px] rounded-full border-2 border-white/35 border-t-white"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
              />
            )}
            Envoi de la demande…
          </>
        ) : (
          <>
            <span aria-hidden>🚕</span>
            Rechercher un taxi
          </>
        )}
      </span>
    </button>
  );
}

function Etiquette({ icone, texte }: { icone: string; texte: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-[var(--color-muted)]">
      <span aria-hidden>{icone}</span>
      {texte}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   L'animation de recherche
   ═══════════════════════════════════════════════════════════════════════ */

function AnimationRecherche({ nbTrouves, reduit }: { nbTrouves: number; reduit: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduit) { setPhase(2); return; }
    const t = [
      window.setTimeout(() => setPhase(1), 700),
      window.setTimeout(() => setPhase(2), 1400),
    ];
    return () => t.forEach(window.clearTimeout);
  }, [reduit]);

  const messages = [
    "Recherche de taxis…",
    "Recherche des chauffeurs disponibles…",
    nbTrouves > 0
      ? `${nbTrouves} chauffeur${nbTrouves > 1 ? "s" : ""} trouvé${nbTrouves > 1 ? "s" : ""}`
      : "Diffusion de votre demande…",
  ];

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      {/*
        Le halo et la voiture sont deux couches séparées.

        Animer une seule couche obligerait à composer l'onde et le déplacement
        dans la même transformation ; en les séparant, chacune garde son propre
        rythme et le navigateur les compose sur le GPU sans recalcul.
      */}
      <div className="relative flex h-[92px] w-[92px] items-center justify-center">
        {!reduit && (
          <>
            <m.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-[var(--color-brand-tint)]"
              animate={{ scale: [1, 1.5], opacity: [0.55, 0] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
            />
            <m.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-[var(--color-brand-tint)]"
              animate={{ scale: [1, 1.5], opacity: [0.55, 0] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut", delay: 0.95 }}
            />
          </>
        )}
        <m.div
          className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--color-brand-tint)]"
          animate={reduit ? undefined : { x: [0, -5, 5, -3, 3, 0], rotate: [0, -3, 3, -1.5, 1.5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-[2rem]" aria-hidden>🚕</span>
        </m.div>
      </div>

      <div className="min-h-[24px]" aria-live="polite">
        <AnimatePresence mode="wait">
          <m.p
            key={phase}
            initial={reduit ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduit ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="text-center text-[0.9375rem] font-bold text-[var(--color-ink)]"
          >
            {messages[phase]}
          </m.p>
        </AnimatePresence>
      </div>

      <div className="h-[3px] w-full max-w-[220px] overflow-hidden rounded-full bg-[var(--color-track)]">
        {!reduit && (
          <m.div
            className="h-full w-1/3 rounded-full bg-[var(--color-brand-fill)]"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Résultats
   ═══════════════════════════════════════════════════════════════════════ */

function CarteChauffeur({
  chauffeur,
  index,
  reduit,
  onDiscuter,
  onDemander,
  occupe,
}: {
  chauffeur: ChauffeurProche;
  index: number;
  reduit: boolean;
  onDiscuter: () => void;
  onDemander: () => void;
  occupe: boolean;
}) {
  const [demande, setDemande] = useState(false);

  return (
    <m.article
      initial={reduit ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduit
          ? { duration: 0 }
          : { delay: index * 0.06, duration: 0.34, ease: [0.32, 0.72, 0, 1] }
      }
      className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.8125rem] font-bold text-[var(--color-brand)]"
        >
          {monogram(chauffeur.nom)}
        </span>

        <div className="min-w-0 flex-1">
          {/*
            Le nom mène à la fiche publique : photo, voiture, nombre de
            courses. C'est ce qu'on veut savoir d'un inconnu avant de monter
            dans sa voiture.
          */}
          <Link
            href={`/chauffeurs/${chauffeur.id}`}
            className="block truncate text-[0.9375rem] font-bold text-[var(--color-ink)] underline-offset-2 hover:underline"
          >
            {chauffeur.nom}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.75rem] text-[var(--color-muted)]">
            {chauffeur.distance !== null && (
              <span className="tabular-nums">
                📍 {chauffeur.distance < 1000
                  ? `${Math.round(chauffeur.distance)} m`
                  : `${(chauffeur.distance / 1000).toFixed(1)} km`}
              </span>
            )}
            {chauffeur.placesLibres !== null && <span>💺 {chauffeur.placesLibres}</span>}
            {chauffeur.vehicule && <span className="truncate">{chauffeur.vehicule}</span>}
          </p>
        </div>

        <span
          className={`flex-none rounded-full px-2 py-1 text-[0.625rem] font-bold ${
            chauffeur.libre
              ? "bg-[var(--color-brand-tint)] text-[var(--color-success)]"
              : "bg-[var(--color-field)] text-[var(--color-muted)]"
          }`}
        >
          {chauffeur.libre ? "🟢 Libre" : "🟠 Occupé"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDiscuter}
          className="min-h-[44px] flex-1 rounded-[12px] bg-[var(--color-field)] text-[0.8125rem] font-semibold text-[var(--color-ink)] transition-transform active:scale-[0.97]"
        >
          💬 Discuter
        </button>
        <a
          href={`tel:${numeroAppelable(chauffeur.telephone)}`}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-[12px] bg-[var(--color-field)] text-[0.8125rem] font-semibold text-[var(--color-ink)] transition-transform active:scale-[0.97]"
        >
          📞 Appeler
        </a>
        {/*
          WhatsApp à côté de l'appel, et pas à la place.

          Un appel aboutit tout de suite mais coupe la conversation en deux dès
          qu'il faut convenir d'un prix ou d'un point de rendez-vous. WhatsApp
          laisse une trace que les deux relisent. Les deux servent, à des
          moments différents ; la carte porte donc les deux.
        */}
        {whatsAppHref(chauffeur.telephone, MESSAGE_WHATSAPP) && (
          <a
            href={whatsAppHref(chauffeur.telephone, MESSAGE_WHATSAPP)!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Écrire à ${chauffeur.nom} sur WhatsApp`}
            className="flex min-h-[44px] w-[52px] flex-none items-center justify-center rounded-[12px] bg-[#e6f4ea] text-[0.9375rem] transition-transform active:scale-[0.97]"
          >
            <span aria-hidden>💬</span>
          </a>
        )}
        <button
          type="button"
          disabled={occupe || demande}
          onClick={() => { setDemande(true); onDemander(); }}
          className="min-h-[44px] flex-1 rounded-[12px] bg-[var(--color-brand-fill)] text-[0.8125rem] font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          {demande ? "✓ Envoyé" : "Demander"}
        </button>
      </div>
    </m.article>
  );
}

function VideResultats({ aDautres }: { aDautres: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span aria-hidden className="text-[2rem]">🔍</span>
      <p className="text-[0.9375rem] font-bold text-[var(--color-ink)]">
        {aDautres ? "Aucun taxi tout près" : "Votre demande est en recherche"}
      </p>
      <p className="max-w-[38ch] text-[0.8125rem] text-[var(--color-muted)]">
        {aDautres ? (
          <>
            Votre demande reste active. En attendant, voici les taxis joignables
            — vous pouvez les appeler directement.
          </>
        ) : (
          <>
            Aucun chauffeur n&apos;est libre autour de vous à l&apos;instant. Votre demande
            reste active&nbsp;: le premier qui se déclare disponible la recevra.
          </>
        )}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Proposition de destination et suivi
   ═══════════════════════════════════════════════════════════════════════ */

function CarteProposition({
  label,
  occupe,
  onAccepter,
  onRefuser,
}: {
  label: string;
  occupe: boolean;
  onAccepter: () => void;
  onRefuser: () => void;
}) {
  return (
    <m.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={RESSORT}
      className="rounded-[18px] border border-[var(--color-brand)] bg-[var(--color-brand-tint)] p-4"
    >
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-[var(--color-brand)]">
        🎯 Nouvelle destination proposée
      </p>
      <p className="mt-1.5 text-[1.0625rem] font-bold text-[var(--color-ink)]">{label}</p>
      <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">
        Le chauffeur propose cette destination à la place de la vôtre.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={occupe}
          onClick={onAccepter}
          className="min-h-[44px] flex-1 rounded-[12px] bg-[var(--color-brand-fill)] text-[0.8125rem] font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          ✓ Accepter
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={onRefuser}
          className="min-h-[44px] flex-1 rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-surface)] text-[0.8125rem] font-semibold text-[var(--color-ink)] transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          ✕ Refuser
        </button>
      </div>
    </m.div>
  );
}

function SuiviCourse({
  course,
  onDiscuter,
  onAnnuler,
  occupe,
}: {
  course: CourseEnCours;
  onDiscuter: () => void;
  onAnnuler: () => void;
  occupe: boolean;
}) {
  const etat = ETATS_COURSE[course.status] ?? ETATS_COURSE.acceptee;
  const c = course.chauffeur;

  const etapes = ["acceptee", "driver_arriving", "picked_up", "in_progress", "completed"];
  const rang = etapes.indexOf(course.status);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-4">
        <p className="text-[1.0625rem] font-bold" style={{ color: etat.teinte }}>
          {etat.titre}
        </p>
        <p className="mt-1 text-[0.8125rem] text-[var(--color-muted)]">{etat.corps}</p>

        {/* La progression, en cinq segments qui se remplissent. */}
        <div className="mt-3 flex gap-1" role="presentation">
          {etapes.map((e, i) => (
            <m.span
              key={e}
              className="h-[4px] flex-1 rounded-full"
              initial={false}
              animate={{
                backgroundColor: i <= rang ? etat.teinte : "var(--color-track)",
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      {c && (
        <div className="rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.875rem] font-bold text-[var(--color-brand)]"
            >
              {monogram(c.nom)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-bold text-[var(--color-ink)]">{c.nom}</p>
              {c.vehicule && (
                <p className="truncate text-[0.75rem] text-[var(--color-muted)]">{c.vehicule}</p>
              )}
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-[0.75rem]">
            <div>
              <dt className="text-[var(--color-muted)]">🎯 Destination</dt>
              <dd className="truncate font-semibold text-[var(--color-ink)]">
                {course.destLabel ?? course.destinationName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">💰 Prix convenu</dt>
              <dd className="font-semibold tabular-nums text-[var(--color-ink)]">
                {course.acceptedPrice !== null ? `${course.acceptedPrice} DT` : "À convenir"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onDiscuter}
              className="min-h-[44px] flex-1 rounded-[12px] bg-[var(--color-field)] text-[0.8125rem] font-semibold text-[var(--color-ink)] transition-transform active:scale-[0.97]"
            >
              💬 Chat
            </button>
            <a
              href={`tel:${numeroAppelable(c.telephone)}`}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-[12px] bg-[var(--color-brand-fill)] text-[0.8125rem] font-bold text-white transition-transform active:scale-[0.97]"
            >
              📞 Appeler
            </a>
          </div>
        </div>
      )}

      {course.status !== "completed" && (
        <button
          type="button"
          disabled={occupe}
          onClick={onAnnuler}
          className="min-h-[44px] w-full rounded-[12px] text-[0.8125rem] font-semibold text-[var(--color-live)] transition-colors hover:bg-[var(--color-live-tint)] disabled:opacity-50"
        >
          Annuler la course
        </button>
      )}
    </div>
  );
}
