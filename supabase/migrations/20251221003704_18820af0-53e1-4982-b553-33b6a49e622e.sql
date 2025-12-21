-- Allow admins to delete any bolão
CREATE POLICY "Admins can delete all boloes" 
ON public.boloes 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Allow admins to delete apostas of any bolão (cascade)
CREATE POLICY "Admins can delete all apostas" 
ON public.apostas 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Allow admins to delete jogos_selecionados of any bolão
CREATE POLICY "Admins can delete all jogos_selecionados" 
ON public.jogos_selecionados 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Allow admins to delete mensagens of any bolão
CREATE POLICY "Admins can delete all mensagens" 
ON public.mensagens 
FOR DELETE 
USING (is_admin(auth.uid()));