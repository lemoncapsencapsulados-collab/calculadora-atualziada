/**
 * Escada de preço por volume · White Label Lemon Caps.
 *
 * O catálogo deixou de ter preço único: o preço por pote cai conforme o volume
 * do SKU. A fonte é a planilha "Escada de Preços por Volume · White Label
 * Lemon Caps", e esta é a tradução dela em código.
 *
 * NÃO SE GRAVA PREÇO POR FAIXA. O preço do catálogo (`preco_venda` da
 * precificação) É a faixa de 300 a 499, e as outras cinco saem dele por regra.
 * Guardar as seis seria guardar a mesma informação seis vezes: mexer no preço
 * de um produto deixaria cinco cópias desatualizadas, e a tela mostraria
 * desconto que o financeiro não concedeu.
 *
 * A FAIXA É CONTADA POR SKU, e não pelo pedido. Três produtos com 100 potes
 * cada pagam a faixa de 100 a 299 nos três -- é o volume de produção daquela
 * fórmula que gera a economia, não o tamanho da nota.
 */

/** As quatro categorias da planilha. Gummy fica fora da escada. */
export type CategoriaEscada = 'Encapsulados' | 'Líquidos' | 'Solúveis' | 'Gummies';

/** `tipo_produto` como a calculadora grava -> categoria da planilha. */
export function categoriaDoTipo(tipoProduto: string | null | undefined): CategoriaEscada {
  const t = String(tipoProduto ?? '').trim().toLowerCase();
  if (t.startsWith('líquid') || t.startsWith('liquid')) return 'Líquidos';
  if (t.startsWith('solúv') || t.startsWith('soluv')) return 'Solúveis';
  if (t.startsWith('gummy') || t.startsWith('goma')) return 'Gummies';
  return 'Encapsulados';
}

export interface FaixaVolume {
  /** Quantidade mínima de potes do SKU. */
  de: number;
  /** Último pote da faixa; `null` na última, que não tem teto. */
  ate: number | null;
  rotulo: string;
}

export const FAIXAS_VOLUME: FaixaVolume[] = [
  { de: 100, ate: 299, rotulo: '100 a 299' },
  { de: 300, ate: 499, rotulo: '300 a 499' },
  { de: 500, ate: 999, rotulo: '500 a 999' },
  { de: 1000, ate: 2499, rotulo: '1.000 a 2.499' },
  { de: 2500, ate: 4999, rotulo: '2.500 a 4.999' },
  { de: 5000, ate: null, rotulo: '5.000 ou mais' },
];

/** A faixa do catálogo: é dela que as outras descem. */
export const INDICE_FAIXA_CATALOGO = 1; // 300 a 499

/**
 * Desconto sobre a tabela de 100 potes, por categoria e faixa.
 *
 * Os números são da planilha. O desconto de 300 (15%) é o que define a tabela
 * de 100: ela é o preço do catálogo dividido por (1 − 0,15).
 */
export const DESCONTOS_POR_CATEGORIA: Record<CategoriaEscada, number[] | null> = {
  Encapsulados: [0, 0.15, 0.16, 0.175, 0.19, 0.2],
  'Líquidos': [0, 0.15, 0.155, 0.16, 0.1675, 0.175],
  'Solúveis': [0, 0.15, 0.1575, 0.165, 0.1725, 0.18],
  // Preço único: a margem da goma (30,1% a 30,8%) já está no mínimo de 30%.
  Gummies: null,
};

/** Margem mínima e máxima aceitas em cada categoria, da planilha. */
export const LIMITES_MARGEM: Record<CategoriaEscada, { minima: number; maxima: number }> = {
  Encapsulados: { minima: 18, maxima: 35 },
  'Líquidos': { minima: 18, maxima: 35 },
  'Solúveis': { minima: 22, maxima: 55 },
  Gummies: { minima: 30, maxima: 80 },
};

/**
 * Arredonda para cima no centavo.
 *
 * O `round(.., 6)` antes do teto não é enfeite: em ponto flutuante
 * `9.46 * 100` dá `946.0000000000001`, e `Math.ceil` subiria o preço de tabela
 * em um centavo sem ninguém ter pedido. Conferido contra os 180 preços da
 * planilha -- sem essa correção, 5 deles saíam um centavo acima.
 */
export function tetoCentavo(valor: number): number {
  const v = Number(valor);
  if (!Number.isFinite(v)) return 0;
  return Math.ceil(Number((v * 100).toFixed(6))) / 100;
}

/** A tabela de 100 potes: o preço do catálogo dividido por (1 − 0,15). */
export function tabelaCemPotes(precoCatalogo: number): number {
  const p = Number(precoCatalogo) || 0;
  if (p <= 0) return 0;
  return tetoCentavo(p / (1 - 0.15));
}

/**
 * O preço por pote numa faixa.
 *
 * A faixa do catálogo devolve o preço gravado, sem recalcular: recalculá-lo a
 * partir da tabela de 100 acumularia dois arredondamentos para cima e o
 * produto sairia um centavo mais caro do que o preço que o comercial combinou.
 */
export function precoDaFaixa(
  precoCatalogo: number,
  tipoProduto: string | null | undefined,
  indiceFaixa: number,
): number {
  const p = Number(precoCatalogo) || 0;
  const categoria = categoriaDoTipo(tipoProduto);
  const descontos = DESCONTOS_POR_CATEGORIA[categoria];
  if (!descontos) return Number(p.toFixed(2));
  if (indiceFaixa === INDICE_FAIXA_CATALOGO) return Number(p.toFixed(2));
  const desconto = descontos[indiceFaixa] ?? 0;
  return tetoCentavo(tabelaCemPotes(p) * (1 - desconto));
}

/** Em que faixa cai uma quantidade de potes. Abaixo de 100 vale a primeira. */
export function indiceDaFaixa(potes: number): number {
  const q = Number(potes) || 0;
  for (let i = FAIXAS_VOLUME.length - 1; i >= 0; i--) {
    if (q >= FAIXAS_VOLUME[i].de) return i;
  }
  return 0;
}

export interface DegrauEscada {
  indice: number;
  faixa: FaixaVolume;
  precoPote: number;
  /** Desconto sobre a tabela de 100 potes, em %. */
  descontoPercentual: number;
  /** Margem no preço daquela faixa, em %, quando se sabe o custo. */
  margemPercentual: number | null;
  /** Margem fora dos limites da categoria — a planilha pinta de vermelho. */
  foraDaFaixaDeMargem: boolean;
}

/**
 * A escada inteira de um produto.
 *
 * `custoPorPote` é opcional: sem ele a escada ainda mostra preço, só não
 * mostra margem. O custo sai da precificação (total de custos de produção).
 */
export function escadaDoProduto(
  precoCatalogo: number,
  tipoProduto: string | null | undefined,
  custoPorPote?: number | null,
): DegrauEscada[] {
  const categoria = categoriaDoTipo(tipoProduto);
  const descontos = DESCONTOS_POR_CATEGORIA[categoria];
  const limites = LIMITES_MARGEM[categoria];
  const custo = Number(custoPorPote);
  const temCusto = Number.isFinite(custo) && custo > 0;

  return FAIXAS_VOLUME.map((faixa, i) => {
    const precoPote = precoDaFaixa(precoCatalogo, tipoProduto, i);
    const margem = temCusto && precoPote > 0 ? ((precoPote - custo) / precoPote) * 100 : null;
    return {
      indice: i,
      faixa,
      precoPote,
      descontoPercentual: (descontos?.[i] ?? 0) * 100,
      margemPercentual: margem,
      foraDaFaixaDeMargem:
        margem != null && (margem < limites.minima || margem > limites.maxima),
    };
  });
}

/** Produto que não entra na escada (hoje, as gomas). */
export function temEscada(tipoProduto: string | null | undefined): boolean {
  return DESCONTOS_POR_CATEGORIA[categoriaDoTipo(tipoProduto)] !== null;
}

export interface ComparacaoDegrau {
  /** Quantidade que o vendedor digitou. */
  potesAtuais: number;
  precoAtual: number;
  totalAtual: number;
  /** O primeiro pote da próxima faixa. */
  potesProximo: number;
  precoProximo: number;
  totalProximo: number;
  /** Quanto a mais ele desembolsa para subir de faixa. */
  desembolsoExtra: number;
  /** Quantos potes a mais leva por esse desembolso. */
  potesExtras: number;
  /** O que ele PERDE hoje: a diferença de preço vezes os potes que já leva. */
  perdaNoVolumeAtual: number;
  /** O que os potes da próxima faixa custariam no preço de hoje. */
  totalProximoAoPrecoAtual: number;
  /** Economia ao comprar o volume da próxima faixa já na faixa dela. */
  economiaNoProximoVolume: number;
  /** Quanto cai o preço do pote, em reais e em %. */
  quedaPorPote: number;
  quedaPercentual: number;
  /** `true` quando a faixa atual é a de entrada (abaixo de 300 potes). */
  abaixoDoCatalogo: boolean;
}

/**
 * O que o produtor ganha subindo para a próxima faixa.
 *
 * Existe porque o vendedor digita a quantidade e segue em frente: a escada
 * fica na tela do preço, longe da hora da decisão. Esta função devolve a conta
 * pronta para a tela mostrar NO MOMENTO em que a quantidade é digitada.
 *
 * Devolve `null` quando já se está na última faixa -- não há degrau acima.
 */
export function compararComProximoDegrau(
  potes: number,
  precoCatalogo: number,
  tipoProduto: string | null | undefined,
): ComparacaoDegrau | null {
  if (!temEscada(tipoProduto)) return null;
  const q = Math.max(0, Number(potes) || 0);
  if (q <= 0) return null;

  const i = indiceDaFaixa(q);
  const proximo = i + 1;
  if (proximo >= FAIXAS_VOLUME.length) return null;

  const precoAtual = precoDaFaixa(precoCatalogo, tipoProduto, i);
  const precoProximo = precoDaFaixa(precoCatalogo, tipoProduto, proximo);
  if (precoAtual <= 0 || precoProximo <= 0) return null;

  const potesProximo = FAIXAS_VOLUME[proximo].de;
  const totalAtual = q * precoAtual;
  const totalProximo = potesProximo * precoProximo;

  return {
    potesAtuais: q,
    precoAtual,
    totalAtual,
    potesProximo,
    precoProximo,
    totalProximo,
    desembolsoExtra: totalProximo - totalAtual,
    potesExtras: potesProximo - q,
    perdaNoVolumeAtual: (precoAtual - precoProximo) * q,
    totalProximoAoPrecoAtual: potesProximo * precoAtual,
    economiaNoProximoVolume: potesProximo * (precoAtual - precoProximo),
    quedaPorPote: precoAtual - precoProximo,
    quedaPercentual: ((precoAtual - precoProximo) / precoAtual) * 100,
    abaixoDoCatalogo: i < INDICE_FAIXA_CATALOGO,
  };
}
