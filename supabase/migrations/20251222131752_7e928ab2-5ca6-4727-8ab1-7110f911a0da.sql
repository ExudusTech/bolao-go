-- Create function to recalculate all apostas counters
CREATE OR REPLACE FUNCTION public.recalculate_all_apostas_counters()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer := 0;
  bolao_record RECORD;
  actual_count integer;
BEGIN
  FOR bolao_record IN SELECT id, total_apostas FROM public.boloes LOOP
    SELECT COUNT(*) INTO actual_count FROM public.apostas WHERE bolao_id = bolao_record.id;
    
    IF actual_count != bolao_record.total_apostas THEN
      UPDATE public.boloes 
      SET total_apostas = actual_count, updated_at = now()
      WHERE id = bolao_record.id;
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object('updated_boloes', updated_count);
END;
$$;