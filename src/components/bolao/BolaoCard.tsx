import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { getBolaoStatus, getStatusBadgeClasses } from "@/lib/bolao-status";
import { cn } from "@/lib/utils";

interface BolaoCardProps {
  id: string;
  nome: string;
  totalApostas: number;
  createdAt: string;
  index: number;
  encerrado?: boolean;
  dataSorteio?: string | null;
  numerosSorteados?: number[] | null;
  resultadoVerificado?: boolean;
}

export function BolaoCard({ 
  id, 
  nome, 
  totalApostas, 
  createdAt, 
  index,
  encerrado = false,
  dataSorteio,
  numerosSorteados,
  resultadoVerificado = false
}: BolaoCardProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const publicLink = `${window.location.origin}/participar/${id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      toast.success("Link copiado!");
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const statusInfo = getBolaoStatus({
    encerrado,
    data_sorteio: dataSorteio,
    numeros_sorteados: numerosSorteados,
    resultado_verificado: resultadoVerificado,
  });

  return (
    <Card 
      className="group overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/20 animate-slide-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{nome}</CardTitle>
            <CardDescription className="flex items-center gap-1 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </CardDescription>
          </div>
          <Badge 
            variant="secondary" 
            className="flex items-center gap-1 bg-primary/10 text-primary"
          >
            <Users className="h-3 w-3" />
            <span className="font-semibold animate-count">{totalApostas}</span>
          </Badge>
        </div>
        {/* Status Badge */}
        <Badge 
          variant="outline"
          className={cn("mt-2 text-xs font-medium", getStatusBadgeClasses(statusInfo.variant))}
        >
          <span className="mr-1">{statusInfo.icon}</span>
          {statusInfo.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 hover-scale"
            onClick={handleCopyLink}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copiar Link
          </Button>
          <Button size="sm" className="flex-1 hover-scale" asChild>
            <Link to={`/gestor/bolao/${id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Abrir
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
