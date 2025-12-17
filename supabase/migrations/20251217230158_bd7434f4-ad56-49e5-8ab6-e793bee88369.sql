-- Add payment tracking fields to apostas table
ALTER TABLE public.apostas 
ADD COLUMN payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
ADD COLUMN receipt_url text,
ADD COLUMN paid_at timestamp with time zone,
ADD COLUMN paid_marked_by uuid REFERENCES auth.users(id);

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true);

-- Storage policies for receipts bucket
CREATE POLICY "Anyone can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Anyone can view receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

-- Policy for managers to update payment status of apostas in their bolões
CREATE POLICY "Managers can update apostas payment status"
ON public.apostas FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM boloes 
  WHERE boloes.id = apostas.bolao_id 
  AND boloes.gestor_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM boloes 
  WHERE boloes.id = apostas.bolao_id 
  AND boloes.gestor_id = auth.uid()
));

-- Policy for participants to update their own aposta (for receipt upload)
CREATE POLICY "Participants can update own aposta receipt"
ON public.apostas FOR UPDATE
USING (true)
WITH CHECK (true);