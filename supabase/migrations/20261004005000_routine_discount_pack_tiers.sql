-- Remise sur la routine Beauté, et paliers du pack composé Parapharmacie —
-- deux valeurs codées en dur dans leurs mises en page respectives jusqu'ici,
-- maintenant réglables par le vendeur. Valeurs par défaut identiques à ce
-- qui était déjà affiché, pour ne rien changer tant que personne n'y touche.

alter table public.shops
  add column if not exists routine_discount smallint not null default 10
    check (routine_discount between 0 and 90),
  add column if not exists pack_tiers jsonb not null default '[{"min":2,"pct":10},{"min":3,"pct":15}]'::jsonb;
