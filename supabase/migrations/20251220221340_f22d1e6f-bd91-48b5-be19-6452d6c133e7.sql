-- Add deadline field for accepting bets
ALTER TABLE public.boloes 
ADD COLUMN data_limite_apostas timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.boloes.data_limite_apostas IS 'Data e hora limite para aceitação de apostas';