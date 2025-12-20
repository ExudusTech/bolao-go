import { useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InternationalPhoneInput } from "@/components/ui/international-phone-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apostasSchema, ApostaInput } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, Share2, Upload, FileImage, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface BetFormProps {
  bolaoId: string;
  bolaoNome: string;
  chavePix: string;
  observacoes?: string;
  valorCota: number;
  onSuccess: (apelido: string, celular: string) => void;
}

interface SessionBet {
  id: string;
  numbers: number[];
  receiptUploaded: boolean;
}

export function BetForm({ bolaoId, bolaoNome, chavePix, observacoes, valorCota, onSuccess }: BetFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [shakeForm, setShakeForm] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [hasSubmittedBet, setHasSubmittedBet] = useState(false);
  const [participantInfo, setParticipantInfo] = useState<{ apelido: string; celular: string } | null>(null);
  const [sessionBets, setSessionBets] = useState<SessionBet[]>([]);
  const [uploadingBetId, setUploadingBetId] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ApostaInput>({
    resolver: zodResolver(apostasSchema),
    defaultValues: {
      apelido: "",
      celular: "",
      dezenas: [],
    },
  });

  const handleNumberClick = (num: number) => {
    setSelectedNumbers((prev) => {
      let newNumbers: number[];
      if (prev.includes(num)) {
        newNumbers = prev.filter((n) => n !== num);
      } else if (prev.length >= 6) {
        toast.error("Você já selecionou 6 números");
        return prev;
      } else {
        newNumbers = [...prev, num].sort((a, b) => a - b);
      }
      // Update form field for validation
      form.setValue("dezenas", newNumbers);
      return newNumbers;
    });
  };

  const handleSubmit = async (data: Omit<ApostaInput, "dezenas">) => {
    // Bot detection: honeypot field should be empty
    if (honeypot) {
      // Silently reject bot submissions
      toast.success("Aposta registrada com sucesso!");
      setSelectedNumbers([]);
      return;
    }

    if (selectedNumbers.length !== 6) {
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 320);
      toast.error("Selecione exatamente 6 números");
      return;
    }

    setIsLoading(true);

    // Check for duplicate bets
    setCheckingDuplicate(true);
    const { data: duplicateCheck, error: duplicateError } = await supabase.rpc('check_duplicate_bet', {
      p_bolao_id: bolaoId,
      p_dezenas: selectedNumbers,
    }) as { data: { allowed: boolean; message?: string; duplicate_of?: string } | null; error: unknown };
    setCheckingDuplicate(false);

    if (duplicateError) {
      console.error("[BetForm] Erro ao verificar duplicatas:", duplicateError);
    } else if (duplicateCheck && !duplicateCheck.allowed) {
      setIsLoading(false);
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 320);
      toast.error(`Estas dezenas já foram registradas por "${duplicateCheck.duplicate_of}". Por favor, escolha outros números.`, {
        duration: 6000,
      });
      return;
    }

    const apelido = participantInfo?.apelido || data.apelido.trim();
    // `data.celular` já chega normalizado (somente dígitos) via zod transform
    const celular = participantInfo?.celular || data.celular;

    // Gerar ID no client para não depender de RETURNING/SELECT (evita conflito com RLS)
    const apostaId = crypto.randomUUID();

    const { error } = await supabase.from("apostas").insert({
      id: apostaId,
      bolao_id: bolaoId,
      apelido,
      celular,
      dezenas: selectedNumbers,
    });

    setIsLoading(false);

    if (error) {
      console.error("[BetForm] Falha ao registrar aposta:", error.message);
      toast.error("Erro ao registrar aposta. Tente novamente.");
      return;
    }

    toast.success("Aposta registrada com sucesso! Obrigado por participar.", {
      duration: 4000,
      icon: <Check className="h-5 w-5 text-success" />,
    });
    
    // Save participant info for future bets
    if (!participantInfo) {
      setParticipantInfo({ apelido, celular });
    }
    // Track bet in session with ID
    setSessionBets(prev => [...prev, { id: apostaId, numbers: [...selectedNumbers], receiptUploaded: false }]);
    
    setHasSubmittedBet(true);
    setSelectedNumbers([]);
    onSuccess(apelido, celular);
  };

  const handleNewBet = () => {
    setSelectedNumbers([]);
    setHasSubmittedBet(false);
  };

  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadingBetId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, envie apenas imagens");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB");
      return;
    }

    const fileExt = file.name.split('.').pop();
    // Use crypto.randomUUID for unpredictable filenames to prevent enumeration attacks
    const fileName = `${crypto.randomUUID()}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);

    if (uploadError) {
      toast.error("Erro ao enviar comprovante");
      setUploadingBetId(null);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    // Use secure RPC function with ownership validation
    const celular = participantInfo?.celular || '';
    const { data: success, error: updateError } = await supabase.rpc('upload_receipt', {
      p_aposta_id: uploadingBetId,
      p_receipt_url: publicUrl,
      p_celular: celular
    });

    if (updateError || !success) {
      toast.error("Erro ao vincular comprovante");
    } else {
      toast.success("Comprovante enviado com sucesso!");
      setSessionBets(prev => 
        prev.map(bet => 
          bet.id === uploadingBetId 
            ? { ...bet, receiptUploaded: true } 
            : bet
        )
      );
    }

    setUploadingBetId(null);
    event.target.value = '';
  };

  const totalValue = sessionBets.length * valorCota;
  const numbers = Array.from({ length: 60 }, (_, i) => i + 1);

  return (
    <Card className={cn("w-full max-w-2xl", shakeForm && "animate-shake")}>
      {/* Hidden file input for receipt upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReceiptUpload}
        className="hidden"
      />
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-primary">{bolaoNome}</CardTitle>
        <CardDescription className="space-y-2">
          <p className="font-medium">Chave PIX: {chavePix}</p>
          {observacoes && <p className="text-sm">{observacoes}</p>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasSubmittedBet && participantInfo ? (
          // Success state - show option to register new bet
          <div className="space-y-6">
            <div className="p-6 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <Check className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Aposta registrada com sucesso!
              </h3>
              <p className="text-muted-foreground">
                Olá, <span className="font-medium text-foreground">{participantInfo.apelido}</span>! 
                Sua aposta foi confirmada.
              </p>
            </div>

            {/* Session Bets Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">
                  Suas apostas ({sessionBets.length} {sessionBets.length === 1 ? 'cota' : 'cotas'}):
                </h4>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Valor a pagar:</p>
                  <p className="text-lg font-bold text-primary">
                    R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sessionBets.map((bet, index) => (
                  <div
                    key={bet.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50 border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
                      <div className="flex flex-wrap gap-1">
                        {bet.numbers.map((num) => (
                          <span
                            key={num}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-success text-success-foreground font-medium text-xs"
                          >
                            {num.toString().padStart(2, "0")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {bet.receiptUploaded ? (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <FileImage className="h-3 w-3" />
                          Enviado
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUploadingBetId(bet.id);
                            fileInputRef.current?.click();
                          }}
                          disabled={uploadingBetId === bet.id}
                          className="h-6 text-xs px-2"
                        >
                          {uploadingBetId === bet.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-3 w-3 mr-1" />
                              Comprovante
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleNewBet}
                className="w-full h-12 text-base font-semibold hover-scale bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus className="h-5 w-5 mr-2" />
                +1 Cota
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  const betsText = sessionBets
                    .map((bet, i) => `#${i + 1}: ${bet.numbers.map(n => n.toString().padStart(2, "0")).join(", ")}`)
                    .join("\n");
                  const message = `🍀 *Minhas apostas no bolão "${bolaoNome}"*\n\nParticipante: ${participantInfo?.apelido}\nTotal de cotas: ${sessionBets.length}\nValor total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n${betsText}\n\nBoa sorte! 🎯`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                  window.open(whatsappUrl, "_blank");
                }}
                className="w-full h-10 gap-2"
              >
                <Share2 className="h-4 w-4" />
                Compartilhar via WhatsApp
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Personal Info - only show if no participantInfo */}
            {!participantInfo ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="apelido">Apelido *</Label>
                  <Input
                    id="apelido"
                    placeholder="Como você quer ser chamado"
                    {...form.register("apelido")}
                    disabled={isLoading}
                  />
                  {form.formState.errors.apelido && (
                    <p className="text-sm text-destructive animate-fade-in">
                      {form.formState.errors.apelido.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="celular">Celular *</Label>
                  <Controller
                    name="celular"
                    control={form.control}
                    render={({ field }) => (
                      <InternationalPhoneInput
                        id="celular"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isLoading}
                      />
                    )}
                  />
                  {form.formState.errors.celular && (
                    <p className="text-sm text-destructive animate-fade-in">
                      {form.formState.errors.celular.message}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">
                  Apostando como: <span className="font-medium text-foreground">{participantInfo.apelido}</span>
                </p>
              </div>
            )}

            {/* Honeypot field - hidden from humans, bots will fill this */}
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{
                position: 'absolute',
                left: '-9999px',
                opacity: 0,
                height: 0,
                width: 0,
                pointerEvents: 'none',
              }}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            {/* Number Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Escolha 6 números *</Label>
                <span className="text-sm text-muted-foreground">
                  {selectedNumbers.length}/6 selecionados
                </span>
              </div>
              
              {/* Selected Numbers Display */}
              <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg bg-secondary/50 border">
                {selectedNumbers.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Clique nos números abaixo para selecionar</span>
                ) : (
                  selectedNumbers.map((num, idx) => (
                    <span
                      key={num}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-foreground font-semibold text-sm animate-scale-in shadow-md"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {num.toString().padStart(2, "0")}
                    </span>
                  ))
                )}
              </div>

              {/* Number Grid */}
              <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
                {numbers.map((num) => {
                  const isSelected = selectedNumbers.includes(num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumberClick(num)}
                      disabled={isLoading}
                      className={cn(
                        "flex h-8 w-full items-center justify-center rounded-full text-sm font-medium transition-all duration-150",
                        "hover:scale-105 active:scale-95",
                        isSelected
                          ? "bg-success text-success-foreground shadow-md ring-2 ring-success/30"
                          : "bg-muted hover:bg-success/20 text-foreground"
                      )}
                    >
                      {num.toString().padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legal Notice */}
            <p className="text-xs text-muted-foreground text-center px-4">
              As informações fornecidas (apelido, telefone e dezenas) serão usadas exclusivamente para organização do bolão.
            </p>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold hover-scale bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isLoading || selectedNumbers.length !== 6}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Enviar minha aposta"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
