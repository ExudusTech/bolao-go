-- Add column to control duplicate bets
ALTER TABLE public.boloes 
ADD COLUMN permite_apostas_repetidas boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.boloes.permite_apostas_repetidas IS 'If false, participants cannot register bets with the same numbers as other participants';

-- Create function to check for duplicate bets
CREATE OR REPLACE FUNCTION public.check_duplicate_bet(p_bolao_id uuid, p_dezenas integer[])
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permite_repetidas boolean;
  v_duplicate_exists boolean;
  v_duplicate_apelido text;
BEGIN
  -- Check if bolão allows duplicate bets
  SELECT permite_apostas_repetidas INTO v_permite_repetidas
  FROM public.boloes
  WHERE id = p_bolao_id;
  
  -- If bolão not found or allows duplicates, return OK
  IF v_permite_repetidas IS NULL OR v_permite_repetidas = true THEN
    RETURN json_build_object('allowed', true);
  END IF;
  
  -- Sort the incoming numbers for consistent comparison
  p_dezenas := ARRAY(SELECT unnest(p_dezenas) ORDER BY 1);
  
  -- Check if there's an existing bet with the same numbers
  SELECT 
    true,
    a.apelido
  INTO v_duplicate_exists, v_duplicate_apelido
  FROM public.apostas a
  WHERE a.bolao_id = p_bolao_id
    AND (SELECT ARRAY(SELECT unnest(a.dezenas) ORDER BY 1)) = p_dezenas
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
$$;