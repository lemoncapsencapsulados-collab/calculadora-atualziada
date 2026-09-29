/**
 * Recálculo de preço de um orçamento contra a precificação de hoje.
 *
 * Cada item guarda o `precificacao_id` de onde o preço saiu. Recalcular é reler
 * essa precificação e trazer o preço atual -- é assim que uma alteração de
 * matéria-prima, embalagem, imposto ou markup alcança todos os orçamentos em
 * negociação de uma vez.
 *
 * O resultado diz também POR QUE mudou, comparando os componentes do custo. Sem
 * isso o consultor liga para o cliente com um preço novo e sem argumento; com
 * isso ele diz qual insumo subiu e quanto.
 */

import { arredondarReais } from '@/lib/utils';

/** Componentes do preço, guardados no item para poder comparar depois. */
export interface CustosItem {
  materia_prima: number;
  embalagem: number;
  impostos: number;
  /** Custo indireto/overhead, como a precificação chama. */
  indiretos: number;
  margem_percentual: number;
}

export interface ItemParaRecalculo {
  nome_produto?: string;
  precificacao_id?: string;
  preco_unitario?: number;
  quantidade?: number;
  /** Componentes de quando o orçamento foi montado. Ausente nos antigos. */
  custos_no_orcamento?: CustosItem | null;
}

/** A precificação como está hoje no banco. */
export interface PrecificacaoAtual {
  id: string;
  preco_venda: number;
  custo_materia_prima?: number;
  custo_embalagem?: number;
  total_impostos?: number;
  custo_mao_obra_direta?: number;
  margem_lucro_percentual?: number;
}

export interface MudancaItem {
  nome: string;
  precificacaoId: string;
  quantidade: number;
  precoAntes: number;
  precoDepois: number;
  /** Diferença por unidade. */
  diferenca: number;
  /** Frases prontas do que mudou. Vazio quando não dá para detalhar. */
  motivos: string[];
  /** Componentes novos, para gravar no item recalculado. */
  custosAgora: CustosItem;
}

export interface ResultadoRecalculo {
  mudancas: MudancaItem[];
  /** Itens cuja precificação sumiu do sistema. */
  semPrecificacao: string[];
  totalAntes: number;
  totalDepois: number;
  diferencaTotal: number;
  /** Nada mudou: o preço combinado continua valendo. */
  semMudanca: boolean;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function custosDaPrecificacao(p: PrecificacaoAtual): CustosItem {
  return {
    materia_prima: num(p.custo_materia_prima),
    embalagem: num(p.custo_embalagem),
    impostos: num(p.total_impostos),
    indiretos: num(p.custo_mao_obra_direta),
    margem_percentual: num(p.margem_lucro_percentual),
  };
}

const reais = (v: number) =>
  `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Só reporta diferença que aparece em centavo; ruído de arredondamento não é motivo. */
const RELEVANTE = 0.005;

/**
 * O que mudou entre os componentes de antes e os de hoje.
 *
 * Sem os componentes de antes -- orçamentos feitos antes de o sistema passar a
 * guardá-los -- devolve vazio, e quem chama diz só a diferença de preço. Chutar
 * a causa seria pior que admitir que não dá para saber.
 */
export function motivosDaMudanca(antes: CustosItem | null | undefined, agora: CustosItem): string[] {
  if (!antes) return [];
  const motivos: string[] = [];
  const comparar = (rotulo: string, de: number, para: number) => {
    const d = para - de;
    if (Math.abs(d) < RELEVANTE) return;
    motivos.push(`${rotulo} ${d > 0 ? 'subiu' : 'caiu'} ${reais(d)} (${reais(de)} → ${reais(para)})`);
  };

  comparar('Matéria-prima', antes.materia_prima, agora.materia_prima);
  comparar('Embalagem', antes.embalagem, agora.embalagem);
  comparar('Impostos', antes.impostos, agora.impostos);
  comparar('Custos indiretos', antes.indiretos, agora.indiretos);

  const dMargem = agora.margem_percentual - antes.margem_percentual;
  if (Math.abs(dMargem) >= 0.05) {
    motivos.push(
      `Margem ${dMargem > 0 ? 'subiu' : 'caiu'} ${Math.abs(dMargem).toFixed(1)} pontos ` +
        `(${antes.margem_percentual.toFixed(1)}% → ${agora.margem_percentual.toFixed(1)}%)`,
    );
  }
  return motivos;
}

/**
 * Compara os itens do orçamento com as precificações de hoje.
 *
 * Função pura: recebe o que já foi lido do banco e devolve o que mudou. Quem
 * grava é o hook -- e só depois de o consultor confirmar no popup.
 */
export function recalcularItens(
  itens: ItemParaRecalculo[],
  precificacoes: PrecificacaoAtual[],
): ResultadoRecalculo {
  const porId = new Map(precificacoes.map((p) => [p.id, p]));
  const mudancas: MudancaItem[] = [];
  const semPrecificacao: string[] = [];
  let totalAntes = 0;
  let totalDepois = 0;

  for (const item of itens) {
    const qtd = num(item.quantidade);
    const antes = num(item.preco_unitario);
    totalAntes += antes * qtd;

    // Item avulso, digitado à mão, não tem de onde recalcular: o preço é o que
    // o consultor escreveu, e mexer nele seria inventar.
    if (!item.precificacao_id) {
      totalDepois += antes * qtd;
      continue;
    }

    const atual = porId.get(item.precificacao_id);
    if (!atual) {
      // Precificação apagada: mantém o preço e avisa, em vez de zerar o item.
      semPrecificacao.push(item.nome_produto || 'Produto sem nome');
      totalDepois += antes * qtd;
      continue;
    }

    const depois = arredondarReais(num(atual.preco_venda));
    totalDepois += depois * qtd;
    if (Math.abs(depois - antes) < RELEVANTE) continue;

    const custosAgora = custosDaPrecificacao(atual);
    mudancas.push({
      nome: item.nome_produto || 'Produto sem nome',
      precificacaoId: item.precificacao_id,
      quantidade: qtd,
      precoAntes: antes,
      precoDepois: depois,
      diferenca: arredondarReais(depois - antes),
      motivos: motivosDaMudanca(item.custos_no_orcamento, custosAgora),
      custosAgora,
    });
  }

  return {
    mudancas,
    semPrecificacao,
    totalAntes: arredondarReais(totalAntes),
    totalDepois: arredondarReais(totalDepois),
    diferencaTotal: arredondarReais(totalDepois - totalAntes),
    semMudanca: mudancas.length === 0,
  };
}
