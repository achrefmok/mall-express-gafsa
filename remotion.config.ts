import { Config } from "@remotion/cli/config";

/**
 * Réglages de Remotion — son propre bundler, à part de celui de Next.js.
 * `Config` ici ne touche à rien du build de l'application, uniquement à
 * `remotion studio` et `remotion render`.
 */
Config.setVideoImageFormat("jpeg");
