import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sparkles, DollarSign, Check } from "lucide-react";

export interface SuggestedGame {
  id: string;
  numbers: number[];
  cost: number;
  type: string; // "7 dezenas", "8 dezenas", etc.
  reason: string;
}

interface NumberAnalysis {
  mostVoted: Array<{ number: number; count: number }>;
  leastVoted: Array<{ number: number; count: number }>;
  notVoted: number[];
}

interface GameSuggestionsProps {
  totalBudget: number;
  individualGamesCost: number;
  suggestions: SuggestedGame[];
  analysis: NumberAnalysis;
  onSelectionChange?: (selectedGames: SuggestedGame[], remainingBudget: number) => void;
}

export function GameSuggestions({
  totalBudget,
  individualGamesCost,
  suggestions,
  analysis,
  onSelectionChange,
}: GameSuggestionsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const availableBudget = totalBudget - individualGamesCost;

  const { selectedCost, remainingBudget } = useMemo(() => {
    const cost = suggestions
      .filter(s => selectedIds.has(s.id))
      .reduce((sum, s) => sum + s.cost, 0);
    return {
      selectedCost: cost,
      remainingBudget: availableBudget - cost,
    };
  }, [selectedIds, suggestions, availableBudget]);

  const handleToggle = (game: SuggestedGame) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(game.id)) {
      newSelected.delete(game.id);
    } else {
      // Check if can afford
      const newCost = selectedCost + game.cost;
      if (newCost <= availableBudget) {
        newSelected.add(game.id);
      }
    }
    setSelectedIds(newSelected);
    
    const selectedGames = suggestions.filter(s => newSelected.has(s.id));
    const newRemaining = availableBudget - selectedGames.reduce((sum, s) => sum + s.cost, 0);
    onSelectionChange?.(selectedGames, newRemaining);
  };

  const canAfford = (game: SuggestedGame) => {
    if (selectedIds.has(game.id)) return true;
    return (remainingBudget - game.cost) >= 0;
  };

  return (
    <Card className="animate-fade-in border-accent/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-accent">
          <Sparkles className="h-5 w-5" />
          Sugestões de Jogos
        </CardTitle>
        <CardDescription>
          Selecione os jogos que deseja incluir no bolão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Budget Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground">Orçamento Total</p>
            <p className="text-lg font-bold">R$ {totalBudget.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground">Jogos Individuais</p>
            <p className="text-lg font-bold text-primary">R$ {individualGamesCost.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground">Jogos Adicionais</p>
            <p className="text-lg font-bold text-accent">R$ {selectedCost.toFixed(2)}</p>
          </div>
          <div className={`p-3 rounded-lg border ${remainingBudget >= 0 ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
            <p className="text-xs text-muted-foreground">Saldo Disponível</p>
            <p className={`text-lg font-bold ${remainingBudget >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {remainingBudget.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Number Analysis */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Análise dos Números</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-2">🔥 Mais Votados</p>
              <div className="flex flex-wrap gap-1">
                {analysis.mostVoted.slice(0, 6).map(({ number, count }) => (
                  <Badge key={number} variant="secondary" className="bg-primary/20 text-primary">
                    {number.toString().padStart(2, "0")} ({count}x)
                  </Badge>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-2">❄️ Menos Votados</p>
              <div className="flex flex-wrap gap-1">
                {analysis.leastVoted.slice(0, 6).map(({ number, count }) => (
                  <Badge key={number} variant="outline">
                    {number.toString().padStart(2, "0")} ({count}x)
                  </Badge>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-xs text-muted-foreground mb-2">✨ Não Votados</p>
              <div className="flex flex-wrap gap-1">
                {analysis.notVoted.length > 0 ? (
                  analysis.notVoted.slice(0, 8).map((number) => (
                    <Badge key={number} variant="outline" className="border-accent/50 text-accent">
                      {number.toString().padStart(2, "0")}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Todos votados</span>
                )}
                {analysis.notVoted.length > 8 && (
                  <Badge variant="outline" className="border-accent/50 text-accent">
                    +{analysis.notVoted.length - 8}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Game Suggestions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Jogos Sugeridos</h4>
          <div className="space-y-2">
            {suggestions.map((game) => {
              const isSelected = selectedIds.has(game.id);
              const affordable = canAfford(game);
              
              return (
                <div
                  key={game.id}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-accent/10 border-accent' 
                      : affordable 
                        ? 'hover:bg-muted/50 border-border' 
                        : 'opacity-50 cursor-not-allowed border-border'
                  }`}
                  onClick={() => affordable && handleToggle(game)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      checked={isSelected}
                      disabled={!affordable && !isSelected}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={isSelected ? "default" : "secondary"}>
                            {game.type}
                          </Badge>
                          {isSelected && (
                            <Check className="h-4 w-4 text-accent" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-4 w-4" />
                          R$ {game.cost.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {game.numbers.map((num) => (
                          <span
                            key={num}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                              isSelected 
                                ? 'bg-accent text-accent-foreground' 
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {num.toString().padStart(2, "0")}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{game.reason}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        {selectedIds.size > 0 && (
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedIds.size} jogo(s) selecionado(s)</p>
                <p className="text-sm text-muted-foreground">
                  Total: R$ {selectedCost.toFixed(2)}
                </p>
              </div>
              <Badge variant="default" className="text-lg px-4 py-2">
                Saldo: R$ {remainingBudget.toFixed(2)}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
