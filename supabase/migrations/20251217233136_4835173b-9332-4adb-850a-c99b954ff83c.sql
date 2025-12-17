-- Add lottery type column to boloes table
ALTER TABLE public.boloes 
ADD COLUMN tipo_loteria text NOT NULL DEFAULT 'megasena';

-- Add comment for documentation
COMMENT ON COLUMN public.boloes.tipo_loteria IS 'Tipo da loteria: megasena, lotofacil, quina, etc.';