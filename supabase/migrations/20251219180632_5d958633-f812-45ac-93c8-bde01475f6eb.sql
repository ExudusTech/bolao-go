-- Adicionar campo para indicar se o bolão está encerrado
ALTER TABLE public.boloes 
ADD COLUMN encerrado BOOLEAN NOT NULL DEFAULT false;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.boloes.encerrado IS 'Indica se o bolão está fechado para novas apostas';