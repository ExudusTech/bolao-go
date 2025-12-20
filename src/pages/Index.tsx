import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Link2, Users, Download, Shield, Zap, BarChart3, User } from "lucide-react";

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

      {/* Hero Section - Mobile optimized */}
      <section className="relative overflow-hidden bg-caixa-gradient">
        <div className="container relative py-12 px-4 sm:py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl leading-tight">
              Organize seus bolões da{" "}
              <span className="text-accent block sm:inline">Mega-Sena</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-white/90 md:text-xl px-2">
              Crie bolões, gere links públicos e receba apostas de forma simples e organizada.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4 px-4 sm:px-0">
              {user ? (
                <Button size="lg" asChild className="w-full sm:w-auto hover-scale text-base px-8 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Link to="/gestor/dashboard">
                    Ir para o Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild className="w-full sm:w-auto hover-scale text-base px-8 bg-accent text-accent-foreground hover:bg-accent/90">
                    <Link to="/auth?tab=register">
                      Começar Gratuitamente
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="w-full sm:w-auto hover-scale text-base border-white/30 text-white hover:bg-white/10 hover:text-white">
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

      {/* Features Section - Mobile optimized */}
      <section className="container py-12 px-4 sm:py-16 md:py-24">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight md:text-4xl">
            Tudo que você precisa
          </h2>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-muted-foreground px-2">
            Funcionalidades pensadas para facilitar a organização dos seus bolões
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card 
              key={feature.title}
              className="group transition-all duration-200 hover:shadow-lg hover:border-primary/20 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-2 sm:pb-4">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-base sm:text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-sm sm:text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Participant Area Section */}
      <section className="border-t bg-card">
        <div className="container py-10 px-4 sm:py-12">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Já é participante de um bolão?
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Acesse sua área para ver todos os bolões que você participa e acompanhar suas apostas.
            </p>
            <div className="mt-4">
              <Button variant="outline" size="lg" asChild className="hover-scale">
                <Link to="/participante">
                  <User className="h-4 w-4 mr-2" />
                  Área do Participante
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Mobile optimized */}
      <section className="border-t bg-muted/30">
        <div className="container py-12 px-4 sm:py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight md:text-4xl">
              Pronto para começar?
            </h2>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg text-muted-foreground px-2">
              Crie sua conta gratuitamente e organize seu primeiro bolão em menos de 1 minuto.
            </p>
            <div className="mt-6 sm:mt-8 px-4 sm:px-0">
              {user ? (
                <Button size="lg" asChild className="w-full sm:w-auto hover-scale">
                  <Link to="/bolao/criar">
                    Criar Novo Bolão
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild className="w-full sm:w-auto hover-scale">
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
