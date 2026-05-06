import { addDays, differenceInCalendarDays, isWeekend, parseISO } from 'date-fns';
import { Pedido, AcompanhamentoProcessos } from '@/types/formula';
import { classificarEntregavel } from '@/lib/entregaveis';

export type EtapaId =
  | 'pagina_vendas'
  | 'rotulos_arte'
  | 'registro_inpi'
  | 'impressao_rotulo'
  | 'codigo_barras'
  | 'producao'
  | 'rotulagem'
  | 'logistica';

export interface EtapaConfig {
  id: EtapaId;
  label: string;
  responsavel: string;
  responsavelNota: string;
  options: { value: string; label: string }[];
  defaultStatus: string;
}

export const ETAPAS: EtapaConfig[] = [
  {
    id: 'rotulos_arte',
    label: 'Rótulos / Arte',
    responsavel: 'Jean',
    responsavelNota: 'Entrega: 7 dias úteis após briefing. Revisão: 3 dias úteis após feedback.',
    options: [
      { value: 'faca_voce_mesmo', label: 'Faça Você Mesmo' },
      { value: 'pendente', label: 'Pendente' },
      { value: 'concluido', label: 'Concluído' },
    ],
    defaultStatus: 'pendente',
  },
  {
    id: 'pagina_vendas',
    label: 'Página de Vendas',
    responsavel: 'Rodrigo',
    responsavelNota: '10 dias úteis após conclusão do Rótulo.',
    options: [
      { value: 'nao_necessario', label: 'Não Necessário' },
      { value: 'pendente', label: 'Pendente' },
      { value: 'concluido', label: 'Concluído' },
    ],
    defaultStatus: 'pendente',
  },
  {
    id: 'registro_inpi',
    label: 'Registro no INPI',
    responsavel: 'Jean',
    responsavelNota: 'Prazo definido por solicitação.',
    options: [
      { value: 'nao_necessario', label: 'Não Necessário' },
      { value: 'pendente', label: 'Pendente' },
      { value: 'concluido', label: 'Concluído' },
    ],
    defaultStatus: 'pendente',
  },
  {
    id: 'impressao_rotulo',
    label: 'Impressão de Rótulo',
    responsavel: 'Jean',
    responsavelNota: '10–15 dias úteis após pagamento (consulte gráfica).',
    options: [
      { value: 'pendente_pagamento', label: 'Pendente — falta pagamento' },
      { value: 'em_producao', label: 'Em Produção (gráfica)' },
      { value: 'concluido', label: 'Concluído (na Lemon Caps)' },
    ],
    defaultStatus: 'pendente_pagamento',
  },
  {
    id: 'codigo_barras',
    label: 'Código de Barras',
    responsavel: 'Jean',
    responsavelNota: 'Prazo definido por solicitação.',
    options: [
      { value: 'nao_necessario', label: 'Não Necessário' },
      { value: 'pendente', label: 'Pendente' },
      { value: 'concluido', label: 'Concluído' },
    ],
    defaultStatus: 'pendente',
  },
  {
    id: 'producao',
    label: 'Produção',
    responsavel: 'Diego',
    responsavelNota: 'Consultar prazo no VHSYS após criação do pedido.',
    options: [
      { value: 'sem_pedido_vhsys', label: 'Sem pedido (VHSYS)' },
      { value: 'aguardando_producao', label: 'Aguardando produção' },
      { value: 'produzido', label: 'Produzido' },
    ],
    defaultStatus: 'sem_pedido_vhsys',
  },
  {
    id: 'rotulagem',
    label: 'Rotulagem',
    responsavel: 'Diego',
    responsavelNota: 'Derivado da chegada do rótulo + produção.',
    options: [
      { value: 'aguardando_rotulo', label: 'Aguardando rótulo' },
      { value: 'rotulo_na_lemon', label: 'Rótulo na Lemon' },
      { value: 'produto_rotulado', label: 'Produto rotulado' },
    ],
    defaultStatus: 'aguardando_rotulo',
  },
  {
    id: 'logistica',
    label: 'Logística de Envio',
    responsavel: 'Thiago',
    responsavelNota: 'Prazo de 48h para envio após produto rotulado.',
    options: [
      { value: 'aguardando_envio', label: 'Aguardando envio' },
      { value: 'enviado', label: 'Enviado' },
    ],
    defaultStatus: 'aguardando_envio',
  },
];

export const ETAPAS_BY_ID: Record<EtapaId, EtapaConfig> = ETAPAS.reduce(
  (acc, e) => ({ ...acc, [e.id]: e }),
  {} as Record<EtapaId, EtapaConfig>,
);

export const RESPONSAVEIS = ['Jean', 'Rodrigo', 'Diego', 'Thiago'] as const;

// ---------- Dias úteis ----------
// Lista mínima de feriados nacionais fixos (suficiente para indicação de prazo).
const FERIADOS_FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'];
const isFeriado = (d: Date) => {
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return FERIADOS_FIXOS.includes(mmdd);
};

export const addDiasUteis = (base: Date, dias: number): Date => {
  let d = new Date(base);
  let restantes = dias;
  while (restantes > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d) && !isFeriado(d)) restantes--;
  }
  return d;
};

// ---------- Status do status atual de cada etapa ----------
const STATUS_CONCLUIDO: Record<EtapaId, string[]> = {
  rotulos_arte: ['concluido', 'faca_voce_mesmo'],
  pagina_vendas: ['concluido', 'nao_necessario'],
  registro_inpi: ['concluido', 'nao_necessario'],
  impressao_rotulo: ['concluido'],
  codigo_barras: ['concluido', 'nao_necessario'],
  producao: ['produzido'],
  rotulagem: ['produto_rotulado'],
  logistica: ['enviado'],
};

export const isEtapaConcluida = (etapa: EtapaId, status: string) =>
  STATUS_CONCLUIDO[etapa].includes(status);

// ---------- Mapeamento status legado (acompanhamento_processos) → status detalhado ----------
export const getStatusEtapa = (etapa: EtapaId, acomp?: AcompanhamentoProcessos): string => {
  const cfg = ETAPAS_BY_ID[etapa];
  if (!acomp) return cfg.defaultStatus;

  switch (etapa) {
    case 'rotulos_arte':
      return acomp.rotulos_arte_status
        ?? (acomp.criacao_marca === 'entregue' ? 'concluido' : 'pendente');
    case 'pagina_vendas':
      return acomp.pagina_vendas_status
        ?? (acomp.pagina_venda === 'entregue' ? 'concluido' : 'pendente');
    case 'registro_inpi':
      return acomp.registro_inpi_status
        ?? (acomp.registro_inpi === 'entregue' ? 'concluido'
          : acomp.registro_inpi === 'nao_necessario' ? 'nao_necessario'
          : 'pendente');
    case 'impressao_rotulo':
      return acomp.impressao_rotulo_status
        ?? (acomp.impressao_rotulos === 'entregue' ? 'concluido'
          : acomp.impressao_rotulos === 'nao_necessario' ? 'concluido'
          : 'pendente_pagamento');
    case 'codigo_barras':
      return acomp.codigo_barras_status
        ?? (acomp.codigo_barras === 'entregue' ? 'concluido'
          : acomp.codigo_barras === 'nao_necessario' ? 'nao_necessario'
          : 'pendente');
    case 'producao':
      return acomp.producao_status_detalhado
        ?? (acomp.producao === 'entregue' ? 'produzido' : 'sem_pedido_vhsys');
    case 'rotulagem':
      return acomp.rotulagem_status ?? 'aguardando_rotulo';
    case 'logistica':
      return acomp.logistica_status
        ?? (acomp.envio_produto === 'entregue' ? 'enviado'
          : acomp.integracao_logistica === 'entregue' ? 'enviado'
          : 'aguardando_envio');
  }
};

export interface EtapaInfo {
  etapa: EtapaConfig;
  status: string;
  statusLabel: string;
  concluida: boolean;
  prazoPrevisto?: Date;
  diasRestantes?: number;
  atrasada: boolean;
  dataConclusao?: Date;
  observacao?: string;
  contratada: boolean;
}

const parseMaybe = (s?: string) => (s ? parseISO(s) : undefined);

// ---------- Calcula prazos previstos por etapa ----------
export const calcularEtapaInfo = (
  pedido: Pedido,
  etapaId: EtapaId,
  contratada: boolean,
): EtapaInfo => {
  const cfg = ETAPAS_BY_ID[etapaId];
  const acomp = pedido.acompanhamento_processos;
  const status = getStatusEtapa(etapaId, acomp);
  const concluida = isEtapaConcluida(etapaId, status);
  const opt = cfg.options.find((o) => o.value === status);

  const prazoSalvo = parseMaybe(acomp?.prazos_por_etapa?.[etapaId]?.previsto);
  const dataConclusao = parseMaybe(acomp?.prazos_por_etapa?.[etapaId]?.concluido);
  const observacao = acomp?.observacoes_por_etapa?.[etapaId];

  // Datas-base
  const dataPedido = pedido.data_pedido;
  const dataPgto = (pedido.orcamento_snapshot as any)?.data_pagamento
    ? new Date((pedido.orcamento_snapshot as any).data_pagamento)
    : dataPedido;
  const briefingEm = parseMaybe(acomp?.briefing_preenchido_em) ?? dataPgto;
  const rotuloPagoEm = parseMaybe(acomp?.impressao_rotulo_pago_em) ?? dataPgto;

  // Cálculo automático de prazo previsto (se não houver salvo)
  let prazoCalc: Date | undefined;
  switch (etapaId) {
    case 'rotulos_arte':
      prazoCalc = addDiasUteis(briefingEm, 7);
      break;
    case 'pagina_vendas': {
      const rotConcluidoStr = acomp?.prazos_por_etapa?.['rotulos_arte']?.concluido;
      const base = rotConcluidoStr ? parseISO(rotConcluidoStr) : addDiasUteis(briefingEm, 7);
      prazoCalc = addDiasUteis(base, 10);
      break;
    }
    case 'impressao_rotulo':
      prazoCalc = addDiasUteis(rotuloPagoEm, 15);
      break;
    case 'registro_inpi':
      prazoCalc = addDays(dataPgto, 60);
      break;
    case 'codigo_barras':
      prazoCalc = addDiasUteis(dataPgto, 5);
      break;
    case 'producao':
      prazoCalc = parseMaybe(acomp?.producao_prazo_vhsys) ?? addDays(dataPgto, 30);
      break;
    case 'rotulagem':
      prazoCalc = addDays(dataPgto, 35);
      break;
    case 'logistica':
      prazoCalc = addDays(dataPgto, 37);
      break;
  }

  const prazoPrevisto = prazoSalvo ?? prazoCalc;
  const diasRestantes = prazoPrevisto
    ? differenceInCalendarDays(prazoPrevisto, new Date())
    : undefined;
  const atrasada = !!(prazoPrevisto && !concluida && diasRestantes! < 0);

  return {
    etapa: cfg,
    status,
    statusLabel: opt?.label ?? status,
    concluida,
    prazoPrevisto,
    diasRestantes,
    atrasada,
    dataConclusao,
    observacao,
    contratada,
  };
};

// ---------- Detecta quais entregáveis o pedido contratou ----------
export const getEtapasContratadas = (pedido: Pedido): Record<EtapaId, boolean> => {
  const result: Record<EtapaId, boolean> = {
    pagina_vendas: false,
    rotulos_arte: false,
    registro_inpi: false,
    impressao_rotulo: false,
    codigo_barras: false,
    producao: true, // Toda produção é "contratada"
    rotulagem: true,
    logistica: true,
  };
  const servicos = (pedido.orcamento_snapshot as any)?.servicos_marca || [];
  servicos.forEach((s: any) => {
    (s.entregaveis || []).forEach((e: any) => {
      if (!e.incluso) return;
      const cat = classificarEntregavel(e.nome);
      if (cat === 'pagina_vendas') result.pagina_vendas = true;
      else if (cat === 'design_rotulos') result.rotulos_arte = true;
      else if (cat === 'registro_inpi') result.registro_inpi = true;
      else if (cat === 'impressao_rotulos') result.impressao_rotulo = true;
      else if (cat === 'codigo_barras') result.codigo_barras = true;
    });
  });
  return result;
};

// ---------- Status geral do projeto ----------
export type StatusGeralProjeto = 'aguardando_inicio' | 'em_andamento' | 'em_atraso' | 'concluido';

export const getStatusGeral = (etapas: EtapaInfo[]): StatusGeralProjeto => {
  const ativas = etapas.filter((e) => e.contratada);
  if (ativas.length === 0) return 'aguardando_inicio';
  if (ativas.every((e) => e.concluida)) return 'concluido';
  if (ativas.some((e) => e.atrasada)) return 'em_atraso';
  if (ativas.some((e) => e.concluida)) return 'em_andamento';
  return 'aguardando_inicio';
};

export const STATUS_GERAL_LABEL: Record<StatusGeralProjeto, string> = {
  aguardando_inicio: 'Aguardando início',
  em_andamento: 'Em andamento',
  em_atraso: 'Em atraso',
  concluido: 'Concluído',
};

export const STATUS_GERAL_COLOR: Record<StatusGeralProjeto, string> = {
  aguardando_inicio: 'bg-muted text-muted-foreground border-border',
  em_andamento: 'bg-blue-100 text-blue-800 border-blue-300',
  em_atraso: 'bg-destructive/10 text-destructive border-destructive/30',
  concluido: 'bg-green-100 text-green-800 border-green-300',
};

// ---------- Utilitários para gravar status ----------
export const aplicarStatusEtapa = (
  acomp: AcompanhamentoProcessos | undefined,
  etapa: EtapaId,
  novoStatus: string,
): AcompanhamentoProcessos => {
  const base: AcompanhamentoProcessos = acomp ?? {
    criacao_marca: 'pendente',
    producao: 'pendente',
    integracao_logistica: 'pendente',
    pagina_venda: 'pendente',
    envio_produto: 'pendente',
    satisfacao_nota: null,
    satisfacao_observacoes: null,
  };
  const next: any = { ...base };
  const concluida = isEtapaConcluida(etapa, novoStatus);
  const prazos = { ...(next.prazos_por_etapa || {}) };

  switch (etapa) {
    case 'rotulos_arte':
      next.rotulos_arte_status = novoStatus;
      next.criacao_marca = concluida ? 'entregue' : 'pendente';
      break;
    case 'pagina_vendas':
      next.pagina_vendas_status = novoStatus;
      next.pagina_venda = concluida ? 'entregue' : 'pendente';
      break;
    case 'registro_inpi':
      next.registro_inpi_status = novoStatus;
      next.registro_inpi =
        novoStatus === 'concluido' ? 'entregue'
          : novoStatus === 'nao_necessario' ? 'nao_necessario'
          : 'pendente';
      break;
    case 'impressao_rotulo':
      next.impressao_rotulo_status = novoStatus;
      next.impressao_rotulos = novoStatus === 'concluido' ? 'entregue' : 'pendente';
      break;
    case 'codigo_barras':
      next.codigo_barras_status = novoStatus;
      next.codigo_barras =
        novoStatus === 'concluido' ? 'entregue'
          : novoStatus === 'nao_necessario' ? 'nao_necessario'
          : 'pendente';
      break;
    case 'producao':
      next.producao_status_detalhado = novoStatus;
      next.producao = concluida ? 'entregue' : 'pendente';
      break;
    case 'rotulagem':
      next.rotulagem_status = novoStatus;
      break;
    case 'logistica':
      next.logistica_status = novoStatus;
      next.envio_produto = concluida ? 'entregue' : 'pendente';
      next.integracao_logistica = concluida ? 'entregue' : (next.integracao_logistica || 'pendente');
      break;
  }

  // Marca data de conclusão automaticamente
  const hoje = new Date().toISOString();
  prazos[etapa] = {
    ...(prazos[etapa] || {}),
    concluido: concluida ? (prazos[etapa]?.concluido || hoje) : undefined,
  };
  next.prazos_por_etapa = prazos;

  return next;
};

export const aplicarPrazoEtapa = (
  acomp: AcompanhamentoProcessos | undefined,
  etapa: EtapaId,
  dataISO: string | undefined,
): AcompanhamentoProcessos => {
  const base: AcompanhamentoProcessos = acomp ?? ({} as any);
  const prazos = { ...(base.prazos_por_etapa || {}) };
  prazos[etapa] = { ...(prazos[etapa] || {}), previsto: dataISO };
  return { ...base, prazos_por_etapa: prazos } as AcompanhamentoProcessos;
};

export const aplicarObservacaoEtapa = (
  acomp: AcompanhamentoProcessos | undefined,
  etapa: EtapaId,
  texto: string,
): AcompanhamentoProcessos => {
  const base: AcompanhamentoProcessos = acomp ?? ({} as any);
  const obs = { ...(base.observacoes_por_etapa || {}) };
  obs[etapa] = texto;
  return { ...base, observacoes_por_etapa: obs } as AcompanhamentoProcessos;
};

export const aplicarProdutosCS = (
  acomp: AcompanhamentoProcessos | undefined,
  produtos: { id: string; nome: string }[],
): AcompanhamentoProcessos => {
  const base: AcompanhamentoProcessos = acomp ?? ({} as any);
  return { ...base, produtos_cs: produtos } as AcompanhamentoProcessos;
};

export const aplicarObservacaoGeralCS = (
  acomp: AcompanhamentoProcessos | undefined,
  texto: string,
): AcompanhamentoProcessos => {
  const base: AcompanhamentoProcessos = acomp ?? ({} as any);
  return { ...base, observacao_geral_cs: texto } as AcompanhamentoProcessos;
};