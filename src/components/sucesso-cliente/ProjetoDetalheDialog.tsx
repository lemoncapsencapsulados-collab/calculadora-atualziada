import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Star, Save, Copy, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Pedido, AcompanhamentoProcessos } from '@/types/formula';
import {
  ETAPAS, EtapaId, calcularEtapaInfo, getEtapasContratadas,
  aplicarStatusEtapa, aplicarPrazoEtapa, aplicarObservacaoEtapa,
  getStatusGeral, STATUS_GERAL_LABEL, STATUS_GERAL_COLOR,
} from '@/lib/sucessoCliente';
import EtapaRow from './EtapaRow';
import { formatCurrency } from '@/lib/unitConversion';
import { buildWhatsappUrl, isTelefoneValido } from '@/lib/whatsapp';

interface Props {
  pedido: Pedido | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (pedidoId: string, acomp: AcompanhamentoProcessos) => void;
}

export default function ProjetoDetalheDialog({ pedido, open, onClose, onUpdate }: Props) {
  const [nota, setNota] = useState<number>(pedido?.acompanhamento_processos?.satisfacao_nota ?? 8);
  const [obsSat, setObsSat] = useState<string>(pedido?.acompanhamento_processos?.satisfacao_observacoes ?? '');

  const etapasInfo = useMemo(() => {
    if (!pedido) return [];
    const contratadas = getEtapasContratadas(pedido);
    return ETAPAS.map((cfg) => calcularEtapaInfo(pedido, cfg.id, contratadas[cfg.id]));
  }, [pedido]);

  if (!pedido) return null;
  const snap = (pedido.orcamento_snapshot as any) || {};
  const dadosCliente = snap.dados_cliente || {};
  const cliente = dadosCliente.nome_completo || snap.nome_cliente || '-';
  const consultor = snap.consultor_responsavel || '-';
  const valor = Number(snap.valor_total) || 0;
  const statusGeral = getStatusGeral(etapasInfo);
  const ativas = etapasInfo.filter((e) => e.contratada);
  const concluidas = ativas.filter((e) => e.concluida).length;
  const todasConcluidas = ativas.length > 0 && concluidas === ativas.length;

  const handleStatus = (etapa: EtapaId, status: string) => {
    const novo = aplicarStatusEtapa(pedido.acompanhamento_processos, etapa, status);
    onUpdate(pedido.id, novo);
  };
  const handlePrazo = (etapa: EtapaId, dataISO?: string) => {
    const novo = aplicarPrazoEtapa(pedido.acompanhamento_processos, etapa, dataISO);
    onUpdate(pedido.id, novo);
  };
  const handleObs = (etapa: EtapaId, texto: string) => {
    const novo = aplicarObservacaoEtapa(pedido.acompanhamento_processos, etapa, texto);
    onUpdate(pedido.id, novo);
  };
  const handleSatisfacao = () => {
    const base = pedido.acompanhamento_processos || ({} as any);
    onUpdate(pedido.id, { ...base, satisfacao_nota: nota, satisfacao_observacoes: obsSat });
    toast.success('Avaliação salva');
  };

  const copiarResumoCS = () => {
    const linhas = [
      `📋 Sucesso do Cliente — ${pedido.numero_pedido}`,
      `Cliente: ${cliente}`,
      `Consultor: ${consultor}`,
      `Status geral: ${STATUS_GERAL_LABEL[statusGeral]}`,
      snap.data_pagamento ? `Pagamento: ${format(new Date(snap.data_pagamento), 'dd/MM/yyyy')}` : '',
      `Valor: ${formatCurrency(valor)}`,
      '',
      ...etapasInfo.filter((e) => e.contratada).map((e) => {
        const prazo = e.concluida && e.dataConclusao
          ? `concluído em ${format(e.dataConclusao, 'dd/MM/yyyy')}`
          : e.prazoPrevisto
            ? `prazo ${format(e.prazoPrevisto, 'dd/MM/yyyy')} (${e.diasRestantes}d)`
            : '';
        return `• ${e.etapa.label} (${e.etapa.responsavel}): ${e.statusLabel}${prazo ? ' — ' + prazo : ''}`;
      }),
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(linhas).then(() => toast.success('Resumo copiado'));
  };

  const telefone = dadosCliente.telefone;
  const whatsappUrl = isTelefoneValido(telefone)
    ? buildWhatsappUrl(telefone, `Olá ${cliente}, atualização do seu projeto ${pedido.numero_pedido}.`)
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {pedido.numero_pedido} · {cliente}
            <Badge className={STATUS_GERAL_COLOR[statusGeral]}>{STATUS_GERAL_LABEL[statusGeral]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Header info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs p-3 rounded-md bg-muted/50">
            <div><span className="text-muted-foreground">Consultor:</span> <strong>{consultor}</strong></div>
            <div><span className="text-muted-foreground">Data Pedido:</span> <strong>{format(pedido.data_pedido, 'dd/MM/yyyy')}</strong></div>
            <div><span className="text-muted-foreground">Pagamento:</span> <strong>{snap.data_pagamento ? format(new Date(snap.data_pagamento), 'dd/MM/yyyy') : '-'}</strong></div>
            <div><span className="text-muted-foreground">Valor:</span> <strong>{formatCurrency(valor)}</strong></div>
            <div className="col-span-2"><span className="text-muted-foreground">E-mail:</span> {dadosCliente.email || '-'}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Telefone:</span> {telefone || '-'}</div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copiarResumoCS}>
              <Copy className="w-4 h-4 mr-1" /> Copiar resumo
            </Button>
            {whatsappUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                </a>
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {concluidas}/{ativas.length} etapas concluídas
            </span>
          </div>

          {/* Etapas */}
          <div className="space-y-2">
            {etapasInfo.map((info) => (
              <EtapaRow
                key={info.etapa.id}
                info={info}
                onChangeStatus={handleStatus}
                onChangePrazo={handlePrazo}
                onChangeObs={handleObs}
                showObs
              />
            ))}
          </div>

          {/* Satisfação */}
          {todasConcluidas && (
            <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-semibold">Avaliação de Satisfação (NPS)</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Nota:</span>
                  <span className="text-lg font-bold text-primary">{nota}</span>
                </div>
                <Slider value={[nota]} onValueChange={([v]) => setNota(v)} min={0} max={10} step={1} />
              </div>
              <Textarea value={obsSat} onChange={(e) => setObsSat(e.target.value)}
                placeholder="Comentários do cliente..." className="min-h-[60px] text-sm" />
              <Button size="sm" onClick={handleSatisfacao} className="w-full">
                <Save className="h-4 w-4 mr-1" /> Salvar Avaliação
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}