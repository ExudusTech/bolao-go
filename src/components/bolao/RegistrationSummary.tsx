import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Copy, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";

interface SavedGame {
  id: string;
  dezenas: number[];
  tipo: string;
  custo: number;
  categoria: string;
}

interface IndividualBet {
  id: string;
  apelido: string;
  dezenas: number[];
}

interface RegistrationSummaryProps {
  bolaoId: string;
  lotteryName: string;
  paidBets: IndividualBet[];
}

export function RegistrationSummary({ bolaoId, lotteryName, paidBets }: RegistrationSummaryProps) {
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);

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

  const totalGamesCount = savedGames.length + paidBets.length;
  const totalGamesCost = savedGames.reduce((sum, g) => sum + g.custo, 0);
  // Apostas individuais usam o custo mínimo (6 dezenas = R$ 5.00 para Mega-Sena)
  const individualCost = paidBets.length * 5.00;
  const totalCost = totalGamesCost + individualCost;

  const generateSummaryText = () => {
    const lines = [
      `📋 RESUMO COMPLETO PARA REGISTRO NA LOTÉRICA`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Loteria: ${lotteryName}`,
      `Total de Jogos: ${totalGamesCount}`,
      `Valor Total: R$ ${totalCost.toFixed(2)}`,
      ``,
    ];

    if (savedGames.length > 0) {
      lines.push(`🎯 JOGOS SELECIONADOS (${savedGames.length}):`);
      lines.push(``);
      savedGames.forEach((game, index) => {
        const nums = game.dezenas.map(n => n.toString().padStart(2, "0")).join(" - ");
        lines.push(`Jogo ${index + 1} (${game.tipo}): ${nums}`);
        lines.push(`   Valor: R$ ${game.custo.toFixed(2)} | Categoria: ${game.categoria}`);
        lines.push(``);
      });
    }

    if (paidBets.length > 0) {
      lines.push(`👤 APOSTAS INDIVIDUAIS (${paidBets.length}):`);
      lines.push(``);
      paidBets.forEach((bet, index) => {
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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (savedGames.length === 0 && paidBets.length === 0) {
    return null;
  }

  return (
    <Card className="border-success/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-success">
          <FileText className="h-5 w-5" />
          Resumo para Registro na Lotérica
        </CardTitle>
        <CardDescription>
          Todos os jogos que devem ser registrados na lotérica para este bolão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Header */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 border text-center">
            <p className="text-xs text-muted-foreground">Loteria</p>
            <p className="text-lg font-bold">{lotteryName}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border text-center">
            <p className="text-xs text-muted-foreground">Total de Jogos</p>
            <p className="text-lg font-bold">{totalGamesCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-center">
            <p className="text-xs text-muted-foreground">Valor Total</p>
            <p className="text-lg font-bold text-success">R$ {totalCost.toFixed(2)}</p>
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
                <div key={game.id} className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Jogo {index + 1} - {game.tipo}</Badge>
                      <Badge variant="outline" className="text-xs">{game.categoria}</Badge>
                    </div>
                    <span className="text-sm font-medium">R$ {game.custo.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {game.dezenas.map((num) => (
                      <span
                        key={num}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold"
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
              {paidBets.map((bet, index) => (
                <div key={bet.id} className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">{bet.apelido}</Badge>
                    <span className="text-sm text-muted-foreground">6 dezenas</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bet.dezenas.sort((a, b) => a - b).map((num) => (
                      <span
                        key={num}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent text-accent-foreground text-sm font-bold"
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

        {/* Copy Button */}
        <Button onClick={handleCopySummary} className="w-full" size="lg">
          <Copy className="h-4 w-4 mr-2" />
          Copiar Resumo Completo
        </Button>
      </CardContent>
    </Card>
  );
}
