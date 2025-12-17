import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { BetsTable } from "@/components/bolao/BetsTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, Copy, ArrowLeft, Users, Key, FileText, DollarSign, Sparkles } from "lucide-react";

interface Bolao {
  id: string;
  nome_do_bolao: string;
  chave_pix: string;
  observacoes: string | null;
  total_apostas: number;
  valor_cota: number;
  created_at: string;
}

interface Aposta {
  id: string;
  apelido: string;
  celular: string;
  dezenas: number[];
  created_at: string;
  payment_status: string;
  receipt_url: string | null;
}

export default function BolaoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string | null>(null);

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
    setSuggestions(null);

    // Get most common dezenas from paid apostas
    const dezenaCount: Record<number, number> = {};
    paidApostas.forEach(a => {
      a.dezenas.forEach(d => {
        dezenaCount[d] = (dezenaCount[d] || 0) + 1;
      });
    });
    const topDezenas = Object.entries(dezenaCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([d]) => parseInt(d));

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          totalArrecadado,
          quantidadeApostasPagas: paidApostas.length,
          dezenasSelecionadas: topDezenas,
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
      setSuggestions(data.suggestion);
    } catch (error) {
      console.error("Error getting suggestions:", error);
      toast.error("Erro ao gerar sugestões de jogos");
    } finally {
      setLoadingSuggestions(false);
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
                    <CardDescription>
                      Criado em {new Date(bolao.created_at).toLocaleDateString("pt-BR")}
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
            {suggestions && (
              <Card className="animate-fade-in border-accent/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-accent">
                    <Sparkles className="h-5 w-5" />
                    Sugestões de Jogos
                  </CardTitle>
                  <CardDescription>
                    Baseado em R$ {totalArrecadado.toFixed(2)} arrecadados de {paidApostas.length} apostas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                    {suggestions}
                  </div>
                </CardContent>
              </Card>
            )}

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
