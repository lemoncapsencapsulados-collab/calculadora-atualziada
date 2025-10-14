import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Download, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useInsumos } from '@/hooks/useInsumos';
import { useEmbalagens } from '@/hooks/useEmbalagens';
import { addFormula, saveCalculatorState, getCalculatorState, clearCalculatorState } from '@/lib/localStorage';
import { Formula, FormulaItem, EmbalagemItem, UnitType } from '@/types/formula';
import { calcularCustoInsumo, formatCurrency, formatCurrencyDetailed, formatUnit } from '@/lib/unitConversion';
import { toast } from 'sonner';

interface FormulaItemInput {
  id: string;
  insumoNome: string;
  quantidade: string;
  unidade: UnitType;
}

export default function Calculator() {
  const [cliente, setCliente] = useState('');
  const [nomeFormula, setNomeFormula] = useState('');
  const [items, setItems] = useState<FormulaItemInput[]>([
    { id: '1', insumoNome: '', quantidade: '', unidade: 'mg' },
  ]);
  const [selectedEmbalagens, setSelectedEmbalagens] = useState<Set<string>>(new Set());
  const [qtdCapsulas, setQtdCapsulas] = useState<string>('60');
  
  const { insumos, loading: loadingInsumos } = useInsumos();
  const { embalagens, loading: loadingEmbalagens } = useEmbalagens();

  // Load saved calculator state on mount
  useEffect(() => {
    const savedState = getCalculatorState();
    if (savedState) {
      setCliente(savedState.cliente);
      setNomeFormula(savedState.nomeFormula);
      setQtdCapsulas(savedState.qtdCapsulas || '60');
      setItems(savedState.items as FormulaItemInput[]);
      setSelectedEmbalagens(new Set(savedState.selectedEmbalagens));
    }
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    const state = {
      cliente,
      nomeFormula,
      qtdCapsulas,
      items,
      selectedEmbalagens: Array.from(selectedEmbalagens),
    };
    saveCalculatorState(state);
  }, [cliente, nomeFormula, qtdCapsulas, items, selectedEmbalagens]);

  // Calculate costs
  const calculatedItems = useMemo(() => {
    return items.map((item) => {
      if (!item.insumoNome || !item.quantidade) return null;

      const insumo = insumos.find(
        (i) => i.nome.toLowerCase() === item.insumoNome.toLowerCase()
      );

      if (!insumo) {
        return {
          ...item,
          insumo: undefined,
          error: `Não temos em casa a matéria '${item.insumoNome}'.`,
          custo: 0,
        };
      }

      try {
        const formulaItem: FormulaItem = {
          insumo_id: insumo.id,
          nome_insumo_snapshot: insumo.nome,
          qtd_informada: parseFloat(item.quantidade),
          unidade_informada: item.unidade,
          custo_calculado: 0,
        };

        const custo = calcularCustoInsumo(formulaItem, insumo);

        return {
          ...item,
          insumo,
          custo,
          error: null,
        };
      } catch (error: any) {
        return {
          ...item,
          insumo: undefined,
          error: error.message,
          custo: 0,
        };
      }
    });
  }, [items, insumos]);

  const custoUnitarioMP = useMemo(() => {
    return calculatedItems.reduce((sum, item) => sum + (item?.custo || 0), 0);
  }, [calculatedItems]);

  const totalMP = useMemo(() => {
    const qtd = parseFloat(qtdCapsulas) || 1;
    return custoUnitarioMP * qtd;
  }, [custoUnitarioMP, qtdCapsulas]);

  const custoCapsulas = useMemo(() => {
    const qtd = parseFloat(qtdCapsulas) || 0;
    return qtd * 0.03; // R$ 0,03 por cápsula zero
  }, [qtdCapsulas]);

  const custoEmbalagensExtras = useMemo(() => {
    return Array.from(selectedEmbalagens).reduce((sum, embId) => {
      const emb = embalagens.find((e) => e.id === embId);
      return sum + (emb ? emb.preco_unitario : 0);
    }, 0);
  }, [selectedEmbalagens, embalagens]);

  const totalEmbalagem = custoEmbalagensExtras + custoCapsulas;

  const custoTotal = totalMP + totalEmbalagem;

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), insumoNome: '', quantidade: '', unidade: 'mg' },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof FormulaItemInput, value: string) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = () => {
    if (!cliente.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }

    const validItems = calculatedItems.filter(
      (item) => item && !item.error && item.custo > 0
    );

    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um item válido à fórmula');
      return;
    }

    const formulaItems: FormulaItem[] = validItems.map((item) => ({
      insumo_id: item!.insumo!.id,
      nome_insumo_snapshot: item!.insumo!.nome,
      qtd_informada: parseFloat(item!.quantidade),
      unidade_informada: item!.unidade,
      custo_calculado: item!.custo,
    }));

    const embalagemItems: EmbalagemItem[] = [
      // Adicionar custo das cápsulas zero
      {
        embalagem_id: 'capsulas_zero',
        descricao_snapshot: `Cápsulas 0 (${qtdCapsulas || 0} unidades)`,
        custo_calculado: custoCapsulas,
      },
      // Adicionar embalagens selecionadas
      ...Array.from(selectedEmbalagens).map((embId) => {
        const emb = embalagens.find((e) => e.id === embId)!;
        return {
          embalagem_id: emb.id,
          descricao_snapshot: `${emb.nome} - ${emb.descricao}`,
          custo_calculado: emb.preco_unitario,
        };
      }),
    ];

    const formula: Formula = {
      id: Date.now().toString(),
      cliente,
      nome_formula: nomeFormula || 'Fórmula sem nome',
      qtd_capsulas: parseFloat(qtdCapsulas) || 60,
      itens: formulaItems,
      embalagens: embalagemItems,
      total_mp: totalMP,
      total_embalagem: totalEmbalagem,
      custo_total: custoTotal,
      data: new Date(),
    };

    addFormula(formula);
    toast.success('Fórmula salva com sucesso!');

    // Reset form
    setCliente('');
    setNomeFormula('');
    setQtdCapsulas('60');
    setItems([{ id: Date.now().toString(), insumoNome: '', quantidade: '', unidade: 'mg' }]);
    setSelectedEmbalagens(new Set());
    clearCalculatorState();
  };

  const handleClear = () => {
    if (confirm('Limpar todos os campos?')) {
      setCliente('');
      setNomeFormula('');
      setQtdCapsulas('60');
      setItems([{ id: Date.now().toString(), insumoNome: '', quantidade: '', unidade: 'mg' }]);
      setSelectedEmbalagens(new Set());
      clearCalculatorState();
    }
  };

  const handleExport = () => {
    // Simple CSV export
    let csv = `Cliente: ${cliente}\nFórmula: ${nomeFormula}\nQuantidade de Cápsulas: ${qtdCapsulas}\nData: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    
    csv += 'MATÉRIA-PRIMA (por cápsula)\n';
    csv += 'Insumo,Quantidade,Unidade,Custo Unitário\n';
    calculatedItems.forEach((item) => {
      if (item && !item.error) {
        csv += `${item.insumoNome},${item.quantidade},${item.unidade},${formatCurrencyDetailed(item.custo)}\n`;
      }
    });
    
    csv += `\nCusto por cápsula:,${formatCurrencyDetailed(custoUnitarioMP)}\n`;
    csv += `Quantidade de cápsulas:,${qtdCapsulas}\n`;
    csv += `Total Matéria-Prima:,${formatCurrency(totalMP)}\n\n`;
    
    csv += 'EMBALAGEM\n';
    csv += 'Item,Descrição,Custo\n';
    csv += `Cápsulas 0,${qtdCapsulas || 0} unidades,${formatCurrency(custoCapsulas)}\n`;
    Array.from(selectedEmbalagens).forEach((embId) => {
      const emb = embalagens.find((e) => e.id === embId);
      if (emb) {
        csv += `${emb.nome},"${emb.descricao}",${formatCurrency(emb.preco_unitario)}\n`;
      }
    });
    
    csv += `\nTotal Embalagem:,${formatCurrency(totalEmbalagem)}\n`;
    csv += `\nPREÇO TOTAL:,${formatCurrency(custoTotal)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orcamento_${cliente || 'sem_nome'}_${Date.now()}.csv`;
    link.click();
    
    toast.success('Orçamento exportado com sucesso!');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {(loadingInsumos || loadingEmbalagens) ? (
        <Card className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Carregando inventário...</p>
        </Card>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calcular Fórmula</h1>
            <p className="text-muted-foreground mt-1">
              Calcule o custo de matéria-prima e embalagem
            </p>
          </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Informações do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cliente">Cliente *</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <Label htmlFor="nomeFormula">Nome da Fórmula</Label>
              <Input
                id="nomeFormula"
                value={nomeFormula}
                onChange={(e) => setNomeFormula(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Configuração do Pote</CardTitle>
          <CardDescription>Quantidade de cápsulas por pote</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="qtdCapsulas">Quantidade de Cápsulas *</Label>
            <Input
              id="qtdCapsulas"
              type="number"
              min="1"
              value={qtdCapsulas}
              onChange={(e) => setQtdCapsulas(e.target.value)}
              placeholder="Ex: 60"
            />
            <p className="text-sm text-muted-foreground">
              As quantidades informadas são por cápsula e serão multiplicadas por este valor
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Itens da Fórmula</CardTitle>
          <CardDescription>Adicione os insumos e quantidades</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => {
            const calculated = calculatedItems[index];
            
            return (
              <div key={item.id} className="space-y-2">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-5">
                    <Label>Insumo</Label>
                    <Input
                      value={item.insumoNome}
                      onChange={(e) => updateItem(item.id, 'insumoNome', e.target.value)}
                      placeholder="Digite o nome do insumo..."
                      list={`insumos-list-${item.id}`}
                    />
                    <datalist id={`insumos-list-${item.id}`}>
                      {insumos.map((insumo) => (
                        <option key={insumo.id} value={insumo.nome} />
                      ))}
                    </datalist>
                  </div>

                  <div className="col-span-3">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      step="any"
                      value={item.quantidade}
                      onChange={(e) => updateItem(item.id, 'quantidade', e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Unidade</Label>
                    <Select
                      value={item.unidade}
                      onValueChange={(value) =>
                        updateItem(item.id, 'unidade', value as UnitType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcg">mcg</SelectItem>
                        <SelectItem value="mg">mg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="mL">mL</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="UI">UI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 flex items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {calculated?.error && (
                  <p className="text-sm text-destructive font-medium">{calculated.error}</p>
                )}
                {calculated && !calculated.error && calculated.custo > 0 && (
                  <p className="text-sm text-primary font-medium">
                    Custo: {formatCurrencyDetailed(calculated.custo)}
                  </p>
                )}
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            onClick={addItem}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Item
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Embalagem</CardTitle>
          <CardDescription>Selecione os itens de embalagem</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {embalagens.map((emb) => (
              <div
                key={emb.id}
                className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  id={`emb-${emb.id}`}
                  checked={selectedEmbalagens.has(emb.id)}
                  onCheckedChange={(checked) => {
                    const newSet = new Set(selectedEmbalagens);
                    if (checked) {
                      newSet.add(emb.id);
                    } else {
                      newSet.delete(emb.id);
                    }
                    setSelectedEmbalagens(newSet);
                  }}
                />
                <div className="flex-1">
                  <Label htmlFor={`emb-${emb.id}`} className="font-medium cursor-pointer">
                    {emb.nome}
                  </Label>
                  <p className="text-sm text-muted-foreground">{emb.descricao}</p>
                  <p className="text-sm font-semibold text-primary mt-1">
                    {formatCurrency(emb.preco_unitario)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary">Matéria-Prima</CardTitle>
            <CardDescription>
              Custo unitário × {qtdCapsulas || 1} cápsulas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Custo por cápsula:</span>
              <span>{formatCurrencyDetailed(custoUnitarioMP)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Quantidade:</span>
              <span>{qtdCapsulas || 1} cápsulas</span>
            </div>
            <div className="border-t pt-2">
              <p className="text-3xl font-bold text-foreground">{formatCurrency(totalMP)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardHeader>
            <CardTitle className="text-accent">Embalagem</CardTitle>
            <CardDescription>
              Embalagens + Cápsulas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Cápsulas 0 ({qtdCapsulas || 0}x):</span>
              <span>{formatCurrencyDetailed(custoCapsulas)}</span>
            </div>
            {custoEmbalagensExtras > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Embalagens extras:</span>
                <span>{formatCurrencyDetailed(custoEmbalagensExtras)}</span>
              </div>
            )}
            <div className="border-t pt-2">
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(totalEmbalagem)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader>
            <CardTitle className="text-success">Preço Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(custoTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleClear}>
          <X className="w-4 h-4 mr-2" />
          Limpar
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={custoTotal === 0}>
          <Download className="w-4 h-4 mr-2" />
          Baixar Orçamento
        </Button>
        <Button onClick={handleSave} disabled={!cliente || custoTotal === 0}>
          <Save className="w-4 h-4 mr-2" />
          Salvar Cálculo
        </Button>
      </div>
      </>
      )}
    </div>
  );
}
