-- Remove overly permissive policy that exposes phone numbers
DROP POLICY IF EXISTS "Public can view apostas count" ON public.apostas;