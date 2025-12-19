-- Add columns to track lottery registration status
ALTER TABLE public.jogos_selecionados 
ADD COLUMN registrado boolean NOT NULL DEFAULT false,
ADD COLUMN data_registro timestamp with time zone;

-- Allow managers to update jogos_selecionados
CREATE POLICY "Managers can update jogos of own boloes" 
ON public.jogos_selecionados 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM boloes
  WHERE ((boloes.id = jogos_selecionados.bolao_id) AND (boloes.gestor_id = auth.uid()))))
WITH CHECK (EXISTS ( SELECT 1
   FROM boloes
  WHERE ((boloes.id = jogos_selecionados.bolao_id) AND (boloes.gestor_id = auth.uid()))));