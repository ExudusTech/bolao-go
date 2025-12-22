import { useState } from "react";
import { Wrench, AlertTriangle, Power, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function MaintenanceToggle() {
  const { isMaintenanceMode, maintenanceMessage, isLoading, toggleMaintenanceMode } = useMaintenanceMode();
  const [customMessage, setCustomMessage] = useState(maintenanceMessage);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (enable: boolean) => {
    setIsToggling(true);
    try {
      const result = await toggleMaintenanceMode(enable, customMessage);
      
      if (result.success) {
        toast.success(
          enable 
            ? "Modo de manutenção ATIVADO. O sistema está bloqueado." 
            : "Modo de manutenção DESATIVADO. O sistema está liberado."
        );
      } else {
        toast.error(result.error || "Erro ao alterar modo de manutenção");
      }
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 ${isMaintenanceMode ? 'border-red-500/50 bg-red-950/10' : 'border-amber-500/30'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className={`w-5 h-5 ${isMaintenanceMode ? 'text-red-500' : 'text-amber-500'}`} />
          Modo de Manutenção
          {isMaintenanceMode && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse">
              ATIVO
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Bloqueie o sistema temporariamente para realizar atualizações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isMaintenanceMode && (
          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-400">Sistema bloqueado</p>
              <p className="text-gray-400">
                Participantes não podem fazer apostas ou enviar mensagens.
                Gestores podem continuar acessando o painel.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="maintenance-message">Mensagem para os usuários</Label>
          <Textarea
            id="maintenance-message"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Sistema em manutenção. Por favor, tente novamente em alguns minutos."
            className="min-h-[80px]"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Switch
              id="maintenance-toggle"
              checked={isMaintenanceMode}
              disabled={isToggling}
              onCheckedChange={(checked) => {
                if (checked) {
                  // Show confirmation dialog for enabling
                  document.getElementById("enable-maintenance-trigger")?.click();
                } else {
                  handleToggle(false);
                }
              }}
            />
            <Label htmlFor="maintenance-toggle" className="cursor-pointer">
              {isMaintenanceMode ? "Desativar manutenção" : "Ativar manutenção"}
            </Label>
          </div>

          {isToggling && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>

        {/* Hidden trigger for confirmation dialog */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button id="enable-maintenance-trigger" className="hidden" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Power className="w-5 h-5 text-red-500" />
                Ativar Modo de Manutenção?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Ao ativar o modo de manutenção:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Participantes não poderão fazer novas apostas</li>
                  <li>Mensagens não poderão ser enviadas</li>
                  <li>Uma tela de manutenção será exibida para todos os usuários</li>
                  <li>Gestores e admins continuam com acesso ao painel</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleToggle(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                Ativar Manutenção
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
