import { addDays, differenceInCalendarDays } from 'date-fns';
import { AcompanhamentoProcessos, Pedido, StatusPedido, StatusProcessoLogistica } from '@/types/formula';

export type EntregavelCategoria =
  | 'pagina_vendas'
  | 'design_rotulos'
  | 'registro_inpi'
  | 'impressao_rotulos'
  | 'codigo_barras';

export const CATEGORIAS_ENTREGAVEIS: { value: EntregavelCategoria; label: string; labelCurta: string }[] = [
  { value: 'pagina_vendas', label: 'Páginas de Vendas', labelCurta: 'Páginas' },
  { value: 'design_rotulos', label: 'Designer de Rótulos', labelCurta: 'Designer' },
  { value: 'registro_inpi', label: 'Registro no INPI', labelCurta: 'INPI' },
  { value: 'impressao_rotulos', label: 'Impressão de Rótulos', labelCurta: 'Impressão' },
  { value: 'codigo_barras', label: 'Código de Barras', labelCurta: 'Cód. Barras' },
];

export interface DemandaEntregavel {
  pedido: Pedido;
  pedido_id: string;
  numero_pedido: string;
  cliente: string;
  consultor?: string;
  categoria: EntregavelCategoria;
  nome: string;
  detalhe?: string;
  quantidade: number;
  data_pedido: Date;
  data_pagamento?: Date;
  prazo_previsto: Date;
  dias_restantes: number;
  status_pedido: StatusPedido;
  status_entregavel: StatusProcessoLogistica;
}

const PRAZO_PRODUCAO_DIAS = 30;

const getDataBaseEntrega = (pedido: any): Date => {
  const dataPgto = pedido.orcamento_snapshot?.data_pagamento;
  if (dataPgto) return new Date(dataPgto);
  return new Date(pedido.data_pedido);
};

const calcularPrazo = (pedido: any) => {
  const base = getDataBaseEntrega(pedido);
  const dataPrevista = addDays(base, PRAZO_PRODUCAO_DIAS);
  const diasRestantes = differenceInCalendarDays(dataPrevista, new Date());
  return { dataPrevista, diasRestantes };
};

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const classificarEntregavel = (nome: string): EntregavelCategoria | null => {
  const n = norm(nome);
  if (n.includes('pagina') && n.includes('venda')) return 'pagina_vendas';
  if (n.includes('design') && n.includes('rotulo')) return 'design_rotulos';
  if (n.includes('inpi') || (n.includes('registro') && n.includes('marca'))) return 'registro_inpi';
  if (n.includes('impress') && n.includes('rotulo')) return 'impressao_rotulos';
  if (n.includes('codigo') && n.includes('barra')) return 'codigo_barras';
  return null;
};

const CATEGORIA_TO_ACOMP_FIELD: Record<EntregavelCategoria, keyof AcompanhamentoProcessos> = {
  pagina_vendas: 'pagina_venda',
  design_rotulos: 'criacao_marca',
  registro_inpi: 'registro_inpi',
  impressao_rotulos: 'impressao_rotulos',
  codigo_barras: 'codigo_barras',
};

export const getAcompFieldFromCategoria = (categoria: EntregavelCategoria) =>
  CATEGORIA_TO_ACOMP_FIELD[categoria];

const getStatusEntregavel = (
  acomp: AcompanhamentoProcessos | undefined,
  categoria: EntregavelCategoria,
): StatusProcessoLogistica => {
  if (!acomp) return 'pendente';
  const field = CATEGORIA_TO_ACOMP_FIELD[categoria];
  const v = (acomp as any)[field] as StatusProcessoLogistica | undefined;
  return v ?? 'pendente';
};

const extractDetalhe = (nome: string, categoria: EntregavelCategoria): string | undefined => {
  if (categoria !== 'impressao_rotulos') return undefined;
  // "Impressão de rótulos - Encapsulados (3x)" → "Encapsulados"
  const m = nome.match(/-\s*([^()]+?)\s*\(/);
  return m ? m[1].trim() : undefined;
};

const extractQuantidade = (nome: string, fallback: number): number => {
  const m = nome.match(/\((\d+)x\)/i);
  if (m) return parseInt(m[1], 10);
  return fallback || 1;
};

export const extrairDemandasDoPedido = (pedido: Pedido): DemandaEntregavel[] => {
  const snap = pedido.orcamento_snapshot;
  if (!snap) return [];
  const servicos = snap.servicos_marca || [];
  const acomp = pedido.acompanhamento_processos;
  const { dataPrevista, diasRestantes } = calcularPrazo(pedido);
  const cliente = snap.dados_cliente?.nome_completo || snap.nome_cliente || '-';
  const result: DemandaEntregavel[] = [];

  servicos.forEach((s) => {
    (s.entregaveis || []).forEach((e) => {
      if (!e.incluso) return;
      const cat = classificarEntregavel(e.nome);
      if (!cat) return;
      const qtd = extractQuantidade(e.nome, e.quantidade);
      if (qtd <= 0) return;
      result.push({
        pedido,
        pedido_id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        cliente,
        consultor: snap.consultor_responsavel,
        categoria: cat,
        nome: e.nome,
        detalhe: extractDetalhe(e.nome, cat),
        quantidade: qtd,
        data_pedido: pedido.data_pedido,
        data_pagamento: snap.data_pagamento ? new Date(snap.data_pagamento) : undefined,
        prazo_previsto: dataPrevista,
        dias_restantes: diasRestantes,
        status_pedido: pedido.status,
        status_entregavel: getStatusEntregavel(acomp, cat),
      });
    });
  });

  return result;
};

export const extrairTodasDemandas = (pedidos: Pedido[]): DemandaEntregavel[] =>
  pedidos.flatMap(extrairDemandasDoPedido);

export const STATUS_ENTREGAVEL_LABEL: Record<StatusProcessoLogistica, string> = {
  pendente: 'Pendente',
  entregue: 'Entregue',
  nao_necessario: 'Não Necessário',
};
