
-- Add columns for phone anonymization
ALTER TABLE public.apostas 
ADD COLUMN IF NOT EXISTS celular_hash TEXT,
ADD COLUMN IF NOT EXISTS celular_ultimos4 TEXT;

-- Update existing records with anonymized phone data
UPDATE public.apostas 
SET 
  celular_hash = encode(sha256(celular::bytea), 'hex'),
  celular_ultimos4 = RIGHT(celular, 4)
WHERE celular_hash IS NULL;

-- Create participant sessions table
CREATE TABLE IF NOT EXISTS public.participant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bolao_id UUID NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  aposta_id UUID NOT NULL REFERENCES public.apostas(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  apelido TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Enable RLS on sessions table
ALTER TABLE public.participant_sessions ENABLE ROW LEVEL SECURITY;

-- Sessions can only be managed via functions (no direct access)
CREATE POLICY "No direct access to sessions"
ON public.participant_sessions
FOR ALL
USING (false);

-- Function: Participant login
CREATE OR REPLACE FUNCTION public.participant_login(
  p_bolao_id UUID,
  p_apelido TEXT,
  p_senha TEXT -- last 4 digits of phone
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aposta RECORD;
  v_token TEXT;
  v_session_id UUID;
BEGIN
  -- Find bet matching apelido and last 4 digits in this bolao
  SELECT id, apelido INTO v_aposta
  FROM public.apostas
  WHERE bolao_id = p_bolao_id
    AND LOWER(TRIM(apelido)) = LOWER(TRIM(p_apelido))
    AND celular_ultimos4 = p_senha
  LIMIT 1;
  
  IF v_aposta IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Credenciais inválidas');
  END IF;
  
  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'hex');
  
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
$$;

-- Function: Validate participant token
CREATE OR REPLACE FUNCTION public.validate_participant_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT ps.*, b.nome_do_bolao 
  INTO v_session
  FROM public.participant_sessions ps
  JOIN public.boloes b ON b.id = ps.bolao_id
  WHERE ps.token = p_token
    AND ps.expires_at > now();
  
  IF v_session IS NULL THEN
    RETURN json_build_object('valid', false);
  END IF;
  
  RETURN json_build_object(
    'valid', true,
    'bolao_id', v_session.bolao_id,
    'aposta_id', v_session.aposta_id,
    'apelido', v_session.apelido,
    'bolao_nome', v_session.nome_do_bolao
  );
END;
$$;

-- Function: Get messages for authenticated participant
CREATE OR REPLACE FUNCTION public.get_bolao_messages(p_bolao_id UUID, p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_messages JSON;
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
  
  -- Get messages without exposing celular
  SELECT json_agg(
    json_build_object(
      'id', id,
      'bolao_id', bolao_id,
      'autor_nome', autor_nome,
      'autor_gestor_id', autor_gestor_id,
      'conteudo', conteudo,
      'created_at', created_at
    ) ORDER BY created_at ASC
  ) INTO v_messages
  FROM public.mensagens
  WHERE bolao_id = p_bolao_id;
  
  RETURN json_build_object('success', true, 'messages', COALESCE(v_messages, '[]'::json));
END;
$$;

-- Function: Send message as participant
CREATE OR REPLACE FUNCTION public.send_participant_message(
  p_bolao_id UUID,
  p_token TEXT,
  p_content TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_message_id UUID;
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
  
  -- Insert message (celular stored as hash for reference, not exposed)
  INSERT INTO public.mensagens (bolao_id, autor_nome, autor_celular, conteudo)
  VALUES (p_bolao_id, v_session.apelido, NULL, TRIM(p_content))
  RETURNING id INTO v_message_id;
  
  RETURN json_build_object('success', true, 'message_id', v_message_id);
END;
$$;

-- Function: Participant logout
CREATE OR REPLACE FUNCTION public.participant_logout(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.participant_sessions WHERE token = p_token;
  RETURN json_build_object('success', true);
END;
$$;

-- Update validate_aposta trigger to set anonymized fields
CREATE OR REPLACE FUNCTION public.validate_aposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate apelido length (2-50 characters)
  IF length(NEW.apelido) < 2 OR length(NEW.apelido) > 50 THEN
    RAISE EXCEPTION 'Apelido deve ter entre 2 e 50 caracteres';
  END IF;
  
  -- Validate celular format (10-11 digits, Brazilian format)
  IF NEW.celular !~ '^[1-9]{2}9?[0-9]{8}$' THEN
    RAISE EXCEPTION 'Celular deve ter 10 ou 11 dígitos em formato brasileiro válido';
  END IF;
  
  -- Validate dezenas count (exactly 6)
  IF array_length(NEW.dezenas, 1) IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'Deve selecionar exatamente 6 números';
  END IF;
  
  -- Validate dezenas range (1-60)
  IF EXISTS (SELECT 1 FROM unnest(NEW.dezenas) num WHERE num < 1 OR num > 60) THEN
    RAISE EXCEPTION 'Números devem estar entre 1 e 60';
  END IF;
  
  -- Validate dezenas uniqueness
  IF (SELECT count(DISTINCT num) FROM unnest(NEW.dezenas) num) != 6 THEN
    RAISE EXCEPTION 'Os números devem ser diferentes';
  END IF;
  
  -- Set anonymized phone fields
  NEW.celular_hash := encode(sha256(NEW.celular::bytea), 'hex');
  NEW.celular_ultimos4 := RIGHT(NEW.celular, 4);
  
  RETURN NEW;
END;
$$;

-- Drop the overly permissive policy on mensagens
DROP POLICY IF EXISTS "Participants can view messages from boloes they bet on" ON public.mensagens;

-- Create proper policy for managers only (participants use functions)
CREATE POLICY "Only managers can view messages directly"
ON public.mensagens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.boloes
    WHERE boloes.id = mensagens.bolao_id
    AND boloes.gestor_id = auth.uid()
  )
);
