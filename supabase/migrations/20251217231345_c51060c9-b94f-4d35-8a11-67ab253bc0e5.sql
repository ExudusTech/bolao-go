-- Add valor_cota column to boloes table
ALTER TABLE public.boloes 
ADD COLUMN valor_cota numeric(10,2) NOT NULL DEFAULT 10.00;