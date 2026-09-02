import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  Plus,
  Megaphone,
  RefreshCw,
  Link2,
  Unlink,
  Settings2,

  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUsuarios } from '@/hooks/useUsuarios';
import { AdInvestment } from '@/hooks/useAdInvestments';
import { useAnunciosDados } from '@/hooks/useAnunciosDados';
import RegistroInvestimentoDialog from '@/components/anuncios/RegistroInvestimentoDialog';
import AnunciosKpis from '@/components/anuncios/AnunciosKpis';
import FunilVisual, { EtapaFunil } from '@/components/anuncios/FunilVisual';
import ConsultoresPainel from '@/components/anuncios/ConsultoresPainel';
import TimelineAnuncios from '@/components/anuncios/TimelineAnuncios';
import RegistrosTabela from '@/components/anuncios/RegistrosTabela';
// Desativado enquanto nao ha provedor de IA configurado -- ver bloco 'IA' no JSX.
// import PainelIA from '@/components/anuncios/PainelIA';
import FunilAquisicao from '@/components/anuncios/FunilAquisicao';
import ContasMetaDialog from '@/components/anuncios/ContasMetaDialog';
import { CANAIS_VENDAS } from '@/lib/anuncios';
import { exportarCSV, exportarPDF, exportarXLSX } from '@/lib/anunciosExport';

export default function InvestimentoAnuncios() {
  const [mesStr, setMesStr] = useState(() => format(new Date(), 'yyyy-MM'));
  const [modoData, setModoData] = useState<'mes' | 'custom'>('mes');
  const [dataInicioCustom, setDataInicioCustom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dataFimCustom, setDataFimCustom] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [canalFiltro, setCanalFiltro] = useState('todos');
  const [consultorFiltro, setConsultorFiltro] = useState('todos');
  const [campanhaFiltro, setCampanhaFiltro] = useState('todos');
  const [etapa, setEtapa] = useState<EtapaFunil>(null);
  const [visao, setVisao] = useState('funil');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<AdInvestment | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [contasDialogOpen, setContasDialogOpen] = useState(false);
  const queryClient = useQueryClient();


  const [ano, mes] = mesStr.split('-').map(Number);
  const inicio = modoData === 'mes' ? startOfMonth(new Date(ano, mes - 1, 1)) : parseISO(`${dataInicioCustom}T00:00:00`);
  const fim = modoData === 'mes' ? endOfMonth(new Date(ano, mes - 1, 1)) : parseISO(`${dataFimCustom}T23:59:59`);

  const { data: usuarios = [] } = useUsuarios(true);
  const {
    kpis,
    anterior,
    consultores,
    timeline,
    tabela,
    registrosPeriodo,
    porModeloAquisicao,
    geral,
    contasMeta,
    campanhasDisponiveis,
    excluir,
    isLoading,
  } = useAnunciosDados({
    inicio,
    fim,
    canal: canalFiltro,
    consultor: consultorFiltro,
    campanha: campanhaFiltro,
  });

  const periodoLabel = `${inicio.toLocaleDateString('pt-BR')} — ${fim.toLocaleDateString('pt-BR')}`;
  const filtroLabelBase = `Canal: ${canalFiltro === 'todos' ? 'Todos' : canalFiltro === 'meta_api' ? 'Meta Ads (API)' : CANAIS_VENDAS.find((c) => c.id === canalFiltro)?.label || canalFiltro} · Consultor: ${consultorFiltro === 'todos' ? 'Todos' : consultorFiltro}`;
  const filtroLabel = `${filtroLabelBase} · Produto: ${campanhaFiltro === 'todos' ? 'Todos' : campanhaFiltro}`;

  const dadosExport = useMemo(
    () => ({
      periodoLabel,
      filtroLabel,
      nomeArquivo: `investimento-anuncios-${format(inicio, 'yyyy-MM-dd')}_${format(fim, 'yyyy-MM-dd')}`,
      kpis,
      consultores,
      registros: tabela,
      modelos: porModeloAquisicao,
    }),
    [periodoLabel, filtroLabel, inicio, fim, kpis, consultores, tabela, porModeloAquisicao]
  );

  const contaAtiva = (contasMeta as any[]).find((c) => c.ativo);

  const conectarMeta = async () => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-oauth?action=start&return=${encodeURIComponent(
      `${window.location.origin}${window.location.pathname}`
    )}`;
    window.location.href = url;
  };

  const desconectarMeta = async () => {
    if (!window.confirm('Desconectar a conta Meta Ads? A sincronização automática será interrompida.')) return;
    setDesconectando(true);
    try {
      const { error } = await supabase
        .from('meta_ad_accounts' as any)
        .update({ ativo: false, last_sync_status: 'desconectado' } as any)
        .eq('ativo', true);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['meta-ad-accounts'] });
      toast.success('Conta Meta Ads desconectada');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao desconectar a conta');
    } finally {
      setDesconectando(false);
    }
  };



  const sincronizar = async () => {
    setSincronizando(true);
    try {
      // Puxa da Meta exatamente o período consultado (inclui datas retroativas)
      const { data, error } = await supabase.functions.invoke('meta-sync-insights', {
        body: { since: format(inicio, 'yyyy-MM-dd'), until: format(fim, 'yyyy-MM-dd') },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await queryClient.invalidateQueries({ queryKey: ['meta-insights'] });
      await queryClient.invalidateQueries({ queryKey: ['meta-ad-accounts'] });
      toast.success(`Meta Ads sincronizado (${periodoLabel})`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao sincronizar com Meta Ads');
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="anuncios-neon min-h-screen">
      <div className="container mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl grid place-items-center bg-primary/15 border border-primary/30">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold">Investimento em Anúncios</h1>
              <p className="text-sm text-muted-foreground">{periodoLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(contasMeta as any[]).length > 0 && (
              <Button variant="outline" onClick={() => setContasDialogOpen(true)}>
                <Settings2 className="w-4 h-4 mr-1" /> Contas ({(contasMeta as any[]).filter((c) => c.ativo).length}/
                {(contasMeta as any[]).length})
              </Button>
            )}
            {contaAtiva ? (
              <div className="surface px-3 py-2 flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-success pulse-dot" />
                <span className="text-muted-foreground">
                  Meta Ads · {contaAtiva.nome || contaAtiva.ad_account_id}
                  {contaAtiva.last_sync_at ? ` · última sync ${new Date(contaAtiva.last_sync_at).toLocaleString('pt-BR')}` : ''}
                </span>

                <Button size="sm" variant="ghost" onClick={sincronizar} disabled={sincronizando}>
                  {sincronizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={desconectarMeta} disabled={desconectando} title="Desconectar conta">
                  {desconectando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4 text-destructive" />}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={conectarMeta}>
                <Link2 className="w-4 h-4 mr-1" /> Conectar Meta Ads
              </Button>
            )}


            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-1" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportarPDF(dadosExport)}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportarXLSX(dadosExport)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (XLSX)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportarCSV(dadosExport)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => {
                setEditando(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Novo registro
            </Button>

          </div>
        </div>

        {/* Filtros */}
        <div className="surface p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={modoData} onValueChange={(v) => setModoData(v as 'mes' | 'custom')}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="custom">Intervalo personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {modoData === 'mes' ? (
            <div>
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Input type="month" className="mt-1" value={mesStr} onChange={(e) => setMesStr(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Início</Label>
                <Input type="date" className="mt-1" value={dataInicioCustom} onChange={(e) => setDataInicioCustom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fim</Label>
                <Input type="date" className="mt-1" value={dataFimCustom} onChange={(e) => setDataFimCustom(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">Canal</Label>
            <Select value={canalFiltro} onValueChange={setCanalFiltro}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os canais</SelectItem>
                {CANAIS_VENDAS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
                <SelectItem value="meta_api">Meta Ads (API)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Produto / Campanha (Meta)</Label>
            <Select value={campanhaFiltro} onValueChange={setCampanhaFiltro}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                {(campanhasDisponiveis as string[]).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Consultor</Label>
            <Select value={consultorFiltro} onValueChange={setConsultorFiltro}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os consultores</SelectItem>
                {usuarios.map((u: any) => (
                  <SelectItem key={u.id} value={u.nome}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <AnunciosKpis kpis={kpis} anterior={anterior} />

        {/* Visões */}
        <div className="surface p-4">
          <Tabs value={visao} onValueChange={setVisao}>
            <TabsList>
              <TabsTrigger value="funil">Funil</TabsTrigger>
              <TabsTrigger value="consultores">Consultores</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="funil" className="mt-4">
              <FunilVisual kpis={kpis} etapaSelecionada={etapa} onSelecionarEtapa={setEtapa} />
            </TabsContent>
            <TabsContent value="consultores" className="mt-4">
              <ConsultoresPainel consultores={consultores} etapa={etapa} timeline={timeline} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <TimelineAnuncios dados={timeline} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Funil geral por modelo de aquisição */}
        <FunilAquisicao modelos={porModeloAquisicao} geral={geral} />

        {/* Tabela de registros */}
        <div className="surface p-4">
          <h3 className="font-medium mb-3">Registros de investimento</h3>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
            </div>
          ) : (
            <RegistrosTabela
              linhas={tabela}
              onEditar={(r) => {
                setEditando(r);
                setDialogOpen(true);
              }}
              onExcluir={(r) => {
                if (confirm(`Excluir o registro "${r.nome_campanha}"?`)) excluir.mutate(r.id);
              }}
            />
          )}
        </div>

        {/* IA -- desativado. A funcao `anuncios-insights-ia` depende da
            LOVABLE_API_KEY, que nao esta configurada nos secrets do projeto;
            sem ela a funcao responde 500 e a tela abria com um toast de erro
            a cada carregamento. Para reativar: repor o secret (ou migrar a
            function para outro provedor) e descomentar este bloco mais o
            import de PainelIA no topo do arquivo.
        <PainelIA periodoLabel={periodoLabel} kpis={kpis} anterior={anterior} consultores={consultores} />
        */}
      </div>

      <ContasMetaDialog
        open={contasDialogOpen}
        onOpenChange={setContasDialogOpen}
        contas={contasMeta as any[]}
      />


      <RegistroInvestimentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        registro={editando}
        registrosPeriodo={registrosPeriodo}
        periodoLabel={periodoLabel}
      />
    </div>
  );
}
