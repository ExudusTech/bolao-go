-- Criar função para buscar apostas públicas de um bolão
CREATE OR REPLACE FUNCTION public.get_bolao_apostas_public(p_bolao_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'success', true,
    'apostas', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', a.id,
          'apelido', a.apelido,
          'dezenas', a.dezenas,
          'created_at', a.created_at
        ) ORDER BY a.created_at DESC
      ), '[]'::json)
      FROM apostas a
      WHERE a.bolao_id = p_bolao_id
    )
  );
END;
$$;

-- Grant execute to public for anonymous access
GRANT EXECUTE ON FUNCTION public.get_bolao_apostas_public(UUID) TO anon, authenticated;