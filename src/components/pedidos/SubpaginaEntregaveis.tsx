import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Search, Eye, AlertTriangle } from 'lucide-react';
import {
  CATEGORIAS_ENTREGAVEIS, DemandaEntregavel, EntregavelCategoria,
  STATUS_ENTREGAVEL_LABEL, getAcompFieldFromCategoria,
} from '@/lib/entregaveis';
import { AcompanhamentoProcessos as AcompType, StatusProcessoLogistica } from '@/types/formula';
import { cn } from '@/lib/utils';

interface Props {
  categoria: EntregavelCategoria;
  demandas: DemandaEntregavel[];
  onAbrirPedido: (pedido: any) => void;
  onAtualizarStatus: (pedidoId: string, acomp: AcompType, novoValor: StatusProcessoLogistica) => void;
}

const statusColor: Record<StatusProcessoLogistica, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  entregue: 'bg-green-100 text-green-800 border-green-300',
  nao_necessario: 'bg-muted text-muted-foreground border-border',
};

const SubpaginaEntregaveis = ({ categoria, demandas, onAbrirPedido, onAtualizarStatus }: Props) => {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroConsultor, setFiltroConsultor] = useState<string>('todos');

  const config = CATEGORIAS_ENTREGAVEIS.find((c) => c.value === categoria)!;

  const lista = useMemo(() => demandas.filter((d) => d.categoria === categoria), [demandas, categoria]);

  const consultores = useMemo(() => {
    const set = new Set<string>();
    lista.forEach((d) => d.consultor && set.add(d.consultor));
    return Array.from(set).sort();
  }, [lista]);

  const filtrada = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return lista.filter((d) => {
      const matchBusca = !q ||
        d.cliente.toLowerCase().includes(q) ||
        d.numero_pedido.toLowerCase().includes(q) ||
        (d.detalhe || '').toLowerCase().includes(q);
      const matchStatus = filtroStatus === 'todos' || d.status_entregavel === filtroStatus;
      const matchConsultor = filtroConsultor === 'todos' || d.consultor === filtroConsultor;
      return matchBusca && matchStatus && matchConsultor;
    }).sort((a, b) => a.dias_restantes - b.dias_restantes);
  }, [lista, busca, filtroStatus, filtroConsultor]);

  const totais = useMemo(() => {
    const t = { pendentes: 0, entregues: 0, atrasados: 0, total: 0 };
    filtrada.forEach((d) => {
      t.total += d.quantidade;
      if (d.status_entregavel === 'entregue') t.entregues += d.quantidade;
      else if (d.status_entregavel === 'pendente') {
        t.pendentes += d.quantidade;
        if (d.dias_restantes < 0) t.atrasados += d.quantidade;
      }
    });
    return t;
  }, [filtrada]);

  const handleStatusChange = (d: DemandaEntregavel, novoValor: StatusProcessoLogistica) => {
    const acompAtual: AcompType = d.pedido.acompanhamento_processos || {
      criacao_marca: 'pendente',
      producao: 'pendente',
      integracao_logistica: 'pendente',
      pagina_venda: 'pendente',
      envio_produto: 'pendente',
      satisfacao_nota: null,
      satisfacao_observacoes: null,
    };
    const field = getAcompFieldFromCategoria(d.categoria);
    const novoAcomp = { ...acompAtual, [field]: novoValor } as AcompType;
    onAtualizarStatus(d.pedido_id, novoAcomp, novoValor);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">{config.label}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{totais.total} unidade(s)</Badge>
            <Badge variant="outline" className="border-yellow-400 text-yellow-700">
              {totais.pendentes} pendente(s)
            </Badge>
            {totais.atrasados > 0 && (
              <Badge variant="destructive">{totais.atrasados} atrasado(s)</Badge>
            )}
            <Badge variant="outline" className="border-green-400 text-green-700">
              {totais.entregues} entregue(s)
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, nº do pedido ou detalhe..."
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="nao_necessario">Não necessário</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroConsultor} onValueChange={setFiltroConsultor}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Consultor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os consultores</SelectItem>
              {consultores.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtrada.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhuma demanda encontrada para esta categoria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Consultor</TableHead>
                  {categoria === 'impressao_rotulos' && <TableHead>Tipo</TableHead>}
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrada.map((d, idx) => {
                  const atrasado = d.status_entregavel === 'pendente' && d.dias_restantes < 0;
                  return (
                    <TableRow key={`${d.pedido_id}-${idx}`} className={cn(atrasado && 'bg-destructive/5')}>
                      <TableCell className="font-medium">{d.cliente}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.numero_pedido}</TableCell>
                      <TableCell className="text-sm">{d.consultor || '-'}</TableCell>
                      {categoria === 'impressao_rotulos' && (
                        <TableCell className="text-sm">{d.detalhe || '-'}</TableCell>
                      )}
                      <TableCell className="text-center font-semibold">{d.quantidade}</TableCell>
                      <TableCell className="text-xs">
                        {d.data_pagamento ? format(d.data_pagamento, 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span>{format(d.prazo_previsto, 'dd/MM/yyyy')}</span>
                          <span className={cn(
                            'text-[10px]',
                            atrasado ? 'text-destructive font-semibold' :
                            d.dias_restantes <= 7 ? 'text-yellow-600' : 'text-muted-foreground',
                          )}>
                            {atrasado ? (
                              <span className="inline-flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                {Math.abs(d.dias_restantes)}d atrasado
                              </span>
                            ) : `${d.dias_restantes}d restantes`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={d.status_entregavel}
                          onValueChange={(v) => handleStatusChange(d, v as StatusProcessoLogistica)}
                        >
                          <SelectTrigger className={cn('h-8 w-[140px] text-xs', statusColor[d.status_entregavel])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">{STATUS_ENTREGAVEL_LABEL.pendente}</SelectItem>
                            <SelectItem value="entregue">{STATUS_ENTREGAVEL_LABEL.entregue}</SelectItem>
                            <SelectItem value="nao_necessario">{STATUS_ENTREGAVEL_LABEL.nao_necessario}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAbrirPedido(d.pedido)}
                          title="Ver detalhes do pedido"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubpaginaEntregaveis;