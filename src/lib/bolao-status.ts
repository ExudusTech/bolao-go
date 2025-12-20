// Bolão status types and utilities

export type BolaoStatus = 
  | "em_aberto"
  | "apostas_encerradas"
  | "aguardando_sorteio"
  | "concurso_realizado"
  | "premiado"
  | "sem_premio"
  | "encerrado";

// Define the stages in order
export const BOLAO_STAGES = [
  { key: "em_aberto", label: "Aberto", shortLabel: "1" },
  { key: "apostas_encerradas", label: "Fechado", shortLabel: "2" },
  { key: "aguardando_sorteio", label: "Sorteio", shortLabel: "3" },
  { key: "concurso_realizado", label: "Resultado", shortLabel: "4" },
] as const;

export interface BolaoStatusInfo {
  status: BolaoStatus;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  icon: string;
  step: number; // 1-4 representing the current stage
}

interface BolaoData {
  encerrado: boolean;
  data_sorteio?: string | null;
  numeros_sorteados?: number[] | null;
  resultado_verificado?: boolean;
}

export function getBolaoStatus(bolao: BolaoData): BolaoStatusInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dataSorteio = bolao.data_sorteio ? new Date(bolao.data_sorteio) : null;
  if (dataSorteio) {
    dataSorteio.setHours(0, 0, 0, 0);
  }

  // Check if result is verified and numbers are drawn - Stage 4 complete
  if (bolao.numeros_sorteados && bolao.numeros_sorteados.length > 0 && bolao.resultado_verificado) {
    return {
      status: "concurso_realizado",
      label: "Sorteado",
      variant: "success",
      icon: "🎯",
      step: 4
    };
  }

  // Numbers are drawn but not yet verified - Stage 4 in progress
  if (bolao.numeros_sorteados && bolao.numeros_sorteados.length > 0) {
    return {
      status: "concurso_realizado",
      label: "Resultado Verificado",
      variant: "success",
      icon: "🎲",
      step: 4
    };
  }

  // Bolão is closed (bets no longer accepted) - At least Stage 2
  if (bolao.encerrado) {
    // If has draw date in the future or today, waiting for draw - Stage 3
    if (dataSorteio && dataSorteio >= today) {
      return {
        status: "aguardando_sorteio",
        label: "Aguardando Sorteio",
        variant: "warning",
        icon: "⏳",
        step: 3
      };
    }
    
    // If draw date passed but no results yet - Stage 3 (waiting for result)
    if (dataSorteio && dataSorteio < today) {
      return {
        status: "aguardando_sorteio",
        label: "Aguardando Resultado",
        variant: "warning",
        icon: "📋",
        step: 3
      };
    }

    // Closed without draw date - Stage 2
    return {
      status: "apostas_encerradas",
      label: "Apostas Encerradas",
      variant: "secondary",
      icon: "🔒",
      step: 2
    };
  }

  // Bolão is open for bets - Stage 1
  // If draw date is set and today is that date, highlight it
  if (dataSorteio && dataSorteio.getTime() === today.getTime()) {
    return {
      status: "em_aberto",
      label: "Dia do Sorteio!",
      variant: "warning",
      icon: "📅",
      step: 1
    };
  }

  return {
    status: "em_aberto",
    label: "Em Aberto",
    variant: "default",
    icon: "🟢",
    step: 1
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
