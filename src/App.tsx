import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import Index from "./pages/Index";
import Inventario from "./pages/Inventario";

import Pedidos from "./pages/Pedidos";
import Precificacao from "./pages/Precificacao";
import Orcamentos from "./pages/Orcamentos";
import LeadsOrcamento from "./pages/LeadsOrcamento";
import DashboardComercial from "./pages/DashboardComercial";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PainelAdministrador from "./pages/PainelAdministrador";
import SucessoCliente from "./pages/SucessoCliente";
import ConfiguracaoContratos from "./pages/ConfiguracaoContratos";
import VhsysLogs from "./pages/VhsysLogs";
import AsaasLogs from "./pages/AsaasLogs";
import EmailLogs from "./pages/EmailLogs";
import { useEffect, useState } from 'react';
import { migrateLocalDataToSupabase } from './lib/migrateToSupabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useAplicarPrazoVencido } from './hooks/useAplicarPrazoVencido';
import { PrazoPrecoBanner } from './components/PrazoPrecoBanner';
import { useRecebimentoNotificacoes } from './hooks/useRecebimentoNotificacoes';
import { usePedidos } from './hooks/usePedidos';

const queryClient = new QueryClient();

const AppContent = () => {
  const { isAuthenticated, loading, logout } = useAuth();
  const [migrated, setMigrated] = useState(false);
  useAplicarPrazoVencido(isAuthenticated && migrated);
  const { pedidos } = usePedidos();
  useRecebimentoNotificacoes(isAuthenticated && migrated ? pedidos : undefined);

  useEffect(() => {
    const runMigration = async () => {
      const migrationKey = 'supabase_migration_completed';
      if (!localStorage.getItem(migrationKey)) {
        const success = await migrateLocalDataToSupabase();
        if (success) {
          localStorage.setItem(migrationKey, 'true');
        }
        setMigrated(true);
      } else {
        setMigrated(true);
      }
    };

    runMigration();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (!migrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-foreground">Sincronizando dados com a nuvem...</p>
          <p className="mt-2 text-sm text-muted-foreground">Isso acontecerá apenas uma vez</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Navigation onLogout={logout} />
        <PrazoPrecoBanner />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/precificacao" element={<Precificacao />} />
          <Route path="/orcamentos" element={<Orcamentos />} />
          <Route path="/leads-orcamento" element={<LeadsOrcamento />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/sucesso-cliente" element={<SucessoCliente />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/dashboard" element={<DashboardComercial />} />
          <Route path="/painel-administrador" element={<PainelAdministrador />} />
          <Route path="/configuracao-contratos" element={<ConfiguracaoContratos />} />
          <Route path="/vhsys-logs" element={<VhsysLogs />} />
          <Route path="/asaas-logs" element={<AsaasLogs />} />
          <Route path="/email-logs" element={<EmailLogs />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
