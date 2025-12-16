import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { BetForm } from "@/components/bolao/BetForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, ArrowLeft } from "lucide-react";

interface Bolao {
  id: string;
  nome_do_bolao: string;
  chave_pix: string;
  observacoes: string | null;
  total_apostas: number;
  profiles: {
    name: string;
  } | null;
}

export default function Participar() {
  const { id } = useParams<{ id: string }>();
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [loading, setLoading] = useState(true);
  const [counter, setCounter] = useState(0);

  const fetchBolao = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("boloes")
      .select(`
        id,
        nome_do_bolao,
        chave_pix,
        observacoes,
        total_apostas,
        profiles:gestor_id (name)
      `)
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      setBolao(data);
      setCounter(data.total_apostas);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchBolao();
  }, [fetchBolao]);

  const handleSuccess = () => {
    setCounter((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bolao) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto">
            <span className="text-2xl font-bold text-muted-foreground">?</span>
          </div>
          <h1 className="text-2xl font-bold">Bolão não encontrado</h1>
          <p className="text-muted-foreground">
            O link pode estar incorreto ou o bolão foi removido.
          </p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover-scale">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">R</span>
            </div>
            <span className="font-bold text-foreground">Robolão</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 px-4">
        <div className="flex flex-col items-center gap-6">
          {/* Counter Badge */}
          <Badge 
            variant="secondary" 
            className="flex items-center gap-2 text-base px-4 py-2 bg-primary/10 text-primary animate-fade-in"
          >
            <Users className="h-4 w-4" />
            <span className="font-bold animate-count">{counter}</span>
            <span className="font-normal">apostas registradas</span>
          </Badge>

          {/* Organizer Info */}
          {bolao.profiles?.name && (
            <p className="text-sm text-muted-foreground animate-fade-in">
              Organizado por <span className="font-medium text-foreground">{bolao.profiles.name}</span>
            </p>
          )}

          {/* Bet Form */}
          <BetForm
            bolaoId={bolao.id}
            bolaoNome={bolao.nome_do_bolao}
            chavePix={bolao.chave_pix}
            observacoes={bolao.observacoes || undefined}
            onSuccess={handleSuccess}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="container text-center text-sm text-muted-foreground">
          Powered by{" "}
          <Link to="/" className="font-medium text-primary hover:underline">
            Robolão
          </Link>
        </div>
      </footer>
    </div>
  );
}
