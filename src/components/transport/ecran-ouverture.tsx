"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { serviceIcon } from "@/components/ui/category-icons";
import { useI18n } from "@/lib/i18n/provider";

const CLE_SESSION = "taxi-ouverture-session";
const IconeTaxi = serviceIcon("taxi")!;

/**
 * L'écran d'ouverture de « Taxi & Louage Gafsa » : nuit, ambre taxi, le nom
 * de l'application. Une fois par lancement (`sessionStorage`), 1,4 s, un
 * toucher l'efface. Rien sous `prefers-reduced-motion`.
 */
export function EcranOuvertureTransport() {
  const { locale } = useI18n();
  const [etat, setEtat] = useState<"cache" | "visible" | "sortie">("cache");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLE_SESSION) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      sessionStorage.setItem(CLE_SESSION, "1");
    } catch {
      return;
    }
    setEtat("visible");
    const a = setTimeout(() => setEtat("sortie"), 1400);
    const b = setTimeout(() => setEtat("cache"), 1800);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  if (etat === "cache") return null;
  const ar = locale === "ar";

  return createPortal(
    <div
      role="presentation"
      onClick={() => setEtat("cache")}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[radial-gradient(70%_50%_at_50%_40%,#3a2408,#14161c_70%)] text-center transition-opacity duration-400"
      style={{ opacity: etat === "sortie" ? 0 : 1 }}
    >
      <span className="animate-monte flex h-24 w-24 items-center justify-center rounded-[30px] bg-[linear-gradient(140deg,#fbbf24,#d97706)] text-[#1a1204] shadow-[0_18px_40px_rgba(245,158,11,.35)]">
        <IconeTaxi size={52} />
      </span>
      <span className="animate-monte flex flex-col gap-1" style={{ animationDelay: ".25s" }}>
        <b className="text-[1.75rem] font-black tracking-[-0.6px] text-white">{ar ? "تاكسي ولواج قفصة" : "Taxi & Louage Gafsa"}</b>
        <span className="text-[0.875rem] text-[#a7adba]">
          {ar ? "تاكسي في دقائق، ومقعدك في اللواج" : "Un taxi en quelques minutes, votre place en louage"}
        </span>
      </span>
    </div>,
    document.body,
  );
}
