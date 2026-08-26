"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { submitServiceRequest } from "@/app/actions/account";
import { uploadImage } from "@/lib/upload";
import { cx } from "@/lib/format";
import { TopBar } from "@/components/shell/top-bar";
import { Button, Card, fieldClass } from "@/components/ui/primitives";
import { ImageIcon, PlusIcon } from "@/components/ui/icons";
import type { ServiceRequestKind } from "@/types/database";

const FIELD =
  fieldClass({});
const LABEL = "text-[0.625rem] text-[var(--color-muted)]";

export function ProcedureForm({
  procedure,
  kind,
  signedIn,
}: {
  procedure: {
    id: string;
    title: string;
    subtitle: string | null;
    body: string | null;
    hue: number;
    monogram: string;
  };
  kind: ServiceRequestKind;
  signedIn: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [title, setTitle] = useState(procedure.title);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const fileInput = useRef<HTMLInputElement>(null);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;

    setUploading(true);
    setError(null);

    try {
      const uploaded = await Promise.all(
        Array.from(list)
          .slice(0, 4 - attachments.length)
          // Les justificatifs restent dans un bucket public par simplicité de
          // relecture ; le nom de fichier est un UUID non devinable.
          .map((file) => uploadImage("deals", file)),
      );
      setAttachments((current) => [...current, ...uploaded.map((u) => u.publicUrl)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.error);
    } finally {
      setUploading(false);
    }
  }

  function onSubmit() {
    if (!signedIn) {
      router.push(`/connexion?suite=/services/demarche/${procedure.id}`);
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await submitServiceRequest({ kind, title, body, attachments });
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  }

  if (sent) {
    return (
      <>
        <TopBar title={procedure.title} back="/services" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[1.25rem] font-bold text-[var(--color-brand)]">
            ✓
          </span>
          <p className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{t.services.submitted}</p>
          <p className="max-w-[34ch] text-[0.71875rem] leading-relaxed text-[var(--color-muted)]">
            Votre démarche est enregistrée. Vous suivrez son avancement dans « {t.services.myRequests} ».
          </p>
          <Button size="sm" onClick={() => router.push("/profil/demarches")} className="mt-1">
            {t.services.myRequests}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={procedure.title} back="/services" />

      <div className="col-reading no-sb flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-6">
        <Card className="flex flex-none items-center gap-[10px] p-3">
          <span
            className="cat-surface cat-ink flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[0.875rem] font-semibold"
            style={{ "--hue": procedure.hue } as React.CSSProperties}
          >
            {procedure.monogram}
          </span>
          <div className="min-w-0">
            <p className="text-[0.75rem] font-bold text-[var(--color-ink)]">{procedure.title}</p>
            {procedure.subtitle && (
              <p className="text-[0.65625rem] text-[var(--color-muted)]">{procedure.subtitle}</p>
            )}
          </div>
        </Card>

        {procedure.body && (
          <p className="text-[0.71875rem] leading-[1.55] text-[var(--color-muted)]">{procedure.body}</p>
        )}

        <Card className="flex flex-none flex-col gap-[10px] p-3">
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Objet</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>Détails</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={
                kind === "bill_payment"
                  ? "Référence de la facture, montant, période…"
                  : "Lieu précis, date du constat, description…"
              }
              className={cx(FIELD, "resize-none placeholder:text-[var(--color-faint)]")}
            />
          </label>

          <span className={LABEL}>{t.common.attachments}</span>
          <div className="flex flex-wrap gap-2">
            {attachments.map((url) => (
              <div key={url} className="relative h-16 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniature locale 64px */}
                <img src={url} alt="" className="h-full w-full rounded-[14px] object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((c) => c.filter((u) => u !== url))}
                  aria-label={t.common.delete}
                  className="absolute end-[2px] top-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(36,31,46,0.72)] text-[0.6875rem] leading-none text-white"
                >
                  ✕
                </button>
              </div>
            ))}

            {uploading && <div className="skeleton h-16 w-16 rounded-[14px]" />}

            {attachments.length < 4 && !uploading && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label={t.common.add}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-[rgba(109,75,143,0.4)] text-[var(--color-brand)]"
              >
                <ImageIcon size={15} />
                <PlusIcon size={11} />
              </button>
            )}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={(event) => void onFiles(event.target.files)}
          />
        </Card>

        {error && (
          <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
            {error}
          </p>
        )}

        <Button block onClick={onSubmit} disabled={pending || uploading || title.trim().length < 3}>
          {pending ? t.common.loading : signedIn ? t.common.publish : t.common.signInRequired}
        </Button>
      </div>
    </>
  );
}
