-- Activation d'une boutique par code, pour un commerçant que l'administration
-- a déjà rencontré et vérifié en dehors de l'application.
--
-- ────────────────────────────────────────────────────────────────────────
-- Pourquoi cette table n'a aucune policy
-- ────────────────────────────────────────────────────────────────────────
--
-- Un code s'utilise avant que son porteur n'ait de compte : la vérifier ne
-- peut donc pas passer par une policy conditionnée à `auth.uid()`, et la
-- laisser lisible par n'importe quel visiteur anonyme la rendrait
-- devinable à la longue par balayage. Elle reste donc verrouillée pour tous
-- les rôles PostgREST (`anon`, `authenticated`) — RLS activée et forcée,
-- sans la moindre policy — et seule la clé de service y touche, depuis les
-- actions serveur de `src/app/actions/activation.ts`, qui vérifient elles-
-- mêmes qui appelle avant d'y toucher.

-- Une boutique créée pour un code n'a pas encore de titulaire : `owner_id`
-- était `not null` depuis l'origine, quand chaque boutique naissait avec son
-- compte. `shops_owner_unique` reste vrai avec plusieurs lignes à `null` —
-- Postgres ne les considère jamais égales entre elles — donc rien n'empêche
-- plusieurs boutiques d'attendre leur code en même temps.
--
-- Elle naît `pending`, sa valeur par défaut : la policy de lecture
-- (`status = 'approved' or owner_id = auth.uid() or is_admin()`) la garde
-- invisible du public tant que personne ne l'a activée *et* que
-- l'administration ne l'a pas approuvée — les deux étapes restent
-- distinctes, comme pour une boutique créée normalement.
alter table public.shops alter column owner_id drop not null;

create table if not exists public.shop_activation_codes (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  code        text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references auth.users(id) on delete set null,
  revoked_at  timestamptz,
  revoked_by  uuid references auth.users(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists shop_activation_codes_shop_id_idx
  on public.shop_activation_codes(shop_id);

alter table public.shop_activation_codes enable row level security;
alter table public.shop_activation_codes force row level security;
