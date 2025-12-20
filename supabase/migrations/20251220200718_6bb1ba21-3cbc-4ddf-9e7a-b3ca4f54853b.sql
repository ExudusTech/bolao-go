-- Create function to get number counts for a bolão (public access for participants)
CREATE OR REPLACE FUNCTION public.get_bolao_number_counts(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
BEGIN
  -- Check if bolão exists
  IF NOT EXISTS (SELECT 1 FROM public.boloes WHERE id = p_bolao_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bolão não encontrado');
  END IF;

  -- Get count of each number from all bets in this bolão
  SELECT json_object_agg(num, cnt)
  INTO v_result
  FROM (
    SELECT num, COUNT(*)::int as cnt
    FROM public.apostas a,
         unnest(a.dezenas) AS num
    WHERE a.bolao_id = p_bolao_id
    GROUP BY num
    ORDER BY num
  ) counts;

  RETURN json_build_object(
    'success', true,
    'counts', COALESCE(v_result, '{}'::json)
  );
END;
$function$;