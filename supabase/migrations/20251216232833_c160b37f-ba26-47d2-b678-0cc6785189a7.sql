-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Public can view apostas count" ON public.apostas;

-- The "Managers can view apostas of own boloes" policy already exists and is sufficient
-- Managers can see all bet details including phone numbers for their own bolões
-- Public users will see only the count from bolões.total_apostas field