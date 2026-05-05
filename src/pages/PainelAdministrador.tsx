import { useState } from 'react';
import { Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPasswordGate } from '@/components/admin/AdminPasswordGate';
import { VariaveisEstruturaisForm } from '@/components/admin/VariaveisEstruturaisForm';
import { HistoricoAlteracoes } from '@/components/admin/HistoricoAlteracoes';
import { PrazoPrecoCountdown } from '@/components/admin/PrazoPrecoCountdown';
import { PrazosAtivosLista } from '@/components/admin/PrazosAtivosLista';
import { PrazoItensVinculados } from '@/components/admin/PrazoItensVinculados';
import { usePrazoNotificacoes } from '@/hooks/usePrazoNotificacoes';
import { isAdminUnlocked, lockAdmin } from '@/lib/adminConfig';

export default function PainelAdministrador() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  const [aba, setAba] = useState<string>('variaveis');
  const [filtroHistorico, setFiltroHistorico] = useState<{ inicio: string; fim: string } | null>(null);

  // Toasts de aviso (3 dias / expirado)
  usePrazoNotificacoes();

  if (!unlocked) {
    return <AdminPasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  const abrirHistoricoSnapshot = (prazo: { data_inicio: string; data_fim: string }) => {
    setFiltroHistorico({ inicio: prazo.data_inicio, fim: prazo.data_fim });
    setAba('historico');
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Painel Administrador</h1>
            <p className="text-sm text-muted-foreground">Variáveis estruturais que formam o preço dos produtos</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            lockAdmin();
            setUnlocked(false);
          }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Bloquear painel
        </Button>
      </div>

      <PrazoPrecoCountdown onVerHistorico={abrirHistoricoSnapshot} />
      <PrazoItensVinculados />
      <div className="mb-6">
        <PrazosAtivosLista onAbrirHistorico={(p) => abrirHistoricoSnapshot(p)} />
      </div>

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
        <TabsList>
          <TabsTrigger value="variaveis">Variáveis Estruturais</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Alterações</TabsTrigger>
        </TabsList>
        <TabsContent value="variaveis">
          <VariaveisEstruturaisForm />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoAlteracoes
            filtroDataInicio={filtroHistorico?.inicio ?? null}
            filtroDataFim={filtroHistorico?.fim ?? null}
            onLimparFiltro={() => setFiltroHistorico(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
