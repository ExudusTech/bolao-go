import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, LayoutDashboard, Plus } from "lucide-react";
import { toast } from "sonner";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      toast.success("Você saiu com sucesso");
      navigate("/");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-primary/95 backdrop-blur supports-[backdrop-filter]:bg-primary/90">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover-scale">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <span className="text-lg font-bold text-accent-foreground">R</span>
          </div>
          <span className="text-xl font-bold text-primary-foreground">Robolão</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                <Link to="/gestor/dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
              <Button size="sm" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/bolao/criar" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Bolão</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sair</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button size="sm" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/auth?tab=register">Criar Conta</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
