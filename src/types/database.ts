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
export type NotificationKind =
  | "order_update"
  | "live_starting"
  | "deal_verified"
  | "shop_approved"
  | "shop_rejected"
  | "new_message"
  | "loyalty"
  | "city_alert"
  | "referral";

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
        Relationships: [FK<"profiles_referred_by_fkey", ["referred_by"], "profiles">];
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
        /** Écrites exclusivement par des fonctions SECURITY DEFINER. */
        Insert: never;
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
