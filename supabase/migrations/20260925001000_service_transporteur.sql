-- ═══════════════════════════════════════════════════════════════════════
-- Nouveau service pratique : Transporteur.
--
-- `ALTER TYPE ... ADD VALUE` ne peut pas partager une transaction avec la
-- requête qui utilise cette valeur (restriction Postgres) — d'où deux blocs
-- séparés. Collez ce fichier en une fois dans l'éditeur SQL Supabase : chaque
-- instruction s'y exécute et se valide indépendamment, ce que ne ferait pas
-- `psql` en mode script.
-- ═══════════════════════════════════════════════════════════════════════

alter type public.practical_service_kind add value if not exists 'transporteur';
