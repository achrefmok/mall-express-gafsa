"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { format } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";
import { addToCart } from "@/app/actions/cart";
import { cx, formatPrice } from "@/lib/format";
import { Placeholder } from "@/components/ui/primitives";
import { CartIcon } from "@/components/ui/icons";

export interface LiveProduct {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
  stock: number;
}

/**
 * La boutique du direct : tous les articles présentés, achetables sans quitter
 * l'écran.
 *
 * Le produit épinglé garde sa carte au-dessus de la vidéo — c'est celui dont le
 * vendeur parle à l'instant. Cette feuille porte le reste, que le spectateur
 * consulte à son rythme pendant qu'il regarde.
 *
 * Elle est fermée par défaut et ne recouvre jamais toute la hauteur : le direct
 * reste visible au-dessus, ce qui est le but même d'acheter pendant qu'on
 * regarde. La refermer d'un geste ramène au direct.
 */
export function LiveProducts({
  liveId,
  initialProducts,
  percentOff,
  canBuy,
  initialCartCount,
}: {
  liveId: string;
  initialProducts: LiveProduct[];
  percentOff: number | null;
  canBuy: boolean;
  initialCartCount: number;
}) {
  const { t, locale } = useI18n();
  const [products, setProducts] = useState(initialProducts);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(initialCartCount);
  const [pending, startTransition] = useTransition();

  /*
    Un article ajouté pendant la diffusion doit apparaître ici sans
    rechargement : c'est tout l'intérêt de le présenter pendant qu'on en parle.
    La table est publiée en temps réel pour cette seule raison.

    On recharge la liste entière plutôt que d'insérer la ligne reçue : la
    notification ne porte que la liaison, pas l'article, et une seconde requête
    au moment d'un ajout coûte moins qu'un état à moitié rempli.
  */
  useEffect(() => {
    const supabase = createClient();

    const reload = async () => {
      const { data } = await supabase
        .from("live_products")
        .select("position, product:products(id, name, price, images, stock, is_online, is_draft)")
        .eq("live_id", liveId)
        .order("position");

      const fresh = (data ?? [])
        .map((row) => row.product)
        .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.is_online && !p!.is_draft)
        .map(({ id, name, price, images, stock }) => ({ id, name, price, images, stock }));

      setProducts(fresh);
    };

    const channel = supabase
      .channel(`live-products:${liveId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_products", filter: `live_id=eq.${liveId}` },
        () => void reload(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveId]);

  function onAdd(productId: string) {
    startTransition(async () => {
      const result = await addToCart({ productId, quantity: 1 });
      if (!result.ok) return;

      /*
        La pastille avance tout de suite, sans attendre de relire la base : le
        spectateur regarde une vidéo, une page qui se recharge lui coûterait le
        direct. `addToCart` a déjà confirmé l'écriture — le compte local ne peut
        pas diverger tant qu'on reste sur cet écran.
      */
      setCartCount((n) => n + 1);
      setAdded(productId);
      setTimeout(() => setAdded(null), 1800);
    });
  }

  if (products.length === 0) return null;

  return (
    <>
      {/*
        Déclencheur, posé juste au-dessus de la colonne « aimer / commenter /
        partager » : même gouttière, même largeur, à portée de pouce. Le placer
        dans la colonne elle-même l'aurait mêlé à des gestes sociaux, alors
        qu'acheter est d'une autre nature.
      */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="absolute bottom-[162px] end-[14px] z-30 flex w-[52px] flex-col items-center"
      >
        <span className="relative">
          <CartIcon size={21} />
          {cartCount > 0 && (
            <span className="absolute -end-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-live)] px-1 text-[9px] font-bold text-white">
              {cartCount}
            </span>
          )}
        </span>
        <span className="text-[9px]">
          {t.live.products} · {products.length}
        </span>
      </button>

      {open && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-40 flex max-h-[52%] flex-col rounded-t-[18px] bg-[var(--color-app)]">
          <div className="flex flex-none items-center justify-between px-4 pt-3 pb-2">
            <p className="text-[12.5px] font-bold text-[var(--color-ink)]">
              {t.live.products} · {products.length}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[10px] px-2 py-1 text-[11px] font-semibold text-[var(--color-muted)]"
            >
              {t.common.close}
            </button>
          </div>

          <div className="no-sb flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
            {products.map((product) => {
              const price = percentOff ? product.price * (1 - percentOff / 100) : product.price;
              const soldOut = product.stock <= 0;

              return (
                <div
                  key={product.id}
                  className="flex items-center gap-[10px] rounded-[14px] bg-white p-[10px]"
                >
                  {product.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniature 44px, hors flux Next/Image pour ne pas retarder la vidéo
                    <img
                      src={product.images[0]}
                      alt=""
                      className="h-11 w-11 flex-none rounded-[14px] object-cover"
                    />
                  ) : (
                    <Placeholder className="h-11 w-11 flex-none" rounded="tile" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold text-[var(--color-ink)]">
                      {product.name}
                    </p>
                    <p className="text-[12px] font-bold text-[var(--color-brand)]">
                      {formatPrice(price, locale)}
                      {percentOff ? (
                        <span className="ms-[6px] text-[10px] font-normal text-[var(--color-faint)] line-through">
                          {formatPrice(product.price, locale)}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[9.5px] text-[var(--color-muted)]">
                      {soldOut ? t.product.outOfStock : format(t.live.inStock, { n: product.stock })}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAdd(product.id)}
                    disabled={!canBuy || soldOut || pending}
                    className={cx(
                      "flex-none rounded-[14px] px-3 py-[7px] text-[10px] font-semibold text-white disabled:opacity-55",
                      added === product.id ? "bg-[var(--color-ok,#2f7d5d)]" : "bg-[var(--color-brand)]",
                    )}
                  >
                    {soldOut
                      ? t.product.outOfStock
                      : added === product.id
                        ? t.live.addedToCart
                        : t.product.addToCart}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
