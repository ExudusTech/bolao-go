// Bolão status types and utilities

export type BolaoStatus = 
  | "em_aberto"
  | "apostas_encerradas"
  | "aguardando_sorteio"
  | "concurso_realizado"
  | "premiado"
  | "sem_premio"
  | "encerrado";

export interface BolaoStatusInfo {
  status: BolaoStatus;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  icon: string;
}

interface BolaoData {
  encerrado: boolean;
  data_sorteio?: string | null;
  numeros_sorteados?: number[] | null;
  resultado_verificado?: boolean;
  // Future: has_winners could be added to determine "premiado" vs "sem_premio"
}

export function getBolaoStatus(bolao: BolaoData): BolaoStatusInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dataSorteio = bolao.data_sorteio ? new Date(bolao.data_sorteio) : null;
  if (dataSorteio) {
    dataSorteio.setHours(0, 0, 0, 0);
  }

  // Check if result is verified and numbers are drawn
  if (bolao.numeros_sorteados && bolao.numeros_sorteados.length > 0 && bolao.resultado_verificado) {
    // For now, we show "concurso_realizado" - in the future, could check for winners
    return {
      status: "concurso_realizado",
      label: "Sorteado",
      variant: "success",
      icon: "🎯"
    };
  }

  // Numbers are drawn but not yet verified
  if (bolao.numeros_sorteados && bolao.numeros_sorteados.length > 0) {
    return {
      status: "concurso_realizado",
      label: "Concurso Realizado",
      variant: "success",
      icon: "🎲"
    };
  }

  // Bolão is closed (bets no longer accepted)
  if (bolao.encerrado) {
    // If has draw date in the future, waiting for draw
    if (dataSorteio && dataSorteio >= today) {
      return {
        status: "aguardando_sorteio",
        label: "Aguardando Sorteio",
        variant: "warning",
        icon: "⏳"
      };
    }
    
    // If draw date passed but no results yet
    if (dataSorteio && dataSorteio < today) {
      return {
        status: "aguardando_sorteio",
        label: "Aguardando Resultado",
        variant: "warning",
        icon: "📋"
      };
    }

    // Closed without draw date
    return {
      status: "apostas_encerradas",
      label: "Apostas Encerradas",
      variant: "secondary",
      icon: "🔒"
    };
  }

  // Bolão is open for bets
  // If draw date is set and today is that date or passed, should consider closing
  if (dataSorteio && dataSorteio <= today) {
    return {
      status: "aguardando_sorteio",
      label: "Dia do Sorteio",
      variant: "warning",
      icon: "📅"
    };
  }

  return {
    status: "em_aberto",
    label: "Em Aberto",
    variant: "default",
    icon: "🟢"
  };
}

export function getStatusBadgeClasses(variant: BolaoStatusInfo["variant"]): string {
  switch (variant) {
    case "success":
      return "bg-success/10 text-success border-success/20";
    case "warning":
      return "bg-warning/10 text-warning border-warning/20";
    case "destructive":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "secondary":
      return "bg-muted text-muted-foreground border-muted";
    case "default":
    default:
      return "bg-primary/10 text-primary border-primary/20";
  }
}
