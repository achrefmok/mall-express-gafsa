"use client";

import Image from "next/image";
import { AnimatePresence, LazyMotion, m } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/format";
import { cx } from "@/lib/format";
import { variantCarousel, variantView } from "@/lib/variants";
import { ensureVariantImage } from "@/app/actions/variants";
import { colorName } from "@/lib/color-names";
import { Placeholder } from "@/components/ui/primitives";
import { ImageZoom } from "@/components/ui/image-zoom";
import { useVariant } from "./variant-context";

/*
  Les fonctions d'animation sont chargées après la page, pas avec elle.

  Importées statiquement, elles ajoutaient trente-deux kilo-octets au paquet de
  la fiche produit — la page d'atterrissage depuis Google, sur un marché où la
  donnée mobile se paie. Passée en fonction, la dépendance devient un fragment
  séparé que le navigateur va chercher une fois la page affichée.
*/
const chargerAnimations = () => import("framer-motion").then((mod) => mod.domAnimation);

/** Le glissement : assez long pour se lire, assez court pour ne pas attendre. */
const GLISSEMENT = { duration: 0.38, ease: [0.32, 0.72, 0, 1] as const };

/**
 * Ce que fait l'article qui sort, et celui qui entre.
 *
 * Les deux sont à l'écran en même temps — c'est ce qui distingue un glissement
 * d'un fondu. Le sortant part de côté **en rétrécissant** : il s'éloigne, il ne
 * s'efface pas. L'entrant arrive de l'autre bord à taille presque pleine et se
 * pose au centre. À aucun moment le cadre n'est vide, à aucun moment il n'y a
 * de blanc.
 *
 * `custom` porte le sens de la navigation : la même définition sert les deux
 * flèches, en changeant seulement de signe.
 */
const DEFILE = {
  entre: (sens: number) => ({ x: `${sens * 62}%`, scale: 0.88, opacity: 0 }),
  pose: { x: "0%", scale: 1, opacity: 1 },
  sort: (sens: number) => ({ x: `${sens * -58}%`, scale: 0.72, opacity: 0 }),
};

/**
 * Le produit, ses coloris, et le passage de l'un à l'autre.
 *
 * **Un coloris est une photo, jamais un filtre.** Faire tourner la roue
 * chromatique de l'image entière donnait bien un vêtement d'une autre couleur,
 * mais aussi un visage vert et des mains vertes : un filtre ne sait pas
 * distinguer le tissu de la peau. Changer de coloris change donc d'image — et
 * tout le travail consiste à ce que cela ne se voie pas comme un remplacement.
 *
 * D'où le glissement croisé : le cadre garde exactement sa place et sa taille,
 * l'article sortant s'éloigne d'un côté pendant que l'entrant arrive de
 * l'autre, et les deux se croisent au centre. On lit un même objet qu'on fait
 * tourner, et non deux photos qui se succèdent.
 *
 * **Les couleurs ne sont pas une rangée de pastilles.** Elles vivent dans le
 * halo qui entoure l'article — qui prend la teinte du coloris et la garde le
 * temps qu'on le regarde — et dans les deux flèches qui encadrent le produit.
 * Le nom du coloris se pose dessous, entre les flèches, à l'endroit exact où
 * l'œil vient de voir le changement.
 *
 * Deux axes, et un seul geste par axe : les flèches et le glissement du doigt
 * changent de **coloris** ; les miniatures changent de **vue** à l'intérieur du
 * coloris. Quand l'article n'a qu'un coloris, le geste retombe sur les vues :
 * un axe qui n'existe pas ne prend pas la commande.
 */
export function ProductGallery({ alt }: { alt: string }) {
  const { t } = useI18n();
  const { productId, colors, images, variantImages, color, setColor, noterFabriquee } =
    useVariant();

  const carrousel = useMemo(
    () => variantCarousel(colors, images, variantImages),
    [colors, images, variantImages],
  );

  const multiColoris = carrousel.length > 1;

  /*
    Deux coloris à distinguer : celui qu'on a demandé, et celui qu'on montre.

    Ils ne coïncident que le temps d'un aller-retour réseau. Le client touche
    « jaune » — c'est la demande, elle est instantanée ; l'image jaune, elle,
    doit encore arriver. Confondre les deux, c'est lancer le glissement sur un
    fichier qui n'est pas là : le cadre s'ouvre sur du vide, puis l'image se
    peint d'un coup une fois chargée. C'est exactement le clignotement que la
    transition est censée supprimer.

    On garde donc le coloris affiché en arrière jusqu'à ce que son image soit
    prête, puis on bascule d'un coup. Le nom et la pastille, eux, suivent la
    demande sans attendre : ils ne coûtent rien à afficher, et leur réaction
    immédiate est ce qui donne la sensation de réactivité.
  */
  const demande = color ?? colors[0] ?? null;
  const [montre, setMontre] = useState<string | null>(demande);

  const vue = variantView(colors, images, variantImages, montre);
  const vueDemandee = variantView(colors, images, variantImages, demande);
  const srcs = vue.srcs;

  /** Rang du coloris courant dans le défilé. Négatif s'il n'y figure pas. */
  const rangColoris = carrousel.findIndex((v) => v.color === vueDemandee.color);

  const [rangVue, setRangVue] = useState(0);

  /*
    Le sens du dernier mouvement, pour que l'animation aille dans la bonne
    direction. La flèche droite pousse l'article vers la gauche, comme une page
    qu'on tourne ; la gauche fait l'inverse.
  */
  const [sens, setSens] = useState(1);

  // La vue courante peut ne pas exister dans le coloris d'arrivée : on se
  // recale en tête plutôt que d'afficher un cadre vide.
  useEffect(() => {
    if (rangVue >= srcs.length) setRangVue(0);
  }, [srcs.length, rangVue]);

  /*
    Ce qui se passe entre le doigt et l'image, et pourquoi il y a quatre états.

    Le coloris demandé peut être dans trois situations : son image existe, elle
    n'existe pas encore mais peut être fabriquée, ou elle ne pourra pas l'être.
    Une version antérieure confondait les deux dernières et remplaçait l'article
    par une grande pastille de la couleur demandée — le produit disparaissait de
    sa propre fiche, ce qui est le contraire du service rendu.

    Désormais : **l'article reste à l'écran quoi qu'il arrive.** Tant que la
    nouvelle image n'est pas là, c'est l'ancienne qu'on voit ; un mot discret,
    à côté du nom, dit qu'on prépare la suite. La transition ne part que
    lorsqu'il y a vraiment quelque chose à montrer.
  */
  const [etat, setEtat] = useState<"pret" | "fabrication" | "echec">("pret");
  const cible = vueDemandee.srcs[0] ?? null;

  useEffect(() => {
    if (demande === montre) return;

    let annule = false;

    const precharger = (url: string) =>
      new Promise<void>((resolve) => {
        const img = new window.Image();
        const fini = () => resolve();
        img.onload = fini;
        img.onerror = fini;
        img.src = url;
        // Déjà en cache : `complete` est vrai tout de suite, et la bascule se
        // fait dans la foulée. Le repli de temps évite qu'une image qui traîne
        // fige la fiche.
        if (img.complete) fini();
        window.setTimeout(fini, 4000);
      });

    (async () => {
      let url: string | null = cible;

      if (!url) {
        /*
          Rien en base pour ce coloris : on le fait fabriquer.

          C'est un aller-retour serveur d'environ une demi-seconde, et il n'a
          lieu qu'une fois par coloris et par article — l'image est ensuite
          enregistrée, pour ce visiteur comme pour tous les suivants.
        */
        setEtat("fabrication");
        const resultat = await ensureVariantImage(productId, demande ?? "");
        if (annule) return;

        url = resultat.ok ? resultat.data.url : null;

        if (!url) {
          // Impossible à fabriquer. On garde l'article sous les yeux et on le
          // dit à côté du nom, plutôt que de vider le cadre.
          setEtat("echec");
          return;
        }

        noterFabriquee(demande ?? "", url);
      }

      await precharger(url);
      if (annule) return;

      setEtat("pret");
      setRangVue(0);
      setMontre(demande);
    })();

    return () => {
      annule = true;
    };
  }, [demande, montre, cible, productId, noterFabriquee]);

  const allerAuColoris = useCallback(
    (pas: number) => {
      if (carrousel.length < 2) return;
      const depart = rangColoris < 0 ? 0 : rangColoris;
      const cible = (depart + pas + carrousel.length) % carrousel.length;
      setSens(pas >= 0 ? 1 : -1);
      setColor(carrousel[cible].color);
      setRangVue(0);
    },
    [carrousel, rangColoris, setColor],
  );

  const allerALaVue = useCallback(
    (pas: number) => {
      if (srcs.length < 2) return;
      setSens(pas >= 0 ? 1 : -1);
      setRangVue((r) => (r + pas + srcs.length) % srcs.length);
    },
    [srcs.length],
  );

  /* Un seul geste, et il s'applique à l'axe que l'article possède. */
  const parcourir = multiColoris ? allerAuColoris : allerALaVue;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") parcourir(1);
      if (event.key === "ArrowLeft") parcourir(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parcourir]);

  /*
    Les images voisines sont cherchées d'avance.

    Changer de coloris change de fichier : sans préchargement, le glissement
    découvrirait un cadre gris le temps du téléchargement, et l'illusion d'un
    objet qu'on fait tourner tomberait. On ne précharge que les deux voisins —
    en précharger huit ferait payer sept images à quelqu'un qui n'en regardera
    qu'une.
  */
  useEffect(() => {
    if (carrousel.length < 2) return;
    const depart = rangColoris < 0 ? 0 : rangColoris;

    for (const pas of [1, -1]) {
      const voisin = carrousel[(depart + pas + carrousel.length) % carrousel.length];
      const url = voisin?.srcs[0];
      if (!url) continue;
      const img = new window.Image();
      img.src = url;
    }
  }, [carrousel, rangColoris]);

  /*
    Un article sans la moindre photo : il n'y a pas de galerie à construire.

    À ne pas confondre avec un *coloris* sans photo, qui lui garde toute la
    mécanique — flèches, halo, nom — et affiche simplement qu'il n'a rien à
    montrer. C'est cette confusion qui faisait disparaître la galerie entière
    dès qu'on touchait une couleur non photographiée.
  */
  if (images.length === 0 && carrousel.length === 0) {
    return (
      <Placeholder
        label="photo produit — pleine largeur"
        className="h-[286px] w-full flex-none rounded-b-[30px] lg:h-[420px] lg:rounded-[18px]"
      />
    );
  }

  const rang = srcs.length > 0 ? Math.min(rangVue, srcs.length - 1) : 0;
  const src = srcs[rang] ?? null;

  /*
    La clé porte le coloris **et** l'adresse.

    L'adresse seule suffisait tant qu'un coloris sans photo retombait sur les
    images du produit : deux coloris pouvaient alors partager la même image, et
    ne pas rejouer l'animation était exactement ce qu'on voulait. Maintenant
    qu'un coloris sans photo n'affiche plus rien, la distinction compte : passer
    de « jaune sans photo » à « violet sans photo » doit se voir, et React doit
    remplacer l'élément plutôt que le réutiliser tel quel.
  */
  const cle = `${vue.color}|${src ?? "sans-photo"}`;

  /*
    La teinte de la scène, et le repli quand il n'y en a pas.

    Beaucoup d'articles — un épilateur, un cuiseur — n'ont aucun coloris
    déclaré. `vue.color` est alors vide, et coller un canal alpha derrière
    produirait `backgroundColor: "1f"`, que le navigateur rejette : la scène
    resterait transparente et le glissement découvrirait le fond de page.

    Seule une notation à six chiffres accepte le suffixe. Tout le reste tombe
    sur une surface neutre, qui remplit son office — combler le vide pendant le
    croisement — sans prétendre porter une couleur.
  */
  const teinte = /^#[0-9a-fA-F]{6}$/.test(vue.color) ? vue.color : null;
  const scene = teinte ? `${teinte}1f` : "rgba(90,60,120,0.06)";
  const halo = teinte
    ? `radial-gradient(112% 74% at 50% 40%, ${teinte}33 0%, ${teinte}0f 52%, rgba(0,0,0,0) 82%)`
    : "radial-gradient(112% 74% at 50% 40%, rgba(90,60,120,0.07) 0%, rgba(0,0,0,0) 82%)";

  const flanc =
    "press flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-surface-solid)] text-[1.125rem] leading-none text-[var(--color-ink)] shadow-[0_4px_12px_rgba(60,40,90,0.14)]";

  /*
    Ce que dit la légende — le nom, jamais le code.

    Un coloris est stocké en hexadécimal, ce qui ne se lit ni ne se prononce.
    On approche donc le nom à partir de la teinte, et l'on retombe sur le rang
    quand le code est illisible : « Coloris 2 sur 6 » reste utile, « #b51a00 »
    ne l'est jamais.

    Sans plusieurs coloris, la barre sert à parcourir les vues : elle dit alors
    le rang de la photo, ce qui est la seule chose qui change.
  */
  const legende = multiColoris
    ? (teinte ? colorName(teinte, t) : null) ??
      format(t.product.colorOf, { i: Math.max(rangColoris, 0) + 1, n: carrousel.length })
    : format(t.product.photoOf, { i: rang + 1, n: srcs.length });

  return (
    <LazyMotion features={chargerAnimations} strict>
      <div className="flex flex-none flex-col gap-2">
        <div className="relative overflow-hidden rounded-b-[30px] lg:rounded-[18px]">
          {/*
            La scène colorée : c'est là que vit le coloris.

            Il ne se lit pas sur une pastille posée à côté du prix, il baigne
            l'article. La teinte s'anime d'un coloris à l'autre au lieu de
            sauter, et reste assez pâle pour ne jamais concurrencer la photo ni
            fausser la couleur qu'on est venu juger.

            Elle remplit **toute** la zone, et pas seulement le pourtour du
            produit. C'est ce qui fait tenir le glissement : quand l'article
            sortant s'écarte, il découvre une surface colorée continue, et non
            le fond de la page. Un vide clair à cet endroit se lirait comme un
            trou et casserait l'illusion d'un objet qu'on fait tourner.
          */}
          <m.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            animate={{ backgroundColor: scene }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
          <m.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            animate={{ background: halo }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />

          {/*
            Le cadre ne bouge jamais.

            Sa hauteur est fixe et son contenu est en position absolue : quelle
            que soit la photo qui entre — plus haute, plus étroite, plus lente à
            charger —, le titre et le prix qui suivent ne bougent pas d'un pixel.
          */}
          <div className="relative h-[286px] w-full lg:h-[420px]">
            <AnimatePresence initial={false} custom={sens} mode="popLayout">
              <m.div
                key={cle}
                custom={sens}
                variants={DEFILE}
                initial="entre"
                animate="pose"
                exit="sort"
                transition={GLISSEMENT}
                /*
                  Le glissement du doigt reprend la même course que les flèches.
                  Le seuil est bas — cent pixels, ou un geste vif : au-delà, on
                  a l'impression de tirer sur quelque chose de coincé.
                */
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.16}
                onDragEnd={(_, info) => {
                  const franchi = Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 380;
                  if (franchi) parcourir(info.offset.x < 0 ? 1 : -1);
                }}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
              >
                {src ? (
                  <ImageZoom
                    images={srcs}
                    alt={alt}
                    startIndex={rang}
                    className="block h-full w-full cursor-zoom-in"
                  >
                    <span className="relative block h-full w-full">
                      <Image
                        src={src}
                        alt={
                          srcs.length > 1
                            ? format(t.product.photoOf, { i: rang + 1, n: srcs.length })
                            : alt
                        }
                        fill
                        /*
                          La colonne de la galerie est bornée à 420 pixels sur
                          grand écran et prend toute la largeur en dessous. Le
                          navigateur multiplie par la densité de l'écran, et va
                          donc chercher 840 pixels sur un portable à deux points
                          par pixel — ce qui est exactement ce qu'il faut.
                        */
                        sizes="(max-width: 520px) 100vw, 420px"
                        /*
                          Quatre-vingt-dix plutôt que les soixante-quinze par
                          défaut. C'est l'écran où l'on décide d'acheter : la
                          maille d'un tissu, la finition d'une couture et le
                          grain d'un cuir se perdent dans la compression bien
                          avant que le poids ne devienne un problème. L'écart
                          coûte une dizaine de kilo-octets par photo.
                        */
                        quality={90}
                        priority
                        draggable={false}
                        className="object-cover"
                      />
                    </span>
                  </ImageZoom>
                ) : (
                  /*
                    Un cadre neutre, jamais une pastille de couleur.

                    On n'arrive ici que si l'article n'a aucune photo du tout —
                    la fabrication à la demande couvre tous les autres cas. Une
                    grande pastille de la couleur demandée à cet endroit
                    remplaçait l'article par un aplat : le client venait voir un
                    vêtement et voyait un rond.
                  */
                  <Placeholder label="photo produit" className="h-full w-full" />
                )}
              </m.div>
            </AnimatePresence>
          </div>

          {/*
            La barre de parcours, sous l'article et non dessus.

            Posées sur la photo, les flèches et le nom du coloris masquaient
            précisément ce qu'on est venu regarder — le nom tombait au milieu du
            torse du mannequin. Sur leur propre ligne, elles n'enlèvent rien à
            l'article, et le fond coloré les rattache visiblement à lui plutôt
            que de les renvoyer au reste de la page.

            Le nom se pose au centre, entre les deux flèches, à l'aplomb de ce
            qui vient de changer.
          */}
          {(multiColoris || srcs.length > 1) && (
            <div className="relative z-10 flex items-center justify-between px-[14px] pb-[14px]">
              <button
                type="button"
                onClick={() => parcourir(-1)}
                aria-label={t.common.back}
                className={flanc}
              >
                ‹
              </button>

              <AnimatePresence mode="wait">
                <m.span
                  key={legende}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -7 }}
                  transition={{ duration: 0.22 }}
                  className="flex min-w-0 items-center gap-[7px] px-2 text-[0.65625rem] font-bold text-[var(--color-ink)]"
                >
                  {teinte && (
                    <span
                      aria-hidden
                      className="h-[13px] w-[13px] flex-none rounded-full ring-1 ring-[var(--color-outline)]"
                      style={{ background: teinte }}
                    />
                  )}
                  <span className="truncate">{legende}</span>

                  {/*
                    L'état de préparation, à côté du nom et nulle part ailleurs.

                    Pas de voile, pas de roue qui tourne au milieu de l'article,
                    pas de changement de gabarit : le vêtement reste net et à sa
                    place pendant qu'on prépare la suite. Le mot suffit à dire
                    qu'il se passe quelque chose, et il disparaît de lui-même.
                  */}
                  {etat !== "pret" && (
                    <span className="flex-none text-[0.59375rem] font-semibold text-[var(--color-faint)]">
                      · {etat === "fabrication" ? t.product.preparing : t.product.colorNoPhoto}
                    </span>
                  )}
                </m.span>
              </AnimatePresence>

              <button
                type="button"
                onClick={() => parcourir(1)}
                aria-label={t.common.see}
                className={flanc}
              >
                ›
              </button>
            </div>
          )}

          {/*
            L'aveu, quand l'image a été fabriquée.

            Elle approche la couleur ; elle ne montre pas cet article-là —
            matière, coutures et reflets restent ceux du modèle photographié. Le
            dire est la condition pour s'autoriser à l'afficher.
          */}
          <AnimatePresence>
            {vue.fidelity !== "photo" && (
              <m.span
                key={vue.fidelity}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.22 }}
                className="pointer-events-none absolute start-3 top-[54px] z-10 rounded-[10px] bg-[rgba(20,14,26,0.6)] px-[9px] py-1 text-[0.53125rem] font-bold text-white backdrop-blur-[2px]"
              >
                {vue.fidelity === "generated" ? t.product.generatedImage : t.product.colorNoPhoto}
              </m.span>
            )}
          </AnimatePresence>
        </div>

        {/* Les miniatures : l'autre axe, les vues d'un même coloris. */}
        {srcs.length > 1 && (
          <div className="no-sb flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
            {srcs.map((miniature, i) => (
              <button
                key={miniature}
                type="button"
                onClick={() => {
                  setSens(i >= rang ? 1 : -1);
                  setRangVue(i);
                }}
                aria-label={format(t.product.photoOf, { i: i + 1, n: srcs.length })}
                aria-current={i === rang ? "true" : undefined}
                className="press relative h-[52px] w-[52px] flex-none overflow-hidden rounded-[14px]"
              >
                <Image
                  src={miniature}
                  alt=""
                  fill
                  // Cinquante-deux pixels affichés, trois fois plus sur un écran
                  // dense : une vignette molle se remarque autant qu'une grande.
                  sizes="52px"
                  quality={85}
                  className={cx(
                    "object-cover transition-opacity",
                    i === rang ? "opacity-100" : "opacity-55",
                  )}
                />

                {/*
                  Le contour glisse d'une vignette à l'autre au lieu de
                  disparaître ici pour réapparaître là : l'œil suit le
                  déplacement et comprend qu'il s'agit du même repère.
                */}
                {i === rang && (
                  <m.span
                    layoutId="miniature-active"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="pointer-events-none absolute inset-0 rounded-[14px] ring-2 ring-[var(--color-brand)] ring-inset"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </LazyMotion>
  );
}
