import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Header } from "@/components/layout/Header";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createBolaoSchema, CreateBolaoInput, LOTTERY_TYPES } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Copy, Check, ArrowLeft, CalendarIcon, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function CriarBolao() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [createdBolao, setCreatedBolao] = useState<{ id: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedDeadline, setSelectedDeadline] = useState<Date | undefined>();
  const [permiteRepeticao, setPermiteRepeticao] = useState(true);
  const [showPriceConfirmation, setShowPriceConfirmation] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<CreateBolaoInput | null>(null);

  const form = useForm<CreateBolaoInput>({
    resolver: zodResolver(createBolaoSchema),
    defaultValues: {
      nome_do_bolao: "",
      chave_pix: "",
      tipo_loteria: "megasena",
      valor_cota: 10,
      data_sorteio: "",
      data_limite_apostas: "",
      numero_concurso: undefined,
      observacoes: "",
    },
  });

  const handleFormSubmit = (data: CreateBolaoInput) => {
    if (!user) return;
    setPendingFormData(data);
    setShowPriceConfirmation(true);
  };

  const handleConfirmAndCreate = async () => {
    if (!user || !pendingFormData) return;

    setShowPriceConfirmation(false);
    setIsLoading(true);
    const data = pendingFormData;

    const { data: bolao, error } = await supabase
      .from("boloes")
      .insert({
        gestor_id: user.id,
        nome_do_bolao: data.nome_do_bolao.trim(),
        chave_pix: data.chave_pix.trim(),
        tipo_loteria: data.tipo_loteria,
        valor_cota: data.valor_cota,
        data_sorteio: data.data_sorteio || null,
        data_limite_apostas: data.data_limite_apostas || null,
        numero_concurso: data.numero_concurso || null,
        observacoes: data.observacoes?.trim() || null,
        permite_apostas_repetidas: permiteRepeticao,
      })
      .select("id")
      .single();

    setIsLoading(false);

    if (error) {
      toast.error("Erro ao criar bolão. Tente novamente.");
      return;
    }

    const link = `${window.location.origin}/participar/${bolao.id}`;
    setCreatedBolao({ id: bolao.id, link });
    toast.success("Bolão criado com sucesso!");
  };

  const handleCopyLink = async () => {
    if (!createdBolao) return;
    
    try {
      await navigator.clipboard.writeText(createdBolao.link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 px-4">
          <div className="max-w-lg mx-auto">
            <Button variant="ghost" size="sm" className="mb-4" asChild>
              <Link to="/gestor/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>

            {!createdBolao ? (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle className="text-2xl">Novo Bolão</CardTitle>
                  <CardDescription>
                    Preencha os dados do bolão para gerar o link de participação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome do Bolão *</Label>
                      <Input
                        id="nome"
                        placeholder="Ex: Mega Sena de Fim de Ano"
                        {...form.register("nome_do_bolao")}
                        disabled={isLoading}
                      />
                      {form.formState.errors.nome_do_bolao && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.nome_do_bolao.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo de Loteria *</Label>
                      <Select
                        value={form.watch("tipo_loteria")}
                        onValueChange={(value) => form.setValue("tipo_loteria", value as "megasena")}
                        disabled={isLoading}
                      >
                        <SelectTrigger id="tipo">
                          <SelectValue placeholder="Selecione a loteria" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LOTTERY_TYPES).map(([key, lottery]) => (
                            <SelectItem key={key} value={key}>
                              {lottery.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.tipo_loteria && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.tipo_loteria.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pix">Chave PIX *</Label>
                      <Input
                        id="pix"
                        placeholder="Sua chave PIX para receber pagamentos"
                        {...form.register("chave_pix")}
                        disabled={isLoading}
                      />
                      {form.formState.errors.chave_pix && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.chave_pix.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="valor">Valor da Cota (R$) *</Label>
                      <Input
                        id="valor"
                        type="number"
                        step="0.01"
                        min="1"
                        max="1000"
                        placeholder="10.00"
                        {...form.register("valor_cota", { valueAsNumber: true })}
                        disabled={isLoading}
                      />
                      {form.formState.errors.valor_cota && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.valor_cota.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data do Sorteio</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !selectedDate && "text-muted-foreground"
                              )}
                              disabled={isLoading}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? (
                                format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                "Selecione"
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => {
                                setSelectedDate(date);
                                form.setValue("data_sorteio", date ? format(date, "yyyy-MM-dd") : "");
                              }}
                              locale={ptBR}
                              disabled={(date) => date < new Date()}
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="concurso">Nº do Concurso</Label>
                        <Input
                          id="concurso"
                          type="number"
                          placeholder="Ex: 2800"
                          {...form.register("numero_concurso", { valueAsNumber: true })}
                          disabled={isLoading}
                        />
                        {form.formState.errors.numero_concurso && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.numero_concurso.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Data Limite para Apostas</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !selectedDeadline && "text-muted-foreground"
                            )}
                            disabled={isLoading}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDeadline ? (
                              format(selectedDeadline, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              "Selecione (opcional)"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDeadline}
                            onSelect={(date) => {
                              setSelectedDeadline(date);
                              form.setValue("data_limite_apostas", date ? date.toISOString() : "");
                            }}
                            locale={ptBR}
                            disabled={(date) => date < new Date()}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Após esta data, novas apostas não serão aceitas
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="obs">Observações (opcional)</Label>
                      <Textarea
                        id="obs"
                        placeholder="Informações adicionais como regras, etc."
                        rows={3}
                        {...form.register("observacoes")}
                        disabled={isLoading}
                      />
                      {form.formState.errors.observacoes && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.observacoes.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="permite-repeticao" className="text-base">Permitir apostas repetidas</Label>
                        <p className="text-sm text-muted-foreground">
                          Se desativado, participantes não poderão registrar as mesmas dezenas de outro participante
                        </p>
                      </div>
                      <Switch
                        id="permite-repeticao"
                        checked={permiteRepeticao}
                        onCheckedChange={setPermiteRepeticao}
                        disabled={isLoading}
                      />
                    </div>

                    <Button type="submit" className="w-full hover-scale" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Criar Bolão"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="animate-scale-in">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                    <Check className="h-6 w-6 text-success" />
                  </div>
                  <CardTitle className="text-2xl">Bolão Criado!</CardTitle>
                  <CardDescription>
                    Compartilhe o link abaixo para os participantes fazerem suas apostas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Link Público</Label>
                    <div className="flex gap-2">
                      <Input
                        value={createdBolao.link}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                        className="shrink-0 hover-scale"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-4">
                    <Button asChild className="hover-scale">
                      <Link to={`/gestor/bolao/${createdBolao.id}`}>
                        Abrir Painel do Bolão
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link to="/gestor/dashboard">
                        Voltar ao Dashboard
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        <AlertDialog open={showPriceConfirmation} onOpenChange={setShowPriceConfirmation}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Confirmar Valores da Mega-Sena
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Antes de criar o bolão, confirme se os valores oficiais da Mega-Sena ainda são estes:
                  </p>
                  <div className="bg-muted rounded-lg p-3 space-y-1 font-mono text-sm">
                    {Object.entries(LOTTERY_TYPES.megasena.prices)
                      .slice(0, 7)
                      .map(([dezenas, valor]) => (
                        <div key={dezenas} className="flex justify-between">
                          <span>{dezenas} dezenas:</span>
                          <span className="font-semibold">
                            R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    <div className="text-muted-foreground text-xs pt-1">
                      ... e assim por diante até 20 dezenas
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Caso os valores tenham sido atualizados pela Caixa, entre em contato com o suporte.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAndCreate}>
                Confirmo, criar bolão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AuthGuard>
  );
}
