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
import { Sparkles, DollarSign, Loader2, Minus, Plus, AlertTriangle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GameSelection {
  size: number;
  criteria: "mais_votados" | "menos_votados" | "nao_votados" | "misto";
  quantity: number;
  mistoCriteria?: ("mais_votados" | "menos_votados" | "nao_votados")[];
}

interface GameSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalBudget: number;
  individualGamesCost: number;
  prices: Record<number, number>;
  onConfirm: (selections: GameSelection[]) => void;
  isLoading?: boolean;
  notVotedCount?: number;
}

const SIMPLE_CRITERIA_OPTIONS = [
  { value: "mais_votados", label: "Mais Votados", description: "Números com mais votos" },
  { value: "menos_votados", label: "Menos Votados", description: "Números com menos votos" },
  { value: "nao_votados", label: "Não Votados", description: "Números que ninguém escolheu" },
] as const;

const MISTO_CRITERIA_OPTIONS = [
  { value: "mais_votados", label: "+ Votados" },
  { value: "menos_votados", label: "- Votados" },
  { value: "nao_votados", label: "Não Votados" },
] as const;

export function GameSelectionDialog({
  open,
  onOpenChange,
  totalBudget,
  individualGamesCost,
  prices,
  onConfirm,
  isLoading = false,
  notVotedCount = 0,
}: GameSelectionDialogProps) {
  const [selections, setSelections] = useState<Map<string, GameSelection>>(new Map());
  const [mistoConfigs, setMistoConfigs] = useState<Map<number, Set<string>>>(new Map()); // size -> selected misto criteria
  
  const availableBudget = totalBudget - individualGamesCost;
  
  // Calculate total selected cost
  const { totalSelectedCost, remainingBudget, selectionsList } = useMemo(() => {
    let cost = 0;
    const list: GameSelection[] = [];
    
    selections.forEach((selection) => {
      const price = prices[selection.size] || 0;
      cost += price * selection.quantity;
      if (selection.quantity > 0) {
        // Add mistoCriteria if it's a misto selection
        if (selection.criteria === 'misto') {
          const mistoSet = mistoConfigs.get(selection.size);
          const mistoCriteria = mistoSet ? Array.from(mistoSet) as ("mais_votados" | "menos_votados" | "nao_votados")[] : [];
          list.push({ ...selection, mistoCriteria });
        } else {
          list.push(selection);
        }
      }
    });
    
    return {
      totalSelectedCost: cost,
      remainingBudget: availableBudget - cost,
      selectionsList: list,
    };
  }, [selections, prices, availableBudget, mistoConfigs]);
  
  // Get available game sizes sorted by price descending
  const gameSizes = useMemo(() => {
    return Object.entries(prices)
      .map(([size, price]) => ({ size: parseInt(size), price }))
      .filter(({ size }) => size >= 6 && size <= 15)
      .sort((a, b) => b.size - a.size);
  }, [prices]);
  
  const getSelectionKey = (size: number, criteria: string) => `${size}-${criteria}`;
  
  // Check if "Não Votados" can be used for a specific game size
  const canUseNaoVotados = (size: number) => notVotedCount >= size;
  
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
      // Also clear misto config for this size if it was misto
      if (criteria === 'misto') {
        const newMistoConfigs = new Map(mistoConfigs);
        newMistoConfigs.delete(size);
        setMistoConfigs(newMistoConfigs);
      }
    } else {
      newSelections.set(key, {
        size,
        criteria: criteria as GameSelection["criteria"],
        quantity: newQuantity,
      });
      // Initialize misto config if needed
      if (criteria === 'misto' && !mistoConfigs.has(size)) {
        const newMistoConfigs = new Map(mistoConfigs);
        newMistoConfigs.set(size, new Set(['mais_votados', 'menos_votados'])); // Default selection
        setMistoConfigs(newMistoConfigs);
      }
    }
    
    setSelections(newSelections);
  };
  
  const handleMistoCriteriaToggle = (size: number, criteriaValue: string) => {
    const newMistoConfigs = new Map(mistoConfigs);
    const currentSet = newMistoConfigs.get(size) || new Set<string>();
    const newSet = new Set(currentSet);
    
    if (newSet.has(criteriaValue)) {
      // Don't allow removing if it would leave less than 2 selected
      if (newSet.size > 2) {
        newSet.delete(criteriaValue);
      }
    } else {
      // Check if adding nao_votados when there are not enough
      if (criteriaValue === 'nao_votados' && !canUseNaoVotados(size)) {
        return; // Can't add nao_votados - not enough numbers
      }
      newSet.add(criteriaValue);
    }
    
    newMistoConfigs.set(size, newSet);
    setMistoConfigs(newMistoConfigs);
  };
  
  const getQuantity = (size: number, criteria: string) => {
    const key = getSelectionKey(size, criteria);
    return selections.get(key)?.quantity || 0;
  };
  
  const getMistoQuantity = (size: number) => {
    const key = getSelectionKey(size, 'misto');
    return selections.get(key)?.quantity || 0;
  };
  
  const getMistoCriteria = (size: number): Set<string> => {
    return mistoConfigs.get(size) || new Set(['mais_votados', 'menos_votados']);
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
    setMistoConfigs(new Map());
  };
  
  const totalGames = selectionsList.reduce((sum, s) => sum + s.quantity, 0);
  
  const getMistoLabel = (selection: GameSelection): string => {
    if (!selection.mistoCriteria || selection.mistoCriteria.length === 0) {
      return 'Misto';
    }
    const labels = selection.mistoCriteria.map(c => {
      if (c === 'mais_votados') return '+V';
      if (c === 'menos_votados') return '-V';
      if (c === 'nao_votados') return 'NV';
      return c;
    });
    return `Misto (${labels.join('+')})`;
  };

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
        
        {/* Não Votados Info Banner */}
        {notVotedCount === 0 && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-warning">Todos os números já foram votados</p>
              <p className="text-muted-foreground text-xs">A categoria "Não Votados" está indisponível para este bolão.</p>
            </div>
          </div>
        )}
        {notVotedCount > 0 && notVotedCount < 15 && (
          <div className="p-3 rounded-lg bg-muted/50 border flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>{notVotedCount}</strong> números não votados disponíveis. 
              Jogos com mais de {notVotedCount} dezenas não poderão usar a categoria "Não Votados".
            </p>
          </div>
        )}
        
        {/* Selection Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Selecione os Jogos</h4>
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={selections.size === 0}>
              Limpar Seleções
            </Button>
          </div>
          
          {/* Game Size Rows */}
          <div className="space-y-3">
            {gameSizes.map(({ size, price }) => {
              const affordable = canAfford(size);
              const naoVotadosAvailable = canUseNaoVotados(size);
              const mistoQty = getMistoQuantity(size);
              const mistoCriteria = getMistoCriteria(size);
              
              return (
                <div 
                  key={size} 
                  className={`p-4 rounded-lg border ${affordable ? 'bg-background' : 'bg-muted/30 opacity-60'}`}
                >
                  {/* Header: Size and Price */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={affordable ? "default" : "secondary"}>
                        {size} dezenas
                      </Badge>
                      <span className={`font-bold ${affordable ? 'text-foreground' : 'text-muted-foreground'}`}>
                        R$ {price.toFixed(2)}
                      </span>
                    </div>
                    {!affordable && (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Sem orçamento
                      </span>
                    )}
                  </div>
                  
                  {/* Simple Criteria Selectors */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {SIMPLE_CRITERIA_OPTIONS.map((criteria) => {
                      const isNaoVotados = criteria.value === 'nao_votados';
                      const isDisabled = isNaoVotados && !naoVotadosAvailable;
                      const currentQty = getQuantity(size, criteria.value);
                      
                      return (
                        <div 
                          key={criteria.value} 
                          className={`flex flex-col items-center gap-1 p-2 rounded ${isDisabled ? 'bg-muted/20 opacity-50' : 'bg-muted/30'}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">{criteria.label}</span>
                            {isNaoVotados && !naoVotadosAvailable && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3 w-3 text-warning" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Apenas {notVotedCount} números não votados.<br/>Precisa de {size} para este jogo.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <QuantitySelector
                            quantity={currentQty}
                            onIncrease={() => handleQuantityChange(size, criteria.value, 1)}
                            onDecrease={() => handleQuantityChange(size, criteria.value, -1)}
                            disabled={isDisabled || (!affordable && currentQty === 0)}
                          />
                        </div>
                      );
                    })}
                    
                    {/* Misto Column */}
                    <div className="flex flex-col items-center gap-1 p-2 rounded bg-accent/10 col-span-2 md:col-span-1">
                      <span className="text-xs text-accent font-medium">Misto</span>
                      <QuantitySelector
                        quantity={mistoQty}
                        onIncrease={() => handleQuantityChange(size, 'misto', 1)}
                        onDecrease={() => handleQuantityChange(size, 'misto', -1)}
                        disabled={!affordable && mistoQty === 0}
                      />
                    </div>
                  </div>
                  
                  {/* Misto Criteria Configuration - shows when misto is selected */}
                  {mistoQty > 0 && (
                    <div className="p-3 rounded bg-accent/5 border border-accent/20">
                      <p className="text-xs text-muted-foreground mb-2">Critérios do jogo Misto (selecione 2 ou 3):</p>
                      <div className="flex flex-wrap gap-3">
                        {MISTO_CRITERIA_OPTIONS.map((opt) => {
                          const isNaoVotados = opt.value === 'nao_votados';
                          const isDisabled = isNaoVotados && !naoVotadosAvailable;
                          const isChecked = mistoCriteria.has(opt.value);
                          const canUncheck = mistoCriteria.size > 2;
                          
                          return (
                            <label 
                              key={opt.value} 
                              className={`flex items-center gap-2 cursor-pointer ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => !isDisabled && handleMistoCriteriaToggle(size, opt.value)}
                                disabled={isDisabled || (isChecked && !canUncheck)}
                              />
                              <span className="text-sm">{opt.label}</span>
                              {isNaoVotados && !naoVotadosAvailable && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="h-3 w-3 text-warning" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Apenas {notVotedCount} números não votados disponíveis</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                const criteriaLabel = selection.criteria === 'misto' 
                  ? getMistoLabel(selection)
                  : SIMPLE_CRITERIA_OPTIONS.find(c => c.value === selection.criteria)?.label || selection.criteria;
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
