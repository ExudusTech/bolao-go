import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { BetsTable } from "@/components/bolao/BetsTable";
import { GameSuggestions, SuggestedGame, GameCriteria } from "@/components/bolao/GameSuggestions";
import { MessagesPanel } from "@/components/bolao/MessagesPanel";
import { RegistrationSummary } from "@/components/bolao/RegistrationSummary";
import { LotteryResultsChecker } from "@/components/bolao/LotteryResultsChecker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, Copy, ArrowLeft, Users, Key, FileText, DollarSign, Sparkles, Ticket } from "lucide-react";
import { LOTTERY_TYPES } from "@/lib/validations";

interface Bolao {
  id: string;
  nome_do_bolao: string;
  chave_pix: string;
  observacoes: string | null;
  total_apostas: number;
  valor_cota: number;
  tipo_loteria: string;
  created_at: string;
  numero_concurso: number | null;
  numeros_sorteados: number[] | null;
  resultado_verificado: boolean | null;
}

interface Aposta {
  id: string;
  apelido: string;
  celular: string;
  dezenas: number[];
  created_at: string;
  payment_status: string;
  receipt_url: string | null;
  registrado: boolean;
  data_registro: string | null;
}

interface NumberAnalysis {
  mostVoted: Array<{ number: number; count: number }>;
  leastVoted: Array<{ number: number; count: number }>;
  notVoted: number[];
}

interface SuggestionsData {
  analysis: NumberAnalysis;
  suggestions: SuggestedGame[];
  individualGamesCost: number;
  availableBudget: number;
}

export default function BolaoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingMoreSuggestions, setLoadingMoreSuggestions] = useState(false);
  const [savingGames, setSavingGames] = useState(false);
  const [suggestionsData, setSuggestionsData] = useState<SuggestionsData | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;

    const [bolaoRes, apostasRes] = await Promise.all([
      supabase.from("boloes").select("*").eq("id", id).single(),
      supabase.from("apostas").select("*").eq("bolao_id", id).order("created_at", { ascending: false }),
    ]);

    if (!bolaoRes.error && bolaoRes.data) {
      setBolao(bolaoRes.data);
    }

    if (!apostasRes.error && apostasRes.data) {
      setApostas(apostasRes.data);
    }

    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const paidApostas = apostas.filter(a => a.payment_status === 'paid');
  const totalArrecadado = paidApostas.length * (bolao?.valor_cota || 0);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    toast.success("Lista atualizada!");
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/participar/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleExportCSV = () => {
    if (paidApostas.length === 0) {
      toast.error("Não há apostas pagas para exportar");
      return;
    }

    setExporting(true);

    const headers = ["Apelido", "Celular", "Dezenas", "Data/Hora"];
    const rows = paidApostas.map((a) => [
      a.apelido,
      a.celular,
      a.dezenas.sort((x, y) => x - y).map(n => n.toString().padStart(2, "0")).join(", "),
      new Date(a.created_at).toLocaleString("pt-BR"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${bolao?.nome_do_bolao || "bolao"}_apostas_pagas.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    toast.success(`${paidApostas.length} apostas pagas exportadas!`);
  };

  const handleGetSuggestions = async () => {
    if (paidApostas.length === 0) {
      toast.error("É necessário ter apostas pagas para gerar sugestões");
      return;
    }

    setLoadingSuggestions(true);
    setSuggestionsData(null);

    const apostasParaIA = paidApostas.map(a => ({
      apelido: a.apelido,
      dezenas: a.dezenas.sort((x, y) => x - y),
    }));

    const lotteryType = bolao?.tipo_loteria || "megasena";
    const lotteryConfig = LOTTERY_TYPES[lotteryType as keyof typeof LOTTERY_TYPES];

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          totalArrecadado,
          lotteryConfig,
          apostas: apostasParaIA,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
          return;
        }
        if (response.status === 402) {
          toast.error("Créditos insuficientes. Entre em contato com o suporte.");
          return;
        }
        throw new Error("Erro ao gerar sugestões");
      }

      const data = await response.json();
      setSuggestionsData(data);
      toast.success(`${data.suggestions.length} jogos sugeridos!`);
    } catch (error) {
      console.error("Error getting suggestions:", error);
      toast.error("Erro ao gerar sugestões de jogos");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleRequestMoreSuggestions = async (excludeIds: string[], alreadySelectedCost: number, existingGameNumbers: number[][]): Promise<SuggestedGame[]> => {
    const apostasParaIA = paidApostas.map(a => ({
      apelido: a.apelido,
      dezenas: a.dezenas.sort((x, y) => x - y),
    }));

    const lotteryType = bolao?.tipo_loteria || "megasena";
    const lotteryConfig = LOTTERY_TYPES[lotteryType as keyof typeof LOTTERY_TYPES];

    setLoadingMoreSuggestions(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          totalArrecadado,
          lotteryConfig,
          apostas: apostasParaIA,
          excludeIds,
          alreadySelectedCost,
          existingGameNumbers,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
          return [];
        }
        if (response.status === 402) {
          toast.error("Créditos insuficientes. Entre em contato com o suporte.");
          return [];
        }
        throw new Error("Erro ao gerar sugestões");
      }

      const data = await response.json();
      toast.success(`Mais ${data.suggestions.length} jogos sugeridos!`);
      return data.suggestions;
    } catch (error) {
      console.error("Error getting more suggestions:", error);
      toast.error("Erro ao gerar mais sugestões");
      return [];
    } finally {
      setLoadingMoreSuggestions(false);
    }
  };

  const handleRequestCustomSuggestion = async (
    excludeIds: string[], 
    alreadySelectedCost: number, 
    size: number, 
    criteria: GameCriteria,
    existingGameNumbers: number[][]
  ): Promise<SuggestedGame | null> => {
    const apostasParaIA = paidApostas.map(a => ({
      apelido: a.apelido,
      dezenas: a.dezenas.sort((x, y) => x - y),
    }));

    const lotteryType = bolao?.tipo_loteria || "megasena";
    const lotteryConfig = LOTTERY_TYPES[lotteryType as keyof typeof LOTTERY_TYPES];

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          totalArrecadado,
          lotteryConfig,
          apostas: apostasParaIA,
          excludeIds,
          alreadySelectedCost,
          existingGameNumbers,
          customRequest: { size, criteria },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
          return null;
        }
        if (response.status === 402) {
          toast.error("Créditos insuficientes. Entre em contato com o suporte.");
          return null;
        }
        throw new Error("Erro ao gerar sugestão");
      }

      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
        return null;
      }
      return data.customGame || null;
    } catch (error) {
      console.error("Error getting custom suggestion:", error);
      toast.error("Erro ao gerar sugestão personalizada");
      return null;
    }
  };

  const handleSaveGames = async (games: SuggestedGame[]): Promise<boolean> => {
    if (!id || games.length === 0) return false;

    setSavingGames(true);

    try {
      // First delete existing saved games for this bolao
      const { error: deleteError } = await supabase
        .from("jogos_selecionados")
        .delete()
        .eq("bolao_id", id);

      if (deleteError) {
        console.error("Error deleting old games:", deleteError);
      }

      // Insert new games
      const gamesToInsert = games.map(game => ({
        bolao_id: id,
        dezenas: game.numbers,
        tipo: game.type,
        custo: game.cost,
        categoria: game.reason.includes("MAIS VOTADOS") 
          ? "mais votados" 
          : game.reason.includes("MENOS VOTADOS") 
            ? "menos votados" 
            : game.reason.includes("NÃO VOTADOS")
              ? "não votados"
              : "misto",
      }));

      const { error: insertError } = await supabase
        .from("jogos_selecionados")
        .insert(gamesToInsert);

      if (insertError) {
        console.error("Error saving games:", insertError);
        toast.error("Erro ao salvar jogos");
        return false;
      }

      toast.success(`${games.length} jogos salvos com sucesso!`);
      return true;
    } catch (error) {
      console.error("Error saving games:", error);
      toast.error("Erro ao salvar jogos");
      return false;
    } finally {
      setSavingGames(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="container py-8 px-4 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </main>
        </div>
      </AuthGuard>
    );
  }

  if (!bolao) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="container py-8 px-4 text-center">
            <p className="text-muted-foreground">Bolão não encontrado</p>
            <Button asChild className="mt-4">
              <Link to="/gestor/dashboard">Voltar ao Dashboard</Link>
            </Button>
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 px-4">
          <div className="space-y-6">
            {/* Back Button */}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/gestor/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>

            {/* Bolao Info Card */}
            <Card className="animate-fade-in">
              <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl">{bolao.nome_do_bolao}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      {LOTTERY_TYPES[bolao.tipo_loteria as keyof typeof LOTTERY_TYPES]?.name || bolao.tipo_loteria} • Criado em {new Date(bolao.created_at).toLocaleDateString("pt-BR")}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="flex items-center gap-2 text-lg px-4 py-2 bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                      <span className="font-bold">{bolao.total_apostas}</span>
                      <span className="text-sm font-normal">apostas</span>
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-2 text-lg px-4 py-2 bg-success/10 text-success">
                      <DollarSign className="h-5 w-5" />
                      <span className="font-bold">R$ {totalArrecadado.toFixed(2)}</span>
                      <span className="text-sm font-normal">arrecadado</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-start gap-2">
                    <Key className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Chave PIX</p>
                      <p className="text-muted-foreground">{bolao.chave_pix}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Valor da Cota</p>
                      <p className="text-muted-foreground">R$ {bolao.valor_cota.toFixed(2)}</p>
                    </div>
                  </div>
                  {bolao.observacoes && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Observações</p>
                        <p className="text-muted-foreground">{bolao.observacoes}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Resumo de Pagamentos</p>
                      <p className="text-muted-foreground text-sm">
                        {paidApostas.length} de {apostas.length} apostas pagas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-success">R$ {totalArrecadado.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Total arrecadado</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleCopyLink} className="hover-scale">
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Link
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="hover-scale">
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                    Atualizar Lista
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting || paidApostas.length === 0} className="hover-scale">
                    <Download className={`h-4 w-4 mr-2 ${exporting ? "animate-spin" : ""}`} />
                    Exportar CSV
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleGetSuggestions} 
                    disabled={loadingSuggestions || paidApostas.length === 0}
                    className="hover-scale bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {loadingSuggestions ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Sugerir Jogos com IA
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Suggestions */}
            {suggestionsData && (
              <GameSuggestions
                totalBudget={totalArrecadado}
                individualGamesCost={suggestionsData.individualGamesCost}
                suggestions={suggestionsData.suggestions}
                analysis={suggestionsData.analysis}
                onSelectionChange={(selectedGames, remainingBudget) => {
                  console.log("Selected games:", selectedGames.length, "Remaining:", remainingBudget);
                }}
                onRequestMoreSuggestions={handleRequestMoreSuggestions}
                onRequestCustomSuggestion={handleRequestCustomSuggestion}
                onSaveGames={handleSaveGames}
                isLoadingMore={loadingMoreSuggestions}
                isSaving={savingGames}
                minGameCost={LOTTERY_TYPES[bolao.tipo_loteria as keyof typeof LOTTERY_TYPES]?.prices[7] || 4.50}
                lotteryName={LOTTERY_TYPES[bolao.tipo_loteria as keyof typeof LOTTERY_TYPES]?.name || "Mega-Sena"}
                availableSizes={Object.keys(LOTTERY_TYPES[bolao.tipo_loteria as keyof typeof LOTTERY_TYPES]?.prices || {}).map(Number).filter(n => n >= 7)}
            />
            )}

            {/* Registration Summary - Always Visible */}
            <RegistrationSummary 
              bolaoId={bolao.id}
              lotteryName={LOTTERY_TYPES[bolao.tipo_loteria as keyof typeof LOTTERY_TYPES]?.name || "Mega-Sena"}
              paidBets={paidApostas.map(a => ({ 
                id: a.id, 
                apelido: a.apelido, 
                dezenas: a.dezenas,
                registrado: a.registrado,
                data_registro: a.data_registro
              }))}
              onBetRegistrationChange={fetchData}
            />

            {/* Lottery Results Checker */}
            <LotteryResultsChecker
              bolaoId={bolao.id}
              lotteryType={bolao.tipo_loteria}
              savedNumeroConcurso={bolao.numero_concurso}
              savedNumerosSorteados={bolao.numeros_sorteados}
              savedResultadoVerificado={bolao.resultado_verificado || false}
              paidBets={paidApostas.map(a => ({ id: a.id, apelido: a.apelido, dezenas: a.dezenas }))}
            />

            {/* Messages Panel */}
            <MessagesPanel bolaoId={bolao.id} isGestor={true} />

            {/* Bets Table */}
            <Card>
              <CardHeader>
                <CardTitle>Apostas Registradas</CardTitle>
              </CardHeader>
              <CardContent>
                <BetsTable bets={apostas} onPaymentUpdate={fetchData} />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
