-- Drop and recreate get_bolao_for_participation to include data_sorteio
DROP FUNCTION IF EXISTS public.get_bolao_for_participation(uuid);

CREATE FUNCTION public.get_bolao_for_participation(bolao_id UUID)
RETURNS TABLE (
  id UUID,
  nome_do_bolao TEXT,
  chave_pix TEXT,
  observacoes TEXT,
  total_apostas INTEGER,
  created_at TIMESTAMPTZ,
  gestor_name TEXT,
  encerrado BOOLEAN,
  numeros_sorteados INTEGER[],
  resultado_verificado BOOLEAN,
  valor_cota NUMERIC,
  data_limite_apostas TIMESTAMPTZ,
  data_sorteio DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.nome_do_bolao,
    NULL::text as chave_pix,
    b.observacoes,
    b.total_apostas,
    b.created_at,
    p.name as gestor_name,
    b.encerrado,
    b.numeros_sorteados,
    COALESCE(b.resultado_verificado, false) as resultado_verificado,
    b.valor_cota,
    b.data_limite_apostas,
    b.data_sorteio
  FROM public.boloes b
  LEFT JOIN public.profiles p ON b.gestor_id = p.id
  WHERE b.id = get_bolao_for_participation.bolao_id;
END;
$$;