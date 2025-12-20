-- Update participant_login to work with international phone format
CREATE OR REPLACE FUNCTION public.participant_login(p_bolao_id uuid, p_apelido text, p_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_aposta RECORD;
  v_token TEXT;
  v_session_id UUID;
BEGIN
  -- Find bet matching apelido and last 4 digits in this bolao
  -- celular_ultimos4 is set by trigger from the digits portion of the phone
  SELECT id, apelido INTO v_aposta
  FROM public.apostas
  WHERE bolao_id = p_bolao_id
    AND LOWER(TRIM(apelido)) = LOWER(TRIM(p_apelido))
    AND celular_ultimos4 = p_senha
  LIMIT 1;
  
  IF v_aposta IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Credenciais inválidas');
  END IF;
  
  -- Generate secure token using pgcrypto
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  
  -- Clean up old sessions for this bet
  DELETE FROM public.participant_sessions 
  WHERE aposta_id = v_aposta.id;
  
  -- Create new session
  INSERT INTO public.participant_sessions (bolao_id, aposta_id, token, apelido)
  VALUES (p_bolao_id, v_aposta.id, v_token, v_aposta.apelido)
  RETURNING id INTO v_session_id;
  
  RETURN json_build_object(
    'success', true,
    'token', v_token,
    'apelido', v_aposta.apelido,
    'aposta_id', v_aposta.id
  );
END;
$function$;

-- Update upload_receipt to work with international phone format
CREATE OR REPLACE FUNCTION public.upload_receipt(p_aposta_id uuid, p_receipt_url text, p_celular text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify ownership by phone number (now in format CC:digits)
  -- Also accept just digits for backwards compatibility
  UPDATE apostas
  SET receipt_url = p_receipt_url
  WHERE id = p_aposta_id
  AND (
    celular = p_celular 
    OR celular LIKE '%:' || regexp_replace(p_celular, '[^0-9]', '', 'g')
  )
  AND (receipt_url IS NULL OR receipt_url = '');
  
  RETURN FOUND;
END;
$function$;