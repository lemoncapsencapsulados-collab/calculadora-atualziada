import { useState } from 'react';
import { Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPasswordGate } from '@/components/admin/AdminPasswordGate';
import { HistoricoAlteracoes } from '@/components/admin/HistoricoAlteracoes';
import { ConsultoresAdmin } from '@/components/admin/ConsultoresAdmin';
import { RelatorioComissoes } from '@/components/admin/RelatorioComissoes';
import { OverheadConfigCard } from '@/components/admin/OverheadConfigCard';
import { WebhooksConfigCard } from '@/components/admin/WebhooksConfigCard';
import { ApiKeysCard } from '@/components/admin/ApiKeysCard';
import { FretePodPrecosCard } from '@/components/admin/FretePodPrecosCard';
import { isAdminUnlocked, lockAdmin } from '@/lib/adminConfig';

export default function PainelAdministrador() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  const [aba, setAba] = useState<string>('consultores');
  const [filtroHistorico, setFiltroHistorico] = useState<{ inicio: string; fim: string } | null>(null);

  if (!unlocked) {
    return <AdminPasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Painel Administrador</h1>
            <p className="text-sm text-muted-foreground">Consultores, comissionamento e histórico</p>
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

      <OverheadConfigCard />

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
        <TabsList>
          <TabsTrigger value="consultores">Consultores</TabsTrigger>
          <TabsTrigger value="comissoes">Comissionamento</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Alterações</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="frete-pod">Preços POD</TabsTrigger>
        </TabsList>
        <TabsContent value="consultores">
          <ConsultoresAdmin />
        </TabsContent>
        <TabsContent value="comissoes">
          <RelatorioComissoes />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoAlteracoes
            filtroDataInicio={filtroHistorico?.inicio ?? null}
            filtroDataFim={filtroHistorico?.fim ?? null}
            onLimparFiltro={() => setFiltroHistorico(null)}
          />
        </TabsContent>
        <TabsContent value="integracoes">
          <WebhooksConfigCard />
        </TabsContent>
        <TabsContent value="api-keys">
          <ApiKeysCard />
        </TabsContent>
        <TabsContent value="frete-pod">
          <FretePodPrecosCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
