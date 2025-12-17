import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apostasSchema, ApostaInput } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BetFormProps {
  bolaoId: string;
  bolaoNome: string;
  chavePix: string;
  observacoes?: string;
  onSuccess: () => void;
}

export function BetForm({ bolaoId, bolaoNome, chavePix, observacoes, onSuccess }: BetFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [shakeForm, setShakeForm] = useState(false);
  const [honeypot, setHoneypot] = useState("");

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
      if (prev.includes(num)) {
        return prev.filter((n) => n !== num);
      }
      if (prev.length >= 6) {
        toast.error("Você já selecionou 6 números");
        return prev;
      }
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  const handleSubmit = async (data: Omit<ApostaInput, "dezenas">) => {
    // Bot detection: honeypot field should be empty
    if (honeypot) {
      // Silently reject bot submissions
      toast.success("Aposta registrada com sucesso!");
      form.reset();
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
    
    const { error } = await supabase.from("apostas").insert({
      bolao_id: bolaoId,
      apelido: data.apelido.trim(),
      celular: data.celular.trim(),
      dezenas: selectedNumbers,
    });

    setIsLoading(false);

    if (error) {
      toast.error("Erro ao registrar aposta. Tente novamente.");
      return;
    }

    toast.success("Aposta registrada com sucesso! Obrigado por participar.", {
      duration: 4000,
      icon: <Check className="h-5 w-5 text-success" />,
    });
    
    form.reset();
    setSelectedNumbers([]);
    onSuccess();
  };

  const numbers = Array.from({ length: 60 }, (_, i) => i + 1);

  return (
    <Card className={cn("w-full max-w-2xl", shakeForm && "animate-shake")}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-primary">{bolaoNome}</CardTitle>
        <CardDescription className="space-y-2">
          <p className="font-medium">Chave PIX: {chavePix}</p>
          {observacoes && <p className="text-sm">{observacoes}</p>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Personal Info */}
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
              <Input
                id="celular"
                placeholder="(00) 00000-0000"
                {...form.register("celular")}
                disabled={isLoading}
              />
              {form.formState.errors.celular && (
                <p className="text-sm text-destructive animate-fade-in">
                  {form.formState.errors.celular.message}
                </p>
              )}
            </div>
          </div>

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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm animate-scale-in"
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
                      "flex h-8 w-full items-center justify-center rounded-md text-sm font-medium transition-all duration-150",
                      "hover:scale-105 active:scale-95",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted hover:bg-muted/80 text-foreground"
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
      </CardContent>
    </Card>
  );
}
