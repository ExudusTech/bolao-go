import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, DollarSign, Loader2, Minus, Plus, AlertTriangle } from "lucide-react";

interface GameSelection {
  size: number;
  criteria: "mais_votados" | "menos_votados" | "nao_votados" | "misto";
  quantity: number;
}

interface GameSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalBudget: number;
  individualGamesCost: number;
  prices: Record<number, number>;
  onConfirm: (selections: GameSelection[]) => void;
  isLoading?: boolean;
}

const CRITERIA_OPTIONS = [
  { value: "mais_votados", label: "Mais Votados", description: "Números com mais votos" },
  { value: "menos_votados", label: "Menos Votados", description: "Números com menos votos" },
  { value: "nao_votados", label: "Não Votados", description: "Números que ninguém escolheu" },
  { value: "misto", label: "Misto", description: "Combinação de mais e menos votados" },
] as const;

export function GameSelectionDialog({
  open,
  onOpenChange,
  totalBudget,
  individualGamesCost,
  prices,
  onConfirm,
  isLoading = false,
}: GameSelectionDialogProps) {
  const [selections, setSelections] = useState<Map<string, GameSelection>>(new Map());
  
  const availableBudget = totalBudget - individualGamesCost;
  
  // Calculate total selected cost
  const { totalSelectedCost, remainingBudget, selectionsList } = useMemo(() => {
    let cost = 0;
    const list: GameSelection[] = [];
    
    selections.forEach((selection) => {
      const price = prices[selection.size] || 0;
      cost += price * selection.quantity;
      if (selection.quantity > 0) {
        list.push(selection);
      }
    });
    
    return {
      totalSelectedCost: cost,
      remainingBudget: availableBudget - cost,
      selectionsList: list,
    };
  }, [selections, prices, availableBudget]);
  
  // Get available game sizes sorted by price descending
  const gameSizes = useMemo(() => {
    return Object.entries(prices)
      .map(([size, price]) => ({ size: parseInt(size), price }))
      .filter(({ size }) => size >= 6 && size <= 15) // Practical range
      .sort((a, b) => b.size - a.size);
  }, [prices]);
  
  const getSelectionKey = (size: number, criteria: string) => `${size}-${criteria}`;
  
  const handleQuantityChange = (size: number, criteria: string, delta: number) => {
    const key = getSelectionKey(size, criteria);
    const current = selections.get(key);
    const price = prices[size] || 0;
    
    const newQuantity = Math.max(0, (current?.quantity || 0) + delta);
    
    // Check if adding would exceed budget
    if (delta > 0) {
      const additionalCost = price;
      if (additionalCost > remainingBudget) {
        return; // Can't afford
      }
    }
    
    const newSelections = new Map(selections);
    
    if (newQuantity === 0) {
      newSelections.delete(key);
    } else {
      newSelections.set(key, {
        size,
        criteria: criteria as GameSelection["criteria"],
        quantity: newQuantity,
      });
    }
    
    setSelections(newSelections);
  };
  
  const getQuantity = (size: number, criteria: string) => {
    const key = getSelectionKey(size, criteria);
    return selections.get(key)?.quantity || 0;
  };
  
  const canAfford = (size: number) => {
    const price = prices[size] || 0;
    return price <= remainingBudget;
  };
  
  const handleConfirm = () => {
    if (selectionsList.length > 0) {
      onConfirm(selectionsList);
    }
  };
  
  const handleReset = () => {
    setSelections(new Map());
  };
  
  const totalGames = selectionsList.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Configurar Sugestões de Jogos
          </DialogTitle>
          <DialogDescription>
            Selecione os tipos de jogos que deseja gerar. O sistema irá sugerir as melhores combinações de números.
          </DialogDescription>
        </DialogHeader>
        
        {/* Budget Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/30 border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Orçamento Total</p>
            <p className="text-lg font-bold">R$ {totalBudget.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Jogos Individuais</p>
            <p className="text-lg font-bold text-primary">R$ {individualGamesCost.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Selecionado</p>
            <p className="text-lg font-bold text-accent">R$ {totalSelectedCost.toFixed(2)}</p>
          </div>
          <div className={`text-center p-2 rounded-lg ${remainingBudget < 6 ? 'bg-success/10' : 'bg-warning/10'}`}>
            <p className="text-xs text-muted-foreground">Saldo Disponível</p>
            <p className={`text-lg font-bold ${remainingBudget < 6 ? 'text-success' : 'text-warning'}`}>
              R$ {remainingBudget.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Selection Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Selecione os Jogos</h4>
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={selections.size === 0}>
              Limpar Seleções
            </Button>
          </div>
          
          {/* Header Row */}
          <div className="hidden md:grid md:grid-cols-[120px_1fr_1fr_1fr_1fr] gap-2 px-4 text-xs text-muted-foreground font-medium">
            <div>Tipo / Custo</div>
            <div className="text-center">Mais Votados</div>
            <div className="text-center">Menos Votados</div>
            <div className="text-center">Não Votados</div>
            <div className="text-center">Misto</div>
          </div>
          
          {/* Game Size Rows */}
          <div className="space-y-2">
            {gameSizes.map(({ size, price }) => {
              const affordable = canAfford(size);
              
              return (
                <div 
                  key={size} 
                  className={`p-3 rounded-lg border ${affordable ? 'bg-background' : 'bg-muted/30 opacity-60'}`}
                >
                  {/* Mobile: Stacked layout */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={affordable ? "default" : "secondary"}>
                        {size} dezenas
                      </Badge>
                      <span className={`font-bold ${affordable ? 'text-foreground' : 'text-muted-foreground'}`}>
                        R$ {price.toFixed(2)}
                      </span>
                    </div>
                    {!affordable && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Orçamento insuficiente
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {CRITERIA_OPTIONS.map((criteria) => (
                        <div key={criteria.value} className="flex flex-col items-center gap-1 p-2 rounded bg-muted/30">
                          <span className="text-xs text-muted-foreground">{criteria.label}</span>
                          <QuantitySelector
                            quantity={getQuantity(size, criteria.value)}
                            onIncrease={() => handleQuantityChange(size, criteria.value, 1)}
                            onDecrease={() => handleQuantityChange(size, criteria.value, -1)}
                            disabled={!affordable && getQuantity(size, criteria.value) === 0}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Desktop: Grid layout */}
                  <div className="hidden md:grid md:grid-cols-[120px_1fr_1fr_1fr_1fr] gap-2 items-center">
                    <div className="flex flex-col">
                      <Badge variant={affordable ? "default" : "secondary"} className="w-fit">
                        {size} dezenas
                      </Badge>
                      <span className={`text-sm font-bold mt-1 ${affordable ? 'text-foreground' : 'text-muted-foreground'}`}>
                        R$ {price.toFixed(2)}
                      </span>
                      {!affordable && (
                        <span className="text-[10px] text-destructive">Sem orçamento</span>
                      )}
                    </div>
                    
                    {CRITERIA_OPTIONS.map((criteria) => (
                      <div key={criteria.value} className="flex justify-center">
                        <QuantitySelector
                          quantity={getQuantity(size, criteria.value)}
                          onIncrease={() => handleQuantityChange(size, criteria.value, 1)}
                          onDecrease={() => handleQuantityChange(size, criteria.value, -1)}
                          disabled={!affordable && getQuantity(size, criteria.value) === 0}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Selection Summary */}
        {selectionsList.length > 0 && (
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 space-y-2">
            <h4 className="font-medium text-accent">Resumo da Seleção</h4>
            <div className="flex flex-wrap gap-2">
              {selectionsList.map((selection, idx) => {
                const price = prices[selection.size] || 0;
                const criteriaLabel = CRITERIA_OPTIONS.find(c => c.value === selection.criteria)?.label;
                return (
                  <Badge key={idx} variant="outline" className="border-accent text-accent">
                    {selection.quantity}x {selection.size} dez. ({criteriaLabel}) = R$ {(price * selection.quantity).toFixed(2)}
                  </Badge>
                );
              })}
            </div>
            <p className="text-sm">
              <strong>{totalGames}</strong> jogos selecionados • 
              <strong className="text-accent"> R$ {totalSelectedCost.toFixed(2)}</strong> total
            </p>
          </div>
        )}
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectionsList.length === 0 || isLoading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar {totalGames} Jogo{totalGames !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuantitySelector({
  quantity,
  onIncrease,
  onDecrease,
  disabled,
}: {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={onDecrease}
        disabled={quantity === 0}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className={`w-8 text-center font-bold ${quantity > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
        {quantity}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={onIncrease}
        disabled={disabled}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
