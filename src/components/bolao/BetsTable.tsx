import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, FileImage, Loader2, Trash2, Undo2, Pencil, Save, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Bet {
  id: string;
  apelido: string;
  celular: string;
  dezenas: number[];
  created_at: string;
  payment_status: string;
  receipt_url: string | null;
}

type PaymentFilter = "all" | "paid" | "pending";

interface BetsTableProps {
  bets: Bet[];
  onPaymentUpdate?: () => void;
}

export function BetsTable({ bets, onPaymentUpdate }: BetsTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [editApelido, setEditApelido] = useState("");
  const [savingApelido, setSavingApelido] = useState(false);

  const filteredBets = bets.filter((bet) => {
    if (paymentFilter === "all") return true;
    if (paymentFilter === "paid") return bet.payment_status === "paid";
    if (paymentFilter === "pending") return bet.payment_status === "pending";
    return true;
  });

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

  const handleRevertPayment = async (betId: string) => {
    setUpdatingId(betId);
    
    const { error } = await supabase
      .from("apostas")
      .update({ 
        payment_status: "pending", 
        paid_at: null,
        paid_marked_by: null 
      })
      .eq("id", betId);

    if (error) {
      toast.error("Erro ao reverter pagamento");
    } else {
      toast.success("Pagamento revertido para pendente");
      onPaymentUpdate?.();
    }
    
    setUpdatingId(null);
  };

  const handleDeleteBet = async (betId: string, apelido: string) => {
    setDeletingId(betId);
    
    const { error } = await supabase
      .from("apostas")
      .delete()
      .eq("id", betId);

    if (error) {
      console.error("Error deleting bet:", error);
      toast.error("Erro ao excluir aposta");
    } else {
      toast.success(`Aposta de "${apelido}" excluída`);
      onPaymentUpdate?.();
    }
    
    setDeletingId(null);
  };

  const handleEditApelido = (bet: Bet) => {
    setEditingBet(bet);
    setEditApelido(bet.apelido);
  };

  const handleSaveApelido = async () => {
    if (!editingBet || !editApelido.trim()) return;
    
    if (editApelido.trim() === editingBet.apelido) {
      setEditingBet(null);
      return;
    }
    
    setSavingApelido(true);
    
    const { error } = await supabase
      .from("apostas")
      .update({ apelido: editApelido.trim() })
      .eq("id", editingBet.id);
    
    if (error) {
      console.error("Error updating apelido:", error);
      toast.error("Erro ao atualizar apelido");
    } else {
      toast.success(`Apelido alterado para "${editApelido.trim()}"`);
      onPaymentUpdate?.();
    }
    
    setSavingApelido(false);
    setEditingBet(null);
  };

  if (bets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">Nenhuma aposta registrada ainda.</p>
        <p className="text-sm text-muted-foreground">Compartilhe o link público para receber apostas.</p>
      </div>
    );
  }

  const paidCount = bets.filter(b => b.payment_status === "paid").length;
  const pendingCount = bets.filter(b => b.payment_status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({bets.length})</SelectItem>
              <SelectItem value="paid">Pagos ({paidCount})</SelectItem>
              <SelectItem value="pending">Pendentes ({pendingCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          Exibindo {filteredBets.length} de {bets.length} apostas
        </span>
      </div>
      <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Apelido</TableHead>
            <TableHead className="font-semibold">Celular</TableHead>
            <TableHead className="font-semibold">Dezenas</TableHead>
            <TableHead className="font-semibold">Pagamento</TableHead>
            <TableHead className="font-semibold text-right">Data/Hora</TableHead>
            <TableHead className="font-semibold w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredBets.map((bet, index) => (
            <TableRow 
              key={bet.id}
              className="stagger-item"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-1">
                  <span className="truncate max-w-[150px]" title={bet.apelido}>{bet.apelido}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditApelido(bet)}
                    className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                    title="Editar apelido"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
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
                    <>
                      <Badge className="bg-success text-success-foreground">
                        <Check className="h-3 w-3 mr-1" />
                        Pago
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevertPayment(bet.id)}
                        disabled={updatingId === bet.id}
                        className="h-7 w-7 p-0"
                        title="Reverter para pendente"
                      >
                        {updatingId === bet.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Undo2 className="h-3 w-3 text-muted-foreground" />
                        )}
                      </Button>
                    </>
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
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === bet.id}
                      className="h-8 w-8 p-0"
                    >
                      {deletingId === bet.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir aposta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir a aposta de "{bet.apelido}"?
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteBet(bet.id, bet.apelido)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>

      {/* Edit Apelido Dialog */}
      <Dialog open={!!editingBet} onOpenChange={(open) => !open && setEditingBet(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Apelido</DialogTitle>
            <DialogDescription>
              Altere o apelido do participante
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editApelido}
              onChange={(e) => setEditApelido(e.target.value)}
              placeholder="Novo apelido"
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !savingApelido) {
                  handleSaveApelido();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditingBet(null)}
              disabled={savingApelido}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveApelido}
              disabled={savingApelido || !editApelido.trim()}
            >
              {savingApelido ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}