import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { usePedidos } from '@/hooks/usePedidos';
import { Orcamento, DadosCliente, DetalhamentoFrete, DetalhamentoEnvio, CondicoesPagamento } from '@/types/orcamento';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Truck, PackageCheck, Search, ShoppingBag, AlertTriangle, Wallet, CheckCircle2, CalendarIcon, Beaker } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import CondicoesPagamentoForm, { validarCondicoesPagamento } from './CondicoesPagamentoForm';

interface AprovacaoOrcamentoDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AprovacaoOrcamentoDialog({ orcamento, onClose, onSuccess }: AprovacaoOrcamentoDialogProps) {
  const { updateDadosCliente, updateDetalhamentoFrete, updateOrcamento, updateStatus } = useOrcamentos();
  const { createPedidoFromOrcamento } = usePedidos();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);

  // Data de pagamento
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>(
    orcamento.data_pagamento ? new Date(orcamento.data_pagamento) : undefined
  );

  // Dados do cliente
  const [dadosCliente, setDadosCliente] = useState<DadosCliente>({
    nome_completo: '', email: '', telefone: '', cpf: '', cnpj: '',
    razao_social: '', endereco_cnpj: '', cep_cnpj: '', cidade: '', estado: '',
  });

  // Forma de venda
  const [formaVenda, setFormaVenda] = useState<string>('sem_informacao');

  // Frete
  const [freteLemonCaps, setFreteLemonCaps] = useState<boolean>(true);
  const [usaTabelaTradicional, setUsaTabelaTradicional] = useState<boolean>(true);
  const [detalhamentoEnvio, setDetalhamentoEnvio] = useState<DetalhamentoEnvio>({
    tipo: 'total_lemoncaps', descricao_parcial: '',
  });

  // Detalhes de produção por item
  const [detalhesProducao, setDetalhesProducao] = useState<Record<number, Record<string, string>>>({});

  const updateDetalhe = (idx: number, campo: string, valor: string) => {
    setDetalhesProducao(prev => ({
      ...prev,
      [idx]: { ...(prev[idx] || {}), [campo]: valor },
    }));
  };

  // Condições de pagamento
  const [condicoesPagamento, setCondicoesPagamento] = useState<CondicoesPagamento>(
    orcamento.condicoes_pagamento || {}
  );
  const [errosPagamento, setErrosPagamento] = useState<string[]>([]);

  useEffect(() => {
    if (orcamento.dados_cliente) {
      setDadosCliente(prev => ({ ...prev, ...orcamento.dados_cliente }));
      setFormaVenda(orcamento.dados_cliente.forma_venda || 'sem_informacao');
    }
    if (orcamento.detalhamento_frete) {
      setFreteLemonCaps(orcamento.detalhamento_frete.frete_lemon_caps ?? true);
      setUsaTabelaTradicional(orcamento.detalhamento_frete.usa_tabela_tradicional ?? true);
      if (orcamento.detalhamento_frete.detalhamento_envio) {
        setDetalhamentoEnvio(orcamento.detalhamento_frete.detalhamento_envio);
      }
    }
    if (orcamento.condicoes_pagamento) {
      setCondicoesPagamento(orcamento.condicoes_pagamento);
    }
  }, [orcamento]);

  const handleBuscarCnpj = async () => {
    const cnpj = dadosCliente.cnpj?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) return;
    setIsSearchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (response.ok) {
        const data = await response.json();
        setDadosCliente(prev => ({
          ...prev,
          razao_social: data.razao_social || '',
          endereco_cnpj: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(', ') || '',
          cep_cnpj: data.cep || '',
          cidade: data.municipio || '',
          estado: data.uf || '',
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleConfirmAprovacao = async () => {
    // Validar campos obrigatórios
    const camposFaltando: string[] = [];
    if (!dadosCliente.nome_completo?.trim()) camposFaltando.push('Nome Completo');
    if (!dadosCliente.email?.trim()) camposFaltando.push('Email');
    if (!dadosCliente.cpf?.trim()) camposFaltando.push('CPF');
    // CNPJ não é obrigatório
    if (!dadosCliente.telefone?.trim()) camposFaltando.push('Telefone (WhatsApp)');
    
    // Forma de venda "Sem informação" é permitida

    // Validar detalhes de produção por item
    orcamento.itens_producao.forEach((item, idx) => {
      const seg = (item.segmento || '').toLowerCase();
      const d = detalhesProducao[idx] || {};
      if (seg.includes('encapsulado')) {
        if (!d.cor_tampa) camposFaltando.push(`Cor da Tampa (${item.nome_produto})`);
        if (!d.cor_pote) camposFaltando.push(`Cor do Pote (${item.nome_produto})`);
      } else if (seg.includes('gummy')) {
        if (!d.cor_gummy) camposFaltando.push(`Cor da Gummy (${item.nome_produto})`);
        if (!d.sabor_gummy) camposFaltando.push(`Sabor da Gummy (${item.nome_produto})`);
      } else if (seg.includes('solúvel') || seg.includes('soluvel')) {
        if (!d.sabor_soluvel) camposFaltando.push(`Sabor Solúvel (${item.nome_produto})`);
        if (!d.cor_soluvel) camposFaltando.push(`Cor Solúvel (${item.nome_produto})`);
      } else if (seg.includes('líquido') || seg.includes('liquido')) {
        if (!d.sabor_liquido) camposFaltando.push(`Sabor (${item.nome_produto})`);
        if (!d.cor_liquido) camposFaltando.push(`Cor (${item.nome_produto})`);
      } else {
        // Segmento desconhecido — exigir observação
        if (!d.observacao_producao) camposFaltando.push(`Observação de Produção (${item.nome_produto})`);
      }
    });
    if (!dataPagamento) camposFaltando.push('Data de Pagamento');

    const erros = validarCondicoesPagamento(condicoesPagamento);
    if (erros.length > 0) {
      setErrosPagamento(erros);
      if (camposFaltando.length === 0) return;
    } else {
      setErrosPagamento([]);
    }

    if (camposFaltando.length > 0) {
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: 'Campos obrigatórios não preenchidos',
        description: camposFaltando.join(', '),
        variant: 'destructive',
      });
      return;
    }

    if (erros.length > 0) return;

    setIsSubmitting(true);

    try {
      const dadosClienteCompletos: DadosCliente = {
        ...dadosCliente,
        forma_venda: formaVenda as DadosCliente['forma_venda'],
      };

      const detalhamentoFrete: DetalhamentoFrete = {
        frete_lemon_caps: freteLemonCaps,
        usa_tabela_tradicional: usaTabelaTradicional,
        planos_customizados: orcamento.detalhamento_frete?.planos_customizados || [],
        detalhamento_envio: detalhamentoEnvio,
      };

      // Merge detalhes_producao into itens
      const itensComDetalhes = orcamento.itens_producao.map((item, idx) => ({
        ...item,
        detalhes_producao: detalhesProducao[idx] || undefined,
      }));

      // Save all data to orcamento
      await updateDadosCliente.mutateAsync({ id: orcamento.id, dados_cliente: dadosClienteCompletos });
      await updateDetalhamentoFrete.mutateAsync({ id: orcamento.id, detalhamento_frete: detalhamentoFrete });
      await updateOrcamento.mutateAsync({
        id: orcamento.id,
        updates: { condicoes_pagamento: condicoesPagamento, itens_producao: itensComDetalhes },
      });

      // Update status to approved
      await updateStatus.mutateAsync({
        id: orcamento.id,
        status: 'pago',
        data_pagamento: dataPagamento.toISOString(),
      });

      // Auto-create pedido from orcamento
      const orcamentoCompleto = {
        ...orcamento,
        itens_producao: itensComDetalhes,
        dados_cliente: dadosClienteCompletos,
        detalhamento_frete: detalhamentoFrete,
        condicoes_pagamento: condicoesPagamento,
        data_pagamento: dataPagamento.toISOString(),
      };

      await createPedidoFromOrcamento(orcamentoCompleto);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao aprovar orçamento:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Confirmar Pagamento — {orcamento.nome_cliente}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Preencha os dados da proposta comercial para aprovar o orçamento. Um pedido será criado automaticamente.
          </p>

          {/* 1. Informações do Cliente */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                1. Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome Completo <span className="text-destructive">*</span></Label>
                  <Input value={dadosCliente.nome_completo || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, nome_completo: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
                  <Input type="email" value={dadosCliente.email || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, email: e.target.value }))} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone (WhatsApp) <span className="text-destructive">*</span></Label>
                  <Input value={dadosCliente.telefone || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CPF <span className="text-destructive">*</span></Label>
                  <Input value={dadosCliente.cpf || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cpf: e.target.value }))} placeholder="000.000.000-00" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">CNPJ</Label>
                  <div className="flex gap-2">
                    <Input value={dadosCliente.cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" className="flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={handleBuscarCnpj} disabled={isSearchingCnpj || !dadosCliente.cnpj}>
                      {isSearchingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Inscrição Estadual</Label>
                  <Input value={dadosCliente.inscricao_estadual || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, inscricao_estadual: e.target.value }))} placeholder="Inscrição estadual" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Razão Social</Label>
                  <Input value={dadosCliente.razao_social || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, razao_social: e.target.value }))} placeholder="Razão social" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Endereço</Label>
                  <Input value={dadosCliente.endereco_cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, endereco_cnpj: e.target.value }))} placeholder="Rua, número, bairro" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={dadosCliente.cidade || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cidade: e.target.value }))} placeholder="Cidade" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Input value={dadosCliente.estado || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, estado: e.target.value }))} placeholder="UF" maxLength={2} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Detalhes do Produto */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Beaker className="w-4 h-4" />
                2. Detalhes do Produto <span className="text-xs text-destructive font-normal">(obrigatório)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {orcamento.itens_producao.map((item, idx) => {
                const seg = (item.segmento || '').toLowerCase();
                const isEncapsulado = seg.includes('encapsulado');
                const isGummy = seg.includes('gummy');
                const isSoluvel = seg.includes('solúvel') || seg.includes('soluvel');
                const d = detalhesProducao[idx] || {};

                const isLiquido = seg.includes('líquido') || seg.includes('liquido');
                const isOutro = !isEncapsulado && !isGummy && !isSoluvel && !isLiquido;

                return (
                  <div key={idx} className="bg-muted/50 rounded-lg p-3 space-y-3">
                    <div>
                      <p className="text-sm font-medium">{item.nome_produto}</p>
                      <p className="text-xs text-muted-foreground">Qtd: {item.quantidade} — {item.segmento}</p>
                      {item.dose_diaria_sugerida && (
                        <p className="text-xs text-muted-foreground">Dose diária: {item.dose_diaria_sugerida}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {isEncapsulado && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor da Tampa <span className="text-destructive">*</span></Label>
                            <Select value={d.cor_tampa || ''} onValueChange={(v) => updateDetalhe(idx, 'cor_tampa', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                              <SelectItem value="Preta">Preta</SelectItem>
                                <SelectItem value="Branca">Branca</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor do Pote <span className="text-destructive">*</span></Label>
                            <Select value={d.cor_pote || ''} onValueChange={(v) => updateDetalhe(idx, 'cor_pote', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Preto">Preto</SelectItem>
                                <SelectItem value="Transparente">Transparente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {isGummy && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor da Gummy <span className="text-destructive">*</span></Label>
                            <Select value={d.cor_gummy || ''} onValueChange={(v) => updateDetalhe(idx, 'cor_gummy', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Vermelho">Vermelho</SelectItem>
                                <SelectItem value="Roxo">Roxo</SelectItem>
                                <SelectItem value="Verde">Verde</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Sabor da Gummy <span className="text-destructive">*</span></Label>
                            <Select value={d.sabor_gummy || ''} onValueChange={(v) => updateDetalhe(idx, 'sabor_gummy', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Frutas vermelhas">Frutas vermelhas</SelectItem>
                                <SelectItem value="Morango">Morango</SelectItem>
                                <SelectItem value="Uva">Uva</SelectItem>
                                <SelectItem value="Limão">Limão</SelectItem>
                                <SelectItem value="Maçã verde">Maçã verde</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {isSoluvel && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Sabor <span className="text-destructive">*</span></Label>
                            <Select value={d.sabor_soluvel || ''} onValueChange={(v) => updateDetalhe(idx, 'sabor_soluvel', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Limão">Limão</SelectItem>
                                <SelectItem value="Frutas vermelhas">Frutas vermelhas</SelectItem>
                                <SelectItem value="Morango">Morango</SelectItem>
                                <SelectItem value="Uva">Uva</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor <span className="text-destructive">*</span></Label>
                            <Select value={d.cor_soluvel || ''} onValueChange={(v) => updateDetalhe(idx, 'cor_soluvel', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Verde">Verde</SelectItem>
                                <SelectItem value="Vermelho">Vermelho</SelectItem>
                                <SelectItem value="Roxo">Roxo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {isLiquido && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Sabor <span className="text-destructive">*</span></Label>
                            <Select value={d.sabor_liquido || ''} onValueChange={(v) => updateDetalhe(idx, 'sabor_liquido', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Limão">Limão</SelectItem>
                                <SelectItem value="Frutas vermelhas">Frutas vermelhas</SelectItem>
                                <SelectItem value="Morango">Morango</SelectItem>
                                <SelectItem value="Uva">Uva</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor <span className="text-destructive">*</span></Label>
                            <Select value={d.cor_liquido || ''} onValueChange={(v) => updateDetalhe(idx, 'cor_liquido', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Verde">Verde</SelectItem>
                                <SelectItem value="Vermelho">Vermelho</SelectItem>
                                <SelectItem value="Roxo">Roxo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {isOutro && (
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Observação de Produção <span className="text-destructive">*</span></Label>
                          <Textarea
                            value={d.observacao_producao || ''}
                            onChange={(e) => updateDetalhe(idx, 'observacao_producao', e.target.value)}
                            placeholder="Descreva os detalhes de produção para este produto..."
                            className="min-h-[60px]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 3. Forma de Venda */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                3. Forma de Venda do Cliente <span className="text-xs text-destructive font-normal">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={formaVenda} onValueChange={setFormaVenda} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="locais_fisicos" id="aprov-locais" />
                  <Label htmlFor="aprov-locais" className="font-normal cursor-pointer">Locais físicos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="venda_digital" id="aprov-digital" />
                  <Label htmlFor="aprov-digital" className="font-normal cursor-pointer">Venda digital</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ambas" id="aprov-ambas" />
                  <Label htmlFor="aprov-ambas" className="font-normal cursor-pointer">Ambas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sem_informacao" id="aprov-sem" />
                  <Label htmlFor="aprov-sem" className="font-normal cursor-pointer">Sem informação</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* 4. Detalhamento de Frete */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4" />
                4. Detalhamento de Frete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm flex items-center gap-2">
                  <PackageCheck className="w-4 h-4" />
                  Como será feita a logística?
                </Label>
                <RadioGroup
                  value={detalhamentoEnvio.tipo}
                  onValueChange={(value) => setDetalhamentoEnvio(prev => ({
                    ...prev,
                    tipo: value as DetalhamentoEnvio['tipo'],
                    descricao_parcial: value !== 'parcial' ? '' : prev.descricao_parcial,
                  }))}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total_produtor" id="aprov-produtor" />
                    <Label htmlFor="aprov-produtor" className="font-normal cursor-pointer text-sm">Todo envio para o Produtor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total_lemoncaps" id="aprov-lemoncaps" />
                    <Label htmlFor="aprov-lemoncaps" className="font-normal cursor-pointer text-sm">Toda logística via Lemon Caps</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="parcial" id="aprov-parcial" />
                    <Label htmlFor="aprov-parcial" className="font-normal cursor-pointer text-sm">Envio Parcial</Label>
                  </div>
                </RadioGroup>

                {detalhamentoEnvio.tipo === 'parcial' && (
                  <div className="ml-6 space-y-2">
                    <Label className="text-xs text-muted-foreground">Descreva a divisão:</Label>
                    <Textarea
                      value={detalhamentoEnvio.descricao_parcial || ''}
                      onChange={(e) => setDetalhamentoEnvio(prev => ({ ...prev, descricao_parcial: e.target.value }))}
                      placeholder="Ex: 50 potes para produtor, 100 potes logística Lemon Caps"
                      rows={2}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t">
                <Label className="text-sm">Frete via Lemon Caps para cliente final?</Label>
                <div className="flex gap-3">
                  <Button type="button" variant={freteLemonCaps ? 'default' : 'outline'} size="sm" onClick={() => setFreteLemonCaps(true)}>Sim</Button>
                  <Button type="button" variant={!freteLemonCaps ? 'default' : 'outline'} size="sm" onClick={() => setFreteLemonCaps(false)}>Não</Button>
                </div>
              </div>

              {freteLemonCaps && (
                <div className="space-y-3">
                  <Label className="text-sm">Usar tabela tradicional de envio?</Label>
                  <div className="flex gap-3">
                    <Button type="button" variant={usaTabelaTradicional ? 'default' : 'outline'} size="sm" onClick={() => setUsaTabelaTradicional(true)}>Sim</Button>
                    <Button type="button" variant={!usaTabelaTradicional ? 'default' : 'outline'} size="sm" onClick={() => setUsaTabelaTradicional(false)}>Não</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Condições de Pagamento */}
          <Card className={errosPagamento.length > 0 ? 'border-destructive' : ''}>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                5. Condições de Pagamento
                <span className="text-xs text-destructive font-normal">(obrigatório)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CondicoesPagamentoForm
                value={condicoesPagamento}
                onChange={(value) => { setCondicoesPagamento(value); setErrosPagamento([]); }}
                valorTotal={orcamento.valor_total}
                isRequired={true}
              />
              {errosPagamento.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {errosPagamento.map((erro, i) => (<li key={i}>{erro}</li>))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* 5. Data de Pagamento */}
          <Card className={!dataPagamento ? 'border-destructive' : 'border-green-500'}>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                6. Data do Pagamento do Cliente
                <span className="text-xs text-destructive font-normal">(obrigatório)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dataPagamento && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPagamento ? format(dataPagamento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dataPagamento}
                    onSelect={setDataPagamento}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirmAprovacao}
            disabled={!dataPagamento || isSubmitting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aprovando...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar Aprovação</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
