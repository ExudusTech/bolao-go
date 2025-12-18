import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, DollarSign, Check, RefreshCw, Loader2, Save, FileText, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

export interface SuggestedGame {
  id: string;
  numbers: number[];
  cost: number;
  type: string;
  reason: string;
}

interface NumberAnalysis {
  mostVoted: Array<{ number: number; count: number }>;
  leastVoted: Array<{ number: number; count: number }>;
  notVoted: number[];
}

export type GameCriteria = "mais_votados" | "menos_votados" | "nao_votados" | "misto";

interface GameSuggestionsProps {
  totalBudget: number;
  individualGamesCost: number;
  suggestions: SuggestedGame[];
  analysis: NumberAnalysis;
  onSelectionChange?: (selectedGames: SuggestedGame[], remainingBudget: number) => void;
  onRequestMoreSuggestions?: (excludeIds: string[], alreadySelectedCost: number, existingGameNumbers: number[][]) => Promise<SuggestedGame[]>;
  onRequestCustomSuggestion?: (excludeIds: string[], alreadySelectedCost: number, size: number, criteria: GameCriteria, existingGameNumbers: number[][]) => Promise<SuggestedGame | null>;
  onSaveGames?: (games: SuggestedGame[]) => Promise<boolean>;
  isLoadingMore?: boolean;
  isSaving?: boolean;
  minGameCost?: number;
  lotteryName?: string;
  availableSizes?: number[];
}

export function GameSuggestions({
  totalBudget,
  individualGamesCost,
  suggestions: initialSuggestions,
  analysis,
  onSelectionChange,
  onRequestMoreSuggestions,
  onRequestCustomSuggestion,
  onSaveGames,
  isLoadingMore = false,
  isSaving = false,
  minGameCost = 4.50,
  lotteryName = "Mega-Sena",
  availableSizes = [7, 8, 9, 10],
}: GameSuggestionsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allSuggestions, setAllSuggestions] = useState<SuggestedGame[]>(initialSuggestions);
  const [showSummary, setShowSummary] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customSize, setCustomSize] = useState<string>("");
  const [customCriteria, setCustomCriteria] = useState<GameCriteria | "">("");
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);

  // Sync new suggestions from props (for "more suggestions" feature)
  useEffect(() => {
    const existingIds = new Set(allSuggestions.map(s => s.id));
    const newSuggestions = initialSuggestions.filter(s => !existingIds.has(s.id));
    if (newSuggestions.length > 0) {
      setAllSuggestions(prev => [...prev, ...newSuggestions]);
    }
  }, [initialSuggestions]);

  const availableBudget = totalBudget - individualGamesCost;

  const { selectedCost, remainingBudget, selectedGames } = useMemo(() => {
    const selected = allSuggestions.filter(s => selectedIds.has(s.id));
    const cost = selected.reduce((sum, s) => sum + s.cost, 0);
    return {
      selectedCost: cost,
      remainingBudget: availableBudget - cost,
      selectedGames: selected,
    };
  }, [selectedIds, allSuggestions, availableBudget]);

  const handleToggle = (game: SuggestedGame) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(game.id)) {
      newSelected.delete(game.id);
    } else {
      const newCost = selectedCost + game.cost;
      if (newCost <= availableBudget) {
        newSelected.add(game.id);
      }
    }
    setSelectedIds(newSelected);
    
    const newSelectedGames = allSuggestions.filter(s => newSelected.has(s.id));
    const newRemaining = availableBudget - newSelectedGames.reduce((sum, s) => sum + s.cost, 0);
    onSelectionChange?.(newSelectedGames, newRemaining);
  };

  const canAfford = (game: SuggestedGame) => {
    if (selectedIds.has(game.id)) return true;
    return (remainingBudget - game.cost) >= 0;
  };

  const handleRequestMore = async () => {
    if (!onRequestMoreSuggestions) return;
    const excludeIds = allSuggestions.map(s => s.id);
    const existingGameNumbers = allSuggestions.map(s => s.numbers);
    const newSuggestions = await onRequestMoreSuggestions(excludeIds, selectedCost, existingGameNumbers);
    if (newSuggestions.length > 0) {
      setAllSuggestions(prev => [...prev, ...newSuggestions]);
    }
  };

  const handleSave = async () => {
    if (!onSaveGames || selectedGames.length === 0) return;
    const success = await onSaveGames(selectedGames);
    if (success) {
      setShowSummary(true);
    }
  };

  const handleCustomSuggestion = async () => {
    if (!onRequestCustomSuggestion || !customSize || !customCriteria) return;
    
    setIsLoadingCustom(true);
    try {
      const excludeIds = allSuggestions.map(s => s.id);
      const existingGameNumbers = allSuggestions.map(s => s.numbers);
      const newGame = await onRequestCustomSuggestion(excludeIds, selectedCost, parseInt(customSize), customCriteria, existingGameNumbers);
      if (newGame) {
        setAllSuggestions(prev => [...prev, newGame]);
        toast.success("Novo jogo sugerido!");
      } else {
        toast.error("Não foi possível gerar um jogo com esses critérios");
      }
    } catch (error) {
      toast.error("Erro ao gerar sugestão");
    } finally {
      setIsLoadingCustom(false);
      setShowCustomForm(false);
      setCustomSize("");
      setCustomCriteria("");
    }
  };

  const handleCopySummary = () => {
    const summary = generateSummaryText();
    navigator.clipboard.writeText(summary);
    toast.success("Resumo copiado para a área de transferência!");
  };

  const generateSummaryText = () => {
    const lines = [
      `📋 RESUMO PARA REGISTRO NA LOTÉRICA`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Loteria: ${lotteryName}`,
      `Total de Jogos: ${selectedGames.length}`,
      `Valor Total: R$ ${selectedCost.toFixed(2)}`,
      ``,
      `JOGOS SELECIONADOS:`,
      ``,
    ];

    selectedGames.forEach((game, index) => {
      const nums = game.numbers.map(n => n.toString().padStart(2, "0")).join(" - ");
      lines.push(`Jogo ${index + 1} (${game.type}): ${nums}`);
      lines.push(`   Valor: R$ ${game.cost.toFixed(2)}`);
      lines.push(``);
    });

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`Gerado por Robolão`);

    return lines.join("\n");
  };

  const canRequestMore = remainingBudget >= minGameCost && onRequestMoreSuggestions;
  const unselectedSuggestions = allSuggestions.filter(s => !selectedIds.has(s.id));
  const hasAffordableUnselected = unselectedSuggestions.some(s => s.cost <= remainingBudget);

  if (showSummary) {
    return (
      <Card className="animate-fade-in border-success/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <FileText className="h-5 w-5" />
            Resumo para Registro na Lotérica
          </CardTitle>
          <CardDescription>
            Jogos salvos com sucesso! Use este resumo para registrar na lotérica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Header */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 border text-center">
              <p className="text-xs text-muted-foreground">Loteria</p>
              <p className="text-lg font-bold">{lotteryName}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border text-center">
              <p className="text-xs text-muted-foreground">Total de Jogos</p>
              <p className="text-lg font-bold">{selectedGames.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-center">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold text-success">R$ {selectedCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Games List */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Jogos para Registro</h4>
            <div className="space-y-2">
              {selectedGames.map((game, index) => (
                <div key={game.id} className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="default">Jogo {index + 1} - {game.type}</Badge>
                    <span className="text-sm font-medium">R$ {game.cost.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {game.numbers.map((num) => (
                      <span
                        key={num}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                      >
                        {num.toString().padStart(2, "0")}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCopySummary} className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              Copiar Resumo
            </Button>
            <Button variant="outline" onClick={() => setShowSummary(false)} className="flex-1">
              Voltar às Sugestões
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in border-accent/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-accent">
          <Sparkles className="h-5 w-5" />
          Sugestões de Jogos
        </CardTitle>
        <CardDescription>
          Selecione os jogos até esgotar o orçamento disponível
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
            <p className="text-xs text-muted-foreground">Jogos Selecionados</p>
            <p className="text-lg font-bold text-accent">R$ {selectedCost.toFixed(2)}</p>
          </div>
          <div className={`p-3 rounded-lg border ${remainingBudget < minGameCost ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'}`}>
            <p className="text-xs text-muted-foreground">Saldo Disponível</p>
            <p className={`text-lg font-bold ${remainingBudget < minGameCost ? 'text-success' : 'text-warning'}`}>
              R$ {remainingBudget.toFixed(2)}
            </p>
            {remainingBudget < minGameCost && (
              <p className="text-xs text-success mt-1">Orçamento esgotado!</p>
            )}
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
          <h4 className="text-sm font-medium">Jogos Sugeridos ({allSuggestions.length})</h4>
          <div className="space-y-2">
            {allSuggestions.map((game) => {
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

        {/* Request More Suggestions */}
        {canRequestMore && (
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 space-y-4">
            <p className="text-sm text-warning">
              Ainda há R$ {remainingBudget.toFixed(2)} de saldo disponível.
            </p>
            
            {!showCustomForm ? (
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={handleRequestMore} 
                  disabled={isLoadingMore}
                  variant="outline"
                  className="border-warning text-warning hover:bg-warning/10"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sugestões Automáticas
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => setShowCustomForm(true)} 
                  variant="outline"
                  className="border-accent text-accent hover:bg-accent/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Sugerir Jogo Personalizado
                </Button>
              </div>
            ) : (
              <div className="space-y-4 p-4 rounded-lg bg-background border">
                <h4 className="font-medium">Configurar Jogo Personalizado</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Quantidade de Números</label>
                    <Select value={customSize} onValueChange={setCustomSize}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSizes.map(size => (
                          <SelectItem key={size} value={size.toString()}>
                            {size} dezenas
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Critério de Seleção</label>
                    <Select value={customCriteria} onValueChange={(v) => setCustomCriteria(v as GameCriteria)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mais_votados">🔥 Mais Votados</SelectItem>
                        <SelectItem value="menos_votados">❄️ Menos Votados</SelectItem>
                        <SelectItem value="nao_votados">✨ Não Votados</SelectItem>
                        <SelectItem value="misto">🎲 Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCustomSuggestion}
                    disabled={!customSize || !customCriteria || isLoadingCustom}
                    className="flex-1"
                  >
                    {isLoadingCustom ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Gerar Sugestão
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomSize("");
                      setCustomCriteria("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary and Save */}
        {selectedIds.size > 0 && (
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 space-y-4">
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
            
            {onSaveGames && (
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full bg-success hover:bg-success/90 text-success-foreground"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Jogos e Gerar Resumo
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Budget Exhausted Message */}
        {remainingBudget < minGameCost && selectedIds.size > 0 && !onSaveGames && (
          <div className="p-4 rounded-lg bg-success/10 border border-success/30 text-center">
            <Check className="h-6 w-6 text-success mx-auto mb-2" />
            <p className="font-medium text-success">Orçamento totalmente utilizado!</p>
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} jogo(s) selecionado(s) consumindo R$ {selectedCost.toFixed(2)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
