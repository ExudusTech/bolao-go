-- Add function to allow participants to delete their own messages
CREATE OR REPLACE FUNCTION public.delete_participant_message(p_bolao_id uuid, p_token text, p_message_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_message RECORD;
BEGIN
  -- Validate token
  SELECT * INTO v_session
  FROM public.participant_sessions
  WHERE token = p_token
    AND bolao_id = p_bolao_id
    AND expires_at > now();
  
  IF v_session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sessão inválida ou expirada');
  END IF;
  
  -- Check if message belongs to this participant
  SELECT * INTO v_message
  FROM public.mensagens
  WHERE id = p_message_id
    AND bolao_id = p_bolao_id
    AND autor_nome = v_session.apelido
    AND autor_gestor_id IS NULL;
  
  IF v_message IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Mensagem não encontrada ou você não tem permissão para excluí-la');
  END IF;
  
  -- Delete the message
  DELETE FROM public.mensagens WHERE id = p_message_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Add function to allow participants to update their own messages
CREATE OR REPLACE FUNCTION public.update_participant_message(p_bolao_id uuid, p_token text, p_message_id uuid, p_content text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_message RECORD;
BEGIN
  -- Validate token
  SELECT * INTO v_session
  FROM public.participant_sessions
  WHERE token = p_token
    AND bolao_id = p_bolao_id
    AND expires_at > now();
  
  IF v_session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sessão inválida ou expirada');
  END IF;
  
  -- Validate content
  IF length(TRIM(p_content)) < 1 OR length(p_content) > 500 THEN
    RETURN json_build_object('success', false, 'error', 'Mensagem deve ter entre 1 e 500 caracteres');
  END IF;
  
  -- Check if message belongs to this participant
  SELECT * INTO v_message
  FROM public.mensagens
  WHERE id = p_message_id
    AND bolao_id = p_bolao_id
    AND autor_nome = v_session.apelido
    AND autor_gestor_id IS NULL;
  
  IF v_message IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Mensagem não encontrada ou você não tem permissão para editá-la');
  END IF;
  
  -- Update the message
  UPDATE public.mensagens 
  SET conteudo = TRIM(p_content)
  WHERE id = p_message_id;
  
  RETURN json_build_object('success', true);
END;
$$;