/**
 * Types de la base Supabase.
 *
 * Écrits à la main pour correspondre à supabase/migrations/*.sql.
 * Après toute migration, régénérer plutôt que corriger à la main :
 *   npm run db:types      (nécessite `supabase link --project-ref <ref>`)
 *
 * Le bloc `Relationships` de chaque table n'est pas décoratif : c'est lui qui
 * permet à supabase-js de typer les jointures imbriquées
 * (`select("*, shop:shops(name)")`). Sans lui, ces requêtes retournent
 * `never`. Chaque entrée doit refléter une vraie contrainte de clé étrangère.
 */

/* Les métiers du SOS vivent dans `src/lib/sos.ts`, à côté de la liste que
   l'interface propose : les redéclarer ici les aurait laissés diverger. */
import type { SosTrade } from "@/lib/sos";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "client" | "vendor" | "admin";
export type ShopStatus = "pending" | "approved" | "rejected" | "suspended";
export type OrderStatus = "pending" | "to_prepare" | "ready" | "shipped" | "delivered" | "cancelled";
export type PaymentMethod = "cod" | "call" | "online";
export type DeliveryMethod = "delivery" | "pickup";
export type LiveStatus = "scheduled" | "live" | "ended" | "cancelled";
export type LiveSource = "camera" | "facebook" | "hls";
export type DealStatus = "active" | "expired" | "removed";
export type ReportTarget = "deal" | "product" | "shop" | "deal_comment" | "live_comment" | "user";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type CityInfoKind = "works" | "transport" | "admin_procedure";
export type AlertSeverity = "info" | "warning" | "critical";
export type PracticalServiceKind = "taxi" | "louage" | "prayer" | "pharmacy";
export type ServiceRequestKind = "bill_payment" | "complaint";
export type ServiceRequestStatus = "submitted" | "in_review" | "resolved" | "rejected";
export type AppLocale = "fr" | "ar";

/**
 * Photo rattachée à une couleur de produit.
 *
 * `generated` sépare une vraie photo du vendeur d'une teinte fabriquée à
 * partir d'une autre. Le client doit pouvoir faire la différence, et une
 * fabriquée doit toujours céder la place à une vraie.
 */
export interface VariantImage {
  /** Vue principale de la couleur. Toujours la première de `images`. */
  url: string;
  generated: boolean;
  /**
   * Les autres vues de cette couleur — dos, côté, porté.
   *
   * Absent sur les variantes d'origine, qui n'en portaient qu'une. Le champ est
   * facultatif : `url` reste la source de vérité pour la vue principale, et
   * rien ne casse sur les enregistrements écrits avant son apparition. Le
   * document est en JSONB, la forme n'a donc pas de migration à subir.
   */
  images?: string[];
  /**
   * Adresse de la photo dont l'image a été fabriquée. Absent sur une vraie
   * photo du vendeur.
   *
   * C'est bien l'adresse et non le coloris d'origine : elle sert à savoir si
   * l'image dérivée est encore d'actualité. Le vendeur qui remplace la photo du
   * produit périme ainsi toutes les dérivées d'un coup, sans qu'on ait à les
   * effacer une à une.
   */
  from?: string;
  /** Date de fabrication, pour repérer les images devenues obsolètes. */
  at?: string;
}

/** Clé : la couleur telle qu'elle figure dans `products.colors`. */
export type VariantImages = Record<string, VariantImage>;
/**
 * L'état qu'un chauffeur déclare.
 *
 * Quatre valeurs, dont une que le modèle binaire d'origine ne savait pas dire :
 * `places` — en course, mais il reste des sièges. C'est le fonctionnement
 * ordinaire d'un louage, et le chauffeur devait jusqu'ici choisir entre se
 * déclarer libre, ce qui était faux, et occupé, ce qui lui coûtait des clients.
 *
 * `hors_ligne` est un retrait volontaire. Ce n'est pas ce que devient un
 * chauffeur qui ferme l'application : le statut est tenu par le serveur et ne
 * dépend d'aucune horloge de session.
 */
export type TaxiStatus = "libre" | "places" | "occupe" | "hors_ligne";

/**
 * Le cycle d'une demande de course.
 *
 * `expiree` n'est pas un échec du chauffeur : il conduisait. C'est un état
 * terminal comme un autre, qui existe pour qu'une demande sans réponse cesse
 * d'un elle-même plutôt que de laisser un client attendre.
 */
export type TaxiRequestStatus =
  | "en_attente"
  | "acceptee"
  | "refusee"
  | "expiree"
  | "annulee";

export type NotificationKind =
  | "order_update"
  | "live_starting"
  | "deal_verified"
  | "shop_approved"
  | "shop_rejected"
  | "new_message"
  | "loyalty"
  | "city_alert"
  | "referral"
  /* Une course demandée, acceptée ou refusée. C'est le seul genre qui doive
     atteindre quelqu'un dont l'application est fermée : un chauffeur au volant
     n'ouvre pas l'écran pour vérifier s'il a du travail. */
  | "taxi_request";

/** Forme d'une entrée de `Relationships`. */
type FK<Name extends string, Cols extends string[], Ref extends string> = {
  foreignKeyName: Name;
  columns: Cols;
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export interface Database {
  public: {
    Tables: {
      /* ─── profiles ───────────────────────────────────────────────── */
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          city: string | null;
          avatar_url: string | null;
          bio: string | null;
          locale: AppLocale;
          text_scale: number;
          simplified_mode: boolean;
          loyalty_points: number;
          referral_code: string | null;
          referred_by: string | null;
          is_banned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string } & Partial<Omit<Database["public"]["Tables"]["profiles"]["Row"], "id">>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [
          FK<"profiles_referred_by_fkey", ["referred_by"], "profiles">,
          FK<"shops_owner_id_fkey", ["id"], "shops">,
        ];
      };

      /* ─── categories ─────────────────────────────────────────────── */
      categories: {
        Row: {
          id: string;
          slug: string;
          name_fr: string;
          name_ar: string;
          hue: number;
          monogram: string;
          image_url: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name_fr: string;
          name_ar: string;
          hue: number;
          monogram: string;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [FK<"categories_parent_id_fkey", ["parent_id"], "categories">];
      };

      /* ─── shops ──────────────────────────────────────────────────── */
      shops: {
        Row: {
          id: string;
          owner_id: string;
          slug: string;
          name: string;
          name_ar: string | null;
          description: string | null;
          description_ar: string | null;
          category_id: string | null;
          logo_url: string | null;
          cover_url: string | null;
          banner_url: string | null;
          mall_level: number | null;
          mall_unit: string | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          phone: string | null;
          status: ShopStatus;
          rejection_reason: string | null;
          missing_document: string | null;
          submitted_at: string;
          approved_at: string | null;
          approved_by: string | null;
          delivers_in_gafsa: boolean;
          pickup_in_store: boolean;
          is_open_now: boolean;
          is_featured: boolean;
          rating_sum: number;
          rating_count: number;
          followers_count: number;
          posts_count: number;
          views_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { owner_id: string; slug: string; name: string } & Partial<
          Database["public"]["Tables"]["shops"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["shops"]["Row"]>;
        Relationships: [
          FK<"shops_owner_id_fkey", ["owner_id"], "profiles">,
          FK<"shops_category_id_fkey", ["category_id"], "categories">,
          FK<"shops_approved_by_fkey", ["approved_by"], "profiles">,
        ];
      };

      /* ─── shop_hours ─────────────────────────────────────────────── */
      shop_hours: {
        Row: {
          id: string;
          shop_id: string;
          weekday: number;
          opens_at: string | null;
          closes_at: string | null;
          is_closed: boolean;
        };
        Insert: {
          id?: string;
          shop_id: string;
          weekday: number;
          opens_at?: string | null;
          closes_at?: string | null;
          is_closed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["shop_hours"]["Row"]>;
        Relationships: [FK<"shop_hours_shop_id_fkey", ["shop_id"], "shops">];
      };

      /* ─── shop_categories ────────────────────────────────────────── */
      shop_categories: {
        Row: { shop_id: string; category_id: string };
        Insert: { shop_id: string; category_id: string };
        Update: Partial<{ shop_id: string; category_id: string }>;
        Relationships: [
          FK<"shop_categories_shop_id_fkey", ["shop_id"], "shops">,
          FK<"shop_categories_category_id_fkey", ["category_id"], "categories">,
        ];
      };

      /* ─── shop_follows ───────────────────────────────────────────── */
      shop_follows: {
        Row: { user_id: string; shop_id: string; created_at: string };
        Insert: { user_id: string; shop_id: string; created_at?: string };
        Update: Partial<{ user_id: string; shop_id: string }>;
        Relationships: [
          FK<"shop_follows_user_id_fkey", ["user_id"], "profiles">,
          FK<"shop_follows_shop_id_fkey", ["shop_id"], "shops">,
        ];
      };

      /* ─── products ───────────────────────────────────────────────── */
      products: {
        Row: {
          id: string;
          shop_id: string;
          category_id: string | null;
          name: string;
          name_ar: string | null;
          description: string | null;
          description_ar: string | null;
          price: number;
          compare_at_price: number | null;
          stock: number;
          low_stock_threshold: number;
          images: string[];
          variant_images: VariantImages;
          colors: string[];
          sizes: string[];
          is_online: boolean;
          is_draft: boolean;
          mall_pickup_available: boolean;
          views_count: number;
          sold_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { shop_id: string; name: string; price: number } & Partial<
          Database["public"]["Tables"]["products"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [
          FK<"products_shop_id_fkey", ["shop_id"], "shops">,
          FK<"products_category_id_fkey", ["category_id"], "categories">,
        ];
      };

      /* ─── promotions ─────────────────────────────────────────────── */
      promotions: {
        Row: {
          id: string;
          shop_id: string;
          title: string;
          title_ar: string | null;
          percent_off: number;
          starts_at: string;
          ends_at: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: { shop_id: string; title: string; percent_off: number; ends_at: string } & Partial<
          Database["public"]["Tables"]["promotions"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["promotions"]["Row"]>;
        Relationships: [FK<"promotions_shop_id_fkey", ["shop_id"], "shops">];
      };

      /* ─── favorites ──────────────────────────────────────────────── */
      favorites: {
        Row: { user_id: string; product_id: string; created_at: string };
        Insert: { user_id: string; product_id: string; created_at?: string };
        Update: Partial<{ user_id: string; product_id: string }>;
        Relationships: [
          FK<"favorites_user_id_fkey", ["user_id"], "profiles">,
          FK<"favorites_product_id_fkey", ["product_id"], "products">,
        ];
      };

      /* ─── cart_items ─────────────────────────────────────────────── */
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          quantity: number;
          color: string | null;
          size: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; product_id: string } & Partial<
          Database["public"]["Tables"]["cart_items"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["cart_items"]["Row"]>;
        Relationships: [
          FK<"cart_items_user_id_fkey", ["user_id"], "profiles">,
          FK<"cart_items_product_id_fkey", ["product_id"], "products">,
        ];
      };

      /* ─── reviews ────────────────────────────────────────────────── */
      reviews: {
        Row: {
          id: string;
          user_id: string;
          shop_id: string;
          product_id: string | null;
          rating: number;
          body: string | null;
          created_at: string;
        };
        Insert: { user_id: string; shop_id: string; rating: number } & Partial<
          Database["public"]["Tables"]["reviews"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["reviews"]["Row"]>;
        Relationships: [
          FK<"reviews_user_id_fkey", ["user_id"], "profiles">,
          FK<"reviews_shop_id_fkey", ["shop_id"], "shops">,
          FK<"reviews_product_id_fkey", ["product_id"], "products">,
        ];
      };

      /* ─── orders ─────────────────────────────────────────────────── */
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          shop_id: string;
          live_id: string | null;
          status: OrderStatus;
          payment_method: PaymentMethod;
          delivery_method: DeliveryMethod;
          subtotal: number;
          delivery_fee: number;
          discount: number;
          total: number;
          contact_phone: string;
          delivery_address: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        /**
         * Aucune création directe : le total, la remise live et le décrément
         * de stock sont calculés par la fonction SQL `place_order`. Laisser un
         * Insert ouvert permettrait à un client de fixer son propre prix.
         */
        Insert: never;
        Update: Partial<Pick<Database["public"]["Tables"]["orders"]["Row"], "status" | "note">>;
        Relationships: [
          FK<"orders_user_id_fkey", ["user_id"], "profiles">,
          FK<"orders_shop_id_fkey", ["shop_id"], "shops">,
          FK<"orders_live_id_fkey", ["live_id"], "lives">,
        ];
      };

      /* ─── order_items ────────────────────────────────────────────── */
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          product_image: string | null;
          unit_price: number;
          quantity: number;
          color: string | null;
          size: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          FK<"order_items_order_id_fkey", ["order_id"], "orders">,
          FK<"order_items_product_id_fkey", ["product_id"], "products">,
        ];
      };

      /* ─── lives ──────────────────────────────────────────────────── */
      lives: {
        Row: {
          id: string;
          shop_id: string;
          title: string;
          title_ar: string | null;
          cover_url: string | null;
          status: LiveStatus;
          source: LiveSource;
          facebook_url: string | null;
          /** Identifiant de la vidéo chez Facebook, pour ne pas relayer deux fois. */
          facebook_video_id: string | null;
          hls_url: string | null;
          broadcaster_peer_id: string | null;
          pinned_product_id: string | null;
          live_percent_off: number | null;
          offer_ends_at: string | null;
          scheduled_at: string | null;
          started_at: string | null;
          ended_at: string | null;
          viewers_count: number;
          peak_viewers: number;
          likes_count: number;
          purchases_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { shop_id: string; title: string } & Partial<
          Database["public"]["Tables"]["lives"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["lives"]["Row"]>;
        Relationships: [
          FK<"lives_shop_id_fkey", ["shop_id"], "shops">,
          FK<"lives_pinned_product_id_fkey", ["pinned_product_id"], "products">,
        ];
      };

      /* ─── live_comments ──────────────────────────────────────────── */
      live_comments: {
        Row: {
          id: string;
          live_id: string;
          user_id: string;
          body: string;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: { live_id: string; user_id: string; body: string };
        Update: Partial<Pick<Database["public"]["Tables"]["live_comments"]["Row"], "is_hidden">>;
        Relationships: [
          FK<"live_comments_live_id_fkey", ["live_id"], "lives">,
          FK<"live_comments_user_id_fkey", ["user_id"], "profiles">,
        ];
      };

      /* ─── live_likes ─────────────────────────────────────────────── */
      live_likes: {
        Row: { live_id: string; user_id: string; created_at: string };
        Insert: { live_id: string; user_id: string; created_at?: string };
        Update: Partial<{ live_id: string; user_id: string }>;
        Relationships: [
          FK<"live_likes_live_id_fkey", ["live_id"], "lives">,
          FK<"live_likes_user_id_fkey", ["user_id"], "profiles">,
        ];
      };

      /* ─── live_products ──────────────────────────────────────────────
         Articles présentés pendant un direct, ordonnés par le vendeur.
         `lives.pinned_product_id` reste à côté : il désigne celui dont on
         parle à l'instant, mis en avant au-dessus de la liste. */
      live_products: {
        Row: { live_id: string; product_id: string; position: number; added_at: string };
        Insert: { live_id: string; product_id: string; position?: number; added_at?: string };
        Update: Partial<{ position: number }>;
        Relationships: [
          FK<"live_products_live_id_fkey", ["live_id"], "lives">,
          FK<"live_products_product_id_fkey", ["product_id"], "products">,
        ];
      };

      /* ─── shop_facebook_pages ────────────────────────────────────────
         Lien boutique ↔ page Facebook, jeton d'accès compris.
         Aucune policy pour `anon` ni `authenticated` : seule la clé secrète
         y accède, côté serveur. L'interface vendeur lit l'état par
         `facebook_page_status()`, qui ne renvoie pas le jeton. */
      shop_facebook_pages: {
        Row: {
          shop_id: string;
          page_id: string;
          page_name: string;
          page_token: string;
          facebook_user_id: string | null;
          is_subscribed: boolean;
          connected_at: string;
          last_checked_at: string | null;
          last_error: string | null;
          updated_at: string;
        };
        Insert: {
          shop_id: string;
          page_id: string;
          page_name: string;
          page_token: string;
          facebook_user_id?: string | null;
          is_subscribed?: boolean;
          connected_at?: string;
          last_checked_at?: string | null;
          last_error?: string | null;
          updated_at?: string;
        };
        Update: Partial<{
          page_id: string;
          page_name: string;
          page_token: string;
          facebook_user_id: string | null;
          is_subscribed: boolean;
          last_checked_at: string | null;
          last_error: string | null;
          updated_at: string;
        }>;
        Relationships: [FK<"shop_facebook_pages_shop_id_fkey", ["shop_id"], "shops">];
      };

      /* ─── taxi_drivers ───────────────────────────────────────────────
         Chauffeurs de taxi : coordonnées, disponibilité, dernière position.
         `is_approved` n'est modifiable que par l'administration — la policy
         le fige pour le chauffeur lui-même. */
      taxi_drivers: {
        Row: {
          id: string;
          display_name: string;
          phone: string;
          vehicle: string | null;
          plate: string | null;
          is_available: boolean;
          lat: number | null;
          lng: number | null;
          position_updated_at: string | null;
          is_approved: boolean;

          /*
            Places, course en cours, retour à la disponibilité.

            Toutes facultatives, et nulles par défaut : un chauffeur qui ne
            renseigne rien fonctionne comme avant — libre ou occupé, et son
            numéro. C'est aussi ce qui permet à l'écran de ne jamais inventer
            un chiffre : `null` s'affiche comme « non renseigné », pas comme
            zéro.
          */
          seats_total: number | null;
          seats_free: number | null;
          free_at: string | null;
          heading_lat: number | null;
          heading_lng: number | null;
          takes_along: boolean;

          /*
            Ce que le chauffeur a déclaré, et depuis quand.

            Distinct de `is_available`, qui reste écrit en parallèle pour les
            écrans qui n'ont pas encore migré. La différence tient en un point :
            ce statut ne se périme pas parce que l'application se ferme. Il est
            tenu par le serveur et n'expire qu'au bout de douze heures.

            `last_seen_at` est le battement de l'écran ouvert. Il ne dit pas où
            se trouve le chauffeur — un chauffeur peut refuser le GPS et rester
            parfaitement joignable — seulement qu'il était là.
          */
          status: TaxiStatus;
          status_since: string;
          last_seen_at: string | null;

          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; display_name: string; phone: string } & Partial<
          Database["public"]["Tables"]["taxi_drivers"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["taxi_drivers"]["Row"]>;
        Relationships: [FK<"taxi_drivers_id_fkey", ["id"], "profiles">];
      };

      /* ─── taxi_messages ──────────────────────────────────────────────
         La négociation d'une course, par écrit. Un fil par couple
         client-chauffeur : `from_driver` dit seulement de quel côté aligner
         la bulle, les deux extrémités étant déjà connues par les clés. */
      taxi_messages: {
        Row: {
          id: string;
          driver_id: string;
          client_id: string;
          from_driver: boolean;
          body: string;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          driver_id: string;
          client_id: string;
          from_driver: boolean;
          body: string;
        } & Partial<Database["public"]["Tables"]["taxi_messages"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["taxi_messages"]["Row"]>;
        Relationships: [
          FK<"taxi_messages_driver_id_fkey", ["driver_id"], "taxi_drivers">,
          FK<"taxi_messages_client_id_fkey", ["client_id"], "profiles">,
        ];
      };

      /* ─── taxi_requests ──────────────────────────────────────────────
         Une course demandée à un chauffeur précis. Le trajet y est figé au
         moment de la demande : le chauffeur répond sur ce qu'on lui a montré,
         pas sur une position qui a bougé depuis. `expires_at` porte
         l'expiration dans la ligne elle-même — une minuterie côté navigateur
         mourrait avec l'onglet, une date reste vraie. */
      taxi_requests: {
        Row: {
          id: string;
          client_id: string;
          driver_id: string;
          pickup_lat: number;
          pickup_lng: number;
          pickup_label: string | null;
          dest_lat: number | null;
          dest_lng: number | null;
          dest_label: string | null;
          /** Distance du chauffeur au client, calculée côté serveur. */
          distance_m: number | null;
          duration_min: number | null;
          seats: number;
          status: TaxiRequestStatus;
          expires_at: string;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          client_id: string;
          driver_id: string;
          pickup_lat: number;
          pickup_lng: number;
        } & Partial<Database["public"]["Tables"]["taxi_requests"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["taxi_requests"]["Row"]>;
        Relationships: [
          FK<"taxi_requests_client_id_fkey", ["client_id"], "profiles">,
          FK<"taxi_requests_driver_id_fkey", ["driver_id"], "taxi_drivers">,
        ];
      };

      /* ─── cron_runs ──────────────────────────────────────────────────
         La trace des tâches périodiques. Une tâche qui cesse d'être
         déclenchée était jusqu'ici indiscernable d'une tâche qui n'a rien
         eu à faire : les deux ne laissaient rien. Écrite avec la clé de
         service seule — un navigateur ne doit pas pouvoir fabriquer un faux
         relevé et masquer une panne. */
      cron_runs: {
        Row: {
          id: number;
          tache: string;
          ok: boolean;
          detail: Json | null;
          ran_at: string;
        };
        Insert: { tache: string; ok: boolean } & Partial<
          Database["public"]["Tables"]["cron_runs"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["cron_runs"]["Row"]>;
        Relationships: [];
      };

      /* ─── sos_providers ──────────────────────────────────────────────
         Dépanneurs d'urgence : un métier, une disponibilité, un numéro.
         Même contrat que `taxi_drivers`, `trade` en plus — c'est lui qui
         rend le filtre possible, et la contrainte `check` de la base en
         tient la liste. `is_approved` reste réservé à l'administration. */
      sos_providers: {
        Row: {
          id: string;
          trade: SosTrade;
          display_name: string;
          phone: string;
          description: string | null;
          travels: boolean;
          is_available: boolean;
          lat: number | null;
          lng: number | null;
          position_updated_at: string | null;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; trade: SosTrade; display_name: string; phone: string } & Partial<
          Database["public"]["Tables"]["sos_providers"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["sos_providers"]["Row"]>;
        Relationships: [FK<"sos_providers_id_fkey", ["id"], "profiles">];
      };

      /* ─── app_settings ───────────────────────────────────────────────
         Réglages serveur : adresse d'envoi des notifications et secret
         partagé. RLS active sans aucune policy, donc illisible depuis le
         client — seules les fonctions `security definer` et la clé de
         service y accèdent. */
      app_settings: {
        Row: { key: string; value: string };
        Insert: { key: string; value: string };
        Update: Partial<{ value: string }>;
        Relationships: [];
      };

      /* ─── push_subscriptions ─────────────────────────────────────────
         Un enregistrement par appareil et par navigateur : la même personne
         sur son téléphone et sur son ordinateur en a deux, et doit être
         prévenue sur les deux. `endpoint` est unique — un navigateur qui
         redemande un abonnement remplace le précédent, sinon la notification
         arriverait en double. */
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: { user_id: string; endpoint: string; p256dh: string; auth: string } & Partial<
          Database["public"]["Tables"]["push_subscriptions"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]>;
        Relationships: [FK<"push_subscriptions_user_id_fkey", ["user_id"], "profiles">];
      };

      /* ─── deals ──────────────────────────────────────────────────── */
      deals: {
        Row: {
          id: string;
          author_id: string;
          shop_id: string | null;
          category_id: string | null;
          title: string;
          body: string | null;
          body_ar: string | null;
          images: string[];
          location_label: string | null;
          expires_at: string;
          status: DealStatus;
          is_verified: boolean;
          verified_at: string | null;
          upvotes: number;
          downvotes: number;
          comments_count: number;
          reports_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { author_id: string; title: string; expires_at: string } & Partial<
          Database["public"]["Tables"]["deals"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["deals"]["Row"]>;
        Relationships: [
          FK<"deals_author_id_fkey", ["author_id"], "profiles">,
          FK<"deals_shop_id_fkey", ["shop_id"], "shops">,
          FK<"deals_category_id_fkey", ["category_id"], "categories">,
        ];
      };

      /* ─── deal_votes ─────────────────────────────────────────────── */
      deal_votes: {
        Row: { deal_id: string; user_id: string; value: number; created_at: string };
        Insert: { deal_id: string; user_id: string; value: number; created_at?: string };
        Update: Partial<{ value: number }>;
        Relationships: [
          FK<"deal_votes_deal_id_fkey", ["deal_id"], "deals">,
          FK<"deal_votes_user_id_fkey", ["user_id"], "profiles">,
        ];
      };

      /* ─── deal_comments ──────────────────────────────────────────── */
      deal_comments: {
        Row: {
          id: string;
          deal_id: string;
          user_id: string;
          body: string;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: { deal_id: string; user_id: string; body: string };
        Update: Partial<Pick<Database["public"]["Tables"]["deal_comments"]["Row"], "is_hidden">>;
        Relationships: [
          FK<"deal_comments_deal_id_fkey", ["deal_id"], "deals">,
          FK<"deal_comments_user_id_fkey", ["user_id"], "profiles">,
        ];
      };

      /* ─── reports ────────────────────────────────────────────────── */
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: ReportTarget;
          target_id: string;
          reason: string | null;
          status: ReportStatus;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          reporter_id: string;
          target_type: ReportTarget;
          target_id: string;
          reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Row"]>;
        Relationships: [
          FK<"reports_reporter_id_fkey", ["reporter_id"], "profiles">,
          FK<"reports_resolved_by_fkey", ["resolved_by"], "profiles">,
        ];
      };

      /* ─── conversations ──────────────────────────────────────────── */
      conversations: {
        Row: {
          id: string;
          user_id: string;
          shop_id: string;
          last_message_at: string;
          created_at: string;
        };
        Insert: { id?: string; user_id: string; shop_id: string };
        Update: Partial<{ last_message_at: string }>;
        Relationships: [
          FK<"conversations_user_id_fkey", ["user_id"], "profiles">,
          FK<"conversations_shop_id_fkey", ["shop_id"], "shops">,
        ];
      };

      /* ─── messages ───────────────────────────────────────────────── */
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: { conversation_id: string; sender_id: string; body: string };
        Update: Partial<{ read_at: string }>;
        Relationships: [
          FK<"messages_conversation_id_fkey", ["conversation_id"], "conversations">,
          FK<"messages_sender_id_fkey", ["sender_id"], "profiles">,
        ];
      };

      /* ─── notifications ──────────────────────────────────────────── */
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: NotificationKind;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        /**
         * Écrites par des fonctions `security definer` — et, depuis la
         * messagerie taxi, par une action serveur qui emploie le client
         * d'administration.
         *
         * Le type l'autorise donc, mais les policies continuent de l'interdire
         * à un navigateur : seule une clé de service passe, et il n'y en a
         * jamais dans le paquet envoyé au client.
         */
        Insert: {
          user_id: string;
          kind: NotificationKind;
          title: string;
          body?: string | null;
          link?: string | null;
        };
        Update: Partial<{ read_at: string }>;
        Relationships: [FK<"notifications_user_id_fkey", ["user_id"], "profiles">];
      };

      /* ─── loyalty_transactions ───────────────────────────────────── */
      loyalty_transactions: {
        Row: {
          id: string;
          user_id: string;
          points: number;
          reason: string;
          ref_type: string | null;
          ref_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [FK<"loyalty_transactions_user_id_fkey", ["user_id"], "profiles">];
      };

      /* ─── referrals ──────────────────────────────────────────────── */
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          points_awarded: number;
          validated_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          FK<"referrals_referrer_id_fkey", ["referrer_id"], "profiles">,
          FK<"referrals_referred_id_fkey", ["referred_id"], "profiles">,
        ];
      };

      /* ─── sponsored_slots ────────────────────────────────────────── */
      sponsored_slots: {
        Row: {
          id: string;
          advertiser: string;
          title: string;
          subtitle: string | null;
          image_url: string | null;
          link_url: string | null;
          shop_id: string | null;
          position: number;
          starts_at: string;
          ends_at: string;
          is_active: boolean;
          impressions: number;
          clicks: number;
          created_at: string;
        };
        Insert: { advertiser: string; title: string; ends_at: string } & Partial<
          Database["public"]["Tables"]["sponsored_slots"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["sponsored_slots"]["Row"]>;
        Relationships: [FK<"sponsored_slots_shop_id_fkey", ["shop_id"], "shops">];
      };

      /* ─── city_infos ─────────────────────────────────────────────── */
      city_infos: {
        Row: {
          id: string;
          kind: CityInfoKind;
          title: string;
          title_ar: string | null;
          subtitle: string | null;
          subtitle_ar: string | null;
          body: string | null;
          hue: number;
          monogram: string;
          link_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: { kind: CityInfoKind; title: string } & Partial<
          Database["public"]["Tables"]["city_infos"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["city_infos"]["Row"]>;
        Relationships: [];
      };

      /* ─── city_alerts ────────────────────────────────────────────── */
      city_alerts: {
        Row: {
          id: string;
          title: string;
          title_ar: string | null;
          body: string | null;
          severity: AlertSeverity;
          starts_at: string;
          ends_at: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: { title: string } & Partial<Database["public"]["Tables"]["city_alerts"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["city_alerts"]["Row"]>;
        Relationships: [FK<"city_alerts_created_by_fkey", ["created_by"], "profiles">];
      };

      /* ─── practical_services ─────────────────────────────────────── */
      practical_services: {
        Row: {
          id: string;
          kind: PracticalServiceKind;
          name: string;
          name_ar: string | null;
          phone: string | null;
          address: string | null;
          info: string | null;
          hue: number;
          monogram: string;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
        };
        Insert: { kind: PracticalServiceKind; name: string; monogram: string } & Partial<
          Database["public"]["Tables"]["practical_services"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["practical_services"]["Row"]>;
        Relationships: [];
      };

      /* ─── prayer_times ───────────────────────────────────────────── */
      prayer_times: {
        Row: {
          on_date: string;
          fajr: string;
          dhuhr: string;
          asr: string;
          maghrib: string;
          isha: string;
        };
        Insert: Database["public"]["Tables"]["prayer_times"]["Row"];
        Update: Partial<Database["public"]["Tables"]["prayer_times"]["Row"]>;
        Relationships: [];
      };

      /* ─── pharmacies_on_duty ─────────────────────────────────────── */
      pharmacies_on_duty: {
        Row: {
          id: string;
          on_date: string;
          name: string;
          address: string | null;
          phone: string | null;
        };
        Insert: {
          id?: string;
          on_date: string;
          name: string;
          address?: string | null;
          phone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pharmacies_on_duty"]["Row"]>;
        Relationships: [];
      };

      /* ─── service_requests ───────────────────────────────────────── */
      service_requests: {
        Row: {
          id: string;
          user_id: string;
          kind: ServiceRequestKind;
          title: string;
          body: string | null;
          attachments: string[];
          status: ServiceRequestStatus;
          response: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          kind: ServiceRequestKind;
          title: string;
          body?: string | null;
          attachments?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["service_requests"]["Row"]>;
        Relationships: [FK<"service_requests_user_id_fkey", ["user_id"], "profiles">];
      };
    };

    Views: { [_ in never]: never };

    Functions: {
      place_order: {
        Args: {
          p_shop_id: string;
          p_items: Json;
          p_payment_method?: PaymentMethod;
          p_delivery_method?: DeliveryMethod;
          p_contact_phone?: string | null;
          p_delivery_address?: string | null;
          p_note?: string | null;
          p_live_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      start_live: {
        Args: { target_live: string; peer?: string | null };
        Returns: Database["public"]["Tables"]["lives"]["Row"];
      };
      end_live: { Args: { target_live: string }; Returns: undefined };
      set_live_viewers: { Args: { target_live: string; count_now: number }; Returns: undefined };
      approve_shop: { Args: { target_shop: string }; Returns: undefined };
      reject_shop: {
        Args: { target_shop: string; reason: string; missing_doc?: string | null };
        Returns: undefined;
      };
      expire_stale_deals: { Args: Record<PropertyKey, never>; Returns: number };
      /** Le profil complet de la personne connectée. Seule porte de sortie du
          téléphone, du code de parrainage, des points et de `is_banned`, que
          les droits de colonne ferment à `anon` et `authenticated`. */
      mon_profil: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Tables"]["profiles"]["Row"] };
      /** Purge les relevés d'exécution de plus de trente jours. */
      purge_cron_runs: { Args: Record<PropertyKey, never>; Returns: undefined };
      /** Passe les demandes échues en « expiree » et retire les déclarations
          de plus de douze heures. Retourne le nombre de demandes touchées. */
      expire_taxi_requests: { Args: Record<PropertyKey, never>; Returns: number };
      /* Incrémente `shops.views_count`. `security definer` : un visiteur anonyme
         n'a aucun droit d'écriture sur `shops`, et n'en a pas besoin pour ça. */
      increment_shop_views: { Args: { shop: string }; Returns: undefined };
      refresh_shops_open_state: { Args: Record<PropertyKey, never>; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_service_context: { Args: Record<PropertyKey, never>; Returns: boolean };
      admin_members: {
        Args: { search?: string | null; max_rows?: number };
        Returns: Array<{
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          city: string | null;
          loyalty_points: number;
          is_banned: boolean;
          created_at: string;
          last_sign_in_at: string | null;
          shop_name: string | null;
          shop_status: ShopStatus | null;
        }>;
      };
      grant_admin_by_email: { Args: { target_email: string }; Returns: string };
      facebook_page_status: {
        Args: { target_shop: string };
        Returns: Array<{
          page_name: string;
          is_subscribed: boolean;
          connected_at: string;
          last_checked_at: string | null;
          last_error: string | null;
        }>;
      };
      sync_facebook_live: {
        Args: {
          target_shop: string;
          video_id: string;
          permalink: string;
          video_title: string;
          live_now: boolean;
        };
        Returns: string | null;
      };
      set_member_role: { Args: { target: string; new_role: UserRole }; Returns: undefined };
      my_shop_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      owns_shop: { Args: { target_shop_id: string }; Returns: boolean };
      slugify: { Args: { input: string }; Returns: string };
      search_catalog: {
        Args: { q: string; limit_count?: number };
        Returns: Array<{
          kind: "product" | "shop";
          id: string;
          title: string;
          subtitle: string | null;
          image: string | null;
          price: number | null;
          slug: string | null;
          hue: number | null;
        }>;
      };
    };

    Enums: {
      user_role: UserRole;
      shop_status: ShopStatus;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      delivery_method: DeliveryMethod;
      live_status: LiveStatus;
      live_source: LiveSource;
      deal_status: DealStatus;
      report_target: ReportTarget;
      report_status: ReportStatus;
      city_info_kind: CityInfoKind;
      alert_severity: AlertSeverity;
      practical_service_kind: PracticalServiceKind;
      service_request_kind: ServiceRequestKind;
      service_request_status: ServiceRequestStatus;
      app_locale: AppLocale;
      notification_kind: NotificationKind;
    };

    CompositeTypes: { [_ in never]: never };
  };
}

/* ─── Alias de confort ─────────────────────────────────────────────────── */

type T = Database["public"]["Tables"];

export type Profile = T["profiles"]["Row"];
export type Category = T["categories"]["Row"];
export type Shop = T["shops"]["Row"];
export type ShopHours = T["shop_hours"]["Row"];
export type Product = T["products"]["Row"];
export type Promotion = T["promotions"]["Row"];
export type CartItem = T["cart_items"]["Row"];
export type Order = T["orders"]["Row"];
export type OrderItem = T["order_items"]["Row"];
export type Live = T["lives"]["Row"];
export type LiveComment = T["live_comments"]["Row"];
export type Deal = T["deals"]["Row"];
export type DealComment = T["deal_comments"]["Row"];
export type Report = T["reports"]["Row"];
export type Notification = T["notifications"]["Row"];
export type SponsoredSlot = T["sponsored_slots"]["Row"];
export type CityInfo = T["city_infos"]["Row"];
export type CityAlert = T["city_alerts"]["Row"];
export type PracticalService = T["practical_services"]["Row"];
export type ServiceRequest = T["service_requests"]["Row"];

/** Ligne d'annuaire renvoyée par `admin_members` : un profil + son e-mail. */
export type AdminMember = Database["public"]["Functions"]["admin_members"]["Returns"][number];
