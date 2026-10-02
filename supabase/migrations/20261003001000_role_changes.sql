-- Journal des changements de rôle — base du nouvel écran /admin/securite.
--
-- `profiles.role` n'a jamais gardé d'historique : un rôle changé en SQL à la
-- main, ou via `set_member_role`, ne laisse aucune trace de qui l'a changé
-- ni quand. Cette table ne remplace rien — `set_member_role` continue
-- d'appliquer le changement — elle ajoute seulement la ligne qui permet de
-- le voir a posteriori.

create table if not exists public.role_changes (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.profiles (id) on delete cascade,
  previous_role text not null,
  new_role text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists role_changes_target_idx
  on public.role_changes (target_id);

create index if not exists role_changes_created_idx
  on public.role_changes (created_at desc);

alter table public.role_changes enable row level security;

-- Écriture et lecture réservées à l'administration — un changement de rôle
-- n'a rien d'une donnée publique, et seule la console /admin/securite la lit.
drop policy if exists "role_changes admin" on public.role_changes;
create policy "role_changes admin" on public.role_changes
  for all using (public.is_admin())
  with check (public.is_admin());

/* ─── Reprise ──────────────────────────────────────────────────────────── */

-- Table additive et vide à la création : aucun changement de rôle passé
-- n'est reconstitué, le journal démarre à partir du premier changement posé
-- après cette migration.
--
-- Marche arrière : `drop table public.role_changes;`
