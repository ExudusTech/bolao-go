-- Criar função para buscar mensagens do bolão sem necessidade de token (via apelido)
CREATE OR REPLACE FUNCTION public.get_bolao_messages_public(p_bolao_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'success', true,
    'messages', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', m.id,
          'autor_nome', m.autor_nome,
          'autor_gestor_id', m.autor_gestor_id,
          'conteudo', m.conteudo,
          'created_at', m.created_at
        ) ORDER BY m.created_at ASC
      ), '[]'::json)
      FROM mensagens m
      WHERE m.bolao_id = p_bolao_id
    )
  );
END;
$$;

-- Criar função para enviar mensagem como participante usando apelido
CREATE OR REPLACE FUNCTION public.send_participant_message_by_apelido(
  p_bolao_id UUID,
  p_apelido TEXT,
  p_content TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_exists BOOLEAN;
BEGIN
  -- Verificar se o participante existe no bolão
  SELECT EXISTS(
    SELECT 1 FROM apostas
    WHERE bolao_id = p_bolao_id
    AND LOWER(apelido) = LOWER(p_apelido)
  ) INTO v_participant_exists;
  
  IF NOT v_participant_exists THEN
    RETURN json_build_object('success', false, 'error', 'Participante não encontrado neste bolão');
  END IF;
  
  -- Inserir a mensagem
  INSERT INTO mensagens (bolao_id, autor_nome, autor_celular, conteudo)
  VALUES (p_bolao_id, p_apelido, 'participant', p_content);
  
  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_bolao_messages_public(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_participant_message_by_apelido(UUID, TEXT, TEXT) TO anon, authenticated;