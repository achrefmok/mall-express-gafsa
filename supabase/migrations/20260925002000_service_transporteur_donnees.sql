-- Deuxième bloc, à coller après le premier (voir 20260925001000) : la valeur
-- d'énumération doit être validée avant qu'une ligne ne puisse s'en servir.

insert into public.practical_services (kind, name, name_ar, phone, address, info, hue, monogram, sort_order)
values (
  'transporteur',
  'Transporteur',
  'نقل الأغراض',
  null,
  'Gafsa',
  'Déménagement, livraison de meubles et gros colis',
  135,
  'TR',
  3
)
on conflict do nothing;
