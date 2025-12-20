import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Clock, Trophy, XCircle } from "lucide-react";

interface ClosedBolaoMessageProps {
  bolaoNome: string;
  resultadoVerificado: boolean;
  numerosSorteados: number[] | null;
  isPrized?: boolean;
  deadlineMessage?: string;
}

export function ClosedBolaoMessage({ 
  bolaoNome, 
  resultadoVerificado, 
  numerosSorteados,
  isPrized = false,
  deadlineMessage
}: ClosedBolaoMessageProps) {
  const hasDrawn = resultadoVerificado && numerosSorteados && numerosSorteados.length > 0;

  return (
    <Card className="max-w-md w-full animate-fade-in border-2">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4">
          {hasDrawn ? (
            isPrized ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/20 ring-4 ring-success/30">
                <Trophy className="h-10 w-10 text-success" />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted ring-4 ring-muted-foreground/20">
                <XCircle className="h-10 w-10 text-muted-foreground" />
              </div>
            )
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning/20 ring-4 ring-warning/30">
              <Clock className="h-10 w-10 text-warning" />
            </div>
          )}
        </div>
        <CardTitle className="text-xl">{bolaoNome}</CardTitle>
        <CardDescription className="flex items-center justify-center gap-2 mt-2">
          <Lock className="h-4 w-4" />
          {deadlineMessage || "Bolão encerrado para novas apostas"}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {hasDrawn ? (
          <>
            <Badge 
              variant={isPrized ? "default" : "secondary"}
              className={`text-lg px-6 py-2 ${isPrized ? "bg-success hover:bg-success/90" : ""}`}
            >
              {isPrized ? "🏆 PREMIADO!" : "NÃO PREMIADO"}
            </Badge>
            
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-3">Números Sorteados</p>
              <div className="flex flex-wrap justify-center gap-2">
                {numerosSorteados?.map((num) => (
                  <span
                    key={num}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                  >
                    {num.toString().padStart(2, "0")}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <Badge variant="secondary" className="text-lg px-6 py-2">
              <Clock className="h-4 w-4 mr-2" />
              Aguardando Sorteio
            </Badge>
            
            <p className="text-sm text-muted-foreground">
              O bolão foi encerrado e aguarda o sorteio da loteria.
              <br />
              O resultado será divulgado em breve.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
