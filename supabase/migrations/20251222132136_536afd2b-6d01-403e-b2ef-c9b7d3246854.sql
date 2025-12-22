-- Allow managers to delete apostas from their own boloes
CREATE POLICY "Managers can delete apostas from own boloes"
ON public.apostas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.boloes
    WHERE boloes.id = apostas.bolao_id
    AND boloes.gestor_id = auth.uid()
  )
);