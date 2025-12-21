-- Create trigger function to decrement apostas counter on delete
CREATE OR REPLACE FUNCTION public.decrement_apostas_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.boloes
  SET total_apostas = GREATEST(total_apostas - 1, 0),
      updated_at = now()
  WHERE id = OLD.bolao_id;
  RETURN OLD;
END;
$$;

-- Create trigger for decrementing on delete
CREATE TRIGGER decrement_apostas_on_delete
AFTER DELETE ON public.apostas
FOR EACH ROW
EXECUTE FUNCTION public.decrement_apostas_counter();