-- Create system settings table for maintenance mode
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert initial maintenance mode setting
INSERT INTO public.system_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false, "message": "Sistema em manutenção. Por favor, tente novamente em alguns minutos.", "started_at": null, "started_by": null}'::jsonb);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (needed to check maintenance mode)
CREATE POLICY "Anyone can read system settings"
ON public.system_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update system settings"
ON public.system_settings
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Function to check if system is in maintenance mode (public access)
CREATE OR REPLACE FUNCTION public.is_maintenance_mode()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.system_settings WHERE key = 'maintenance_mode'),
    '{"enabled": false}'::jsonb
  )::json
$$;

-- Function to toggle maintenance mode (admin only)
CREATE OR REPLACE FUNCTION public.toggle_maintenance_mode(p_enabled boolean, p_message text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_value jsonb;
  v_new_value jsonb;
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas administradores podem alterar o modo de manutenção');
  END IF;
  
  -- Get current value
  SELECT value INTO v_current_value
  FROM public.system_settings
  WHERE key = 'maintenance_mode';
  
  -- Build new value
  v_new_value := jsonb_build_object(
    'enabled', p_enabled,
    'message', COALESCE(p_message, v_current_value->>'message', 'Sistema em manutenção. Por favor, tente novamente em alguns minutos.'),
    'started_at', CASE WHEN p_enabled THEN now()::text ELSE NULL END,
    'started_by', CASE WHEN p_enabled THEN auth.uid()::text ELSE NULL END
  );
  
  -- Update setting
  UPDATE public.system_settings
  SET value = v_new_value, updated_at = now(), updated_by = auth.uid()
  WHERE key = 'maintenance_mode';
  
  RETURN json_build_object('success', true, 'maintenance_mode', v_new_value);
END;
$$;

-- Block critical operations during maintenance (for use in triggers/functions)
CREATE OR REPLACE FUNCTION public.check_maintenance_mode()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean FROM public.system_settings WHERE key = 'maintenance_mode'),
    false
  )
$$;

-- Trigger function to block inserts during maintenance
CREATE OR REPLACE FUNCTION public.block_during_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.check_maintenance_mode() THEN
    RAISE EXCEPTION 'Sistema em manutenção. Por favor, tente novamente em alguns minutos.';
  END IF;
  RETURN NEW;
END;
$$;

-- Add maintenance check trigger to apostas table
CREATE TRIGGER check_maintenance_before_aposta
BEFORE INSERT ON public.apostas
FOR EACH ROW
EXECUTE FUNCTION public.block_during_maintenance();

-- Add maintenance check trigger to mensagens table
CREATE TRIGGER check_maintenance_before_mensagem
BEFORE INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.block_during_maintenance();