import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/hooks/useAuth";

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") as "login" | "register" | null;

  useEffect(() => {
    if (!loading && user) {
      navigate("/gestor/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container flex items-center justify-center py-12 px-4 flex-1">
        <AuthForm defaultTab={tab === "register" ? "register" : "login"} />
      </main>
      <Footer />
    </div>
  );
}
