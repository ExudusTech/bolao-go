import { Wrench, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MaintenanceScreenProps {
  message: string;
  onRefresh?: () => void;
}

export function MaintenanceScreen({ message, onRefresh }: MaintenanceScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-6 bg-amber-500/10 rounded-full flex items-center justify-center">
            <Wrench className="w-10 h-10 text-amber-500 animate-pulse" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-4">
            Sistema em Manutenção
          </h1>
          
          <p className="text-gray-300 mb-6 leading-relaxed">
            {message}
          </p>
          
          <div className="flex flex-col gap-3">
            {onRefresh && (
              <Button
                onClick={onRefresh}
                variant="outline"
                className="w-full border-gray-600 hover:bg-gray-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Verificar Novamente
              </Button>
            )}
            
            <p className="text-sm text-gray-500">
              Estamos trabalhando para melhorar sua experiência.
              <br />
              Agradecemos sua paciência!
            </p>
          </div>
        </div>
        
        <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-sm">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span>Manutenção em andamento</span>
        </div>
      </div>
    </div>
  );
}
