import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { LemoncapsLoader } from "@/components/LemoncapsLogo";
import Index from "./pages/Index";
import Login from "./pages/Login";
import { lazy, Suspense, useEffect, useState } from 'react';
import { migrateLocalDataToSupabase } from './lib/migrateToSupabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useRecebimentoNotificacoes } from './hooks/useRecebimentoNotificacoes';
import { useAtualizacaoAutomatica } from './hooks/useAtualizacaoAutomatica';
import { toast as sonnerToast } from 'sonner';
import { usePedidos } from './hooks/usePedidos';

/* Rotas fora do primeiro carregamento vão sob demanda (React.lazy): reduz o
   bundle inicial de ~4 MB único para um chunk por página. Index e Login ficam
   estáticos porque são a primeira tela vista — lazy neles só atrasaria. */
const Inventario = lazy(() => import("./pages/Inventario"));
const Pedidos = lazy(() => import("./pages/Pedidos"));
const Precificacao = lazy(() => import("./pages/Precificacao"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const ZapVendas = lazy(() => import("./pages/ZapVendas"));
const ZapInteligencia = lazy(() => import("./pages/ZapInteligencia"));
const LeadsOrcamento = lazy(() => import("./pages/LeadsOrcamento"));
const DashboardComercial = lazy(() => import("./pages/DashboardComercial"));
const AnaliseOrcamentos = lazy(() => import("./pages/AnaliseOrcamentos"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PainelAdministrador = lazy(() => import("./pages/PainelAdministrador"));
const SucessoCliente = lazy(() => import("./pages/SucessoCliente"));
const ConfiguracaoContratos = lazy(() => import("./pages/ConfiguracaoContratos"));
const EditorContratos = lazy(() => import("./pages/EditorContratos"));
const EditorContratoModelo = lazy(() => import("./pages/EditorContratoModelo"));
const VhsysLogs = lazy(() => import("./pages/VhsysLogs"));
const AsaasLogs = lazy(() => import("./pages/AsaasLogs"));
const EmailLogs = lazy(() => import("./pages/EmailLogs"));
const InvestimentoAnuncios = lazy(() => import("./pages/InvestimentoAnuncios"));
const FunisTrafegoPago = lazy(() => import("./pages/FunisTrafegoPago"));
const Logistica = lazy(() => import("./pages/Logistica"));

const RouteFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <LemoncapsLoader className="h-10 w-auto text-primary" />
  </div>
);

const queryClient = new QueryClient();

const AppContent = () => {
  const { isAuthenticated, loading, logout } = useAuth();
  const [migrated, setMigrated] = useState(false);
  const { pedidos } = usePedidos();
  useRecebimentoNotificacoes(isAuthenticated && migrated ? pedidos : undefined);

  // Quando sai um deploy, a aba aberta continuaria no codigo antigo ate' alguem
  // recarregar. Avisa e recarrega sozinho, dando alguns segundos para quem
  // estiver no meio de um formulario -- os rascunhos ja' foram salvos ate' la'.
  useAtualizacaoAutomatica({
    aoDetectar: (recarregar) => {
      sonnerToast.info('Nova versão disponível — atualizando...', { duration: 5000 });
      window.setTimeout(recarregar, 5000);
    },
  });

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
        <LemoncapsLoader className="h-10 w-auto text-primary" />
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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/precificacao" element={<Precificacao />} />
            <Route path="/orcamentos" element={<Orcamentos />} />
            <Route path="/logistica" element={<Logistica />} />
            <Route path="/leads-orcamento" element={<LeadsOrcamento />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/sucesso-cliente" element={<SucessoCliente />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/analise-orcamentos" element={<AnaliseOrcamentos />} />
            <Route path="/dashboard" element={<DashboardComercial />} />
            <Route path="/painel-administrador" element={<PainelAdministrador />} />
            <Route path="/configuracao-contratos" element={<ConfiguracaoContratos />} />
            <Route path="/editor-contratos" element={<EditorContratos />} />
            <Route path="/editor-contratos/:id" element={<EditorContratoModelo />} />
            <Route path="/vhsys-logs" element={<VhsysLogs />} />
            <Route path="/asaas-logs" element={<AsaasLogs />} />
            <Route path="/email-logs" element={<EmailLogs />} />
            <Route path="/investimento-anuncios" element={<InvestimentoAnuncios />} />
            <Route path="/funis-trafego-pago" element={<FunisTrafegoPago />} />
            <Route path="/zapvendas" element={<ZapVendas />} />
            {/* O guard de papel vive dentro da página (useTemPapel), como no
                ZapVendas: a rota existe, mas a tela nega o acesso. */}
            <Route path="/zap-inteligencia" element={<ZapInteligencia />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
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
