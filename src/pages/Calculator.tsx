import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Download, Save, X, Package, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useInsumos } from '@/hooks/useInsumos';
import { useEmbalagens } from '@/hooks/useEmbalagens';
import { useFormulas } from '@/hooks/useFormulas';
import { saveCalculatorState, getCalculatorState, clearCalculatorState } from '@/lib/localStorage';
import { Formula, FormulaItem, EmbalagemItem, UnitType } from '@/types/formula';
import { calcularCustoInsumo, formatCurrency, formatCurrencyDetailed, formatUnit } from '@/lib/unitConversion';
import { toast } from 'sonner';

// Capacidade padrão de uma cápsula em gramas
const CAPACIDADE_CAPSULA_GRAMAS = 1;

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
  const [selectedCapsula, setSelectedCapsula] = useState<string | null>(null);
  const [tipoProduto, setTipoProduto] = useState<'Encapsulados' | 'Pó' | 'Gummy' | 'Líquido'>('Encapsulados');
  const [qtdCapsulas, setQtdCapsulas] = useState<string>('60');
  const [unidadesPorDose, setUnidadesPorDose] = useState<string>('2');
  
  const { insumos, loading: loadingInsumos } = useInsumos();
  const { embalagens, loading: loadingEmbalagens } = useEmbalagens();
  const { addFormula } = useFormulas();

  // Load formula from "Carregar no Calculador" if present
  useEffect(() => {
    const loadFormulaData = localStorage.getItem('loadFormula');
    if (loadFormulaData) {
      try {
        const formula = JSON.parse(loadFormulaData);
        
        // Preencher campos básicos
        setCliente(formula.cliente || '');
        setNomeFormula(formula.nome_formula || '');
        setTipoProduto(formula.tipo_produto || 'Encapsulados');
        setQtdCapsulas(formula.qtd_capsulas?.toString() || '60');
        setUnidadesPorDose(formula.unidades_por_dose?.toString() || '2');
        
        // Preencher itens de matéria-prima
        if (formula.itens && Array.isArray(formula.itens)) {
          const loadedItems: FormulaItemInput[] = formula.itens.map((item: any, index: number) => ({
            id: (index + 1).toString(),
            insumoNome: item.nome_insumo_snapshot || '',
            quantidade: item.qtd_informada?.toString() || '',
            unidade: item.unidade_informada || 'mg',
          }));
          setItems(loadedItems);
        }
        
        // Preencher embalagens selecionadas
        if (formula.embalagens && Array.isArray(formula.embalagens)) {
          const embalagemIds = new Set<string>();
          formula.embalagens.forEach((emb: any) => {
            if (emb.embalagem_id) {
              embalagemIds.add(emb.embalagem_id);
            }
          });
          setSelectedEmbalagens(embalagemIds);
          
          // Encontrar cápsula se houver
          const capsula = formula.embalagens.find((emb: any) => 
            embalagens.some(e => e.id === emb.embalagem_id && e.categoria === 'Cápsulas')
          );
          if (capsula) {
            setSelectedCapsula(capsula.embalagem_id);
          }
        }
        
        toast.success('Fórmula carregada no calculador!');
        
        // Limpar o item do localStorage após carregar
        localStorage.removeItem('loadFormula');
      } catch (error) {
        console.error('Erro ao carregar fórmula:', error);
        toast.error('Erro ao carregar fórmula');
        localStorage.removeItem('loadFormula');
      }
    }
  }, [embalagens]);

  // Clear selectedCapsula when changing to Pó, Gummy or Líquido
  useEffect(() => {
    if (tipoProduto === 'Pó' || tipoProduto === 'Gummy' || tipoProduto === 'Líquido') {
      setSelectedCapsula(null);
    }
  }, [tipoProduto]);

  // Ajustar valores padrão ao trocar tipo de produto
  useEffect(() => {
    if (tipoProduto === 'Pó') {
      // Se estava em outro tipo e mudou para Pó, sugerir valores padrão
      if (qtdCapsulas === '60' || qtdCapsulas === '1') {
        setQtdCapsulas('300');
      }
      if (unidadesPorDose === '2') {
        setUnidadesPorDose('3');
      }
    }
  }, [tipoProduto]);

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

  // Calcula quantidade de Amido de Milho necessário (somente para Encapsulados)
  const calcularExcipiente = useMemo(() => {
    // Excipiente só é usado em Encapsulados
    if (tipoProduto !== 'Encapsulados') {
      return { quantidade: 0, unidade: 'g' as UnitType, custo: 0 };
    }
    
    const unidadesDose = parseFloat(unidadesPorDose) || 1;
    
    // Somar todos os insumos da dose (converter tudo para gramas)
    const totalInsumosDose = calculatedItems.reduce((sum, item) => {
      if (!item || !item.quantidade || !item.insumo || item.error) return sum;
      
      const qtd = parseFloat(item.quantidade);
      const unidade = item.unidade;
      
      // Converter para gramas
      let qtdEmGramas = 0;
      switch (unidade) {
        case 'kg':
          qtdEmGramas = qtd * 1000;
          break;
        case 'g':
          qtdEmGramas = qtd;
          break;
        case 'mg':
          qtdEmGramas = qtd / 1000;
          break;
        case 'mcg':
          qtdEmGramas = qtd / 1_000_000;
          break;
        default:
          qtdEmGramas = 0; // Volume/UI não conta para peso
      }
      
      return sum + qtdEmGramas;
    }, 0);
    
    // Capacidade total da dose (cápsulas por dose × 1g cada)
    const capacidadeTotalDose = unidadesDose * CAPACIDADE_CAPSULA_GRAMAS;
    
    // Diferença é quanto de excipiente precisamos
    const diferencaGramas = Math.max(0, capacidadeTotalDose - totalInsumosDose);
    
    // Buscar o Amido de Milho no banco
    const amidoMilho = insumos.find(
      i => i.nome.toLowerCase().includes('amido') && i.nome.toLowerCase().includes('milho')
    );
    
    // Debug logs
    console.log('🔍 DEBUG Excipiente:', {
      tipoProduto,
      unidadesDose,
      totalInsumosDose: totalInsumosDose.toFixed(3),
      capacidadeTotalDose,
      diferencaGramas: diferencaGramas.toFixed(3),
      amidoEncontrado: !!amidoMilho,
      nomeAmido: amidoMilho?.nome,
      totalItensCalculados: calculatedItems.filter(i => i && !i.error).length
    });
    
    if (!amidoMilho) {
      console.warn('⚠️ Amido de Milho não encontrado no inventário!');
      return { quantidade: 0, unidade: 'g' as UnitType, custo: 0 };
    }
    
    if (diferencaGramas === 0) {
      console.log('ℹ️ Não há diferença para completar (cápsula já está cheia)');
      return { quantidade: 0, unidade: 'g' as UnitType, custo: 0 };
    }
    
    // Calcular custo do excipiente POR DOSE
    const formulaItemExcipiente: FormulaItem = {
      insumo_id: amidoMilho.id,
      nome_insumo_snapshot: amidoMilho.nome,
      qtd_informada: diferencaGramas,
      unidade_informada: 'g',
      custo_calculado: 0,
    };
    
    const custoExcipiente = calcularCustoInsumo(formulaItemExcipiente, amidoMilho);
    
    return {
      quantidade: diferencaGramas,
      unidade: 'g' as UnitType,
      custo: custoExcipiente,
      insumo: amidoMilho,
    };
  }, [calculatedItems, tipoProduto, unidadesPorDose, insumos]);

  const custoUnitarioMP = useMemo(() => {
    const custoInsumos = calculatedItems.reduce((sum, item) => sum + (item?.custo || 0), 0);
    const custoExcipiente = calcularExcipiente.custo;
    return custoInsumos + custoExcipiente;
  }, [calculatedItems, calcularExcipiente]);

  const totalMP = useMemo(() => {
    const qtdTotal = parseFloat(qtdCapsulas) || 1;
    const unidadesDose = parseFloat(unidadesPorDose) || 1;
    
    // Calcula número de doses e multiplica pelo custo unitário por dose
    const numDoses = qtdTotal / unidadesDose;
    return custoUnitarioMP * numDoses;
  }, [custoUnitarioMP, qtdCapsulas, unidadesPorDose]);

  const custoCapsulas = useMemo(() => {
    // Se for Pó, Gummy ou Líquido, não há custo de cápsulas
    if (tipoProduto === 'Pó' || tipoProduto === 'Gummy' || tipoProduto === 'Líquido') return 0;
    
    if (!selectedCapsula) return 0;
    
    const capsula = embalagens.find(e => e.id === selectedCapsula);
    if (!capsula) return 0;
    
    const qtd = parseFloat(qtdCapsulas) || 0;
    return capsula.preco_unitario * qtd;
  }, [selectedCapsula, qtdCapsulas, tipoProduto, embalagens]);

  const custoEmbalagensExtras = useMemo(() => {
    return Array.from(selectedEmbalagens).reduce((sum, embId) => {
      const emb = embalagens.find((e) => e.id === embId);
      // Excluir cápsulas do cálculo de embalagens extras
      if (emb && emb.categoria === 'Cápsulas') return sum;
      return sum + (emb ? emb.preco_unitario : 0);
    }, 0);
  }, [selectedEmbalagens, embalagens]);

  const custoRotulo = 2; // Custo fixo do rótulo

  const totalEmbalagem = custoEmbalagensExtras + custoCapsulas + custoRotulo;

  const custoTotal = totalMP + totalEmbalagem;

  // Group embalagens by categoria > subcategoria
  const embalagensPorCategoria = useMemo(() => {
    const grupos: Record<string, Record<string, typeof embalagens>> = {};
    
    embalagens.forEach(emb => {
      const cat = emb.categoria || 'Outras Embalagens';
      const subcat = emb.subcategoria || 'Geral';
      
      if (!grupos[cat]) grupos[cat] = {};
      if (!grupos[cat][subcat]) grupos[cat][subcat] = [];
      
      grupos[cat][subcat].push(emb);
    });
    
    return grupos;
  }, [embalagens]);

  // Calculate costs by subcategoria
  const custosPorSubcategoria = useMemo(() => {
    const custos: Record<string, Record<string, number>> = {};
    
    Array.from(selectedEmbalagens).forEach(embId => {
      const emb = embalagens.find(e => e.id === embId);
      if (!emb) return;
      
      const cat = emb.categoria || 'Outras Embalagens';
      const subcat = emb.subcategoria || 'Geral';
      
      if (!custos[cat]) custos[cat] = {};
      if (!custos[cat][subcat]) custos[cat][subcat] = 0;
      
      custos[cat][subcat] += emb.preco_unitario;
    });
    
    return custos;
  }, [selectedEmbalagens, embalagens]);

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

    if (tipoProduto === 'Encapsulados' && !selectedCapsula) {
      toast.error('Selecione o tipo de cápsula');
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

    // Adicionar excipiente se houver
    if (tipoProduto === 'Encapsulados' && calcularExcipiente.quantidade > 0 && calcularExcipiente.insumo) {
      formulaItems.push({
        insumo_id: calcularExcipiente.insumo.id,
        nome_insumo_snapshot: `${calcularExcipiente.insumo.nome} (Excipiente)`,
        qtd_informada: calcularExcipiente.quantidade,
        unidade_informada: calcularExcipiente.unidade,
        custo_calculado: calcularExcipiente.custo,
      });
    }

    const embalagemItems: EmbalagemItem[] = [];

    // Adicionar cápsula selecionada (SOMENTE para Encapsulados)
    if (selectedCapsula && tipoProduto === 'Encapsulados') {
      const capsula = embalagens.find(e => e.id === selectedCapsula)!;
      embalagemItems.push({
        embalagem_id: capsula.id,
        descricao_snapshot: `${capsula.nome} (${qtdCapsulas || 0} unidades)`,
        custo_calculado: custoCapsulas,
      });
    }

    // Adicionar outras embalagens (exceto cápsulas)
    Array.from(selectedEmbalagens).forEach(embId => {
      const emb = embalagens.find(e => e.id === embId);
      if (emb && emb.categoria !== 'Cápsulas') {
        embalagemItems.push({
          embalagem_id: emb.id,
          descricao_snapshot: `${emb.nome} - ${emb.descricao}`,
          custo_calculado: emb.preco_unitario,
        });
      }
    });

    const formula: Omit<Formula, 'id' | 'data'> = {
      cliente,
      nome_formula: nomeFormula || 'Fórmula sem nome',
      tipo_produto: tipoProduto,
      qtd_capsulas: parseFloat(qtdCapsulas) || 60,
      unidades_por_dose: parseFloat(unidadesPorDose) || 1,
      itens: formulaItems,
      embalagens: embalagemItems,
      total_mp: totalMP,
      total_embalagem: totalEmbalagem,
      custo_total: custoTotal,
    };

    addFormula(formula);
    toast.success('Fórmula salva com sucesso!');

    // Reset form
    setCliente('');
    setNomeFormula('');
    setTipoProduto('Encapsulados');
    setQtdCapsulas('60');
    setUnidadesPorDose('2');
    setItems([{ id: Date.now().toString(), insumoNome: '', quantidade: '', unidade: 'mg' }]);
    setSelectedEmbalagens(new Set());
    setSelectedCapsula(null);
    clearCalculatorState();
  };

  const handleClear = () => {
    if (confirm('Limpar todos os campos?')) {
      setCliente('');
      setNomeFormula('');
      setTipoProduto('Encapsulados');
      setQtdCapsulas('60');
      setUnidadesPorDose('2');
      setItems([{ id: Date.now().toString(), insumoNome: '', quantidade: '', unidade: 'mg' }]);
      setSelectedEmbalagens(new Set());
      setSelectedCapsula(null);
      clearCalculatorState();
    }
  };

  const handleExport = () => {
    const tipoProdutoLabel = tipoProduto === 'Pó' ? 'Pote' : 
                           tipoProduto === 'Gummy' ? 'Gummies' : 
                           tipoProduto === 'Líquido' ? 'mL' : 'Cápsulas';
    const quantidadeLabel = tipoProduto === 'Pó' ? '1' : qtdCapsulas;
    
    let csv = `Cliente: ${cliente}\nFórmula: ${nomeFormula}\nTipo: ${tipoProduto}\nQuantidade: ${quantidadeLabel} ${tipoProdutoLabel}\nData: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    
    csv += `MATÉRIA-PRIMA (por ${tipoProduto === 'Pó' ? 'pote' : 'unidade'})\n`;
    csv += 'Insumo,Quantidade,Unidade,Custo Unitário\n';
    calculatedItems.forEach((item) => {
      if (item && !item.error) {
        csv += `${item.insumoNome},${item.quantidade},${item.unidade},${formatCurrencyDetailed(item.custo)}\n`;
      }
    });
    
    csv += `\nCusto por ${tipoProduto === 'Pó' ? 'pote' : 'unidade'}:,${formatCurrencyDetailed(custoUnitarioMP)}\n`;
    
    if (tipoProduto !== 'Pó') {
      csv += `Quantidade de ${tipoProdutoLabel}:,${qtdCapsulas}\n`;
    }
    
    csv += `Total Matéria-Prima:,${formatCurrency(totalMP)}\n\n`;
    
    csv += 'EMBALAGEM\n';
    csv += 'Item,Categoria,Subcategoria,Descrição,Custo\n';
    
    // Adicionar cápsula selecionada (SOMENTE para Encapsulados)
    if (selectedCapsula && tipoProduto === 'Encapsulados') {
      const capsula = embalagens.find(e => e.id === selectedCapsula);
      if (capsula) {
        csv += `${capsula.nome},${capsula.categoria || 'Cápsulas'},${capsula.subcategoria || '-'},"${qtdCapsulas || 0} unidades",${formatCurrency(custoCapsulas)}\n`;
      }
    }
    
    // Group by categoria > subcategoria in export
    Object.entries(embalagensPorCategoria)
      .filter(([categoria]) => categoria !== 'Cápsulas')
      .forEach(([categoria, subcategorias]) => {
      Object.entries(subcategorias).forEach(([subcategoria, itens]) => {
        itens.forEach((emb) => {
          if (selectedEmbalagens.has(emb.id)) {
            csv += `${emb.nome},${categoria},${subcategoria},"${emb.descricao}",${formatCurrency(emb.preco_unitario)}\n`;
          }
        });
      });
    });
    
    csv += `\nSubtotais por Categoria/Subcategoria:\n`;
    Object.entries(custosPorSubcategoria)
      .filter(([categoria]) => categoria !== 'Cápsulas')
      .forEach(([categoria, subcategorias]) => {
      csv += `\n${categoria}:\n`;
      Object.entries(subcategorias).forEach(([subcategoria, custo]) => {
        csv += `  ${subcategoria},${formatCurrency(custo)}\n`;
      });
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
          <CardDescription>Tipo de produto e quantidade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipoProduto">Tipo de Produto *</Label>
            <Select
              value={tipoProduto}
              onValueChange={(value) => setTipoProduto(value as 'Encapsulados' | 'Pó' | 'Gummy')}
            >
              <SelectTrigger id="tipoProduto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Encapsulados">Encapsulados</SelectItem>
                <SelectItem value="Pó">Pó</SelectItem>
                <SelectItem value="Gummy">Gummy</SelectItem>
                <SelectItem value="Líquido">Líquido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qtdCapsulas">
              {tipoProduto === 'Encapsulados' && 'Quantidade de Cápsulas *'}
              {tipoProduto === 'Gummy' && 'Quantidade de Gummies *'}
              {tipoProduto === 'Líquido' && 'Quantidade em mL *'}
              {tipoProduto === 'Pó' && 'Quantidade Total de Pó (gramas) *'}
            </Label>
            <Input
              id="qtdCapsulas"
              type="number"
              min="1"
              step={tipoProduto === 'Pó' ? '1' : '0.1'}
              value={qtdCapsulas}
              onChange={(e) => setQtdCapsulas(e.target.value)}
              placeholder={
                tipoProduto === 'Encapsulados' ? 'Ex: 60' :
                tipoProduto === 'Gummy' ? 'Ex: 30' :
                tipoProduto === 'Líquido' ? 'Ex: 100' :
                'Ex: 300'
              }
            />
            <p className="text-sm text-muted-foreground">
              {tipoProduto === 'Pó' 
                ? 'Informe a quantidade total de pó no produto (ex: 300 gramas)'
                : 'As quantidades de matéria-prima informadas serão multiplicadas pelo número de doses'
              }
            </p>
          </div>
          
          {/* Campo de dosagem - visível para TODOS os tipos */}
          {(
            <div className="space-y-2">
              <Label htmlFor="unidadesPorDose">
                {tipoProduto === 'Encapsulados' && 'Cápsulas por Dose *'}
                {tipoProduto === 'Gummy' && 'Gummies por Dose *'}
                {tipoProduto === 'Líquido' && 'mL por Dose *'}
                {tipoProduto === 'Pó' && 'Gramas por Dose (Dose Diária) *'}
              </Label>
              <Input
                id="unidadesPorDose"
                type="number"
                min="0.1"
                step="0.1"
                value={unidadesPorDose}
                onChange={(e) => setUnidadesPorDose(e.target.value)}
                placeholder={
                  tipoProduto === 'Encapsulados' ? 'Ex: 2' :
                  tipoProduto === 'Gummy' ? 'Ex: 1' :
                  tipoProduto === 'Líquido' ? 'Ex: 5' :
                  'Ex: 3'
                }
              />
              <p className="text-sm text-muted-foreground">
                {tipoProduto === 'Encapsulados' && 'Quantas cápsulas compõem uma dose? Ex: 2 cápsulas = 1 dose'}
                {tipoProduto === 'Gummy' && 'Quantos gummies compõem uma dose? Ex: 1 gummy = 1 dose'}
                {tipoProduto === 'Líquido' && 'Quantos mL compõem uma dose? Ex: 5 mL = 1 dose'}
                {tipoProduto === 'Pó' && 'Quantas gramas por dose diária? Ex: 3g por dose (essa é a dose base da sua tabela de MP)'}
              </p>
              
              {/* Exibir cálculo do número de doses */}
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-950 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  📊 Número de doses: {Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))}
                </p>
                {tipoProduto === 'Pó' && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    O custo de matéria-prima será: custo por dose × {Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))} doses
                  </p>
                )}
              </div>
            </div>
          )}
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

      {/* Card informativo do Excipiente (Amido de Milho) - só para Encapsulados */}
      {tipoProduto === 'Encapsulados' && calcularExcipiente.quantidade > 0 && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Excipiente (Amido de Milho)
            </CardTitle>
            <CardDescription className="text-xs">
              Completamento automático da capacidade da cápsula
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Quantidade por dose:</p>
                <p className="font-medium">{calcularExcipiente.quantidade.toFixed(3)}g</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Custo por dose:</p>
                <p className="font-medium text-blue-600">{formatCurrency(calcularExcipiente.custo)}</p>
              </div>
            </div>
            
            <div className="p-2 bg-white dark:bg-slate-900 rounded border text-xs space-y-1">
              <p className="text-muted-foreground">
                <strong>Cálculo:</strong>
              </p>
              <p>
                • Capacidade da dose: {parseFloat(unidadesPorDose) || 0} cápsulas × 1g = {parseFloat(unidadesPorDose) || 0}g
              </p>
              <p>
                • Total de insumos: {calculatedItems.reduce((sum, item) => {
                  if (!item || !item.quantidade) return sum;
                  const qtd = parseFloat(item.quantidade);
                  const unidade = item.unidade;
                  let qtdEmGramas = 0;
                  switch (unidade) {
                    case 'kg': qtdEmGramas = qtd * 1000; break;
                    case 'g': qtdEmGramas = qtd; break;
                    case 'mg': qtdEmGramas = qtd / 1000; break;
                    case 'mcg': qtdEmGramas = qtd / 1_000_000; break;
                  }
                  return sum + qtdEmGramas;
                }, 0).toFixed(3)}g
              </p>
              <p className="text-blue-700 dark:text-blue-300 font-medium">
                • Amido necessário: {calcularExcipiente.quantidade.toFixed(3)}g
              </p>
            </div>
            
            <p className="text-xs text-muted-foreground italic">
              ℹ️ Este valor já está incluído no custo total de matéria-prima
            </p>
          </CardContent>
        </Card>
      )}

      {tipoProduto === 'Encapsulados' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Tipo de Cápsula</CardTitle>
            <CardDescription>Selecione o tipo de cápsula para este pote</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const capsulas = embalagens.filter(emb => emb.categoria === 'Cápsulas');
              console.log('🔍 DEBUG Cápsulas:', {
                tipoProduto,
                totalEmbalagens: embalagens.length,
                totalCapsulas: capsulas.length,
                capsulasEncontradas: capsulas.map(c => ({ nome: c.nome, categoria: c.categoria }))
              });
              return null;
            })()}
            
            <div className="space-y-3">
              {embalagens
                .filter(emb => emb.categoria === 'Cápsulas')
                .map((capsula) => (
                  <div
                    key={capsula.id}
                    className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedCapsula === capsula.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedCapsula(capsula.id)}
                  >
                    <div className="flex-1">
                      <Label className="font-medium cursor-pointer text-base">
                        {capsula.nome}
                      </Label>
                      {capsula.subcategoria && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {capsula.subcategoria}
                        </Badge>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        {capsula.descricao}
                      </p>
                      <div className="flex items-baseline gap-2 mt-2">
                        <p className="text-sm font-semibold text-primary">
                          {formatCurrency(capsula.preco_unitario)} / unidade
                        </p>
                        <p className="text-xs text-muted-foreground">
                          × {qtdCapsulas || 0} cápsulas = {formatCurrency(capsula.preco_unitario * (parseFloat(qtdCapsulas) || 0))}
                        </p>
                      </div>
                    </div>
                    {selectedCapsula === capsula.id && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs">
                        ✓
                      </div>
                    )}
                  </div>
                ))}
            </div>
            
            {embalagens.filter(emb => emb.categoria === 'Cápsulas').length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  ⚠️ Nenhuma cápsula cadastrada no inventário
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Cadastre cápsulas na seção de Inventário com categoria "Cápsulas"
                </p>
              </div>
            )}
            
            {embalagens.filter(emb => emb.categoria === 'Cápsulas').length > 0 && !selectedCapsula && (
              <p className="text-sm text-amber-600 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                ⚠️ Selecione um tipo de cápsula para prosseguir
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Embalagem</CardTitle>
          <CardDescription>Selecione os itens de embalagem organizados por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {Object.entries(embalagensPorCategoria)
              .filter(([categoria]) => categoria !== 'Cápsulas')
              .map(([categoria, subcategorias]) => {
              const totalSelecionadosCategoria = Object.values(subcategorias)
                .flat()
                .filter(emb => selectedEmbalagens.has(emb.id)).length;
              
              return (
                <AccordionItem key={categoria} value={categoria}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2 w-full">
                      <Package className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{categoria}</span>
                      {totalSelecionadosCategoria > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {totalSelecionadosCategoria} selecionado{totalSelecionadosCategoria > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {Object.entries(subcategorias).map(([subcategoria, itens]) => {
                        const totalSelecionadosSubcat = itens.filter(emb => selectedEmbalagens.has(emb.id)).length;
                        const custoSubcat = custosPorSubcategoria[categoria]?.[subcategoria] || 0;
                        
                        return (
                          <div key={subcategoria} className="space-y-2">
                            <div className="flex items-center gap-2 px-2">
                              <Box className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">
                                {subcategoria}
                              </span>
                              {totalSelecionadosSubcat > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {totalSelecionadosSubcat} • {formatCurrency(custoSubcat)}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-3 pl-6">
                              {itens.map((emb) => (
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
                                    <Label htmlFor={`emb-${emb.id}`} className="font-medium cursor-pointer text-sm">
                                      {emb.nome}
                                    </Label>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{emb.descricao}</p>
                                    <p className="text-sm font-semibold text-primary mt-1">
                                      {formatCurrency(emb.preco_unitario)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary">Matéria-Prima</CardTitle>
            <CardDescription>
              {tipoProduto === 'Pó' 
                ? `${Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))} doses × ${formatCurrency(custoUnitarioMP)}/dose`
                : `Custo unitário: ${formatCurrency(custoUnitarioMP)}/dose × ${Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))} doses`
              }
              {tipoProduto === 'Encapsulados' && calcularExcipiente.quantidade > 0 && (
                <span className="block text-xs text-blue-600 mt-1">
                  (inclui {formatCurrency(calcularExcipiente.custo)}/dose de Amido de Milho)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Custo por dose:</span>
              <span>{formatCurrencyDetailed(custoUnitarioMP)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Unidades por dose:</span>
              <span>{unidadesPorDose} {
                tipoProduto === 'Encapsulados' ? 'cápsulas' :
                tipoProduto === 'Gummy' ? 'gummies' :
                tipoProduto === 'Líquido' ? 'mL' :
                'g'
              }</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Número de doses:</span>
              <span>{Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))}</span>
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
              {tipoProduto === 'Encapsulados' ? 'Cápsulas + Embalagens por categoria' : 'Embalagens por categoria'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedCapsula && tipoProduto === 'Encapsulados' && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{embalagens.find(e => e.id === selectedCapsula)?.nome} ({qtdCapsulas}x):</span>
                <span>{formatCurrencyDetailed(custoCapsulas)}</span>
              </div>
            )}
            
            {Object.entries(custosPorSubcategoria)
              .filter(([categoria]) => categoria !== 'Cápsulas')
              .map(([categoria, subcategorias]) => (
              <div key={categoria} className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground/80 pt-2">
                  {categoria}:
                </div>
                {Object.entries(subcategorias).map(([subcategoria, custo]) => (
                  <div key={subcategoria} className="flex justify-between text-sm text-muted-foreground pl-3">
                    <span className="text-xs">• {subcategoria}:</span>
                    <span className="text-xs">{formatCurrencyDetailed(custo)}</span>
                  </div>
                ))}
              </div>
            ))}
            
            <div className="flex justify-between text-sm text-muted-foreground pt-2">
              <span>Rótulo:</span>
              <span>{formatCurrencyDetailed(custoRotulo)}</span>
            </div>
            
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
