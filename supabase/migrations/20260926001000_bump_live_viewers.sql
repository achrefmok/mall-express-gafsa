-- ═══════════════════════════════════════════════════════════════════════
-- Compteur de spectateurs sans canal Presence.
--
-- `set_live_viewers` attendait la taille du canal Presence de CE client —
-- fiable, mais chaque spectateur y maintenait une connexion Realtime ouverte
-- en permanence, la ressource la plus étroite du palier gratuit Supabase.
-- `live-room.tsx` ne s'y abonne plus : le compteur de spectateurs, le fil de
-- commentaires et l'état du direct sont désormais lus par sondage.
--
-- Un sondage ne peut plus rapporter « je vois N personnes » — il n'y a plus
-- de canal partagé pour les compter. `bump_live_viewers` compte donc les
-- arrivées et les départs, un par un : +1 à l'entrée, −1 à la sortie.
--
-- Ce que ça perd face à Presence : un onglet fermé brutalement (perte
-- réseau, application tuée en arrière-plan) ne décrémente jamais — le
-- compteur peut dériver vers le haut pendant un direct. Ce que ça garde :
-- chaque nouveau direct reset (`start_live` pose `viewers_count = 0`), donc
-- la dérive ne s'accumule jamais au-delà d'un seul direct, et le compteur
-- reste un ordre de grandeur, pas un audit — ce qu'il a toujours été.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.bump_live_viewers(target_live uuid, delta integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.lives
  set viewers_count = greatest(0, viewers_count + delta),
      peak_viewers  = greatest(peak_viewers, viewers_count + delta)
  where id = target_live and status = 'live';
end;
$$;

revoke all on function public.bump_live_viewers(uuid, integer) from public;
grant execute on function public.bump_live_viewers(uuid, integer) to authenticated;
