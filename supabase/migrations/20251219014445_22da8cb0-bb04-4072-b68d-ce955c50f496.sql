-- Add columns to track lottery registration status for individual bets
ALTER TABLE public.apostas 
ADD COLUMN registrado boolean NOT NULL DEFAULT false,
ADD COLUMN data_registro timestamp with time zone;