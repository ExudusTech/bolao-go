import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogOut, Users, Calendar, ChevronRight, Eye, User, Clock, Trophy } from "lucide-react";
import { getBolaoStatus, getStatusBadgeClasses } from "@/lib/bolao-status";
import { cn } from "@/lib/utils";
import { ParticipantMessagesPanel } from "@/components/bolao/ParticipantMessagesPanel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

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
  data_limite_apostas?: string | null;
  gestor_name?: string | null;
  valor_cota?: number;
  numeros_sorteados?: number[] | null;
  resultado_verificado?: boolean;
  minhasApostas: Array<{
    id: string;
    dezenas: number[];
    created_at: string;
  }>;
}

interface Apostador {
  id: string;
  apelido: string;
  dezenas: number[];
  created_at: string;
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
  const [allApostadores, setAllApostadores] = useState<Apostador[]>([]);
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
          data_sorteio: bolaoInfo.data_sorteio,
          data_limite_apostas: bolaoInfo.data_limite_apostas,
          gestor_name: bolaoInfo.gestor_name,
          valor_cota: bolaoInfo.valor_cota,
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
    
    // Verify credentials using secure RPC function
    const { data, error } = await supabase.rpc("verify_participant_global_login", {
      p_apelido: apelido.trim(),
      p_senha: senha
    });
    
    if (error) {
      toast.error("Erro ao verificar credenciais. Tente novamente.");
      setIsLoggingIn(false);
      return;
    }
    
    const result = data as { success: boolean; error?: string; apelido?: string };
    
    if (!result.success) {
      toast.error(result.error || "Credenciais inválidas. Verifique seu apelido e senha.");
      setIsLoggingIn(false);
      return;
    }
    
    // Store session
    const newSession: ParticipantSession = {
      token: crypto.randomUUID(),
      apelido: result.apelido || apelido.trim(),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    setSession(newSession);
    toast.success(`Bem-vindo(a), ${result.apelido || apelido.trim()}!`);
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
    
    // Fetch all apostas for this bolão using a generic RPC call
    const { data, error } = await supabase
      .rpc("get_bolao_apostas_public" as any, { p_bolao_id: bolao.id });
    
    if (!error && data) {
      const result = data as unknown as { success: boolean; apostas?: Apostador[] };
      if (result.success && result.apostas) {
        setAllApostadores(result.apostas);
      }
    }
    
    setLoadingDetalhes(false);
  };

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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in mb-6">
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
              
              <div className="p-3 rounded-lg bg-muted/50 border border-muted">
                <p className="text-sm text-muted-foreground text-center">
                  <span className="font-medium">Esqueceu sua senha?</span>
                  <br />
                  A senha são os <span className="font-medium text-foreground">4 últimos dígitos do celular</span> que você informou ao fazer sua aposta.
                </p>
              </div>
            </form>
            
            <div className="mt-6 text-center">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
                Voltar para a página inicial
              </Link>
            </div>
          </CardContent>
        </Card>
        <Footer />
      </div>
    );
  }

  // Bolão details view
  if (selectedBolao) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-card">
          <div className="container py-4 px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedBolao(null); setAllApostadores([]); }}>
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
        
        <main className="container py-6 px-4 flex-1 space-y-4">
          {/* Informações do Bolão */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Informações do Bolão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedBolao.gestor_name && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Organizador</span>
                    </div>
                    <p className="font-medium text-sm">{selectedBolao.gestor_name}</p>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Criado em</span>
                  </div>
                  <p className="font-medium text-sm">
                    {format(new Date(selectedBolao.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                {selectedBolao.data_limite_apostas && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Limite p/ apostas</span>
                    </div>
                    <p className="font-medium text-sm">
                      {format(new Date(selectedBolao.data_limite_apostas), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
                {selectedBolao.data_sorteio && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Data do sorteio</span>
                    </div>
                    <p className="font-medium text-sm">
                      {format(new Date(selectedBolao.data_sorteio), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
              {selectedBolao.valor_cota && (
                <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Valor por cota:</span>{" "}
                    <span className="font-bold text-primary">
                      R$ {selectedBolao.valor_cota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suas Apostas */}
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
                        {format(new Date(aposta.created_at), "dd/MM/yyyy", { locale: ptBR })}
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
          
          {/* Estatísticas */}
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

          {/* Lista de Apostadores */}
          <CollapsibleSection
            title={`Todos os Apostadores (${allApostadores.length})`}
            icon={<Users className="h-5 w-5" />}
            defaultOpen={false}
          >
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loadingDetalhes ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : allApostadores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum apostador encontrado
                </p>
              ) : (
                allApostadores.map((apostador, index) => (
                  <div key={apostador.id} className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{apostador.apelido}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(apostador.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {apostador.dezenas.sort((a, b) => a - b).map((num) => (
                        <span
                          key={num}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground font-medium text-xs border"
                        >
                          {num.toString().padStart(2, "0")}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* Mensagens */}
          {session && (
            <ParticipantMessagesPanel
              bolaoId={selectedBolao.id}
              participantApelido={session.apelido}
            />
          )}
        </main>
        <Footer />
      </div>
    );
  }

  // Bolões list
  return (
    <div className="min-h-screen bg-background flex flex-col">
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
      
      <main className="container py-6 px-4 flex-1">
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
      <Footer />
    </div>
  );
}
