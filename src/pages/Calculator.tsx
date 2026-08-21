import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Save, X, Package, Box, Scale, Pill, Wheat, AlertTriangle, Info, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import InsumoAutocomplete from '@/components/InsumoAutocomplete';
import EmbalagensHierarchy from '@/components/EmbalagensHierarchy';
import ImportarDoseDialog from '@/components/ImportarDoseDialog';
import { useInsumos } from '@/hooks/useInsumos';
import { useEmbalagens } from '@/hooks/useEmbalagens';
import { useFormulas } from '@/hooks/useFormulas';
import { saveCalculatorState, getCalculatorState, clearCalculatorState } from '@/lib/localStorage';
import { Formula, FormulaItem, EmbalagemItem, UnitType, Insumo } from '@/types/formula';
import { calcularCustoInsumo, formatCurrency, formatCurrencyDetailed, formatCurrencyPrecise, formatUnit } from '@/lib/unitConversion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ClienteSelector from '@/components/ClienteSelector';
import { Cliente } from '@/hooks/useClientes';

// Capacidade padrão de uma cápsula em gramas (0.5g = 500mg)
const CAPACIDADE_CAPSULA_GRAMAS = 0.5;
interface FormulaItemInput {
  id: string;
  insumoNome: string;
  quantidade: string;
  unidade: UnitType;
}
export default function Calculator() {
  
  const [cliente, setCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [nomeFormula, setNomeFormula] = useState('');
  const [items, setItems] = useState<FormulaItemInput[]>([{
    id: '1',
    insumoNome: '',
    quantidade: '',
    unidade: 'mg'
  }]);
  const [selectedEmbalagens, setSelectedEmbalagens] = useState<Set<string>>(new Set());
  const [selectedCapsula, setSelectedCapsula] = useState<string | null>(null);
  const [tipoProduto, setTipoProduto] = useState<'Encapsulados' | 'Solúvel' | 'Gummy' | 'Líquido'>('Encapsulados');
  const [qtdCapsulas, setQtdCapsulas] = useState<string>('60');
  const [unidadesPorDose, setUnidadesPorDose] = useState<string>('2');
  const [unidadeSoluvel, setUnidadeSoluvel] = useState<'mg' | 'g'>('mg'); // Unidade de medida para produtos Solúveis
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const {
    insumos,
    loading: loadingInsumos
  } = useInsumos();
  const {
    embalagens,
    loading: loadingEmbalagens
  } = useEmbalagens();
  const {
    addFormula
  } = useFormulas();

  // Load formula from "Carregar no Calculador" if present
  useEffect(() => {
    const loadFormulaData = localStorage.getItem('loadFormula');
    if (loadFormulaData) {
      try {
        const formula = JSON.parse(loadFormulaData);

        // Preencher campos básicos
        setCliente(formula.cliente || '');
        setNomeFormula(formula.nome_formula || '');
        
        // Para Solúvel, converter de volta para a unidade original se necessário
        if ((formula.tipo_produto === 'Solúvel' || formula.tipo_produto === 'Pó') && (formula.unidade_soluvel === 'g' || formula.unidade_po === 'g')) {
          setUnidadeSoluvel('g');
          setQtdCapsulas(((formula.quantidade_por_pote || formula.qtd_capsulas) / 1000).toString());
          setUnidadesPorDose(((formula.unidades_por_dose || 0) / 1000).toString());
        } else {
          setUnidadeSoluvel((formula.unidade_soluvel || formula.unidade_po || 'mg') as 'mg' | 'g');
          setQtdCapsulas((formula.quantidade_por_pote || formula.qtd_capsulas)?.toString() || '60');
          setUnidadesPorDose(formula.unidades_por_dose?.toString() || '2');
        }

        setTipoProduto(formula.tipo_produto === 'Pó' ? 'Solúvel' : formula.tipo_produto || 'Encapsulados');

        // Preencher itens de matéria-prima
        if (formula.itens && Array.isArray(formula.itens)) {
          const loadedItems: FormulaItemInput[] = formula.itens.map((item: any, index: number) => ({
            id: (index + 1).toString(),
            insumoNome: item.nome_insumo_snapshot || '',
            quantidade: item.qtd_informada?.toString() || '',
            unidade: item.unidade_informada || 'mg'
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
          const capsula = formula.embalagens.find((emb: any) => embalagens.some(e => e.id === emb.embalagem_id && e.categoria === 'Cápsulas'));
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

  // Mapeamento de embalagens por tipo de produto
  const EMBALAGENS_POR_TIPO: Record<string, { capsula: string | null; embalagens: string[] }> = {
    'Encapsulados': {
      capsula: '0e499d80-ca08-41ec-832d-035b37eb1656',
      embalagens: ['7bad5af1-6900-4b8a-944a-6810c7a56e6b', '7cb20b55-bb2c-4c85-9f7c-ca63e1b31a23', '18a9b933-3eba-4921-b800-5c0507d629a9'],
    },
    'Solúvel': {
      capsula: null,
      embalagens: ['6b8d9a17-b1b1-4660-acab-b4c8352a9451', 'ba19c064-3c9e-4bad-a4d7-b6b61da94557'],
    },
    'Gummy': {
      capsula: null,
      embalagens: ['7bad5af1-6900-4b8a-944a-6810c7a56e6b', '95ba10a6-58a1-4c7d-b70f-633b97f5f1e8', 'c4b906eb-ddf3-43bd-bb73-e326b78320ca'],
    },
    'Líquido': {
      capsula: null,
      embalagens: ['4fbf0747-5cc7-41bf-a40a-ddc0297ca446', 'a8ff3b3e-7386-4bcf-9a7e-66e295b9bc7c', 'fd44bb06-f6b8-4129-833a-5317a4d903a4', '88de1bd9-92e9-48d7-b0cd-578767e1cf6e'],
    },
  };

  // Dosador dinâmico para Solúvel baseado na dose em gramas
  const getDosadorId = (doseGramas: number): string | null => {
    if (doseGramas <= 5) return '46ca42b5-99cb-4bd8-9868-43f215810bd7'; // DOSADOR 4,5ml
    if (doseGramas <= 10) return '29be90e4-5828-4a4e-8c6e-09d1fc36d089'; // DOSADOR 8ml
    return 'f7353023-11c5-440f-a7c1-637403f873d1'; // DOSADOR 15,30ml
  };

  // Handler para troca MANUAL de tipo de produto — aplica defaults e embalagens
  const handleTipoProdutoChange = (novoTipo: 'Encapsulados' | 'Solúvel' | 'Gummy' | 'Líquido') => {
    setTipoProduto(novoTipo);

    // Defaults de quantidade e dose
    switch (novoTipo) {
      case 'Encapsulados':
        setQtdCapsulas('60');
        setUnidadesPorDose('2');
        break;
      case 'Solúvel':
        setUnidadeSoluvel('g');
        setQtdCapsulas('300');
        setUnidadesPorDose('10');
        break;
      case 'Gummy':
        setQtdCapsulas('60');
        setUnidadesPorDose('2');
        break;
      case 'Líquido':
        setQtdCapsulas('30');
        setUnidadesPorDose('1');
        break;
    }

    // Pré-seleção automática de embalagens
    const config = EMBALAGENS_POR_TIPO[novoTipo];
    if (config) {
      setSelectedCapsula(config.capsula);
      const newEmbalagens = new Set<string>(config.embalagens);
      if (novoTipo === 'Solúvel') {
        const doseG = 10; // default dose for Solúvel
        const dosadorId = getDosadorId(doseG);
        if (dosadorId) newEmbalagens.add(dosadorId);
      }
      setSelectedEmbalagens(newEmbalagens);
    }
  };

  // Atualizar dosador quando a dose muda para Solúvel
  useEffect(() => {
    if (tipoProduto !== 'Solúvel') return;
    const doseG = unidadeSoluvel === 'mg' ? (parseFloat(unidadesPorDose) || 3) / 1000 : (parseFloat(unidadesPorDose) || 3);
    const dosadorId = getDosadorId(doseG);
    if (!dosadorId) return;

    setSelectedEmbalagens(prev => {
      const newSet = new Set(prev);
      // Remove old dosadores
      ['46ca42b5-99cb-4bd8-9868-43f215810bd7', '29be90e4-5828-4a4e-8c6e-09d1fc36d089', 'f7353023-11c5-440f-a7c1-637403f873d1'].forEach(id => newSet.delete(id));
      newSet.add(dosadorId);
      return newSet;
    });
  }, [unidadesPorDose, unidadeSoluvel, tipoProduto]);

  // Converter valores para mg quando necessário (produtos Solúveis)
  const qtdCapsulasEmMG = useMemo(() => {
    if (tipoProduto !== 'Solúvel') return parseFloat(qtdCapsulas) || 0;
    const valor = parseFloat(qtdCapsulas) || 0;
    return unidadeSoluvel === 'g' ? valor * 1000 : valor;
  }, [qtdCapsulas, tipoProduto, unidadeSoluvel]);
  const unidadesPorDoseEmMG = useMemo(() => {
    if (tipoProduto !== 'Solúvel') return parseFloat(unidadesPorDose) || 0;
    const valor = parseFloat(unidadesPorDose) || 0;
    return unidadeSoluvel === 'g' ? valor * 1000 : valor;
  }, [unidadesPorDose, tipoProduto, unidadeSoluvel]);

  // Calculate costs
  const calculatedItems = useMemo(() => {
    return items.map(item => {
      if (!item.insumoNome || !item.quantidade) return null;
      const insumo = insumos.find(i => i.nome.toLowerCase() === item.insumoNome.toLowerCase());
      if (!insumo) {
        return {
          ...item,
          insumo: undefined,
          error: `Não temos em casa a matéria '${item.insumoNome}'.`,
          custo: 0
        };
      }
      try {
        const formulaItem: FormulaItem = {
          insumo_id: insumo.id,
          nome_insumo_snapshot: insumo.nome,
          qtd_informada: parseFloat(item.quantidade),
          unidade_informada: item.unidade,
          custo_calculado: 0
        };
        const custo = calcularCustoInsumo(formulaItem, insumo);
        return {
          ...item,
          insumo,
          custo,
          error: null
        };
      } catch (error: any) {
        return {
          ...item,
          insumo: undefined,
          error: error.message,
          custo: 0
        };
      }
    });
  }, [items, insumos]);

  // Calcula totais de insumos em MG (para Encapsulados e Pó)
  const totaisInsumosMG = useMemo(() => {
    if (tipoProduto !== 'Encapsulados' && tipoProduto !== 'Solúvel') return {
      totalMG: 0,
      itensMG: []
    };
    const itensMG = calculatedItems.map(item => {
      if (!item || !item.quantidade || !item.insumo || item.error) return null;
      const qtd = parseFloat(item.quantidade);
      const unidade = item.unidade;

      // Converter para MG
      let qtdEmMG = 0;
      switch (unidade) {
        case 'kg':
          qtdEmMG = qtd * 1_000_000;
          break;
        case 'g':
          qtdEmMG = qtd * 1000;
          break;
        case 'mg':
          qtdEmMG = qtd;
          break;
        case 'mcg':
          qtdEmMG = qtd / 1000;
          break;
        default:
          qtdEmMG = 0;
        // Volume/UI não conta para peso
      }
      return {
        nome: item.insumoNome,
        qtdMG: qtdEmMG,
        qtdOriginal: qtd,
        unidadeOriginal: unidade
      };
    }).filter(Boolean);
    const totalMG = itensMG.reduce((sum, item) => sum + (item?.qtdMG || 0), 0);
    return {
      totalMG,
      itensMG
    };
  }, [calculatedItems, tipoProduto]);

  // Calcula quantidade de excipiente necessário (somente para Encapsulados)
  const calcularExcipiente = useMemo(() => {
    // Excipiente só é usado em Encapsulados
    if (tipoProduto !== 'Encapsulados') {
      return {
        quantidade: 0,
        unidade: 'g' as UnitType,
        custo: 0
      };
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
          qtdEmGramas = 0;
        // Volume/UI não conta para peso
      }
      return sum + qtdEmGramas;
    }, 0);

    // Capacidade total da dose (cápsulas por dose × 1g cada)
    const capacidadeTotalDose = unidadesDose * CAPACIDADE_CAPSULA_GRAMAS;

    // Diferença é quanto de excipiente precisamos
    const diferencaGramas = Math.max(0, capacidadeTotalDose - totalInsumosDose);

    // Buscar o excipiente no banco
    const amidoMilho = insumos.find(i => i.nome.toLowerCase().includes('excipiente'));

    // Debug logs
    console.log('🔍 DEBUG Excipiente:', {
      tipoProduto,
      unidadesDose,
      totalInsumosDose: totalInsumosDose.toFixed(3),
      capacidadeTotalDose,
      diferencaGramas: diferencaGramas.toFixed(3),
      excipienteEncontrado: !!amidoMilho,
      totalItensCalculados: calculatedItems.filter(i => i && !i.error).length
    });
    if (!amidoMilho) {
      console.warn('⚠️ Excipiente não encontrado no inventário!');
      return {
        quantidade: 0,
        unidade: 'g' as UnitType,
        custo: 0
      };
    }
    if (diferencaGramas === 0) {
      console.log('ℹ️ Não há diferença para completar (cápsula já está cheia)');
      return {
        quantidade: 0,
        unidade: 'g' as UnitType,
        custo: 0
      };
    }

    // Calcular custo do excipiente POR DOSE
    const formulaItemExcipiente: FormulaItem = {
      insumo_id: amidoMilho.id,
      nome_insumo_snapshot: amidoMilho.nome,
      qtd_informada: diferencaGramas,
      unidade_informada: 'g',
      custo_calculado: 0
    };
    const custoExcipiente = calcularCustoInsumo(formulaItemExcipiente, amidoMilho);
    return {
      quantidade: diferencaGramas,
      unidade: 'g' as UnitType,
      custo: custoExcipiente,
      insumo: amidoMilho
    };
  }, [calculatedItems, tipoProduto, unidadesPorDose, insumos]);
  const custoUnitarioMP = useMemo(() => {
    const custoInsumos = calculatedItems.reduce((sum, item) => sum + (item?.custo || 0), 0);
    const custoExcipiente = calcularExcipiente.custo;
    return custoInsumos + custoExcipiente;
  }, [calculatedItems, calcularExcipiente]);
  const totalMP = useMemo(() => {
    const qtdTotal = tipoProduto === 'Solúvel' ? qtdCapsulasEmMG : parseFloat(qtdCapsulas) || 1;
    // Para Líquido, se unidadesPorDose vier vazia, assumir 1 mL por dose para que numDoses reflita o volume completo do pote
    const unidadesDose = tipoProduto === 'Solúvel'
      ? unidadesPorDoseEmMG
      : (parseFloat(unidadesPorDose) || (tipoProduto === 'Líquido' ? 1 : 1));

    // Calcula número de doses e multiplica pelo custo unitário por dose
    const numDoses = qtdTotal / unidadesDose;
    return custoUnitarioMP * numDoses;
  }, [custoUnitarioMP, qtdCapsulas, unidadesPorDose, tipoProduto, qtdCapsulasEmMG, unidadesPorDoseEmMG]);
  const custoCapsulas = useMemo(() => {
    // Se for Solúvel, Gummy ou Líquido, não há custo de cápsulas
    if (tipoProduto === 'Solúvel' || tipoProduto === 'Gummy' || tipoProduto === 'Líquido') return 0;
    if (!selectedCapsula) return 0;
    const capsula = embalagens.find(e => e.id === selectedCapsula);
    if (!capsula) return 0;
    const qtd = parseFloat(qtdCapsulas) || 0;
    return capsula.preco_unitario * qtd;
  }, [selectedCapsula, qtdCapsulas, tipoProduto, embalagens]);
  const capacidadeExcedida = useMemo(() => {
    if (tipoProduto === 'Encapsulados') {
      return totaisInsumosMG.totalMG > (parseFloat(unidadesPorDose) || 1) * 500;
    }
    if (tipoProduto === 'Solúvel') {
      return totaisInsumosMG.totalMG > unidadesPorDoseEmMG;
    }
    return false;
  }, [tipoProduto, totaisInsumosMG.totalMG, unidadesPorDose, unidadesPorDoseEmMG]);
  const custoEmbalagensExtras = useMemo(() => {
    return Array.from(selectedEmbalagens).reduce((sum, embId) => {
      const emb = embalagens.find(e => e.id === embId);
      // Excluir cápsulas do cálculo de embalagens extras
      if (emb && emb.categoria === 'Cápsulas') return sum;
      return sum + (emb ? emb.preco_unitario : 0);
    }, 0);
  }, [selectedEmbalagens, embalagens]);
  const totalEmbalagem = custoEmbalagensExtras + custoCapsulas;
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
    setItems([...items, {
      id: Date.now().toString(),
      insumoNome: '',
      quantidade: '',
      unidade: 'mg'
    }]);
  };
  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };
  const updateItem = (id: string, field: keyof FormulaItemInput, value: string) => {
    setItems(items.map(item => item.id === id ? {
      ...item,
      [field]: value
    } : item));
  };

  // Interface para itens parseados do dialog de importação
  interface ParsedItem {
    nomeOriginal: string;
    nomeEncontrado?: string;
    quantidade: number;
    unidade: string;
    encontrado: boolean;
    insumoMatch?: Insumo;
  }

  const handleImportarDose = (parsedItems: ParsedItem[]) => {
    const novosItens: FormulaItemInput[] = parsedItems.map((item, index) => ({
      id: Date.now().toString() + index,
      insumoNome: item.nomeEncontrado || item.nomeOriginal,
      quantidade: item.quantidade.toString(),
      unidade: item.unidade as UnitType
    }));
    
    setItems(prev => {
      // Remove itens vazios
      const semVazios = prev.filter(i => i.insumoNome.trim() !== '');
      return [...semVazios, ...novosItens];
    });
    
    toast.success(`${parsedItems.length} matéria${parsedItems.length !== 1 ? 's' : ''}-prima${parsedItems.length !== 1 ? 's' : ''} importada${parsedItems.length !== 1 ? 's' : ''}!`);
  };
  const handleSave = async () => {
    if (capacidadeExcedida) {
      toast.error('Capacidade de matéria-prima por dose excedida. Ajuste as quantidades antes de salvar.');
      return;
    }
    if (!cliente.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    const validItems = calculatedItems.filter(item => item && !item.error && item.custo > 0);
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um item válido à fórmula');
      return;
    }
    const formulaItems: FormulaItem[] = validItems.map(item => ({
      insumo_id: item!.insumo!.id,
      nome_insumo_snapshot: item!.insumo!.nome,
      qtd_informada: parseFloat(item!.quantidade),
      unidade_informada: item!.unidade,
      custo_calculado: item!.custo
    }));

    // Adicionar excipiente se houver
    if (tipoProduto === 'Encapsulados' && calcularExcipiente.quantidade > 0 && calcularExcipiente.insumo) {
      formulaItems.push({
        insumo_id: calcularExcipiente.insumo.id,
        nome_insumo_snapshot: 'Excipiente',
        qtd_informada: calcularExcipiente.quantidade,
        unidade_informada: calcularExcipiente.unidade,
        custo_calculado: calcularExcipiente.custo
      });
    }
    const embalagemItems: EmbalagemItem[] = [];

    // Adicionar cápsula selecionada (SOMENTE para Encapsulados)
    if (selectedCapsula && tipoProduto === 'Encapsulados') {
      const capsula = embalagens.find(e => e.id === selectedCapsula)!;
      embalagemItems.push({
        embalagem_id: capsula.id,
        descricao_snapshot: `${capsula.nome} (${qtdCapsulas || 0} unidades)`,
        custo_calculado: custoCapsulas
      });
    }

    // Adicionar outras embalagens (exceto cápsulas)
    Array.from(selectedEmbalagens).forEach(embId => {
      const emb = embalagens.find(e => e.id === embId);
      if (emb && emb.categoria !== 'Cápsulas') {
        embalagemItems.push({
          embalagem_id: emb.id,
          descricao_snapshot: `${emb.nome} - ${emb.descricao}`,
          custo_calculado: emb.preco_unitario
        });
      }
    });
    
    const formulaData = {
      cliente: clienteSelecionado?.nome || cliente,
      cliente_id: clienteSelecionado?.id || null,
      nome_formula: nomeFormula || 'Fórmula sem nome',
      tipo_produto: tipoProduto,
      quantidade_por_pote: tipoProduto === 'Solúvel' ? qtdCapsulasEmMG : parseFloat(qtdCapsulas) || 60,
      unidades_por_dose: tipoProduto === 'Solúvel' ? unidadesPorDoseEmMG : parseFloat(unidadesPorDose) || 1,
      unidade_soluvel: tipoProduto === 'Solúvel' ? unidadeSoluvel : undefined,
      itens: formulaItems as any,
      embalagens: embalagemItems as any,
      total_mp: totalMP,
      total_embalagem: totalEmbalagem,
      custo_total: custoTotal,
    };

    try {
      // Verificar se já existe fórmula com mesmo cliente e nome_formula (upsert)
      const { data: existing, error: searchError } = await supabase
        .from('formulas')
        .select('id')
        .ilike('cliente', cliente.trim())
        .eq('nome_formula', (nomeFormula || 'Fórmula sem nome').trim())
        .limit(1)
        .maybeSingle();

      if (searchError) throw searchError;

      if (existing) {
        // Atualizar fórmula existente
        const { error: updateError } = await supabase
          .from('formulas')
          .update(formulaData)
          .eq('id', existing.id);
        
        if (updateError) throw updateError;
        toast.success('Fórmula atualizada com sucesso!');
      } else {
        // Inserir nova
        addFormula(formulaData);
      }
    } catch (error: any) {
      console.error('Erro ao salvar fórmula:', error);
      toast.error('Erro ao salvar fórmula: ' + error.message);
      return;
    }

    // Reset form
    setCliente('');
    setClienteSelecionado(null);
    setNomeFormula('');
    setTipoProduto('Encapsulados');
    setQtdCapsulas('60');
    setUnidadesPorDose('2');
    setUnidadeSoluvel('mg');
    setItems([{
      id: Date.now().toString(),
      insumoNome: '',
      quantidade: '',
      unidade: 'mg'
    }]);
    setSelectedEmbalagens(new Set());
    setSelectedCapsula(null);
    clearCalculatorState();
  };
  const handleClear = () => {
    if (confirm('Limpar todos os campos?')) {
      setCliente('');
      setClienteSelecionado(null);
      setNomeFormula('');
      setTipoProduto('Encapsulados');
      setQtdCapsulas('60');
      setUnidadesPorDose('2');
      setUnidadeSoluvel('mg');
      setItems([{
        id: Date.now().toString(),
        insumoNome: '',
        quantidade: '',
        unidade: 'mg'
      }]);
      setSelectedEmbalagens(new Set());
      setSelectedCapsula(null);
      clearCalculatorState();
    }
  };
  return <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
      {loadingInsumos || loadingEmbalagens ? <Card className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Carregando inventário...</p>
        </Card> : <>
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
              <Label>Cliente *</Label>
              <ClienteSelector
                modo="basico"
                clienteSelecionado={clienteSelecionado}
                onSelect={(c) => { setClienteSelecionado(c); setCliente(c.nome); }}
                onClear={() => { setClienteSelecionado(null); setCliente(''); }}
              />
            </div>
            <div>
              <Label htmlFor="nomeFormula">Nome da Fórmula</Label>
              <Input id="nomeFormula" value={nomeFormula} onChange={e => setNomeFormula(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Configuração do Pote</CardTitle>
          <CardDescription>Tipo de produto e quantidades do frasco,              </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipoProduto">Tipo de Produto *</Label>
            <Select value={tipoProduto} onValueChange={value => handleTipoProdutoChange(value as 'Encapsulados' | 'Solúvel' | 'Gummy' | 'Líquido')}>
              <SelectTrigger id="tipoProduto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Encapsulados">Encapsulados</SelectItem>
                <SelectItem value="Solúvel">Solúvel</SelectItem>
                <SelectItem value="Gummy">Gummy</SelectItem>
                <SelectItem value="Líquido">Líquido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Unidade de Solúvel é sempre gramas agora */}

          <div className="space-y-2">
            <Label htmlFor="qtdCapsulas">
              {tipoProduto === 'Encapsulados' && 'Quantidade de Cápsulas *'}
              {tipoProduto === 'Gummy' && 'Quantidade de Gummies *'}
              {tipoProduto === 'Líquido' && 'Quantidade em mL *'}
              {tipoProduto === 'Solúvel' && `Quantidade Total de Solúvel (gramas) *`}
            </Label>
            <Input
              id="qtdCapsulas"
              type="number"
              min="1"
              value={qtdCapsulas}
              onChange={(e) => setQtdCapsulas(e.target.value)}
              placeholder={tipoProduto === 'Encapsulados' ? 'Ex: 60' : tipoProduto === 'Solúvel' ? 'Ex: 300' : tipoProduto === 'Gummy' ? 'Ex: 60' : 'Ex: 30'}
            />
            <p className="text-sm text-muted-foreground">
              {tipoProduto === 'Encapsulados' && 'Informe a quantidade total de cápsulas no produto'}
              {tipoProduto === 'Solúvel' && 'Informe a quantidade total em gramas do produto'}
              {tipoProduto === 'Gummy' && 'Informe a quantidade total de gummies no produto'}
              {tipoProduto === 'Líquido' && 'Informe a quantidade total em mL do produto'}
            </p>
          </div>
          
          {/* Campo de dosagem - visível para TODOS os tipos */}
          {<div className="space-y-2">
              <Label htmlFor="unidadesPorDose">
                {tipoProduto === 'Encapsulados' && 'Cápsulas por Dose *'}
                {tipoProduto === 'Gummy' && 'Gummies por Dose *'}
                {tipoProduto === 'Líquido' && 'mL por Dose *'}
                {tipoProduto === 'Solúvel' && `${unidadeSoluvel === 'mg' ? 'Miligramas' : 'Gramas'} por Dose (Dose Diária) *`}
              </Label>
              <Input id="unidadesPorDose" type="number" min="0.1" step={tipoProduto === 'Solúvel' && unidadeSoluvel === 'g' ? '0.1' : '1'} value={unidadesPorDose} onChange={e => setUnidadesPorDose(e.target.value)} placeholder={tipoProduto === 'Encapsulados' ? 'Ex: 2' : tipoProduto === 'Gummy' ? 'Ex: 1' : tipoProduto === 'Líquido' ? 'Ex: 5' : unidadeSoluvel === 'mg' ? 'Ex: 3000' : 'Ex: 3'} />
              <p className="text-sm text-muted-foreground">
                {tipoProduto === 'Encapsulados' && 'Quantas cápsulas compõem uma dose? Ex: 2 cápsulas = 1 dose'}
                {tipoProduto === 'Gummy' && 'Quantos gummies compõem uma dose? Ex: 1 gummy = 1 dose'}
                {tipoProduto === 'Líquido' && 'Quantos mL compõem uma dose? Ex: 5 mL = 1 dose'}
                {tipoProduto === 'Solúvel' && unidadeSoluvel === 'mg' && 'Quantos miligramas por dose diária? Ex: 3000mg por dose (essa é a dose base da sua tabela de MP)'}
                {tipoProduto === 'Solúvel' && unidadeSoluvel === 'g' && 'Quantas gramas por dose diária? Ex: 3g por dose (essa é a dose base da sua tabela de MP)'}
              </p>
              
              {/* Exibir cálculo do número de doses */}
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-950 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  📊 Número de doses: {Math.floor((tipoProduto === 'Solúvel' ? qtdCapsulasEmMG : parseFloat(qtdCapsulas) || 0) / (tipoProduto === 'Solúvel' ? unidadesPorDoseEmMG : parseFloat(unidadesPorDose) || 1))}
                </p>
                {tipoProduto === 'Solúvel' && <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    O custo de matéria-prima será: custo por dose × {Math.floor((qtdCapsulasEmMG || 0) / (unidadesPorDoseEmMG || 1))} doses
                  </p>}
              </div>
            </div>}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Itens da Fórmula</CardTitle>
          <CardDescription>Adicione os insumos e quantidades POR DOSE!  </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Botão para importar dose copiada */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            className="w-full border-dashed"
          >
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Adicionar Dose copiada
          </Button>

          {items.map((item, index) => {
            const calculated = calculatedItems[index];
            return <div key={item.id} className="space-y-2">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-5">
                    <Label>Matéria-Prima</Label>
                    <InsumoAutocomplete
                      insumos={insumos}
                      value={item.insumoNome}
                      onSelect={(insumo) => {
                        updateItem(item.id, 'insumoNome', insumo.nome);
                      }}
                      placeholder="Selecione a matéria-prima..."
                    />
                  </div>

                  <div className="col-span-3">
                    <Label>Quantidade</Label>
                    <Input type="number" step="any" value={item.quantidade} onChange={e => updateItem(item.id, 'quantidade', e.target.value)} placeholder="0" />
                  </div>

                  <div className="col-span-2">
                    <Label>Unidade</Label>
                    <Select value={item.unidade} onValueChange={value => updateItem(item.id, 'unidade', value as UnitType)}>
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
                        <SelectItem value="unidade">Unidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 flex items-end gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {calculated?.error && <p className="text-sm text-destructive font-medium">{calculated.error}</p>}
                {calculated && !calculated.error && calculated.custo > 0 && <div className="text-sm space-y-1">
                    <p className="text-primary font-medium">
                      Custo: {formatCurrencyDetailed(calculated.custo)}
                    </p>
                    
                    {/* Conversões de unidades para Pó */}
                    {tipoProduto === 'Solúvel' && <p className="text-muted-foreground text-xs">
                        Por dose: {item.quantidade}{item.unidade}
                        {item.unidade === 'mg' && ` = ${(parseFloat(item.quantidade) / 1000).toFixed(3)}g = ${(parseFloat(item.quantidade) / 1_000_000).toFixed(6)}kg`}
                        {item.unidade === 'g' && ` = ${(parseFloat(item.quantidade) * 1000).toFixed(2)}mg = ${(parseFloat(item.quantidade) / 1000).toFixed(6)}kg`}
                        {item.unidade === 'kg' && ` = ${(parseFloat(item.quantidade) * 1_000_000).toFixed(2)}mg = ${(parseFloat(item.quantidade) * 1000).toFixed(3)}g`}
                      </p>}
                  </div>}
              </div>;
          })}

          <Button type="button" variant="outline" onClick={addItem} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Item
          </Button>
        </CardContent>
      </Card>

      {/* NOVA SEÇÃO: Conversões Rápidas - só para Solúvel */}
      {tipoProduto === 'Solúvel' && parseFloat(qtdCapsulas) > 0 && parseFloat(unidadesPorDose) > 0 && <Card className="shadow-md border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔄 Conversões Rápidas
            </CardTitle>
            <CardDescription>
              Visualize as quantidades em diferentes unidades
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Quantidade total do pote */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Quantidade total (pote)</p>
                <p className="font-bold text-lg">
                  {qtdCapsulas}{unidadeSoluvel}
                </p>
                <p className="text-sm text-primary">
                  {unidadeSoluvel === 'mg' ? `${(parseFloat(qtdCapsulas) / 1000).toFixed(2)}g` : `${(parseFloat(qtdCapsulas) * 1000).toFixed(0)}mg`}
                </p>
                <p className="text-sm text-primary">
                  {unidadeSoluvel === 'mg' ? `${(parseFloat(qtdCapsulas) / 1_000_000).toFixed(6)}kg` : `${(parseFloat(qtdCapsulas) / 1000).toFixed(6)}kg`}
                </p>
              </div>
              
              {/* Dose diária */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Dose diária</p>
                <p className="font-bold text-lg">
                  {unidadesPorDose}{unidadeSoluvel}
                </p>
                <p className="text-sm text-primary">
                  {unidadeSoluvel === 'mg' ? `${(parseFloat(unidadesPorDose) / 1000).toFixed(2)}g` : `${(parseFloat(unidadesPorDose) * 1000).toFixed(0)}mg`}
                </p>
                <p className="text-sm text-primary">
                  {unidadeSoluvel === 'mg' ? `${(parseFloat(unidadesPorDose) / 1_000_000).toFixed(6)}kg` : `${(parseFloat(unidadesPorDose) / 1000).toFixed(6)}kg`}
                </p>
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Número de doses no pote: <span className="font-bold text-primary">{Math.floor((qtdCapsulasEmMG || 0) / (unidadesPorDoseEmMG || 1))}</span>
              </p>
            </div>
          </CardContent>
        </Card>}

      {/* NOVA SEÇÃO: Análise da Composição do Solúvel */}
      {tipoProduto === 'Solúvel' && totaisInsumosMG.totalMG > 0 && <Card className="shadow-md border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              📊 Análise da Composição do Solúvel
            </CardTitle>
            <CardDescription>
              Breakdown detalhado das matérias-primas em miligramas (mg)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lista de insumos convertidos para MG */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Matérias-Primas da Fórmula (por dose diária):</p>
              <div className="space-y-1 pl-3">
                {totaisInsumosMG.itensMG.map((item: any, idx: number) => <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      • {item.nome}:
                    </span>
                    <span className="font-medium">
                      {item.qtdMG.toFixed(2)}mg ({item.qtdOriginal}{item.unidadeOriginal})
                    </span>
                  </div>)}
              </div>
            </div>

            {/* Total de insumos por dose */}
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/20 dark:border-green-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                  ⚖️ Total por Dose Diária:
                </span>
                <span className="text-lg font-bold text-green-700 dark:text-green-300">
                  {totaisInsumosMG.totalMG.toFixed(2)}mg ({(totaisInsumosMG.totalMG / 1000).toFixed(3)}g | {(totaisInsumosMG.totalMG / 1_000_000).toFixed(6)}kg)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Dose diária: {(unidadesPorDoseEmMG / 1000).toFixed(2)}g ({unidadesPorDoseEmMG.toFixed(0)}mg de pó)
              </p>
            </div>

            {/* Total do pote */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/20 dark:border-blue-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  🏺 Total no Pote:
                </span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {(() => {
                  const numeroDoses = Math.floor((qtdCapsulasEmMG || 0) / (unidadesPorDoseEmMG || 1));
                  const totalInsumosPote = totaisInsumosMG.totalMG * numeroDoses;
                  return `${totalInsumosPote.toFixed(2)}mg (${(totalInsumosPote / 1000).toFixed(3)}g | ${(totalInsumosPote / 1_000_000).toFixed(6)}kg)`;
                })()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totaisInsumosMG.totalMG.toFixed(2)}mg × {Math.floor((qtdCapsulasEmMG || 0) / (unidadesPorDoseEmMG || 1))} doses = Total de matérias-primas no pote
              </p>
            </div>

            {/* Alerta amber: quase cheio (≥90%) */}
            {tipoProduto === 'Solúvel' && totaisInsumosMG.totalMG >= unidadesPorDoseEmMG * 0.9 && totaisInsumosMG.totalMG <= unidadesPorDoseEmMG && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Dose quase cheia
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Os insumos estão preenchendo {(totaisInsumosMG.totalMG / unidadesPorDoseEmMG * 100).toFixed(1)}% da capacidade da dose ({unidadesPorDoseEmMG.toFixed(0)}mg)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Alerta vermelho: excedido */}
            {tipoProduto === 'Solúvel' && totaisInsumosMG.totalMG > unidadesPorDoseEmMG && (
              <div className="p-3 bg-red-50 border-2 border-red-300 rounded-lg dark:bg-red-950/20 dark:border-red-800 animate-pulse">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-900 dark:text-red-100">
                      ⚠️ ATENÇÃO: Capacidade da dose excedida!
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      A quantidade de insumos ({totaisInsumosMG.totalMG.toFixed(2)}mg) excede a capacidade da dose ({unidadesPorDoseEmMG.toFixed(0)}mg).
                      Excedente: {(totaisInsumosMG.totalMG - unidadesPorDoseEmMG).toFixed(2)}mg. Aumente a dose ou reduza as quantidades.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Composição do pó</p>
                  <p>
                    O pote contém {(qtdCapsulasEmMG / 1000).toFixed(2)}g ({qtdCapsulasEmMG.toFixed(0)}mg) de pó total, 
                    dividido em {Math.floor((qtdCapsulasEmMG || 0) / (unidadesPorDoseEmMG || 1))} doses de {(unidadesPorDoseEmMG / 1000).toFixed(2)}g ({unidadesPorDoseEmMG.toFixed(0)}mg) cada
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>}

      {/* NOVA SEÇÃO: Análise da Composição da Dose - só para Encapsulados */}
      {tipoProduto === 'Encapsulados' && totaisInsumosMG.totalMG > 0 && <Card className="shadow-md border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              📊 Análise da Composição da Dose
            </CardTitle>
            <CardDescription>
              Breakdown detalhado dos insumos e cálculo do excipiente necessário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lista de insumos convertidos para MG */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Insumos da Fórmula (por dose):</p>
              <div className="space-y-1 pl-3">
                {totaisInsumosMG.itensMG.map((item: any, idx: number) => <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      • {item.nome}:
                    </span>
                    <span className="font-medium">
                      {item.qtdMG.toFixed(2)}mg ({item.qtdOriginal}{item.unidadeOriginal})
                    </span>
                  </div>)}
              </div>
            </div>

            {/* Total de insumos */}
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/20 dark:border-green-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                  ⚖️ Total de Insumos:
                </span>
                <span className="text-lg font-bold text-green-700 dark:text-green-300">
                  {totaisInsumosMG.totalMG.toFixed(2)}mg ({(totaisInsumosMG.totalMG / 1000).toFixed(3)}g)
                </span>
              </div>
            </div>

            {/* Capacidade da dose */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/20 dark:border-blue-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  💊 Capacidade da Dose:
                </span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {parseFloat(unidadesPorDose) || 0} cápsulas × 500mg = {((parseFloat(unidadesPorDose) || 0) * 500).toFixed(0)}mg
                </span>
              </div>
            </div>

            {/* Excipiente necessário */}
            {calcularExcipiente.quantidade > 0 ? <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-950/20 dark:border-orange-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                    <Wheat className="h-4 w-4" />
                    Excipiente Necessário:
                  </span>
                  <span className="text-lg font-bold text-orange-700 dark:text-orange-300">
                    {(calcularExcipiente.quantidade * 1000).toFixed(2)}mg ({calcularExcipiente.quantidade.toFixed(3)}g)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Cálculo: {((parseFloat(unidadesPorDose) || 0) * 500).toFixed(0)}mg - {totaisInsumosMG.totalMG.toFixed(2)}mg = {(calcularExcipiente.quantidade * 1000).toFixed(2)}mg
                </p>
              </div> : <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Cápsula quase cheia ou completa
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Os insumos estão preenchendo toda ou quase toda a capacidade da cápsula ({(totaisInsumosMG.totalMG / ((parseFloat(unidadesPorDose) || 1) * 500) * 100).toFixed(1)}% preenchido)
                    </p>
                  </div>
                </div>
              </div>}

            {/* Alerta se exceder capacidade */}
            {totaisInsumosMG.totalMG > (parseFloat(unidadesPorDose) || 1) * 500 && <div className="p-3 bg-red-50 border-2 border-red-300 rounded-lg dark:bg-red-950/20 dark:border-red-800 animate-pulse">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-900 dark:text-red-100">
                      ⚠️ ATENÇÃO: Capacidade excedida!
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      A quantidade de insumos ({totaisInsumosMG.totalMG.toFixed(2)}mg) excede a capacidade total da dose ({((parseFloat(unidadesPorDose) || 1) * 500).toFixed(0)}mg).
                      Considere aumentar o número de cápsulas por dose ou reduzir as quantidades.
                    </p>
                  </div>
                </div>
              </div>}
          </CardContent>
        </Card>}

      {/* Card Visual: Composição da Cápsula - só para Encapsulados */}
      {tipoProduto === 'Encapsulados' && totaisInsumosMG.totalMG > 0 && <Card className="shadow-md border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-purple-600" />
              💊 Visualização da Composição da Cápsula
            </CardTitle>
            <CardDescription>
              Percentual de preenchimento da dose
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
            const capacidadeTotalMG = (parseFloat(unidadesPorDose) || 1) * 500;
            const totalInsumosMG = totaisInsumosMG.totalMG;
            const excipienteMG = calcularExcipiente.quantidade * 1000;
            const percInsumos = Math.min(totalInsumosMG / capacidadeTotalMG * 100, 100);
            const percExcipiente = Math.min(excipienteMG / capacidadeTotalMG * 100, 100 - percInsumos);
            const percVazio = Math.max(100 - percInsumos - percExcipiente, 0);
            return <>
                  {/* Barra de progresso visual */}
                  <div className="space-y-2">
                    <div className="w-full h-8 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex">
                      {percInsumos > 0 && <div className="bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white text-xs font-bold transition-all duration-500" style={{
                    width: `${percInsumos}%`
                  }}>
                          {percInsumos >= 10 && `${percInsumos.toFixed(1)}%`}
                        </div>}
                      {percExcipiente > 0 && <div className="bg-gradient-to-r from-orange-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-500" style={{
                    width: `${percExcipiente}%`
                  }}>
                          {percExcipiente >= 10 && `${percExcipiente.toFixed(1)}%`}
                        </div>}
                      {percVazio > 0 && <div className="bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 text-xs font-medium" style={{
                    width: `${percVazio}%`
                  }}>
                          {percVazio >= 10 && `${percVazio.toFixed(1)}%`}
                        </div>}
                    </div>
                    
                    {/* Legenda */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-green-600 rounded"></div>
                        <div>
                          <p className="font-semibold">Insumos Ativos</p>
                          <p className="text-muted-foreground">{percInsumos.toFixed(1)}% • {totalInsumosMG.toFixed(1)}mg</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-r from-orange-400 to-orange-500 rounded"></div>
                        <div>
                          <p className="font-semibold">Excipiente</p>
                          <p className="text-muted-foreground">{percExcipiente.toFixed(1)}% • {excipienteMG.toFixed(1)}mg</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                        <div>
                          <p className="font-semibold">Vazio</p>
                          <p className="text-muted-foreground">{percVazio.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info adicional */}
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1">Capacidade por cápsula: 500mg (0.5g)</p>
                        <p>
                          Dose total: {parseFloat(unidadesPorDose) || 0} cápsula(s) = {capacidadeTotalMG}mg de capacidade
                        </p>
                      </div>
                    </div>
                  </div>
                </>;
          })()}
          </CardContent>
        </Card>}

      {/* Card informativo do Excipiente - MELHORADO - só para Encapsulados */}
      {tipoProduto === 'Encapsulados' && calcularExcipiente.quantidade > 0 && <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-300 dark:from-blue-950/20 dark:to-blue-900/10 dark:border-blue-800 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wheat className="h-5 w-5 text-blue-600" />
              🔬 Detalhamento do Excipiente
            </CardTitle>
            <CardDescription className="text-xs">
              Completamento automático da capacidade da cápsula
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Por Dose */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">📦 Por Dose:</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Quantidade:</p>
                  <p className="font-bold text-blue-700 dark:text-blue-300">
                    {(calcularExcipiente.quantidade * 1000).toFixed(2)}mg ({calcularExcipiente.quantidade.toFixed(3)}g)
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Custo:</p>
                  <p className="font-bold text-blue-700 dark:text-blue-300">{formatCurrency(calcularExcipiente.custo)}</p>
                </div>
              </div>
            </div>

            {/* Por Pote Total */}
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-300 dark:border-blue-700">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">🏺 Por Pote Total:</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Quantidade total:</p>
                  <p className="font-bold text-blue-800 dark:text-blue-200">
                    {(calcularExcipiente.quantidade * 1000 * Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))).toFixed(2)}mg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(calcularExcipiente.quantidade * 1000).toFixed(2)}mg × {Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))} doses
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Custo total:</p>
                  <p className="font-bold text-blue-800 dark:text-blue-200">
                    {formatCurrency(calcularExcipiente.custo * Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1)))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(calcularExcipiente.custo)} × {Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))} doses
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-2 bg-white dark:bg-slate-900 rounded border text-xs">
              <p className="text-muted-foreground italic flex items-center gap-1">
                <Info className="h-3 w-3" />
                Este valor já está incluído no custo total de matéria-prima
              </p>
            </div>
          </CardContent>
        </Card>}

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Embalagem</CardTitle>
          <CardDescription>Selecione os itens de embalagem organizados por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <EmbalagensHierarchy
            embalagens={embalagens}
            selectedIds={selectedEmbalagens}
            onToggle={(id) => {
              const newSet = new Set(selectedEmbalagens);
              if (newSet.has(id)) {
                newSet.delete(id);
              } else {
                newSet.add(id);
              }
              setSelectedEmbalagens(newSet);
            }}
            selectedCapsulaId={selectedCapsula}
            onCapsulaSelect={(id) => setSelectedCapsula(selectedCapsula === id ? null : id)}
            qtdCapsulas={parseFloat(qtdCapsulas) || 0}
            tipoProduto={tipoProduto}
          />

          {tipoProduto === 'Encapsulados' && embalagens.filter(emb => emb.categoria === 'Cápsulas').length > 0 && !selectedCapsula && (
            <p className="text-sm text-amber-600 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
              ⚠️ Selecione um tipo de cápsula para prosseguir
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Matéria-Prima
            </CardTitle>
            <CardDescription className="text-xs">
              Breakdown detalhado de insumos e excipiente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Custo dos Insumos (sem excipiente) */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-primary/80">💊 Custo dos Insumos (sem excipiente):</p>
              <div className="pl-3 space-y-0.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Por dose:</span>
                  <span className="font-medium">
                    {formatCurrencyPrecise(calculatedItems.reduce((sum, item) => sum + (item?.custo || 0), 0))}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total ({Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))} doses):</span>
                  <span className="font-medium">
                    {formatCurrencyPrecise(calculatedItems.reduce((sum, item) => sum + (item?.custo || 0), 0) * Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1)))}
                  </span>
                </div>
              </div>
            </div>

            {/* Custo do Excipiente */}
            {tipoProduto === 'Encapsulados' && calcularExcipiente.quantidade > 0 && <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">🌾 Custo do Excipiente:</p>
                <div className="pl-3 space-y-0.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Por dose:</span>
                    <span className="font-medium text-blue-600">
                      {formatCurrencyDetailed(calcularExcipiente.custo)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total ({Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))} doses):</span>
                    <span className="font-medium text-blue-600">
                      {formatCurrency(calcularExcipiente.custo * Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1)))}
                    </span>
                  </div>
                </div>
              </div>}

            <div className="border-t-2 border-primary/30 pt-2 mt-3">
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground uppercase">💰 Total Matéria-Prima:</p>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Por dose:</span>
                  <span className="font-semibold">{formatCurrencyPrecise(custoUnitarioMP)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground">Total pote:</span>
                  <p className="text-3xl font-bold text-primary">{formatCurrencyPrecise(totalMP)}</p>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-1">
              <p>• {unidadesPorDose} {tipoProduto === 'Encapsulados' ? 'cápsulas' : tipoProduto === 'Gummy' ? 'gummies' : tipoProduto === 'Líquido' ? 'mL' : 'g'} por dose</p>
              <p>• {Math.floor((parseFloat(qtdCapsulas) || 0) / (parseFloat(unidadesPorDose) || 1))} doses no pote</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] border-primary/15">
          <CardHeader>
            <CardTitle className="text-primary">Embalagem</CardTitle>
            <CardDescription>
              {tipoProduto === 'Encapsulados' ? 'Cápsulas + Embalagens por categoria' : 'Embalagens por categoria'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedCapsula && tipoProduto === 'Encapsulados' && <div className="flex justify-between text-sm text-muted-foreground">
                <span>{embalagens.find(e => e.id === selectedCapsula)?.nome} ({qtdCapsulas}x):</span>
                <span>{formatCurrencyDetailed(custoCapsulas)}</span>
              </div>}
            
            {Object.entries(custosPorSubcategoria).filter(([categoria]) => categoria !== 'Cápsulas').map(([categoria, subcategorias]) => <div key={categoria} className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground/80 pt-2">
                  {categoria}:
                </div>
                {Object.entries(subcategorias).map(([subcategoria, custo]) => <div key={subcategoria} className="flex justify-between text-sm text-muted-foreground pl-3">
                    <span className="text-xs">• {subcategoria}:</span>
                    <span className="text-xs">{formatCurrencyDetailed(custo)}</span>
                  </div>)}
              </div>)}
            
            
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
        <Button onClick={handleSave} disabled={!cliente || custoTotal === 0 || capacidadeExcedida}>
          <Save className="w-4 h-4 mr-2" />
          Salvar Cálculo
        </Button>
      </div>
      </>}

      {/* Dialog para importar dose copiada */}
      <ImportarDoseDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        insumos={insumos}
        onImport={handleImportarDose}
      />
    </div>;
}