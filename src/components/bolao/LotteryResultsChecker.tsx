import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Trophy, Star, CheckCircle2, X, Bell, Loader2, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MatchResult {
  jogoId: string;
  dezenas: number[];
  acertos: number[];
  quantidadeAcertos: number;
  apelido?: string;
  tipo: 'aposta' | 'jogo';
  categoria?: string;
  // For games with more than 6 numbers, we calculate combinations
  combinacoes?: {
    senas: number;
    quinas: number;
    quadras: number;
  };
}

interface ResultSummary {
  senas: number;
  quinas: number;
  quadras: number;
  ternos: number;
  totalVerificado: number;
  totalJogos: number;
}

interface SelectedGame {
  id: string;
  dezenas: number[];
  categoria: string;
  tipo: string;
  custo: number;
}

interface LotteryResultsCheckerProps {
  bolaoId: string;
  bolaoNome: string;
  lotteryType: string;
  savedNumeroConcurso?: number | null;
  savedNumerosSorteados?: number[] | null;
  savedResultadoVerificado?: boolean;
  paidBets: Array<{ id: string; apelido: string; dezenas: number[] }>;
  selectedGames?: SelectedGame[];
  onResultsVerified?: () => void;
}

// Helper function to calculate combinations C(n, k)
function combinations(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

// Calculate how many quinas/quadras come from a sena in a game with n numbers
function calculateCombinationsFromSena(totalNumbers: number): { quinas: number; quadras: number } {
  // If we have a sena (6 matches) in a game of N numbers:
  // - Quinas: C(6,5) * C(N-6,1) = 6 * (N-6)
  // - Quadras: C(6,4) * C(N-6,2) = 15 * C(N-6,2)
  const nonMatching = totalNumbers - 6;
  const quinas = 6 * nonMatching;
  const quadras = 15 * combinations(nonMatching, 2);
  return { quinas, quadras };
}

// Calculate combinations when we have exactly 5 matches
function calculateCombinationsFromQuina(totalNumbers: number, matchingNumbers: number): { quinas: number; quadras: number } {
  if (matchingNumbers < 5) return { quinas: 0, quadras: 0 };
  
  // Number of non-matching numbers selected
  const nonMatchingSelected = totalNumbers - matchingNumbers;
  
  // Quinas: we pick all 5 matching + 1 from non-matching = C(nonMatchingSelected, 1)
  const quinas = nonMatchingSelected > 0 ? nonMatchingSelected : 1;
  
  // Quadras: C(5,4) * C(nonMatchingSelected, 2) = 5 * C(nonMatchingSelected, 2)
  const quadras = 5 * combinations(nonMatchingSelected, 2);
  
  return { quinas, quadras };
}

export function LotteryResultsChecker({ 
  bolaoId, 
  bolaoNome,
  savedNumerosSorteados,
  savedResultadoVerificado,
  paidBets,
  selectedGames = [],
  onResultsVerified
}: LotteryResultsCheckerProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>(savedNumerosSorteados || []);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const toggleNumber = (num: number) => {
    if (results.length > 0) return; // Don't allow changes after verification
    
    setSelectedNumbers(prev => {
      if (prev.includes(num)) {
        return prev.filter(n => n !== num);
      }
      if (prev.length >= 6) {
        toast.error("Selecione exatamente 6 números");
        return prev;
      }
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  const clearSelection = () => {
    if (results.length > 0) return;
    setSelectedNumbers([]);
  };

  const calculateResults = () => {
    if (selectedNumbers.length !== 6) {
      toast.error("Selecione exatamente 6 números sorteados");
      return;
    }

    const allResults: MatchResult[] = [];

    // Process individual bets (always 6 numbers)
    paidBets.forEach(bet => {
      const acertos = bet.dezenas.filter(num => selectedNumbers.includes(num));
      allResults.push({
        jogoId: bet.id,
        dezenas: bet.dezenas,
        acertos,
        quantidadeAcertos: acertos.length,
        apelido: bet.apelido,
        tipo: 'aposta',
      });
    });

    // Process selected games (can have 6-20 numbers)
    selectedGames.forEach(game => {
      const acertos = game.dezenas.filter(num => selectedNumbers.includes(num));
      const quantidadeAcertos = acertos.length;
      const totalNumbers = game.dezenas.length;
      
      // Calculate combinations for games with more than 6 numbers
      let combinacoes;
      if (totalNumbers > 6 && quantidadeAcertos >= 4) {
        if (quantidadeAcertos === 6) {
          // Sena! Calculate all combinations
          const combFromSena = calculateCombinationsFromSena(totalNumbers);
          combinacoes = {
            senas: 1,
            quinas: combFromSena.quinas,
            quadras: combFromSena.quadras,
          };
        } else if (quantidadeAcertos === 5) {
          // Quina - calculate how many quinas and quadras
          const combFromQuina = calculateCombinationsFromQuina(totalNumbers, quantidadeAcertos);
          combinacoes = {
            senas: 0,
            quinas: combFromQuina.quinas,
            quadras: combFromQuina.quadras,
          };
        } else if (quantidadeAcertos === 4) {
          // Quadra - calculate combinations
          const nonMatchingSelected = totalNumbers - quantidadeAcertos;
          // C(4,4) * C(nonMatchingSelected, 2) = 1 * C(n,2)
          const quadras = combinations(nonMatchingSelected, 2);
          combinacoes = {
            senas: 0,
            quinas: 0,
            quadras: quadras > 0 ? quadras : 1,
          };
        }
      }

      allResults.push({
        jogoId: game.id,
        dezenas: game.dezenas,
        acertos,
        quantidadeAcertos,
        apelido: `Jogo ${game.dezenas.length} dezenas`,
        tipo: 'jogo',
        categoria: game.categoria,
        combinacoes,
      });
    });

    // Calculate summary - for games with combinations, use those values
    let senas = 0;
    let quinas = 0;
    let quadras = 0;
    let ternos = 0;

    allResults.forEach(r => {
      if (r.combinacoes) {
        senas += r.combinacoes.senas;
        quinas += r.combinacoes.quinas;
        quadras += r.combinacoes.quadras;
      } else {
        if (r.quantidadeAcertos === 6) senas++;
        else if (r.quantidadeAcertos === 5) quinas++;
        else if (r.quantidadeAcertos === 4) quadras++;
        else if (r.quantidadeAcertos === 3) ternos++;
      }
    });

    setResults(allResults.sort((a, b) => b.quantidadeAcertos - a.quantidadeAcertos));
    setSummary({
      senas,
      quinas,
      quadras,
      ternos,
      totalVerificado: paidBets.length + selectedGames.length,
      totalJogos: selectedGames.length,
    });

    toast.success("Resultado verificado!");
  };

  const handleSaveResults = async () => {
    if (selectedNumbers.length !== 6) {
      toast.error("Selecione exatamente 6 números");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("boloes")
        .update({
          numeros_sorteados: selectedNumbers,
          resultado_verificado: true,
        })
        .eq("id", bolaoId);

      if (error) {
        throw error;
      }

      toast.success("Resultado salvo com sucesso!");
      onResultsVerified?.();
    } catch (error) {
      console.error("Error saving results:", error);
      toast.error("Erro ao salvar resultado");
    } finally {
      setSaving(false);
    }
  };

  const resetVerification = () => {
    setResults([]);
    setSummary(null);
  };

  const handleNotifyParticipants = async () => {
    if (!summary) {
      toast.error("Verifique o resultado primeiro");
      return;
    }

    setNotifying(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      // Build the notification message
      const numbersStr = selectedNumbers.map(n => n.toString().padStart(2, "0")).join(", ");
      
      let resultParts: string[] = [];
      if (summary.senas > 0) resultParts.push(`${summary.senas} Sena${summary.senas > 1 ? 's' : ''}`);
      if (summary.quinas > 0) resultParts.push(`${summary.quinas} Quina${summary.quinas > 1 ? 's' : ''}`);
      if (summary.quadras > 0) resultParts.push(`${summary.quadras} Quadra${summary.quadras > 1 ? 's' : ''}`);
      
      const resultStr = resultParts.length > 0 ? resultParts.join(", ") : "0 prêmios";
      const hasPrize = summary.senas > 0 || summary.quinas > 0 || summary.quadras > 0;

      let message = `🎰 Atenção participantes do Bolão ${bolaoNome}! Os números sorteados foram: ${numbersStr}! Nosso Bolão teve o seguinte resultado: ${resultStr}!`;

      if (hasPrize) {
        message += ` 🏆 Vamos dividir a bufunfa e gastar! Favor informar a sua chave PIX para o Gestor realizar o rateio do prêmio.`;
      } else {
        message += ` 💪 Não desanime! Erga essa cabeça, mete o pé e vai na fé... Manda essa tristeza embora... Basta acreditar que um novo dia vai raiar... Sua hora vai chegar!`;
      }

      // Send the message
      const { error } = await supabase
        .from('mensagens')
        .insert({
          bolao_id: bolaoId,
          autor_nome: "Gestor",
          autor_gestor_id: user.id,
          conteudo: message
        });

      if (error) throw error;

      // Update bolao to mark notification sent
      await supabase
        .from('boloes')
        .update({ notificacao_aprovada: true })
        .eq('id', bolaoId);

      toast.success("Participantes notificados com sucesso!");
    } catch (error) {
      console.error("Error notifying participants:", error);
      toast.error("Erro ao notificar participantes");
    } finally {
      setNotifying(false);
    }
  };

  const getMatchBadgeVariant = (count: number) => {
    if (count >= 6) return "default";
    if (count >= 5) return "default";
    if (count >= 4) return "secondary";
    return "outline";
  };

  const getMatchColor = (count: number) => {
    if (count >= 6) return "bg-yellow-500 text-yellow-950";
    if (count >= 5) return "bg-success text-success-foreground";
    if (count >= 4) return "bg-primary text-primary-foreground";
    if (count >= 3) return "bg-orange-500 text-white";
    return "";
  };

  const getMatchLabel = (count: number) => {
    if (count === 6) return "SENA";
    if (count === 5) return "QUINA";
    if (count === 4) return "QUADRA";
    if (count === 3) return "TERNO";
    return `${count} acertos`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Verificar Resultado
        </CardTitle>
        <CardDescription>
          Informe os 6 números sorteados e veja quantos acertos cada aposta teve
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Number Selection Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Números Sorteados ({selectedNumbers.length}/6)
              {savedResultadoVerificado && results.length === 0 && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verificado anteriormente
                </Badge>
              )}
            </h4>
            {selectedNumbers.length > 0 && results.length === 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Selected Numbers Display */}
          {selectedNumbers.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center p-4 rounded-lg bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30">
              {selectedNumbers.map((num) => (
                <span
                  key={num}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500 text-yellow-950 text-lg font-bold shadow-lg cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => !results.length && toggleNumber(num)}
                >
                  {num.toString().padStart(2, "0")}
                </span>
              ))}
            </div>
          )}

          {/* Number Grid for Selection */}
          {results.length === 0 && (
            <div className="grid grid-cols-10 gap-1 sm:gap-2">
              {Array.from({ length: 60 }, (_, i) => i + 1).map((num) => {
                const isSelected = selectedNumbers.includes(num);
                return (
                  <button
                    key={num}
                    onClick={() => toggleNumber(num)}
                    className={`
                      aspect-square flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium
                      transition-all duration-200 border
                      ${isSelected 
                        ? "bg-yellow-500 text-yellow-950 border-yellow-600 ring-2 ring-yellow-400 shadow-lg scale-105" 
                        : "bg-card border-border hover:bg-accent hover:border-primary/50"
                      }
                    `}
                  >
                    {num.toString().padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-center pt-2">
            {results.length === 0 ? (
              <Button 
                onClick={calculateResults} 
                disabled={selectedNumbers.length !== 6}
                className="min-w-[150px]"
              >
                Verificar Apostas
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={resetVerification}>
                  Nova Verificação
                </Button>
                {!savedResultadoVerificado && (
                  <Button onClick={handleSaveResults} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar Resultado"}
                  </Button>
                )}
                {summary && (
                  <Button 
                    onClick={handleNotifyParticipants} 
                    disabled={notifying}
                    variant="default"
                    className="bg-success hover:bg-success/90"
                  >
                    {notifying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4 mr-2" />
                    )}
                    Notificar Participantes
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Results Summary */}
        {summary && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-center">Resumo dos Resultados</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-4 rounded-lg border text-center ${summary.senas > 0 ? "bg-yellow-500/20 border-yellow-500" : "bg-muted/50"}`}>
                  <p className="text-xs text-muted-foreground font-medium">Senas (6)</p>
                  <p className={`text-3xl font-bold ${summary.senas > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                    {summary.senas}
                  </p>
                </div>
                <div className={`p-4 rounded-lg border text-center ${summary.quinas > 0 ? "bg-success/20 border-success" : "bg-muted/50"}`}>
                  <p className="text-xs text-muted-foreground font-medium">Quinas (5)</p>
                  <p className={`text-3xl font-bold ${summary.quinas > 0 ? "text-success" : "text-muted-foreground"}`}>
                    {summary.quinas}
                  </p>
                </div>
                <div className={`p-4 rounded-lg border text-center ${summary.quadras > 0 ? "bg-primary/20 border-primary" : "bg-muted/50"}`}>
                  <p className="text-xs text-muted-foreground font-medium">Quadras (4)</p>
                  <p className={`text-3xl font-bold ${summary.quadras > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {summary.quadras}
                  </p>
                </div>
                <div className={`p-4 rounded-lg border text-center ${summary.ternos > 0 ? "bg-orange-500/20 border-orange-500" : "bg-muted/50"}`}>
                  <p className="text-xs text-muted-foreground font-medium">Ternos (3)</p>
                  <p className={`text-3xl font-bold ${summary.ternos > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                    {summary.ternos}
                  </p>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {summary.totalVerificado} jogos verificados 
                {summary.totalJogos > 0 && ` (${paidBets.length} apostas + ${summary.totalJogos} jogos do bolão)`}
              </p>
            </div>

            {/* Individual Results - Separated by type */}
            {results.length > 0 && (
              <div className="space-y-4">
                {/* Selected Games (if any) */}
                {selectedGames.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 text-primary" />
                      Jogos do Bolão ({selectedGames.length})
                    </h4>
                    <div className="space-y-2">
                      {results.filter(r => r.tipo === 'jogo').map((jogo) => (
                        <div 
                          key={jogo.jogoId} 
                          className={`p-3 rounded-lg border ${
                            jogo.quantidadeAcertos >= 4 
                              ? "bg-success/10 border-success/30" 
                              : jogo.quantidadeAcertos >= 3 
                                ? "bg-orange-500/10 border-orange-500/30"
                                : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{jogo.apelido}</span>
                              {jogo.categoria && (
                                <Badge variant="outline" className="text-xs">
                                  {jogo.categoria}
                                </Badge>
                              )}
                            </div>
                            <Badge 
                              variant={getMatchBadgeVariant(jogo.quantidadeAcertos)} 
                              className={getMatchColor(jogo.quantidadeAcertos)}
                            >
                              {getMatchLabel(jogo.quantidadeAcertos)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {jogo.dezenas.sort((a, b) => a - b).map((num) => (
                              <span
                                key={num}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                                  jogo.acertos.includes(num)
                                    ? "bg-success text-success-foreground ring-2 ring-success"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {num.toString().padStart(2, "0")}
                              </span>
                            ))}
                          </div>
                          {/* Show combinations if applicable */}
                          {jogo.combinacoes && jogo.quantidadeAcertos >= 4 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-xs text-muted-foreground">
                                🎯 Com {jogo.quantidadeAcertos} acertos em {jogo.dezenas.length} dezenas:
                                {jogo.combinacoes.senas > 0 && (
                                  <span className="ml-1 font-semibold text-yellow-600">{jogo.combinacoes.senas} sena</span>
                                )}
                                {jogo.combinacoes.quinas > 0 && (
                                  <span className="ml-1 font-semibold text-success">{jogo.combinacoes.quinas} quinas</span>
                                )}
                                {jogo.combinacoes.quadras > 0 && (
                                  <span className="ml-1 font-semibold text-primary">{jogo.combinacoes.quadras} quadras</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Bets */}
                {paidBets.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Detalhamento por Aposta ({paidBets.length})</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {results.filter(r => r.tipo === 'aposta').map((aposta) => (
                        <div 
                          key={aposta.jogoId} 
                          className={`p-3 rounded-lg border ${
                            aposta.quantidadeAcertos >= 4 
                              ? "bg-success/10 border-success/30" 
                              : aposta.quantidadeAcertos >= 3 
                                ? "bg-orange-500/10 border-orange-500/30"
                                : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{aposta.apelido}</span>
                            <Badge 
                              variant={getMatchBadgeVariant(aposta.quantidadeAcertos)} 
                              className={getMatchColor(aposta.quantidadeAcertos)}
                            >
                              {getMatchLabel(aposta.quantidadeAcertos)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {aposta.dezenas.sort((a, b) => a - b).map((num) => (
                              <span
                                key={num}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                                  aposta.acertos.includes(num)
                                    ? "bg-success text-success-foreground ring-2 ring-success"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {num.toString().padStart(2, "0")}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
