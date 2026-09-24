import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyShop, getProfile } from "@/lib/queries";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/format";
import { formatCount, formatPrice, monogram, timeAgo } from "@/lib/format";
import { lireEtatBlackFriday } from "@/lib/black-friday-server";
import { Card, EmptyState, Placeholder, Tag } from "@/components/ui/primitives";
import {
  BoxIcon,
  CameraIcon,
  ChatIcon,
  ChevronRightIcon,
  GearIcon,
  GridIcon,
  ImageIcon,
  LiveDot,
  PinIcon,
  PlusIcon,
  SparkIcon,
  StoreIcon,
} from "@/components/ui/icons";
import { NewOrdersWatcher } from "@/components/vendor/new-orders-watcher";

export const metadata: Metadata = {
  title: "Ma boutique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════
   Le tableau de bord du commerçant.

   ────────────────────────────────────────────────────────────────────────
   Ce qu'il montrait, et ce qu'il montre
   ────────────────────────────────────────────────────────────────────────

   Il présentait neuf tuiles identiques marquées de deux lettres — ST, PR,
   BF, AF, HR, LO, FB, LV —, trois chiffres sans échelle, puis les commandes
   récentes. Un commerçant qui ouvre son écran ne cherche pas la liste des
   fonctions de l'application : il cherche **ce qu'il doit faire
   maintenant**.

   L'écran s'ouvre donc sur une file « à traiter », construite à partir de
   ce que la base sait déjà : commandes reçues, commandes à préparer,
   ruptures, stock faible, messages sans réponse, direct programmé,
   campagne Black Friday sans produit inscrit. Chaque ligne porte un délai
   ou une précision, et un seul bouton.

   Viennent ensuite les chiffres — sept jours d'histogramme et la
   comparaison à la semaine précédente, plutôt qu'un total sans repère —,
   puis les raccourcis en icônes, et enfin les commandes récentes.

   ────────────────────────────────────────────────────────────────────────
   Ce qui n'est pas là, et pourquoi
   ────────────────────────────────────────────────────────────────────────

   Pas d'interrupteur « mettre les commandes en pause » : `shops.is_open_now`
   est **calculé** à partir des horaires par `refresh_shops_open_state`, et
   le forcer à la main serait écrasé au passage suivant de la tâche. L'état
   du jour est donc affiché, avec le lien vers les horaires — la seule
   commande qui existe réellement.

   Pas de taux de conversion : `shops.views_count` est un compteur cumulé
   depuis l'ouverture, pas un nombre de visites sur sept jours. Le diviser
   par les commandes de la semaine donnerait un chiffre faux, et un
   commerçant prendrait des décisions dessus.
   ═══════════════════════════════════════════════════════════════════════ */

/** Trois unités ou moins : le seuil déjà utilisé par l'écran des produits. */
const SEUIL_STOCK_FAIBLE = 3;

export default async function VendorDashboard() {
  const shop = await getMyShop();
  const { t, locale } = await getT();

  if (!shop) {
    // Un administrateur en visite n'a pas de boutique à lui : le layout l'a
    // déjà laissé passer (voir src/lib/supabase/middleware.ts), donc ici on
    // ne redirige vers /vendeur/creer que pour un vrai vendeur sans boutique.
    const profile = await getProfile();
    if (profile?.role === "admin") {
      return (
        <div className="flex flex-1 items-center justify-center px-4">
          <EmptyState
            title={t.vendeur.adminNoShopTitle}
            body={t.vendeur.adminNoShopBody}
            action={
              <Link
                href="/admin/boutiques"
                className="rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-[0.8125rem] font-bold text-white"
              >
                {t.vendeur.adminNoShopAction}
              </Link>
            }
          />
        </div>
      );
    }
    redirect("/vendeur/creer");
  }
  const supabase = await createClient();

  const maintenant = new Date();
  const il7 = new Date(maintenant.getTime() - 7 * 86_400_000);
  const il14 = new Date(maintenant.getTime() - 14 * 86_400_000);
  const jourDeLaSemaine = (maintenant.getDay() + 6) % 7;

  const [
    ventes,
    commandesEnCours,
    commandesRecentes,
    produits,
    messages,
    prochainDirect,
    promotions,
    horairesDuJour,
    nbProduits,
    etatBf,
  ] = await Promise.all([
    /*
      Quatorze jours en une requête, pas deux.

      L'histogramme couvre sept jours et la tendance en compare deux : les
      demander séparément aurait fait deux allers-retours pour des lignes
      qui tiennent dans la même réponse.
    */
    supabase
      .from("orders")
      .select("total, created_at")
      .eq("shop_id", shop.id)
      .neq("status", "cancelled")
      .gte("created_at", il14.toISOString()),

    supabase
      .from("orders")
      .select("id, status")
      .eq("shop_id", shop.id)
      .in("status", ["pending", "to_prepare"]),

    supabase
      .from("orders")
      .select(
        "id, order_number, status, created_at, buyer:profiles(first_name, last_name), items:order_items(product_name, product_image, quantity)",
      )
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(4),

    // Le stock, en une lecture : la rupture et le stock faible s'en déduisent.
    supabase
      .from("products")
      .select("id, stock")
      .eq("shop_id", shop.id)
      .eq("is_draft", false)
      .lte("stock", SEUIL_STOCK_FAIBLE),

    /*
      Les messages qu'un client a envoyés et que personne n'a lus.

      `read_at` est posé à la lecture côté boutique ; un message non lu dont
      l'expéditeur n'est pas le commerçant est donc une question restée sans
      réponse. La jointure interne restreint aux conversations de la
      boutique — la policy le ferait de toute façon, mais autant le dire.
    */
    supabase
      .from("messages")
      .select("id, conversation:conversations!inner(shop_id)")
      .eq("conversation.shop_id", shop.id)
      .neq("sender_id", shop.owner_id)
      .is("read_at", null)
      .limit(50),

    supabase
      .from("lives")
      .select("id, title, scheduled_at")
      .eq("shop_id", shop.id)
      .eq("status", "scheduled")
      .gte("scheduled_at", maintenant.toISOString())
      .order("scheduled_at")
      .limit(1)
      .maybeSingle(),

    supabase
      .from("promotions")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .gt("ends_at", maintenant.toISOString()),

    supabase
      .from("shop_hours")
      .select("opens_at, closes_at, is_closed")
      .eq("shop_id", shop.id)
      .eq("weekday", jourDeLaSemaine)
      .maybeSingle(),

    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .eq("is_draft", false),

    lireEtatBlackFriday(),
  ]);

  /* ─── Les chiffres de la semaine ──────────────────────────────────── */

  const lignes = ventes.data ?? [];
  const debutSemaine = il7.getTime();

  const semaine = lignes.filter((o) => new Date(o.created_at).getTime() >= debutSemaine);
  const semainePrecedente = lignes.filter((o) => new Date(o.created_at).getTime() < debutSemaine);

  const total = (rows: typeof lignes) => rows.reduce((somme, o) => somme + Number(o.total), 0);
  const revenu = total(semaine);
  const revenuPrecedent = total(semainePrecedente);

  /*
    La tendance n'existe que s'il y a de quoi comparer.

    Passer de 0 à 40 DT n'est pas « +∞ % » : c'est une première vente, et
    l'afficher en pourcentage ne dit rien à personne.
  */
  const tendance =
    revenuPrecedent > 0 ? Math.round(((revenu - revenuPrecedent) / revenuPrecedent) * 100) : null;

  /* Sept colonnes, de la plus ancienne à aujourd'hui. */
  const jours = Array.from({ length: 7 }, (_, i) => {
    const jour = new Date(maintenant.getTime() - (6 - i) * 86_400_000);
    const debut = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate()).getTime();
    const fin = debut + 86_400_000;
    const montant = total(
      semaine.filter((o) => {
        const d = new Date(o.created_at).getTime();
        return d >= debut && d < fin;
      }),
    );
    return { montant, lettre: (t.vendor.weekdays[(jour.getDay() + 6) % 7] ?? "").slice(0, 1) };
  });
  const sommet = Math.max(...jours.map((j) => j.montant), 1);

  /* ─── La file « à traiter » ───────────────────────────────────────── */

  const enCours = commandesEnCours.data ?? [];
  const nouvelles = enCours.filter((o) => o.status === "pending").length;
  const aPreparer = enCours.filter((o) => o.status === "to_prepare").length;

  const stocks = produits.data ?? [];
  const ruptures = stocks.filter((p) => p.stock <= 0).length;
  const stockFaible = stocks.filter((p) => p.stock > 0).length;

  const sansReponse = (messages.data ?? []).length;

  const campagne = etatBf.campagne;
  const bfOuvert = Boolean(campagne && campagne.phase !== "termine");

  let offresBf = 0;
  if (bfOuvert && campagne) {
    const { count } = await supabase
      .from("black_friday_offers")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .eq("campaign_id", campagne.id);
    offresBf = count ?? 0;
  }

  const aTraiter: Array<{
    cle: string;
    titre: string;
    detail: string;
    action: string;
    href: string;
    teinte: string;
    fond: string;
    icone: React.ReactNode;
  }> = [];

  if (nouvelles > 0) {
    aTraiter.push({
      cle: "nouvelles",
      titre: format(t.vendeur.todoNewOrders, { n: nouvelles }),
      detail: t.vendeur.todoNewOrdersMeta,
      action: t.vendeur.actPrepare,
      href: "/vendeur/commandes",
      teinte: "var(--color-live)",
      fond: "var(--color-live-tint)",
      icone: <BoxIcon size={17} />,
    });
  }

  if (aPreparer > 0) {
    aTraiter.push({
      cle: "preparer",
      titre: format(t.vendeur.todoPrepare, { n: aPreparer }),
      detail: t.vendeur.todoPrepareMeta,
      action: t.vendeur.actSee,
      href: "/vendeur/commandes",
      teinte: "var(--color-brand)",
      fond: "var(--color-brand-tint)",
      icone: <BoxIcon size={17} />,
    });
  }

  if (ruptures > 0) {
    aTraiter.push({
      cle: "ruptures",
      titre: format(t.vendeur.todoOut, { n: ruptures }),
      detail: t.vendeur.todoOutMeta,
      action: t.vendeur.actRestock,
      href: "/vendeur/produits?filtre=stock-faible",
      teinte: "var(--color-live)",
      fond: "var(--color-live-tint)",
      icone: <GridIcon size={17} />,
    });
  }

  if (stockFaible > 0) {
    aTraiter.push({
      cle: "stock",
      titre: format(t.vendeur.todoLow, { n: stockFaible }),
      detail: t.vendeur.todoLowMeta,
      action: t.vendeur.actRestock,
      href: "/vendeur/produits?filtre=stock-faible",
      teinte: "var(--color-brand)",
      fond: "var(--color-brand-tint)",
      icone: <GridIcon size={17} />,
    });
  }

  if (sansReponse > 0) {
    aTraiter.push({
      cle: "messages",
      titre: format(t.vendeur.todoMessages, { n: sansReponse }),
      detail: t.vendeur.todoMessagesMeta,
      action: t.vendeur.actReply,
      href: "/messages",
      teinte: "var(--color-brand)",
      fond: "var(--color-brand-tint)",
      icone: <ChatIcon size={17} />,
    });
  }

  if (prochainDirect.data?.scheduled_at) {
    aTraiter.push({
      cle: "direct",
      titre: format(t.vendeur.todoLive, {
        when: timeAgo(prochainDirect.data.scheduled_at, locale),
      }),
      detail: t.vendeur.todoLiveMeta,
      action: t.vendeur.actOpen,
      href: "/vendeur/lives",
      teinte: "var(--color-brand)",
      fond: "var(--color-brand-tint)",
      icone: <LiveDot size={9} />,
    });
  }

  if (bfOuvert && offresBf === 0) {
    aTraiter.push({
      cle: "bf",
      titre: t.vendeur.todoBf,
      detail: t.vendeur.todoBfMeta,
      action: t.vendeur.actJoin,
      href: "/vendeur/black-friday",
      teinte: "var(--color-ink)",
      fond: "var(--color-field)",
      icone: <SparkIcon size={17} />,
    });
  }

  /* ─── Le profil de la boutique ────────────────────────────────────── */

  const etapes = [
    { fait: Boolean(shop.logo_url), libelle: t.vendeur.setupLogo, href: "/vendeur/reglages#identite" },
    { fait: Boolean(shop.banner_url), libelle: t.vendeur.setupBanner, href: "/vendeur/reglages#identite" },
    { fait: Boolean(shop.description), libelle: t.vendeur.setupDescription, href: "/vendeur/reglages#identite" },
    { fait: (nbProduits.count ?? 0) >= 5, libelle: t.vendeur.setupProducts, href: "/vendeur/produits/nouveau" },
    { fait: Boolean(horairesDuJour.data), libelle: t.vendeur.setupHours, href: "/vendeur/reglages#horaires" },
    {
      fait: shop.mall_level !== null && Boolean(shop.mall_unit),
      libelle: t.vendeur.setupLocation,
      href: "/vendeur/reglages#localisation",
    },
  ];
  const faites = etapes.filter((e) => e.fait).length;
  const pourcentage = Math.round((faites / etapes.length) * 100);
  const restantes = etapes.filter((e) => !e.fait);

  /* ─── Les horaires du jour ────────────────────────────────────────── */

  const h = horairesDuJour.data;
  const horaireTexte = !h
    ? t.vendeur.hoursMissing
    : h.is_closed || !h.opens_at || !h.closes_at
      ? t.vendeur.hoursClosedToday
      : format(t.vendeur.hoursToday, { hours: `${h.opens_at.slice(0, 5)} – ${h.closes_at.slice(0, 5)}` });

  const categorie = locale === "ar" ? shop.category?.name_ar : shop.category?.name_fr;
  const emplacement =
    shop.mall_level !== null && shop.mall_unit ? `${t.vendeur.level} ${shop.mall_level} · ${shop.mall_unit}` : null;

  return (
    <>
      {/*
        ═══ L'en-tête de la boutique ═══════════════════════════════════

        La bannière occupait le quart supérieur de l'écran pour une image que
        le commerçant a déjà choisie et que ses clients voient ailleurs. À sa
        place : qui l'on est, où l'on est dans le mall, si l'on est ouvert —
        et le lien vers les réglages. La carte d'état chevauche le bas du
        panneau, à la manière de l'accueil client.
      */}
      <header className="relative flex-none overflow-hidden rounded-b-[30px] bg-[image:var(--gradient-brand)] px-4 pt-[16px] pb-[36px] text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-[70px] -end-[60px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_65%)]"
        />

        <div className="relative flex items-center gap-3">
          <span className="relative h-[46px] w-[46px] flex-none overflow-hidden rounded-[14px] bg-white/15 ring-2 ring-white/30">
            {shop.logo_url ? (
              <Image src={shop.logo_url} alt="" fill sizes="46px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[0.875rem] font-bold text-white">
                {monogram(shop.name)}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.125rem] leading-[1.1] font-extrabold tracking-[-0.02em]">
              {shop.name}
            </h1>
            <p className="mt-1 truncate text-[0.65625rem] text-white/70">
              {[categorie, emplacement].filter(Boolean).join(" · ") || t.vendor.myShop}
            </p>
          </div>

          <Link
            href="/vendeur/reglages"
            aria-label={t.nav.settings}
            className="press flex h-11 w-11 flex-none items-center justify-center rounded-full border border-white/25 bg-white/15 text-white"
          >
            <GearIcon size={18} />
          </Link>
        </div>
      </header>

      {/*
        L'état du jour, à cheval sur le panneau.

        `is_open_now` est calculé par la tâche qui relit les horaires : cette
        carte le rapporte et mène aux horaires, elle ne prétend pas les
        remplacer.
      */}
      <div className="relative z-10 -mt-[22px] flex-none px-4">
        <Link
          href="/vendeur/reglages#horaires"
          className="press flex min-h-[58px] items-center gap-[11px] rounded-[18px] bg-[var(--color-surface-solid)] px-[14px] py-[12px] shadow-[0_8px_22px_rgba(36,31,46,0.18)]"
        >
          <span
            aria-hidden
            className="animate-live-dot h-[10px] w-[10px] flex-none rounded-full"
            style={{ background: shop.is_open_now ? "var(--color-success)" : "var(--color-faint)" }}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8125rem] font-bold text-[var(--color-ink)]">
              {shop.is_open_now ? t.vendeur.openNow : t.vendeur.closedNow}
            </span>
            <span className="mt-[3px] block truncate text-[0.65625rem] text-[var(--color-muted)]">
              {horaireTexte}
            </span>
          </span>
          <span className="flex-none text-[0.6875rem] font-bold text-[var(--color-brand)]">
            {t.vendeur.hoursEdit}
          </span>
        </Link>
      </div>

      <div className="no-sb flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-5 pb-5">
        {/*
          Une commande qui arrive pendant qu'on regarde l'écran.

          La notification poussée couvre l'application fermée ; elle ne
          s'affiche justement pas quand l'écran est au premier plan.
        */}
        <NewOrdersWatcher shopId={shop.id} />

        {/* ─── 1 · À traiter ──────────────────────────────────────────── */}
        <section className="flex flex-col gap-[10px]">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="animate-live-dot h-[9px] w-[9px] flex-none rounded-full bg-[var(--color-live)]"
            />
            <h2 className="text-[0.9375rem] leading-none font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
              {t.vendeur.todo}
            </h2>
            {aTraiter.length > 0 && (
              <span className="ms-auto rounded-full bg-[var(--color-live-tint)] px-[9px] py-1 text-[0.59375rem] font-bold text-[var(--color-live)]">
                {format(t.vendeur.todoCount, { n: aTraiter.length })}
              </span>
            )}
          </div>

          {aTraiter.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[var(--color-outline)] bg-[var(--color-surface)] p-[18px] text-center">
              <p className="text-[0.78125rem] font-bold text-[var(--color-ink)]">{t.vendeur.todoEmpty}</p>
              <p className="mt-[5px] text-[0.6875rem] leading-[1.5] text-[var(--color-muted)]">
                {t.vendeur.todoEmptyBody}
              </p>
            </div>
          ) : (
            aTraiter.map((ligne) => (
              <div
                key={ligne.cle}
                className="flex items-center gap-[11px] rounded-[18px] bg-[var(--color-surface-solid)] p-[12px_13px] shadow-[0_6px_18px_rgba(60,40,90,0.08)]"
                style={{ borderInlineStart: `4px solid ${ligne.teinte}` }}
              >
                <span
                  aria-hidden
                  className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[13px]"
                  style={{ background: ligne.fond, color: ligne.teinte }}
                >
                  {ligne.icone}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.78125rem] leading-[1.25] font-bold text-[var(--color-ink)]">
                    {ligne.titre}
                  </p>
                  <p className="mt-[4px] text-[0.65625rem] leading-[1.35]" style={{ color: ligne.teinte }}>
                    {ligne.detail}
                  </p>
                </div>

                <Link
                  href={ligne.href}
                  className="press flex min-h-11 flex-none items-center rounded-full px-[14px] text-[0.65625rem] font-bold text-white"
                  style={{ background: ligne.teinte }}
                >
                  {ligne.action}
                </Link>
              </div>
            ))
          )}
        </section>

        {/*
          Voir sa vitrine telle que les clients la voient. Le lien n'apparaît
          qu'une fois la boutique approuvée : `/boutique/[slug]` répond 404
          pour toute autre boutique, y compris auprès de son propriétaire.
        */}
        {shop.status === "approved" && (
          <Link
            href={`/boutique/${shop.slug}`}
            className="press flex flex-none items-center gap-[11px] rounded-[18px] border border-[var(--color-surface-edge)] bg-[var(--color-surface)] p-[13px_14px] shadow-[var(--shadow-card)]"
          >
            <StoreIcon size={17} className="flex-none text-[var(--color-brand)]" />
            <span className="flex-1 text-[0.78125rem] font-bold text-[var(--color-ink)]">
              {t.account.viewMyShop}
            </span>
            <ChevronRightIcon size={15} className="flex-none text-[var(--color-faint)]" />
          </Link>
        )}

        {/* ─── 2 · Sept derniers jours ────────────────────────────────── */}
        <section className="flex flex-col gap-[10px]">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-[9px] w-[9px] flex-none rounded-full bg-[var(--color-brand)]" />
            <h2 className="text-[0.9375rem] leading-none font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
              {t.vendeur.week}
            </h2>
            {tendance !== null && (
              <span className="ms-auto text-[0.65625rem] font-semibold text-[var(--color-muted)]">
                {t.vendeur.vsLastWeek}
              </span>
            )}
          </div>

          <div className="rounded-[20px] bg-[var(--color-surface-solid)] p-4 shadow-[0_6px_18px_rgba(60,40,90,0.08)]">
            <div className="flex items-end gap-[10px]">
              <div className="min-w-0 flex-1">
                <p className="text-[1.5rem] leading-none font-extrabold tracking-[-0.03em] text-[var(--color-ink)]">
                  {formatPrice(revenu, locale)}
                </p>
                <p className="mt-[5px] text-[0.65625rem] font-semibold text-[var(--color-muted)]">
                  {t.vendor.sales7d}
                </p>
              </div>
              {tendance !== null && (
                <span
                  dir="ltr"
                  className="flex-none rounded-full px-[10px] py-[7px] text-[0.6875rem] font-bold"
                  style={{
                    background: tendance >= 0 ? "#dcefe5" : "var(--color-live-tint)",
                    color: tendance >= 0 ? "#1c6244" : "var(--color-live)",
                  }}
                >
                  {tendance >= 0 ? "+" : "−"}
                  {Math.abs(tendance)} %
                </span>
              )}
            </div>

            {/*
              Sept colonnes, à l'échelle du meilleur jour.

              Un histogramme sans échelle commune ne se lit pas : chaque
              barre est donc une fraction du sommet de la semaine, et le jour
              le plus fort porte la couleur pleine.
            */}
            <div className="mt-[14px] flex h-[58px] items-end gap-[5px]" aria-hidden>
              {jours.map((jour, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-[6px]">
                  <span
                    className="block w-full rounded-t-[6px] rounded-b-[3px]"
                    style={{
                      height: `${Math.max(10, Math.round((jour.montant / sommet) * 44))}px`,
                      background:
                        jour.montant === sommet && jour.montant > 0
                          ? "var(--color-brand-fill)"
                          : "var(--color-brand-tint)",
                    }}
                  />
                  <span className="text-[0.53125rem] font-semibold text-[var(--color-faint)]">
                    {jour.lettre}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-[14px] flex gap-[9px] border-t border-[var(--color-hairline)] pt-[13px]">
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] leading-none font-extrabold tracking-[-0.02em] text-[var(--color-ink)]">
                  {semaine.length}
                </p>
                <p className="mt-[4px] text-[0.59375rem] font-semibold text-[var(--color-muted)]">
                  {t.vendeur.ordersWeek}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] leading-none font-extrabold tracking-[-0.02em] text-[var(--color-ink)]">
                  {formatCount(shop.views_count)}
                </p>
                <p className="mt-[4px] text-[0.59375rem] font-semibold text-[var(--color-muted)]">
                  {t.vendeur.visitsTotal}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] leading-none font-extrabold tracking-[-0.02em] text-[var(--color-ink)]">
                  {stocks.length}
                </p>
                <p className="mt-[4px] text-[0.59375rem] font-semibold text-[var(--color-muted)]">
                  {t.vendeur.stockLowLabel}
                </p>
              </div>
            </div>

            {revenu === 0 && (
              <p className="mt-[13px] rounded-[14px] bg-[var(--color-brand-tint)] px-3 py-[11px] text-[0.6875rem] leading-[1.5] text-[var(--color-ink)]">
                {t.vendeur.noSales}
              </p>
            )}
          </div>
        </section>

        {/* ─── 3 · Prochain direct ────────────────────────────────────── */}
        <section className="flex flex-col gap-[10px]">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-[9px] w-[9px] flex-none rounded-full bg-[var(--color-live)]" />
            <h2 className="text-[0.9375rem] leading-none font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
              {t.vendeur.nextLive}
            </h2>
          </div>

          <div className="rounded-[20px] bg-[var(--color-surface-solid)] p-4 shadow-[0_6px_18px_rgba(60,40,90,0.08)]">
            <div className="flex items-center gap-[11px]">
              <span
                aria-hidden
                className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-[var(--color-live-tint)]"
              >
                <LiveDot size={10} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.78125rem] leading-[1.25] font-bold text-[var(--color-ink)]">
                  {prochainDirect.data?.scheduled_at
                    ? prochainDirect.data.title
                    : format(t.vendor.liveTipTitle, { slot: t.vendeur.liveSlot })}
                </p>
                <p className="mt-[4px] text-[0.65625rem] text-[var(--color-muted)]">
                  {prochainDirect.data?.scheduled_at
                    ? `${t.vendeur.liveOn} · ${timeAgo(prochainDirect.data.scheduled_at, locale)}`
                    : format(t.vendor.liveTipBody, { pct: 68 })}
                </p>
              </div>
            </div>

            <div className="mt-[13px] flex gap-2">
              <Link
                href={prochainDirect.data ? "/vendeur/lives" : "/vendeur/lives/nouveau"}
                className="press flex min-h-11 flex-1 items-center justify-center rounded-full bg-[var(--color-brand-fill)] text-[0.6875rem] font-bold text-white"
              >
                {prochainDirect.data ? t.vendeur.actOpen : t.vendor.schedule}
              </Link>
              <Link
                href="/vendeur/lives"
                className="press flex min-h-11 flex-none items-center justify-center rounded-full border border-[var(--color-outline)] bg-[var(--color-surface-solid)] px-[14px] text-[0.6875rem] font-bold text-[var(--color-ink)]"
              >
                {t.nav.lives}
              </Link>
            </div>
          </div>
        </section>

        {/* ─── 4 · Raccourcis ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-[10px]">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-[9px] w-[9px] flex-none rounded-full"
              style={{ background: "oklch(0.47 0.12 300)" }}
            />
            <h2 className="text-[0.9375rem] leading-none font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
              {t.vendeur.shortcuts}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-[10px]">
            <Raccourci
              href="/vendeur/produits/nouveau"
              icone={<PlusIcon size={19} />}
              titre={t.vendor.addProduct}
              detail={t.vendeur.addProductHint}
              plein
            />
            <Raccourci
              href="/vendeur/produits"
              icone={<GridIcon size={19} />}
              titre={t.vendor.manageStock}
              detail={
                stocks.length > 0 ? format(t.vendeur.stockLowShort, { n: stocks.length }) : t.vendeur.stockOk
              }
              alerte={stocks.length > 0}
            />
            <Raccourci
              href="/vendeur/promotions"
              icone={<SparkIcon size={19} />}
              titre={t.vendor.promotions}
              detail={
                (promotions.count ?? 0) > 0
                  ? format(t.vendeur.promosActive, { n: promotions.count ?? 0 })
                  : t.vendeur.promosNone
              }
            />
            <Raccourci
              href="/vendeur/affiche"
              icone={<ImageIcon size={19} />}
              titre={t.vendor.poster}
              detail={t.vendeur.posterHint}
            />
          </div>
        </section>

        {/*
          ─── 5 · Les autres actions ─────────────────────────────────

          Elles étaient sur la même grille que « Ajouter un produit », sous
          des initiales. Elles ne disparaissent pas — on y va rarement, mais
          on doit pouvoir y aller — elles passent simplement en second rang,
          en toutes lettres.
        */}
        <section className="flex flex-col gap-[10px]">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-[9px] w-[9px] flex-none rounded-full"
              style={{ background: "oklch(0.47 0.12 165)" }}
            />
            <h2 className="text-[0.9375rem] leading-none font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
              {t.vendeur.otherActions}
            </h2>
          </div>

          <div className="overflow-hidden rounded-[18px] bg-[var(--color-surface-solid)] shadow-[0_6px_18px_rgba(60,40,90,0.08)]">
            <LigneAction
              href="/vendeur/black-friday"
              icone={<SparkIcon size={16} />}
              libelle={t.bf.title}
              valeur={bfOuvert ? format(t.vendeur.promosActive, { n: offresBf }) : undefined}
            />
            <LigneAction
              href="/vendeur/lives/nouveau"
              icone={<LiveDot size={9} />}
              libelle={t.vendor.startLive}
            />
            <LigneAction
              href="/vendeur/lives/partage"
              icone={<CameraIcon size={16} />}
              libelle={t.vendeur.facebookRelay}
            />
            <LigneAction
              href="/vendeur/reglages#horaires"
              icone={<BoxIcon size={16} />}
              libelle={t.vendor.hours}
            />
            <LigneAction
              href="/vendeur/reglages#localisation"
              icone={<PinIcon size={16} />}
              libelle={t.vendor.location}
              valeur={emplacement ?? undefined}
              dernier
            />
          </div>
        </section>

        {/* ─── 6 · Profil de boutique ─────────────────────────────────── */}
        <section className="rounded-[20px] bg-[var(--color-surface-solid)] p-4 shadow-[0_6px_18px_rgba(60,40,90,0.08)]">
          <p className="text-[0.84375rem] leading-[1.2] font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
            {format(t.vendeur.setup, { pct: pourcentage })}
          </p>
          <p className="mt-[5px] text-[0.65625rem] leading-[1.45] text-[var(--color-muted)]">
            {restantes.length === 0 ? t.vendeur.setupDone : t.vendeur.setupBody}
          </p>

          <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[var(--color-track)]">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-fill),var(--color-live-fill))]"
              style={{ width: `${pourcentage}%` }}
            />
          </div>

          {restantes.length > 0 && (
            <div className="mt-[6px]">
              {restantes.map((etape) => (
                <Link
                  key={etape.libelle}
                  href={etape.href}
                  className="flex min-h-11 items-center gap-[11px] border-t border-[var(--color-hairline)] py-[10px]"
                >
                  <span
                    aria-hidden
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.625rem] font-bold text-[var(--color-brand)]"
                  >
                    +
                  </span>
                  <span className="min-w-0 flex-1 text-[0.71875rem] font-semibold text-[var(--color-ink)]">
                    {etape.libelle}
                  </span>
                  <span className="flex-none text-[0.65625rem] font-bold text-[var(--color-brand)]">
                    {t.vendeur.setupAdd}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ─── 7 · Commandes récentes ─────────────────────────────────── */}
        <section className="flex flex-col gap-[10px]">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-[9px] w-[9px] flex-none rounded-full"
              style={{ background: "oklch(0.47 0.12 40)" }}
            />
            <h2 className="text-[0.9375rem] leading-none font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">
              {t.vendor.recentOrders}
            </h2>
            <Link
              href="/vendeur/commandes"
              className="ms-auto text-[0.6875rem] font-bold text-[var(--color-brand)]"
            >
              {t.common.seeAll} →
            </Link>
          </div>

          {(commandesRecentes.data ?? []).length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--color-muted)]">{t.orders.empty}</p>
          ) : (
            commandesRecentes.data!.map((order) => {
              const first = order.items?.[0];
              return (
                <Link key={order.id} href="/vendeur/commandes">
                  <Card className="flex items-center gap-[10px] p-[11px]">
                    {first?.product_image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniature fixe 38px
                      <img
                        src={first.product_image}
                        alt=""
                        className="h-[38px] w-[38px] flex-none rounded-[14px] object-cover"
                      />
                    ) : (
                      <Placeholder className="h-[38px] w-[38px] flex-none" rounded="thumb" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.71875rem] font-semibold text-[var(--color-ink)]">
                        {first ? `${first.product_name} × ${first.quantity}` : order.order_number}
                      </p>
                      <p className="truncate text-[0.625rem] text-[var(--color-muted)]">
                        {order.buyer?.first_name} {order.buyer?.last_name?.[0]}. ·{" "}
                        {timeAgo(order.created_at, locale)}
                      </p>
                    </div>

                    <Tag tone={order.status === "delivered" ? "outline" : "tinted"}>
                      {t.orders.status[order.status]}
                    </Tag>
                  </Card>
                </Link>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}

/**
 * Un raccourci, en carré de quatre-vingt-seize pixels.
 *
 * L'icône en haut, le libellé en bas, et une seconde ligne qui dit l'état —
 * « Stock faible (2) », « 1 active ». C'est cette ligne qui distingue un
 * raccourci d'un bouton : on sait s'il y a quelque chose à y faire avant de
 * l'ouvrir.
 */
function Raccourci({
  href,
  icone,
  titre,
  detail,
  plein = false,
  alerte = false,
}: {
  href: string;
  icone: React.ReactNode;
  titre: string;
  detail: string;
  /** L'action principale : pleine couleur. */
  plein?: boolean;
  /** Le détail passe en rouge quand il appelle une action. */
  alerte?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`press flex min-h-[96px] flex-col justify-between rounded-[18px] p-[14px] ${
        plein
          ? "bg-[var(--color-brand-fill)] text-white shadow-[0_8px_20px_rgba(109,75,143,0.26)]"
          : "border border-[var(--color-surface-edge)] bg-[var(--color-surface-solid)] shadow-[0_6px_18px_rgba(60,40,90,0.08)]"
      }`}
    >
      <span aria-hidden className={plein ? "text-white" : "text-[var(--color-brand)]"}>
        {icone}
      </span>
      <span>
        <span
          className={`block text-[0.8125rem] leading-[1.2] font-extrabold ${
            plein ? "text-white" : "text-[var(--color-ink)]"
          }`}
        >
          {titre}
        </span>
        <span
          className="mt-[4px] block text-[0.625rem] leading-[1.2] font-semibold"
          style={{
            color: plein
              ? "rgba(255,255,255,0.72)"
              : alerte
                ? "var(--color-live)"
                : "var(--color-muted)",
          }}
        >
          {detail}
        </span>
      </span>
    </Link>
  );
}

/** Une ligne de la liste des actions secondaires. */
function LigneAction({
  href,
  icone,
  libelle,
  valeur,
  dernier = false,
}: {
  href: string;
  icone: React.ReactNode;
  libelle: string;
  valeur?: string;
  dernier?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 items-center gap-3 px-[14px] py-[12px] ${
        dernier ? "" : "border-b border-[var(--color-hairline)]"
      }`}
    >
      <span
        aria-hidden
        className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px] bg-[var(--color-brand-tint)] text-[var(--color-brand)]"
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.75rem] font-bold text-[var(--color-ink)]">
        {libelle}
      </span>
      {valeur && (
        <span className="flex-none truncate text-[0.65625rem] text-[var(--color-muted)]">{valeur}</span>
      )}
      <ChevronRightIcon size={14} className="flex-none text-[var(--color-faint)]" />
    </Link>
  );
}
