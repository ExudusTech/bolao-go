import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CriarBolao from "./pages/CriarBolao";
import BolaoDetalhes from "./pages/BolaoDetalhes";
import Participar from "./pages/Participar";
import ParticipantLogin from "./pages/ParticipantLogin";
import ParticipanteDashboard from "./pages/ParticipanteDashboard";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/gestor/dashboard" element={<Dashboard />} />
          <Route path="/bolao/criar" element={<CriarBolao />} />
          <Route path="/gestor/bolao/:id" element={<BolaoDetalhes />} />
          <Route path="/participar/:id" element={<Participar />} />
          <Route path="/participar/:id/login" element={<ParticipantLogin />} />
          <Route path="/participar/:id/cadastro" element={<Participar />} />
          <Route path="/participante" element={<ParticipanteDashboard />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
