import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Loader2, Ticket, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SavedGame {
  id: string;
  dezenas: number[];
  tipo: string;
  custo: number;
  categoria: string;
  registrado: boolean;
  data_registro: string | null;
}

interface IndividualBet {
  id: string;
  apelido: string;
  dezenas: number[];
  registrado: boolean;
  data_registro: string | null;
}

interface RegistrationSummaryProps {
  bolaoId: string;
  lotteryName: string;
  paidBets: IndividualBet[];
  valorCota: number;
  onBetRegistrationChange?: () => void;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export function RegistrationSummary({ bolaoId, lotteryName, paidBets, valorCota, onBetRegistrationChange }: RegistrationSummaryProps) {
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedGames();
  }, [bolaoId]);

  const fetchSavedGames = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jogos_selecionados")
      .select("*")
      .eq("bolao_id", bolaoId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setSavedGames(data);
    }
    setLoading(false);
  };

  const toggleGameRegistrado = async (gameId: string, currentStatus: boolean) => {
    setUpdatingId(gameId);
    const newStatus = !currentStatus;
    const dataRegistro = newStatus ? new Date().toISOString() : null;

    const { error } = await supabase
      .from("jogos_selecionados")
      .update({ 
        registrado: newStatus, 
        data_registro: dataRegistro 
      })
      .eq("id", gameId);

    if (error) {
      toast.error("Erro ao atualizar status do jogo");
    } else {
      setSavedGames(prev => 
        prev.map(game => 
          game.id === gameId 
            ? { ...game, registrado: newStatus, data_registro: dataRegistro }
            : game
        )
      );
      toast.success(newStatus ? "Jogo marcado como registrado!" : "Registro removido");
    }
    setUpdatingId(null);
  };

  const toggleBetRegistrado = async (betId: string, currentStatus: boolean) => {
    setUpdatingId(betId);
    const newStatus = !currentStatus;
    const dataRegistro = newStatus ? new Date().toISOString() : null;

    const { error } = await supabase
      .from("apostas")
      .update({ 
        registrado: newStatus, 
        data_registro: dataRegistro 
      })
      .eq("id", betId);

    if (error) {
      toast.error("Erro ao atualizar status da aposta");
    } else {
      toast.success(newStatus ? "Aposta marcada como registrada!" : "Registro removido");
      onBetRegistrationChange?.();
    }
    setUpdatingId(null);
  };

  const markAllAsRegistered = async () => {
    const unregisteredGames = savedGames.filter(g => !g.registrado);
    const unregisteredBets = paidBets.filter(b => !b.registrado);
    
    if (unregisteredGames.length === 0 && unregisteredBets.length === 0) {
      toast.info("Todos os jogos já estão registrados!");
      return;
    }

    setUpdatingId("all");
    const dataRegistro = new Date().toISOString();

    try {
      // Update games
      if (unregisteredGames.length > 0) {
        const gameIds = unregisteredGames.map(g => g.id);
        const { error: gamesError } = await supabase
          .from("jogos_selecionados")
          .update({ registrado: true, data_registro: dataRegistro })
          .in("id", gameIds);

        if (gamesError) throw gamesError;

        setSavedGames(prev => 
          prev.map(game => ({ ...game, registrado: true, data_registro: dataRegistro }))
        );
      }

      // Update bets
      if (unregisteredBets.length > 0) {
        const betIds = unregisteredBets.map(b => b.id);
        const { error: betsError } = await supabase
          .from("apostas")
          .update({ registrado: true, data_registro: dataRegistro })
          .in("id", betIds);

        if (betsError) throw betsError;
        onBetRegistrationChange?.();
      }

      toast.success("Todos os jogos marcados como registrados!");
    } catch (error) {
      console.error("Error marking all as registered:", error);
      toast.error("Erro ao marcar jogos como registrados");
    } finally {
      setUpdatingId(null);
    }
  };

  const registeredGamesCount = savedGames.filter(g => g.registrado).length;
  const registeredBetsCount = paidBets.filter(b => b.registrado).length;
  const totalRegisteredCount = registeredGamesCount + registeredBetsCount;
  const totalGamesCount = savedGames.length + paidBets.length;
  const allRegistered = totalRegisteredCount === totalGamesCount;
  const totalGamesCost = savedGames.reduce((sum, g) => sum + g.custo, 0);
  const individualCost = paidBets.length * valorCota;
  const totalCost = totalGamesCost + individualCost;

  const generateSummaryText = () => {
    const lines = [
      `📋 RESUMO COMPLETO PARA REGISTRO NA LOTÉRICA`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Loteria: ${lotteryName}`,
      `Total de Jogos: ${totalGamesCount}`,
      `Valor Total: ${formatCurrency(totalCost)}`,
      ``,
    ];

    if (savedGames.length > 0) {
      lines.push(`🎯 JOGOS SELECIONADOS (${savedGames.length}):`);
      lines.push(``);
      savedGames.forEach((game, index) => {
        const nums = game.dezenas.map(n => n.toString().padStart(2, "0")).join(" - ");
        const status = game.registrado ? "✅ Registrado" : "⏳ Pendente";
        lines.push(`Jogo ${index + 1} (${game.tipo}): ${nums}`);
        lines.push(`   Valor: ${formatCurrency(game.custo)} | ${status}`);
        lines.push(``);
      });
    }

    if (paidBets.length > 0) {
      lines.push(`👤 APOSTAS INDIVIDUAIS (${paidBets.length}):`);
      lines.push(``);
      paidBets.forEach((bet) => {
        const nums = bet.dezenas.sort((a, b) => a - b).map(n => n.toString().padStart(2, "0")).join(" - ");
        lines.push(`${bet.apelido}: ${nums}`);
      });
      lines.push(``);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`Gerado por Robolão`);

    return lines.join("\n");
  };

  const handleCopySummary = () => {
    const summary = generateSummaryText();
    navigator.clipboard.writeText(summary);
    toast.success("Resumo copiado para a área de transferência!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (savedGames.length === 0 && paidBets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhum jogo para registrar ainda.</p>
        <p className="text-sm">Adicione apostas pagas ou gere sugestões de jogos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 border text-center">
          <p className="text-xs text-muted-foreground">Loteria</p>
          <p className="text-sm sm:text-lg font-bold">{lotteryName}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 border text-center">
          <p className="text-xs text-muted-foreground">Total de Jogos</p>
          <p className="text-sm sm:text-lg font-bold">{totalGamesCount}</p>
        </div>
        <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-center">
          <p className="text-xs text-muted-foreground">Valor Total</p>
          <p className="text-sm sm:text-lg font-bold text-success">{formatCurrency(totalCost)}</p>
        </div>
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
          <p className="text-xs text-muted-foreground">Registrados</p>
          <p className="text-sm sm:text-lg font-bold text-primary">{totalRegisteredCount}/{totalGamesCount}</p>
        </div>
      </div>

      {/* Saved Games Section */}
      {savedGames.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            Jogos Selecionados ({savedGames.length})
          </h4>
          <div className="space-y-2">
            {savedGames.map((game, index) => (
              <div 
                key={game.id} 
                className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                  game.registrado 
                    ? "bg-success/10 border-success/30" 
                    : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`game-${game.id}`}
                      checked={game.registrado}
                      disabled={updatingId === game.id}
                      onCheckedChange={() => toggleGameRegistrado(game.id, game.registrado)}
                      className="h-5 w-5"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={game.registrado ? "default" : "secondary"} className="text-xs">
                        {game.registrado && <Check className="h-3 w-3 mr-1" />}
                        Jogo {index + 1} - {game.tipo}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{game.categoria}</Badge>
                    </div>
                  </div>
                  <div className="text-left sm:text-right ml-8 sm:ml-0">
                    <span className="text-sm font-medium">{formatCurrency(game.custo)}</span>
                    {game.registrado && game.data_registro && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(game.data_registro), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {game.dezenas.map((num) => (
                    <span
                      key={num}
                      className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-xs sm:text-sm font-bold ${
                        game.registrado 
                          ? "bg-success text-success-foreground" 
                          : "bg-primary text-primary-foreground"
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

      {savedGames.length > 0 && paidBets.length > 0 && <Separator />}

      {/* Individual Bets Section */}
      {paidBets.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Ticket className="h-4 w-4 text-accent" />
            Apostas Individuais ({paidBets.length})
          </h4>
          <div className="space-y-2">
            {paidBets.map((bet) => (
              <div 
                key={bet.id} 
                className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                  bet.registrado 
                    ? "bg-success/10 border-success/30" 
                    : "bg-accent/5 border-accent/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`bet-${bet.id}`}
                      checked={bet.registrado}
                      disabled={updatingId === bet.id}
                      onCheckedChange={() => toggleBetRegistrado(bet.id, bet.registrado)}
                      className="h-5 w-5"
                    />
                    <Badge variant={bet.registrado ? "default" : "secondary"} className="text-xs">
                      {bet.registrado && <Check className="h-3 w-3 mr-1" />}
                      {bet.apelido}
                    </Badge>
                  </div>
                  <div className="text-left sm:text-right ml-8 sm:ml-0">
                    <span className="text-sm text-muted-foreground">6 dezenas</span>
                    {bet.registrado && bet.data_registro && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(bet.data_registro), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {bet.dezenas.sort((a, b) => a - b).map((num) => (
                    <span
                      key={num}
                      className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-xs sm:text-sm font-bold ${
                        bet.registrado 
                          ? "bg-success text-success-foreground" 
                          : "bg-accent text-accent-foreground"
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

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button 
          onClick={markAllAsRegistered} 
          variant={allRegistered ? "secondary" : "default"}
          disabled={updatingId === "all" || allRegistered}
          className="flex-1"
          size="lg"
        >
          {updatingId === "all" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4 mr-2" />
          )}
          {allRegistered ? "Todos Registrados" : "Marcar Todos"}
        </Button>
        <Button onClick={handleCopySummary} variant="outline" className="flex-1" size="lg">
          <Copy className="h-4 w-4 mr-2" />
          Copiar Resumo
        </Button>
      </div>
    </div>
  );
}
