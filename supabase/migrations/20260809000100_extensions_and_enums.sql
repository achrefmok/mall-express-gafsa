-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 01 · Extensions et types énumérés
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "unaccent" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- ─── Rôles et cycles de vie ────────────────────────────────────────────

do $$ begin
  create type public.user_role as enum ('client', 'vendor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shop_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending',      -- créée, en attente de prise en charge vendeur
    'to_prepare',   -- « À préparer »
    'ready',        -- prête (retrait au mall)
    'shipped',      -- en cours de livraison
    'delivered',    -- « Livrée »
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cod', 'call', 'online');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.delivery_method as enum ('delivery', 'pickup');
exception when duplicate_object then null; end $$;

-- ─── Lives ─────────────────────────────────────────────────────────────

do $$ begin
  create type public.live_status as enum ('scheduled', 'live', 'ended', 'cancelled');
exception when duplicate_object then null; end $$;

-- `camera`   : le vendeur diffuse depuis la caméra de son appareil (WebRTC,
--              signalisation via Supabase Realtime)
-- `facebook` : relais d'un direct Facebook existant (plugin vidéo officiel)
-- `hls`      : flux HLS externe (Mux, Cloudflare Stream, LiveKit Egress…)
do $$ begin
  create type public.live_source as enum ('camera', 'facebook', 'hls');
exception when duplicate_object then null; end $$;

-- ─── Bons plans (communauté) ───────────────────────────────────────────

do $$ begin
  create type public.deal_status as enum ('active', 'expired', 'removed');
exception when duplicate_object then null; end $$;

-- ─── Modération ────────────────────────────────────────────────────────

do $$ begin
  create type public.report_target as enum ('deal', 'product', 'shop', 'deal_comment', 'live_comment', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

-- ─── Contenus municipaux ───────────────────────────────────────────────

do $$ begin
  create type public.city_info_kind as enum ('works', 'transport', 'admin_procedure');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.alert_severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.practical_service_kind as enum ('taxi', 'louage', 'prayer', 'pharmacy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_request_kind as enum ('bill_payment', 'complaint');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_request_status as enum ('submitted', 'in_review', 'resolved', 'rejected');
exception when duplicate_object then null; end $$;

-- ─── Divers ────────────────────────────────────────────────────────────

do $$ begin
  create type public.app_locale as enum ('fr', 'ar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_kind as enum (
    'order_update', 'live_starting', 'deal_verified', 'shop_approved',
    'shop_rejected', 'new_message', 'loyalty', 'city_alert', 'referral'
  );
exception when duplicate_object then null; end $$;
