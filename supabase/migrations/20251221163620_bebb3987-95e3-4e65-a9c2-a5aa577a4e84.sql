-- 1. Allow admins to update messages in any bolão
CREATE POLICY "Admins can update mensagens"
ON public.mensagens
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 2. Update check_duplicate_bet to also check same participant duplicates
CREATE OR REPLACE FUNCTION public.check_duplicate_bet(p_bolao_id uuid, p_dezenas integer[], p_celular text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_permite_repetidas boolean;
  v_duplicate_exists boolean;
  v_duplicate_apelido text;
  v_same_participant_duplicate boolean;
  v_sorted_dezenas integer[];
BEGIN
  -- Check if bolão allows duplicate bets
  SELECT permite_apostas_repetidas INTO v_permite_repetidas
  FROM public.boloes
  WHERE id = p_bolao_id;
  
  -- Sort the incoming numbers for consistent comparison
  v_sorted_dezenas := ARRAY(SELECT unnest(p_dezenas) ORDER BY 1);
  
  -- First, check if same participant already has this exact bet
  IF p_celular IS NOT NULL THEN
    SELECT true INTO v_same_participant_duplicate
    FROM public.apostas a
    WHERE a.bolao_id = p_bolao_id
      AND a.celular = p_celular
      AND (SELECT ARRAY(SELECT unnest(a.dezenas) ORDER BY 1)) = v_sorted_dezenas
    LIMIT 1;
    
    IF v_same_participant_duplicate THEN
      RETURN json_build_object(
        'allowed', false,
        'message', 'Você já realizou essa aposta nesse Bolão. Informe novos números se desejar adquirir mais uma cota.',
        'same_participant', true
      );
    END IF;
  END IF;
  
  -- If bolão not found or allows duplicates between different participants, return OK
  IF v_permite_repetidas IS NULL OR v_permite_repetidas = true THEN
    RETURN json_build_object('allowed', true);
  END IF;
  
  -- Check if there's an existing bet with the same numbers from another participant
  SELECT 
    true,
    a.apelido
  INTO v_duplicate_exists, v_duplicate_apelido
  FROM public.apostas a
  WHERE a.bolao_id = p_bolao_id
    AND (SELECT ARRAY(SELECT unnest(a.dezenas) ORDER BY 1)) = v_sorted_dezenas
  LIMIT 1;
  
  IF v_duplicate_exists THEN
    RETURN json_build_object(
      'allowed', false,
      'message', 'Estas dezenas já foram registradas por outro participante',
      'duplicate_of', v_duplicate_apelido
    );
  END IF;
  
  RETURN json_build_object('allowed', true);
END;
$function$;