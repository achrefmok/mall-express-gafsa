"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relayFacebookLive } from "@/app/actions/lives";
import { cx } from "@/lib/format";
import { Button, Card } from "@/components/ui/primitives";

type Platform = "android" | "ios" | "desktop";

/**
 * Mise en ligne d'un direct Facebook, quel que soit l'appareil.
 *
 * Le geste le plus court diffère d'une plateforme à l'autre, et montrer les
 * trois marches à suivre à tout le monde serait le meilleur moyen qu'aucune ne
 * soit lue. On détecte donc, et on n'affiche que celle qui s'applique.
 *
 * La détection sert uniquement à choisir un texte d'aide : le champ et le
 * bouton fonctionnent partout, y compris si elle se trompe.
 */
export function QuickRelay({
  shopName,
  approved,
  initialError,
}: {
  shopName: string;
  approved: boolean;
  /** Message laissé par un partage entrant inexploitable. */
  initialError?: string;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(
      /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : "desktop",
    );
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
  }, []);

  async function pasteFromClipboard() {
    setError(null);
    try {
      const text = await navigator.clipboard?.readText();
      if (text?.trim()) setUrl(text.trim());
      else setError("Le presse-papiers est vide. Copiez d'abord le lien depuis Facebook.");
    } catch {
      setError("Votre navigateur n'autorise pas la lecture du presse-papiers. Collez le lien à la main.");
    }
  }

  function onRelay() {
    setError(null);
    startTransition(async () => {
      const result = await relayFacebookLive({ url });
      if (result.ok) {
        router.replace(`/vendeur/lives/${result.data.id}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      {/* ─── La marche à suivre, selon l'appareil ────────────────────── */}
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-[13px] font-bold text-[var(--color-ink)]">
          Vous diffusez déjà sur Facebook ?
        </p>

        {platform === "android" && installed && (
          <Guide
            steps={[
              "Sur Facebook, ouvrez votre vidéo en direct",
              "Touchez « Partager »",
              "Choisissez « Mall Express Gafsa » dans la liste",
            ]}
            note="Le direct se met en ligne sans que vous ayez rien à copier."
          />
        )}

        {platform === "android" && !installed && (
          <Guide
            steps={[
              "Installez d'abord l'application : menu du navigateur → « Installer l'application »",
              "Ensuite, sur Facebook : votre vidéo → « Partager » → « Mall Express Gafsa »",
            ]}
            note="Une fois installée, plus rien à copier : le partage suffit."
          />
        )}

        {platform === "ios" && (
          <Guide
            steps={[
              "Sur Facebook, ouvrez votre vidéo en direct",
              "Touchez « Partager », puis « Copier le lien »",
              "Revenez ici et touchez « Coller le lien »",
            ]}
            note="Safari ne permet pas d'envoyer directement vers une application installée : la copie reste le chemin le plus court sur iPhone."
          />
        )}

        {platform === "desktop" && (
          <Guide
            steps={[
              "Sur Facebook, ouvrez votre vidéo en direct",
              "Copiez l'adresse dans la barre du navigateur",
              "Collez-la ci-dessous",
            ]}
            note="Depuis votre téléphone Android, le partage direct évite même cette étape."
          />
        )}
      </Card>

      {/* ─── Le champ, identique partout ─────────────────────────────── */}
      <Card className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-[var(--color-muted)]">Lien de la vidéo Facebook</span>

          <span className="flex gap-2">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              type="url"
              inputMode="url"
              placeholder="https://www.facebook.com/…/videos/…"
              className="min-w-0 flex-1 rounded-[14px] border border-[var(--color-outline)] bg-white/60 px-3 py-[10px] text-[12.5px] font-semibold text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] placeholder:font-normal placeholder:text-[var(--color-faint)]"
            />
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="flex-none rounded-[12px] border border-[var(--color-outline)] bg-white/70 px-3 text-[10.5px] font-bold whitespace-nowrap text-[var(--color-brand)]"
            >
              Coller le lien
            </button>
          </span>
        </label>

        {approved ? (
          <Button block disabled={pending || url.trim().length < 12} onClick={onRelay}>
            {pending ? "Mise en ligne…" : "Passer en direct maintenant"}
          </Button>
        ) : (
          <p className="rounded-[12px] bg-[var(--color-live-tint)] p-3 text-[11.5px] leading-[1.55] text-[var(--color-ink)]">
            Votre boutique attend la validation de l&apos;administration. Vous
            pourrez diffuser dès qu&apos;elle sera approuvée.
          </p>
        )}

        {error && (
          <p role="alert" className={cx("text-[11.5px] leading-[1.5] font-semibold text-[var(--color-live)]")}>
            {error}
          </p>
        )}

        <p className="text-[9.5px] leading-[1.45] text-[var(--color-muted)]">
          La vidéo doit être <strong>publique</strong>. Le titre, le produit
          épinglé et la remise de votre direct précédent sont repris — tout se
          règle ensuite depuis la console, en cours de diffusion.
        </p>
      </Card>

      <div className="flex flex-col gap-1 text-center">
        <Link
          href="/vendeur/lives/nouveau"
          className="text-[11.5px] font-semibold text-[var(--color-brand)]"
        >
          Programmer un direct à l&apos;avance
        </Link>
        <Link href="/vendeur/reglages" className="text-[11px] text-[var(--color-muted)]">
          Relier ma page Facebook pour ne plus rien faire du tout
        </Link>
      </div>

      <p className="sr-only">Boutique : {shopName}</p>
    </>
  );
}

function Guide({ steps, note }: { steps: string[]; note: string }) {
  return (
    <>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-[10px]">
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[10.5px] font-bold text-[var(--color-brand)]">
              {index + 1}
            </span>
            <span className="pt-[2px] text-[12px] leading-[1.5] text-[var(--color-ink)]">
              {step}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[10.5px] leading-[1.5] text-[var(--color-muted)]">{note}</p>
    </>
  );
}
