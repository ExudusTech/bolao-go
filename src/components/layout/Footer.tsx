import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="border-t py-6 mt-auto">
      <div className="container flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
          <Link to="/admin/login">
            <Settings className="h-4 w-4 mr-2" />
            Painel Administrativo
          </Link>
        </Button>
        <span>Desenvolvido por ExudusTech - Seu hub de caminhos! - Todos os direitos reservados</span>
      </div>
    </footer>
  );
}
