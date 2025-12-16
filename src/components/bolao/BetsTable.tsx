import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Bet {
  id: string;
  apelido: string;
  celular: string;
  dezenas: number[];
  created_at: string;
}

interface BetsTableProps {
  bets: Bet[];
}

export function BetsTable({ bets }: BetsTableProps) {
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
