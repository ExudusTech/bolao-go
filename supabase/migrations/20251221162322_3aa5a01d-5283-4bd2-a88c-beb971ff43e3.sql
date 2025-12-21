-- Allow admins to insert messages in any bolão
CREATE POLICY "Admins can insert mensagens"
ON public.mensagens
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));