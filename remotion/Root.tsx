import { Composition } from "remotion";
import { MyComposition } from "./MyComposition";

/**
 * La liste des vidéos que Remotion sait fabriquer.
 *
 * `remotion studio` les affiche pour prévisualisation ; `remotion render`
 * en fabrique une en fichier. Une nouvelle idée de vidéo (bannière d'une
 * boutique, récapitulatif Black Friday…) s'ajoute ici comme un composant de
 * plus, avec sa propre durée et ses propres dimensions.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComposition"
        component={MyComposition}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ titre: "G-Mall" }}
      />
    </>
  );
};
