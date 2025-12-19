import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Trophy, Loader2, Search, Star, CheckCircle2 } from "lucide-react";

interface MatchResult {
  jogoId: string;
  dezenas: number[];
  acertos: number[];
  quantidadeAcertos: number;
  apelido?: string;
}

interface LotteryResult {
  success: boolean;
  concurso: number;
  dataApuracao: string;
  numerosSorteados: number[];
  acumulado: boolean;
  valorAcumulado: number;
  resultadosJogos: MatchResult[];
  resultadosApostas: (MatchResult & { apelido?: string })[];
  resumo: {
    totalJogosVerificados: number;
    maiorQuantidadeAcertos: number;
    jogosComQuatroOuMaisAcertos: number;
  };
}

interface LotteryResultsCheckerProps {
  bolaoId: string;
  lotteryType: string;
  savedNumeroConcurso?: number | null;
  savedNumerosSorteados?: number[] | null;
  savedResultadoVerificado?: boolean;
  paidBets: Array<{ id: string; apelido: string; dezenas: number[] }>;
}

export function LotteryResultsChecker({ 
  bolaoId, 
  lotteryType,
  savedNumeroConcurso,
  savedNumerosSorteados,
  savedResultadoVerificado,
  paidBets
}: LotteryResultsCheckerProps) {
  const [numeroConcurso, setNumeroConcurso] = useState(savedNumeroConcurso?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LotteryResult | null>(null);

  const handleCheckResults = async () => {
    if (!numeroConcurso.trim()) {
      toast.error("Informe o número do concurso");
      return;
    }

    const concursoNum = parseInt(numeroConcurso, 10);
    if (isNaN(concursoNum) || concursoNum <= 0) {
      toast.error("Número do concurso inválido");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-lottery-results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          bolaoId,
          numeroConcurso: concursoNum,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao verificar resultado");
        return;
      }

      // Add apelido to apostas results
      const resultadosApostasComApelido = data.resultadosApostas.map((r: MatchResult) => {
        const bet = paidBets.find(b => b.id === r.jogoId);
        return { ...r, apelido: bet?.apelido || "Desconhecido" };
      });

      setResult({ ...data, resultadosApostas: resultadosApostasComApelido });
      toast.success("Resultado verificado com sucesso!");
    } catch (error) {
      console.error("Error checking results:", error);
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
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
    return "";
  };

  // If we have saved results, show them
  const displayNumbers = result?.numerosSorteados || savedNumerosSorteados;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Verificar Resultado
        </CardTitle>
        <CardDescription>
          Consulte o resultado do concurso e veja quantos acertos cada jogo teve
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="concurso">Número do Concurso</Label>
            <Input
              id="concurso"
              type="number"
              placeholder="Ex: 2800"
              value={numeroConcurso}
              onChange={(e) => setNumeroConcurso(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCheckResults} disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Verificar
            </Button>
          </div>
        </div>

        {/* Drawn Numbers Display */}
        {displayNumbers && displayNumbers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Números Sorteados
                {savedResultadoVerificado && !result && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verificado anteriormente
                  </Badge>
                )}
              </h4>
              {result && (
                <span className="text-xs text-muted-foreground">
                  Concurso {result.concurso} - {result.dataApuracao}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-center p-4 rounded-lg bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30">
              {displayNumbers.map((num) => (
                <span
                  key={num}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500 text-yellow-950 text-lg font-bold shadow-lg"
                >
                  {num.toString().padStart(2, "0")}
                </span>
              ))}
            </div>
            {result?.acumulado && (
              <p className="text-center text-sm text-muted-foreground">
                Acumulou! Próximo prêmio: R$ {(result.valorAcumulado / 1000000).toFixed(1)} milhões
              </p>
            )}
          </div>
        )}

        {/* Results Summary */}
        {result && (
          <>
            <Separator />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">Jogos Verificados</p>
                <p className="text-2xl font-bold">{result.resumo.totalJogosVerificados}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-xs text-muted-foreground">Maior Acerto</p>
                <p className="text-2xl font-bold text-primary">{result.resumo.maiorQuantidadeAcertos}</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10 border border-success/30">
                <p className="text-xs text-muted-foreground">4+ Acertos</p>
                <p className="text-2xl font-bold text-success">{result.resumo.jogosComQuatroOuMaisAcertos}</p>
              </div>
            </div>

            {/* Games Results */}
            {result.resultadosJogos.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Jogos Selecionados</h4>
                <div className="space-y-2">
                  {result.resultadosJogos
                    .sort((a, b) => b.quantidadeAcertos - a.quantidadeAcertos)
                    .map((jogo, index) => (
                      <div 
                        key={jogo.jogoId} 
                        className={`p-3 rounded-lg border ${jogo.quantidadeAcertos >= 4 ? "bg-success/10 border-success/30" : "bg-muted/30"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Jogo {index + 1}</span>
                          <Badge variant={getMatchBadgeVariant(jogo.quantidadeAcertos)} className={getMatchColor(jogo.quantidadeAcertos)}>
                            {jogo.quantidadeAcertos} acertos
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {jogo.dezenas.map((num) => (
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
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Individual Bets Results */}
            {result.resultadosApostas.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Apostas Individuais</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.resultadosApostas
                    .sort((a, b) => b.quantidadeAcertos - a.quantidadeAcertos)
                    .map((aposta) => (
                      <div 
                        key={aposta.jogoId} 
                        className={`p-3 rounded-lg border ${aposta.quantidadeAcertos >= 4 ? "bg-success/10 border-success/30" : "bg-muted/30"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{aposta.apelido}</span>
                          <Badge variant={getMatchBadgeVariant(aposta.quantidadeAcertos)} className={getMatchColor(aposta.quantidadeAcertos)}>
                            {aposta.quantidadeAcertos} acertos
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
