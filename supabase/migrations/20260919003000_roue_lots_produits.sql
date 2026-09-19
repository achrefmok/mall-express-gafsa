-- Des cases faites de produits, de remises ou de photos — et qui s'effacent.
--
-- ════════════════════════════════════════════════════════════════════════
-- Ce que ce fichier corrige
-- ════════════════════════════════════════════════════════════════════════
--
-- Un lot épuisé cessait d'être tiré, mais restait dessiné sur la roue. Le
-- client voyait donc une case qu'il ne pouvait plus gagner, et pouvait
-- s'arrêter précisément dessus sans rien remporter — la roue mentait sans
-- que personne l'ait voulu.
--
-- Un commerçant qui met trois articles à un exemplaire veut exactement
-- l'inverse : qu'après le premier gagné il reste « deux articles et trois
-- cases perdantes », et que la roue le montre. C'est la fonction publique qui
-- change : elle écarte désormais ce qui n'est plus tirable. Le commerçant,
-- lui, continue de voir ses cases épuisées — il doit pouvoir les réapprovisionner.
--
-- ════════════════════════════════════════════════════════════════════════
-- Le produit derrière la case
-- ════════════════════════════════════════════════════════════════════════
--
-- Composer une roue en tapant six libellés à la main est un travail ingrat,
-- et on y écrit des noms qui ne correspondent à rien du catalogue. Une case
-- peut donc pointer un produit : son nom et sa photo viennent de la fiche,
-- et le commerçant n'a qu'à le choisir.
--
-- `on delete set null` plutôt que `cascade` : un produit retiré du catalogue
-- ne doit pas effacer la case d'une roue en cours, ni les tours déjà joués
-- qui y renvoient. Le libellé reste, la photo aussi.

alter table public.wheel_prizes
  add column if not exists image_url text,
  add column if not exists product_id uuid references public.products (id) on delete set null;

comment on column public.wheel_prizes.product_id is
  'La case vient d''un produit du catalogue. Son libellé et sa photo en sont recopiés, pas lus : le produit peut disparaître.';

create index if not exists wheel_prizes_produit_idx
  on public.wheel_prizes (product_id) where product_id is not null;

/* ─── Les cases visibles du client ────────────────────────────────────────
   Épuisées ou sans poids, elles sortent de la roue. Le commerçant garde les
   siennes sous les yeux : c'est lui qui remet du stock. */
create or replace function public.roue_lots_publics(p_wheel uuid)
returns table (
  id uuid,
  label text,
  label_ar text,
  is_win boolean,
  image_url text,
  rang integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.label, p.label_ar, p.is_win, p.image_url, p.position
  from public.wheel_prizes p
  join public.shop_wheels w on w.id = p.wheel_id
  join public.shops s on s.id = w.shop_id
  where p.wheel_id = p_wheel
    and s.status = 'approved'
    and (
      public.owns_shop(w.shop_id)
      or public.is_admin()
      or (w.is_active and p.weight > 0 and (p.stock is null or p.stock > 0))
    )
  order by p.position, p.created_at;
$$;

revoke all on function public.roue_lots_publics(uuid) from public;
grant execute on function public.roue_lots_publics(uuid) to anon, authenticated;

/* ─── Le tirage rend aussi la photo ──────────────────────────────────────
   L'écran de résultat montre ce qu'on vient de gagner. « Plateau grillé
   offert » écrit en toutes lettres est une promesse ; la photo du plateau en
   est une preuve. */
create or replace function public.roue_tourner(p_wheel uuid)
returns table (prize_id uuid, label text, label_ar text, is_win boolean, image_url text, code text)
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

  if roue.spins_per_day > 0 then
    select count(*) into joues
    from public.wheel_spins
    where wheel_id = p_wheel and user_id = auth.uid()
      and created_at >= date_trunc('day', now());

    if joues >= roue.spins_per_day then
      raise exception 'ROUE_QUOTA' using errcode = 'check_violation';
    end if;
  end if;

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

  reference := upper(
    substr(translate(md5(random()::text || clock_timestamp()::text), '01', 'xy'), 1, 6)
  );

  insert into public.wheel_spins (wheel_id, user_id, prize_id, code)
  values (p_wheel, auth.uid(), gagnant.id, reference);

  return query
    select gagnant.id, gagnant.label, gagnant.label_ar, gagnant.is_win, gagnant.image_url, reference;
end;
$$;

revoke all on function public.roue_tourner(uuid) from public, anon;
grant execute on function public.roue_tourner(uuid) to authenticated;
