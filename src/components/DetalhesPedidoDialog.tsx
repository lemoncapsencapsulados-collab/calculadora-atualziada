import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User, Package, Layers, Wallet, Truck, Calendar, FileText, Info, History,
} from 'lucide-react';
import { formatarCondicoesPagamento } from '@/lib/formatarPagamento';
import HistoricoPagamentoLista from '@/components/pedidos/HistoricoPagamentoLista';

interface DetalhesPedidoDialogProps {
  pedido: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </h3>
    {children}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
};

const DetalhesPedidoDialog = ({ pedido, open, onOpenChange }: DetalhesPedidoDialogProps) => {
  if (!pedido) return null;

  const isOrcamento = !!pedido.orcamento_snapshot;
  const snap = pedido.orcamento_snapshot;
  const formulaSnap = pedido.formula_snapshot;

  const dadosCliente = snap?.dados_cliente || {};
  const itens = snap?.itens_producao || [];
  const servicos = snap?.servicos_marca || [];
  const condicoes = snap?.condicoes_pagamento || {};
  const frete = snap?.detalhamento_frete || {};

  const formaVendaLabel = (v: string) => {
    if (v === 'locais_fisicos') return 'Locais Físicos';
    if (v === 'venda_digital') return 'Digital';
    if (v === 'ambas') return 'Ambas';
    return v;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes do Pedido {pedido.numero_pedido}
          </DialogTitle>
          <DialogDescription>Informações completas do pedido</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Informações Gerais */}
          <Section icon={Info} title="Informações Gerais">
            <div className="space-y-1 bg-muted/50 rounded-lg p-3">
              <InfoRow label="Número" value={pedido.numero_pedido} />
              <InfoRow label="Data do Pedido" value={format(new Date(pedido.data_pedido), "dd/MM/yyyy", { locale: ptBR })} />
              <InfoRow label="Status" value={
                pedido.status === 'aguardando_producao' ? 'Aguardando Produção' :
                pedido.status === 'no_estoque' ? 'No Estoque' :
                pedido.status === 'enviado' ? 'Enviado' : 'Concluído'
              } />
              {isOrcamento && (
                <>
                  <InfoRow label="Orçamento" value={snap.numero_orcamento} />
                  <InfoRow label="Consultor" value={snap.consultor_responsavel} />
                  <div className="flex gap-2 pt-1">
                    <Badge variant="outline" className={
                      snap.tipo_orcamento === 'recompra'
                        ? 'border-orange-500 text-orange-700'
                        : 'border-blue-500 text-blue-700'
                    }>
                      {snap.tipo_orcamento === 'recompra' ? 'Recompra' : 'Novo Produtor'}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </Section>

          <Separator />

          {/* Dados do Cliente */}
          <Section icon={User} title="Dados do Cliente">
            <div className="space-y-1 bg-muted/50 rounded-lg p-3">
              {isOrcamento ? (
                <>
                  <InfoRow label="Nome" value={dadosCliente.nome_completo || snap.nome_cliente} />
                  <InfoRow label="Email" value={dadosCliente.email} />
                  <InfoRow label="Telefone" value={dadosCliente.telefone} />
                  <InfoRow label="CNPJ" value={dadosCliente.cnpj} />
                  <InfoRow label="Inscrição Estadual" value={dadosCliente.inscricao_estadual} />
                  <InfoRow label="Razão Social" value={dadosCliente.razao_social} />
                  {dadosCliente.cidade && (
                    <InfoRow label="Cidade/Estado" value={`${dadosCliente.cidade}/${dadosCliente.estado || ''}`} />
                  )}
                  {dadosCliente.forma_venda && dadosCliente.forma_venda !== 'sem_informacao' && (
                    <InfoRow label="Forma de Venda" value={formaVendaLabel(dadosCliente.forma_venda)} />
                  )}
                </>
              ) : (
                <>
                  <InfoRow label="Cliente" value={formulaSnap?.cliente} />
                  <InfoRow label="Fórmula" value={formulaSnap?.nome_formula} />
                </>
              )}
            </div>
          </Section>

          <Separator />

          {/* Produtos / Fórmulas */}
          <Section icon={Package} title={isOrcamento ? 'Produtos' : 'Fórmula'}>
            {isOrcamento && itens.length > 0 ? (
              <div className="space-y-3">
                {itens.map((item: any, idx: number) => (
                  <div key={idx} className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{item.nome_produto}</p>
                        <p className="text-xs text-muted-foreground">{item.segmento}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {item.modelo_negocio === 'print_on_demand' ? 'POD' : 'Estoque'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <InfoRow label="Quantidade" value={item.modelo_negocio === 'print_on_demand' ? 'POD' : item.quantidade} />
                      <InfoRow label="Preço Unit." value={formatCurrency(item.preco_unitario)} />
                      <InfoRow label="Subtotal" value={formatCurrency(item.subtotal)} />
                      {item.dose_diaria_sugerida && (
                        <InfoRow label="Dose Diária" value={item.dose_diaria_sugerida} />
                      )}
                      {item.quantidade_por_pote && (
                        <InfoRow label="Qtd por Pote" value={`${item.quantidade_por_pote} ${item.unidade_por_pote || ''}`} />
                      )}
                    </div>
                    {item.detalhes_producao && (
                      <div className="pt-1 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Detalhes de Produção</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.detalhes_producao.cor_tampa && (
                            <Badge variant="secondary" className="text-xs">Tampa: {item.detalhes_producao.cor_tampa}</Badge>
                          )}
                          {item.detalhes_producao.cor_pote && (
                            <Badge variant="secondary" className="text-xs">Pote: {item.detalhes_producao.cor_pote}</Badge>
                          )}
                          {item.detalhes_producao.cor_gummy && (
                            <Badge variant="secondary" className="text-xs">Cor Gummy: {item.detalhes_producao.cor_gummy}</Badge>
                          )}
                          {item.detalhes_producao.sabor_gummy && (
                            <Badge variant="secondary" className="text-xs">Sabor: {item.detalhes_producao.sabor_gummy}</Badge>
                          )}
                          {item.detalhes_producao.sabor_soluvel && (
                            <Badge variant="secondary" className="text-xs">Sabor: {item.detalhes_producao.sabor_soluvel}</Badge>
                          )}
                          {item.detalhes_producao.cor_soluvel && (
                            <Badge variant="secondary" className="text-xs">Cor: {item.detalhes_producao.cor_soluvel}</Badge>
                          )}
                          {item.detalhes_producao.sabor_liquido && (
                            <Badge variant="secondary" className="text-xs">Sabor: {item.detalhes_producao.sabor_liquido}</Badge>
                          )}
                          {item.detalhes_producao.cor_liquido && (
                            <Badge variant="secondary" className="text-xs">Cor: {item.detalhes_producao.cor_liquido}</Badge>
                          )}
                          {item.detalhes_producao.observacao_producao && (
                            <Badge variant="secondary" className="text-xs">Obs: {item.detalhes_producao.observacao_producao}</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Insumos da fórmula */}
                    {item.insumos_formula && item.insumos_formula.length > 0 && (
                      <div className="pt-1 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Fórmula / Insumos</p>
                        <div className="bg-background rounded p-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b">
                                <th className="text-left py-1">Insumo</th>
                                <th className="text-right py-1">Quantidade</th>
                                <th className="text-right py-1">Unidade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.insumos_formula.map((ins: any, insIdx: number) => (
                                <tr key={insIdx} className="border-b border-border/30">
                                  <td className="py-1">{ins.nome || ins.nome_insumo || '-'}</td>
                                  <td className="text-right py-1">{ins.quantidade ?? ins.qtd ?? '-'}</td>
                                  <td className="text-right py-1">{ins.unidade || ins.unidade_medida || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : !isOrcamento && formulaSnap ? (
              <div className="space-y-1 bg-muted/50 rounded-lg p-3">
                <InfoRow label="Tipo" value={formulaSnap.tipo_produto} />
                <InfoRow label="Qtd por Pote" value={formulaSnap.quantidade_por_pote || formulaSnap.qtd_capsulas} />
                <InfoRow label="Quantidade Pedido" value={`${pedido.quantidade_produto} ${pedido.unidade_produto}`} />
                <InfoRow label="Custo MP" value={formatCurrency(formulaSnap.total_mp)} />
                <InfoRow label="Custo Embalagem" value={formatCurrency(formulaSnap.total_embalagem)} />
                <InfoRow label="Custo Total" value={formatCurrency(formulaSnap.custo_total)} />
                <InfoRow label="Entrega" value={format(new Date(pedido.data_entrega), "dd/MM/yyyy", { locale: ptBR })} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados disponíveis</p>
            )}
          </Section>

          {/* Serviços de Marca */}
          {isOrcamento && servicos.length > 0 && (
            <>
              <Separator />
              <Section icon={Layers} title="Serviços de Marca">
                <div className="space-y-2">
                  {servicos.map((s: any, idx: number) => (
                    <div key={idx} className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{s.nome_plano}</span>
                        <span className="font-semibold text-sm text-primary">{formatCurrency(s.valor)}</span>
                      </div>
                      {s.descricao && <p className="text-xs text-muted-foreground">{s.descricao}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* Condições de Pagamento */}
          {isOrcamento && (condicoes.metodo_principal || condicoes.valor_entrada || condicoes.valor_termino) && (
            <>
              <Separator />
              <Section icon={Wallet} title="Condições de Pagamento">
                <div className="space-y-1 bg-muted/50 rounded-lg p-3">
                  {formatarCondicoesPagamento(condicoes, snap.valor_total).map((line, i) => (
                    <p key={i} className="text-sm text-foreground whitespace-pre-wrap">{line}</p>
                  ))}
                  {snap.data_pagamento && (
                    <InfoRow label="Data Pagamento" value={format(new Date(snap.data_pagamento), "dd/MM/yyyy", { locale: ptBR })} />
                  )}
                </div>
              </Section>
            </>
          )}

          {/* Histórico de alterações de pagamento */}
          {(pedido.pagamento_alteracoes?.length ?? 0) > 0 && (
            <>
              <Separator />
              <Section icon={History} title={`Histórico de alterações de pagamento (${pedido.pagamento_alteracoes.length})`}>
                <HistoricoPagamentoLista alteracoes={pedido.pagamento_alteracoes} />
              </Section>
            </>
          )}

          {/* Logística / Frete */}
          {isOrcamento && frete.detalhamento_envio && (
            <>
              <Separator />
              <Section icon={Truck} title="Logística / Frete">
                <div className="space-y-1 bg-muted/50 rounded-lg p-3">
                  <InfoRow label="Tipo de Envio" value={
                    frete.detalhamento_envio.tipo === 'total_produtor' ? 'Todo para o Produtor' :
                    frete.detalhamento_envio.tipo === 'total_lemoncaps' ? 'Via Lemon Caps' : 'Parcial'
                  } />
                  <InfoRow label="Descrição" value={frete.detalhamento_envio.descricao_parcial} />
                  <InfoRow label="Frete Lemon Caps" value={frete.frete_lemon_caps ? 'Sim' : 'Não'} />
                  <InfoRow label="Detalhes" value={frete.detalhamento_envio.detalhes_adicionais} />
                </div>
              </Section>
            </>
          )}

          {/* Observações */}
          {pedido.observacoes && (
            <>
              <Separator />
              <Section icon={Info} title="Observações">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 whitespace-pre-line">{pedido.observacoes}</p>
                </div>
              </Section>
            </>
          )}

          {/* Totais */}
          {isOrcamento && (
            <>
              <Separator />
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal Produção</span>
                  <span className="font-medium">{formatCurrency(snap.subtotal_producao)}</span>
                </div>
                {snap.subtotal_servicos > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal Serviços</span>
                    <span className="font-medium">{formatCurrency(snap.subtotal_servicos)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Valor Total</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(snap.valor_total)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DetalhesPedidoDialog;
