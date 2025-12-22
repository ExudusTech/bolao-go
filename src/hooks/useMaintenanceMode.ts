import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  started_at: string | null;
  started_by: string | null;
}

interface UseMaintenanceModeReturn {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  isLoading: boolean;
  toggleMaintenanceMode: (enabled: boolean, message?: string) => Promise<{ success: boolean; error?: string }>;
  refreshStatus: () => Promise<void>;
}

export function useMaintenanceMode(): UseMaintenanceModeReturn {
  const [status, setStatus] = useState<MaintenanceStatus>({
    enabled: false,
    message: "Sistema em manutenção. Por favor, tente novamente em alguns minutos.",
    started_at: null,
    started_by: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("is_maintenance_mode");
      
      if (error) {
        console.error("Error fetching maintenance status:", error);
        return;
      }

      if (data) {
        const parsed = data as unknown as MaintenanceStatus;
        setStatus({
          enabled: parsed.enabled || false,
          message: parsed.message || "Sistema em manutenção. Por favor, tente novamente em alguns minutos.",
          started_at: parsed.started_at || null,
          started_by: parsed.started_by || null,
        });
      }
    } catch (e) {
      console.error("Error in fetchStatus:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Check every 30 seconds
    const interval = setInterval(fetchStatus, 30000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggleMaintenanceMode = useCallback(async (
    enabled: boolean,
    message?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc("toggle_maintenance_mode", {
        p_enabled: enabled,
        p_message: message || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as unknown as { success: boolean; error?: string; maintenance_mode?: MaintenanceStatus };

      if (result.success && result.maintenance_mode) {
        setStatus(result.maintenance_mode);
      }

      return { success: result.success, error: result.error };
    } catch (e) {
      return { success: false, error: "Erro ao alterar modo de manutenção" };
    }
  }, []);

  return {
    isMaintenanceMode: status.enabled,
    maintenanceMessage: status.message,
    isLoading,
    toggleMaintenanceMode,
    refreshStatus: fetchStatus,
  };
}
