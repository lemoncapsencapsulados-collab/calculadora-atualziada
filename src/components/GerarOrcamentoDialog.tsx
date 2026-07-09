import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import ConsultorCombobox from '@/components/ConsultorCombobox';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { validarMargemPorTipo } from '@/lib/precificacaoCalculator';
import { arredondarReais } from '@/lib/utils';
import { Orcamento, ItemProducao, ServicoMarca, OrcamentoInsert, InsumoSnapshot, DetalhamentoEnvio, CondicoesPagamento, TipoOrcamento, Entregavel } from '@/types/orcamento';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Package, 
  Palette,
  Check,
  X,
  UserCircle,
  User,
  Truck,
  Settings2,
  AlertTriangle,
  Pencil,
  Lock,
  LockOpen,
  Star,
} from 'lucide-react';
import { DadosCliente, DetalhamentoFrete } from '@/types/orcamento';
import CondicoesPagamentoForm from './CondicoesPagamentoForm';
import ClienteSelector from '@/components/ClienteSelector';
import { Cliente, useClientes } from '@/hooks/useClientes';
import SetupPlanosStep, { buildPlanosSelecionados, PlanoSelecionado } from '@/components/orcamento/SetupPlanosStep';
import { useSetupPlanos, SetupPlanoPerfil } from '@/hooks/useSetupPlanos';
import EstabilidadeAnvisaStep from '@/components/orcamento/EstabilidadeAnvisaStep';
import { fetchEnderecoPorCEP, UFS_BRASIL } from '@/lib/brasilData';

const CUSTO_ESTABILIDADE_PADRAO = 4100;
const CUSTO_ANVISA_PADRAO = 1750;

// ── Setup cost types ──
interface SetupItem {
  id: string;
  nome: string;
  selecionado: boolean;
  custoUnitario: number;
  quantidade: number;
}

interface SetupImpressaoItem {
  tipoProduto: string;
  custoUnitario: number;
  quantidade: number;
}

const CUSTOS_IMPRESSAO: Record<string, number> = {
  'Encapsulados': 940,
  'Gummy': 1340,
  'Líquido': 740,
  'Solúvel': 1590,
};

interface GerarOrcamentoDialogProps {
  orcamentoExistente?: Orcamento | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GerarOrcamentoDialog({ 
  orcamentoExistente, 
  onClose,
  onSuccess 
}: GerarOrcamentoDialogProps) {
  const { createOrcamento, updateOrcamento, getNextNumeroOrcamento } = useOrcamentos();
  const { precificacoes } = usePrecificacao();
  const { buscarPorId } = useClientes();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Informações básicas
  const [tipoOrcamento, setTipoOrcamento] = useState<TipoOrcamento>('novo_produtor');
  const [nomeCliente, setNomeCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [consultorResponsavel, setConsultorResponsavel] = useState('');
  const [validadeDias, setValidadeDias] = useState(30);
  const [observacoes, setObservacoes] = useState('');
  
  // Step 2: Itens de produção
  const [itensProducao, setItensProducao] = useState<ItemProducao[]>([]);
  const [showPrecificacaoSelector, setShowPrecificacaoSelector] = useState(false);
  const [showCatalogoSelector, setShowCatalogoSelector] = useState(false);
  const [buscaPrecificacao, setBuscaPrecificacao] = useState('');
  const [showImportarCatalogo, setShowImportarCatalogo] = useState(false);
  const [selectedParaCatalogo, setSelectedParaCatalogo] = useState<string[]>([]);
  const [buscaImportarCatalogo, setBuscaImportarCatalogo] = useState('');
  const [importandoCatalogo, setImportandoCatalogo] = useState(false);
  const qc = useQueryClient();
  const [selectedPrecificacoes, setSelectedPrecificacoes] = useState<string[]>([]);
  
  // Step 3: Setup costs
  const [setupItems, setSetupItems] = useState<SetupItem[]>([
    { id: 'codigo_barras', nome: 'Código de barras', selecionado: false, custoUnitario: 5.70, quantidade: 0 },
    { id: 'design_rotulos', nome: 'Design de rótulos', selecionado: false, custoUnitario: 200, quantidade: 0 },
    { id: 'pagina_vendas', nome: 'Página de vendas', selecionado: false, custoUnitario: 300, quantidade: 0 },
    { id: 'registro_inpi', nome: 'Registro de Marca no INPI', selecionado: false, custoUnitario: 880, quantidade: 1 },
  ]);
  const [setupImpressaoSelecionado, setSetupImpressaoSelecionado] = useState(false);
  const [setupImpressaoItens, setSetupImpressaoItens] = useState<SetupImpressaoItem[]>([]);
  const [margemSetup, setMargemSetup] = useState(20);
  const [senhaSetupDialog, setSenhaSetupDialog] = useState(false);
  const [senhaSetupInput, setSenhaSetupInput] = useState('');
  const [setupMargemLiberada, setSetupMargemLiberada] = useState(false);

  // Step 3 (novo fluxo): planos de setup por perfil
  const [setupPerfil, setSetupPerfil] = useState<SetupPlanoPerfil | null>(null);
  const [planoQtdMap, setPlanoQtdMap] = useState<Record<string, number>>({});
  const { data: setupPlanosDoPerfil = [] } = useSetupPlanos(setupPerfil ?? undefined);

  // Edição de custo de impressão protegida por senha
  const [impressaoEdicaoLiberada, setImpressaoEdicaoLiberada] = useState(false);
  const [senhaImpressaoDialog, setSenhaImpressaoDialog] = useState(false);
  const [senhaImpressaoInput, setSenhaImpressaoInput] = useState('');

  // Modo de cálculo: margem ou valor fixo
  const [modoCalculoSetup, setModoCalculoSetup] = useState<'margem' | 'valor_fixo'>('margem');
  const [valorFixoSetup, setValorFixoSetup] = useState(0);

  // Step 5: Dados opcionais (cliente e frete)
  const [dadosClienteTemp, setDadosClienteTemp] = useState<DadosCliente>({ tipo_pessoa: 'pj' });
  const [detalhamentoFreteTemp, setDetalhamentoFreteTemp] = useState<DetalhamentoFrete | null>(null);
  const [showFreteInline, setShowFreteInline] = useState(false);

  // Condições de pagamento (step 4)
  const [condicoesPagamento, setCondicoesPagamento] = useState<CondicoesPagamento>({});

  // Pendências obrigatórias de Info Cliente (Passo Salvar)
  const clientePendencias = useMemo(() => {
    const p: string[] = [];
    const tipo = dadosClienteTemp.tipo_pessoa || 'pj';
    if (tipo === 'pj') {
      const cnpjNums = (dadosClienteTemp.cnpj || '').replace(/\D/g, '');
      if (cnpjNums.length !== 14) p.push('CNPJ');
      if (!dadosClienteTemp.razao_social?.trim()) p.push('Razão Social');
    } else {
      if (!dadosClienteTemp.nome_completo?.trim()) p.push('Nome Completo');
      const cpfNums = (dadosClienteTemp.cpf || '').replace(/\D/g, '');
      if (cpfNums.length !== 11) p.push('CPF');
    }
    if (!dadosClienteTemp.email?.trim()) p.push('Email');
    const telNums = (dadosClienteTemp.telefone || '').replace(/\D/g, '');
    if (telNums.length < 10) p.push('Telefone');
    // Endereço obrigatório (comum a PJ e PF) — lido dos campos endereco_cnpj/*
    const cepNums = (dadosClienteTemp.cep_cnpj || '').replace(/\D/g, '');
    if (cepNums.length !== 8) p.push('CEP');
    if (!dadosClienteTemp.endereco_cnpj?.trim()) p.push('Logradouro');
    if (!dadosClienteTemp.numero_cnpj?.trim()) p.push('Número');
    if (!dadosClienteTemp.bairro_cnpj?.trim()) p.push('Bairro');
    if (!dadosClienteTemp.cidade?.trim()) p.push('Cidade');
    if (!dadosClienteTemp.estado?.trim()) p.push('Estado');
    return p;
  }, [dadosClienteTemp]);

  // Step 4 (novo): Estabilidade + Notificação Anvisa
  const [custoEstabilidadeUnit, setCustoEstabilidadeUnit] = useState<number>(CUSTO_ESTABILIDADE_PADRAO);
  const [custoAnvisaUnit, setCustoAnvisaUnit] = useState<number>(CUSTO_ANVISA_PADRAO);
  const [estabilidadeEdicaoLiberada, setEstabilidadeEdicaoLiberada] = useState(false);
  const [estabilidadeAtiva, setEstabilidadeAtiva] = useState<boolean>(true);
  const [anvisaAtiva, setAnvisaAtiva] = useState<boolean>(true);

  // Estado para liberação de margem mínima com senha
  const [senhaMargemOrcDialog, setSenhaMargemOrcDialog] = useState(false);
  const [senhaMargemOrcInput, setSenhaMargemOrcInput] = useState('');
  const [margemOrcLiberadaIds, setMargemOrcLiberadaIds] = useState<string[]>([]);
  const SENHA_LIBERACAO_MARGEM = '0B%s8QP2Z+Do';

  // ── Edição de preço por item (negociação) ──
  // Dados auxiliares por precificacao_id (custo unitário e preço original do catálogo)
  const [itemPrecoAux, setItemPrecoAux] = useState<Record<string, { custoUnit: number; precoOriginal: number }>>({});
  // Índices de itens cuja margem abaixo do mínimo foi liberada por senha
  const [precoLiberadoIdxs, setPrecoLiberadoIdxs] = useState<number[]>([]);
  // Dialog de senha para liberar preço abaixo do mínimo
  const [senhaPrecoDialog, setSenhaPrecoDialog] = useState(false);
  const [senhaPrecoInput, setSenhaPrecoInput] = useState('');
  // Rascunho local do preço unitário (por índice) — só aplica ao confirmar
  const [precoDraft, setPrecoDraft] = useState<Record<number, string>>({});
  const [pendingPreco, setPendingPreco] = useState<{ index: number; novoPreco: number } | null>(null);

  // Calcula margem efetiva (líquida) de um item dado preço e custo unitário
  // Mesma fórmula do setup: margem = (1 - custo/preco - impostos) * 100, impostos = 16%
  const calcMargemItem = (preco: number, custoUnit: number) => {
    if (preco <= 0) return 0;
    return (1 - custoUnit / preco - 0.16) * 100;
  };

  // Retorna info de margem do item (ou null se não há custo conhecido)
  const getItemMargemInfo = (index: number) => {
    const item = itensProducao[index];
    if (!item || !item.precificacao_id) return null;
    const aux = itemPrecoAux[item.precificacao_id];
    if (!aux || aux.custoUnit <= 0) return null;
    const margem = calcMargemItem(item.preco_unitario, aux.custoUnit);
    const validacao = validarMargemPorTipo(margem, item.segmento || 'Encapsulados');
    return { margem, validacao, custoUnit: aux.custoUnit, precoOriginal: aux.precoOriginal };
  };

  const aplicarPrecoNoItem = (index: number, novoPreco: number) => {
    setItensProducao(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const qtd = item.modelo_negocio === 'print_on_demand' ? 0 : (item.quantidade || 1);
      return {
        ...item,
        preco_unitario: arredondarReais(novoPreco),
        subtotal: arredondarReais(novoPreco * qtd),
      };
    }));
  };

  const handleUpdateItemPreco = (index: number, novoPrecoRaw: number) => {
    const novoPreco = isNaN(novoPrecoRaw) ? 0 : novoPrecoRaw;
    const item = itensProducao[index];
    if (!item) return;
    const aux = item.precificacao_id ? itemPrecoAux[item.precificacao_id] : null;
    // Sem custo conhecido (avulso) — aplica livremente
    if (!aux || aux.custoUnit <= 0) {
      aplicarPrecoNoItem(index, novoPreco);
      return;
    }
    const margem = calcMargemItem(novoPreco, aux.custoUnit);
    const validacao = validarMargemPorTipo(margem, item.segmento || 'Encapsulados');
    if (validacao.status === 'baixa' && !precoLiberadoIdxs.includes(index)) {
      // pede senha
      setPendingPreco({ index, novoPreco });
      setSenhaPrecoDialog(true);
      return;
    }
    aplicarPrecoNoItem(index, novoPreco);
  };

  const handleRestaurarPreco = (index: number) => {
    const item = itensProducao[index];
    if (!item?.precificacao_id) return;
    const aux = itemPrecoAux[item.precificacao_id];
    if (!aux) return;
    aplicarPrecoNoItem(index, aux.precoOriginal);
    setPrecoLiberadoIdxs(prev => prev.filter(i => i !== index));
    setPrecoDraft(prev => {
      const n = { ...prev }; delete n[index]; return n;
    });
  };

  const confirmarPrecoDraft = (index: number) => {
    const raw = precoDraft[index];
    if (raw === undefined) return;
    const normalized = raw.replace(',', '.').trim();
    const parsed = parseFloat(normalized);
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Informe um preço válido');
      return;
    }
    handleUpdateItemPreco(index, parsed);
    setPrecoDraft(prev => {
      const n = { ...prev }; delete n[index]; return n;
    });
  };

  const confirmarSenhaPreco = () => {
    if (senhaPrecoInput !== SENHA_LIBERACAO_MARGEM) {
      toast.error('Senha incorreta!');
      setSenhaPrecoInput('');
      return;
    }
    if (pendingPreco) {
      setPrecoLiberadoIdxs(prev => [...prev, pendingPreco.index]);
      aplicarPrecoNoItem(pendingPreco.index, pendingPreco.novoPreco);
      setPrecoDraft(prev => {
        const n = { ...prev }; delete n[pendingPreco.index]; return n;
      });
    }
    setSenhaPrecoDialog(false);
    setSenhaPrecoInput('');
    setPendingPreco(null);
    toast.success('Preço liberado!');
  };

  // ── Derive setup quantities from products ──
  const numProdutos = itensProducao.length;

  const produtosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    itensProducao.forEach(item => {
      const tipo = item.segmento || 'Encapsulados';
      map[tipo] = (map[tipo] || 0) + 1;
    });
    return map;
  }, [itensProducao]);

  // Sync setup quantities when products change
  useEffect(() => {
    setSetupItems(prev => prev.map(item => {
      if (item.id === 'registro_inpi') return item;
      return { ...item, quantidade: numProdutos };
    }));

    // Update impressao items — preserve custom custoUnitario if already set
    const tipos = Object.entries(produtosPorTipo);
    setSetupImpressaoItens(prev => {
      const prevMap: Record<string, number> = {};
      prev.forEach(p => { prevMap[p.tipoProduto] = p.custoUnitario; });
      return tipos.map(([tipo, qty]) => ({
        tipoProduto: tipo,
        custoUnitario: prevMap[tipo] !== undefined ? prevMap[tipo] : (CUSTOS_IMPRESSAO[tipo] || 940),
        quantidade: qty,
      }));
    });
  }, [numProdutos, produtosPorTipo]);

  // ── Setup cost calculations ──
  // Fluxo "Novo Produtor": planos fixos vindos de setup_planos
  const planosSelecionados: PlanoSelecionado[] = useMemo(
    () => buildPlanosSelecionados(setupPlanosDoPerfil, planoQtdMap),
    [setupPlanosDoPerfil, planoQtdMap]
  );

  // Fluxo "Produtor Experiente": setup personalizado (custos + margem/valor fixo)
  const custoTotalSetupLegacy = useMemo(() => {
    let total = 0;
    setupItems.forEach((item) => {
      if (item.selecionado) total += item.custoUnitario * item.quantidade;
    });
    if (setupImpressaoSelecionado) {
      setupImpressaoItens.forEach((item) => {
        total += item.custoUnitario * item.quantidade;
      });
    }
    return total;
  }, [setupItems, setupImpressaoSelecionado, setupImpressaoItens]);

  const precoVendaSetupLegacy = useMemo(() => {
    if (custoTotalSetupLegacy === 0) return 0;
    if (modoCalculoSetup === 'valor_fixo') return valorFixoSetup;
    const divisor = 1 - 0.06 - 0.05 - 0.05 - (margemSetup / 100);
    if (divisor <= 0) return 0;
    return custoTotalSetupLegacy / divisor;
  }, [custoTotalSetupLegacy, margemSetup, modoCalculoSetup, valorFixoSetup]);

  const margemEfetivaLegacy = useMemo(() => {
    if (precoVendaSetupLegacy <= 0) return 0;
    // margem líquida após custos, taxa antecipação 6%, imposto 5%, comissão 5%
    return (1 - custoTotalSetupLegacy / precoVendaSetupLegacy - 0.06 - 0.05 - 0.05) * 100;
  }, [precoVendaSetupLegacy, custoTotalSetupLegacy]);

  // Valores efetivos (dependem do perfil escolhido)
  const isPerfilExperiente = setupPerfil === 'produtor_experiente';
  const isRevendaLemon = setupPerfil === 'revenda_lemon';
  const precoVendaSetup = isRevendaLemon
    ? 0
    : isPerfilExperiente
    ? precoVendaSetupLegacy
    : planosSelecionados.reduce((acc, p) => acc + p.preco_unitario * p.quantidade, 0);
  const custoTotalSetup = isRevendaLemon ? 0 : isPerfilExperiente ? custoTotalSetupLegacy : precoVendaSetup;
  const margemEfetiva = isPerfilExperiente ? margemEfetivaLegacy : 0;
  const validacaoMargemSetup = validarMargemPorTipo(
    isPerfilExperiente ? margemEfetivaLegacy : 0,
    'Setup'
  );

  // Carregar dados se editando
  useEffect(() => {
    if (orcamentoExistente) {
      setTipoOrcamento(orcamentoExistente.tipo_orcamento || 'novo_produtor');
      setNomeCliente(orcamentoExistente.nome_cliente);
      setConsultorResponsavel(orcamentoExistente.consultor_responsavel || '');
      setValidadeDias(orcamentoExistente.validade_dias);
      setObservacoes(orcamentoExistente.observacoes || '');
      setItensProducao(orcamentoExistente.itens_producao || []);
      setCondicoesPagamento(orcamentoExistente.condicoes_pagamento || {});
      // Carregar cliente vinculado para validar telefone
      if ((orcamentoExistente as any).cliente_id) {
        buscarPorId((orcamentoExistente as any).cliente_id).then((c) => {
          if (c) setClienteSelecionado(c);
        }).catch(() => {});
      }
      if (orcamentoExistente.dados_cliente) {
        const dc = orcamentoExistente.dados_cliente as DadosCliente;
        const inferredTipo: 'pj' | 'pf' = dc.tipo_pessoa
          ? dc.tipo_pessoa
          : (dc.cnpj || dc.razao_social) ? 'pj' : 'pf';
        const merged: DadosCliente = { ...dc, tipo_pessoa: inferredTipo };
        // Para PF, espelha endereço de pessoas_fisicas[0] nos campos genéricos do form
        if (inferredTipo === 'pf') {
          const pf0 = dc.pessoas_fisicas?.[0];
          if (pf0) {
            merged.cep_cnpj = merged.cep_cnpj || pf0.cep;
            merged.endereco_cnpj = merged.endereco_cnpj || pf0.endereco;
            merged.numero_cnpj = merged.numero_cnpj || pf0.numero;
            merged.bairro_cnpj = merged.bairro_cnpj || pf0.bairro;
            merged.cidade = merged.cidade || pf0.cidade;
            merged.estado = merged.estado || pf0.estado;
            merged.nome_completo = merged.nome_completo || pf0.nome;
            merged.cpf = merged.cpf || pf0.cpf;
            merged.email = merged.email || pf0.email;
            merged.telefone = merged.telefone || pf0.telefone;
          }
        }
        setDadosClienteTemp(merged);
      }
      if (orcamentoExistente.detalhamento_frete) {
        setDetalhamentoFreteTemp(orcamentoExistente.detalhamento_frete);
      }
      // Restaurar custos de Estabilidade + Anvisa, se existirem (formato novo: 2 entradas separadas; legado: 1 combinada)
      const servicosProd = (orcamentoExistente.servicos_marca || []).filter(
        (s: any) => s?.setup_detalhes?.categoria === 'producao' || s?.setup_detalhes?.tipo === 'estabilidade_anvisa'
      ) as any[];
      let restoredEstab = false;
      let restoredAnvisa = false;
      for (const sp of servicosProd) {
        const det = sp.setup_detalhes || {};
        if (det.tipo === 'estabilidade' && typeof det.custo_unit === 'number') {
          setCustoEstabilidadeUnit(det.custo_unit);
          restoredEstab = true;
        } else if (det.tipo === 'anvisa' && typeof det.custo_unit === 'number') {
          setCustoAnvisaUnit(det.custo_unit);
          restoredAnvisa = true;
        } else if (det.tipo === 'estabilidade_anvisa') {
          if (typeof det.custo_estabilidade_unit === 'number') setCustoEstabilidadeUnit(det.custo_estabilidade_unit);
          if (typeof det.custo_anvisa_unit === 'number') setCustoAnvisaUnit(det.custo_anvisa_unit);
          restoredEstab = true;
          restoredAnvisa = true;
        }
      }
      // Se o orçamento existente tem serviços de marca definidos, respeitar exatamente o que foi salvo.
      // Se nunca foi salvo nenhum (array vazio), assumir ambos ativos (default).
      if ((orcamentoExistente.servicos_marca || []).length > 0) {
        setEstabilidadeAtiva(restoredEstab);
        setAnvisaAtiva(restoredAnvisa);
      }
      // Restore setup
      const servicosSetup = (orcamentoExistente.servicos_marca || []).filter(
        (s: any) => s.nome_plano === 'Setup' || (s.nome_plano || '').startsWith('Setup') || s?.setup_detalhes
      );
      // 1) Tenta formato "Novo Produtor" (planos fixos)
      const restoredMap: Record<string, number> = {};
      let restoredPerfil: SetupPlanoPerfil | null = null;
      // 0) Tenta perfil "Revenda Lemon"
      const revenda = servicosSetup.find((s: any) => (s as any).setup_detalhes?.perfil === 'revenda_lemon');
      if (revenda) {
        setSetupPerfil('revenda_lemon');
        return;
      }
      for (const s of servicosSetup) {
        const det: any = (s as any).setup_detalhes;
        if (det?.plano_id) {
          restoredMap[det.plano_id] = (restoredMap[det.plano_id] || 0) + (det.quantidade || 1);
          if (!restoredPerfil && det.perfil) restoredPerfil = det.perfil;
        }
      }
      if (Object.keys(restoredMap).length > 0) {
        setSetupPerfil(restoredPerfil || 'novo_produtor');
        setPlanoQtdMap(restoredMap);
      } else {
        // 2) Formato "Produtor Experiente" (legado, plano personalizado)
        const legacy = servicosSetup.find((s: any) => (s as any).setup_detalhes?.items);
        if (legacy) {
          const det: any = (legacy as any).setup_detalhes;
          setSetupPerfil('produtor_experiente');
          if (Array.isArray(det.items)) setSetupItems(det.items);
          if (det.impressao_selecionado !== undefined) setSetupImpressaoSelecionado(!!det.impressao_selecionado);
          if (Array.isArray(det.impressao_itens)) setSetupImpressaoItens(det.impressao_itens);
          if (det.margem !== undefined) setMargemSetup(Number(det.margem) || 0);
          if (det.modo_calculo) setModoCalculoSetup(det.modo_calculo === 'valor_fixo' ? 'valor_fixo' : 'margem');
          if (det.valor_fixo !== undefined) setValorFixoSetup(Number(det.valor_fixo) || 0);
        }
      }
    }
  }, [orcamentoExistente]);

  // Cálculos
  const subtotalProducao = itensProducao.reduce((acc, item) => acc + item.subtotal, 0);
  // Custos de Estabilidade + Anvisa (não entram para Revenda Lemon) — cada um opcional
  const aplicaEstabilidade = estabilidadeAtiva && !isRevendaLemon && itensProducao.length > 0;
  const aplicaAnvisa = anvisaAtiva && !isRevendaLemon && itensProducao.length > 0;
  const isCatalogo = (cliente: string) =>
    cliente.toLowerCase().includes('catálogo') || cliente.toLowerCase().includes('catalogo');
  // Item é "catálogo" quando vem de uma precificação cujo cliente é Catálogo Lemon
  const itemEhCatalogo = (it: ItemProducao) => {
    if (it.tipo !== 'precificacao' || !it.precificacao_id) return false;
    const prec = (precificacoes as any[])?.find((p) => p.id === it.precificacao_id);
    return !!prec && isCatalogo(prec.formulas?.cliente || '');
  };
  // Estabilidade: apenas itens NÃO-catálogo (fórmulas personalizadas)
  // Anvisa: todos os itens de produção
  const itensEstabilidade = aplicaEstabilidade
    ? itensProducao.filter((it) => !itemEhCatalogo(it))
    : [];
  const itensAnvisa = aplicaAnvisa ? itensProducao : [];
  const totalEstabilidadeAnvisa =
    custoEstabilidadeUnit * itensEstabilidade.length +
    custoAnvisaUnit * itensAnvisa.length;
  const subtotalServicos = precoVendaSetup + totalEstabilidadeAnvisa;
  const valorTotal = subtotalProducao + subtotalServicos;

  // Build servicos_marca for saving (1 entrada por plano selecionado)
  const buildServicosMarca = (): ServicoMarca[] => {
    const extras: ServicoMarca[] = [];
    {
      const qtdEstab = itensEstabilidade.length;
      const qtdAnvisa = itensAnvisa.length;
      const totalEstab = custoEstabilidadeUnit * qtdEstab;
      const totalAnvisa = custoAnvisaUnit * qtdAnvisa;
      if (aplicaEstabilidade && totalEstab > 0) {
        extras.push({
          nome_plano: 'Teste de Estabilidade',
          descricao:
            `${qtdEstab} produto(s) personalizado(s) × ${formatCurrency(custoEstabilidadeUnit)} por produto. Fórmulas do Catálogo Lemon são isentas do teste de estabilidade.`,
          valor: totalEstab,
          entregaveis: [
            { nome: `Teste de estabilidade do produto (${qtdEstab}x)`, incluso: true, quantidade: qtdEstab },
          ],
          setup_detalhes: {
            categoria: 'producao',
            tipo: 'estabilidade',
            custo_unit: custoEstabilidadeUnit,
            quantidade: qtdEstab,
          },
        } as any);
      }
      if (aplicaAnvisa && totalAnvisa > 0) {
        extras.push({
          nome_plano: 'Notificação Anvisa do Produto',
          descricao: `${qtdAnvisa} produto(s) × ${formatCurrency(custoAnvisaUnit)} por produto.`,
          valor: totalAnvisa,
          entregaveis: [
            { nome: `Notificação Anvisa do Produto (${qtdAnvisa}x)`, incluso: true, quantidade: qtdAnvisa },
          ],
          setup_detalhes: {
            categoria: 'producao',
            tipo: 'anvisa',
            custo_unit: custoAnvisaUnit,
            quantidade: qtdAnvisa,
          },
        } as any);
      }
    }
    // Fluxo "Revenda Lemon": entrada simbólica (valor 0) só para restaurar perfil
    if (isRevendaLemon) {
      return [...extras, {
        nome_plano: 'Revenda Lemon',
        descricao: 'Sem custo de setup — somente custo de produção',
        valor: 0,
        entregaveis: [],
        setup_detalhes: { perfil: 'revenda_lemon' },
      } as any];
    }
    // Fluxo "Produtor Experiente": uma entrada única "Setup personalizado"
    if (isPerfilExperiente) {
      if (custoTotalSetupLegacy === 0) return extras;
      const entregaveis: Entregavel[] = [];
      setupItems.filter((i) => i.selecionado && i.quantidade > 0).forEach((item) => {
        entregaveis.push({
          nome: `${item.nome} (${item.quantidade}x)`,
          incluso: true,
          quantidade: item.quantidade,
        });
      });
      if (setupImpressaoSelecionado) {
        setupImpressaoItens.filter((i) => i.quantidade > 0).forEach((item) => {
          entregaveis.push({
            nome: `Impressão de rótulos - ${item.tipoProduto} (${item.quantidade}x)`,
            incluso: true,
            quantidade: item.quantidade,
          });
        });
      }
      return [...extras, {
        nome_plano: 'Setup',
        descricao: 'Setup personalizado',
        valor: precoVendaSetupLegacy,
        entregaveis,
        setup_detalhes: {
          perfil: 'produtor_experiente',
          items: setupItems,
          impressao_selecionado: setupImpressaoSelecionado,
          impressao_itens: setupImpressaoItens,
          margem: margemSetup,
          modo_calculo: modoCalculoSetup,
          valor_fixo: valorFixoSetup,
          custo_total: custoTotalSetupLegacy,
        },
      } as any];
    }
    // Fluxo "Novo Produtor": uma entrada por plano fixo selecionado
    if (planosSelecionados.length === 0) return extras;
    const planosFinais: ServicoMarca[] = planosSelecionados.map((p) => {
      const bullets = (p.entregaveis_md || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => l.replace(/^[-*]\s+/, ''));
      const entregaveis: Entregavel[] = bullets.map((nome) => ({
        nome,
        incluso: true,
        quantidade: p.quantidade,
      }));
      const qtdLabel = p.quantidade > 1 ? ` (${p.quantidade}x)` : '';
      return {
        nome_plano: `Setup — ${p.nome}${qtdLabel}`,
        descricao: p.descricao || 'Plano de setup',
        valor: p.preco_unitario * p.quantidade,
        entregaveis,
        setup_detalhes: {
          plano_id: p.plano_id,
          nome: p.nome,
          perfil: p.perfil,
          quantidade: p.quantidade,
          preco_unitario: p.preco_unitario,
          entregaveis_md: p.entregaveis_md,
          modo_calculo: 'valor_fixo',
        },
      } as any;
    });
    return [...extras, ...planosFinais];
  };

  // Handlers
  const handleAddPrecificacoes = async () => {
    const novasItems: ItemProducao[] = await Promise.all(
      selectedPrecificacoes.map(async (precId) => {
        const prec = (precificacoes as any[])?.find(p => p.id === precId);
        
        let insumos_formula: InsumoSnapshot[] = [];
        const formulaData: Record<string, any> = {};

        if (prec?.formula_id) {
          const { data: formula } = await supabase
            .from('formulas')
            .select('itens, tipo_produto, quantidade_por_pote, unidades_por_dose, unidade_soluvel')
            .eq('id', prec.formula_id)
            .maybeSingle();
          
          if (formula?.itens && Array.isArray(formula.itens)) {
            insumos_formula = (formula.itens as any[]).map(item => ({
              nome: item.nome_insumo_snapshot || '',
              quantidade: item.qtd_informada || 0,
              unidade: item.unidade_informada || '',
            }));
          }

          if (formula) {
            const deriveUnidade = (tipo: string, unidadeSoluvel?: string | null): string => {
              switch (tipo) {
                case 'Encapsulados': return 'capsulas';
                case 'Gummy': return 'gummies';
                case 'Líquido': return 'ml';
                case 'Solúvel': return unidadeSoluvel || 'g';
                default: return 'capsulas';
              }
            };

            const tipoProd = formula.tipo_produto || '';
            const qtdPote = Number(formula.quantidade_por_pote) || undefined;
            const qtdDose = Number(formula.unidades_por_dose) || undefined;
            const unidade = deriveUnidade(tipoProd, formula.unidade_soluvel);
            const qtdDoses = qtdPote && qtdDose ? Math.floor(qtdPote / qtdDose) : undefined;
            const doseTexto = qtdDose ? `${qtdDose} ${unidade}/dia` : undefined;

            Object.assign(formulaData, {
              tipo_produto: tipoProd,
              quantidade_por_pote: qtdPote,
              unidade_por_pote: unidade,
              quantidade_por_dose: qtdDose,
              unidade_por_dose: unidade,
              quantidade_doses: qtdDoses,
              dose_diaria_sugerida: doseTexto,
            });
          }
        }

        return {
          tipo: 'precificacao' as const,
          precificacao_id: precId,
          nome_produto: prec?.formulas?.nome_formula || 'Produto',
          segmento: prec?.formulas?.tipo_produto || '',
          preco_unitario: Number(prec?.preco_venda) || 0,
          quantidade: 1,
          subtotal: Number(prec?.preco_venda) || 0,
          insumos_formula,
          ...formulaData,
        } as ItemProducao;
      })
    );
    
    setItensProducao(prev => [...prev, ...novasItems]);
    // popular auxiliar (custo unitário e preço original) por precificacao_id
    setItemPrecoAux(prev => {
      const next = { ...prev };
      selectedPrecificacoes.forEach(precId => {
        const prec = (precificacoes as any[])?.find(p => p.id === precId);
        if (prec) {
          next[precId] = {
            custoUnit: Number(prec.total_custos_producao) || 0,
            precoOriginal: Number(prec.preco_venda) || 0,
          };
        }
      });
      return next;
    });
    setSelectedPrecificacoes([]);
    setShowPrecificacaoSelector(false);
  };

  const handleUpdateItemQuantidade = (index: number, quantidade: number) => {
    setItensProducao(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          quantidade,
          subtotal: item.modelo_negocio === 'print_on_demand' ? 0 : item.preco_unitario * quantidade,
        };
      }
      return item;
    }));
  };

  const handleUpdateModeloNegocio = (index: number, modelo: 'estoque' | 'print_on_demand') => {
    setItensProducao(prev => prev.map((item, i) => {
      if (i === index) {
        const quantidade = modelo === 'print_on_demand' ? 0 : (item.quantidade || 1);
        return {
          ...item,
          modelo_negocio: modelo,
          quantidade,
          subtotal: modelo === 'print_on_demand' ? 0 : item.preco_unitario * quantidade,
        };
      }
      return item;
    }));
  };

  const handleUpdateItemField = (index: number, field: keyof ItemProducao, value: any) => {
    setItensProducao(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (index: number) => {
    setItensProducao(prev => prev.filter((_, i) => i !== index));
    setPrecoLiberadoIdxs(prev => prev
      .filter(i => i !== index)
      .map(i => (i > index ? i - 1 : i))
    );
  };

  const handleSubmit = async () => {
    if (!nomeCliente.trim()) return;
    if (clientePendencias.length > 0) {
      toast.error(`Preencha os dados obrigatórios do cliente: ${clientePendencias.join(', ')}`);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const hasDadosCliente = Object.values(dadosClienteTemp).some(v => v && v.toString().trim() !== '');
      const hasCondicoesPagamento = Object.values(condicoesPagamento).some(v => v !== undefined && v !== null && v !== '');
      const servicosMarcaFinal = buildServicosMarca();

      // Se PF, espelha endereço/contato em pessoas_fisicas[0] para o PDF/Contrato
      const dadosClienteFinal: DadosCliente = (() => {
        const dc = { ...dadosClienteTemp };
        if ((dc.tipo_pessoa || 'pj') === 'pf') {
          const pf0 = { ...(dc.pessoas_fisicas?.[0] || {}) };
          pf0.nome = pf0.nome || dc.nome_completo;
          pf0.cpf = pf0.cpf || dc.cpf;
          pf0.email = pf0.email || dc.email;
          pf0.telefone = pf0.telefone || dc.telefone;
          pf0.cep = pf0.cep || dc.cep_cnpj;
          pf0.endereco = pf0.endereco || dc.endereco_cnpj;
          pf0.numero = pf0.numero || dc.numero_cnpj;
          pf0.bairro = pf0.bairro || dc.bairro_cnpj;
          pf0.cidade = pf0.cidade || dc.cidade;
          pf0.estado = pf0.estado || dc.estado;
          dc.pessoas_fisicas = [pf0, ...((dc.pessoas_fisicas || []).slice(1))];
        }
        return dc;
      })();

      if (orcamentoExistente) {
        await updateOrcamento.mutateAsync({
          id: orcamentoExistente.id,
          updates: {
            nome_cliente: nomeCliente,
            ...(clienteSelecionado?.id && { cliente_id: clienteSelecionado.id }),
            consultor_responsavel: consultorResponsavel,
            tipo_orcamento: tipoOrcamento,
            validade_dias: validadeDias,
            observacoes,
            itens_producao: itensProducao,
            servicos_marca: servicosMarcaFinal,
            subtotal_producao: subtotalProducao,
            subtotal_servicos: subtotalServicos,
            valor_total: valorTotal,
            ...(hasDadosCliente && { dados_cliente: dadosClienteFinal }),
            ...(detalhamentoFreteTemp && { detalhamento_frete: detalhamentoFreteTemp }),
            ...(hasCondicoesPagamento && { condicoes_pagamento: condicoesPagamento }),
          },
        });
      } else {
        const numeroOrcamento = await getNextNumeroOrcamento();
        const novoOrcamento: OrcamentoInsert = {
          numero_orcamento: numeroOrcamento,
          nome_cliente: nomeCliente,
          ...(clienteSelecionado?.id && { cliente_id: clienteSelecionado.id }),
          consultor_responsavel: consultorResponsavel,
          tipo_orcamento: tipoOrcamento,
          validade_dias: validadeDias,
          observacoes,
          itens_producao: itensProducao,
          servicos_marca: servicosMarcaFinal,
          subtotal_producao: subtotalProducao,
          subtotal_servicos: subtotalServicos,
          valor_total: valorTotal,
          status: 'rascunho',
          ...(hasDadosCliente && { dados_cliente: dadosClienteFinal }),
          ...(detalhamentoFreteTemp && { detalhamento_frete: detalhamentoFreteTemp }),
          ...(hasCondicoesPagamento && { condicoes_pagamento: condicoesPagamento }),
        };
        
        await createOrcamento.mutateAsync(novoOrcamento);
      }
      
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoNext = () => {
    if (step === 1) {
      const temNome = nomeCliente.trim().length > 0;
      const temConsultor = consultorResponsavel.trim().length > 0;
      const tel = (clienteSelecionado?.telefone || '').replace(/\D/g, '');
      const temTelefone = tel.length >= 10;
      return temNome && temConsultor && temTelefone;
    }
    if (step === 2) {
      if (itensProducao.length === 0) return false;
      // Bloqueia se algum item tiver margem abaixo do mínimo e não estiver liberado
      for (let i = 0; i < itensProducao.length; i++) {
        const info = getItemMargemInfo(i);
        if (info && info.validacao.status === 'baixa' && !precoLiberadoIdxs.includes(i)) {
          return false;
        }
      }
      return true;
    }
    if (step === 3) {
      // No fluxo "Produtor Experiente" com margem, bloqueia se margem efetiva estiver abaixo do mínimo e não liberada
      if (isPerfilExperiente && custoTotalSetupLegacy > 0 && validacaoMargemSetup.status === 'baixa' && !setupMargemLiberada) {
        return false;
      }
      return true;
    }
    return true;
  };

  // Habilita "Revenda Lemon" no Passo 3: todos os itens devem ser fórmulas do Catálogo
  const todosItensSaoCatalogo = useMemo(() => {
    if (!itensProducao.length) return false;
    return itensProducao.every((it) => {
      if (it.tipo !== 'precificacao' || !it.precificacao_id) return false;
      const prec = (precificacoes as any[])?.find((p) => p.id === it.precificacao_id);
      return !!prec && isCatalogo(prec.formulas?.cliente || '');
    });
  }, [itensProducao, precificacoes]);

  // Precificações disponíveis (excluindo catálogo)
  const precificacoesDisponiveis = (precificacoes as any[])?.filter(p => {
    if (itensProducao.some(item => item.precificacao_id === p.id)) return false;
    if (isCatalogo(p.formulas?.cliente || '')) return false;
    
    if (buscaPrecificacao.trim()) {
      const termo = buscaPrecificacao.toLowerCase();
      const nomeFormula = (p.formulas?.nome_formula || '').toLowerCase();
      const cliente = (p.formulas?.cliente || '').toLowerCase();
      return nomeFormula.includes(termo) || cliente.includes(termo);
    }
    return true;
  }) || [];

  // Precificações do catálogo
  const precificacoesCatalogo = (precificacoes as any[])?.filter(p => {
    if (itensProducao.some(item => item.precificacao_id === p.id)) return false;
    if (!isCatalogo(p.formulas?.cliente || '')) return false;
    
    if (buscaPrecificacao.trim()) {
      const termo = buscaPrecificacao.toLowerCase();
      const nomeFormula = (p.formulas?.nome_formula || '').toLowerCase();
      const cliente = (p.formulas?.cliente || '').toLowerCase();
      return nomeFormula.includes(termo) || cliente.includes(termo);
    }
    return true;
  }) || [];

  // Precificações não-catálogo (para importar para catálogo)
  const precificacoesImportaveis = (precificacoes as any[])?.filter(p => {
    if (isCatalogo(p.formulas?.cliente || '')) return false;
    if (buscaImportarCatalogo.trim()) {
      const termo = buscaImportarCatalogo.toLowerCase();
      const nomeFormula = (p.formulas?.nome_formula || '').toLowerCase();
      const cliente = (p.formulas?.cliente || '').toLowerCase();
      return nomeFormula.includes(termo) || cliente.includes(termo);
    }
    return true;
  }) || [];

  const handleImportarParaCatalogo = async () => {
    if (selectedParaCatalogo.length === 0) return;
    setImportandoCatalogo(true);
    try {
      const formulaIds = Array.from(new Set(
        (precificacoes as any[])
          .filter(p => selectedParaCatalogo.includes(p.id))
          .map(p => p.formula_id)
          .filter(Boolean)
      ));
      if (formulaIds.length === 0) {
        toast.error('Nenhuma fórmula vinculada às precificações selecionadas.');
        return;
      }
      const { error } = await supabase
        .from('formulas')
        .update({ cliente: 'Catálogo' })
        .in('id', formulaIds);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['precificacoes'] }),
        qc.invalidateQueries({ queryKey: ['formulas'] }),
      ]);
      toast.success(`${formulaIds.length} fórmula(s) importada(s) para o Catálogo!`);
      setSelectedParaCatalogo([]);
      setBuscaImportarCatalogo('');
      setShowImportarCatalogo(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao importar para o catálogo');
    } finally {
      setImportandoCatalogo(false);
    }
  };

  const isMargemBaixa = (p: any) => {
    const tipoProduto = p.formulas?.tipo_produto || 'Encapsulados';
    const margem = Number(p.margem_lucro_percentual);
    const validacao = validarMargemPorTipo(margem, tipoProduto);
    return validacao.status === 'baixa';
  };

  const handleSetupSenhaConfirm = () => {
    if (senhaSetupInput === SENHA_LIBERACAO_MARGEM) {
      setSetupMargemLiberada(true);
      setSenhaSetupDialog(false);
      setSenhaSetupInput('');
      toast.success('Margem de setup liberada!');
    } else {
      toast.error('Senha incorreta!');
      setSenhaSetupInput('');
    }
  };

  const handleImpressaoSenhaConfirm = () => {
    if (senhaImpressaoInput === SENHA_LIBERACAO_MARGEM) {
      setImpressaoEdicaoLiberada(true);
      setSenhaImpressaoDialog(false);
      setSenhaImpressaoInput('');
      toast.success('Edição de custos de impressão liberada!');
    } else {
      toast.error('Senha incorreta!');
      setSenhaImpressaoInput('');
    }
  };

  return (
    <>
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {orcamentoExistente ? 'Editar Orçamento' : 'Gerar Orçamento'} - Passo {isRevendaLemon && step > 4 ? step - 1 : step} de {isRevendaLemon ? 5 : 6}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* STEP 1: Informações Básicas */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Tipo de Orçamento */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tipo de Orçamento *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoOrcamento('novo_produtor')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
                      tipoOrcamento === 'novo_produtor'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400'
                        : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <User className="w-4 h-4" />
                    Novo Produtor
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoOrcamento('recompra')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
                      tipoOrcamento === 'recompra'
                        ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-400'
                        : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <Package className="w-4 h-4" />
                    Recompra
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultor" className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4" />
                  Consultor Responsável *
                </Label>
                <ConsultorCombobox
                  value={consultorResponsavel}
                  onChange={setConsultorResponsavel}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente">Nome do Cliente *</Label>
                <ClienteSelector
                  modo="basico"
                  clienteSelecionado={clienteSelecionado}
                  onSelect={(c) => { setClienteSelecionado(c); setNomeCliente(c.nome); }}
                  onClear={() => { setClienteSelecionado(null); setNomeCliente(''); }}
                />
                {clienteSelecionado && (clienteSelecionado.telefone || '').replace(/\D/g, '').length < 10 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    WhatsApp do cliente é obrigatório (com DDD). Edite o cadastro do cliente.
                  </p>
                )}
                {!clienteSelecionado && (
                  <p className="text-xs text-muted-foreground">
                    Selecione ou crie um cliente. Nome e WhatsApp com DDD são obrigatórios.
                  </p>
                )}
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
                  placeholder="Detalhes adicionais..."
                  rows={3}
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
                    onClick={() => { setShowPrecificacaoSelector(true); setShowCatalogoSelector(false); }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Precificação Salva
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setShowCatalogoSelector(true); setShowPrecificacaoSelector(false); }}
                    className="border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                  >
                    <Star className="w-4 h-4 mr-1" />
                    Fórmulas do Catálogo
                  </Button>
                </div>
              </div>

              {/* Seletor de Precificações */}
              {showPrecificacaoSelector && (
                <Card className="border-primary">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Selecionar Precificações</Label>
                      <Button variant="ghost" size="sm" onClick={() => { setShowPrecificacaoSelector(false); setBuscaPrecificacao(''); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <Input
                      value={buscaPrecificacao}
                      onChange={(e) => setBuscaPrecificacao(e.target.value)}
                      placeholder="Buscar por fórmula ou cliente..."
                      className="h-9"
                    />
                    
                    {precificacoesDisponiveis.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma precificação disponível.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {precificacoesDisponiveis.map((prec: any) => {
                          const margemBaixa = isMargemBaixa(prec);
                          const liberada = margemOrcLiberadaIds.includes(prec.id);
                          return (
                            <label 
                              key={prec.id}
                              className={cn(
                                "flex items-center gap-3 p-2 border rounded-lg hover:bg-muted cursor-pointer",
                                margemBaixa && !liberada && "border-destructive/50 bg-destructive/5"
                              )}
                            >
                              <Checkbox
                                checked={selectedPrecificacoes.includes(prec.id)}
                                onCheckedChange={(checked) => {
                                  if (checked && margemBaixa && !liberada) {
                                    setSenhaMargemOrcDialog(true);
                                    (window as any).__pendingMargemPrecId = prec.id;
                                    return;
                                  }
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
                              {margemBaixa && !liberada && (
                                <Badge variant="destructive" className="text-xs">Margem baixa</Badge>
                              )}
                              {margemBaixa && liberada && (
                                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Liberada</Badge>
                              )}
                              <Badge variant="secondary">{prec.formulas?.tipo_produto}</Badge>
                              <span className="font-semibold">{formatCurrency(Number(prec.preco_venda))}</span>
                            </label>
                          );
                        })}
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

              {/* Seletor de Fórmulas do Catálogo */}
              {showCatalogoSelector && (
                <Card className="border-amber-500">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500" />
                        Fórmulas do Catálogo
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => { setShowCatalogoSelector(false); setBuscaPrecificacao(''); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => setShowImportarCatalogo(v => !v)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {showImportarCatalogo ? 'Fechar importação' : 'Importar precificação para o Catálogo'}
                    </Button>

                    {showImportarCatalogo && (
                      <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                        <Input
                          value={buscaImportarCatalogo}
                          onChange={(e) => setBuscaImportarCatalogo(e.target.value)}
                          placeholder="Buscar precificação por fórmula ou cliente..."
                          className="h-9"
                        />
                        {precificacoesImportaveis.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma precificação disponível para importar.</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {precificacoesImportaveis.map((prec: any) => (
                              <label
                                key={prec.id}
                                className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted cursor-pointer bg-background"
                              >
                                <Checkbox
                                  checked={selectedParaCatalogo.includes(prec.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedParaCatalogo(prev => [...prev, prec.id]);
                                    } else {
                                      setSelectedParaCatalogo(prev => prev.filter(id => id !== prec.id));
                                    }
                                  }}
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{prec.formulas?.nome_formula}</p>
                                  <p className="text-xs text-muted-foreground">{prec.formulas?.cliente}</p>
                                </div>
                                <Badge variant="secondary">{prec.formulas?.tipo_produto}</Badge>
                                <span className="font-semibold text-sm">{formatCurrency(Number(prec.preco_venda))}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {selectedParaCatalogo.length > 0 && (
                          <Button
                            onClick={handleImportarParaCatalogo}
                            disabled={importandoCatalogo}
                            className="w-full"
                            size="sm"
                          >
                            <Star className="w-4 h-4 mr-2" />
                            {importandoCatalogo ? 'Importando...' : `Importar ${selectedParaCatalogo.length} para o Catálogo`}
                          </Button>
                        )}
                      </div>
                    )}

                    <Input
                      value={buscaPrecificacao}
                      onChange={(e) => setBuscaPrecificacao(e.target.value)}
                      placeholder="Buscar fórmula do catálogo..."
                      className="h-9"
                    />
                    
                    {precificacoesCatalogo.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma fórmula do catálogo disponível.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {precificacoesCatalogo.map((prec: any) => {
                          const margemBaixa = isMargemBaixa(prec);
                          const liberada = margemOrcLiberadaIds.includes(prec.id);
                          return (
                            <label 
                              key={prec.id}
                              className={cn(
                                "flex items-center gap-3 p-2 border rounded-lg hover:bg-muted cursor-pointer",
                                margemBaixa && !liberada && "border-destructive/50 bg-destructive/5"
                              )}
                            >
                              <Checkbox
                                checked={selectedPrecificacoes.includes(prec.id)}
                                onCheckedChange={(checked) => {
                                  if (checked && margemBaixa && !liberada) {
                                    setSenhaMargemOrcDialog(true);
                                    (window as any).__pendingMargemPrecId = prec.id;
                                    return;
                                  }
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
                              {margemBaixa && !liberada && (
                                <Badge variant="destructive" className="text-xs">Margem baixa</Badge>
                              )}
                              {margemBaixa && liberada && (
                                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Liberada</Badge>
                              )}
                              <Badge variant="secondary">{prec.formulas?.tipo_produto}</Badge>
                              <span className="font-semibold">{formatCurrency(Number(prec.preco_venda))}</span>
                            </label>
                          );
                        })}
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

              {itensProducao.length === 0 ? (
                <div className="py-8 text-center border rounded-lg bg-muted/30">
                  <Package className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhum produto adicionado.</p>
                  <p className="text-xs text-destructive mt-2 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Adicione pelo menos um produto para continuar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {itensProducao.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="p-3 space-y-3">
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
                          
                          <div className="flex flex-col items-end gap-1">
                            <Label className="text-[10px] text-muted-foreground">Preço unit.</Label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="w-28 h-8 text-right"
                                value={precoDraft[index] ?? String(item.preco_unitario)}
                                onChange={(e) => setPrecoDraft(prev => ({ ...prev, [index]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); confirmarPrecoDraft(index); }
                                }}
                              />
                              {precoDraft[index] !== undefined && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="default"
                                  className="h-8 w-8 shrink-0"
                                  title="Confirmar novo preço"
                                  onClick={() => confirmarPrecoDraft(index)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex rounded-lg border overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleUpdateModeloNegocio(index, 'estoque')}
                              className={cn(
                                'px-2.5 py-1 text-xs font-medium transition-all',
                                item.modelo_negocio !== 'print_on_demand'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted'
                              )}
                            >
                              Estoque
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateModeloNegocio(index, 'print_on_demand')}
                              className={cn(
                                'px-2.5 py-1 text-xs font-medium transition-all',
                                item.modelo_negocio === 'print_on_demand'
                                  ? 'bg-purple-600 text-white'
                                  : 'hover:bg-muted'
                              )}
                            >
                              POD
                            </button>
                          </div>
                          
                          {item.modelo_negocio !== 'print_on_demand' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                className="w-20"
                                value={item.quantidade}
                                onChange={(e) => handleUpdateItemQuantidade(index, parseInt(e.target.value) || 1)}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Qtd: 0</span>
                          )}
                          
                          <div className="text-right min-w-[100px]">
                            <p className="font-semibold">
                              {item.modelo_negocio === 'print_on_demand' ? 'R$ 0,00' : formatCurrency(item.subtotal)}
                            </p>
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>

                        {(() => {
                          const info = getItemMargemInfo(index);
                          if (!info) return null;
                          const liberada = precoLiberadoIdxs.includes(index);
                          const precoAlterado = arredondarReais(item.preco_unitario) !== arredondarReais(info.precoOriginal);
                          return (
                            <div className={cn(
                              'flex flex-wrap items-center gap-2 px-2 py-1.5 rounded border text-xs',
                              info.validacao.bgColor,
                              info.validacao.borderColor
                            )}>
                              <Badge variant="outline" className={cn('text-[11px]', info.validacao.color)}>
                                Margem: {info.margem.toFixed(1)}%
                              </Badge>
                              <span className={cn('text-[11px]', info.validacao.color)}>
                                {info.validacao.mensagem}
                              </span>
                              {info.validacao.status === 'baixa' && liberada && (
                                <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
                                  Liberado por senha
                                </Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground ml-auto">
                                Preço padrão: {formatCurrency(info.precoOriginal)}
                              </span>
                              {precoAlterado && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => handleRestaurarPreco(index)}
                                >
                                  Restaurar
                                </Button>
                              )}
                            </div>
                          );
                        })()}

                        {(() => {
                          const raw = precoDraft[index];
                          if (raw === undefined) return null;
                          const item2 = itensProducao[index];
                          if (!item2?.precificacao_id) return null;
                          const aux = itemPrecoAux[item2.precificacao_id];
                          if (!aux || aux.custoUnit <= 0) return null;
                          const parsed = parseFloat(raw.replace(',', '.'));
                          if (isNaN(parsed) || parsed <= 0) return null;
                          const novaMargem = calcMargemItem(parsed, aux.custoUnit);
                          const validacao = validarMargemPorTipo(novaMargem, item2.segmento || 'Encapsulados');
                          return (
                            <div className={cn(
                              'flex flex-wrap items-center gap-2 px-2 py-1.5 rounded border border-dashed text-xs',
                              validacao.bgColor,
                              validacao.borderColor
                            )}>
                              <Badge variant="outline" className={cn('text-[11px]', validacao.color)}>
                                Prévia nova margem: {novaMargem.toFixed(1)}%
                              </Badge>
                              <span className={cn('text-[11px]', validacao.color)}>
                                {validacao.mensagem}
                              </span>
                              <span className="text-[11px] text-muted-foreground ml-auto">
                                Clique em Confirmar para aplicar
                              </span>
                            </div>
                          );
                        })()}

                        {item.modelo_negocio !== 'print_on_demand' && (
                          <div className="grid grid-cols-4 gap-2 pt-2 border-t">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Qtd por Pote</Label>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantidade_por_pote || ''}
                                onChange={(e) => handleUpdateItemField(index, 'quantidade_por_pote', parseInt(e.target.value) || undefined)}
                                placeholder="60"
                                readOnly={item.tipo === 'precificacao'}
                                disabled={item.tipo === 'precificacao'}
                                className={item.tipo === 'precificacao' ? 'bg-muted cursor-not-allowed' : ''}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Unidade</Label>
                              {item.tipo === 'precificacao' ? (
                                <Input
                                  value={item.unidade_por_pote === 'capsulas' ? 'Cápsulas' : item.unidade_por_pote === 'gummies' ? 'Gummies' : item.unidade_por_pote === 'ml' ? 'ML' : item.unidade_por_pote === 'g' ? 'Gramas' : item.unidade_por_pote || ''}
                                  readOnly
                                  disabled
                                  className="bg-muted cursor-not-allowed"
                                />
                              ) : (
                                <Select
                                  value={item.unidade_por_pote || ''}
                                  onValueChange={(value) => handleUpdateItemField(index, 'unidade_por_pote', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="capsulas">Cápsulas</SelectItem>
                                    <SelectItem value="gummies">Gummies</SelectItem>
                                    <SelectItem value="ml">ML</SelectItem>
                                    <SelectItem value="g">Gramas</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Qtd por Dose</Label>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantidade_por_dose || ''}
                                onChange={(e) => handleUpdateItemField(index, 'quantidade_por_dose', parseInt(e.target.value) || undefined)}
                                placeholder="2"
                                readOnly={item.tipo === 'precificacao'}
                                disabled={item.tipo === 'precificacao'}
                                className={item.tipo === 'precificacao' ? 'bg-muted cursor-not-allowed' : ''}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Total Doses</Label>
                              <Input
                                type="number"
                                value={item.quantidade_doses || ''}
                                readOnly
                                disabled
                                className="bg-muted cursor-not-allowed"
                                placeholder="—"
                              />
                            </div>
                          </div>
                        )}
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

          {/* STEP 3: Custo de Setup (novo fluxo de planos) */}
          {step === 3 && (
            <SetupPlanosStep
              perfil={setupPerfil}
              onPerfilChange={setSetupPerfil}
              selecionados={planoQtdMap}
              onSelecionadosChange={setPlanoQtdMap}
              revendaDisponivel={todosItensSaoCatalogo}
              revendaMotivoBloqueio="Disponível apenas quando todos os itens são fórmulas do Catálogo."
              renderCustomBody={isPerfilExperiente ? (
                <div className="space-y-4">
                  {/* Setup items */}
                  <div className="space-y-2">
                    {setupItems.map((item, idx) => (
                      <Card key={item.id} className={cn(item.selecionado && 'border-primary')}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={item.selecionado}
                              onCheckedChange={(checked) => {
                                setSetupItems((prev) => prev.map((si, i) =>
                                  i === idx ? { ...si, selecionado: !!checked } : si
                                ));
                              }}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.nome}</p>
                              <p className="text-xs text-muted-foreground">{formatCurrency(item.custoUnitario)}/un</p>
                            </div>
                            {item.selecionado && (
                              <>
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-20"
                                  value={item.quantidade}
                                  onChange={(e) => {
                                    setSetupItems((prev) => prev.map((si, i) =>
                                      i === idx ? { ...si, quantidade: parseInt(e.target.value) || 0 } : si
                                    ));
                                  }}
                                />
                                <span className="text-sm font-semibold min-w-[80px] text-right">
                                  {formatCurrency(item.custoUnitario * item.quantidade)}
                                </span>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Impressão de rótulos */}
                    <Card className={cn(setupImpressaoSelecionado && 'border-primary')}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={setupImpressaoSelecionado}
                            onCheckedChange={(checked) => setSetupImpressaoSelecionado(!!checked)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Impressão de rótulos</p>
                            <p className="text-xs text-muted-foreground">Custo varia por tipo de produto</p>
                          </div>
                          {setupImpressaoSelecionado && !impressaoEdicaoLiberada && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setSenhaImpressaoDialog(true)}
                              title="Editar custos de impressão (requer senha)"
                            >
                              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          {setupImpressaoSelecionado && impressaoEdicaoLiberada && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <LockOpen className="w-3 h-3" />
                              Editável
                            </Badge>
                          )}
                        </div>

                        {setupImpressaoSelecionado && setupImpressaoItens.length > 0 && (
                          <div className="ml-7 space-y-2 border-l-2 border-primary/20 pl-3">
                            {setupImpressaoItens.map((imp, idx) => (
                              <div key={imp.tipoProduto} className="flex items-center gap-3">
                                <div className="flex-1">
                                  <p className="text-sm">{imp.tipoProduto}</p>
                                  {impressaoEdicaoLiberada ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-muted-foreground">R$</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={10}
                                        className="w-24 h-6 text-xs"
                                        value={imp.custoUnitario}
                                        onChange={(e) => {
                                          setSetupImpressaoItens((prev) => prev.map((si, i) =>
                                            i === idx ? { ...si, custoUnitario: parseFloat(e.target.value) || 0 } : si
                                          ));
                                        }}
                                      />
                                      <span className="text-xs text-muted-foreground">/un</span>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">{formatCurrency(imp.custoUnitario)}/un</p>
                                  )}
                                </div>
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-20"
                                  value={imp.quantidade}
                                  onChange={(e) => {
                                    setSetupImpressaoItens((prev) => prev.map((si, i) =>
                                      i === idx ? { ...si, quantidade: parseInt(e.target.value) || 0 } : si
                                    ));
                                  }}
                                />
                                <span className="text-sm font-semibold min-w-[80px] text-right">
                                  {formatCurrency(imp.custoUnitario * imp.quantidade)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {setupImpressaoSelecionado && setupImpressaoItens.length === 0 && (
                          <p className="ml-7 text-xs text-muted-foreground">
                            Nenhum produto adicionado no passo anterior.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Custo total e margem */}
                  {custoTotalSetupLegacy > 0 && (() => {
                    const taxaAntecipacao = precoVendaSetupLegacy * 0.06;
                    const impostoSetup = precoVendaSetupLegacy * 0.05;
                    const comissaoSetup = precoVendaSetupLegacy * 0.05;
                    const margemLucroValor = precoVendaSetupLegacy * (margemEfetivaLegacy / 100);
                    return (
                      <Card>
                        <CardContent className="p-4 space-y-4">
                          {/* Detalhamento do Custo */}
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Detalhamento do Custo</h4>
                            {setupItems.filter((si) => si.selecionado && si.quantidade > 0).map((si, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{si.nome} ({si.quantidade}x)</span>
                                <span>{formatCurrency(si.custoUnitario * si.quantidade)}</span>
                              </div>
                            ))}
                            {setupImpressaoSelecionado && setupImpressaoItens.filter((si) => si.quantidade > 0).map((si, idx) => (
                              <div key={`imp-${idx}`} className="flex justify-between text-sm">
                                <span>Impressão - {si.tipoProduto} ({si.quantidade}x)</span>
                                <span>{formatCurrency(si.custoUnitario * si.quantidade)}</span>
                              </div>
                            ))}
                            <Separator className="my-2" />
                            <div className="flex justify-between text-sm font-semibold">
                              <span>Custo Total do Setup</span>
                              <span>{formatCurrency(custoTotalSetupLegacy)}</span>
                            </div>
                          </div>

                          {/* Modo de cálculo */}
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold">Modo de Cálculo</Label>
                            <div className="flex rounded-lg border overflow-hidden w-fit">
                              <button
                                type="button"
                                onClick={() => {
                                  setModoCalculoSetup('margem');
                                  setSetupMargemLiberada(false);
                                }}
                                className={cn(
                                  'px-4 py-2 text-sm font-medium transition-all',
                                  modoCalculoSetup === 'margem'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted'
                                )}
                              >
                                Margem %
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setModoCalculoSetup('valor_fixo');
                                  setValorFixoSetup(precoVendaSetupLegacy > 0 ? Math.round(precoVendaSetupLegacy * 100) / 100 : 0);
                                  setSetupMargemLiberada(false);
                                }}
                                className={cn(
                                  'px-4 py-2 text-sm font-medium transition-all',
                                  modoCalculoSetup === 'valor_fixo'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted'
                                )}
                              >
                                Valor Fixo R$
                              </button>
                            </div>

                            {modoCalculoSetup === 'margem' ? (
                              <div className="space-y-2">
                                <Label className="text-sm">Margem de Lucro (%)</Label>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={90}
                                    step={0.5}
                                    className={cn('w-24', validacaoMargemSetup.borderColor && `border-2 ${validacaoMargemSetup.borderColor}`)}
                                    value={margemSetup}
                                    onChange={(e) => {
                                      setMargemSetup(parseFloat(e.target.value) || 0);
                                      setSetupMargemLiberada(false);
                                    }}
                                  />
                                  <span className="text-sm">%</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label className="text-sm">Valor cobrado de Setup (R$)</Label>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm">R$</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={100}
                                    className={cn('w-36', validacaoMargemSetup.borderColor && `border-2 ${validacaoMargemSetup.borderColor}`)}
                                    value={valorFixoSetup}
                                    onChange={(e) => {
                                      setValorFixoSetup(parseFloat(e.target.value) || 0);
                                      setSetupMargemLiberada(false);
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Margem resultante: <span className="font-semibold">{margemEfetivaLegacy.toFixed(1)}%</span>
                                </p>
                              </div>
                            )}
                          </div>

                          <div className={cn(
                            'p-2 rounded-lg text-sm',
                            validacaoMargemSetup.bgColor === 'gold-shimmer' ? 'gold-shimmer' : validacaoMargemSetup.bgColor,
                            validacaoMargemSetup.color
                          )}>
                            {validacaoMargemSetup.mensagem}
                          </div>

                          {validacaoMargemSetup.status === 'baixa' && !setupMargemLiberada && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-destructive text-destructive"
                              onClick={() => setSenhaSetupDialog(true)}
                            >
                              Liberar com senha
                            </Button>
                          )}

                          {/* Composição do preço de venda */}
                          <div className="space-y-1 pt-2">
                            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Composição do Preço de Venda</h4>
                            <div className="flex justify-between text-sm">
                              <span>Custo Base</span>
                              <span>{formatCurrency(custoTotalSetupLegacy)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Taxa de Antecipação (6%)</span>
                              <span>{formatCurrency(taxaAntecipacao)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Imposto (5%)</span>
                              <span>{formatCurrency(impostoSetup)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Comissão (5%)</span>
                              <span>{formatCurrency(comissaoSetup)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Margem de Lucro ({margemEfetivaLegacy.toFixed(1)}%)</span>
                              <span>{formatCurrency(margemLucroValor)}</span>
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between items-center font-semibold text-base">
                              <span>Preço de Venda do Setup</span>
                              <span className="text-xl font-bold">{formatCurrency(precoVendaSetupLegacy)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {custoTotalSetupLegacy === 0 && (
                    <div className="py-6 text-center border rounded-lg bg-muted/30">
                      <Settings2 className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Selecione pelo menos um item de setup acima.</p>
                      <p className="text-xs text-muted-foreground mt-1">(Esta seção é opcional)</p>
                    </div>
                  )}
                </div>
              ) : undefined}
            />
          )}

          {/* STEP 4: Estabilidade + Notificação Anvisa */}
          {step === 4 && (
            <EstabilidadeAnvisaStep
              itensProducao={itensProducao}
              itensEstabilidade={itensEstabilidade}
              itensAnvisa={itensAnvisa}
              isItemCatalogo={(it) => itemEhCatalogo(it)}
              custoEstabilidadeUnit={custoEstabilidadeUnit}
              custoAnvisaUnit={custoAnvisaUnit}
              onChangeEstabilidade={setCustoEstabilidadeUnit}
              onChangeAnvisa={setCustoAnvisaUnit}
              edicaoLiberada={estabilidadeEdicaoLiberada}
              onLiberarEdicao={() => setEstabilidadeEdicaoLiberada(true)}
              estabilidadeAtiva={estabilidadeAtiva}
              anvisaAtiva={anvisaAtiva}
              onToggleEstabilidade={setEstabilidadeAtiva}
              onToggleAnvisa={setAnvisaAtiva}
            />
          )}

          {/* STEP 5: Condições de Pagamento */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Condições de Pagamento</h3>

              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex justify-between text-sm">
                    <span>Valor Total do Orçamento</span>
                    <span className="font-bold text-lg">{formatCurrency(valorTotal)}</span>
                  </div>
                </CardContent>
              </Card>

              <CondicoesPagamentoForm
                value={condicoesPagamento}
                onChange={setCondicoesPagamento}
                valorTotal={valorTotal}
                isRequired={false}
              />
            </div>
          )}

          {/* STEP 6: Resumo */}
          {step === 6 && (
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

                  {isRevendaLemon && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">SETUP</p>
                      <div className="flex justify-between text-sm">
                        <span>• Revenda Lemon — sem custo de setup</span>
                        <span>{formatCurrency(0)}</span>
                      </div>
                    </div>
                  )}

                  {precoVendaSetup > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">SETUP</p>
                      <div className="space-y-1">
                        {isPerfilExperiente ? (
                          <>
                            {setupItems.filter((i) => i.selecionado && i.quantidade > 0).map((item, index) => (
                              <div key={`legacy-${index}`} className="flex justify-between text-sm">
                                <span>• {item.nome} ({item.quantidade}x)</span>
                                <span>{formatCurrency(item.custoUnitario * item.quantidade)}</span>
                              </div>
                            ))}
                            {setupImpressaoSelecionado && setupImpressaoItens.filter((i) => i.quantidade > 0).map((item, index) => (
                              <div key={`legacy-imp-${index}`} className="flex justify-between text-sm">
                                <span>• Impressão - {item.tipoProduto} ({item.quantidade}x)</span>
                                <span>{formatCurrency(item.custoUnitario * item.quantidade)}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          planosSelecionados.map((p) => (
                            <div key={p.plano_id} className="flex justify-between text-sm">
                              <span>• {p.nome}{p.quantidade > 1 ? ` (${p.quantidade}x)` : ''}</span>
                              <span>{formatCurrency(p.preco_unitario * p.quantidade)}</span>
                            </div>
                          ))
                        )}
                        <div className="flex justify-between font-medium pt-1 border-t">
                          <span>Total do Setup:</span>
                          <span>{formatCurrency(precoVendaSetup)}</span>
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

              {/* Info Cliente (obrigatório) */}
              <Card className="border-primary/40">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Informações do Cliente <span className="text-destructive">*</span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={dadosClienteTemp.tipo_pessoa === 'pj' ? 'default' : 'outline'}
                        onClick={() => setDadosClienteTemp(prev => ({ ...prev, tipo_pessoa: 'pj' }))}
                      >
                        Pessoa Jurídica
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={dadosClienteTemp.tipo_pessoa === 'pf' ? 'default' : 'outline'}
                        onClick={() => setDadosClienteTemp(prev => ({ ...prev, tipo_pessoa: 'pf' }))}
                      >
                        Pessoa Física
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {dadosClienteTemp.tipo_pessoa === 'pj' ? (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">CNPJ <span className="text-destructive">*</span></Label>
                          <Input
                            value={dadosClienteTemp.cnpj || ''}
                            onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, cnpj: e.target.value }))}
                            placeholder="00.000.000/0000-00"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Razão Social <span className="text-destructive">*</span></Label>
                          <Input
                            value={dadosClienteTemp.razao_social || ''}
                            onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, razao_social: e.target.value }))}
                            placeholder="Razão social"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Nome Completo <span className="text-destructive">*</span></Label>
                          <Input
                            value={dadosClienteTemp.nome_completo || ''}
                            onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, nome_completo: e.target.value }))}
                            placeholder="Nome completo"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">CPF <span className="text-destructive">*</span></Label>
                          <Input
                            value={dadosClienteTemp.cpf || ''}
                            onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, cpf: e.target.value }))}
                            placeholder="000.000.000-00"
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
                      <Input
                        type="email"
                        value={dadosClienteTemp.email || ''}
                        onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone <span className="text-destructive">*</span></Label>
                      <Input
                        value={dadosClienteTemp.telefone || ''}
                        onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  {/* Endereço completo (obrigatório) */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <Label className="text-xs">CEP <span className="text-destructive">*</span></Label>
                      <Input
                        value={dadosClienteTemp.cep_cnpj || ''}
                        onChange={(e) => {
                          const cep = e.target.value;
                          setDadosClienteTemp(prev => ({ ...prev, cep_cnpj: cep }));
                          const nums = cep.replace(/\D/g, '');
                          if (nums.length === 8) {
                            fetchEnderecoPorCEP(nums).then(r => {
                              if (!r) return;
                              setDadosClienteTemp(prev => ({
                                ...prev,
                                endereco_cnpj: prev.endereco_cnpj || r.logradouro,
                                bairro_cnpj: prev.bairro_cnpj || r.bairro,
                                cidade: prev.cidade || r.cidade,
                                estado: prev.estado || r.estado,
                              }));
                            });
                          }
                        }}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Estado <span className="text-destructive">*</span></Label>
                      <Select
                        value={dadosClienteTemp.estado || ''}
                        onValueChange={(v) => setDadosClienteTemp(prev => ({ ...prev, estado: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          {UFS_BRASIL.map(uf => (
                            <SelectItem key={uf.uf} value={uf.uf}>{uf.uf} — {uf.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Endereço (Logradouro) <span className="text-destructive">*</span></Label>
                      <Input
                        value={dadosClienteTemp.endereco_cnpj || ''}
                        onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, endereco_cnpj: e.target.value }))}
                        placeholder="Rua, Avenida..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Número <span className="text-destructive">*</span></Label>
                      <Input
                        value={dadosClienteTemp.numero_cnpj || ''}
                        onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, numero_cnpj: e.target.value }))}
                        placeholder="Número"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bairro <span className="text-destructive">*</span></Label>
                      <Input
                        value={dadosClienteTemp.bairro_cnpj || ''}
                        onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, bairro_cnpj: e.target.value }))}
                        placeholder="Bairro"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Cidade <span className="text-destructive">*</span></Label>
                      <Input
                        value={dadosClienteTemp.cidade || ''}
                        onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, cidade: e.target.value }))}
                        placeholder="Cidade"
                      />
                    </div>
                  </div>

                  {clientePendencias.length > 0 && (
                    <div className="text-xs text-destructive">
                      Preencha: {clientePendencias.join(', ')}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Frete (opcional) */}
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <div className="flex gap-3 flex-wrap items-center">
                    <p className="text-sm text-muted-foreground">Frete (opcional):</p>
                    <Button
                      variant={detalhamentoFreteTemp ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowFreteInline(!showFreteInline)}
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Frete
                      {detalhamentoFreteTemp && (<Check className="w-3 h-3 ml-1" />)}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Form inline de Frete */}
              {showFreteInline && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Detalhamento de Frete
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => setShowFreteInline(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <Label className="text-sm">Frete via Lemon Caps?</Label>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant={detalhamentoFreteTemp?.frete_lemon_caps === true ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDetalhamentoFreteTemp(prev => ({
                              frete_lemon_caps: true,
                              usa_tabela_tradicional: prev?.usa_tabela_tradicional ?? true,
                              planos_customizados: prev?.planos_customizados ?? [],
                            }))}
                          >
                            Sim
                          </Button>
                          <Button
                            type="button"
                            variant={detalhamentoFreteTemp?.frete_lemon_caps === false ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDetalhamentoFreteTemp(prev => ({
                              frete_lemon_caps: false,
                              usa_tabela_tradicional: false,
                              planos_customizados: prev?.planos_customizados ?? [],
                            }))}
                          >
                            Não
                          </Button>
                        </div>
                      </div>

                      {detalhamentoFreteTemp?.frete_lemon_caps && (
                        <div className="flex items-center gap-4">
                          <Label className="text-sm">Tabela tradicional?</Label>
                          <div className="flex gap-3">
                            <Button
                              type="button"
                              variant={detalhamentoFreteTemp.usa_tabela_tradicional ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setDetalhamentoFreteTemp(prev => prev ? ({
                                ...prev,
                                usa_tabela_tradicional: true,
                              }) : null)}
                            >
                              Sim
                            </Button>
                            <Button
                              type="button"
                              variant={!detalhamentoFreteTemp.usa_tabela_tradicional ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setDetalhamentoFreteTemp(prev => prev ? ({
                                ...prev,
                                usa_tabela_tradicional: false,
                              }) : null)}
                            >
                              Não
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Navegação */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 1) { onClose(); return; }
                // Pula Estabilidade ao voltar quando perfil é Revenda Lemon
                if (step === 5 && isRevendaLemon) { setStep(3); return; }
                setStep(step - 1);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </Button>

            {step < 6 ? (
              <Button
                onClick={() => {
                  if (step === 2 && itensProducao.length === 0) {
                    toast.error('Adicione pelo menos um produto para continuar.');
                    return;
                  }
                  if (step === 2 && Object.keys(precoDraft).length > 0) {
                    toast.error('Confirme os preços editados antes de avançar.');
                    return;
                  }
                  // Step 3 (planos): sem validação de margem — preço fixo.
                  // Pula Estabilidade (step 4) quando perfil é Revenda Lemon
                  if (step === 3 && isRevendaLemon) { setStep(5); return; }
                  setStep(step + 1);
                }}
                disabled={!canGoNext()}
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || valorTotal === 0 || clientePendencias.length > 0}
                title={clientePendencias.length > 0 ? `Preencha: ${clientePendencias.join(', ')}` : undefined}
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

    {/* Dialog de senha para liberação de margem no orçamento */}
    <Dialog open={senhaMargemOrcDialog} onOpenChange={setSenhaMargemOrcDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Liberar margem abaixo do mínimo</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Esta precificação possui margem abaixo do mínimo permitido. Digite a senha para liberá-la.
        </p>
        <Input
          type="password"
          placeholder="Digite a senha..."
          value={senhaMargemOrcInput}
          onChange={(e) => setSenhaMargemOrcInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (senhaMargemOrcInput === SENHA_LIBERACAO_MARGEM) {
                const pendingId = (window as any).__pendingMargemPrecId;
                if (pendingId) {
                  setMargemOrcLiberadaIds(prev => [...prev, pendingId]);
                  setSelectedPrecificacoes(prev => [...prev, pendingId]);
                  delete (window as any).__pendingMargemPrecId;
                }
                setSenhaMargemOrcDialog(false);
                setSenhaMargemOrcInput('');
                toast.success('Precificação liberada!');
              } else {
                toast.error('Senha incorreta!');
                setSenhaMargemOrcInput('');
              }
            }
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setSenhaMargemOrcDialog(false); setSenhaMargemOrcInput(''); }}>
            Cancelar
          </Button>
          <Button onClick={() => {
            if (senhaMargemOrcInput === SENHA_LIBERACAO_MARGEM) {
              const pendingId = (window as any).__pendingMargemPrecId;
              if (pendingId) {
                setMargemOrcLiberadaIds(prev => [...prev, pendingId]);
                setSelectedPrecificacoes(prev => [...prev, pendingId]);
                delete (window as any).__pendingMargemPrecId;
              }
              setSenhaMargemOrcDialog(false);
              setSenhaMargemOrcInput('');
              toast.success('Precificação liberada!');
            } else {
              toast.error('Senha incorreta!');
              setSenhaMargemOrcInput('');
            }
          }}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog de senha para liberar preço com margem abaixo do mínimo (negociação) */}
    <Dialog open={senhaPrecoDialog} onOpenChange={(open) => {
      setSenhaPrecoDialog(open);
      if (!open) { setSenhaPrecoInput(''); setPendingPreco(null); }
    }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Preço abaixo da margem mínima</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          O preço informado deixa este produto com margem abaixo do mínimo permitido para o tipo. Digite a senha para liberar.
        </p>
        <Input
          type="password"
          placeholder="Digite a senha..."
          value={senhaPrecoInput}
          onChange={(e) => setSenhaPrecoInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirmarSenhaPreco(); }}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => {
            setSenhaPrecoDialog(false);
            setSenhaPrecoInput('');
            setPendingPreco(null);
          }}>
            Cancelar
          </Button>
          <Button onClick={confirmarSenhaPreco}>Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog de senha para liberação de margem do setup */}
    <Dialog open={senhaSetupDialog} onOpenChange={setSenhaSetupDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Liberar margem de setup abaixo do mínimo</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A margem de setup está abaixo do mínimo de 15%. Digite a senha para liberar.
        </p>
        <Input
          type="password"
          placeholder="Digite a senha..."
          value={senhaSetupInput}
          onChange={(e) => setSenhaSetupInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSetupSenhaConfirm();
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setSenhaSetupDialog(false); setSenhaSetupInput(''); }}>
            Cancelar
          </Button>
          <Button onClick={handleSetupSenhaConfirm}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog de senha para edição de custo de impressão */}
    <Dialog open={senhaImpressaoDialog} onOpenChange={setSenhaImpressaoDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar custo de impressão</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Digite a senha para liberar a edição do custo de impressão de rótulos neste orçamento.
        </p>
        <Input
          type="password"
          placeholder="Digite a senha..."
          value={senhaImpressaoInput}
          onChange={(e) => setSenhaImpressaoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleImpressaoSenhaConfirm();
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setSenhaImpressaoDialog(false); setSenhaImpressaoInput(''); }}>
            Cancelar
          </Button>
          <Button onClick={handleImpressaoSenhaConfirm}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
