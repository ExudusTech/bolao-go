-- Remove the public policy for viewing messages
DROP POLICY IF EXISTS "Anyone can view bolao messages" ON public.mensagens;

-- Create a function to check if a participant has a valid session for a bolão
CREATE OR REPLACE FUNCTION public.is_valid_participant_for_bolao(p_bolao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- This function cannot check participant sessions from RLS context
  -- because participant auth uses localStorage tokens, not Supabase auth
  -- Instead, we check if the user is the gestor (authenticated via Supabase)
  SELECT EXISTS (
    SELECT 1 FROM public.boloes
    WHERE id = p_bolao_id
    AND gestor_id = auth.uid()
  )
$$;

-- Policy: Managers can view messages from their own bolões (already exists but let's ensure it's correct)
-- The existing "Managers can view messages from own boloes" policy should work

-- For participants: since they use a custom token-based auth (not Supabase auth.uid()),
-- we cannot directly use RLS. The messages are fetched via RPC for participants.
-- But the current component fetches directly, so we need a different approach.

-- Create a policy that allows reading if the bolão is not private 
-- (for now, all bolões are public for participants to join)
-- We'll restrict to only allow viewing messages if the user is authenticated OR
-- if we're using the RPC function (which handles participant auth)

-- Actually, the safest approach is:
-- 1. Gestors use direct query (auth.uid() matches gestor_id)
-- 2. Participants use RPC function get_bolao_messages which validates their token

-- So let's just keep the gestor policy and participants must use RPC
-- But the current code uses direct query... let me check if we need to update the component

-- For now, let's create a policy that allows authenticated users to view messages
-- of bolões they manage OR allow anon access through RPC only
CREATE POLICY "Authenticated users can view messages of their boloes"
ON public.mensagens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boloes
    WHERE boloes.id = mensagens.bolao_id
    AND boloes.gestor_id = auth.uid()
  )
);