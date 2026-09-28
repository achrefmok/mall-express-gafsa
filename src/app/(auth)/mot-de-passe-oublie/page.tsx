import type { Metadata } from "next";
import { RecoveryScreen } from "./recovery-screen";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

/** Récupération de compte : atteignable sans connexion, même en préparation. */
export default function RecoveryPage() {
  return <RecoveryScreen />;
}
