import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminGuard } from "@/components/layout/AdminGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Shield, Users, Ticket, Search, ExternalLink, LogOut, Trash2, KeyRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Bolao {
  id: string;
  nome_do_bolao: string;
  total_apostas: number;
  created_at: string;
  encerrado: boolean;
  gestor_id: string;
  gestor_name?: string;
  gestor_email?: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
}

export default function AdminDashboard() {
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"boloes" | "users">("boloes");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Fetch all bolões
      const { data: boloesData, error: boloesError } = await supabase
        .from("boloes")
        .select("*")
        .order("created_at", { ascending: false });

      if (boloesError) throw boloesError;

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Map gestor info to bolões
      const boloesWithGestor = (boloesData || []).map((bolao) => {
        const gestor = profilesData?.find((p) => p.id === bolao.gestor_id);
        return {
          ...bolao,
          gestor_name: gestor?.name || "Desconhecido",
          gestor_email: gestor?.email || "",
        };
      });

      setBoloes(boloesWithGestor);
      setProfiles(profilesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const handleDeleteBolao = async (bolaoId: string, bolaoName: string) => {
    setDeleting(bolaoId);
    try {
      // Delete related data first (apostas, jogos, mensagens)
      await supabase.from("mensagens").delete().eq("bolao_id", bolaoId);
      await supabase.from("jogos_selecionados").delete().eq("bolao_id", bolaoId);
      await supabase.from("participant_sessions").delete().eq("bolao_id", bolaoId);
      await supabase.from("apostas").delete().eq("bolao_id", bolaoId);
      
      // Delete the bolão
      const { error } = await supabase.from("boloes").delete().eq("id", bolaoId);
      
      if (error) throw error;
      
      setBoloes(boloes.filter(b => b.id !== bolaoId));
      toast.success(`Bolão "${bolaoName}" excluído com sucesso`);
    } catch (error) {
      console.error("Error deleting bolão:", error);
      toast.error("Erro ao excluir bolão");
    } finally {
      setDeleting(null);
    }
  };

  const filteredBoloes = boloes.filter(
    (bolao) =>
      bolao.nome_do_bolao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bolao.gestor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bolao.gestor_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProfiles = profiles.filter(
    (profile) =>
      profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Painel Administrativo</h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Bolões</CardTitle>
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{boloes.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Gestores</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{profiles.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Apostas</CardTitle>
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {boloes.reduce((acc, b) => acc + b.total_apostas, 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs */}
              <div className="mb-4 flex gap-2">
                <Button
                  variant={activeTab === "boloes" ? "default" : "outline"}
                  onClick={() => setActiveTab("boloes")}
                >
                  <Ticket className="mr-2 h-4 w-4" />
                  Bolões
                </Button>
                <Button
                  variant={activeTab === "users" ? "default" : "outline"}
                  onClick={() => setActiveTab("users")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Usuários
                </Button>
              </div>

              {/* Search */}
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {activeTab === "boloes" ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bolão</TableHead>
                          <TableHead>Gestor</TableHead>
                          <TableHead>Apostas</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBoloes.map((bolao) => (
                          <TableRow key={bolao.id}>
                            <TableCell className="font-medium">
                              {bolao.nome_do_bolao}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{bolao.gestor_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {bolao.gestor_email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{bolao.total_apostas}</TableCell>
                            <TableCell>
                              <Badge variant={bolao.encerrado ? "secondary" : "default"}>
                                {bolao.encerrado ? "Encerrado" : "Ativo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(bolao.created_at), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/admin/bolao/${bolao.id}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      disabled={deleting === bolao.id}
                                    >
                                      {deleting === bolao.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir bolão?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja excluir o bolão "{bolao.nome_do_bolao}"?
                                        Esta ação é irreversível e removerá todas as apostas, mensagens e jogos associados.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteBolao(bolao.id, bolao.nome_do_bolao)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredBoloes.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                              Nenhum bolão encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <AdminUsersTab
                  profiles={filteredProfiles}
                  onRefresh={fetchData}
                />
              )}
            </>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}

interface AdminUsersTabProps {
  profiles: Profile[];
  onRefresh: () => void;
}

function AdminUsersTab({ profiles, onRefresh }: AdminUsersTabProps) {
  const [userRoles, setUserRoles] = useState<Record<string, boolean>>({});
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  useEffect(() => {
    fetchRoles();
  }, [profiles]);

  async function fetchRoles() {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (error) throw error;

      const roles: Record<string, boolean> = {};
      data?.forEach((r) => {
        if (r.role === "admin") {
          roles[r.user_id] = true;
        }
      });
      setUserRoles(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setLoadingRoles(false);
    }
  }

  async function toggleAdmin(userId: string, isCurrentlyAdmin: boolean) {
    setUpdating(userId);
    try {
      if (isCurrentlyAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        toast.success("Permissão de admin removida");
      } else {
        // Add admin role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        toast.success("Usuário promovido a admin");
      }

      fetchRoles();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar permissões");
    } finally {
      setUpdating(null);
    }
  }

  async function handleResetPassword(email: string, userId: string) {
    setResettingPassword(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao resetar senha");
      }

      toast.success(`Email de reset enviado para ${email}`);
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao resetar senha");
    } finally {
      setResettingPassword(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => {
              const isAdmin = userRoles[profile.id] || false;
              return (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell>{profile.email}</TableCell>
                  <TableCell>
                    {loadingRoles ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Badge variant={isAdmin ? "default" : "secondary"}>
                        {isAdmin ? "Admin" : "Gestor"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant={isAdmin ? "destructive" : "outline"}
                        size="sm"
                        disabled={updating === profile.id}
                        onClick={() => toggleAdmin(profile.id, isAdmin)}
                      >
                        {updating === profile.id && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {isAdmin ? "Remover Admin" : "Promover a Admin"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resettingPassword === profile.id}
                        onClick={() => handleResetPassword(profile.email, profile.id)}
                      >
                        {resettingPassword === profile.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="mr-2 h-4 w-4" />
                        )}
                        Resetar Senha
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {profiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
