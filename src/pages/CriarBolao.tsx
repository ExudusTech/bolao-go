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
import { createBolaoSchema, CreateBolaoInput } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Copy, Check, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function CriarBolao() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [createdBolao, setCreatedBolao] = useState<{ id: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<CreateBolaoInput>({
    resolver: zodResolver(createBolaoSchema),
    defaultValues: {
      nome_do_bolao: "",
      chave_pix: "",
      valor_cota: 10,
      observacoes: "",
    },
  });

  const handleSubmit = async (data: CreateBolaoInput) => {
    if (!user) return;

    setIsLoading(true);

    const { data: bolao, error } = await supabase
      .from("boloes")
      .insert({
        gestor_id: user.id,
        nome_do_bolao: data.nome_do_bolao.trim(),
        chave_pix: data.chave_pix.trim(),
        valor_cota: data.valor_cota,
        observacoes: data.observacoes?.trim() || null,
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
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="obs">Observações (opcional)</Label>
                      <Textarea
                        id="obs"
                        placeholder="Informações adicionais como regras, data do sorteio, etc."
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
      </div>
    </AuthGuard>
  );
}
