"use client";

import { Reorder } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  upsertStory,
  deleteStory,
  reorderStories,
  updateShopVitrineSettings,
} from "@/app/actions/vendor";
import { uploadImage } from "@/lib/upload";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Card } from "@/components/ui/primitives";
import { TopBar } from "@/components/shell/top-bar";
import { StoriesRail } from "@/components/boutique/stories-rail";
import { BoutiqueContenu } from "@/components/boutique/boutique-contenu";
import { HotspotEditor } from "@/components/vendor/hotspot-editor";
import { variablesTheme, type ThemeBoutique } from "@/lib/boutique-themes";
import type { StoryBoutique } from "@/lib/boutique-themes/attributs-server";
import type { PackBoutique, ProduitBoutique, ZoneLivraison } from "@/components/boutique/layouts/types";
import type { Completude } from "@/lib/vitrine-completude";
import type { ThemeId } from "@/lib/boutique-themes";

const LABEL = "text-[0.625rem] text-[var(--color-muted)]";
const FIELD =
  "rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-field)] px-3 py-2 text-[0.75rem] outline-none";

const MODELES_STORY = [
  { v: "nouveautes", l: "Nouveautés" },
  { v: "promo", l: "Promo" },
  { v: "tuto", l: "Tuto" },
  { v: "avis", l: "Avis" },
  { v: "evenement", l: "Événement" },
  { v: "libre", l: "Libre" },
] as const;

interface ShopVitrine {
  id: string;
  slug: string;
  name: string;
  freeDeliveryThreshold: number | null;
  installments: number[];
  routineDiscount: number;
  packTiers: Array<{ min: number; pct: number }>;
}

function formStoryVide() {
  return {
    kind: "libre" as (typeof MODELES_STORY)[number]["v"],
    label: "",
    title: "",
    subtitle: "",
    imageUrl: null as string | null,
    ctaLabel: "",
    ctaTarget: "",
    expires: "permanente" as "24h" | "7j" | "permanente",
  };
}

export function VitrineClient({
  shop,
  themeId,
  theme,
  stories,
  completude,
  produitsApercu,
  enTeteApercu,
  packs,
  zones,
  lookbook,
  produitsPourRepere,
}: {
  shop: ShopVitrine;
  themeId: ThemeId;
  theme: ThemeBoutique;
  stories: StoryBoutique[];
  completude: Completude;
  produitsApercu: ProduitBoutique[];
  enTeteApercu: string | null;
  packs: PackBoutique[];
  zones: ZoneLivraison[];
  lookbook: { imageUrl: string; reperes: Array<{ id: string; productId: string | null; x: number; y: number }> } | null;
  produitsPourRepere: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const [erreurStory, setErreurStory] = useState<string | null>(null);
  const [formStory, setFormStory] = useState(formStoryVide());
  const [envoiImage, setEnvoiImage] = useState(false);
  const [ordreStories, setOrdreStories] = useState(stories);

  const [seuil, setSeuil] = useState(shop.freeDeliveryThreshold?.toString() ?? "");
  const [installments, setInstallments] = useState<number[]>(shop.installments);
  const [remiseRoutine, setRemiseRoutine] = useState(String(shop.routineDiscount));
  const [paliers, setPaliers] = useState(shop.packTiers);
  const [erreurReglages, setErreurReglages] = useState<string | null>(null);
  const [reglagesEnregistres, setReglagesEnregistres] = useState(false);

  function expiresAtDepuis(choix: typeof formStory.expires): string | null {
    if (choix === "permanente") return null;
    const heures = choix === "24h" ? 24 : 24 * 7;
    return new Date(Date.now() + heures * 3_600_000).toISOString();
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnvoiImage(true);
    try {
      const { publicUrl } = await uploadImage("shop-assets", file);
      setFormStory((f) => ({ ...f, imageUrl: publicUrl }));
    } catch {
      setErreurStory("Envoi de l'image impossible");
    } finally {
      setEnvoiImage(false);
    }
  }

  function onCreerStory() {
    setErreurStory(null);
    if (!formStory.label.trim() || !formStory.title.trim()) {
      setErreurStory("Le modèle et le titre sont obligatoires");
      return;
    }
    startTransition(async () => {
      const result = await upsertStory({
        kind: formStory.kind,
        label: formStory.label,
        title: formStory.title,
        subtitle: formStory.subtitle || undefined,
        imageUrl: formStory.imageUrl,
        ctaLabel: formStory.ctaLabel || undefined,
        ctaTarget: formStory.ctaTarget || undefined,
        expiresAt: expiresAtDepuis(formStory.expires),
      });
      if (!result.ok) {
        setErreurStory(result.error);
        return;
      }
      setFormStory(formStoryVide());
      router.refresh();
    });
  }

  function onSupprimerStory(id: string) {
    startTransition(async () => {
      await deleteStory(id);
      router.refresh();
    });
  }

  function onFinDeplacement() {
    startTransition(async () => {
      await reorderStories(ordreStories.map((s) => s.id));
      router.refresh();
    });
  }

  function toggleInstallment(v: number) {
    setInstallments((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort()));
  }

  function majPalier(i: number, champ: "min" | "pct", valeur: number) {
    setPaliers((cur) => cur.map((p, j) => (j === i ? { ...p, [champ]: valeur } : p)));
  }

  function onEnregistrerReglages() {
    setErreurReglages(null);
    setReglagesEnregistres(false);
    const seuilNombre = seuil.trim() === "" ? null : Number.parseFloat(seuil);
    if (seuilNombre !== null && (Number.isNaN(seuilNombre) || seuilNombre < 0)) {
      setErreurReglages("Le palier de livraison doit être un nombre positif");
      return;
    }
    const remiseNombre = Number.parseInt(remiseRoutine, 10);
    startTransition(async () => {
      const result = await updateShopVitrineSettings({
        freeDeliveryThreshold: seuilNombre,
        installments,
        routineDiscount: themeId === "beaute" ? remiseNombre : undefined,
        packTiers: themeId === "parapharmacie" ? paliers : undefined,
      });
      if (!result.ok) {
        setErreurReglages(result.error);
        return;
      }
      setReglagesEnregistres(true);
      router.refresh();
    });
  }

  // L'aperçu reflète l'état du formulaire en cours de saisie, pas encore
  // enregistré — c'est tout l'intérêt par rapport à recharger la page.
  const remiseApercu = Number.parseInt(remiseRoutine, 10) || 0;

  const styleTheme = useMemo(() => variablesTheme(theme), [theme]);

  return (
    <>
      <TopBar title="Ma vitrine" back="/vendeur" />

      <div className="no-sb flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6">
        {/* ─── Complétude ─────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] font-bold">Complétude · {completude.pourcentage} %</span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-full bg-[var(--color-track,var(--color-outline))]">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-fill),var(--color-live-fill))]"
              style={{ width: `${completude.pourcentage}%` }}
            />
          </div>
          <div className="flex flex-col gap-2">
            {completude.etapes.map((e) => (
              <div key={e.id} className="flex items-start gap-[10px]">
                <span
                  className="mt-[2px] flex h-[16px] w-[16px] flex-none items-center justify-center rounded-full text-[0.59375rem] font-bold text-white"
                  style={{ background: e.fait ? "var(--color-success)" : "var(--color-faint)" }}
                >
                  {e.fait ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.75rem] font-semibold">{e.libelle}</p>
                  <p className="text-[0.625rem] text-[var(--color-muted)]">{e.pourquoi}</p>
                </div>
                {!e.fait && (
                  <a href={e.href} className="flex-none text-[0.625rem] font-bold text-[var(--color-brand)]">
                    Compléter →
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* ─── Aperçu en direct ───────────────────────────────────────── */}
        <Card className="flex flex-col gap-2 p-3">
          <span className={LABEL}>
            Aperçu — reflète vos réglages en cours de saisie ci-dessous, avant même d&apos;enregistrer
          </span>
          <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[32px] border-[6px] border-[#1b1724] bg-[var(--color-app)]">
            <div
              className="max-h-[520px] overflow-y-auto"
              style={{ ...styleTheme, background: "var(--theme-fond,var(--color-app))" }}
              data-theme={theme.id}
            >
              {stories.length > 0 && <StoriesRail stories={ordreStories} shopSlug={shop.slug} shopName={shop.name} />}
              <BoutiqueContenu
                onglet="products"
                subCategories={[]}
                promo={null}
                promotions={[]}
                roue={null}
                casesRoue={[]}
                lives={[]}
                visible={produitsApercu}
                packs={packs}
                zones={zones}
                shopId={shop.id}
                shopSlug={shop.slug}
                shopAddress={null}
                couverture={enTeteApercu}
                installments={installments}
                routineDiscount={remiseApercu}
                packTiers={themeId === "parapharmacie" ? paliers : shop.packTiers}
                lookbook={lookbook}
                locale={locale}
                t={t}
                userConnecte={false}
                theme={theme}
              />
            </div>
          </div>
        </Card>

        {/* ─── Stories ─────────────────────────────────────────────────── */}
        <Card id="stories" className="flex flex-col gap-[10px] p-3">
          <span className={LABEL}>Stories ({ordreStories.length}) — glissez pour réordonner</span>

          {ordreStories.length > 0 && (
            <Reorder.Group axis="y" values={ordreStories} onReorder={setOrdreStories} className="flex flex-col gap-1">
              {ordreStories.map((s) => (
                <Reorder.Item
                  key={s.id}
                  value={s}
                  onDragEnd={onFinDeplacement}
                  className="flex cursor-grab items-center gap-2 rounded-[12px] border border-[var(--color-outline)] bg-[var(--color-app)] p-[8px] active:cursor-grabbing"
                >
                  <span className="flex-none text-[0.75rem] opacity-50">⠿</span>
                  <span className="min-w-0 flex-1 truncate text-[0.75rem] font-semibold">
                    {s.label} — {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSupprimerStory(s.id)}
                    disabled={pending}
                    className="flex-none text-[0.6875rem] font-bold text-[var(--color-live)] disabled:opacity-40"
                  >
                    Supprimer
                  </button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}

          <span className={LABEL}>Nouvelle story</span>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Modèle</span>
            <select
              value={formStory.kind}
              onChange={(e) => setFormStory((f) => ({ ...f, kind: e.target.value as typeof f.kind }))}
              className={FIELD}
            >
              {MODELES_STORY.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Libellé (sous la vignette)</span>
            <input
              value={formStory.label}
              onChange={(e) => setFormStory((f) => ({ ...f, label: e.target.value }))}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Titre</span>
            <input
              value={formStory.title}
              onChange={(e) => setFormStory((f) => ({ ...f, title: e.target.value }))}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Sous-titre (facultatif)</span>
            <input
              value={formStory.subtitle}
              onChange={(e) => setFormStory((f) => ({ ...f, subtitle: e.target.value }))}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Photo (facultative)</span>
            <input type="file" accept="image/*" onChange={onImageChange} disabled={envoiImage} className="text-[0.6875rem]" />
            {formStory.imageUrl && <span className="text-[0.625rem] text-[var(--color-success)]">Image envoyée ✓</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Libellé du bouton (facultatif)</span>
            <input
              value={formStory.ctaLabel}
              onChange={(e) => setFormStory((f) => ({ ...f, ctaLabel: e.target.value }))}
              placeholder="Ex. Voir les nouveautés"
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Lien du bouton (facultatif)</span>
            <input
              value={formStory.ctaTarget}
              onChange={(e) => setFormStory((f) => ({ ...f, ctaTarget: e.target.value }))}
              placeholder="onglet:promos, produit:<id>, ou une URL"
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Expiration</span>
            <select
              value={formStory.expires}
              onChange={(e) => setFormStory((f) => ({ ...f, expires: e.target.value as typeof f.expires }))}
              className={FIELD}
            >
              <option value="24h">24 heures</option>
              <option value="7j">7 jours</option>
              <option value="permanente">Permanente</option>
            </select>
          </label>

          {erreurStory && (
            <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
              {erreurStory}
            </p>
          )}

          <Button block onClick={onCreerStory} disabled={pending || envoiImage}>
            {pending ? "Enregistrement…" : "Ajouter la story"}
          </Button>
        </Card>

        {/* ─── Lookbook (Mode) ────────────────────────────────────────── */}
        {themeId === "mode" && (
          <Card className="p-3">
            <HotspotEditor
              scope="lookbook"
              titre="Lookbook — repères sur la photo"
              imageUrlInitiale={lookbook?.imageUrl ?? null}
              pinsInitiaux={lookbook?.reperes.map((r) => ({ productId: r.productId, x: r.x, y: r.y })) ?? []}
              produits={produitsPourRepere}
            />
          </Card>
        )}

        {/* ─── Réglages ────────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-[10px] p-3">
          <span className={LABEL}>Réglages de la vitrine</span>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>Palier de livraison gratuite (DT, vide = désactivé)</span>
            <input value={seuil} onChange={(e) => setSeuil(e.target.value)} inputMode="decimal" className={FIELD} />
          </label>

          {themeId === "electronique" && (
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Paiement en plusieurs fois proposé</span>
              <div className="flex gap-2">
                {[3, 6].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleInstallment(v)}
                    className="flex-1 rounded-[12px] border py-2 text-center text-[0.75rem] font-bold"
                    style={{
                      borderColor: installments.includes(v) ? "var(--color-brand)" : "var(--color-outline)",
                      background: installments.includes(v) ? "var(--color-brand-tint)" : "transparent",
                      color: installments.includes(v) ? "var(--color-brand)" : "var(--color-ink)",
                    }}
                  >
                    {v}×
                  </button>
                ))}
              </div>
            </div>
          )}

          {themeId === "beaute" && (
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Remise sur la routine (%)</span>
              <input
                value={remiseRoutine}
                onChange={(e) => setRemiseRoutine(e.target.value)}
                inputMode="numeric"
                className={FIELD}
              />
            </label>
          )}

          {themeId === "parapharmacie" && (
            <div className="flex flex-col gap-2">
              <span className={LABEL}>Paliers de « Composez votre pack »</span>
              {paliers.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[0.6875rem]">À partir de</span>
                  <input
                    value={p.min}
                    onChange={(e) => majPalier(i, "min", Number.parseInt(e.target.value, 10) || 0)}
                    inputMode="numeric"
                    className={`${FIELD} w-16`}
                  />
                  <span className="text-[0.6875rem]">produits, −</span>
                  <input
                    value={p.pct}
                    onChange={(e) => majPalier(i, "pct", Number.parseInt(e.target.value, 10) || 0)}
                    inputMode="numeric"
                    className={`${FIELD} w-16`}
                  />
                  <span className="text-[0.6875rem]">%</span>
                </div>
              ))}
            </div>
          )}

          {erreurReglages && (
            <p role="alert" className="text-[0.6875rem] font-semibold text-[var(--color-live)]">
              {erreurReglages}
            </p>
          )}
          {reglagesEnregistres && (
            <p className="text-[0.6875rem] font-semibold text-[var(--color-success)]">Enregistré</p>
          )}

          <Button block onClick={onEnregistrerReglages} disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer les réglages"}
          </Button>
        </Card>
      </div>
    </>
  );
}
