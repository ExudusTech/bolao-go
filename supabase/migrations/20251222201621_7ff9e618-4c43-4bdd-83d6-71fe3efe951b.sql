-- Create session logs table for monitoring suspicious access patterns
CREATE TABLE public.session_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID,
  bolao_id UUID NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  apelido TEXT NOT NULL,
  action TEXT NOT NULL, -- 'login', 'logout', 'validate', 'send_message', 'delete_message', 'update_message'
  success BOOLEAN NOT NULL DEFAULT true,
  ip_hint TEXT, -- Optional: first 3 octets only for privacy
  user_agent_hint TEXT, -- Optional: browser family only
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_session_logs_bolao_id ON public.session_logs(bolao_id);
CREATE INDEX idx_session_logs_apelido ON public.session_logs(apelido);
CREATE INDEX idx_session_logs_created_at ON public.session_logs(created_at DESC);
CREATE INDEX idx_session_logs_action ON public.session_logs(action);

-- Enable RLS
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

-- Managers can view logs for their own bolões
CREATE POLICY "Managers can view session logs for own boloes"
ON public.session_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.boloes
    WHERE boloes.id = session_logs.bolao_id
    AND boloes.gestor_id = auth.uid()
  )
);

-- Admins can view all logs
CREATE POLICY "Admins can view all session logs"
ON public.session_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- No direct insert/update/delete - only via security definer functions
CREATE POLICY "No direct modifications to session logs"
ON public.session_logs
FOR ALL
USING (false)
WITH CHECK (false);

-- Helper function to log session activity
CREATE OR REPLACE FUNCTION public.log_session_activity(
  p_session_id UUID,
  p_bolao_id UUID,
  p_apelido TEXT,
  p_action TEXT,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.session_logs (session_id, bolao_id, apelido, action, success, error_message)
  VALUES (p_session_id, p_bolao_id, p_apelido, p_action, p_success, p_error_message);
END;
$$;

-- Update participant_login to log activity
CREATE OR REPLACE FUNCTION public.participant_login(p_bolao_id uuid, p_apelido text, p_senha text)
RETURNS json
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
    -- Log failed login attempt
    PERFORM public.log_session_activity(NULL, p_bolao_id, p_apelido, 'login_failed', false, 'Credenciais inválidas');
    RETURN json_build_object('success', false, 'error', 'Credenciais inválidas');
  END IF;
  
  -- Generate secure token
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  
  -- Clean up old sessions for this bet
  DELETE FROM public.participant_sessions 
  WHERE aposta_id = v_aposta.id;
  
  -- Create new session
  INSERT INTO public.participant_sessions (bolao_id, aposta_id, token, apelido)
  VALUES (p_bolao_id, v_aposta.id, v_token, v_aposta.apelido)
  RETURNING id INTO v_session_id;
  
  -- Log successful login
  PERFORM public.log_session_activity(v_session_id, p_bolao_id, v_aposta.apelido, 'login', true);
  
  RETURN json_build_object(
    'success', true,
    'token', v_token,
    'apelido', v_aposta.apelido,
    'aposta_id', v_aposta.id
  );
END;
$$;

-- Update participant_logout to log activity
CREATE OR REPLACE FUNCTION public.participant_logout(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Get session info before deleting
  SELECT * INTO v_session
  FROM public.participant_sessions
  WHERE token = p_token;
  
  IF v_session IS NOT NULL THEN
    -- Log logout
    PERFORM public.log_session_activity(v_session.id, v_session.bolao_id, v_session.apelido, 'logout', true);
  END IF;
  
  DELETE FROM public.participant_sessions WHERE token = p_token;
  RETURN json_build_object('success', true);
END;
$$;

-- Update send_participant_message to log activity
CREATE OR REPLACE FUNCTION public.send_participant_message(p_bolao_id uuid, p_token text, p_content text)
RETURNS json
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
    PERFORM public.log_session_activity(v_session.id, p_bolao_id, v_session.apelido, 'send_message', false, 'Conteúdo inválido');
    RETURN json_build_object('success', false, 'error', 'Mensagem deve ter entre 1 e 500 caracteres');
  END IF;
  
  -- Insert message
  INSERT INTO public.mensagens (bolao_id, autor_nome, autor_celular, conteudo)
  VALUES (p_bolao_id, v_session.apelido, NULL, TRIM(p_content))
  RETURNING id INTO v_message_id;
  
  -- Log message sent
  PERFORM public.log_session_activity(v_session.id, p_bolao_id, v_session.apelido, 'send_message', true);
  
  RETURN json_build_object('success', true, 'message_id', v_message_id);
END;
$$;

-- Update delete_participant_message to log activity
CREATE OR REPLACE FUNCTION public.delete_participant_message(p_bolao_id uuid, p_token text, p_message_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    PERFORM public.log_session_activity(v_session.id, p_bolao_id, v_session.apelido, 'delete_message', false, 'Mensagem não encontrada');
    RETURN json_build_object('success', false, 'error', 'Mensagem não encontrada ou você não tem permissão para excluí-la');
  END IF;
  
  -- Delete the message
  DELETE FROM public.mensagens WHERE id = p_message_id;
  
  -- Log message deleted
  PERFORM public.log_session_activity(v_session.id, p_bolao_id, v_session.apelido, 'delete_message', true);
  
  RETURN json_build_object('success', true);
END;
$$;

-- Update update_participant_message to log activity
CREATE OR REPLACE FUNCTION public.update_participant_message(p_bolao_id uuid, p_token text, p_message_id uuid, p_content text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    PERFORM public.log_session_activity(v_session.id, p_bolao_id, v_session.apelido, 'update_message', false, 'Conteúdo inválido');
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
    PERFORM public.log_session_activity(v_session.id, p_bolao_id, v_session.apelido, 'update_message', false, 'Mensagem não encontrada');
    RETURN json_build_object('success', false, 'error', 'Mensagem não encontrada ou você não tem permissão para editá-la');
  END IF;
  
  -- Update the message
  UPDATE public.mensagens 
  SET conteudo = TRIM(p_content)
  WHERE id = p_message_id;
  
  -- Log message updated
  PERFORM public.log_session_activity(v_session.id, p_bolao_id, v_session.apelido, 'update_message', true);
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function to get session logs for a bolão (for managers)
CREATE OR REPLACE FUNCTION public.get_session_logs(p_bolao_id uuid, p_limit integer DEFAULT 100)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logs json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', sl.id,
      'apelido', sl.apelido,
      'action', sl.action,
      'success', sl.success,
      'error_message', sl.error_message,
      'created_at', sl.created_at
    ) ORDER BY sl.created_at DESC
  ) INTO v_logs
  FROM public.session_logs sl
  WHERE sl.bolao_id = p_bolao_id
  LIMIT p_limit;
  
  RETURN json_build_object(
    'success', true,
    'logs', COALESCE(v_logs, '[]'::json)
  );
END;
$$;

-- Function to detect suspicious patterns (multiple failed logins)
CREATE OR REPLACE FUNCTION public.get_suspicious_activity(p_bolao_id uuid, p_hours integer DEFAULT 24)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suspicious json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'apelido', apelido,
      'failed_attempts', failed_count,
      'last_attempt', last_attempt
    )
  ) INTO v_suspicious
  FROM (
    SELECT 
      apelido,
      COUNT(*) FILTER (WHERE NOT success) as failed_count,
      MAX(created_at) as last_attempt
    FROM public.session_logs
    WHERE bolao_id = p_bolao_id
      AND action = 'login_failed'
      AND created_at > now() - (p_hours || ' hours')::interval
    GROUP BY apelido
    HAVING COUNT(*) FILTER (WHERE NOT success) >= 3
    ORDER BY failed_count DESC
  ) suspicious;
  
  RETURN json_build_object(
    'success', true,
    'suspicious_activity', COALESCE(v_suspicious, '[]'::json)
  );
END;
$$;