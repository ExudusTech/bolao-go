-- Drop the duplicate/restrictive manager view policy
DROP POLICY IF EXISTS "Only managers can view messages directly" ON public.mensagens;

-- Add policy allowing anyone to view messages of a bolão (participants need to see messages)
CREATE POLICY "Anyone can view bolao messages"
ON public.mensagens
FOR SELECT
TO anon, authenticated
USING (true);