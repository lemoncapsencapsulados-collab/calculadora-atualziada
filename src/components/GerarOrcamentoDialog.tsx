import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { Orcamento, ItemProducao, ServicoMarca, OrcamentoInsert } from '@/types/orcamento';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Package, 
  Palette,
  Check,
  X,
  UserCircle
} from 'lucide-react';

interface GerarOrcamentoDialogProps {
  orcamentoExistente?: Orcamento | null;
  onClose: () => void;
}

export default function GerarOrcamentoDialog({ 
  orcamentoExistente, 
  onClose 
}: GerarOrcamentoDialogProps) {
  const { createOrcamento, updateOrcamento, getNextNumeroOrcamento } = useOrcamentos();
  const { precificacoes } = usePrecificacao();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Informações básicas
  const [nomeCliente, setNomeCliente] = useState('');
  const [consultorResponsavel, setConsultorResponsavel] = useState('');
  const [validadeDias, setValidadeDias] = useState(30);
  const [observacoes, setObservacoes] = useState('');
  
  // Step 2: Itens de produção
  const [itensProducao, setItensProducao] = useState<ItemProducao[]>([]);
  const [showPrecificacaoSelector, setShowPrecificacaoSelector] = useState(false);
  const [selectedPrecificacoes, setSelectedPrecificacoes] = useState<string[]>([]);
  const [showProdutoAvulso, setShowProdutoAvulso] = useState(false);
  const [produtoAvulso, setProdutoAvulso] = useState({ nome: '', segmento: '', preco: 0, quantidade: 1 });
  
  // Step 3: Serviços de marca
  const [servicosMarca, setServicosMarca] = useState<ServicoMarca[]>([]);
  const [novoServico, setNovoServico] = useState({ nome: '', descricao: '', valor: 0 });
  const [showServicoForm, setShowServicoForm] = useState(false);

  // Carregar dados se editando
  useEffect(() => {
    if (orcamentoExistente) {
      setNomeCliente(orcamentoExistente.nome_cliente);
      setConsultorResponsavel(orcamentoExistente.consultor_responsavel || '');
      setValidadeDias(orcamentoExistente.validade_dias);
      setObservacoes(orcamentoExistente.observacoes || '');
      setItensProducao(orcamentoExistente.itens_producao || []);
      setServicosMarca(orcamentoExistente.servicos_marca || []);
    }
  }, [orcamentoExistente]);

  // Cálculos
  const subtotalProducao = itensProducao.reduce((acc, item) => acc + item.subtotal, 0);
  const subtotalServicos = servicosMarca.reduce((acc, s) => acc + s.valor, 0);
  const valorTotal = subtotalProducao + subtotalServicos;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Handlers
  const handleAddPrecificacoes = () => {
    const novasItems: ItemProducao[] = selectedPrecificacoes.map(precId => {
      const prec = (precificacoes as any[])?.find(p => p.id === precId);
      return {
        tipo: 'precificacao' as const,
        precificacao_id: precId,
        nome_produto: prec?.formulas?.nome_formula || 'Produto',
        segmento: prec?.formulas?.tipo_produto || '',
        preco_unitario: Number(prec?.preco_venda) || 0,
        quantidade: 1,
        subtotal: Number(prec?.preco_venda) || 0,
      };
    });
    
    setItensProducao(prev => [...prev, ...novasItems]);
    setSelectedPrecificacoes([]);
    setShowPrecificacaoSelector(false);
  };

  const handleAddProdutoAvulso = () => {
    if (!produtoAvulso.nome || produtoAvulso.preco <= 0) return;
    
    const novoItem: ItemProducao = {
      tipo: 'avulso',
      nome_produto: produtoAvulso.nome,
      segmento: produtoAvulso.segmento || 'Avulso',
      preco_unitario: produtoAvulso.preco,
      quantidade: produtoAvulso.quantidade,
      subtotal: produtoAvulso.preco * produtoAvulso.quantidade,
    };
    
    setItensProducao(prev => [...prev, novoItem]);
    setProdutoAvulso({ nome: '', segmento: '', preco: 0, quantidade: 1 });
    setShowProdutoAvulso(false);
  };

  const handleUpdateItemQuantidade = (index: number, quantidade: number) => {
    setItensProducao(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          quantidade,
          subtotal: item.preco_unitario * quantidade,
        };
      }
      return item;
    }));
  };

  const handleRemoveItem = (index: number) => {
    setItensProducao(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddServico = () => {
    if (!novoServico.nome || novoServico.valor <= 0) return;
    
    setServicosMarca(prev => [...prev, {
      nome_plano: novoServico.nome,
      descricao: novoServico.descricao,
      valor: novoServico.valor,
    }]);
    
    setNovoServico({ nome: '', descricao: '', valor: 0 });
    setShowServicoForm(false);
  };

  const handleRemoveServico = (index: number) => {
    setServicosMarca(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!nomeCliente.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      if (orcamentoExistente) {
        await updateOrcamento.mutateAsync({
          id: orcamentoExistente.id,
          updates: {
            nome_cliente: nomeCliente,
            consultor_responsavel: consultorResponsavel,
            validade_dias: validadeDias,
            observacoes,
            itens_producao: itensProducao,
            servicos_marca: servicosMarca,
            subtotal_producao: subtotalProducao,
            subtotal_servicos: subtotalServicos,
            valor_total: valorTotal,
          },
        });
      } else {
        const numeroOrcamento = await getNextNumeroOrcamento();
        const novoOrcamento: OrcamentoInsert = {
          numero_orcamento: numeroOrcamento,
          nome_cliente: nomeCliente,
          consultor_responsavel: consultorResponsavel,
          validade_dias: validadeDias,
          observacoes,
          itens_producao: itensProducao,
          servicos_marca: servicosMarca,
          subtotal_producao: subtotalProducao,
          subtotal_servicos: subtotalServicos,
          valor_total: valorTotal,
          status: 'rascunho',
        };
        
        await createOrcamento.mutateAsync(novoOrcamento);
      }
      
      onClose();
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoNext = () => {
    if (step === 1) return nomeCliente.trim().length > 0 && consultorResponsavel.trim().length > 0;
    return true;
  };

  // Precificações disponíveis (não já adicionadas)
  const precificacoesDisponiveis = (precificacoes as any[])?.filter(p => 
    !itensProducao.some(item => item.precificacao_id === p.id)
  ) || [];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {orcamentoExistente ? 'Editar Orçamento' : 'Gerar Orçamento'} - Passo {step} de 4
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* STEP 1: Informações Básicas */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="consultor" className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4" />
                  Consultor Responsável *
                </Label>
                <Input
                  id="consultor"
                  value={consultorResponsavel}
                  onChange={(e) => setConsultorResponsavel(e.target.value)}
                  placeholder="Nome do consultor responsável"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente">Nome do Cliente *</Label>
                <Input
                  id="cliente"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Ex: Farmácia ABC"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="validade">Validade (dias)</Label>
                <Input
                  id="validade"
                  type="number"
                  min={1}
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(parseInt(e.target.value) || 30)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="obs">Observações</Label>
                <Textarea
                  id="obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Condições de pagamento, detalhes adicionais..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Itens de Produção */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Custos de Produção
                </h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowPrecificacaoSelector(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Precificação Salva
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowProdutoAvulso(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Produto Avulso
                  </Button>
                </div>
              </div>

              {/* Seletor de Precificações */}
              {showPrecificacaoSelector && (
                <Card className="border-primary">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Selecionar Precificações</Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowPrecificacaoSelector(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {precificacoesDisponiveis.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma precificação disponível.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {precificacoesDisponiveis.map((prec: any) => (
                          <label 
                            key={prec.id}
                            className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedPrecificacoes.includes(prec.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPrecificacoes(prev => [...prev, prec.id]);
                                } else {
                                  setSelectedPrecificacoes(prev => prev.filter(id => id !== prec.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{prec.formulas?.nome_formula}</p>
                              <p className="text-xs text-muted-foreground">{prec.formulas?.cliente}</p>
                            </div>
                            <Badge variant="secondary">{prec.formulas?.tipo_produto}</Badge>
                            <span className="font-semibold">{formatCurrency(Number(prec.preco_venda))}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {selectedPrecificacoes.length > 0 && (
                      <Button onClick={handleAddPrecificacoes} className="w-full">
                        <Check className="w-4 h-4 mr-2" />
                        Adicionar {selectedPrecificacoes.length} item(ns)
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Form Produto Avulso */}
              {showProdutoAvulso && (
                <Card className="border-primary">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Adicionar Produto Avulso</Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowProdutoAvulso(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome do Produto</Label>
                        <Input
                          value={produtoAvulso.nome}
                          onChange={(e) => setProdutoAvulso(prev => ({ ...prev, nome: e.target.value }))}
                          placeholder="Nome do produto"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Segmento</Label>
                        <Input
                          value={produtoAvulso.segmento}
                          onChange={(e) => setProdutoAvulso(prev => ({ ...prev, segmento: e.target.value }))}
                          placeholder="Ex: Gummy, Encapsulados..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Preço Unitário (R$)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={produtoAvulso.preco || ''}
                          onChange={(e) => setProdutoAvulso(prev => ({ ...prev, preco: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantidade</Label>
                        <Input
                          type="number"
                          min={1}
                          value={produtoAvulso.quantidade}
                          onChange={(e) => setProdutoAvulso(prev => ({ ...prev, quantidade: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleAddProdutoAvulso} 
                      className="w-full"
                      disabled={!produtoAvulso.nome || produtoAvulso.preco <= 0}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Produto
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Itens */}
              {itensProducao.length === 0 ? (
                <div className="py-8 text-center border rounded-lg bg-muted/30">
                  <Package className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhum produto adicionado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {itensProducao.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{item.nome_produto}</p>
                              <Badge variant={item.tipo === 'precificacao' ? 'default' : 'outline'} className="text-xs">
                                {item.tipo === 'precificacao' ? 'Salvo' : 'Avulso'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.segmento}</p>
                          </div>
                          
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">{formatCurrency(item.preco_unitario)}/un</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              className="w-20"
                              value={item.quantidade}
                              onChange={(e) => handleUpdateItemQuantidade(index, parseInt(e.target.value) || 1)}
                            />
                          </div>
                          
                          <div className="text-right min-w-[100px]">
                            <p className="font-semibold">{formatCurrency(item.subtotal)}</p>
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Subtotal */}
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Subtotal Produção</p>
                  <p className="text-xl font-bold">{formatCurrency(subtotalProducao)}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Serviços de Marca */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Serviço de Criação de Marca Própria
                </h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowServicoForm(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar Plano/Serviço
                </Button>
              </div>

              {/* Form Novo Serviço */}
              {showServicoForm && (
                <Card className="border-primary">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Novo Plano/Serviço</Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowServicoForm(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome do Plano *</Label>
                        <Input
                          value={novoServico.nome}
                          onChange={(e) => setNovoServico(prev => ({ ...prev, nome: e.target.value }))}
                          placeholder="Ex: Plano Premium, Design de Rótulo..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Descrição (opcional)</Label>
                        <Textarea
                          value={novoServico.descricao}
                          onChange={(e) => setNovoServico(prev => ({ ...prev, descricao: e.target.value }))}
                          placeholder="Descrição do serviço..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor (R$) *</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={novoServico.valor || ''}
                          onChange={(e) => setNovoServico(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleAddServico} 
                      className="w-full"
                      disabled={!novoServico.nome || novoServico.valor <= 0}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Serviço
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Serviços */}
              {servicosMarca.length === 0 ? (
                <div className="py-8 text-center border rounded-lg bg-muted/30">
                  <Palette className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhum serviço de marca adicionado.</p>
                  <p className="text-xs text-muted-foreground mt-1">(Esta seção é opcional)</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {servicosMarca.map((servico, index) => (
                    <Card key={index}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <p className="font-medium">{servico.nome_plano}</p>
                            {servico.descricao && (
                              <p className="text-xs text-muted-foreground">{servico.descricao}</p>
                            )}
                          </div>
                          
                          <p className="font-semibold">{formatCurrency(servico.valor)}</p>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleRemoveServico(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Subtotal */}
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Subtotal Serviços</p>
                  <p className="text-xl font-bold">{formatCurrency(subtotalServicos)}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Resumo */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Resumo do Orçamento</h3>
              
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Consultor Responsável</p>
                      <p className="font-semibold">{consultorResponsavel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <p className="font-semibold">{nomeCliente}</p>
                    </div>
                  </div>

                  {itensProducao.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">PRODUÇÃO</p>
                      <div className="space-y-1">
                        {itensProducao.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>• {item.nome_produto} ({item.quantidade}un)</span>
                            <span>{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-medium pt-1 border-t">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(subtotalProducao)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {servicosMarca.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">SERVIÇOS DE MARCA</p>
                      <div className="space-y-1">
                        {servicosMarca.map((servico, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>• {servico.nome_plano}</span>
                            <span>{formatCurrency(servico.valor)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-medium pt-1 border-t">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(subtotalServicos)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Total */}
              <Card className="bg-primary text-primary-foreground">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg">VALOR TOTAL DO ORÇAMENTO</span>
                    <span className="text-2xl font-bold">{formatCurrency(valorTotal)}</span>
                  </div>
                </CardContent>
              </Card>

              {observacoes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{observacoes}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Validade: {validadeDias} dias a partir da emissão
              </p>
            </div>
          )}

          {/* Navegação */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </Button>

            {step < 4 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canGoNext()}
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || valorTotal === 0}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {orcamentoExistente ? 'Salvar Alterações' : 'Salvar Orçamento'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
