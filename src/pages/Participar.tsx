import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ClosedBolaoMessage } from "@/components/bolao/ClosedBolaoMessage";
import { BetForm } from "@/components/bolao/BetForm";
import { MessagesPanel } from "@/components/bolao/MessagesPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useParticipantAuth } from "@/hooks/useParticipantAuth";
import { Loader2, Users, ArrowLeft, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

interface Bolao {
  id: string;
  nome_do_bolao: string;
  chave_pix: string;
  observacoes: string | null;
  total_apostas: number;
  gestor_name: string | null;
  encerrado: boolean;
  numeros_sorteados: number[] | null;
  resultado_verificado: boolean;
  valor_cota: number;
}

export default function Participar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, isLoading: authLoading, logout, login } = useParticipantAuth(id);
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [loading, setLoading] = useState(true);
  const [counter, setCounter] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const fetchBolao = useCallback(async () => {
    if (!id) return;

    // Use RPC function to prevent enumeration - only fetches by exact ID
    const { data, error } = await supabase
      .rpc("get_bolao_for_participation", { bolao_id: id });

    if (!error && data && data.length > 0) {
      const bolaoData = data[0];
      setBolao({
        ...bolaoData,
        encerrado: bolaoData.encerrado ?? false,
        numeros_sorteados: bolaoData.numeros_sorteados ?? null,
        resultado_verificado: bolaoData.resultado_verificado ?? false,
      });
      setCounter(bolaoData.total_apostas);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchBolao();
  }, [fetchBolao]);

  const handleSuccess = async (apelido: string, celular: string) => {
    setCounter((prev) => prev + 1);
    
    // If not logged in, auto-login after first bet
    if (!session && id && apelido && celular) {
      setIsLoggingIn(true);
      const senha = celular.slice(-4); // Last 4 digits
      const result = await login(id, apelido, senha);
      setIsLoggingIn(false);
      
      if (result.success) {
        toast.success("Aposta registrada e login realizado!", {
          description: `Para acessar novamente, use seu apelido e os 4 últimos dígitos do celular (${celular.slice(-4)}) como senha.`,
          duration: 8000,
        });
      } else {
        toast.success("Aposta registrada com sucesso!");
      }
    } else {
      toast.success("Aposta registrada com sucesso!");
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Logout realizado com sucesso!");
  };

  if (loading || authLoading || isLoggingIn) {
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

  // Show closed message if bolão is encerrado
  if (bolao.encerrado) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur">
          <div className="container flex h-14 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2 hover-scale">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">R</span>
              </div>
              <span className="font-bold text-foreground">Robolão</span>
            </Link>
            {session && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Olá, <span className="font-medium text-foreground">{session.apelido}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-1" />
                  Sair
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Closed Message */}
        <main className="container py-8 px-4 flex flex-col items-center">
          <ClosedBolaoMessage
            bolaoNome={bolao.nome_do_bolao}
            resultadoVerificado={bolao.resultado_verificado}
            numerosSorteados={bolao.numeros_sorteados}
            isPrized={false}
          />

          {/* Messages Panel */}
          <div className="w-full max-w-md mt-8">
            <MessagesPanel 
              bolaoId={bolao.id} 
              isGestor={false}
              participantToken={session?.token}
              participantApelido={session?.apelido}
            />
          </div>

          {!session && (
            <div className="mt-4">
              <Button asChild>
                <Link to={`/participar/${id}/login`}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Fazer login para interagir
                </Link>
              </Button>
            </div>
          )}
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 hover-scale">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">R</span>
            </div>
            <span className="font-bold text-foreground">Robolão</span>
          </Link>
          {session && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Olá, <span className="font-medium text-foreground">{session.apelido}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" />
                Sair
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6 px-4">
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
          {bolao.gestor_name && (
            <p className="text-sm text-muted-foreground animate-fade-in">
              Organizado por <span className="font-medium text-foreground">{bolao.gestor_name}</span>
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

          {/* Messages Panel */}
          <div className="w-full max-w-md mt-6">
            <MessagesPanel 
              bolaoId={bolao.id} 
              isGestor={false}
              participantToken={session?.token}
              participantApelido={session?.apelido}
            />
          </div>
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
