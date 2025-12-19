-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Participants can update own aposta receipt" ON public.apostas;

-- Create secure RPC function for receipt upload with ownership validation
CREATE OR REPLACE FUNCTION public.upload_receipt(
  p_aposta_id uuid,
  p_receipt_url text,
  p_celular text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership by phone number and prevent overwriting existing receipts
  UPDATE apostas
  SET receipt_url = p_receipt_url
  WHERE id = p_aposta_id
  AND celular = p_celular
  AND (receipt_url IS NULL OR receipt_url = '');
  
  RETURN FOUND;
END;
$$;