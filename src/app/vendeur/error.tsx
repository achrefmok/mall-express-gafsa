"use client";

import { ErrorPanel } from "@/components/shell/error-panel";

/** Frontière d'erreur de l'espace vendeur : la coque et la navigation survivent. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} scope="vendeur" />;
}
