-- Remove the insecure send_participant_message_by_apelido function
-- This function allows anyone to send messages by just knowing an apelido
-- All participants must now use send_participant_message with token authentication

DROP FUNCTION IF EXISTS public.send_participant_message_by_apelido(UUID, TEXT, TEXT);

-- Revoke any grants (in case they exist)
-- Note: DROP FUNCTION already removes grants, but this is explicit
