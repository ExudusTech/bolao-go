import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useParticipantAuth } from "@/hooks/useParticipantAuth";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, ArrowLeft, LogIn } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  apelido: z.string().min(2, "Apelido deve ter pelo menos 2 caracteres"),
  senha: z.string().length(4, "Senha deve ter exatamente 4 dígitos").regex(/^\d{4}$/, "Senha deve conter apenas números")
});

type LoginFormData = z.infer<typeof loginSchema>;

interface BolaoInfo {
  id: string;
  nome_do_bolao: string;
  gestor_name: string | null;
}

export default function ParticipantLogin() {
  const { id: bolaoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, isLoading: authLoading, login } = useParticipantAuth(bolaoId);
  const [bolao, setBolao] = useState<BolaoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      apelido: "",
      senha: ""
    }
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && session && session.bolaoId === bolaoId) {
      navigate(`/participar/${bolaoId}`);
    }
  }, [authLoading, session, bolaoId, navigate]);

  // Fetch bolao info
  useEffect(() => {
    async function fetchBolao() {
      if (!bolaoId) return;

      const { data, error } = await supabase.rpc("get_bolao_for_participation", {
        bolao_id: bolaoId
      });

      if (!error && data && data.length > 0) {
        setBolao({
          id: data[0].id,
          nome_do_bolao: data[0].nome_do_bolao,
          gestor_name: data[0].gestor_name
        });
      }
      setLoading(false);
    }

    fetchBolao();
  }, [bolaoId]);

  async function onSubmit(data: LoginFormData) {
    if (!bolaoId) return;

    setSubmitting(true);
    const result = await login(bolaoId, data.apelido, data.senha);
    setSubmitting(false);

    if (result.success) {
      toast.success("Login realizado com sucesso!");
      navigate(`/participar/${bolaoId}`);
    } else {
      toast.error(result.error || "Credenciais inválidas");
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bolao) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto">
            <span className="text-2xl font-bold text-muted-foreground">?</span>
          </div>
          <h1 className="text-2xl font-bold">Bolão não encontrado</h1>
          <p className="text-muted-foreground">
            O link pode estar incorreto ou o bolão foi removido.
          </p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 hover-scale">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">R</span>
            </div>
            <span className="font-bold text-foreground">Robolão</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 px-4 flex flex-col items-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{bolao.nome_do_bolao}</CardTitle>
            <CardDescription>
              Entre com seu apelido e os últimos 4 dígitos do celular cadastrado
            </CardDescription>
            {bolao.gestor_name && (
              <p className="text-sm text-muted-foreground mt-2">
                Organizado por <span className="font-medium">{bolao.gestor_name}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="apelido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apelido</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Seu apelido usado na aposta" 
                          {...field} 
                          autoComplete="username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="senha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha (últimos 4 dígitos do celular)</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="****"
                          maxLength={4}
                          inputMode="numeric"
                          {...field}
                          autoComplete="current-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Entrar
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Ainda não tem uma aposta?</p>
              <Button asChild variant="link" className="p-0 h-auto">
                <Link to={`/participar/${bolaoId}/cadastro`}>
                  Faça sua primeira aposta
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
