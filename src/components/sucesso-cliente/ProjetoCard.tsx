import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Star, Eye, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pedido } from '@/types/formula';
import {
  ETAPAS, calcularEtapaInfo, getEtapasContratadas, getStatusGeral,
  STATUS_GERAL_LABEL, STATUS_GERAL_COLOR,
} from '@/lib/sucessoCliente';
import { cn } from '@/lib/utils';

interface Props {
  pedido: Pedido;
  onAbrir: () => void;
}

export default function ProjetoCard({ pedido, onAbrir }: Props) {
  const snap = (pedido.orcamento_snapshot as any) || {};
  const cliente = snap.dados_cliente?.nome_completo || snap.nome_cliente || '-';
  const consultor = snap.consultor_responsavel || '-';
  const dataPgto = snap.data_pagamento ? new Date(snap.data_pagamento) : null;

  const contratadas = getEtapasContratadas(pedido);
  const etapasInfo = ETAPAS.map((cfg) => calcularEtapaInfo(pedido, cfg.id, contratadas[cfg.id]));
  const statusGeral = getStatusGeral(etapasInfo);
  const ativas = etapasInfo.filter((e) => e.contratada);
  const concluidas = ativas.filter((e) => e.concluida).length;
  const atrasadas = ativas.filter((e) => e.atrasada);
  const nps = pedido.acompanhamento_processos?.satisfacao_nota;

  return (
    <Card className={cn(
      'transition-shadow hover:shadow-md',
      statusGeral === 'em_atraso' && 'border-destructive/40',
      statusGeral === 'concluido' && 'border-green-300',
    )}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{pedido.numero_pedido}</span>
              <span className="text-sm">·</span>
              <span className="text-sm font-medium truncate">{cliente}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Consultor: {consultor}
              {dataPgto && ` · Pagto: ${format(dataPgto, 'dd/MM/yyyy', { locale: ptBR })}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_GERAL_COLOR[statusGeral]}>
              {STATUS_GERAL_LABEL[statusGeral]}
            </Badge>
            {nps != null && (
              <Badge variant="outline" className="text-[10px]">
                <Star className="w-3 h-3 mr-0.5 text-yellow-500" />{nps}/10
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Progresso:</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                statusGeral === 'concluido' ? 'bg-green-500' :
                statusGeral === 'em_atraso' ? 'bg-destructive' : 'bg-primary',
              )}
              style={{ width: `${ativas.length ? (concluidas / ativas.length) * 100 : 0}%` }}
            />
          </div>
          <span className="font-medium">{concluidas}/{ativas.length}</span>
        </div>

        {atrasadas.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" />
            {atrasadas.length} etapa(s) em atraso: {atrasadas.map((e) => e.etapa.label).join(', ')}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {etapasInfo.filter((e) => e.contratada).map((e) => (
            <div key={e.etapa.id} className={cn(
              'flex items-center gap-1 text-[11px] px-2 py-1 rounded border',
              e.concluida ? 'bg-green-50 border-green-200 text-green-800' :
              e.atrasada ? 'bg-destructive/5 border-destructive/30 text-destructive' :
              'bg-yellow-50 border-yellow-200 text-yellow-800',
            )}>
              {e.concluida && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
              {e.atrasada && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
              <span className="truncate">{e.etapa.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end pt-1">
          <Button size="sm" variant="outline" onClick={onAbrir}>
            <Eye className="w-4 h-4 mr-1" /> Abrir detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}