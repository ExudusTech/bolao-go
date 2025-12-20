-- Update the validate_aposta function to accept international phone numbers
CREATE OR REPLACE FUNCTION public.validate_aposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_country_code TEXT;
  v_digits TEXT;
  v_parts TEXT[];
BEGIN
  -- Validate apelido length (2-50 characters)
  IF length(NEW.apelido) < 2 OR length(NEW.apelido) > 50 THEN
    RAISE EXCEPTION 'Apelido deve ter entre 2 e 50 caracteres';
  END IF;
  
  -- Parse phone number format: "CC:digits" (e.g., "BR:11999999999")
  v_parts := string_to_array(NEW.celular, ':');
  
  IF array_length(v_parts, 1) = 2 THEN
    v_country_code := v_parts[1];
    v_digits := v_parts[2];
  ELSE
    -- Legacy format: assume Brazil and digits only
    v_country_code := 'BR';
    v_digits := regexp_replace(NEW.celular, '[^0-9]', '', 'g');
    -- Update celular to new format
    NEW.celular := v_country_code || ':' || v_digits;
  END IF;
  
  -- Validate based on country code
  CASE v_country_code
    WHEN 'BR' THEN
      IF length(v_digits) < 10 OR length(v_digits) > 11 THEN
        RAISE EXCEPTION 'Celular brasileiro deve ter 10 ou 11 dígitos';
      END IF;
      IF v_digits !~ '^[1-9]{2}9?[0-9]{8}$' THEN
        RAISE EXCEPTION 'Formato de celular brasileiro inválido';
      END IF;
    WHEN 'US' THEN
      IF length(v_digits) != 10 THEN
        RAISE EXCEPTION 'Celular americano deve ter 10 dígitos';
      END IF;
    WHEN 'PT' THEN
      IF length(v_digits) != 9 THEN
        RAISE EXCEPTION 'Celular português deve ter 9 dígitos';
      END IF;
    WHEN 'ES' THEN
      IF length(v_digits) != 9 THEN
        RAISE EXCEPTION 'Celular espanhol deve ter 9 dígitos';
      END IF;
    ELSE
      -- Generic validation for other countries
      IF length(v_digits) < 7 OR length(v_digits) > 15 THEN
        RAISE EXCEPTION 'Celular deve ter entre 7 e 15 dígitos';
      END IF;
  END CASE;
  
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
  
  -- Set anonymized phone fields (use digits only for hash)
  NEW.celular_hash := encode(sha256(v_digits::bytea), 'hex');
  NEW.celular_ultimos4 := RIGHT(v_digits, 4);
  
  RETURN NEW;
END;
$function$;