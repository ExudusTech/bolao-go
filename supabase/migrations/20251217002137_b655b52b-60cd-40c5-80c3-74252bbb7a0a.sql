-- Create a security definer function to get a single bolão by ID
-- This prevents enumeration while allowing direct link access
CREATE OR REPLACE FUNCTION public.get_bolao_for_participation(bolao_id uuid)
RETURNS TABLE (
  id uuid,
  nome_do_bolao text,
  chave_pix text,
  observacoes text,
  total_apostas integer,
  created_at timestamptz,
  gestor_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.id,
    b.nome_do_bolao,
    b.chave_pix,
    b.observacoes,
    b.total_apostas,
    b.created_at,
    p.name as gestor_name
  FROM public.boloes b
  LEFT JOIN public.profiles p ON b.gestor_id = p.id
  WHERE b.id = bolao_id;
$$;

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view bolao for participation" ON public.boloes;