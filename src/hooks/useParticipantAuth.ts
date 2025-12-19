import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ParticipantSession {
  token: string;
  apelido: string;
  apostaId: string;
  bolaoId: string;
  bolaoNome?: string;
}

interface UseParticipantAuthReturn {
  session: ParticipantSession | null;
  isLoading: boolean;
  login: (bolaoId: string, apelido: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  validateSession: () => Promise<boolean>;
}

const STORAGE_KEY = "participant_session";

export function useParticipantAuth(bolaoId?: string): UseParticipantAuthReturn {
  const [session, setSession] = useState<ParticipantSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ParticipantSession;
        // Only restore session if it's for the current bolao
        if (!bolaoId || parsed.bolaoId === bolaoId) {
          setSession(parsed);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, [bolaoId]);

  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!session?.token) return false;

    try {
      const { data, error } = await supabase.rpc("validate_participant_token", {
        p_token: session.token
      });

      if (error || !data) return false;

      const result = data as { valid: boolean; bolao_id?: string; aposta_id?: string; apelido?: string; bolao_nome?: string };
      
      if (!result.valid) {
        // Clear invalid session
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }, [session?.token]);

  // Validate session on mount and when session changes
  useEffect(() => {
    if (session?.token) {
      validateSession();
    }
  }, [session?.token, validateSession]);

  const login = useCallback(async (
    loginBolaoId: string,
    apelido: string,
    senha: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc("participant_login", {
        p_bolao_id: loginBolaoId,
        p_apelido: apelido,
        p_senha: senha
      });

      if (error) {
        return { success: false, error: "Erro ao fazer login. Tente novamente." };
      }

      const result = data as { success: boolean; error?: string; token?: string; apelido?: string; aposta_id?: string };

      if (!result.success) {
        return { success: false, error: result.error || "Credenciais inválidas" };
      }

      const newSession: ParticipantSession = {
        token: result.token!,
        apelido: result.apelido!,
        apostaId: result.aposta_id!,
        bolaoId: loginBolaoId
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);

      return { success: true };
    } catch (e) {
      return { success: false, error: "Erro de conexão. Tente novamente." };
    }
  }, []);

  const logout = useCallback(async () => {
    if (session?.token) {
      try {
        await supabase.rpc("participant_logout", { p_token: session.token });
      } catch (e) {
        // Ignore logout errors
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, [session?.token]);

  return {
    session,
    isLoading,
    login,
    logout,
    validateSession
  };
}
