import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Star, Save, Copy, MessageCircle, Plus, Trash2, Package, StickyNote, Sparkles, Truck, Calendar as CalendarIcon, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Pedido, AcompanhamentoProcessos } from '@/types/formula';
import {
  ETAPAS, EtapaId, calcularEtapaInfo, getEtapasContratadas,
  aplicarStatusEtapa, aplicarPrazoEtapa, aplicarObservacaoEtapa,
  aplicarProdutosCS, aplicarObservacaoGeralCS, aplicarNomeMarcaCS,
  extrairItensPedido, formatarEspecificacaoItem,
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
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>(
    pedido?.acompanhamento_processos?.produtos_cs ?? []
  );
  const [obsGeral, setObsGeral] = useState<string>(
    pedido?.acompanhamento_processos?.observacao_geral_cs ?? ''
  );
  const [nomeMarca, setNomeMarca] = useState<string>(
    pedido?.acompanhamento_processos?.nome_marca_cs ?? ''
  );

  // Sync local state when switching pedido
  useEffect(() => {
    setProdutos(pedido?.acompanhamento_processos?.produtos_cs ?? []);
    setObsGeral(pedido?.acompanhamento_processos?.observacao_geral_cs ?? '');
    setNota(pedido?.acompanhamento_processos?.satisfacao_nota ?? 8);
    setObsSat(pedido?.acompanhamento_processos?.satisfacao_observacoes ?? '');
    setNomeMarca(pedido?.acompanhamento_processos?.nome_marca_cs ?? '');
  }, [pedido?.id]);

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

  const itensPedido = extrairItensPedido(pedido);
  const prazoEntrega = pedido.data_entrega ? new Date(pedido.data_entrega) : null;
  const dataPgto = snap.data_pagamento ? new Date(snap.data_pagamento) : null;

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

  const adicionarProduto = () => {
    setProdutos((prev) => [...prev, { id: crypto.randomUUID(), nome: '' }]);
  };
  const atualizarProduto = (id: string, nome: string) => {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, nome } : p)));
  };
  const removerProduto = (id: string) => {
    setProdutos((prev) => prev.filter((p) => p.id !== id));
  };
  const salvarProdutosObs = () => {
    const limpos = produtos.map((p) => ({ ...p, nome: p.nome.trim() })).filter((p) => p.nome.length > 0);
    let novo = aplicarProdutosCS(pedido.acompanhamento_processos, limpos);
    novo = aplicarObservacaoGeralCS(novo, obsGeral.trim());
    novo = aplicarNomeMarcaCS(novo, nomeMarca.trim());
    onUpdate(pedido.id, novo);
    setProdutos(limpos);
    toast.success('Informações do cliente salvas');
  };

  const copiarResumoCS = () => {
    const itensTxt = itensPedido.map((it) => {
      const espec = formatarEspecificacaoItem(it);
      return `  - ${it.nome_produto} (qtd: ${it.quantidade})${espec ? ' — ' + espec : ''}`;
    });
    const linhas = [
      `📋 Sucesso do Cliente — ${pedido.numero_pedido}`,
      `Cliente: ${cliente}`,
      nomeMarca.trim() ? `Marca: ${nomeMarca.trim()}` : '',
      `Consultor: ${consultor}`,
      `Status geral: ${STATUS_GERAL_LABEL[statusGeral]}`,
      dataPgto ? `Pagamento: ${format(dataPgto, 'dd/MM/yyyy')}` : '',
      prazoEntrega ? `Prazo de entrega: ${format(prazoEntrega, 'dd/MM/yyyy')}` : '',
      `Valor: ${formatCurrency(valor)}`,
      itensTxt.length ? `Produtos contratados:\n${itensTxt.join('\n')}` : '',
      produtos.filter((p) => p.nome.trim()).length
        ? `Apelidos: ${produtos.filter((p) => p.nome.trim()).map((p) => p.nome).join(', ')}`
        : '',
      obsGeral.trim() ? `Observação CS: ${obsGeral.trim()}` : '',
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

          {/* Resumo destacado para o CS */}
          <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold uppercase tracking-wide text-primary">Resumo para o Sucesso do Cliente</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[11px] uppercase text-muted-foreground font-medium">Cliente</div>
                <div className="font-semibold">{cliente}</div>
                {dadosCliente.razao_social && (
                  <div className="text-xs text-muted-foreground">{dadosCliente.razao_social}</div>
                )}
              </div>
              <div>
                <label className="text-[11px] uppercase text-muted-foreground font-medium block mb-1">Nome da marca</label>
                <Input
                  value={nomeMarca}
                  onChange={(e) => setNomeMarca(e.target.value)}
                  placeholder="Ex: Lemon Caps"
                  className="h-8 text-sm font-semibold"
                />
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground font-medium flex items-center gap-1"><User className="w-3 h-3" /> Consultor</div>
                <div className="font-medium">{consultor}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground font-medium flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Data de pagamento</div>
                <div className="font-medium">{dataPgto ? format(dataPgto, 'dd/MM/yyyy', { locale: ptBR }) : '—'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground font-medium flex items-center gap-1"><Truck className="w-3 h-3" /> Prazo de entrega</div>
                <div className="font-medium">{prazoEntrega ? format(prazoEntrega, 'dd/MM/yyyy', { locale: ptBR }) : '—'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground font-medium">Valor total</div>
                <div className="font-medium">{formatCurrency(valor)}</div>
              </div>
            </div>

            {/* Itens reais do pedido */}
            {itensPedido.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] uppercase text-muted-foreground font-medium flex items-center gap-1">
                  <Package className="w-3 h-3" /> Produtos contratados ({itensPedido.length})
                </div>
                <div className="space-y-1.5">
                  {itensPedido.map((it, idx) => {
                    const espec = formatarEspecificacaoItem(it);
                    return (
                      <div key={idx} className="p-2 rounded bg-background border text-xs">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="font-semibold">{it.nome_produto}</div>
                          <Badge variant="secondary" className="text-[10px]">Qtd: {it.quantidade}</Badge>
                        </div>
                        {espec && <div className="text-muted-foreground mt-0.5">{espec}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Produtos e Observação geral do CS */}
          <div className="p-3 rounded-lg border bg-card space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Apelidos comerciais e Observações do CS</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Apelidos / nomes comerciais (opcional)
              </label>
              {produtos.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum produto cadastrado. Adicione o nome comercial do(s) produto(s).
                </p>
              )}
              {produtos.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Input
                    value={p.nome}
                    onChange={(e) => atualizarProduto(p.id, e.target.value)}
                    placeholder="Ex: Whey Lemon"
                    className="h-9 text-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 flex-shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removerProduto(p.id)}
                    aria-label="Remover produto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={adicionarProduto}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar produto
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <StickyNote className="w-3.5 h-3.5" /> Observação geral do CS
              </label>
              <Textarea
                value={obsGeral}
                onChange={(e) => setObsGeral(e.target.value)}
                placeholder="Anotações livres da equipe de Sucesso do Cliente sobre este pedido..."
                className="min-h-[80px] text-sm"
              />
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={salvarProdutosObs}>
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
            </div>
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