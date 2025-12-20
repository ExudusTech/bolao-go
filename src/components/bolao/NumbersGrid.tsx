import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface NumbersGridProps {
  apostas: Array<{ dezenas: number[] }>;
  maxNumber?: number;
  showCounts?: boolean;
  highlightedNumbers?: number[];
}

export function NumbersGrid({ 
  apostas, 
  maxNumber = 60, 
  showCounts = false,
  highlightedNumbers = []
}: NumbersGridProps) {
  const numberCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= maxNumber; i++) {
      counts[i] = 0;
    }
    apostas.forEach((aposta) => {
      aposta.dezenas.forEach((num) => {
        if (num >= 1 && num <= maxNumber) {
          counts[num]++;
        }
      });
    });
    return counts;
  }, [apostas, maxNumber]);

  const maxCount = useMemo(() => {
    return Math.max(...Object.values(numberCounts), 1);
  }, [numberCounts]);

  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1);

  const getNumberStyle = (num: number) => {
    const count = numberCounts[num];
    const isHighlighted = highlightedNumbers.includes(num);
    
    if (count === 0) {
      return "bg-muted text-muted-foreground";
    }
    
    // Calculate intensity based on count relative to max
    const intensity = count / maxCount;
    
    if (intensity > 0.7) {
      return "bg-primary text-primary-foreground";
    } else if (intensity > 0.4) {
      return "bg-primary/60 text-primary-foreground";
    } else if (isHighlighted || count > 0) {
      return "bg-primary/30 text-foreground";
    }
    
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
        {numbers.map((num) => {
          const count = numberCounts[num];
          return (
            <div
              key={num}
              className={cn(
                "relative flex h-8 w-full items-center justify-center rounded-full text-sm font-medium transition-all",
                getNumberStyle(num)
              )}
              title={`${num}: ${count} votos`}
            >
              {num.toString().padStart(2, "0")}
              {showCounts && count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-muted" />
          <span>Não votado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-primary/30" />
          <span>Poucos votos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-primary/60" />
          <span>Médio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-primary" />
          <span>Mais votado</span>
        </div>
      </div>
    </div>
  );
}
