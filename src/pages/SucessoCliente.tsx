import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, HeartHandshake, AlertTriangle, CheckCircle2, Clock, Star, Wallet } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import RecebimentosLista from '@/components/sucesso-cliente/RecebimentosLista';
import { usePedidos } from '@/hooks/usePedidos';
import { Pedido, AcompanhamentoProcessos } from '@/types/formula';
import {
  ETAPAS, calcularEtapaInfo, getEtapasContratadas, getStatusGeral,
  StatusGeralProjeto, RESPONSAVEIS,
} from '@/lib/sucessoCliente';
import ProjetoCard from '@/components/sucesso-cliente/ProjetoCard';
import ProjetoDetalheDialog from '@/components/sucesso-cliente/ProjetoDetalheDialog';

type Ordenacao = 'maior_atraso' | 'prazo_proximo' | 'pagamento_recente' | 'cliente_az';

export default function SucessoCliente() {
  const { pedidos, loading, updateAcompanhamento } = usePedidos();
  const [abaPrincipal, setAbaPrincipal] = useState<'projetos' | 'recebimentos'>('projetos');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('todos');
  const [filtroConsultor, setFiltroConsultor] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('maior_atraso');
  const [pedidoAberto, setPedidoAberto] = useState<Pedido | null>(null);

  const projetos = useMemo(() => {
    return pedidos.map((p) => {
      const contratadas = getEtapasContratadas(p);
      const etapasInfo = ETAPAS.map((cfg) => calcularEtapaInfo(p, cfg.id, contratadas[cfg.id]));
      const statusGeral = getStatusGeral(etapasInfo);
      const ativas = etapasInfo.filter((e) => e.contratada);
      const atrasadas = ativas.filter((e) => e.atrasada);
      const proximoPrazo = ativas
        .filter((e) => !e.concluida && e.diasRestantes != null)
        .map((e) => e.diasRestantes!)
        .sort((a, b) => a - b)[0];
      return { pedido: p, etapasInfo, statusGeral, atrasadas, proximoPrazo };
    });
  }, [pedidos]);

  const consultoresUnicos = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach((p) => {
      const c = (p.orcamento_snapshot as any)?.consultor_responsavel;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [pedidos]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    let arr = projetos.filter(({ pedido, statusGeral, etapasInfo }) => {
      const snap = (pedido.orcamento_snapshot as any) || {};
      const cliente = (snap.dados_cliente?.nome_completo || snap.nome_cliente || '').toLowerCase();
      const consultor = (snap.consultor_responsavel || '').toLowerCase();
      const produtosTxt = (pedido.acompanhamento_processos?.produtos_cs ?? [])
        .map((p) => p.nome?.toLowerCase() || '')
        .join(' ');
      const matchBusca = !q ||
        cliente.includes(q) ||
        pedido.numero_pedido.toLowerCase().includes(q) ||
        consultor.includes(q) ||
        produtosTxt.includes(q);
      const matchStatus = filtroStatus === 'todos' || statusGeral === filtroStatus;
      const matchConsultor = filtroConsultor === 'todos' || snap.consultor_responsavel === filtroConsultor;
      const matchResponsavel = filtroResponsavel === 'todos' ||
        etapasInfo.some((e) => e.contratada && !e.concluida && e.etapa.responsavel === filtroResponsavel);
      return matchBusca && matchStatus && matchConsultor && matchResponsavel;
    });

    arr.sort((a, b) => {
      switch (ordenacao) {
        case 'maior_atraso':
          return b.atrasadas.length - a.atrasadas.length;
        case 'prazo_proximo':
          return (a.proximoPrazo ?? 9999) - (b.proximoPrazo ?? 9999);
        case 'pagamento_recente': {
          const da = new Date((a.pedido.orcamento_snapshot as any)?.data_pagamento || a.pedido.data_pedido).getTime();
          const db = new Date((b.pedido.orcamento_snapshot as any)?.data_pagamento || b.pedido.data_pedido).getTime();
          return db - da;
        }
        case 'cliente_az': {
          const ca = ((a.pedido.orcamento_snapshot as any)?.dados_cliente?.nome_completo || (a.pedido.orcamento_snapshot as any)?.nome_cliente || '');
          const cb = ((b.pedido.orcamento_snapshot as any)?.dados_cliente?.nome_completo || (b.pedido.orcamento_snapshot as any)?.nome_cliente || '');
          return ca.localeCompare(cb);
        }
      }
    });
    return arr;
  }, [projetos, busca, filtroStatus, filtroConsultor, filtroResponsavel, ordenacao]);

  const kpis = useMemo(() => {
    const ativos = projetos.filter((p) => p.statusGeral !== 'concluido').length;
    const atrasados = projetos.filter((p) => p.statusGeral === 'em_atraso').length;
    const concluidos = projetos.filter((p) => p.statusGeral === 'concluido').length;
    const noPrazo = projetos.filter((p) => p.statusGeral === 'em_andamento' || p.statusGeral === 'aguardando_inicio').length;
    const notas = projetos
      .map((p) => p.pedido.acompanhamento_processos?.satisfacao_nota)
      .filter((n): n is number => typeof n === 'number');
    const npsMedio = notas.length ? (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1) : '—';
    return { ativos, atrasados, concluidos, noPrazo, npsMedio };
  }, [projetos]);

  const handleUpdate = (pedidoId: string, acomp: AcompanhamentoProcessos) => {
    updateAcompanhamento({ id: pedidoId, acompanhamento: acomp });
    // Mantém o dialog aberto refletindo o novo estado quando reabrir
    setPedidoAberto((prev) => prev && prev.id === pedidoId
      ? { ...prev, acompanhamento_processos: acomp }
      : prev);
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
          <HeartHandshake className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sucesso do Cliente</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de projetos de cada pedido — alimentado pela aba Pedidos.
          </p>
        </div>
      </div>

      <Tabs value={abaPrincipal} onValueChange={(v) => setAbaPrincipal(v as 'projetos' | 'recebimentos')}>
        <TabsList className="grid grid-cols-2 w-full md:w-auto">
          <TabsTrigger value="projetos" className="gap-2">
            <HeartHandshake className="h-4 w-4" /> Projetos
          </TabsTrigger>
          <TabsTrigger value="recebimentos" className="gap-2">
            <Wallet className="h-4 w-4" /> Recebimentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projetos" className="mt-4 space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Projetos ativos</div>
          <div className="text-2xl font-bold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />{kpis.ativos}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">No prazo</div>
          <div className="text-2xl font-bold text-blue-700">{kpis.noPrazo}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Em atraso</div>
          <div className="text-2xl font-bold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />{kpis.atrasados}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Concluídos</div>
          <div className="text-2xl font-bold text-green-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />{kpis.concluidos}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">NPS médio</div>
          <div className="text-2xl font-bold flex items-center gap-1.5">
            <Star className="w-4 h-4 text-yellow-500" />{kpis.npsMedio}
          </div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <Card><CardContent className="p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, nº pedido ou consultor..." className="pl-9" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aguardando_inicio">Aguardando início</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="em_atraso">Em atraso</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Aguardando ação de…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {RESPONSAVEIS.map((r) => (
              <SelectItem key={r} value={r}>Aguardando: {r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroConsultor} onValueChange={setFiltroConsultor}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Consultor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os consultores</SelectItem>
            {consultoresUnicos.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as Ordenacao)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="maior_atraso">Maior atraso</SelectItem>
            <SelectItem value="prazo_proximo">Prazo mais próximo</SelectItem>
            <SelectItem value="pagamento_recente">Pagamento mais recente</SelectItem>
            <SelectItem value="cliente_az">Cliente (A–Z)</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setFiltroStatus('em_atraso')}>
          Apenas em atraso
        </Button>
      </CardContent></Card>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando projetos...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum projeto encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtrados.map(({ pedido }) => (
            <ProjetoCard key={pedido.id} pedido={pedido} onAbrir={() => setPedidoAberto(pedido)} />
          ))}
        </div>
      )}

      <ProjetoDetalheDialog
        pedido={pedidoAberto}
        open={!!pedidoAberto}
        onClose={() => setPedidoAberto(null)}
        onUpdate={handleUpdate}
      />
        </TabsContent>

        <TabsContent value="recebimentos" className="mt-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando recebimentos...</div>
          ) : (
            <RecebimentosLista pedidos={pedidos} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}