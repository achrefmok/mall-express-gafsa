-- États de course étendus + coordonnées destination
--
-- ════════════════════════════════════════════════════════════════════════
-- La course passait directement de "acceptee" à terminée. On ajoute les
-- états intermédiaires qui décrivent le vrai parcours :
--
--   en_attente → acceptee → driver_arriving → picked_up → in_progress → completed
--                 ↘ refusee / expiree / annulee
-- ════════════════════════════════════════════════════════════════════════

/* ─── Étendre la contrainte check sur status ──────────────────────────── */

-- Supprimer l'ancienne contrainte et en recréer une incluant les nouveaux états
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  WHERE c.conrelid = 'public.taxi_requests'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%en_attente%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.taxi_requests DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.taxi_requests
  ADD CONSTRAINT taxi_requests_status_check
  CHECK (status IN (
    'en_attente', 'acceptee', 'refusee', 'expiree', 'annulee',
    'driver_arriving', 'picked_up', 'in_progress', 'completed'
  ));

/* ─── Ajouter les coordonnées GPS de la destination ───────────────────── */

ALTER TABLE public.taxi_requests
  ADD COLUMN IF NOT EXISTS dest_lat double precision,
  ADD COLUMN IF NOT EXISTS dest_lng double precision;

COMMENT ON COLUMN public.taxi_requests.dest_lat IS
  'Latitude de la destination pour calcul distance/temps.';
COMMENT ON COLUMN public.taxi_requests.dest_lng IS
  'Longitude de la destination.';

/* ─── Index pour les courses en cours ──────────────────────────────────── */

CREATE INDEX IF NOT EXISTS taxi_requests_active_idx
  ON public.taxi_requests (driver_id, status, created_at DESC)
  WHERE status IN ('acceptee', 'driver_arriving', 'picked_up', 'in_progress')
    AND driver_id IS NOT NULL;
