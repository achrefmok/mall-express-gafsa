"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { SiteMenu } from "./site-menu";
import { createClient } from "@/lib/supabase/client";
import { cx, formatPrice } from "@/lib/format";
import { MicIcon, SearchIcon } from "@/components/ui/icons";
import type { Database } from "@/types/database";

type Result = Database["public"]["Functions"]["search_catalog"]["Returns"][number];

/**
 * Barre de recherche : pill blanche r18, loupe, puce « Parler » (dictée
 * vocale), et un bouton rond violet pour le menu.
 *
 * La dictée s'appuie sur l'API Web Speech, non standardisée : elle n'est
 * proposée que là où elle existe réellement (Chrome, Edge, Safari), jamais
 * comme un bouton mort.
 */
export function SearchBar({
  placeholder,
  withVoice = true,
  withMenu = true,
  filterAction,
  initialQuery = "",
}: {
  placeholder?: string;
  withVoice?: boolean;
  withMenu?: boolean;
  filterAction?: React.ReactNode;
  /** Terme déjà cherché : la page de résultats le remet dans le champ. */
  initialQuery?: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  /*
    La liste ne s'ouvre qu'après une frappe.

    Sur la page de résultats, le champ arrive prérempli : la recherche différée
    partait donc au montage et dépliait la liste par-dessus la grille — huit
    lignes masquant les résultats que la personne venait justement d'obtenir.
    Le drapeau distingue « champ prérempli » de « quelqu'un est en train de
    chercher ».
  */
  const [touche, setTouche] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVoiceAvailable(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    );
  }, []);

  // Recherche différée : 250 ms après la dernière frappe.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .rpc("search_catalog", { q: term, limit_count: 8 })
        .abortSignal(controller.signal);

      if (!controller.signal.aborted) {
        setResults(data ?? []);
        if (touche) setOpen(true);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, touche]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function startVoice() {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = locale === "ar" ? "ar-TN" : "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript ?? "";
      // Dicter est une frappe : la liste doit s'ouvrir comme si l'on tapait.
      setTouche(true);
      setQuery(said);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    setListening(true);
    recognition.start();
  }

  function go(result: Result) {
    setOpen(false);
    setQuery("");
    router.push(result.kind === "product" ? `/produit/${result.id}` : `/boutique/${result.slug}`);
  }

  return (
    <div
      ref={boxRef}
      className="relative flex flex-none items-center gap-2 border-b border-[var(--color-hairline)] px-4 pt-[6px] pb-3"
    >
      {/*
        Un vrai formulaire, pour que « Entrée » et la touche « Rechercher » du
        clavier tactile mènent quelque part.

        La liste déroulante ne montre que huit résultats et disparaît au premier
        toucher à côté : quelqu'un qui cherche « t-shirt » veut une page, pas un
        aperçu. La validation ouvre donc la grille de résultats, et la liste
        reste ce qu'elle est — un raccourci pour qui reconnaît son article tout
        de suite.

        Le `<label>` intérieur porte toute la hauteur de la pilule. Ce
        rembourrage appartenait à un `<div>` : seuls les dix-huit pixels du champ
        donnaient le focus, et toucher juste au-dessus du texte ne faisait rien —
        sur la commande la plus visible de l'écran.
      */}
      <form
        action="/recherche"
        onSubmit={(event) => {
          if (!query.trim()) event.preventDefault();
          else setOpen(false);
        }}
        className="flex flex-1 items-center gap-[9px] rounded-[24px] bg-[var(--color-surface-solid)] px-4 py-[13px] shadow-[0_8px_20px_rgba(60,40,90,0.08)]"
      >
        <label className="flex min-w-0 flex-1 items-center gap-[9px]">
          <SearchIcon size={15} className="flex-none text-[var(--color-muted)]" />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => {
              setTouche(true);
              setQuery(event.target.value);
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            enterKeyHint="search"
            placeholder={placeholder ?? t.common.searchPlaceholder}
            aria-label={t.common.search}
            className="min-w-0 flex-1 bg-transparent text-[0.78125rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
          />
        </label>
      </form>

      {/*
        La dictée sort de la pilule et devient un bouton rond à part.

        Elle y était un petit rectangle teinté, collé au champ, que l'on prenait
        pour une étiquette. Isolée, à quarante-quatre pixels, elle se voit et se
        vise — et le champ retrouve toute sa largeur pour le texte saisi.
      */}
      {withVoice && voiceAvailable && (
        <button
          type="button"
          onClick={startVoice}
          aria-label={t.common.speak}
          className={cx(
            "press flex h-11 w-11 flex-none items-center justify-center rounded-[22px] shadow-[0_10px_22px_rgba(109,75,143,0.3)]",
            listening
              ? "bg-[var(--color-live-fill)] text-white"
              : "bg-[var(--color-brand-fill)] text-white",
          )}
        >
          <MicIcon size={17} />
        </button>
      )}

      {filterAction}

      {/*
        Le menu porte son propre état.

        Il attendait auparavant une fonction `onMenu` qu'aucun appelant ne
        fournissait : le bouton s'affichait et ne répondait pas. Le déplacer dans
        un composant autonome supprime la question — il ne peut plus être rendu
        sans son comportement.
      */}
      {withMenu && <SiteMenu />}

      {open && results.length > 0 && (
        <ul className="absolute inset-x-4 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] p-1 shadow-[0_12px_28px_rgba(60,40,90,0.14)]">
          {results.map((result) => (
            <li key={`${result.kind}-${result.id}`}>
              <button
                type="button"
                onClick={() => go(result)}
                className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-start hover:bg-[var(--color-brand-tint)]"
              >
                <span
                  className="cat-surface cat-ink flex h-8 w-8 flex-none items-center justify-center rounded-[12px] text-[0.625rem] font-bold"
                  style={{ "--hue": result.hue ?? 300 } as React.CSSProperties}
                >
                  {result.kind === "product" ? "PR" : "BQ"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.75rem] font-semibold text-[var(--color-ink)]">
                    {result.title}
                  </span>
                  {result.subtitle && (
                    <span className="block truncate text-[0.625rem] text-[var(--color-muted)]">
                      {result.subtitle}
                    </span>
                  )}
                </span>
                {result.price !== null && (
                  <span className="flex-none text-[0.6875rem] font-bold text-[var(--color-brand)]">
                    {formatPrice(result.price, locale)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* L'API Web Speech n'est pas dans lib.dom : type minimal pour ce qu'on utilise. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
}
