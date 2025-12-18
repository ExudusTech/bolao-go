-- Create table for selected games
CREATE TABLE public.jogos_selecionados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bolao_id UUID NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  dezenas INTEGER[] NOT NULL,
  tipo TEXT NOT NULL, -- "7 dezenas", "8 dezenas", etc.
  custo NUMERIC NOT NULL,
  categoria TEXT NOT NULL, -- "mais votados", "menos votados", "não votados", "misto"
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jogos_selecionados ENABLE ROW LEVEL SECURITY;

-- Managers can view games of their own boloes
CREATE POLICY "Managers can view jogos of own boloes"
ON public.jogos_selecionados
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.boloes
  WHERE boloes.id = jogos_selecionados.bolao_id
  AND boloes.gestor_id = auth.uid()
));

-- Managers can insert games for their own boloes
CREATE POLICY "Managers can insert jogos for own boloes"
ON public.jogos_selecionados
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.boloes
  WHERE boloes.id = jogos_selecionados.bolao_id
  AND boloes.gestor_id = auth.uid()
));

-- Managers can delete games of their own boloes
CREATE POLICY "Managers can delete jogos of own boloes"
ON public.jogos_selecionados
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.boloes
  WHERE boloes.id = jogos_selecionados.bolao_id
  AND boloes.gestor_id = auth.uid()
));

-- Create index for better query performance
CREATE INDEX idx_jogos_selecionados_bolao_id ON public.jogos_selecionados(bolao_id);