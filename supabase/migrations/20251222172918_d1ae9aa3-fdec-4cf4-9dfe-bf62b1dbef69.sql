-- Create a secure RPC function for participant global login verification
-- This avoids exposing the apostas table directly to anonymous users

CREATE OR REPLACE FUNCTION public.verify_participant_global_login(
  p_apelido TEXT,
  p_senha TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aposta RECORD;
BEGIN
  -- Find an aposta matching the apelido and last 4 digits
  SELECT id, apelido INTO v_aposta
  FROM public.apostas
  WHERE LOWER(TRIM(apelido)) = LOWER(TRIM(p_apelido))
    AND celular_ultimos4 = p_senha
  LIMIT 1;
  
  IF v_aposta IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Credenciais inválidas');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'apelido', v_aposta.apelido
  );
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.verify_participant_global_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_participant_global_login(TEXT, TEXT) TO authenticated;