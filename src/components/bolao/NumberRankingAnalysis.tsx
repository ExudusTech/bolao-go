import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";

interface NumberRankingAnalysisProps {
  apostas: Array<{ dezenas: number[] }>;
  maxNumber?: number;
}

export function NumberRankingAnalysis({ apostas, maxNumber = 60 }: NumberRankingAnalysisProps) {
  const [showFullRanking, setShowFullRanking] = useState(false);

  // Build complete ranking of all numbers
  const { fullRanking, mostVoted, leastVoted, notVoted } = useMemo(() => {
    const voteCounts: Map<number, number> = new Map();
    
    // Initialize all numbers with 0 votes
    for (let i = 1; i <= maxNumber; i++) {
      voteCounts.set(i, 0);
    }
    
    // Count votes from all apostas
    apostas.forEach(aposta => {
      aposta.dezenas.forEach(num => {
        voteCounts.set(num, (voteCounts.get(num) || 0) + 1);
      });
    });
    
    // Sort by vote count (descending), then by number (ascending)
    const sorted = Array.from(voteCounts.entries())
      .map(([number, count]) => ({ number, count }))
      .sort((a, b) => b.count - a.count || a.number - b.number);
    
    const voted = sorted.filter(n => n.count > 0);
    const notVotedNums = sorted.filter(n => n.count === 0).map(n => n.number);
    
    return {
      fullRanking: sorted,
      mostVoted: voted.slice(0, 10),
      leastVoted: voted.slice(-10).reverse(),
      notVoted: notVotedNums,
    };
  }, [apostas, maxNumber]);

  if (apostas.length === 0) {
    return null;
  }

  return (
    <Card className="animate-fade-in border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Análise dos Números
            </CardTitle>
            <CardDescription>
              Ranking baseado em {apostas.length} apostas
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFullRanking(!showFullRanking)}
          >
            {showFullRanking ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Ver Resumo
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Ver Ranking Completo
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showFullRanking ? (
          /* Full Ranking of all numbers */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Ranking Completo - {maxNumber} Números</p>
              <div className="flex gap-2 text-xs flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-primary"></span> Top 10
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-accent"></span> 11-30
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-muted-foreground"></span> 31-50
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-destructive/50"></span> Últimos 10
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-2">
              {fullRanking.map(({ number, count }, index) => {
                const position = index + 1;
                let bgClass = "bg-muted text-muted-foreground";
                if (position <= 10) bgClass = "bg-primary text-primary-foreground";
                else if (position <= 30) bgClass = "bg-accent text-accent-foreground";
                else if (position > 50) bgClass = "bg-destructive/50 text-destructive-foreground";
                
                return (
                  <div 
                    key={number} 
                    className={`flex flex-col items-center justify-center p-2 rounded-lg ${bgClass} transition-transform hover:scale-105`}
                  >
                    <span className="text-lg font-bold">{number.toString().padStart(2, "0")}</span>
                    <span className="text-xs opacity-80">{count}x</span>
                    <span className="text-[10px] opacity-60">#{position}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Summary table */}
            <div className="pt-4 border-t space-y-2">
              <p className="text-sm font-medium">Resumo do Ranking</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                <div className="p-3 rounded bg-primary/10 border border-primary/20">
                  <p className="text-muted-foreground mb-1">🔥 Top 10 (mais votados)</p>
                  <p className="font-mono text-sm">{fullRanking.slice(0, 10).map(n => n.number.toString().padStart(2, "0")).join(", ")}</p>
                </div>
                <div className="p-3 rounded bg-accent/10 border border-accent/20">
                  <p className="text-muted-foreground mb-1">11º ao 20º</p>
                  <p className="font-mono text-sm">{fullRanking.slice(10, 20).map(n => n.number.toString().padStart(2, "0")).join(", ")}</p>
                </div>
                <div className="p-3 rounded bg-muted/50 border">
                  <p className="text-muted-foreground mb-1">21º ao 30º</p>
                  <p className="font-mono text-sm">{fullRanking.slice(20, 30).map(n => n.number.toString().padStart(2, "0")).join(", ")}</p>
                </div>
                <div className="p-3 rounded bg-destructive/10 border border-destructive/20">
                  <p className="text-muted-foreground mb-1">❄️ Últimos 10 (menos votados)</p>
                  <p className="font-mono text-sm">{fullRanking.slice(-10).map(n => n.number.toString().padStart(2, "0")).join(", ")}</p>
                </div>
              </div>
              {notVoted.length > 0 && (
                <div className="p-3 rounded bg-accent/5 border border-accent/20">
                  <p className="text-muted-foreground text-xs mb-1">✨ Não Votados ({notVoted.length})</p>
                  <p className="font-mono text-sm">
                    {notVoted.map(n => n.toString().padStart(2, "0")).join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Summary view */
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-2">🔥 Mais Votados</p>
              <div className="flex flex-wrap gap-1">
                {mostVoted.slice(0, 6).map(({ number, count }) => (
                  <Badge key={number} variant="secondary" className="bg-primary/20 text-primary">
                    {number.toString().padStart(2, "0")} ({count}x)
                  </Badge>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-2">❄️ Menos Votados</p>
              <div className="flex flex-wrap gap-1">
                {leastVoted.slice(0, 6).map(({ number, count }) => (
                  <Badge key={number} variant="outline">
                    {number.toString().padStart(2, "0")} ({count}x)
                  </Badge>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-xs text-muted-foreground mb-2">✨ Não Votados</p>
              <div className="flex flex-wrap gap-1">
                {notVoted.length > 0 ? (
                  notVoted.slice(0, 8).map((number) => (
                    <Badge key={number} variant="outline" className="border-accent/50 text-accent">
                      {number.toString().padStart(2, "0")}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Todos votados</span>
                )}
                {notVoted.length > 8 && (
                  <Badge variant="outline" className="border-accent/50 text-accent">
                    +{notVoted.length - 8}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
