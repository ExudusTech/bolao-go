import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogOut, Users, Calendar, TrendingUp, TrendingDown, ChevronRight, Eye } from "lucide-react";
import { getBolaoStatus, getStatusBadgeClasses } from "@/lib/bolao-status";
import { cn } from "@/lib/utils";

interface ParticipantSession {
  token: string;
  apelido: string;
}

interface BolaoParticipacao {
  id: string;
  nome_do_bolao: string;
  created_at: string;
  total_apostas: number;
  encerrado: boolean;
  data_sorteio?: string | null;
  numeros_sorteados?: number[] | null;
  resultado_verificado?: boolean;
  minhasApostas: Array<{
    id: string;
    dezenas: number[];
    created_at: string;
  }>;
}

interface NumberRanking {
  number: number;
  count: number;
  rank: number;
}

const STORAGE_KEY = "participant_global_session";

export default function ParticipanteDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ParticipantSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [boloes, setBoloes] = useState<BolaoParticipacao[]>([]);
  const [loadingBoloes, setLoadingBoloes] = useState(false);
  const [selectedBolao, setSelectedBolao] = useState<BolaoParticipacao | null>(null);
  const [bolaoApostas, setBolaoApostas] = useState<Array<{ dezenas: number[] }>>([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Login form state
  const [apelido, setApelido] = useState("");
  const [senha, setSenha] = useState("");

  // Load session on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ParticipantSession;
        setSession(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // Fetch bolões when session is available
  useEffect(() => {
    if (session) {
      fetchBoloes();
    }
  }, [session]);

  const fetchBoloes = async () => {
    if (!session) return;
    
    setLoadingBoloes(true);
    
    // Get all apostas for this apelido (case insensitive)
    const { data: apostasData, error: apostasError } = await supabase
      .from("apostas")
      .select("id, bolao_id, dezenas, created_at, apelido")
      .ilike("apelido", session.apelido);
    
    if (apostasError || !apostasData || apostasData.length === 0) {
      setLoadingBoloes(false);
      return;
    }

    // Get unique bolao IDs
    const bolaoIds = [...new Set(apostasData.map(a => a.bolao_id))];
    
    // Fetch bolão info using RPC function
    const boloesResult: BolaoParticipacao[] = [];
    
    for (const bolaoId of bolaoIds) {
      const { data, error } = await supabase.rpc("get_bolao_for_participation", {
        bolao_id: bolaoId
      });
      
      if (!error && data && data.length > 0) {
        const bolaoInfo = data[0];
        const minhasApostas = apostasData
          .filter(a => a.bolao_id === bolaoId)
          .map(a => ({ id: a.id, dezenas: a.dezenas, created_at: a.created_at }));
        
        boloesResult.push({
          id: bolaoInfo.id,
          nome_do_bolao: bolaoInfo.nome_do_bolao,
          created_at: bolaoInfo.created_at,
          total_apostas: bolaoInfo.total_apostas,
          encerrado: bolaoInfo.encerrado,
          data_sorteio: null, // Not returned by get_bolao_for_participation currently
          numeros_sorteados: bolaoInfo.numeros_sorteados,
          resultado_verificado: bolaoInfo.resultado_verificado,
          minhasApostas,
        });
      }
    }
    
    setBoloes(boloesResult.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    setLoadingBoloes(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apelido.trim() || senha.length !== 4) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }
    
    setIsLoggingIn(true);
    
    // Verify credentials by checking if there's an aposta with this apelido and last 4 digits
    const { data: apostasCheck, error: checkError } = await supabase
      .from("apostas")
      .select("id, celular_ultimos4")
      .ilike("apelido", apelido.trim())
      .eq("celular_ultimos4", senha)
      .limit(1);
    
    if (checkError || !apostasCheck || apostasCheck.length === 0) {
      toast.error("Credenciais inválidas. Verifique seu apelido e senha.");
      setIsLoggingIn(false);
      return;
    }
    
    // Store session
    const newSession: ParticipantSession = {
      token: crypto.randomUUID(),
      apelido: apelido.trim(),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    setSession(newSession);
    toast.success(`Bem-vindo(a), ${apelido.trim()}!`);
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setBoloes([]);
    setSelectedBolao(null);
    setApelido("");
    setSenha("");
  };

  const handleViewBolao = async (bolao: BolaoParticipacao) => {
    setSelectedBolao(bolao);
    setLoadingDetalhes(true);
    
    // Fetch all apostas for this bolão
    const { data, error } = await supabase.rpc("get_bolao_for_participation", {
      bolao_id: bolao.id
    });
    
    if (!error && data && data.length > 0) {
      // We need to get the actual apostas to compute ranking
      // For now, use the total_apostas count and simulate ranking
      // Since we can't access other participants' dezenas directly from RPC
      // We'll show only the user's numbers
    }
    
    setLoadingDetalhes(false);
  };

  // Calculate ranking for user's numbers
  const numberRankings = useMemo(() => {
    if (!selectedBolao) return new Map<string, NumberRanking[]>();
    
    const rankings = new Map<string, NumberRanking[]>();
    
    // Without access to all apostas, show user's selected numbers
    selectedBolao.minhasApostas.forEach(aposta => {
      const apostaRankings: NumberRanking[] = aposta.dezenas.map((num, idx) => ({
        number: num,
        count: 0, // Would need all apostas to calculate
        rank: idx + 1,
      }));
      rankings.set(aposta.id, apostaRankings);
    });
    
    return rankings;
  }, [selectedBolao]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Login screen
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-primary">Área do Participante</CardTitle>
            <CardDescription>
              Entre com seu apelido e senha para ver seus bolões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apelido">Apelido</Label>
                <Input
                  id="apelido"
                  placeholder="Como você se cadastrou nos bolões"
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  disabled={isLoggingIn}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="senha">Senha (últimos 4 dígitos do celular)</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  disabled={isLoggingIn}
                  maxLength={4}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
                Voltar para a página inicial
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Bolão details view
  if (selectedBolao) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container py-4 px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedBolao(null)}>
                ← Voltar
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{selectedBolao.nome_do_bolao}</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedBolao.minhasApostas.length} apostas suas
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </header>
        
        <main className="container py-6 px-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Suas Apostas</CardTitle>
                <CardDescription>
                  Confira seus números registrados neste bolão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingDetalhes ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  selectedBolao.minhasApostas.map((aposta, index) => (
                    <div key={aposta.id} className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Aposta #{index + 1}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(aposta.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {aposta.dezenas.sort((a, b) => a - b).map((num) => (
                          <span
                            key={num}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm"
                          >
                            {num.toString().padStart(2, "0")}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Estatísticas do Bolão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-primary">{selectedBolao.total_apostas}</p>
                    <p className="text-xs text-muted-foreground">Total de apostas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-success">{selectedBolao.minhasApostas.length}</p>
                    <p className="text-xs text-muted-foreground">Suas apostas</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate(`/participar/${selectedBolao.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Bolão Completo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Bolões list
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 px-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Olá, {session.apelido}!</h1>
            <p className="text-sm text-muted-foreground">Seus bolões</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>
      
      <main className="container py-6 px-4">
        {loadingBoloes ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : boloes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum bolão encontrado para este apelido/celular
              </p>
              <Button variant="outline" onClick={handleLogout}>
                Tentar com outras credenciais
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {boloes.map((bolao) => (
              <Card 
                key={bolao.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewBolao(bolao)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{bolao.nome_do_bolao}</h3>
                        {(() => {
                          const statusInfo = getBolaoStatus({
                            encerrado: bolao.encerrado,
                            data_sorteio: bolao.data_sorteio,
                            numeros_sorteados: bolao.numeros_sorteados,
                            resultado_verificado: bolao.resultado_verificado,
                          });
                          return (
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getStatusBadgeClasses(statusInfo.variant))}
                            >
                              <span className="mr-1">{statusInfo.icon}</span>
                              {statusInfo.label}
                            </Badge>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(bolao.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {bolao.total_apostas} apostas
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        {bolao.minhasApostas.length} suas
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
