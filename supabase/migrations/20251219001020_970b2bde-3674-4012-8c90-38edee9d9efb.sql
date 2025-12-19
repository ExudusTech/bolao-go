-- Create messages table for internal messaging
CREATE TABLE public.mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bolao_id UUID NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,
  autor_celular TEXT,
  autor_gestor_id UUID REFERENCES auth.users(id),
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Anyone can view messages of a bolao (participants need to see them)
CREATE POLICY "Anyone can view messages of a bolao"
ON public.mensagens
FOR SELECT
USING (true);

-- Managers can insert messages for own boloes
CREATE POLICY "Managers can insert messages for own boloes"
ON public.mensagens
FOR INSERT
WITH CHECK (
  autor_gestor_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.boloes
    WHERE boloes.id = mensagens.bolao_id
    AND boloes.gestor_id = auth.uid()
  )
);

-- Participants can insert messages (no auth required, identified by celular)
CREATE POLICY "Participants can insert messages"
ON public.mensagens
FOR INSERT
WITH CHECK (
  autor_gestor_id IS NULL AND
  autor_celular IS NOT NULL
);

-- Managers can delete messages from own boloes
CREATE POLICY "Managers can delete messages from own boloes"
ON public.mensagens
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.boloes
    WHERE boloes.id = mensagens.bolao_id
    AND boloes.gestor_id = auth.uid()
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;

-- Create index for faster queries
CREATE INDEX idx_mensagens_bolao_id ON public.mensagens(bolao_id);
CREATE INDEX idx_mensagens_created_at ON public.mensagens(created_at DESC);