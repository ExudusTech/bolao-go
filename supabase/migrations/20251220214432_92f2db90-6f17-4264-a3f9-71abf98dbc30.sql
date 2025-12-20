-- 1. Modify get_bolao_for_participation to NOT return chave_pix
CREATE OR REPLACE FUNCTION public.get_bolao_for_participation(bolao_id uuid)
 RETURNS TABLE(id uuid, nome_do_bolao text, chave_pix text, observacoes text, total_apostas integer, created_at timestamp with time zone, gestor_name text, encerrado boolean, numeros_sorteados integer[], resultado_verificado boolean, valor_cota numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    b.id,
    b.nome_do_bolao,
    NULL::text as chave_pix,  -- No longer expose PIX key publicly
    b.observacoes,
    b.total_apostas,
    b.created_at,
    p.name as gestor_name,
    b.encerrado,
    b.numeros_sorteados,
    COALESCE(b.resultado_verificado, false) as resultado_verificado,
    b.valor_cota
  FROM public.boloes b
  LEFT JOIN public.profiles p ON b.gestor_id = p.id
  WHERE b.id = bolao_id;
$function$;

-- 2. Create new secure function to get payment info (requires valid participant token)
CREATE OR REPLACE FUNCTION public.get_bolao_payment_info(p_bolao_id uuid, p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_bolao RECORD;
BEGIN
  -- Validate participant token
  SELECT * INTO v_session
  FROM public.participant_sessions
  WHERE token = p_token
    AND bolao_id = p_bolao_id
    AND expires_at > now();
  
  IF v_session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sessão inválida ou expirada');
  END IF;
  
  -- Get bolão payment info
  SELECT chave_pix, valor_cota INTO v_bolao
  FROM public.boloes
  WHERE id = p_bolao_id;
  
  IF v_bolao IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Bolão não encontrado');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'chave_pix', v_bolao.chave_pix,
    'valor_cota', v_bolao.valor_cota
  );
END;
$function$;