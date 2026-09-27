-- ═══════════════════════════════════════════════════════════════════════
-- Rôle « exhibitor » : un exposant Lelma3ardh a désormais son propre compte,
-- distinct de l'administration Dahmani qui le crée.
--
-- ALTER TYPE ne peut pas partager une transaction avec la requête qui
-- utilise la valeur ajoutée — d'où ce fichier séparé, à coller en premier.
-- ═══════════════════════════════════════════════════════════════════════

alter type public.user_role add value if not exists 'exhibitor';
