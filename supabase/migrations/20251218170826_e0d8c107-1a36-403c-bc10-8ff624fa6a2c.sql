-- Add data_sorteio and numero_concurso columns to boloes table
ALTER TABLE public.boloes 
ADD COLUMN data_sorteio DATE,
ADD COLUMN numero_concurso INTEGER,
ADD COLUMN resultado_verificado BOOLEAN DEFAULT false,
ADD COLUMN numeros_sorteados INTEGER[],
ADD COLUMN notificacao_aprovada BOOLEAN DEFAULT false;