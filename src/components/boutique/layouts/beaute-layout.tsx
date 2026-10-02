"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/primitives";
import { ProductCard } from "@/components/cards/product-card";
import { useI18n } from "@/lib/i18n/provider";
import { formatPrice } from "@/lib/format";
import { addToCart } from "@/app/actions/cart";
import type { ThemeBoutique } from "@/lib/boutique-themes";
import type { AppLocale } from "@/types/database";
import type { ProduitBoutique } from "./types";

const ONGLETS = [
  { slug: "beaute-maquillage", labelFr: "Maquillage", labelAr: "مكياج" },
  { slug: "beaute-parfums", labelFr: "Parfums", labelAr: "عطور" },
  { slug: "beaute-soin", labelFr: "Soin", labelAr: "العناية" },
] as const;

/** Six carnations de référence — le choix sert à rapprocher des teintes réelles, pas à les inventer. */
const CARNATIONS = ["#f6dcc6", "#ecc4a2", "#d9a57c", "#c08a5f", "#9a6640", "#6b4429"];

/**
 * Ordre d'affichage des gestes d'une routine — vient de l'attribut `etape`
 * (suggéré au vendeur avec ces trois libellés exacts côté `attribute-fields.tsx`,
 * mais jamais une liste fermée : un libellé différent n'est simplement pas
 * ordonné et retombe en fin de routine).
 */
const ORDRE_ETAPES = ["Nettoyer", "Traiter", "Hydrater & protéger"];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * « Studio premium » — Beauté, trois onglets internes.
 *
 * Les onglets viennent des sous-catégories `beaute-maquillage`/
 * `beaute-parfums`/`beaute-soin` (migration dédiée) — une vraie donnée que
 * le vendeur choisit en rangeant son produit. Aucune boutique n'a encore
 * rangé ses produits ainsi : la grille simple reste le repli.
 *
 * Le trouveur de teinte réutilise `products.colors` — déjà saisi par le
 * vendeur pour tout produit qui en a — et calcule la couleur la plus
 * proche de la carnation choisie, sans inventer de teinte « recommandée »
 * qui n'existerait pas réellement dans le catalogue.
 */
export function BeauteLayout({
  visible,
  locale,
  theme,
}: {
  visible: ProduitBoutique[];
  locale: AppLocale;
  theme: ThemeBoutique;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [carnation, setCarnation] = useState<number | null>(null);
  const [familleActive, setFamilleActive] = useState<string | null>(null);
  const [peauActive, setPeauActive] = useState<string | null>(null);

  const groupes = useMemo(() => {
    const parSlug = new Map<string, ProduitBoutique[]>();
    for (const o of ONGLETS) parSlug.set(o.slug, []);
    for (const p of visible) {
      const slug = p.category?.slug;
      if (slug && parSlug.has(slug)) parSlug.get(slug)!.push(p);
    }
    return parSlug;
  }, [visible]);

  const ongletsUtiles = ONGLETS.filter((o) => (groupes.get(o.slug) ?? []).length > 0);
  const [actif, setActif] = useState<string | null>(null);

  const slugActif = actif ?? ongletsUtiles[0]?.slug ?? "";
  const produitsOnglet = useMemo(() => groupes.get(slugActif) ?? [], [groupes, slugActif]);
  const estMaquillage = slugActif === "beaute-maquillage";
  const estParfums = slugActif === "beaute-parfums";
  const estSoin = slugActif === "beaute-soin";

  const cible = carnation !== null ? hexToRgb(CARNATIONS[carnation]) : null;
  const produitsTriesTeinte =
    estMaquillage && cible
      ? [...produitsOnglet].sort((a, b) => {
          const da = Math.min(...(a.colors ?? []).map((c) => hexToRgb(c)).filter(Boolean).map((c) => distance(c!, cible)), Infinity);
          const db = Math.min(...(b.colors ?? []).map((c) => hexToRgb(c)).filter(Boolean).map((c) => distance(c!, cible)), Infinity);
          return da - db;
        })
      : produitsOnglet;
  const matchesTeinte = cible
    ? produitsTriesTeinte.filter((p) => (p.colors ?? []).some((c) => {
        const rgb = hexToRgb(c);
        return rgb && distance(rgb, cible) < 60;
      })).length
    : 0;

  const familles = useMemo(() => {
    if (!estParfums) return [];
    const comptes = new Map<string, number>();
    for (const p of produitsOnglet) {
      const f = p.attributs?.famille_olfactive;
      if (!f) continue;
      comptes.set(f, (comptes.get(f) ?? 0) + 1);
    }
    return [...comptes.entries()];
  }, [estParfums, produitsOnglet]);

  const peaux = useMemo(() => {
    if (!estSoin) return [];
    const comptes = new Map<string, number>();
    for (const p of produitsOnglet) {
      const peau = p.attributs?.peau;
      if (!peau) continue;
      comptes.set(peau, (comptes.get(peau) ?? 0) + 1);
    }
    return [...comptes.entries()];
  }, [estSoin, produitsOnglet]);
  const peauEffective = peauActive ?? peaux[0]?.[0] ?? null;

  const routine = useMemo(() => {
    if (!estSoin) return [];
    const base = peauEffective ? produitsOnglet.filter((p) => p.attributs?.peau === peauEffective) : produitsOnglet;
    const parEtape = new Map<string, ProduitBoutique>();
    for (const p of base) {
      const etape = p.attributs?.etape;
      if (!etape || parEtape.has(etape)) continue;
      parEtape.set(etape, p);
    }
    const connues = ORDRE_ETAPES.filter((e) => parEtape.has(e)).map((e) => [e, parEtape.get(e)!] as const);
    const autres = [...parEtape.entries()].filter(([e]) => !ORDRE_ETAPES.includes(e));
    return [...connues, ...autres];
  }, [estSoin, peauEffective, produitsOnglet]);

  const prixRoutine = routine.reduce((a, [, p]) => a + p.price, 0);
  const remiseRoutine = 0.1;

  function ajouterLaRoutine() {
    setFeedback(null);
    startTransition(async () => {
      for (const [, p] of routine) {
        const result = await addToCart({ productId: p.id });
        if (!result.ok) {
          if (result.error === "Authentification requise") {
            router.push(`/connexion?suite=/boutique/${window.location.pathname.split("/")[2]}`);
            return;
          }
          setFeedback(result.error);
          return;
        }
      }
      setFeedback(t.product.added);
      router.refresh();
    });
  }

  const produitsActifs = estParfums && familleActive
    ? produitsOnglet.filter((p) => p.attributs?.famille_olfactive === familleActive)
    : estSoin && peauEffective
      ? produitsOnglet.filter((p) => p.attributs?.peau === peauEffective)
      : produitsTriesTeinte;

  if (visible.length === 0) {
    return <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />;
  }

  // Moins de deux onglets réellement peuplés : pas de segmentation utile.
  if (ongletsUtiles.length < 2) {
    return (
      <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
        {visible.map((p) => (
          <ProductCard key={p.id} product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex gap-[4px] rounded-[18px] bg-[var(--theme-accent-doux)] p-[4px]">
        {ongletsUtiles.map((o) => {
          const on = o.slug === slugActif;
          return (
            <button
              key={o.slug}
              type="button"
              onClick={() => setActif(o.slug)}
              className="flex-1 rounded-[14px] py-[8px] text-center text-[0.71875rem] font-bold whitespace-nowrap"
              style={{
                background: on ? "var(--theme-surface,#fff)" : "transparent",
                color: on ? "var(--theme-accent-fort)" : "var(--theme-muted)",
              }}
            >
              {locale === "ar" ? o.labelAr : o.labelFr}
            </button>
          );
        })}
      </div>

      {estMaquillage && (
        <div className="flex flex-col gap-[10px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem] font-bold">{locale === "ar" ? "اعثر على لوني" : "Trouver ma teinte"}</span>
            <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">
              {locale === "ar" ? "المسوا لون بشرتكم" : "Touchez votre carnation"}
            </span>
          </div>
          <div className="flex justify-between">
            {CARNATIONS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setCarnation(carnation === i ? null : i)}
                className="h-[36px] w-[36px] rounded-full"
                style={{
                  background: c,
                  boxShadow: carnation === i ? "0 0 0 3px var(--theme-surface,#fff), 0 0 0 5px var(--theme-accent)" : "0 2px 6px rgba(60,40,90,0.15)",
                }}
                aria-label={`Carnation ${i + 1}`}
              />
            ))}
          </div>
          {cible && (
            <p className="text-[0.625rem] font-semibold text-[var(--theme-accent-fort)]">
              {matchesTeinte > 0
                ? locale === "ar"
                  ? `${matchesTeinte} منتجات قريبة من هذه البشرة`
                  : `${matchesTeinte} produit${matchesTeinte > 1 ? "s" : ""} proche${matchesTeinte > 1 ? "s" : ""} de cette carnation`
                : locale === "ar"
                  ? "لا منتج مطابق بعد"
                  : "Aucun produit proche de cette carnation pour l'instant"}
            </p>
          )}
        </div>
      )}

      {estParfums && familles.length > 1 && (
        <div className="no-sb flex gap-[8px] overflow-x-auto pb-[2px]">
          {familles.map(([famille, count]) => {
            const on = famille === familleActive;
            return (
              <button
                key={famille}
                type="button"
                onClick={() => setFamilleActive(on ? null : famille)}
                className="flex-none rounded-[14px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
                style={{
                  background: on ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                  color: on ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                }}
              >
                {famille} · {count}
              </button>
            );
          })}
        </div>
      )}

      {estSoin && peaux.length > 0 && (
        <div className="no-sb flex gap-[8px] overflow-x-auto pb-[2px]">
          {peaux.map(([peau, count]) => {
            const on = peau === peauEffective;
            return (
              <button
                key={peau}
                type="button"
                onClick={() => setPeauActive(peau)}
                className="flex-none rounded-[14px] px-[13px] py-[7px] text-[0.65625rem] font-bold whitespace-nowrap"
                style={{
                  background: on ? "var(--theme-accent)" : "var(--theme-accent-doux)",
                  color: on ? "var(--theme-accent-texte)" : "var(--theme-accent-fort)",
                }}
              >
                {peau} · {count}
              </button>
            );
          })}
        </div>
      )}

      {estSoin && routine.length >= 2 && (
        <div className="flex flex-col gap-[10px] rounded-[18px] border border-[var(--theme-bordure)] bg-[var(--theme-surface)] p-[13px]">
          <span className="text-[0.75rem] font-bold">
            {locale === "ar" ? `روتين من ${routine.length} خطوات` : `Ma routine en ${routine.length} gestes`}
          </span>
          <div className="flex flex-col gap-[8px]">
            {routine.map(([etape, p], i) => (
              <div key={p.id} className="flex items-center gap-[10px] border-t border-[var(--theme-bordure)] pt-[8px] first:border-t-0 first:pt-0">
                <span
                  className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-full text-[0.625rem] font-bold text-[var(--theme-accent-texte)]"
                  style={{ background: "var(--theme-accent)" }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.625rem] font-bold text-[var(--theme-accent-fort)]">{etape}</p>
                  <p className="truncate text-[0.75rem] font-semibold">{p.name}</p>
                </div>
                <span className="flex-none text-[0.75rem] font-bold">{formatPrice(p.price, locale)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.625rem] text-[var(--theme-muted,var(--color-muted))] line-through">
              {formatPrice(prixRoutine, locale)}
            </span>
            <span className="text-[0.8125rem] font-bold text-[var(--theme-accent-fort)]">
              {formatPrice(prixRoutine * (1 - remiseRoutine), locale)}
            </span>
          </div>
          <button
            type="button"
            onClick={ajouterLaRoutine}
            disabled={pending}
            className="rounded-[16px] px-[16px] py-[12px] text-center text-[0.8125rem] font-semibold text-[var(--theme-accent-texte,white)] disabled:opacity-60"
            style={{ background: "var(--theme-accent,var(--color-brand-fill))" }}
          >
            {pending
              ? t.common.saving
              : locale === "ar"
                ? `أضيفوا الروتين − ${remiseRoutine * 100}%`
                : `Ajouter la routine − ${remiseRoutine * 100} %`}
          </button>
          {feedback && <p className="text-center text-[0.6875rem] font-semibold text-[var(--theme-accent-fort)]">{feedback}</p>}
        </div>
      )}

      {produitsActifs.length === 0 ? (
        <EmptyState title={locale === "ar" ? theme.emptyState.produits.ar : theme.emptyState.produits.fr} />
      ) : (
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
          {produitsActifs.map((p, i) => {
            const notes = estParfums
              ? (["note_tete", "note_coeur", "note_fond"] as const).map((c) => p.attributs?.[c]).filter(Boolean)
              : [];
            const recommande = estMaquillage && cible && i === 0 && (p.colors ?? []).length > 0;
            return (
              <div key={p.id} className="flex flex-col gap-[4px]">
                <div className="relative">
                  <ProductCard product={{ ...p, shop: null }} locale={locale} showShop={false} imageHeight={118} />
                  {recommande && (
                    <span className="absolute top-[8px] left-[8px] rounded-[10px] bg-[var(--theme-accent,var(--color-brand-fill))] px-[8px] py-[3px] text-[0.5625rem] font-bold text-[var(--theme-accent-texte,white)]">
                      {locale === "ar" ? "منصوح به" : "Conseillé"}
                    </span>
                  )}
                </div>
                {p.colors && p.colors.length > 0 && (
                  <div className="flex gap-[4px] px-[4px]">
                    {p.colors.slice(0, 5).map((c) => (
                      <span key={c} className="h-[12px] w-[12px] rounded-full border border-[var(--theme-bordure)]" style={{ background: c }} />
                    ))}
                  </div>
                )}
                {estParfums && notes.length > 0 && (
                  <div className="flex flex-col gap-[3px] px-[4px]">
                    {(["Tête", "Cœur", "Fond"] as const).map((label, idx) => {
                      const valeur = notes[idx];
                      if (!valeur) return null;
                      const largeur = ["100%", "90%", "80%"][idx];
                      return (
                        <div
                          key={label}
                          className="flex items-center justify-between gap-[6px] rounded-[8px] px-[7px] py-[3px]"
                          style={{ width: largeur, background: "var(--theme-accent-doux)" }}
                        >
                          <span className="text-[0.5rem] font-bold text-[var(--theme-accent-fort)]">{label}</span>
                          <span className="truncate text-[0.5625rem]">{valeur}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {estParfums && p.attributs?.tenue_heures && (
                  <p className="px-[4px] text-[0.625rem] font-bold text-[var(--theme-accent-fort)]">
                    {t.product.wear} {p.attributs.tenue_heures}
                  </p>
                )}
                {estSoin && p.attributs?.etape && (
                  <p className="px-[4px] text-[0.625rem] text-[var(--theme-muted,var(--color-muted))]">{p.attributs.etape}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
