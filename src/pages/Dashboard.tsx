import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { BolaoCard } from "@/components/bolao/BolaoCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Loader2, FolderOpen } from "lucide-react";

interface Bolao {
  id: string;
  nome_do_bolao: string;
  total_apostas: number;
  created_at: string;
  encerrado: boolean;
  data_sorteio: string | null;
  numeros_sorteados: number[] | null;
  resultado_verificado: boolean;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBoloes();
    }
  }, [user]);

  const fetchBoloes = async () => {
    const { data, error } = await supabase
      .from("boloes")
      .select("id, nome_do_bolao, total_apostas, created_at, encerrado, data_sorteio, numeros_sorteados, resultado_verificado")
      .eq("gestor_id", user?.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBoloes(data);
    }
    setLoading(false);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="container py-8 px-4 flex-1">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-foreground">Seus Bolões</h1>
              <p className="text-muted-foreground">
                Gerencie seus bolões e acompanhe as apostas
              </p>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : boloes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Nenhum bolão criado</h2>
                <p className="text-muted-foreground">
                  Crie seu primeiro bolão clicando em "Novo Bolão" no menu acima
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {boloes.map((bolao, index) => (
                  <BolaoCard
                    key={bolao.id}
                    id={bolao.id}
                    nome={bolao.nome_do_bolao}
                    totalApostas={bolao.total_apostas}
                    createdAt={bolao.created_at}
                    index={index}
                    encerrado={bolao.encerrado}
                    dataSorteio={bolao.data_sorteio}
                    numerosSorteados={bolao.numeros_sorteados}
                    resultadoVerificado={bolao.resultado_verificado}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </AuthGuard>
  );
}
