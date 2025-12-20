-- Drop the restrictive policy
DROP POLICY IF EXISTS "Anyone can insert apostas" ON public.apostas;

-- Create a permissive policy for public inserts
CREATE POLICY "Anyone can insert apostas"
ON public.apostas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);