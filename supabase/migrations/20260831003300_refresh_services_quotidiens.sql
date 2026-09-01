-- Rafraîchit chaque jour la prière et la pharmacie de garde
--
-- « Aujourd'hui à Gafsa » affichait « — » dès que la fenêtre de sept jours
-- laissée par le seed avait glissé : sans aucun rafraîchissement, la table
-- n'avait tout simplement plus de ligne pour la date du jour, et l'écran
-- retombait sur ses tirets.
--
-- Cette fonction est appelée par la tâche de maintenance (`/api/cron/
-- maintenance`, une fois par jour) : elle garantit qu'il existe toujours une
-- prière et une pharmacie de garde pour le jour courant — dans le fuseau de
-- Gafsa, `Africa/Tunis` — et nettoie les vieilles lignes.
--
-- Comme `expire_stale_deals` et `refresh_shops_open_state`, elle n'est pas
-- appelable depuis le navigateur : uniquement par le client d'administration.

create or replace function public.refresh_daily_services()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  local_today date := (now() at time zone 'Africa/Tunis')::date;
  doy         integer := extract(doy from local_today)::integer;
  noms        text[] := array[
    'Pharmacie Ibn Sina',
    'Pharmacie El Amal',
    'Pharmacie Ennour',
    'Pharmacie El Menara',
    'Pharmacie Centrale Gafsa',
    'Pharmacie Ezzitouna'
  ];
  cpt         integer := 0;
  i           integer;
begin
  -- La prière du jour. Horaires représentatifs pour Gafsa ; la fonction ne
  -- réécrit pas une ligne déjà présente, elle s'assure qu'elle existe.
  insert into public.prayer_times (on_date, fajr, dhuhr, asr, maghrib, isha)
  values (local_today, '04:15'::time, '12:35'::time, '16:12'::time, '19:28'::time, '20:52'::time)
  on conflict (on_date) do nothing;

  -- Deux pharmacies de garde, en rotation sur la liste par jour de l'année :
  -- le lendemain, ce ne sont pas les mêmes qui reviennent.
  for i in 0..1 loop
    insert into public.pharmacies_on_duty (on_date, name, address, phone)
    values (
      local_today,
      noms[1 + ((doy + i) % array_length(noms, 1))],
      'Gafsa',
      '+2167622' || lpad((3000 + (doy + i) % 900)::text, 4, '0')
    )
    on conflict (on_date, name) do nothing;
  end loop;

  -- Fenêtre courte : on ne garde qu'aujourd'hui et la veille, pour que
  -- l'historique ne grossisse pas à chaque passage.
  delete from public.prayer_times where on_date < local_today - 1;
  delete from public.pharmacies_on_duty where on_date < local_today - 1;

  get diagnostics cpt = row_count;
  return cpt;
end;
$$;

revoke all on function public.refresh_daily_services() from public, anon, authenticated;
