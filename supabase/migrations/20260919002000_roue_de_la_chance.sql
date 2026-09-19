-- La roue de la chance d'une boutique.
--
-- ════════════════════════════════════════════════════════════════════════
-- Où se décide le lot, et pourquoi c'est tout le fichier
-- ════════════════════════════════════════════════════════════════════════
--
-- Le navigateur ne tire jamais. Il demande, la base tire, et l'animation se
-- contente de s'arrêter là où la base a dit. Faire tourner la roue dans le
-- téléphone puis annoncer le résultat au serveur, c'est offrir le gros lot à
-- qui sait ouvrir la console — et une roue truquable, une fois connue, ne
-- vaut plus rien pour personne : ni pour le commerçant qui l'offre, ni pour
-- les clients honnêtes.
--
-- Trois choses en découlent, toutes ici :
--
--   · `roue_tourner` choisit le lot, en `security definer` ;
--   · les poids et les stocks ne sont lisibles que par le commerçant — un
--     client qui verrait « gros lot : poids 1 sur 1000 » n'essaierait pas ;
--   · le quota journalier est compté en base, pas dans l'écran.
--
-- ════════════════════════════════════════════════════════════════════════
-- Pourquoi une roue par boutique
-- ════════════════════════════════════════════════════════════════════════
--
-- C'est le commerçant qui paie les lots : à lui de les choisir, de les
-- arrêter, de dire combien il en reste. Une roue commune à tout le mall
-- aurait demandé qui rembourse quoi — et personne n'aurait rien offert.

/* ─── 1 · La roue ─────────────────────────────────────────────────────── */

create table if not exists public.shop_wheels (
  id uuid primary key default gen_random_uuid(),

  -- Une seule roue par boutique : deux roues, c'est deux fois moins de lots
  -- par roue, et un client qui ne sait plus laquelle tourner.
  shop_id uuid not null unique references public.shops (id) on delete cascade,

  title text not null default 'Roue de la chance',
  title_ar text,

  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  -- Sans fin : la roue tourne tant que le commerçant la laisse active.
  ends_at timestamptz,

  -- Un tour par jour et par personne, par défaut. Zéro pour ne pas limiter.
  spins_per_day integer not null default 1 check (spins_per_day between 0 and 20),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shop_wheels_fenetre check (ends_at is null or ends_at > starts_at)
);

comment on table public.shop_wheels is
  'La roue d''une boutique : ses lots, sa fenêtre, son quota de tours.';

/* ─── 2 · Les lots ────────────────────────────────────────────────────── */

create table if not exists public.wheel_prizes (
  id uuid primary key default gen_random_uuid(),

  wheel_id uuid not null references public.shop_wheels (id) on delete cascade,

  label text not null check (btrim(label) <> ''),
  label_ar text,

  /*
    Le poids, et non une probabilité en pour cent.

    Des pourcentages doivent faire cent : le commerçant qui en change un doit
    corriger les autres, et le jour où la somme fait 97, que se passe-t-il ?
    Des poids se comparent entre eux — « 1 » contre « 40 » — et rien n'est
    jamais incohérent.
  */
  weight integer not null default 1 check (weight between 0 and 10000),

  /* Faux : « Perdu, retentez demain ». Une roue sans case perdante n'est pas
     une roue, c'est une distribution — et elle ruine son commerçant. */
  is_win boolean not null default true,

  /* Null : sans limite. Zéro : épuisé, le lot cesse d'être tiré. */
  stock integer check (stock is null or stock >= 0),

  position integer not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists wheel_prizes_roue_idx on public.wheel_prizes (wheel_id, position);

/* ─── 3 · Les tours joués ─────────────────────────────────────────────── */

create table if not exists public.wheel_spins (
  id uuid primary key default gen_random_uuid(),

  wheel_id uuid not null references public.shop_wheels (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  prize_id uuid references public.wheel_prizes (id) on delete set null,

  /* Ce que le client montre au comptoir. Court, lisible à voix haute. */
  code text not null,

  claimed_at timestamptz,
  claimed_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),

  constraint wheel_spins_code unique (code)
);

create index if not exists wheel_spins_jour_idx on public.wheel_spins (wheel_id, user_id, created_at desc);
create index if not exists wheel_spins_client_idx on public.wheel_spins (user_id, created_at desc);

/* ─── 4 · Qui voit quoi ───────────────────────────────────────────────── */

alter table public.shop_wheels  enable row level security;
alter table public.shop_wheels  force  row level security;
alter table public.wheel_prizes enable row level security;
alter table public.wheel_prizes force  row level security;
alter table public.wheel_spins  enable row level security;
alter table public.wheel_spins  force  row level security;

drop policy if exists shop_wheels_select on public.shop_wheels;
create policy shop_wheels_select on public.shop_wheels
  for select using (
    public.owns_shop(shop_id)
    or public.is_admin()
    or (
      is_active
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
      and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    )
  );

drop policy if exists shop_wheels_ecrire on public.shop_wheels;
create policy shop_wheels_ecrire on public.shop_wheels
  for all using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

/*
  Les lots ne sont pas publics.

  Un client qui lit les poids sait que le gros lot sort une fois sur mille et
  n'essaie pas ; un client qui lit les stocks sait qu'il ne reste rien. La
  roue montre ses cases — c'est `roue_lots_publics` qui les donne, sans poids
  ni stock — et la table reste au commerçant.
*/
drop policy if exists wheel_prizes_ecrire on public.wheel_prizes;
create policy wheel_prizes_ecrire on public.wheel_prizes
  for all using (
    exists (select 1 from public.shop_wheels w where w.id = wheel_id and (public.owns_shop(w.shop_id) or public.is_admin()))
  ) with check (
    exists (select 1 from public.shop_wheels w where w.id = wheel_id and (public.owns_shop(w.shop_id) or public.is_admin()))
  );

drop policy if exists wheel_spins_select on public.wheel_spins;
create policy wheel_spins_select on public.wheel_spins
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.shop_wheels w where w.id = wheel_id and public.owns_shop(w.shop_id))
  );

/* Le commerçant marque un lot remis ; personne n'insère un tour à la main. */
drop policy if exists wheel_spins_update on public.wheel_spins;
create policy wheel_spins_update on public.wheel_spins
  for update using (
    exists (select 1 from public.shop_wheels w where w.id = wheel_id and (public.owns_shop(w.shop_id) or public.is_admin()))
  ) with check (
    exists (select 1 from public.shop_wheels w where w.id = wheel_id and (public.owns_shop(w.shop_id) or public.is_admin()))
  );

/* ─── 5 · Les cases, telles que le client peut les voir ───────────────── */

/*
  La colonne rendue s'appelle `rang`, et non `position`.

  `position` est un mot réservé de PostgreSQL — la fonction `position(x in y)`
  du standard SQL. Il passe comme nom de colonne dans une table, il est refusé
  dans la signature d'une fonction. Le quoter marcherait ; le renommer évite
  qu'un jour quelqu'un retire les guillemets sans savoir pourquoi ils étaient
  là. La colonne de la table, elle, garde son nom.
*/
create or replace function public.roue_lots_publics(p_wheel uuid)
returns table (id uuid, label text, label_ar text, is_win boolean, rang integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.label, p.label_ar, p.is_win, p.position
  from public.wheel_prizes p
  join public.shop_wheels w on w.id = p.wheel_id
  join public.shops s on s.id = w.shop_id
  where p.wheel_id = p_wheel
    and s.status = 'approved'
    and (w.is_active or public.owns_shop(w.shop_id) or public.is_admin())
  order by p.position, p.created_at;
$$;

revoke all on function public.roue_lots_publics(uuid) from public;
grant execute on function public.roue_lots_publics(uuid) to anon, authenticated;

/* ─── 6 · Le tirage ───────────────────────────────────────────────────── */

create or replace function public.roue_tourner(p_wheel uuid)
returns table (prize_id uuid, label text, label_ar text, is_win boolean, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  roue      public.shop_wheels%rowtype;
  joues     integer;
  total     integer;
  tirage    integer;
  cumul     integer := 0;
  gagnant   public.wheel_prizes%rowtype;
  reference text;
begin
  if auth.uid() is null then
    raise exception 'ROUE_CONNEXION' using errcode = 'insufficient_privilege';
  end if;

  /*
    Verrouillée le temps du tirage.

    Sans ce verrou, deux tours simultanés lisent le même stock et repartent
    tous deux avec le dernier lot. C'est le défaut classique des jeux de
    hasard en ligne, et il se produit précisément quand on ne l'attend pas :
    à la seconde où le commerçant annonce sa roue.
  */
  select * into roue from public.shop_wheels where id = p_wheel for update;

  if not found or not roue.is_active then
    raise exception 'ROUE_FERMEE' using errcode = 'check_violation';
  end if;
  if roue.starts_at > now() or (roue.ends_at is not null and roue.ends_at <= now()) then
    raise exception 'ROUE_FERMEE' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.shops s where s.id = roue.shop_id and s.status = 'approved') then
    raise exception 'ROUE_FERMEE' using errcode = 'check_violation';
  end if;

  -- Le quota du jour, compté ici : l'écran ne fait que l'annoncer.
  if roue.spins_per_day > 0 then
    select count(*) into joues
    from public.wheel_spins
    where wheel_id = p_wheel and user_id = auth.uid()
      and created_at >= date_trunc('day', now());

    if joues >= roue.spins_per_day then
      raise exception 'ROUE_QUOTA' using errcode = 'check_violation';
    end if;
  end if;

  -- Les lots encore tirables : poids non nul, stock non épuisé.
  select coalesce(sum(weight), 0) into total
  from public.wheel_prizes
  where wheel_id = p_wheel and weight > 0 and (stock is null or stock > 0);

  if total = 0 then
    raise exception 'ROUE_VIDE' using errcode = 'check_violation';
  end if;

  tirage := floor(random() * total)::integer;

  for gagnant in
    select * from public.wheel_prizes
    where wheel_id = p_wheel and weight > 0 and (stock is null or stock > 0)
    order by position, created_at
  loop
    cumul := cumul + gagnant.weight;
    exit when tirage < cumul;
  end loop;

  if gagnant.stock is not null then
    update public.wheel_prizes set stock = stock - 1 where id = gagnant.id;
  end if;

  /*
    Six caractères, sans 0 ni 1.

    Ce code se lit à voix haute au comptoir : le zéro et le un s'y confondent
    avec le O et le I. `md5` plutôt que `gen_random_bytes` pour ne dépendre
    d'aucune extension — ce n'est pas un secret, seulement une référence, et
    la contrainte d'unicité rattrape une collision improbable.
  */
  reference := upper(
    substr(translate(md5(random()::text || clock_timestamp()::text), '01', 'xy'), 1, 6)
  );

  insert into public.wheel_spins (wheel_id, user_id, prize_id, code)
  values (p_wheel, auth.uid(), gagnant.id, reference);

  return query select gagnant.id, gagnant.label, gagnant.label_ar, gagnant.is_win, reference;
end;
$$;

revoke all on function public.roue_tourner(uuid) from public, anon;
grant execute on function public.roue_tourner(uuid) to authenticated;

/* ─── 7 · Les roues ouvertes, pour l'invitation de l'accueil ──────────── */

create or replace function public.roues_ouvertes()
returns table (
  wheel_id uuid,
  title text,
  title_ar text,
  shop_name text,
  shop_slug text,
  shop_logo text,
  deja_joue boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    w.id, w.title, w.title_ar, s.name, s.slug, s.logo_url,
    coalesce(
      w.spins_per_day > 0
      and (
        select count(*) from public.wheel_spins sp
        where sp.wheel_id = w.id and sp.user_id = auth.uid()
          and sp.created_at >= date_trunc('day', now())
      ) >= w.spins_per_day,
      false
    )
  from public.shop_wheels w
  join public.shops s on s.id = w.shop_id
  where w.is_active
    and s.status = 'approved'
    and w.starts_at <= now()
    and (w.ends_at is null or w.ends_at > now())
    and exists (
      select 1 from public.wheel_prizes p
      where p.wheel_id = w.id and p.weight > 0 and (p.stock is null or p.stock > 0)
    )
  order by w.created_at desc
  limit 10;
$$;

revoke all on function public.roues_ouvertes() from public;
grant execute on function public.roues_ouvertes() to anon, authenticated;

drop trigger if exists trg_shop_wheels_touch on public.shop_wheels;
create trigger trg_shop_wheels_touch before update on public.shop_wheels
  for each row execute function public.touch_updated_at();

grant select on public.shop_wheels, public.wheel_spins to anon, authenticated;

/*
  Le commerçant lit ses lots depuis son écran, avec leurs poids et leurs
  stocks : il lui faut donc le droit de table. Ce n'est pas une ouverture —
  la policy d'écriture, qui couvre aussi la lecture, ne rend les lignes qu'au
  propriétaire de la roue. Sans ce droit, son propre écran se voyait refuser
  la lecture, et les clients n'y gagnaient rien.
*/
grant select on public.wheel_prizes to authenticated;
grant insert, update, delete on public.shop_wheels, public.wheel_prizes to authenticated;
grant update on public.wheel_spins to authenticated;
