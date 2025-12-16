-- Server-side validation trigger for apostas table
CREATE OR REPLACE FUNCTION public.validate_aposta()
RETURNS TRIGGER
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
  
  RETURN NEW;
END;
$$;

-- Create validation trigger
CREATE TRIGGER validate_aposta_trigger
  BEFORE INSERT ON public.apostas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_aposta();

-- Rate limiting function for apostas (max 5 bets per phone per hour)
CREATE OR REPLACE FUNCTION public.check_aposta_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.apostas
  WHERE celular = NEW.celular
    AND created_at > now() - interval '1 hour';
  
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Limite de apostas excedido. Aguarde 1 hora para apostar novamente.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create rate limiting trigger
CREATE TRIGGER check_aposta_rate_limit_trigger
  BEFORE INSERT ON public.apostas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_aposta_rate_limit();

-- Add index for efficient rate limiting queries
CREATE INDEX IF NOT EXISTS idx_apostas_celular_created_at 
ON public.apostas(celular, created_at DESC);