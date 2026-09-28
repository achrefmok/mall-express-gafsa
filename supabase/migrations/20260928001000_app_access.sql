-- ═══════════════════════════════════════════════════════════════════════
-- Accès public : un interrupteur unique, lu à chaque requête par
-- l'intergiciel, qui bascule toute l'application entre deux états sans
-- redéploiement.
--
--   OFF (préparation) — page « en préparation » pour tout visiteur non
--   connecté et pour tout compte de rôle « client ». Un commerçant, un
--   exposant ou une administration continuent d'entrer normalement : ce
--   sont eux qui préparent le lancement.
--
--   ON (public) — comportement actuel de l'application, inchangé.
--
-- Même schéma que `app_brand` : une ligne, une clé fixe, lisible par tous
-- (l'intergiciel la lit avec la clé anonyme, avant toute session), modifiable
-- par l'administration seule.
-- ═══════════════════════════════════════════════════════════════════════

-- Le nom `app_settings` est déjà pris : une table clé-valeur illisible
-- depuis le client sert les réglages des notifications push. Celle-ci a un
-- nom distinct — et l'inverse de sa politique : lisible par tous, l'accès
-- public devant se décider avant même qu'une session existe.
create table if not exists public.app_access (
  id            boolean primary key default true check (id),
  public_access boolean not null default false,
  updated_at    timestamptz not null default now()
);

alter table public.app_access enable row level security;
alter table public.app_access force row level security;

-- Valeur de départ : préparation. Une ligne déjà présente n'est pas touchée
-- — rejouer ce fichier ne doit jamais rouvrir un accès qu'un administrateur
-- a délibérément refermé.
insert into public.app_access (id, public_access) values (true, false)
on conflict (id) do nothing;

drop policy if exists app_access_public_select on public.app_access;
create policy app_access_public_select on public.app_access
  for select using (true);

drop policy if exists app_access_admin_write on public.app_access;
create policy app_access_admin_write on public.app_access
  for all
  using (public.is_admin() or public.is_service_context())
  with check (public.is_admin() or public.is_service_context());
