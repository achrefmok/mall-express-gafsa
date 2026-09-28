-- Une boutique naît toujours « en attente », quelle que soit la façon de la créer.
--
-- Le garde `guard_shop_privileges` ne couvrait que les MODIFICATIONS : un
-- commerçant ne pouvait pas se valider lui-même par un update. Mais la policy
-- d'insertion (`shops_insert_own`) ne vérifie que le propriétaire — un appel
-- direct à l'API pouvait donc créer une boutique déjà `approved` et
-- `is_featured`, sans jamais passer par l'administration.
--
-- Le garde couvre maintenant aussi l'insertion : hors administration et hors
-- contexte de service, l'état de validation et les compteurs sont ramenés à
-- leurs valeurs d'origine. La création normale (déclencheur d'inscription,
-- `createMyShop`) n'envoie déjà rien de tout cela : rien ne change pour elle.

create or replace function public.guard_shop_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_service_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status           := 'pending';
    new.approved_at      := null;
    new.approved_by      := null;
    new.is_featured      := false;
    new.rejection_reason := null;
    new.missing_document := null;
    new.rating_sum       := 0;
    new.rating_count     := 0;
    new.followers_count  := 0;
    return new;
  end if;

  new.status           := old.status;
  new.approved_at      := old.approved_at;
  new.approved_by      := old.approved_by;
  new.is_featured      := old.is_featured;
  new.rejection_reason := old.rejection_reason;
  new.missing_document := old.missing_document;
  new.rating_sum       := old.rating_sum;
  new.rating_count     := old.rating_count;
  new.followers_count  := old.followers_count;
  return new;
end;
$$;

drop trigger if exists trg_shops_guard on public.shops;
create trigger trg_shops_guard
  before insert or update on public.shops
  for each row execute function public.guard_shop_privileges();
