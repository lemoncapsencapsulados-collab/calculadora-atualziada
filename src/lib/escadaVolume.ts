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
 *
 * A ÚLTIMA FAIXA SAIU DA PLANILHA. Acima de 4.999 potes a fábrica abre mais
 * dois pontos de margem, por decisão comercial de 23/11/2026, e esse degrau
 * precisa do custo do produto para ser calculado -- os outros cinco saem só
 * do preço de catálogo. Ver `BONUS_MARGEM_VOLUME_TOPO`.
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
  // Sem desconto nos degraus do meio: a margem da goma já está no mínimo da
  // categoria. Ela recebe só o bônus do topo, como todas as outras.
  Gummies: null,
};

/**
 * Pontos de margem que o pedido de 5.000 potes ou mais devolve ao cliente.
 *
 * Decisão comercial de 23/11/2026: acima de 4.999 potes a fábrica abre mais
 * dois pontos de margem, em cima do que a escada já descontava. É o que
 * diferencia o pedido grande -- até aqui o 5.000+ era apenas o último degrau
 * de uma sequência, e quem fechava volume não via vantagem clara sobre 2.500.
 *
 * DOIS PONTOS DE MARGEM NÃO SÃO DOIS PONTOS DE PREÇO. A conta está em
 * `precoDaFaixa`: em reais a queda sai entre 2,8% e 3,0% do preço do degrau.
 */
export const BONUS_MARGEM_VOLUME_TOPO = 0.02;

/** A última faixa -- a única que recebe o bônus. */
export const INDICE_FAIXA_TOPO = FAIXAS_VOLUME.length - 1;

/**
 * Desconto do topo para quando o custo do produto não é conhecido.
 *
 * O bônus é definido em margem, e margem exige custo. Sem custo não há como
 * honrar os dois pontos, e cai-se nestes descontos sobre a tabela de 100 --
 * medidos nos 30 produtos do CATÁLOGO 2026, na ponta conservadora de cada
 * linha, de modo que nunca descontem mais do que a regra exata daria.
 *
 * Os três lugares que desenham a escada hoje passam o custo: isto é rede de
 * segurança, não caminho normal.
 */
export const DESCONTO_TOPO_SEM_CUSTO: Record<CategoriaEscada, number> = {
  Encapsulados: 0.221,
  'Líquidos': 0.197,
  'Solúveis': 0.204,
  Gummies: 0.033,
};

/**
 * Margem mínima e máxima aceitas em cada categoria, da planilha.
 *
 * Valem para os cinco primeiros degraus. O topo tem piso próprio, dois pontos
 * abaixo -- ver `limitesDaFaixa`.
 */
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
 * O preço da faixa pela escada da planilha, ANTES do bônus do topo.
 *
 * A faixa do catálogo devolve o preço gravado, sem recalcular: recalculá-lo a
 * partir da tabela de 100 acumularia dois arredondamentos para cima e o
 * produto sairia um centavo mais caro do que o preço que o comercial combinou.
 */
export function precoBaseDaFaixa(
  precoCatalogo: number,
  tipoProduto: string | null | undefined,
  indiceFaixa: number,
): number {
  const p = Number(precoCatalogo) || 0;
  const descontos = DESCONTOS_POR_CATEGORIA[categoriaDoTipo(tipoProduto)];
  if (!descontos) return Number(p.toFixed(2));
  if (indiceFaixa === INDICE_FAIXA_CATALOGO) return Number(p.toFixed(2));
  const desconto = descontos[indiceFaixa] ?? 0;
  return tetoCentavo(tabelaCemPotes(p) * (1 - desconto));
}

/**
 * O preço por pote numa faixa, com o bônus de volume já aplicado.
 *
 * Nos cinco primeiros degraus é a escada da planilha. No topo (5.000 ou mais)
 * a margem cai `BONUS_MARGEM_VOLUME_TOPO` pontos.
 *
 * Margem é `1 − custo/preço`, então derrubá-la em dois pontos é fazer
 * `custo/preço` subir exatamente 0,02. Vale igual para a margem bruta e para
 * a da calculadora, que só difere pelos 12% de imposto sobre o preço: os dois
 * lados perdem os mesmos dois pontos.
 *
 * O arredondamento para cima no centavo come um pedaço do bônus -- a queda
 * realizada fica entre 1,93 e 2,00 pontos, nunca acima. Sobra para a fábrica,
 * que é o lado certo de errar um centavo.
 */
export function precoDaFaixa(
  precoCatalogo: number,
  tipoProduto: string | null | undefined,
  indiceFaixa: number,
  custoPorPote?: number | null,
): number {
  const base = precoBaseDaFaixa(precoCatalogo, tipoProduto, indiceFaixa);
  if (indiceFaixa !== INDICE_FAIXA_TOPO || base <= 0) return base;

  const categoria = categoriaDoTipo(tipoProduto);
  const custo = Number(custoPorPote);

  // Custo desconhecido: cai-se no desconto medido da linha, aplicado sobre a
  // MESMA referência que a escada usa -- a tabela de 100 onde ela existe, o
  // preço de catálogo nas gomas. Aplicá-lo sobre o preço do degrau seria
  // descontar duas vezes.
  if (!Number.isFinite(custo) || custo <= 0) {
    const descontos = DESCONTOS_POR_CATEGORIA[categoria];
    const referencia = descontos
      ? tabelaCemPotes(precoCatalogo)
      : Number((Number(precoCatalogo) || 0).toFixed(2));
    return tetoCentavo(referencia * (1 - (DESCONTO_TOPO_SEM_CUSTO[categoria] ?? 0)));
  }

  // Custo conhecido mas sem dois pontos para dar: o produto já não sustenta o
  // bônus, e inventar um desconto aqui venderia no prejuízo. Fica no preço da
  // escada, sem bônus -- o problema é a precificação do produto, não a regra.
  const proporcao = custo / base;
  if (proporcao + BONUS_MARGEM_VOLUME_TOPO >= 1) return base;

  return tetoCentavo(custo / (proporcao + BONUS_MARGEM_VOLUME_TOPO));
}

/**
 * Os limites de margem da faixa.
 *
 * O topo foi autorizado a descer dois pontos, então cobrar dele o piso dos
 * outros degraus pintaria de vermelho justamente o produto que segue a regra
 * nova.
 */
export function limitesDaFaixa(
  categoria: CategoriaEscada,
  indiceFaixa: number,
): { minima: number; maxima: number } {
  const base = LIMITES_MARGEM[categoria];
  if (indiceFaixa !== INDICE_FAIXA_TOPO) return base;
  return { minima: base.minima - BONUS_MARGEM_VOLUME_TOPO * 100, maxima: base.maxima };
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
  /** Margem fora dos limites da faixa — a planilha pinta de vermelho. */
  foraDaFaixaDeMargem: boolean;
  /** Faixa que carrega o bônus de margem do volume (5.000 ou mais). */
  bonusDeVolume: boolean;
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
  const custo = Number(custoPorPote);
  const temCusto = Number.isFinite(custo) && custo > 0;
  // Referência do desconto: a tabela de 100 onde há escada, o próprio preço
  // de catálogo nas gomas, que não têm tabela de entrada.
  const referencia = descontos
    ? tabelaCemPotes(precoCatalogo)
    : Number((Number(precoCatalogo) || 0).toFixed(2));

  return FAIXAS_VOLUME.map((faixa, i) => {
    const precoPote = precoDaFaixa(precoCatalogo, tipoProduto, i, custoPorPote);
    const margem = temCusto && precoPote > 0 ? ((precoPote - custo) / precoPote) * 100 : null;
    const limites = limitesDaFaixa(categoria, i);
    const bonusDeVolume = i === INDICE_FAIXA_TOPO && BONUS_MARGEM_VOLUME_TOPO > 0;
    return {
      indice: i,
      faixa,
      precoPote,
      // No topo o desconto da tabela não vale mais: o bônus de margem derruba
      // o preço além dela, e quem lê a coluna precisa ver o desconto de
      // verdade. Nos outros degraus vale a constante publicada, para a tela
      // não exibir 14,97% onde o documento diz 15%.
      descontoPercentual: bonusDeVolume
        ? (referencia > 0 ? (1 - precoPote / referencia) * 100 : 0)
        : (descontos?.[i] ?? 0) * 100,
      margemPercentual: margem,
      foraDaFaixaDeMargem:
        margem != null && (margem < limites.minima || margem > limites.maxima),
      bonusDeVolume,
    };
  });
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
  /** `true` quando o degrau de cima é o do bônus de margem (5.000 ou mais). */
  proximoTemBonusDeVolume: boolean;
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
  custoPorPote?: number | null,
): ComparacaoDegrau | null {
  const q = Math.max(0, Number(potes) || 0);
  if (q <= 0) return null;

  const i = indiceDaFaixa(q);
  const proximo = i + 1;
  if (proximo >= FAIXAS_VOLUME.length) return null;

  const precoAtual = precoDaFaixa(precoCatalogo, tipoProduto, i, custoPorPote);
  const precoProximo = precoDaFaixa(precoCatalogo, tipoProduto, proximo, custoPorPote);
  if (precoAtual <= 0 || precoProximo <= 0) return null;

  // Degrau que não derruba o preço não é degrau: nas gomas os cinco primeiros
  // custam igual, e prometer economia de R$ 0,00 ali queima a credibilidade
  // do aviso justamente onde ele tem algo real a dizer (o 5.000+).
  if (precoAtual - precoProximo < 0.005) return null;

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
    proximoTemBonusDeVolume: proximo === INDICE_FAIXA_TOPO && BONUS_MARGEM_VOLUME_TOPO > 0,
  };
}
