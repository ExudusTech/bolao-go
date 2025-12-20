import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Link2, Users, Download, Shield, Zap, BarChart3 } from "lucide-react";

export default function Index() {
  const { user } = useAuth();

  const features = [
    {
      icon: Link2,
      title: "Link Público Único",
      description: "Gere um link exclusivo para cada bolão e compartilhe facilmente",
    },
    {
      icon: BarChart3,
      title: "Contador em Tempo Real",
      description: "Acompanhe o número de apostas conforme são registradas",
    },
    {
      icon: Download,
      title: "Exportação CSV",
      description: "Exporte todas as apostas para controle e organização",
    },
    {
      icon: Shield,
      title: "Dados Seguros",
      description: "Suas informações protegidas com criptografia",
    },
    {
      icon: Zap,
      title: "Rápido e Simples",
      description: "Crie um bolão em segundos e comece a receber apostas",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section - Caixa style gradient */}
      <section className="relative overflow-hidden bg-caixa-gradient">
        <div className="container relative py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              Organize seus bolões da{" "}
              <span className="text-accent">Mega-Sena</span>
            </h1>
            <p className="mt-6 text-lg text-white/90 md:text-xl">
              Crie bolões, gere links públicos e receba apostas de forma simples e organizada. 
              Sem complicação, sem burocracia.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Button size="lg" asChild className="hover-scale text-base px-8 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Link to="/gestor/dashboard">
                    Ir para o Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild className="hover-scale text-base px-8 bg-accent text-accent-foreground hover:bg-accent/90">
                    <Link to="/auth?tab=register">
                      Começar Gratuitamente
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="hover-scale text-base border-white/30 text-white hover:bg-white/10 hover:text-white">
                    <Link to="/auth">
                      Já tenho conta
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tudo que você precisa
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Funcionalidades pensadas para facilitar a organização dos seus bolões
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card 
              key={feature.title}
              className="group transition-all duration-200 hover:shadow-lg hover:border-primary/20 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30">
        <div className="container py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Pronto para começar?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Crie sua conta gratuitamente e organize seu primeiro bolão em menos de 1 minuto.
            </p>
            <div className="mt-8">
              {user ? (
                <Button size="lg" asChild className="hover-scale">
                  <Link to="/bolao/criar">
                    Criar Novo Bolão
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild className="hover-scale">
                  <Link to="/auth?tab=register">
                    Criar Conta Grátis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Robolão. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
