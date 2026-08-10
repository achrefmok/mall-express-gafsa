-- ═══════════════════════════════════════════════════════════════════════
-- Mall Express Gafsa — 05 · Buckets de stockage et diffusion temps réel
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Buckets ───────────────────────────────────────────────────────────
-- Tous publics en lecture (des photos de vitrine et de produits n'ont pas
-- vocation à être privées) ; l'écriture est cadrée par les policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',     'avatars',     true, 2  * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('shop-assets', 'shop-assets', true, 5  * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('products',    'products',    true, 5  * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('deals',       'deals',       true, 5  * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('live-covers', 'live-covers', true, 3  * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('documents',   'documents',   false, 8 * 1024 * 1024, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Convention de chemin : <bucket>/<uuid-propriétaire>/<fichier>
-- Le premier segment porte donc l'autorisation.

drop policy if exists "public read on open buckets" on storage.objects;
create policy "public read on open buckets" on storage.objects
  for select using (
    bucket_id in ('avatars','shop-assets','products','deals','live-covers')
  );

drop policy if exists "own folder write" on storage.objects;
create policy "own folder write" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('avatars','shop-assets','products','deals','live-covers','documents')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own folder update" on storage.objects;
create policy "own folder update" on storage.objects
  for update to authenticated using (
    (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own folder delete" on storage.objects;
create policy "own folder delete" on storage.objects
  for delete to authenticated using (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
  );

-- Les pièces justificatives (patente, CIN) ne sont lisibles que par leur
-- déposant et l'administration.
drop policy if exists "documents restricted read" on storage.objects;
create policy "documents restricted read" on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ─── Realtime ──────────────────────────────────────────────────────────
-- Publication limitée à ce qui doit vraiment pousser : le fil de
-- commentaires d'un live, les compteurs du live, les votes des bons plans,
-- la messagerie, les notifications et le suivi de commande.

do $$
declare t text;
begin
  foreach t in array array[
    'live_comments','lives','deals','deal_votes','messages',
    'notifications','orders','city_alerts'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- REPLICA IDENTITY FULL : sans cela les événements UPDATE/DELETE ne
-- transportent que la clé primaire, et le client ne peut pas filtrer.
alter table public.lives           replica identity full;
alter table public.live_comments   replica identity full;
alter table public.deals           replica identity full;
alter table public.orders          replica identity full;
