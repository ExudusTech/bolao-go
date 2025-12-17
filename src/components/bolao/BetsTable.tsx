import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, FileImage, Loader2 } from "lucide-react";

interface Bet {
  id: string;
  apelido: string;
  celular: string;
  dezenas: number[];
  created_at: string;
  payment_status: string;
  receipt_url: string | null;
}

interface BetsTableProps {
  bets: Bet[];
  onPaymentUpdate?: () => void;
}

export function BetsTable({ bets, onPaymentUpdate }: BetsTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleMarkPaid = async (betId: string) => {
    setUpdatingId(betId);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("apostas")
      .update({ 
        payment_status: "paid", 
        paid_at: new Date().toISOString(),
        paid_marked_by: user?.id 
      })
      .eq("id", betId);

    if (error) {
      toast.error("Erro ao marcar como pago");
    } else {
      toast.success("Pagamento confirmado!");
      onPaymentUpdate?.();
    }
    
    setUpdatingId(null);
  };

  if (bets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">Nenhuma aposta registrada ainda.</p>
        <p className="text-sm text-muted-foreground">Compartilhe o link público para receber apostas.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Apelido</TableHead>
            <TableHead className="font-semibold">Celular</TableHead>
            <TableHead className="font-semibold">Dezenas</TableHead>
            <TableHead className="font-semibold">Pagamento</TableHead>
            <TableHead className="font-semibold text-right">Data/Hora</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bets.map((bet, index) => (
            <TableRow 
              key={bet.id}
              className="stagger-item"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <TableCell className="font-medium">{bet.apelido}</TableCell>
              <TableCell className="text-muted-foreground">
                ****-****-{bet.celular.slice(-4)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {bet.dezenas.sort((a, b) => a - b).map((num) => (
                    <span
                      key={num}
                      className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-xs font-semibold"
                    >
                      {num.toString().padStart(2, "0")}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {bet.payment_status === "paid" ? (
                    <Badge className="bg-success text-success-foreground">
                      <Check className="h-3 w-3 mr-1" />
                      Pago
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkPaid(bet.id)}
                      disabled={updatingId === bet.id}
                      className="h-7 text-xs"
                    >
                      {updatingId === bet.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Marcar PG"
                      )}
                    </Button>
                  )}
                  {bet.receipt_url && (
                    <a 
                      href={bet.receipt_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                      title="Ver comprovante"
                    >
                      <FileImage className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {new Date(bet.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
