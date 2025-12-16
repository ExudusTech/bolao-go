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
import { Loader2, RefreshCw, Download, Copy, ArrowLeft, Users, Key, FileText } from "lucide-react";

interface Bolao {
  id: string;
  nome_do_bolao: string;
  chave_pix: string;
  observacoes: string | null;
  total_apostas: number;
  created_at: string;
}

interface Aposta {
  id: string;
  apelido: string;
  celular: string;
  dezenas: number[];
  created_at: string;
}

export default function BolaoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    if (apostas.length === 0) {
      toast.error("Não há apostas para exportar");
      return;
    }

    setExporting(true);

    const headers = ["Apelido", "Celular", "Dezenas", "Data/Hora"];
    const rows = apostas.map((a) => [
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
    link.download = `${bolao?.nome_do_bolao || "bolao"}_apostas.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    toast.success("CSV exportado com sucesso!");
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
                  <Badge variant="secondary" className="flex items-center gap-2 text-lg px-4 py-2 bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                    <span className="font-bold animate-count">{bolao.total_apostas}</span>
                    <span className="text-sm font-normal">apostas</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <Key className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Chave PIX</p>
                      <p className="text-muted-foreground">{bolao.chave_pix}</p>
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

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleCopyLink} className="hover-scale">
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Link
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="hover-scale">
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                    Atualizar Lista
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting || apostas.length === 0} className="hover-scale">
                    <Download className={`h-4 w-4 mr-2 ${exporting ? "animate-spin" : ""}`} />
                    Exportar CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bets Table */}
            <Card>
              <CardHeader>
                <CardTitle>Apostas Registradas</CardTitle>
              </CardHeader>
              <CardContent>
                <BetsTable bets={apostas} />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
