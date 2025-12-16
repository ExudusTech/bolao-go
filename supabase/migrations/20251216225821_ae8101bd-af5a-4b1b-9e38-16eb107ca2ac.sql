-- Profiles table for managers
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Boloes (pools) table
CREATE TABLE public.boloes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome_do_bolao TEXT NOT NULL,
  chave_pix TEXT NOT NULL,
  observacoes TEXT,
  total_apostas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.boloes ENABLE ROW LEVEL SECURITY;

-- Boloes policies - managers can CRUD their own boloes
CREATE POLICY "Managers can view own boloes"
ON public.boloes FOR SELECT
USING (auth.uid() = gestor_id);

CREATE POLICY "Managers can insert own boloes"
ON public.boloes FOR INSERT
WITH CHECK (auth.uid() = gestor_id);

CREATE POLICY "Managers can update own boloes"
ON public.boloes FOR UPDATE
USING (auth.uid() = gestor_id);

CREATE POLICY "Managers can delete own boloes"
ON public.boloes FOR DELETE
USING (auth.uid() = gestor_id);

-- Public can view bolao info for participation page
CREATE POLICY "Public can view bolao for participation"
ON public.boloes FOR SELECT
USING (true);

-- Apostas (bets) table
CREATE TABLE public.apostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bolao_id UUID NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  apelido TEXT NOT NULL,
  celular TEXT NOT NULL,
  dezenas INTEGER[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apostas ENABLE ROW LEVEL SECURITY;

-- Apostas policies
-- Anyone can insert apostas (public participation)
CREATE POLICY "Anyone can insert apostas"
ON public.apostas FOR INSERT
WITH CHECK (true);

-- Managers can view apostas for their boloes
CREATE POLICY "Managers can view apostas of own boloes"
ON public.apostas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.boloes
    WHERE boloes.id = apostas.bolao_id
    AND boloes.gestor_id = auth.uid()
  )
);

-- Public can view bet count (for participation page counter)
CREATE POLICY "Public can view apostas count"
ON public.apostas FOR SELECT
USING (true);

-- Indexes for performance
CREATE INDEX idx_boloes_gestor_id ON public.boloes(gestor_id);
CREATE INDEX idx_apostas_bolao_id ON public.apostas(bolao_id);
CREATE INDEX idx_apostas_created_at ON public.apostas(created_at DESC);

-- Trigger to update total_apostas counter atomically
CREATE OR REPLACE FUNCTION public.increment_apostas_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.boloes
  SET total_apostas = total_apostas + 1,
      updated_at = now()
  WHERE id = NEW.bolao_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_aposta_created
  AFTER INSERT ON public.apostas
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_apostas_counter();

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'Gestor'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_boloes_updated_at
  BEFORE UPDATE ON public.boloes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();