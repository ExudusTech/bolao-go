-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_bolao_for_participation(uuid);

-- Recreate with valor_cota included
CREATE FUNCTION public.get_bolao_for_participation(bolao_id uuid)
RETURNS TABLE(
  id uuid, 
  nome_do_bolao text, 
  chave_pix text, 
  observacoes text, 
  total_apostas integer, 
  created_at timestamp with time zone, 
  gestor_name text, 
  encerrado boolean, 
  numeros_sorteados integer[], 
  resultado_verificado boolean,
  valor_cota numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    b.id,
    b.nome_do_bolao,
    b.chave_pix,
    b.observacoes,
    b.total_apostas,
    b.created_at,
    p.name as gestor_name,
    b.encerrado,
    b.numeros_sorteados,
    COALESCE(b.resultado_verificado, false) as resultado_verificado,
    b.valor_cota
  FROM public.boloes b
  LEFT JOIN public.profiles p ON b.gestor_id = p.id
  WHERE b.id = bolao_id;
$function$;