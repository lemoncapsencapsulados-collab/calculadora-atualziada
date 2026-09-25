/**
 * Espelho do e-commerce (loja.lemoncaps.com.br) para o Catalogo Lemon.
 *
 * Duas coisas vivem aqui: os nichos que a loja usa para separar produtos, e a
 * correspondencia entre a formula da calculadora e o produto que o cliente ve'
 * na loja. Os nomes dos nichos e dos produtos sao copia literal da loja -- quem
 * atualizar isto deve conferir la', nao inventar.
 *
 * Formula sem correspondente fica FORA do mapa de proposito. O criterio e' o do
 * pedido: se o produto nao existe no e-commerce, ele continua com o nome do
 * sistema. Chutar uma correspondencia parecida faria o consultor cotar um
 * produto que nao e' aquele -- 150g virando 300g, tutti-frutti virando frutas
 * vermelhas. Na duvida, nao mapeie.
 */

export type NichoLoja = 'vitalidade' | 'energia' | 'performance' | 'sono' | 'beleza';

/** Sem correspondente na loja: continua como esta' no sistema. */
export const SEM_LOJA = 'sem_loja' as const;
export type AbaCatalogo = NichoLoja | typeof SEM_LOJA;

export const NICHOS: { id: NichoLoja; nome: string; colecao: string }[] = [
  { id: 'vitalidade', nome: 'Vitalidade & Equilíbrio', colecao: 'vitalidade-equilibrio' },
  { id: 'energia', nome: 'Energia & Foco', colecao: 'energia-disposicao' },
  { id: 'performance', nome: 'Performance & Treino', colecao: 'performance-treino' },
  { id: 'sono', nome: 'Sono & Recuperação', colecao: 'sono-relaxamento' },
  { id: 'beleza', nome: 'Beleza & Bem-Estar', colecao: 'beleza-bem-estar' },
];

export const NICHO_NOME: Record<AbaCatalogo, string> = {
  vitalidade: 'Vitalidade & Equilíbrio',
  energia: 'Energia & Foco',
  performance: 'Performance & Treino',
  sono: 'Sono & Recuperação',
  beleza: 'Beleza & Bem-Estar',
  [SEM_LOJA]: 'Fora da loja',
};

export interface ProdutoLoja {
  /** Nome exato como aparece na loja. */
  nome: string;
  /** Um produto pode estar em mais de uma colecao, como na loja. */
  nichos: NichoLoja[];
  /** Nomes de formula na calculadora que sao este produto. */
  formulas: string[];
}

/**
 * Os 17 produtos da loja. `formulas` lista so' o que da' para afirmar: mesmo
 * produto, mesma apresentacao, mesma gramatura.
 */
export const PRODUTOS_LOJA: ProdutoLoja[] = [
  {
    nome: 'Lemon Caps Moro Slim Complex Laranja Moro e Café Verde 60 cápsulas 30g',
    nichos: ['vitalidade'],
    formulas: ['Emagrecimento em Cápsulas - Moro Slim', 'EMAGRECIMENTO - MOROSLIM'],
  },
  {
    nome: 'Lemon Caps Slym Up Gotas 30 ml Cúrcuma Café Verde e Colina',
    nichos: ['vitalidade'],
    formulas: [
      'Emagrecimento em Gotas - Slim Up',
      'Emagrecimento - Emagrecimento em Gotas',
      'Emagrecimento em Gotas (Linha Standart - 30ml)',
      'EMAGRECIMENTO EM GOTAS (30ML)',
    ],
  },
  { nome: 'Lemon Caps Detox Bebida em Pó Vitamina C Sabor Limão 300g 30 doses', nichos: ['vitalidade'], formulas: [] },
  { nome: 'Lemon Caps Lidema Vitamina C L-Carnitina Cúrcuma 60 Cápsulas 30g', nichos: ['vitalidade'], formulas: [] },

  {
    nome: 'Lemon Caps Pró Energy Cafeína Taurina Guaraná 60 cápsulas',
    nichos: ['energia'],
    formulas: ['Energia e disposição - Pro Energy', 'PRÉ TREINO - PRÓ ENERGY'],
  },
  {
    nome: 'Lemon Caps Multivitamínico 60 cápsulas 12 vitaminas e 5 minerais',
    nichos: ['energia', 'beleza'],
    formulas: [
      'Imunidade - Multivitamínico',
      'Beleza e bem-estar - Multi Vitta',
      'MULTIVITAMÍNICO',
    ],
  },
  {
    nome: 'Lemon Caps Focus Colina L-Tirosina L-Teanina 60 Cápsulas',
    nichos: ['energia'],
    formulas: ['Foco e concentração - Focus Colina'],
  },

  {
    nome: 'Lemon Caps Creatina Monohidratada 150g Sem Sabor 30 Doses',
    nichos: ['performance'],
    formulas: ['Energia e disposição - Creatina Monohidratada 150g'],
  },
  {
    nome: 'Lemon Caps Creatina Gummy Frutas Vermelhas 60 Gomas 180g',
    nichos: ['performance'],
    formulas: ['Energia e disposição - Creatina Gummy Frutas Vermelhas'],
  },
  {
    nome: 'Césio 137 Pré-Treino + Creatina',
    nichos: ['performance'],
    formulas: ['Energia e disposição - Pré-treino + Creatina 420g'],
  },
  {
    nome: 'Lemon Caps ZMA Complex Zinco Magnésio B6 L-Teanina 60 Cápsulas',
    nichos: ['performance', 'sono'],
    formulas: ['Beleza e bem-estar - ZMA', 'ZMA', 'ZMA Em Cápsula'],
  },

  {
    nome: 'Lemon Caps Serena Gotas 30ml Melatonina L-Teanina Magnésio',
    nichos: ['sono'],
    formulas: ['Qualidade do sono - Serena', 'SERENA (30/06)', 'SERENA'],
  },
  {
    nome: 'Lemoncaps Dream Gummy Melatonina Triptofano 60 Gomas Sabor Uva',
    nichos: ['sono'],
    formulas: ['Qualidade do sono - Melatonina Gummy', 'Melatonina + Triptofanos EM GUMMY'],
  },

  {
    nome: 'Lemon Caps BioPrincess Colágeno Biotina Ácido Hialurônico 60 Cápsulas',
    nichos: ['beleza'],
    formulas: [
      'Beleza e bem-estar - Bio Princess',
      'Bio Princess (Saúde e bem estar - Encapsulado - Premium)',
      'CABELO PELE E UNHA - BIOPRINCESS',
    ],
  },
  {
    nome: 'Lemon Caps Artflex Colágeno Tipo II Glucosamina MSM 60 cápsulas',
    nichos: ['beleza'],
    formulas: ['ArtFlex', 'ArtFlex Duplicata'],
  },
  { nome: 'Lemon Caps Floravex Psyllium e Prebióticos 60 cápsulas 30g', nichos: ['beleza'], formulas: [] },
  { nome: 'Lemon Caps BioGummy Biotina Zinco Vitaminas A C E 60 gomas', nichos: ['beleza'], formulas: [] },
];

/** Compara nome de formula sem depender de acento, caixa ou pontuacao. */
function chave(nome: string | null | undefined): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PORFORMULA = new Map<string, ProdutoLoja>();
for (const produto of PRODUTOS_LOJA) {
  for (const formula of produto.formulas) PORFORMULA.set(chave(formula), produto);
}

/** O produto da loja que corresponde a esta formula, ou null. */
export function produtoDaLoja(nomeFormula: string | null | undefined): ProdutoLoja | null {
  return PORFORMULA.get(chave(nomeFormula)) ?? null;
}

/**
 * Como o produto deve aparecer: o nome da loja quando existe, senao o nome do
 * sistema, sem alteracao.
 */
export function nomeDeExibicao(nomeFormula: string | null | undefined): string {
  return produtoDaLoja(nomeFormula)?.nome || nomeFormula || 'Fórmula sem nome';
}

/** Em que abas esta formula aparece. Sem correspondente, cai em "Fora da loja". */
export function abasDaFormula(nomeFormula: string | null | undefined): AbaCatalogo[] {
  const produto = produtoDaLoja(nomeFormula);
  return produto ? produto.nichos : [SEM_LOJA];
}
