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
}: {
  placeholder?: string;
  withVoice?: boolean;
  withMenu?: boolean;
  filterAction?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [query, setQuery] = useState("");
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
        setOpen(true);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

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
      <div className="flex flex-1 items-center gap-2 rounded-[18px] border border-[var(--color-surface-edge)] bg-white px-[14px] py-[9px] shadow-[var(--shadow-search)]">
        <SearchIcon size={14} className="flex-none text-[var(--color-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? t.common.searchPlaceholder}
          aria-label={t.common.search}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
        />

        {withVoice && voiceAvailable && (
          <button
            type="button"
            onClick={startVoice}
            aria-label={t.common.speak}
            className={cx(
              "flex flex-none items-center gap-[5px] rounded-[12px] px-[9px] py-1 text-[10px] font-bold",
              listening
                ? "bg-[var(--color-live)] text-white"
                : "bg-[var(--color-brand-tint)] text-[var(--color-brand)]",
            )}
          >
            <MicIcon size={10} />
            {t.common.speak}
          </button>
        )}
      </div>

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
        <ul className="absolute inset-x-4 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-[18px] border border-[var(--color-surface-edge)] bg-white p-1 shadow-[0_12px_28px_rgba(60,40,90,0.14)]">
          {results.map((result) => (
            <li key={`${result.kind}-${result.id}`}>
              <button
                type="button"
                onClick={() => go(result)}
                className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-start hover:bg-[var(--color-brand-tint)]"
              >
                <span
                  className="cat-surface cat-ink flex h-8 w-8 flex-none items-center justify-center rounded-[12px] text-[10px] font-bold"
                  style={{ "--hue": result.hue ?? 300 } as React.CSSProperties}
                >
                  {result.kind === "product" ? "PR" : "BQ"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-[var(--color-ink)]">
                    {result.title}
                  </span>
                  {result.subtitle && (
                    <span className="block truncate text-[10px] text-[var(--color-muted)]">
                      {result.subtitle}
                    </span>
                  )}
                </span>
                {result.price !== null && (
                  <span className="flex-none text-[11px] font-bold text-[var(--color-brand)]">
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
