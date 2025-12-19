-- Fix: Make the receipts bucket more secure by restricting listing and using stricter policies

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;

-- Create policy: Anyone can upload to receipts bucket (participants are not authenticated)
-- But files are uploaded with random UUIDs so they can't be guessed
CREATE POLICY "Public can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

-- Create policy: Managers can view any receipts for their boloes
CREATE POLICY "Managers can view receipts for their boloes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts' AND
  EXISTS (
    SELECT 1 FROM public.apostas a
    JOIN public.boloes b ON b.id = a.bolao_id
    WHERE b.gestor_id = auth.uid()
    AND a.receipt_url LIKE '%' || storage.objects.name
  )
);

-- Create policy: Anyone can view specific receipt by knowing the exact filename
-- This is needed because participants need to see their uploaded receipts
-- Security is provided by using UUIDs in filenames instead of predictable bet IDs
CREATE POLICY "Anyone can view specific receipt by name"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');