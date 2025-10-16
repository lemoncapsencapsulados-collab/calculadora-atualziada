import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import Index from "./pages/Index";
import Inventario from "./pages/Inventario";
import Cotacoes from "./pages/Cotacoes";
import Pedidos from "./pages/Pedidos";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from 'react';
import { migrateLocalDataToSupabase } from './lib/migrateToSupabase';

const queryClient = new QueryClient();

const App = () => {
  const [migrated, setMigrated] = useState(false);

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

  if (!migrated) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-lg text-foreground">Sincronizando dados com a nuvem...</p>
              <p className="mt-2 text-sm text-muted-foreground">Isso acontecerá apenas uma vez</p>
            </div>
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Navigation />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/cotacoes" element={<Cotacoes />} />
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
